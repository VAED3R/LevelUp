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
    updateDoc
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

            // Fetch students
            const studentQuery = await getDocs(collection(db, "users"));
            const studentList = studentQuery.docs
                .filter((doc) => doc.data().role === "student")
                .map((doc) => ({
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
            setFilteredStudents(filtered);

            // Initialize attendance state
            const initialAttendance = {};
            filtered.forEach((student) => {
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

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedClass || !selectedSubject) {
            setError("Please select a class and subject");
            return;
        }

        try {
            const promises = filteredStudents.map(async (student) => {
                const attendanceData = {
                    studentId: student.id,
                    studentName: student.name,
                    class: selectedClass,
                    subject: selectedSubject,
                    status: attendance[student.id] || "absent",
                    addedBy: auth.currentUser.uid,
                    addedAt: new Date().toISOString(),
                };

                // Add attendance to the attendance collection
                await addDoc(collection(db, "attendance"), attendanceData);

                // If student is present, award 10 points
                if (attendance[student.id] === "present") {
                    // Get current student document
                    const studentRef = doc(db, "users", student.id);
                    const studentDoc = await getDoc(studentRef);
                    
                    if (studentDoc.exists()) {
                        const studentData = studentDoc.data();
                        // Ensure currentPointsArray is always an array
                        const currentPointsArray = Array.isArray(studentData.points) ? studentData.points : [];
                        
                        const newPointsEntry = {
                            points: 10,
                            date: new Date().toISOString(),
                            subject: selectedSubject,
                            score: 100, // Full score for attendance
                            totalQuestions: 1,
                            quizId: "attendance",
                            topic: "attendance",
                            userId: student.id
                        };

                        const updatedPointsArray = [...currentPointsArray, newPointsEntry];
                        console.log(`Updating points for ${student.name}: Adding 10 points for attendance in ${selectedSubject}`);
                        
                        await updateDoc(studentRef, {
                            points: updatedPointsArray
                        });
                    }
                }
            });

            await Promise.all(promises);
            setSuccess(true);
            setError(null);
            
            // Reset attendance
            const resetAttendance = {};
            filteredStudents.forEach(student => {
                resetAttendance[student.id] = "absent";
            });
            setAttendance(resetAttendance);
        } catch (error) {
            console.error("Error adding attendance:", error);
            setError("Failed to add attendance");
            setSuccess(false);
        }
    };

  return (
    <div>
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
    