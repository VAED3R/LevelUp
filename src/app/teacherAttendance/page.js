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
    where
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

    const handleSaveAttendance = async () => {
        if (!selectedClass || !selectedDate || !selectedSubject) {
            alert("Please select a class, date, and subject.");
            return;
        }

        setLoading(true);

        try {
            // Create a batch of promises for each student
            const promises = filteredStudents.map(async (student) => {
                // Create a reference to the student's attendance document
                const attendanceRef = doc(db, "attendance", `${selectedSubject}_${student.id}`);
                const attendanceDoc = await getDoc(attendanceRef);

                // Get existing attendance data or initialize empty object
                const existingData = attendanceDoc.exists() ? attendanceDoc.data() : {};

                // Update the attendance data
                const updatedData = {
                    ...existingData,
                    [selectedDate]: {
                        present: attendance[student.id],
                        class: selectedClass,
                        subject: selectedSubject,
                        teacher: teacherEmail
                    }
                };

                // Save the updated attendance data
                await setDoc(attendanceRef, updatedData);
            });

            // Wait for all promises to complete
            await Promise.all(promises);
            setLoading(false);
            alert("Attendance saved successfully!");
        } catch (error) {
            console.error("Error saving attendance:", error);
            setLoading(false);
            alert("Error saving attendance. Please try again.");
        }
    };

    return (
        <div>
            <Navbar />
            <div className={styles.container}>
                <h1>Teacher Attendance</h1>

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
                    onClick={handleSaveAttendance}
                    className={styles.saveButton}
                    disabled={loading}
                >
                    {loading ? "Saving..." : "Save Attendance"}
                </button>
            </div>
        </div>
    );
}
