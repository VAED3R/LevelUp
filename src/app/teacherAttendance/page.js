"use client";

import Navbar from "@/components/teacherNavbar";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase"; // ✅ Import auth
import {
    collection,
    doc,
    getDocs,
    setDoc,
    getDoc
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth"; // ✅ Import onAuthStateChanged
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
    const [teacherEmail, setTeacherEmail] = useState(""); // ✅ Store logged-in teacher's email

    // ✅ Fetch the logged-in teacher's email
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setTeacherEmail(user.email); // ✅ Set email from auth
            } else {
                setTeacherEmail("");
            }
        });

        return () => unsubscribe();
    }, []);

    // ✅ Fetch students and teacher subjects dynamically
    useEffect(() => {
        if (!teacherEmail) return;

        const fetchData = async () => {
            // ✅ Fetch teacher info
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

            // ✅ Fetch students and sort them alphabetically
            const studentQuery = await getDocs(collection(db, "users"));
            const studentList = studentQuery.docs
                .filter((doc) => doc.data().role === "student")
                .map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                .sort((a, b) => a.name.localeCompare(b.name)); // ✅ Sort students alphabetically

            setStudents(studentList);

            // ✅ Extract unique classes and sort them
            const uniqueClasses = [
                ...new Set(studentList.map((student) => student.class)),
            ];
            setClasses(uniqueClasses.sort());
        };

        fetchData();
    }, [teacherEmail]); // ✅ Fetch data only when email is available

    // ✅ Filter students based on selected class
    useEffect(() => {
        if (selectedClass) {
            const filtered = students.filter(
                (student) => student.class === selectedClass
            );
            setFilteredStudents(filtered);

            // ✅ Initialize attendance state
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

    // ✅ Toggle attendance state for a student
    const handleToggleAttendance = (studentId) => {
        setAttendance((prev) => ({
            ...prev,
            [studentId]: !prev[studentId],
        }));
    };

    // ✅ Save attendance to Firestore
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
            <div className={styles.background}>
            <div className={styles.container}>
                <h1>Teacher Attendance</h1>

                {/* ✅ Date, Class, and Subject Selection */}
                <div className={styles.filters}>
                    <div className={styles.formGroup}>
                        <label>Date:</label>
                        <input
                            type="date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className={styles.datePicker} // ✅ Styled date picker
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

                {/* ✅ Student Cards */}
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

                {/* ✅ Save Attendance Button */}
                <button
                    onClick={handleSaveAttendance}
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
