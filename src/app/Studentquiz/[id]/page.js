"use client";
import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc, updateDoc, arrayUnion, setDoc, writeBatch } from "firebase/firestore";
import { useRouter, useParams } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import { useAuth } from "@/context/AuthContext";

export default function StudentQuiz() {
  const { id } = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const [quiz, setQuiz] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [timeLeft, setTimeLeft] = useState(null);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [timePerQuestion, setTimePerQuestion] = useState(60); // Default 60 seconds per question

  useEffect(() => {
    if (!user) {
      router.push("/login");
      return;
    }

    const fetchQuiz = async () => {
      try {
        const quizDoc = await getDoc(doc(db, "quizzes", id));
        if (!quizDoc.exists()) {
          setError("Quiz not found");
          setLoading(false);
          return;
        }

        const quizData = quizDoc.data();
        setQuiz(quizData);
        
        // Calculate time based on number of questions
        const questionCount = quizData.questions.length;
        // Adjust time per question based on quiz complexity
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
        
        setTimePerQuestion(secondsPerQuestion);
        setTimeLeft(questionCount * secondsPerQuestion);
        setLoading(false);
      } catch (err) {
        setError("Error fetching quiz");
        setLoading(false);
      }
    };

    fetchQuiz();
  }, [id, user, router]);

  useEffect(() => {
    if (!timeLeft) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
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

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleAnswerSelect = (questionIndex, answer) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: answer,
    }));
  };

  const handleNext = () => {
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex((prev) => prev - 1);
    }
  };

  const calculateScore = () => {
    if (!quiz || !quiz.questions) return 0;
    
    let correctAnswers = 0;
    quiz.questions.forEach((question, index) => {
      if (selectedAnswers[index] === question.correctAnswer) {
        correctAnswers++;
      }
    });
    
    const calculatedScore = (correctAnswers / quiz.questions.length) * 100;
    console.log(`Score calculation: ${correctAnswers} correct out of ${quiz.questions.length} questions = ${calculatedScore}%`);
    return calculatedScore;
  };

  const handleSubmit = async () => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    const finalScore = calculateScore();
    console.log(`Final score: ${finalScore}%`);
    setScore(finalScore);
    setQuizCompleted(true);

    try {
      const studentRef = doc(db, "students", user.uid);
      const studentDoc = await getDoc(studentRef);
      
      if (studentDoc.exists()) {
        const studentData = studentDoc.data();
        
        // Create new points entry
        const newPointsEntry = {
          points: Math.round(finalScore / 10), // 1 point per 10% score
          date: new Date().toISOString(),
          subject: quiz.subject,
          score: finalScore,
          quizId: id,
          topic: quiz.topic,
          userId: user.uid,
        };
        
        // Get current points array or create empty one
        let currentPointsArray = [];
        if (studentData.points && Array.isArray(studentData.points)) {
          currentPointsArray = [...studentData.points];
        }
        
        // Add the new points entry
        currentPointsArray.push(newPointsEntry);
        
        // Calculate total points
        const totalPoints = currentPointsArray.reduce((total, entry) => total + (entry.points || 0), 0);
        
        // Update the student document
        await updateDoc(studentRef, {
          points: currentPointsArray,
          totalPoints: totalPoints,
          lastUpdated: new Date().toISOString()
        });
        
        console.log(`Updated student points: Added ${newPointsEntry.points} points. New total: ${totalPoints}`);
      } else {
        console.error("Student document not found");
        setError("Failed to update points: Student record not found");
      }
    } catch (err) {
      console.error("Error updating student points:", err);
      setError("Failed to update points. Please try again later.");
    }
  };

  const getOptionLabel = (index) => {
    const labels = ['A', 'B', 'C', 'D', 'E', 'F'];
    return labels[index] || String.fromCharCode(65 + index);
  };

  const getProgressPercentage = () => {
    if (!quiz) return 0;
    return ((currentQuestionIndex + 1) / quiz.questions.length) * 100;
  };

  const getTimePerQuestionLeft = () => {
    if (!quiz) return 0;
    const questionsLeft = quiz.questions.length - currentQuestionIndex;
    return Math.ceil(timeLeft / questionsLeft);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.loading}>Loading quiz...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.error}>{error}</div>
          <button 
            className={styles.backButton}
            onClick={() => router.push("/Studentquiz")}
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  if (quizCompleted) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.resultsCard}>
            <h2 className={styles.resultsTitle}>Quiz Completed!</h2>
            <div className={styles.scoreContainer}>
              <div className={styles.scoreText}>Your Score</div>
              <div className={styles.score}>{score.toFixed(1)}%</div>
              <div className={styles.totalPoints}>
                {score >= 70 ? "Great job! 🎮" : "Keep practicing! 🎯"}
              </div>
            </div>
            <div className={styles.questionsReview}>
              {quiz.questions.map((question, index) => (
                <div key={index} className={styles.questionReview}>
                  <div className={styles.questionText}>
                    {index + 1}. {question.question}
                  </div>
                  <div className={styles.answerText}>
                    Your answer: {selectedAnswers[index] || "Not answered"}
                  </div>
                  <div className={styles.correctAnswerText}>
                    Correct answer: {question.correctAnswer}
                  </div>
                </div>
              ))}
            </div>
            <button
              className={styles.backButton}
              onClick={() => router.push("/Studentquiz")}
            >
              Back to Quizzes
            </button>
          </div>
        </div>
      </div>
    );
  }

  const currentQuestion = quiz.questions[currentQuestionIndex];
  const progressPercentage = getProgressPercentage();
  const avgTimePerQuestionLeft = getTimePerQuestionLeft();

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>{quiz.title}</h1>
          <div className={styles.subtitle}>
            {quiz.subject} - {quiz.topic}
          </div>
        </div>

        <div className={styles.quizCard}>
          <div className={styles.timer}>
            <div>Time Remaining: {formatTime(timeLeft)}</div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              Avg. {formatTime(avgTimePerQuestionLeft)} per question
            </div>
          </div>
          
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          <div className={styles.questionContainer}>
            <div className={styles.questionTitle}>
              <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              <span className={styles.questionNumber}>
                {currentQuestionIndex + 1}/{quiz.questions.length}
              </span>
            </div>
            <div className={styles.questionText}>{currentQuestion.question}</div>

            <div className={styles.options}>
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`${styles.option} ${
                    selectedAnswers[currentQuestionIndex] === option
                      ? styles.selected
                      : ""
                  }`}
                  onClick={() =>
                    handleAnswerSelect(currentQuestionIndex, option)
                  }
                >
                  <div className={styles.optionLabel}>
                    {getOptionLabel(index)}
                  </div>
                  <div className={styles.optionText}>{option}</div>
                </div>
              ))}
            </div>
          </div>

          <div className={styles.navigation}>
            <button
              className={styles.navButton}
              onClick={handlePrevious}
              disabled={currentQuestionIndex === 0}
            >
              Previous
            </button>
            {currentQuestionIndex === quiz.questions.length - 1 ? (
              <button
                className={styles.submitButton}
                onClick={handleSubmit}
                disabled={Object.keys(selectedAnswers).length !== quiz.questions.length || isSubmitting}
              >
                {isSubmitting ? "Submitting..." : "Submit Quiz"}
              </button>
            ) : (
              <button
                className={styles.navButton}
                onClick={handleNext}
                disabled={!selectedAnswers[currentQuestionIndex]}
              >
                Next
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 