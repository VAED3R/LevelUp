"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "@/lib/firebase";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import Link from "next/link";
import IntroAnimation from "../../components/IntroAnimation";

export default function CourseMats() {
    const [semesters, setSemesters] = useState([]);
    const [selectedSemester, setSelectedSemester] = useState("6");
    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [studentEmail, setStudentEmail] = useState("");

    // Get current student email
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setStudentEmail(user.email);
            }
        });
        return () => unsubscribe();
    }, []);

    // Fetch semesters from coursemap collection
    useEffect(() => {
        const fetchSemesters = async () => {
            const coursemapRef = collection(db, "coursemap");
            const querySnapshot = await getDocs(coursemapRef);

            const semesterSet = new Set();
            querySnapshot.forEach((doc) => {
                const data = doc.data();
                if (data.semesters && Array.isArray(data.semesters)) {
                    data.semesters.forEach((semester) => {
                        if (semester.semesterName) {
                            semesterSet.add(semester.semesterName);
                        }
                    });
                }
            });

            setSemesters(Array.from(semesterSet).sort());
        };

        fetchSemesters();
    }, []);

    // Fetch subjects mapped to the current student
    useEffect(() => {
        const fetchStudentSubjects = async () => {
            if (!studentEmail || !selectedSemester) {
                setSubjects([]);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                const coursemapRef = collection(db, "coursemap");
                const q = query(coursemapRef, where("studentEmail", "==", studentEmail));
                const querySnapshot = await getDocs(q);

                const studentSubjects = [];
                querySnapshot.forEach((doc) => {
                    const data = doc.data();
                    if (data.semesters && Array.isArray(data.semesters)) {
                        const semesterData = data.semesters.find(
                            (semester) => semester.semesterName === selectedSemester
                        );
                        
                        if (semesterData && semesterData.courses) {
                            semesterData.courses.forEach((course) => {
                                studentSubjects.push({
                                    id: `${doc.id}_${course.courseName}`,
                                    name: course.courseName,
                                    courseCode: course.courseCode,
                                    courseType: course.courseType,
                                    semester: course.semester
                                });
                            });
                        }
                    }
                });

                setSubjects(studentSubjects);
            } catch (error) {
                console.error("Error fetching student subjects:", error);
                setSubjects([]);
            } finally {
                setLoading(false);
            }
        };

        fetchStudentSubjects();
    }, [studentEmail, selectedSemester]);

    return (
        <IntroAnimation loadingText="Loading Course Materials...">
            <div>
                <Navbar />
                <div className={styles.classContainer}>
                    <div className={styles.content}>
                        <h1 className={styles.title}>Course Materials</h1>
                        <div style={{ marginBottom: "1.5rem" }}>
                            <label htmlFor="semesterSelect" style={{ fontWeight: 600, marginRight: 8 }}>
                                Select Semester:
                            </label>
                            <select
                                id="semesterSelect"
                                value={selectedSemester}
                                onChange={(e) => setSelectedSemester(e.target.value)}
                                className={styles.select}
                                style={{ padding: "0.5rem", borderRadius: 4, minWidth: 150 }}
                            >
                                <option value="" disabled>
                                    Select Semester
                                </option>
                                {semesters.map((sem) => (
                                    <option key={sem} value={sem}>
                                        {sem}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div className={styles.cardGrid}>
                            {loading ? (
                                <div>Loading...</div>
                            ) : !selectedSemester ? (
                                <div>Please select a semester.</div>
                            ) : subjects.length === 0 ? (
                                <div>No subjects found for this semester.</div>
                            ) : (
                                subjects.map((subject) => (
                                    <div key={subject.id} className={styles.card}>
                                        <h2>{subject.name}</h2>
                                        <p style={{ color: '#666', marginBottom: '1rem' }}>
                                            Code: {subject.courseCode} | Type: {subject.courseType}
                                        </p>
                                        <Link href={`/materials?subject=${encodeURIComponent(subject.name)}`}>
                                            <button className={styles.button}>View Materials</button>
                                        </Link>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </IntroAnimation>
    );
}
