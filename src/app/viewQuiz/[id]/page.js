"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useParams } from "next/navigation";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function ViewQuiz() {
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const params = useParams();

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const quizDoc = await getDoc(doc(db, "quizzes", params.id));
                if (quizDoc.exists()) {
                    setQuiz({
                        id: quizDoc.id,
                        ...quizDoc.data()
                    });
                } else {
                    setError("Quiz not found");
                }
            } catch (error) {
                console.error("Error fetching quiz:", error);
                setError("Error loading quiz");
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [params.id]);

    if (loading) {
        return (
            <div>
                <Navbar />
                <div className={styles.container}>
                    <div className={styles.loading}>Loading...</div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div>
                <Navbar />
                <div className={styles.container}>
                    <div className={styles.error}>{error}</div>
                </div>
            </div>
        );
    }

    return (
        <div>
            <Navbar />
            <div className={styles.container}>
                <div className={styles.header}>
                    <h1 className={styles.title}>{quiz.topic || 'Untitled Quiz'}</h1>
                    <p className={styles.subtitle}>{quiz.subject ? quiz.subject.replace(/_/g, " ") : 'No Subject'}</p>
                </div>

                <div className={styles.quizInfo}>
                    <p>Total Questions: {quiz.questions?.length || 0}</p>
                    <p>Created: {quiz.createdAt ? new Date(quiz.createdAt).toLocaleDateString() : 'No date'}</p>
                </div>

                <div className={styles.questionsContainer}>
                    {quiz.questions?.map((question, index) => (
                        <div key={index} className={styles.questionCard}>
                            <div className={styles.questionHeader}>
                                <h3>Question {index + 1}</h3>
                            </div>
                            <p className={styles.questionText}>{question.question}</p>
                            <div className={styles.options}>
                                {question.options.map((option, optionIndex) => (
                                    <div 
                                        key={optionIndex} 
                                        className={`${styles.option} ${option === question.correctAnswer ? styles.correctOption : ''}`}
                                    >
                                        {option}
                                        {option === question.correctAnswer && (
                                            <span className={styles.correctLabel}>Correct Answer</span>
                                        )}
                                    </div>
                                ))}
                            </div>
                            <div className={styles.answerExplanation}>
                                <p className={styles.correctAnswer}>
                                    <strong>Correct Answer:</strong> {question.correctAnswer + 1}
                                </p>
                                {question.explanation && (
                                    <p className={styles.explanation}>
                                        <strong>Explanation:</strong> {question.explanation}
                                    </p>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
} 