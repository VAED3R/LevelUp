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
                    questions: doc.data().questions || [] // Ensure questions is always an array
                }));

                // Sort quizzes by creation date (newest first)
                quizzesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
                setQuizzes(quizzesList);
            } catch (error) {
                console.error("Error fetching data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTeacherData();
    }, [teacherEmail]);

    return (
        <div className={style.container}>
            <Navbar />
            <div className={style.content}>
                <div className={style.header}>
                    <h1 className={style.title}>Welcome, {teacherName}</h1>
                    <p className={style.subtitle}>Teacher Dashboard</p>
                </div>

                <div className={style.cardContainer}>
                    <Link href="/Teacherquiz" className={style.card}>
                        <h2>Create Quiz</h2>
                        <p>Generate or create new quizzes for your students</p>
                    </Link>
                </div>

                {loading ? (
                    <div className={style.loading}>Loading...</div>
                ) : (
                    <div className={style.quizzesSection}>
                        <h2 className={style.sectionTitle}>Your Quizzes</h2>
                        {quizzes.length === 0 ? (
                            <p className={style.noQuizzes}>No quizzes created yet.</p>
                        ) : (
                            <div className={style.quizzesGrid}>
                                {quizzes.map((quiz) => (
                                    <div key={quiz.id} className={style.quizCard}>
                                        <h3 className={style.quizTitle}>{quiz.topic || 'Untitled Quiz'}</h3>
                                        <p className={style.quizSubject}>{quiz.subject ? quiz.subject.replace(/_/g, " ") : 'No Subject'}</p>
                                        <div className={style.quizDetails}>
                                            <p>Questions: {quiz.questions ? quiz.questions.length : 0}</p>
                                            <p>Created: {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : 'No date'}</p>
                                        </div>
                                        <div className={style.quizActions}>
                                            <Link href={`/viewQuiz/${quiz.id}`} className={style.viewButton}>
                                                View Quiz
                                            </Link>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
