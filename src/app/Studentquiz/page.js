"use client";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, getDocs, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import IntroAnimation from "../../components/IntroAnimation";

export default function StudentQuizList() {
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchQuizzes = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          router.push("/login");
          return;
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

    fetchQuizzes();
  }, [router]);

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
              quizzes.map((quiz) => (
                <div key={quiz.id} className={styles.quizCard}>
                  <h3 className={styles.quizTitle}>{quiz.topic || "Untitled Quiz"}</h3>
                  <p className={styles.quizSubject}>
                    {quiz.subject ? quiz.subject.replace(/_/g, " ") : "No Subject"}
                  </p>
                  <div className={styles.quizDetails}>
                    <p>Questions: {quiz.questions?.length || 0}</p>
                    <p>Created: {new Date(quiz.createdAt).toLocaleDateString()}</p>
                  </div>
                  <button
                    className={styles.startButton}
                    onClick={() => handleStartQuiz(quiz.id)}
                  >
                    Start Quiz
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </IntroAnimation>
  );
} 