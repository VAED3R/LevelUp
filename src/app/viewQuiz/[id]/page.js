"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, setDoc } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function ViewQuiz() {
    const [quiz, setQuiz] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentQuestion, setCurrentQuestion] = useState(0);
    const [answers, setAnswers] = useState({});
    const [showResults, setShowResults] = useState(false);
    const [score, setScore] = useState(0);
    const [timeLeft, setTimeLeft] = useState(null);
    const [isTeacher, setIsTeacher] = useState(false);
    const router = useRouter();
    const params = useParams();

    useEffect(() => {
        const fetchQuiz = async () => {
            try {
                const user = auth.currentUser;
                if (!user) {
                    router.push("/login");
                    return;
                }

                // Check if user is a teacher
                const userRef = doc(db, "users", user.uid);
                const userDoc = await getDoc(userRef);
                if (userDoc.exists()) {
                    setIsTeacher(userDoc.data().role === "teacher");
                }

                const quizId = params.id;
                
                if (!quizId) {
                    setError("No quiz ID provided");
                    setLoading(false);
                    return;
                }

                console.log("Fetching quiz with ID:", quizId);

                const quizRef = doc(db, "quizzes", quizId);
                const quizDoc = await getDoc(quizRef);

                if (quizDoc.exists()) {
                    const quizData = quizDoc.data();
                    console.log("Quiz data:", quizData);
                    
                    // Only hide correct answers if user is not a teacher
                    const sanitizedQuiz = {
                        ...quizData,
                        id: quizDoc.id,
                        questions: quizData.questions.map(q => ({
                            ...q,
                            correctAnswer: isTeacher ? q.correctAnswer : undefined
                        }))
                    };
                    setQuiz(sanitizedQuiz);
                    
                    // Initialize time if there's a time limit
                    if (quizData.timeLimit) {
                        setTimeLeft(quizData.timeLimit * 60);
                    }
                } else {
                    setError("Quiz not found");
                }
            } catch (error) {
                console.error("Error fetching quiz:", error);
                setError("Failed to load quiz: " + error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchQuiz();
    }, [router, params.id, isTeacher]);

    // Timer effect
    useEffect(() => {
        if (timeLeft === null) return;

        const timer = setInterval(() => {
            setTimeLeft(prev => {
                if (prev <= 1) {
                    clearInterval(timer);
                    handleSubmit();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [timeLeft]);

    const handleAnswerSelect = (questionId, answer) => {
        setAnswers(prev => ({
            ...prev,
            [questionId]: answer
        }));
    };

    const calculateScore = () => {
        if (!quiz || !quiz.questions) return 0;
        
        let totalScore = 0;
        quiz.questions.forEach((question, index) => {
            if (answers[index] === question.correctAnswer) {
                totalScore += question.points || 1; // Use question points or default to 1
            }
        });
        return totalScore;
    };

    const handleSubmit = async () => {
        const finalScore = calculateScore();
        setScore(finalScore);
        setShowResults(true);

        // Update student's points in Firestore
        try {
            const user = auth.currentUser;
            const userRef = doc(db, "users", user.uid);
            
            // Create points object with proper structure
            const pointsData = {
                quizId: quiz.id,
                score: finalScore,
                points: finalScore, // Set points equal to score
                totalQuestions: quiz.questions.length,
                date: new Date().toISOString(),
                subject: quiz.subject || "quiz",
                topic: quiz.topic || "quiz",
                type: "quiz", // Add type field to identify as quiz points
                userId: user.uid
            };
            
            // Update points in users collection
            await updateDoc(userRef, {
                points: arrayUnion(pointsData)
            });
            
            // Also update points in students collection
            const studentRef = doc(db, "students", user.uid);
            const studentDoc = await getDoc(studentRef);
            
            if (studentDoc.exists()) {
                // If student document exists, update points
                const studentData = studentDoc.data();
                const currentPoints = studentData.points || [];
                const updatedPoints = [...currentPoints, pointsData];
                
                // Calculate total points
                const totalPoints = updatedPoints.reduce((sum, entry) => sum + entry.points, 0);
                
                await updateDoc(studentRef, {
                    points: updatedPoints,
                    totalPoints: totalPoints
                });
            } else {
                // If student document doesn't exist, create it with initial points
                const userDoc = await getDoc(userRef);
                const userData = userDoc.data();
                
                await setDoc(studentRef, {
                    id: user.uid,
                    name: userData.name || "Student",
                    email: user.email,
                    class: userData.class || "Unknown",
                    points: [pointsData],
                    totalPoints: finalScore,
                    createdAt: new Date().toISOString()
                });
            }
            
            console.log("Points updated successfully");
        } catch (error) {
            console.error("Error updating points:", error);
        }
    };

    if (loading) return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.loading}>Loading quiz...</div>
        </div>
    );

    if (error) return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.error}>{error}</div>
        </div>
    );

    if (!quiz) return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.error}>Quiz not found</div>
        </div>
    );

    const formatTime = (seconds) => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = seconds % 60;
        return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <div className={styles.header}>
                    <h1 className={styles.title}>{quiz.topic || "Untitled Quiz"}</h1>
                    <p className={styles.subtitle}>{quiz.subject ? quiz.subject.replace(/_/g, " ") : "No Subject"}</p>
                </div>

                {isTeacher ? (
                    // Teacher view - show all questions with correct answers
                    <div className={styles.teacherView}>
                        <div className={styles.quizInfo}>
                            <p>Total Questions: {quiz.questions.length}</p>
                            <p>Time Limit: {quiz.timeLimit ? `${quiz.timeLimit} minutes` : 'No time limit'}</p>
                        </div>
                        {quiz.questions.map((question, index) => (
                            <div key={index} className={styles.questionCard}>
                                <h3 className={styles.questionTitle}>
                                    Question {index + 1}
                                </h3>
                                <p className={styles.questionText}>
                                    {question.question}
                                </p>
                                <div className={styles.options}>
                                    {question.options.map((option, optIndex) => (
                                        <div
                                            key={optIndex}
                                            className={`${styles.option} ${
                                                optIndex === question.correctAnswer ? styles.correctAnswer : ""
                                            }`}
                                        >
                                            {option}
                                            {optIndex === question.correctAnswer && (
                                                <span className={styles.correctBadge}>✓ Correct Answer</span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                                <div className={styles.questionDetails}>
                                    <p>Points: {question.points || 1}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    // Student view - existing quiz taking interface
                    !showResults ? (
                        <div className={styles.quizCard}>
                            {timeLeft !== null && (
                                <div className={styles.timer}>
                                    Time Remaining: {formatTime(timeLeft)}
                                </div>
                            )}
                            
                            <div className={styles.questionContainer}>
                                <h2 className={styles.questionTitle}>
                                    Question {currentQuestion + 1} of {quiz.questions.length}
                                </h2>
                                <p className={styles.questionText}>
                                    {quiz.questions[currentQuestion].question}
                                </p>
                                <div className={styles.options}>
                                    {quiz.questions[currentQuestion].options.map((option, index) => (
                                        <button
                                            key={index}
                                            className={`${styles.option} ${
                                                answers[currentQuestion] === index ? styles.selected : ""
                                            }`}
                                            onClick={() => handleAnswerSelect(currentQuestion, index)}
                                        >
                                            {option}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className={styles.navigation}>
                                <button
                                    className={styles.navButton}
                                    onClick={() => setCurrentQuestion(prev => Math.max(0, prev - 1))}
                                    disabled={currentQuestion === 0}
                                >
                                    Previous
                                </button>
                                <button
                                    className={styles.navButton}
                                    onClick={() => setCurrentQuestion(prev => Math.min(quiz.questions.length - 1, prev + 1))}
                                    disabled={currentQuestion === quiz.questions.length - 1}
                                >
                                    Next
                                </button>
                                {currentQuestion === quiz.questions.length - 1 && (
                                    <button
                                        className={styles.submitButton}
                                        onClick={handleSubmit}
                                        disabled={Object.keys(answers).length !== quiz.questions.length}
                                    >
                                        Submit Quiz
                                    </button>
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className={styles.resultsCard}>
                            <h2>Quiz Results</h2>
                            <p>Your Score: {score}</p>
                            <div className={styles.questionsReview}>
                                {quiz.questions.map((question, index) => (
                                    <div key={index} className={styles.questionReview}>
                                        <p className={styles.questionText}>
                                            {index + 1}. {question.question}
                                        </p>
                                        <p className={styles.answerText}>
                                            Your Answer: {question.options[answers[index]]}
                                        </p>
                                        <p className={styles.correctAnswerText}>
                                            Correct Answer: {question.options[question.correctAnswer]}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                )}
            </div>
        </div>
    );
} 