"use client";

import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";
import Link from "next/link";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";

export default function ClassC() {
    const [teacherEmail, setTeacherEmail] = useState("");
    const [teacherName, setTeacherName] = useState("");
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showModal, setShowModal] = useState(false);

    const classes = [
        { id: 1, name: "S6CO", students: 30, assessments: 4, attendance: 88 },
        { id: 2, name: "S6CS", students: 35, assessments: 5, attendance: 92 },
        { id: 3, name: "S6CT", students: 28, assessments: 3, attendance: 85 },
        { id: 4, name: "S6CS2", students: 27, assessments: 3, attendance: 87 }
    ];

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            if (user) {
                setTeacherEmail(user.email);
            }
        });
        return () => unsubscribe();
    }, []);

    useEffect(() => {
        const fetchTeacherData = async () => {
            if (!teacherEmail) return;

            try {
                const usersRef = collection(db, "users");
                const querySnapshot = await getDocs(usersRef);
                const teacher = querySnapshot.docs.find(
                    (doc) => doc.data().email === teacherEmail
                )?.data();

                if (teacher) {
                    setTeacherName(teacher.name);
                }
            } catch (error) {
                console.error("Error fetching teacher data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherData();
    }, [teacherEmail]);

    const openModal = (cls) => {
        setSelectedClass(cls);
        setShowModal(true);
    };

    const closeModal = () => {
        setShowModal(false);
        setSelectedClass(null);
    };

    const classActions = [
        {
            title: "Assessment",
            description: "Create and manage assessments",
            icon: "📝",
            href: "/Assessment",
            color: "primary"
        },
        {
            title: "Add Notes",
            description: "Upload course materials",
            icon: "📚",
            href: `/addNotes?class=${selectedClass?.name || ''}`,
            color: "secondary"
        },
        {
            title: "Attendance",
            description: "Track student attendance",
            icon: "📊",
            href: "/teacherAttendance",
            color: "success"
        },
        {
            title: "View Results",
            description: "Check assessment results",
            icon: "📈",
            href: "/viewresults",
            color: "warning"
        }
    ];

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                {/* Class Management */}
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h2 className={styles.sectionTitle}>Class Management</h2>
                        <p className={styles.sectionSubtitle}>Manage your individual classes</p>
                    </div>
                    <div className={styles.classesGrid}>
                        {classes.map((cls) => (
                            <div key={cls.id} className={styles.classCard}>
                                <div className={styles.classHeader}>
                                    <div className={styles.classIcon}>🏫</div>
                                    <div className={styles.classMeta}>
                                        <h3 className={styles.classTitle}>{cls.name}</h3>
                                        <span className={styles.classType}>Computer Science</span>
                                    </div>
                                </div>
                                <div className={styles.classStats}>
                                    <div className={styles.classStat}>
                                        <span className={styles.statLabel}>Students</span>
                                        <span className={styles.statValue}>{cls.students}</span>
                                    </div>
                                    <div className={styles.classStat}>
                                        <span className={styles.statLabel}>Assessments</span>
                                        <span className={styles.statValue}>{cls.assessments}</span>
                                    </div>
                                    <div className={styles.classStat}>
                                        <span className={styles.statLabel}>Attendance</span>
                                        <span className={styles.statValue}>{cls.attendance}%</span>
                                    </div>
                                </div>
                                <div className={styles.classActions}>
                                    <button 
                                        className={styles.actionButton}
                                        onClick={() => openModal(cls)}
                                    >
                                        Manage Class
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Modal Popup */}
                {showModal && (
                    <div className={styles.modalOverlay} onClick={closeModal}>
                        <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                            <div className={styles.modalHeader}>
                                <h2 className={styles.modalTitle}>Manage {selectedClass?.name}</h2>
                                <button className={styles.closeButton} onClick={closeModal}>
                                    ✕
                                </button>
                            </div>
                            <div className={styles.modalContent}>
                                <div className={styles.modalStats}>
                                    <div className={styles.modalStat}>
                                        <span className={styles.modalStatLabel}>Students</span>
                                        <span className={styles.modalStatValue}>{selectedClass?.students}</span>
                                    </div>
                                    <div className={styles.modalStat}>
                                        <span className={styles.modalStatLabel}>Assessments</span>
                                        <span className={styles.modalStatValue}>{selectedClass?.assessments}</span>
                                    </div>
                                    <div className={styles.modalStat}>
                                        <span className={styles.modalStatLabel}>Attendance</span>
                                        <span className={styles.modalStatValue}>{selectedClass?.attendance}%</span>
                                    </div>
                                </div>
                                <div className={styles.modalActions}>
                                    {classActions.map((action, index) => (
                                        <Link 
                                            key={index} 
                                            href={action.href} 
                                            className={`${styles.modalActionCard} ${styles[action.color]}`}
                                            onClick={closeModal}
                                        >
                                            <div className={styles.modalActionIcon}>{action.icon}</div>
                                            <div className={styles.modalActionContent}>
                                                <h3>{action.title}</h3>
                                                <p>{action.description}</p>
                                            </div>
                                            <div className={styles.modalActionArrow}>→</div>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
