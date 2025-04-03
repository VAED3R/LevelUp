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

            // Fetch students from the students collection
            const studentQuery = await getDocs(collection(db, "students"));
            const studentList = studentQuery.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
            }));

            setStudents(studentList);

            // Extract unique classes
            const uniqueClasses = [
                ...new Set(studentList.map((student) => student.class)),
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

    const markAllPresent = () => {
        const newAttendance = {};
        filteredStudents.forEach((student) => {
            newAttendance[student.id] = true;
        });
        setAttendance(newAttendance);
    };

    const markAllAbsent = () => {
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

        setLoading(true);
        try {
            // First, create a batch to handle all operations
            const batch = writeBatch(db);
            
            // Process each student
            for (const student of filteredStudents) {
                // Create attendance record
                const attendanceData = {
                    studentId: student.id,
                    studentName: student.name,
                    class: selectedClass,
                    subject: selectedSubject,
                    status: attendance[student.id] ? "present" : "absent",
                    addedBy: auth.currentUser.uid,
                    addedAt: new Date().toISOString(),
                };

                // Add attendance to the attendance collection
                const attendanceRef = doc(collection(db, "attendance"));
                batch.set(attendanceRef, attendanceData);

                // If student is present, award 10 points
                if (attendance[student.id] === true) {
                    try {
                        // Create a new attendance points entry
                        const newAttendanceEntry = {
                            date: new Date().toISOString(),
                            points: 10,
                            quizId: "attendance_" + new Date().getTime(), // Unique ID for attendance
                            score: 10, // Points awarded for attendance
                            subject: selectedSubject,
                            topic: "attendance",
                            totalQuestions: 1,
                            userId: student.id,
                            type: "attendance" // Mark this as attendance points
                        };

                        // Check if student document exists in students collection
                        const studentRef = doc(db, "students", student.id);
                        const studentDoc = await getDoc(studentRef);
                        
                        if (studentDoc.exists()) {
                            // Student exists, update points array
                            const studentData = studentDoc.data();
                            
                            // Get the current points array or initialize an empty array
                            let currentPointsArray = [];
                            if (studentData.points && Array.isArray(studentData.points)) {
                                currentPointsArray = [...studentData.points];
                            }
                            
                            // Add the new attendance points entry to the array
                            currentPointsArray.push(newAttendanceEntry);
                            
                            // Calculate total points
                            const totalPoints = calculateTotalPoints(currentPointsArray);
                            
                            // Update the student document with the new points array and total points
                            batch.update(studentRef, {
                                points: currentPointsArray,
                                totalPoints: totalPoints
                            });
                            
                            console.log(`Updating points for ${student.name}: Adding 10 attendance points in ${selectedSubject}. Total points: ${totalPoints}`);
                        } else {
                            // Student doesn't exist, create new document
                            const newStudentData = {
                                id: student.id,
                                name: student.name,
                                email: student.email || "",
                                class: student.class,
                                createdAt: new Date().toISOString(),
                                points: [newAttendanceEntry],
                                totalPoints: 10 // Initial total points
                            };
                            
                            batch.set(studentRef, newStudentData);
                            console.log(`Creating new student document for ${student.name} with 10 attendance points. Total points: 10`);
                        }
                    } catch (error) {
                        console.error(`Error processing student ${student.name}:`, error);
                    }
                }
            }

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

    // Helper function to calculate total points
    const calculateTotalPoints = (pointsArray) => {
        if (!pointsArray || !Array.isArray(pointsArray)) return 0;
        
        return pointsArray.reduce((total, entry) => {
            return total + (entry.points || 0);
        }, 0);
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
                        >
                            <option value="">Select Class</option>
                            {classes.map((className, index) => (
                                <option key={index} value={className}>
                                    {className}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formGroup}>
                        <label>Subject:</label>
                        <select
                            value={selectedSubject}
                            onChange={(e) => setSelectedSubject(e.target.value)}
                        >
                            <option value="">Select Subject</option>
                            {subjects.map((subject) => (
                                <option key={subject} value={subject}>
                                    {subject.replace(/_/g, " ")}
                                </option>
                            ))}
                        </select>
                    </div>
                </div>

                    {filteredStudents.length > 0 && (
                        <div className={styles.bulkActions}>
                            <button 
                                className={styles.bulkButton} 
                                onClick={markAllPresent}
                            >
                                Mark All Present
                            </button>
                            <button 
                                className={styles.bulkButton} 
                                onClick={markAllAbsent}
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

                <button
                        onClick={handleSubmit}
                    className={styles.saveButton}
                    disabled={loading}
                >
                    {loading ? "Saving..." : "Save Attendance"}
                </button>
            </div>
            </div>
        </div>
    );
}
