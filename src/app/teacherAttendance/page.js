"use client";

import Navbar from "@/components/teacherNavbar";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    setDoc,
    getDoc,
    query,
    where,
    addDoc,
    updateDoc,
    writeBatch
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./page.module.css";

export default function TeacherAttendance() {
    const [students, setStudents] = useState([]);
    const [filteredStudents, setFilteredStudents] = useState([]);
    const [classes, setClasses] = useState([]);
    const [selectedClass, setSelectedClass] = useState("");
    const [selectedDate, setSelectedDate] = useState("");
    const [attendance, setAttendance] = useState({});
    const [loading, setLoading] = useState(false);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [teacherEmail, setTeacherEmail] = useState("");
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setTeacherEmail(user.email);
            } else {
                setTeacherEmail("");
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        if (!teacherEmail) return;

        const fetchData = async () => {
            // Fetch teacher info
            const teacherQuery = await getDocs(collection(db, "users"));
            const teacher = teacherQuery.docs.find(
                (doc) => doc.data().email === teacherEmail
            )?.data();

            if (teacher) {
                const teacherSubjects = teacher.subject
                    .split(",")
                    .map((sub) => sub.trim().toLowerCase().replace(/ /g, "_"));
                setSubjects(teacherSubjects);
            }

            // Fetch students from users collection
            const usersQuery = await getDocs(collection(db, "users"));
            const usersList = usersQuery.docs
                .filter((doc) => doc.data().role === "student")
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }));

            // Fetch students from students collection
            const studentsQuery = await getDocs(collection(db, "students"));
            const studentsList = studentsQuery.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            // Create a map of existing student documents
            const studentsMap = {};
            studentsList.forEach(student => {
                studentsMap[student.id] = student;
            });

            // Ensure all users are in the students collection
            let batch = writeBatch(db);
            let batchCount = 0;
            const batchPromises = [];

            for (const user of usersList) {
                if (!studentsMap[user.id]) {
                    // Student doesn't exist in students collection, create it
                    const studentRef = doc(db, "students", user.id);
                    const studentData = {
                        ...user,
                        points: [],
                        totalPoints: 0,
                        lastUpdated: new Date().toISOString()
                    };
                    
                    batch.set(studentRef, studentData);
                    batchCount++;
                    
                    if (batchCount >= 500) {
                        // Firestore has a limit of 500 operations per batch
                        batchPromises.push(batch.commit());
                        batch = writeBatch(db);
                        batchCount = 0;
                    }
                }
            }
            
            // Commit any remaining operations
            if (batchCount > 0) {
                batchPromises.push(batch.commit());
            }
            
            // Wait for all batches to complete
            if (batchPromises.length > 0) {
                await Promise.all(batchPromises);
            }

            // Now fetch the updated students list
            const updatedStudentsQuery = await getDocs(collection(db, "students"));
            const updatedStudentsList = updatedStudentsQuery.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));

            setStudents(updatedStudentsList);

            // Extract unique classes
            const uniqueClasses = [
                ...new Set(updatedStudentsList.map((student) => student.class)),
            ];
            setClasses(uniqueClasses.sort());
        };

        fetchData();
    }, [teacherEmail]);

    useEffect(() => {
        if (selectedClass) {
            const filtered = students.filter(
                (student) => student.class === selectedClass
            );
            // Sort students alphabetically by name
            const sortedStudents = filtered.sort((a, b) => 
                a.name.localeCompare(b.name)
            );
            setFilteredStudents(sortedStudents);

            // Initialize attendance state
            const initialAttendance = {};
            sortedStudents.forEach((student) => {
                initialAttendance[student.id] = false;
            });
            setAttendance(initialAttendance);
        } else {
            setFilteredStudents([]);
            setAttendance({});
        }
    }, [selectedClass, students]);

    const handleToggleAttendance = (studentId) => {
        setAttendance((prev) => ({
            ...prev,
            [studentId]: !prev[studentId],
        }));
    };

    const handleMarkAllPresent = () => {
        const newAttendance = {};
        filteredStudents.forEach((student) => {
            // 80% chance of being present, 20% chance of being absent
            newAttendance[student.id] = Math.random() < 0.8;
        });
        setAttendance(newAttendance);
    };

    const handleMarkAllAbsent = () => {
        const newAttendance = {};
        filteredStudents.forEach((student) => {
            newAttendance[student.id] = false;
        });
        setAttendance(newAttendance);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedClass || !selectedSubject) {
            setError("Please select a class and subject");
            return;
        }

        try {
            setLoading(true);

            // Create a batch for atomic updates
            const batch = writeBatch(db);

            // Process each student's attendance
            const promises = filteredStudents.map(async (student) => {
                const attendanceData = {
                    studentId: student.id,
                    studentName: student.name,
                    class: selectedClass,
                    subject: selectedSubject,
                    status: attendance[student.id] ? "present" : "absent",
                    addedBy: auth.currentUser.uid,
                    addedAt: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
                };

                // Add attendance to the attendance collection
                await addDoc(collection(db, "attendance"), attendanceData);

                // If student is present, award 10 points
                if (attendance[student.id] === true) {
                    // Check if student document exists in students collection
                    const studentRef = doc(db, "students", student.id);
                    const studentDoc = await getDoc(studentRef);
                    
                    if (studentDoc.exists()) {
                        // Student exists, update points array
                        const studentData = studentDoc.data();
                        
                        // Check if points array exists and is valid
                        let currentPointsArray = [];
                        if (studentData.points) {
                            if (Array.isArray(studentData.points)) {
                                currentPointsArray = [...studentData.points];
                                console.log(`Using existing points array for ${student.name} with ${currentPointsArray.length} entries`);
                            } else {
                                console.warn(`Points field exists for ${student.name} but is not an array. Creating new array.`);
                                currentPointsArray = [];
                            }
                        } else {
                            // If points array doesn't exist, create an empty one
                            console.log(`Creating new points array for ${student.name} as it doesn't exist`);
                            currentPointsArray = [];
                        }
                        
                        // Create new points entry
                        const newPointsEntry = {
                            points: 10,
                            date: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
                            subject: selectedSubject,
                            score: 100, // Full score for attendance
                            totalQuestions: 1,
                            quizId: "attendance",
                            topic: "attendance",
                            userId: student.id
                        };
                        
                        // Add the new attendance points entry to the array
                        currentPointsArray.push(newPointsEntry);
                        
                        // Calculate total points
                        const totalPoints = calculateTotalPoints(currentPointsArray);
                        
                        // Update the student document with the new points array and total points
                        batch.update(studentRef, {
                            points: currentPointsArray,
                            totalPoints: totalPoints,
                            lastUpdated: new Date().toISOString()
                        });
                        
                        console.log(`Updating points for ${student.name}: Adding 10 points for attendance in ${selectedSubject}. New total: ${totalPoints}`);
                    } else {
                        console.warn(`Student document not found for ID: ${student.id}`);
                        
                        // Try to create the student document from users collection
                        const userRef = doc(db, "users", student.id);
                        const userDoc = await getDoc(userRef);
                        
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            const newStudentData = {
                                ...userData,
                                points: [{
                                    points: 10,
                                    date: selectedDate ? new Date(selectedDate).toISOString() : new Date().toISOString(),
                                    subject: selectedSubject,
                                    score: 100,
                                    totalQuestions: 1,
                                    quizId: "attendance",
                                    topic: "attendance",
                                    userId: student.id
                                }],
                                totalPoints: 10,
                                lastUpdated: new Date().toISOString()
                            };
                            
                            batch.set(studentRef, newStudentData);
                            console.log(`Created new student document for ${student.name} with initial points`);
                        }
                    }
                }
            });

            await Promise.all(promises);
            
            // Commit the batch
            await batch.commit();
            
            setSuccess(true);
            setError(null);
            
            // Reset attendance
            const resetAttendance = {};
            filteredStudents.forEach(student => {
                resetAttendance[student.id] = false;
            });
            setAttendance(resetAttendance);
        } catch (error) {
            console.error("Error adding attendance:", error);
            setError("Failed to add attendance");
            setSuccess(false);
        } finally {
            setLoading(false);
        }
    };
    
    // Helper function to calculate total points from points array
    const calculateTotalPoints = (pointsArray) => {
        return pointsArray.reduce((total, entry) => total + (entry.points || 0), 0);
    };

    return (
    <div style={{ height: '100vh', overflow: 'auto' }}>
            <Navbar />
            <div className={styles.background}>
            <div className={styles.container}>
                    <h1 className={styles.heading}>Teacher Attendance</h1>

                <div className={styles.filters}>
                    <div className={styles.formGroup}>
                        <label>Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                        />
                    </div>
                    <div className={styles.formGroup}>
                        <label>Class:</label>
                        <select
                            value={selectedClass}
                            onChange={(e) => setSelectedClass(e.target.value)}
                                required
                            >
                                <option value="">Choose a class</option>
                                {classes.map((classItem) => (
                                    <option key={classItem} value={classItem}>
                                        {classItem}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Subject:</label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                                required
                        >
                                <option value="">Choose a subject</option>
                            {subjects.map((subject) => (
                                <option key={subject} value={subject}>
                                    {subject.replace(/_/g, " ")}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                {selectedClass && selectedSubject && (
                    <div className={styles.markAllContainer}>
                        <button
                            type="button"
                            onClick={handleMarkAllPresent}
                            className={styles.markAllButton}
                        >
                            Mark All Present
                        </button>
                        <button
                            type="button"
                            onClick={handleMarkAllAbsent}
                            className={styles.markAllButton}
                        >
                            Mark All Absent
                        </button>
                    </div>
                )}

                <div className={styles.cardContainer}>
                    {filteredStudents.map((student) => (
                        <div
                            key={student.id}
                            className={`${styles.studentCard} ${
                                attendance[student.id] ? styles.present : styles.absent
                            }`}
                            onClick={() => handleToggleAttendance(student.id)}
                        >
                            <h3>{student.name}</h3>
                            <p>Class: {student.class}</p>
                            <p>{attendance[student.id] ? "Present" : "Absent"}</p>
                        </div>
                    ))}
                </div>

                {selectedClass && selectedSubject && filteredStudents.length > 0 && (
                    <button
                        type="submit"
                        onClick={handleSubmit}
                        className={styles.saveButton}
                        disabled={loading}
                    >
                        {loading ? "Saving..." : "Save Attendance"}
                    </button>
                )}
            </div>
            </div>
        </div>
    );
}
