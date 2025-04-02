"use client";

import Navbar from "@/components/studentNavbar";
import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import {
    collection,
    doc,
    getDocs,
    getDoc,
    query,
    where
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import styles from "./page.module.css";

export default function StudentAttendance() {
    const [studentInfo, setStudentInfo] = useState(null);
    const [subjects, setSubjects] = useState([]);
    const [selectedSubject, setSelectedSubject] = useState("");
    const [attendanceData, setAttendanceData] = useState({});
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalClasses: 0,
        presentClasses: 0,
        absentClasses: 0,
        attendancePercentage: 0
    });

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                // Fetch student information
                const usersRef = collection(db, "users");
                const querySnapshot = await getDocs(usersRef);
                const studentDoc = querySnapshot.docs.find(
                    (doc) => doc.data().email === user.email
                );

                if (studentDoc) {
                    const studentData = studentDoc.data();
                    setStudentInfo({
                        id: studentDoc.id,
                        ...studentData
                    });

                    // Get all teachers
                    const teachersQuery = await getDocs(usersRef);
                    const teachers = teachersQuery.docs
                        .filter(doc => doc.data().role === "teacher")
                        .map(doc => doc.data());

                    // Get unique subjects from all teachers
                    const allSubjects = new Set();
                    teachers.forEach(teacher => {
                        if (teacher.subject) {
                            teacher.subject.split(",").forEach(subject => {
                                allSubjects.add(subject.trim().toLowerCase().replace(/ /g, "_"));
                            });
                        }
                    });

                    setSubjects(Array.from(allSubjects));
                }
            }
        });

        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchAttendance = async () => {
            if (!selectedSubject || !studentInfo) return;

            setLoading(true);
            try {
                // Create a reference to the student's attendance document
                const attendanceRef = doc(db, "attendance", `${selectedSubject}_${studentInfo.id}`);
                const attendanceDoc = await getDoc(attendanceRef);

                if (attendanceDoc.exists()) {
                    const data = attendanceDoc.data();
                    // Transform the data to match the expected format
                    const transformedData = {};
                    Object.entries(data).forEach(([date, record]) => {
                        transformedData[date] = record.present;
                    });
                    setAttendanceData(transformedData);

                    // Calculate statistics
                    const totalClasses = Object.keys(transformedData).length;
                    const presentClasses = Object.values(transformedData).filter(Boolean).length;
                    const absentClasses = totalClasses - presentClasses;
                    const attendancePercentage = totalClasses > 0 
                        ? Math.round((presentClasses / totalClasses) * 100) 
                        : 0;

                    setStats({
                        totalClasses,
                        presentClasses,
                        absentClasses,
                        attendancePercentage
                    });
                } else {
                    setAttendanceData({});
                    setStats({
                        totalClasses: 0,
                        presentClasses: 0,
                        absentClasses: 0,
                        attendancePercentage: 0
                    });
                }
            } catch (error) {
                console.error("Error fetching attendance:", error);
                setAttendanceData({});
                setStats({
                    totalClasses: 0,
                    presentClasses: 0,
                    absentClasses: 0,
                    attendancePercentage: 0
                });
            }
            setLoading(false);
        };

        fetchAttendance();
    }, [selectedSubject, studentInfo]);

    return (
        <div>
            <Navbar />
            <div className={styles.container}>
                <h1>My Attendance</h1>

                {studentInfo && (
                    <div className={styles.studentInfo}>
                        <h2>Welcome, {studentInfo.name}</h2>
                        <p>Class: {studentInfo.class}</p>
                    </div>
                )}

                <div className={styles.subjectSelector}>
                    <label>Select Subject:</label>
                    <select
                        value={selectedSubject}
                        onChange={(e) => setSelectedSubject(e.target.value)}
                    >
                        <option value="">Choose a subject</option>
                        {subjects.map((subject) => (
                            <option key={subject} value={subject}>
                                {subject.replace(/_/g, " ")}
                            </option>
                        ))}
                    </select>
                </div>

                {loading ? (
                    <div className={styles.loading}>Loading attendance...</div>
                ) : selectedSubject ? (
                    <div className={styles.attendanceContainer}>
                        <h3>Attendance Record for {selectedSubject.replace(/_/g, " ")}</h3>
                        
                        {/* Statistics Section */}
                        <div className={styles.statsContainer}>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{stats.attendancePercentage}%</div>
                                <div className={styles.statLabel}>Attendance Rate</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{stats.totalClasses}</div>
                                <div className={styles.statLabel}>Total Classes</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{stats.presentClasses}</div>
                                <div className={styles.statLabel}>Present</div>
                            </div>
                            <div className={styles.statCard}>
                                <div className={styles.statValue}>{stats.absentClasses}</div>
                                <div className={styles.statLabel}>Absent</div>
                            </div>
                        </div>

                        <div className={styles.attendanceList}>
                            {Object.entries(attendanceData)
                                .sort((a, b) => new Date(b[0]) - new Date(a[0]))
                                .map(([date, isPresent]) => (
                                    <div
                                        key={date}
                                        className={`${styles.attendanceItem} ${
                                            isPresent ? styles.present : styles.absent
                                        }`}
                                    >
                                        <span className={styles.date}>
                                            {new Date(date).toLocaleDateString()}
                                        </span>
                                        <span className={styles.status}>
                                            {isPresent ? "Present" : "Absent"}
                                        </span>
                                    </div>
                                ))}
                        </div>
                    </div>
                ) : (
                    <div className={styles.message}>
                        Please select a subject to view your attendance
                    </div>
                )}
            </div>
        </div>
    );
}
