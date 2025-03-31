"use client";

import Navbar from "@/components/teacherNavbar";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    setDoc,
    getDoc
} from "firebase/firestore";
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

    // Fetch students and teacher subjects
    useEffect(() => {
        const fetchData = async () => {
            // Fetch teacher info
            const teacherQuery = await getDocs(
                collection(db, "users")
            );
            const teacher = teacherQuery.docs.find(
                (doc) =>
                    doc.data().email === "sonalayyapan@gmail.com" // Replace with dynamic email
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
    }, []);

    // Filter students by class
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

        const collectionName = `attendance_${selectedSubject}`;

        const promises = filteredStudents.map(async (student) => {
            const studentRef = doc(db, collectionName, student.id);
            const docSnap = await getDoc(studentRef);

            const attendanceData = docSnap.exists() ? docSnap.data() : {};

            await setDoc(studentRef, {
                ...attendanceData,
                [selectedDate]: attendance[student.id],
            });
        });

        await Promise.all(promises);
        setLoading(false);
        alert("Attendance saved successfully!");
    };

    return (
        <div>
            <Navbar />
            <div className={styles.container}>
                <h1>Teacher Attendance</h1>

                {/* Date, Class, and Subject Selection */}
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
                                <option key={index} value={className}>   {/* ✅ Added key prop */}
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

                {/* Student Cards */}
                <div className={styles.cardContainer}>
                    {filteredStudents.map((student) => (
                        <div
                            key={student.id}
                            className={`${styles.studentCard} ${attendance[student.id] ? styles.present : styles.absent
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
