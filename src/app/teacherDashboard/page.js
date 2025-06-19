"use client";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";  // Ensure you import your Firebase config
import {
    collection,
    getDocs,
    query,
    where
} from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import style from './page.module.css';
import Link from "next/link";

import Navbar from "@/components/teacherNavbar";

export default function TeacherDashboard() {
    const [teacherEmail, setTeacherEmail] = useState("");
    const [teacherName, setTeacherName] = useState("");
    const [quizzes, setQuizzes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({
        totalQuizzes: 0,
        totalQuestions: 0,
        recentQuizzes: 0,
        activeClasses: 4
    });

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
                // Fetch teacher info
                const usersRef = collection(db, "users");
                const querySnapshot = await getDocs(usersRef);
                const teacher = querySnapshot.docs.find(
                    (doc) => doc.data().email === teacherEmail
                )?.data();

                if (teacher) {
                    setTeacherName(teacher.name);
                }

                // Fetch quizzes
                const quizzesRef = collection(db, "quizzes");
                const quizzesQuery = query(quizzesRef, where("teacherEmail", "==", teacherEmail));
                const quizzesSnapshot = await getDocs(quizzesQuery);
                
                const quizzesList = quizzesSnapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    questions: doc.data().questions || []
                }));

                // Sort quizzes by creation date (newest first)
                quizzesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setQuizzes(quizzesList);

                // Calculate stats
                const totalQuestions = quizzesList.reduce((sum, quiz) => sum + (quiz.questions?.length || 0), 0);
                const recentQuizzes = quizzesList.filter(quiz => {
                    const quizDate = new Date(quiz.createdAt);
                    const weekAgo = new Date();
                    weekAgo.setDate(weekAgo.getDate() - 7);
                    return quizDate > weekAgo;
                }).length;

                setStats({
                    totalQuizzes: quizzesList.length,
                    totalQuestions,
                    recentQuizzes,
                    activeClasses: 4
                });
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherData();
    }, [teacherEmail]);

    const quickActions = [
        {
            title: "Create Quiz",
            description: "Generate new assessments",
            icon: "📝",
            href: "/Teacherquiz",
            color: "primary"
        },
        {
            title: "Course Mapping",
            description: "Organize curriculum",
            icon: "🗺️",
            href: "/coursemapping",
            color: "secondary"
        },
        {
            title: "Attendance",
            description: "Manage student attendance",
            icon: "📊",
            href: "/teacherAttendance",
            color: "success"
        },
        {
            title: "Class Communities",
            description: "Access class management",
            icon: "👥",
            href: "/classC",
            color: "warning"
        }
    ];

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return "Good Morning";
        if (hour < 17) return "Good Afternoon";
        return "Good Evening";
    };

    return (
        <div className={style.container}>
            <Navbar />
            <div className={style.content}>
                {/* Hero Section */}
                <div className={style.heroSection}>
                    <div className={style.heroContent}>
                        <div className={style.greeting}>
                            <h1 className={style.greetingText}>{getGreeting()}, {teacherName}</h1>
                            <p className={style.greetingSubtext}>Here's what's happening with your classes today</p>
                        </div>
                        <div className={style.heroStats}>
                            <div className={style.statCard}>
                                <div className={style.statIcon}>📚</div>
                                <div className={style.statContent}>
                                    <h3>{stats.totalQuizzes}</h3>
                                    <p>Total Quizzes</p>
                                </div>
                            </div>
                            <div className={style.statCard}>
                                <div className={style.statIcon}>❓</div>
                                <div className={style.statContent}>
                                    <h3>{stats.totalQuestions}</h3>
                                    <p>Questions Created</p>
                                </div>
                            </div>
                            <div className={style.statCard}>
                                <div className={style.statIcon}>📈</div>
                                <div className={style.statContent}>
                                    <h3>{stats.recentQuizzes}</h3>
                                    <p>This Week</p>
                                </div>
                            </div>
                            <div className={style.statCard}>
                                <div className={style.statIcon}>🏫</div>
                                <div className={style.statContent}>
                                    <h3>{stats.activeClasses}</h3>
                                    <p>Active Classes</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions */}
                <div className={style.section}>
                    <div className={style.sectionHeader}>
                        <h2 className={style.sectionTitle}>Quick Actions</h2>
                        <p className={style.sectionSubtitle}>Access your most used features</p>
                    </div>
                    <div className={style.quickActionsGrid}>
                        {quickActions.map((action, index) => (
                            <Link key={index} href={action.href} className={`${style.quickActionCard} ${style[action.color]}`}>
                                <div className={style.actionIcon}>{action.icon}</div>
                                <div className={style.actionContent}>
                                    <h3>{action.title}</h3>
                                    <p>{action.description}</p>
                                </div>
                                <div className={style.actionArrow}>→</div>
                    </Link>
                        ))}
                    </div>
                </div>

                {/* Recent Quizzes */}
                <div className={style.section}>
                    <div className={style.sectionHeader}>
                        <h2 className={style.sectionTitle}>Recent Quizzes</h2>
                        <p className={style.sectionSubtitle}>Your latest assessments</p>
                </div>

                {loading ? (
                        <div className={style.loadingContainer}>
                            <div className={style.loadingSpinner}></div>
                            <p>Loading your quizzes...</p>
                        </div>
                    ) : quizzes.length === 0 ? (
                        <div className={style.emptyState}>
                            <div className={style.emptyIcon}>📝</div>
                            <h3>No quizzes yet</h3>
                            <p>Create your first quiz to get started</p>
                            <Link href="/Teacherquiz" className={style.emptyAction}>
                                Create Quiz
                            </Link>
                        </div>
                        ) : (
                            <div className={style.quizzesGrid}>
                            {quizzes.slice(0, 6).map((quiz) => (
                                    <div key={quiz.id} className={style.quizCard}>
                                    <div className={style.quizHeader}>
                                        <div className={style.quizIcon}>📋</div>
                                        <div className={style.quizMeta}>
                                        <h3 className={style.quizTitle}>{quiz.topic || 'Untitled Quiz'}</h3>
                                            <span className={style.quizSubject}>
                                                {quiz.subject ? quiz.subject.replace(/_/g, " ") : 'No Subject'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={style.quizStats}>
                                        <div className={style.quizStat}>
                                            <span className={style.statLabel}>Questions</span>
                                            <span className={style.statValue}>{quiz.questions?.length || 0}</span>
                                        </div>
                                        <div className={style.quizStat}>
                                            <span className={style.statLabel}>Created</span>
                                            <span className={style.statValue}>
                                                {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : 'No date'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className={style.quizActions}>
                                        <Link href={`/viewQuiz/${quiz.id}`} className={style.viewButton}>
                                            View Details
                                        </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                </div>

                {/* Recent Activity */}
                <div className={style.section}>
                    <div className={style.sectionHeader}>
                        <h2 className={style.sectionTitle}>Recent Activity</h2>
                        <p className={style.sectionSubtitle}>Your latest actions</p>
                    </div>
                    <div className={style.activityList}>
                        <div className={style.activityItem}>
                            <div className={style.activityIcon}>📝</div>
                            <div className={style.activityContent}>
                                <h4>Quiz Created</h4>
                                <p>Mathematics Quiz - Algebra Basics</p>
                                <span className={style.activityTime}>2 hours ago</span>
                            </div>
                        </div>
                        <div className={style.activityItem}>
                            <div className={style.activityIcon}>📊</div>
                            <div className={style.activityContent}>
                                <h4>Attendance Marked</h4>
                                <p>Class S6CS - 25 students present</p>
                                <span className={style.activityTime}>Yesterday</span>
                            </div>
                        </div>
                        <div className={style.activityItem}>
                            <div className={style.activityIcon}>📚</div>
                            <div className={style.activityContent}>
                                <h4>Notes Uploaded</h4>
                                <p>Physics Notes - Chapter 3</p>
                                <span className={style.activityTime}>2 days ago</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
