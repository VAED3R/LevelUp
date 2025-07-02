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

    // Helper functions for enhanced cards
    const getCourseTypeIcon = (courseType) => {
        const icons = {
            'Core': '📚',
            'Elective': '🎯',
            'Lab': '🧪',
            'Project': '💻',
            'Seminar': '🎤',
            'Workshop': '🔧',
            'Tutorial': '📝',
            'Practical': '⚡',
            'Theory': '📖',
            'Research': '🔬',
            'Skill Enhancement': '🚀'
        };
        return icons[courseType] || '📋';
    };

    const getCourseTypeColor = (courseType) => {
        const colors = {
            'Core': '#4CAF50',
            'Elective': '#FF9800',
            'Lab': '#2196F3',
            'Project': '#9C27B0',
            'Seminar': '#F44336',
            'Workshop': '#607D8B',
            'Tutorial': '#795548',
            'Practical': '#00BCD4',
            'Theory': '#8BC34A',
            'Research': '#E91E63',
            'Skill Enhancement': '#FF5722'
        };
        return colors[courseType] || '#9C27B0';
    };

    const getCourseTypeBadge = (courseType) => {
        const badges = {
            'Core': 'Core',
            'Elective': 'Elective',
            'Lab': 'Laboratory',
            'Project': 'Project',
            'Seminar': 'Seminar',
            'Workshop': 'Workshop',
            'Tutorial': 'Tutorial',
            'Practical': 'Practical',
            'Theory': 'Theory',
            'Research': 'Research',
            'Skill Enhancement': 'Skill Enhancement'
        };
        return badges[courseType] || 'Course';
    };

    const getSubjectIcon = (subjectName) => {
        const subjectIcons = {
            'Mathematics': '🔢',
            'Physics': '⚛️',
            'Chemistry': '🧪',
            'Biology': '🧬',
            'Computer Science': '💻',
            'Engineering': '⚙️',
            'Economics': '💰',
            'Psychology': '🧠',
            'Literature': '📖',
            'History': '🏛️',
            'Geography': '🌍',
            'Art': '🎨',
            'Music': '🎵',
            'Physical Education': '⚽',
            'Philosophy': '🤔',
            'Sociology': '👥',
            'Political Science': '🏛️',
            'Environmental Science': '🌱',
            'Astronomy': '🌌',
            'Statistics': '📊',
            'Programming': '👨‍💻',
            'Database': '🗄️',
            'Networks': '🌐',
            'Algorithms': '🔍',
            'Software Engineering': '🛠️',
            'Data Structures': '📦',
            'Operating Systems': '💾',
            'Machine Learning': '🤖',
            'Artificial Intelligence': '🧠',
            'Web Development': '🌐',
            'Mobile Development': '📱',
            'Cybersecurity': '🔒',
            'Cloud Computing': '☁️',
            'DevOps': '⚡',
            'UI/UX Design': '🎨',
            'Game Development': '🎮',
            'Blockchain': '⛓️',
            'IoT': '📡',
            'Big Data': '📈',
            'Data Science': '📊'
        };
        
        // Try to match by subject name
        for (const [key, icon] of Object.entries(subjectIcons)) {
            if (subjectName.toLowerCase().includes(key.toLowerCase())) {
                return icon;
            }
        }
        
        // Default icons based on common patterns
        if (subjectName.toLowerCase().includes('math')) return '🔢';
        if (subjectName.toLowerCase().includes('programming') || subjectName.toLowerCase().includes('coding')) return '👨‍💻';
        if (subjectName.toLowerCase().includes('database')) return '🗄️';
        if (subjectName.toLowerCase().includes('network')) return '🌐';
        if (subjectName.toLowerCase().includes('algorithm')) return '🔍';
        if (subjectName.toLowerCase().includes('software')) return '🛠️';
        if (subjectName.toLowerCase().includes('data')) return '📊';
        if (subjectName.toLowerCase().includes('web')) return '🌐';
        if (subjectName.toLowerCase().includes('mobile')) return '📱';
        if (subjectName.toLowerCase().includes('security')) return '🔒';
        if (subjectName.toLowerCase().includes('cloud')) return '☁️';
        if (subjectName.toLowerCase().includes('devops')) return '⚡';
        if (subjectName.toLowerCase().includes('design')) return '🎨';
        if (subjectName.toLowerCase().includes('game')) return '🎮';
        if (subjectName.toLowerCase().includes('blockchain')) return '⛓️';
        if (subjectName.toLowerCase().includes('iot')) return '📡';
        if (subjectName.toLowerCase().includes('machine learning') || subjectName.toLowerCase().includes('ai')) return '🤖';
        
        return '📚'; // Default icon
    };

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
                        <div className={styles.semesterSelector}>
                            <label htmlFor="semesterSelect" className={styles.semesterLabel}>
                                Select Semester:
                            </label>
                            <select
                                id="semesterSelect"
                                value={selectedSemester}
                                onChange={(e) => setSelectedSemester(e.target.value)}
                                className={styles.select}
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
                                <div className={styles.loadingState}>Loading subjects...</div>
                            ) : !selectedSemester ? (
                                <div className={styles.emptyState}>Please select a semester.</div>
                            ) : subjects.length === 0 ? (
                                <div className={styles.emptyState}>No subjects found for this semester.</div>
                            ) : (
                                subjects.map((subject) => (
                                    <div key={subject.id} className={styles.card}>
                                        <div className={styles.cardHeader}>
                                            <div className={styles.subjectIcon}>
                                                {getSubjectIcon(subject.name)}
                                            </div>
                                            <div className={styles.courseTypeBadge} 
                                                 style={{ backgroundColor: getCourseTypeColor(subject.courseType) }}>
                                                {getCourseTypeBadge(subject.courseType)}
                                            </div>
                                        </div>
                                        
                                        <div className={styles.cardContent}>
                                            <h2 className={styles.subjectTitle}>{subject.name}</h2>
                                            <div className={styles.courseInfo}>
                                                <div className={styles.infoItem}>
                                                    <span className={styles.infoLabel}>Code:</span>
                                                    <span className={styles.infoValue}>{subject.courseCode}</span>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        <div className={styles.cardActions}>
                                            <Link href={`/materials?subject=${encodeURIComponent(subject.name)}`}>
                                                <button className={styles.button}>
                                                    <span className={styles.buttonIcon}>📚</span>
                                                    <span className={styles.buttonText}>View Materials</span>
                                                </button>
                                            </Link>
                                        </div>
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
