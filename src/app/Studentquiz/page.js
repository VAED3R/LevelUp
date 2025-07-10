"use client";
import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import IntroAnimation from "../../components/IntroAnimation";
import { useAuth } from "@/context/AuthContext";

export default function StudentQuizList() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Simplified gamification helper functions
  const calculateEstimatedTime = (quiz) => {
    const questionCount = quiz.questions?.length || 0;
    
    // Use the same time calculation logic as the actual quiz
    let secondsPerQuestion = 60; // Default 1 minute per question
    
    if (questionCount <= 5) {
      secondsPerQuestion = 90; // More time for short quizzes
    } else if (questionCount <= 10) {
      secondsPerQuestion = 60; // Standard time
    } else if (questionCount <= 20) {
      secondsPerQuestion = 45; // Less time per question for longer quizzes
    } else {
      secondsPerQuestion = 30; // Even less time for very long quizzes
    }
    
    const totalSeconds = questionCount * secondsPerQuestion;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    
    // Format time display in single line
    if (minutes === 0) {
      return `${seconds}s`;
    } else if (seconds === 0) {
      return `${minutes}m`;
    } else {
      return `${minutes}m${seconds}s`;
    }
  };

  const calculateMaxPoints = (quiz) => {
    // Maximum points is always 10 (for 100% score)
    return 10;
  };

  const getSubjectIcon = (subject) => {
    const subjectIcons = {
      'Mathematics': '🔢',
      'Science': '🔬',
      'English': '📚',
      'History': '🏛️',
      'Geography': '🌍',
      'Computer Science': '💻',
      'Physics': '⚛️',
      'Chemistry': '🧪',
      'Biology': '🧬',
      'Literature': '📖',
      'Art': '🎨',
      'Music': '🎵',
      'Physical Education': '⚽',
      'Economics': '💰',
      'Psychology': '🧠',
      'Philosophy': '🤔',
      'Sociology': '👥',
      'Political Science': '🏛️',
      'Environmental Science': '🌱',
      'Astronomy': '🌌'
    };
    return subjectIcons[subject] || '📝';
  };

  // Function to capitalize first letter of each word
  const capitalizeWords = (text) => {
    if (!text) return text;
    return text
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        // Use cached auth user instead of auth.currentUser
        if (!user) {
          console.log("No user is signed in.");
          return; // Don't redirect, let AuthGate handle it
        }

        // Get user's class
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);
        const userData = userDoc.data();

        // Fetch all quizzes
        const quizzesRef = collection(db, "quizzes");
        const quizzesSnapshot = await getDocs(quizzesRef);
        
        const quizzesList = quizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Sort quizzes by creation date (newest first)
        quizzesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
        setQuizzes(quizzesList);
      } catch (error) {
        console.error("Error fetching quizzes:", error);
        setError("Failed to load quizzes: " + error.message);
      } finally {
        setLoading(false);
      }
    };

    // Only fetch data when user is available and auth is not loading
    if (user && !authLoading) {
      fetchQuizzes();
    }
  }, [user?.uid, authLoading, router]);

  const handleStartQuiz = (quizId) => {
    router.push(`/Studentquiz/${quizId}`);
  };

  if (loading) return (
    <IntroAnimation loadingText="Loading Available Quizzes...">
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loading}>Loading quizzes...</div>
      </div>
    </IntroAnimation>
  );

  if (error) return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.error}>{error}</div>
    </div>
  );

  return (
    <IntroAnimation loadingText="Loading Available Quizzes...">
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.header}>
            <h1 className={styles.title}>Available Quizzes</h1>
            <p className={styles.subtitle}>Select a quiz to begin</p>
          </div>

          <div className={styles.quizzesGrid}>
            {quizzes.length === 0 ? (
              <div className={styles.noQuizzes}>
                No quizzes available at the moment.
              </div>
            ) : (
              quizzes.map((quiz) => {
                const estimatedTime = calculateEstimatedTime(quiz);
                const subjectIcon = getSubjectIcon(quiz.subject);

                return (
                  <div key={quiz.id} className={styles.quizCard}>
                    {/* Quiz Header */}
                    <div className={styles.quizHeader}>
                      <div className={styles.titleContainer}>
                        <span className={styles.subjectIcon}>{subjectIcon}</span>
                        <h3 className={styles.quizTitle}>{capitalizeWords(quiz.topic) || "Untitled Quiz"}</h3>
                      </div>
                    </div>

                    {/* Subject */}
                    <p className={styles.quizSubject}>
                      {quiz.subject ? quiz.subject.replace(/_/g, " ") : "No Subject"}
                    </p>

                    {/* Simple Stats */}
                    <div className={styles.quizStats}>
                      <div className={styles.statItem}>
                        <div className={styles.statIcon}>❓</div>
                        <span className={styles.statLabel}>Questions</span>
                        <span className={styles.statValue}>{quiz.questions?.length || 0}</span>
                      </div>
                      <div className={styles.statItem}>
                        <div className={styles.statIcon}>⏱️</div>
                        <span className={styles.statLabel}>Time</span>
                        <span className={styles.statValue}>{estimatedTime}</span>
                      </div>
                      <div className={styles.statItem}>
                        <div className={styles.statIcon}>⭐</div>
                        <span className={styles.statLabel}>Reward</span>
                        <span className={styles.statValue}>{calculateMaxPoints(quiz)}</span>
                      </div>
                    </div>

                    {/* Creation Date */}
                    <div className={styles.quizDetails}>
                      <p>Created: {new Date(quiz.createdAt).toLocaleDateString()}</p>
                    </div>

                    {/* Start Button */}
                    <button
                      className={styles.startButton}
                      onClick={() => handleStartQuiz(quiz.id)}
                    >
                      Start Quiz
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </IntroAnimation>
  );
} 