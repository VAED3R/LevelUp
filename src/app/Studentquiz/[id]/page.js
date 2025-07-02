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
  
  // New enhanced features
  const [showQuestionNav, setShowQuestionNav] = useState(false);
  const [timeWarning, setTimeWarning] = useState(false);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [questionTimeSpent, setQuestionTimeSpent] = useState({});
  const [showHint, setShowHint] = useState(false);
  const [answeredQuestions, setAnsweredQuestions] = useState(new Set());

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

  // Enhanced features useEffect hooks
  useEffect(() => {
    // Time warning when less than 30 seconds per question remaining
    if (timeLeft && quiz) {
      const avgTimePerQuestion = timeLeft / (quiz.questions.length - currentQuestionIndex);
      setTimeWarning(avgTimePerQuestion < 30);
    }
  }, [timeLeft, currentQuestionIndex, quiz]);

  useEffect(() => {
    // Track question start time
    setQuestionStartTime(Date.now());
  }, [currentQuestionIndex]);

  useEffect(() => {
    // Auto-show hint after 30 seconds on current question
    if (questionStartTime && !selectedAnswers[currentQuestionIndex]) {
      const timer = setTimeout(() => {
        setShowHint(true);
      }, 30000);
      return () => clearTimeout(timer);
    }
  }, [questionStartTime, currentQuestionIndex, selectedAnswers]);

  useEffect(() => {
    // Track time spent on each question
    if (questionStartTime && selectedAnswers[currentQuestionIndex] !== undefined) {
      const timeSpent = Math.floor((Date.now() - questionStartTime) / 1000);
      setQuestionTimeSpent(prev => ({
        ...prev,
        [currentQuestionIndex]: timeSpent
      }));
    }
  }, [selectedAnswers, currentQuestionIndex, questionStartTime]);

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const handleAnswerSelect = (questionIndex, answer, optionIndex) => {
    setSelectedAnswers((prev) => ({
      ...prev,
      [questionIndex]: optionIndex,
    }));
    
    // Track answered questions for navigation
    setAnsweredQuestions(prev => new Set([...prev, questionIndex]));
    
    // Hide hint when answer is selected
    setShowHint(false);
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
      // Debug the comparison
      console.log(`Question ${index}: Selected answer index: "${selectedAnswers[index]}", Correct answer index: "${question.correctAnswer}"`);
      
      // Compare the indices directly
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
        
        // Create new points entry with validation
        const newPointsEntry = {
          points: Math.round(finalScore / 10), // 1 point per 10% score
          date: new Date().toISOString(),
          subject: quiz.subject || 'Unknown',
          score: finalScore,
          quizId: id,
          topic: quiz.topic || 'Unknown',
          userId: user.uid,
        };
        
        // Validate and clean the points entry
        const cleanPointsEntry = {};
        Object.entries(newPointsEntry).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            cleanPointsEntry[key] = value;
          }
        });
        
        // Get current points array or create empty one
        let currentPointsArray = [];
        if (studentData.points && Array.isArray(studentData.points)) {
          currentPointsArray = [...studentData.points];
        }
        
        // Add the new points entry
        currentPointsArray.push(cleanPointsEntry);
        
        // Calculate total points
        const totalPoints = currentPointsArray.reduce((total, entry) => total + (entry.points || 0), 0);
        
        // Create clean update data
        const updateData = {
          points: currentPointsArray,
          totalPoints: totalPoints,
          lastUpdated: new Date().toISOString()
        };
        
        // Remove any undefined values from update data
        const cleanUpdateData = {};
        Object.entries(updateData).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            cleanUpdateData[key] = value;
          }
        });
        
        // Update the student document
        await updateDoc(studentRef, cleanUpdateData);
        
        console.log(`Updated student points: Added ${cleanPointsEntry.points} points. New total: ${totalPoints}`);
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

  // Enhanced helper functions
  const getDifficultyLevel = (question) => {
    // Simple difficulty calculation based on question length and options
    const questionLength = question.question.length;
    const optionsCount = question.options.length;
    
    if (questionLength > 200 || optionsCount > 4) return 'Hard';
    if (questionLength > 100 || optionsCount === 4) return 'Medium';
    return 'Easy';
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'Easy': return '#4CAF50';
      case 'Medium': return '#FF9800';
      case 'Hard': return '#F44336';
      default: return '#9C27B0';
    }
  };

  const getQuestionStatus = (index) => {
    if (selectedAnswers[index] !== undefined) return 'answered';
    if (answeredQuestions.has(index)) return 'visited';
    return 'unanswered';
  };

  const getPerformanceRating = () => {
    if (score >= 90) return { text: 'Excellent! 🏆', color: '#4CAF50' };
    if (score >= 80) return { text: 'Great Job! 🎯', color: '#8BC34A' };
    if (score >= 70) return { text: 'Good Work! 👍', color: '#FFC107' };
    if (score >= 60) return { text: 'Not Bad! 📚', color: '#FF9800' };
    return { text: 'Keep Practicing! 💪', color: '#F44336' };
  };

  const getAverageTimePerQuestion = () => {
    const times = Object.values(questionTimeSpent);
    if (times.length === 0) return 0;
    return Math.round(times.reduce((a, b) => a + b, 0) / times.length);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar className={styles.nav} />
        <div className={styles.content}>
          <div className={styles.loading}>Loading quiz...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar className={styles.nav} />
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
    const performanceRating = getPerformanceRating();
    const avgTime = getAverageTimePerQuestion();
    
    return (
      <div className={styles.container}>
        <Navbar className={styles.nav} />
        <div className={styles.content}>
          <div className={styles.resultsCard}>
            <h2 className={styles.resultsTitle}>Quiz Completed!</h2>
            
            {/* Enhanced Score Display */}
            <div className={styles.scoreContainer}>
              <div className={styles.scoreText}>Your Score</div>
              <div className={styles.score}>{score.toFixed(1)}%</div>
              <div className={styles.performanceRating} style={{ color: performanceRating.color }}>
                {performanceRating.text}
              </div>
            </div>

            {/* Performance Analytics */}
            <div className={styles.analyticsContainer}>
              <div className={styles.analyticsItem}>
                <span className={styles.analyticsLabel}>Average Time per Question:</span>
                <span className={styles.analyticsValue}>{avgTime}s</span>
              </div>
              <div className={styles.analyticsItem}>
                <span className={styles.analyticsLabel}>Questions Answered:</span>
                <span className={styles.analyticsValue}>{Object.keys(selectedAnswers).length}/{quiz.questions.length}</span>
              </div>
              <div className={styles.analyticsItem}>
                <span className={styles.analyticsLabel}>Points Earned:</span>
                <span className={styles.analyticsValue}>{Math.round(score / 10)} points</span>
              </div>
            </div>

            {/* Enhanced Questions Review */}
            <div className={styles.questionsReview}>
              <h3 className={styles.reviewTitle}>Question Review</h3>
              {quiz.questions.map((question, index) => {
                const isCorrect = selectedAnswers[index] === question.correctAnswer;
                const timeSpent = questionTimeSpent[index] || 0;
                const difficulty = getDifficultyLevel(question);
                
                return (
                  <div key={index} className={`${styles.questionReview} ${isCorrect ? styles.correct : styles.incorrect}`}>
                    <div className={styles.questionHeader}>
                      <span className={styles.questionNumber}>Q{index + 1}</span>
                      <span 
                        className={styles.difficultyBadge}
                        style={{ backgroundColor: getDifficultyColor(difficulty) }}
                      >
                        {difficulty}
                      </span>
                      <span className={styles.timeSpent}>{timeSpent}s</span>
                    </div>
                    <div className={styles.questionText}>
                      {question.question}
                    </div>
                    <div className={styles.answerText}>
                      Your answer: {selectedAnswers[index] !== undefined ? 
                        question.options[selectedAnswers[index]] : "Not answered"}
                    </div>
                    <div className={styles.correctAnswerText}>
                      Correct answer: {question.options[question.correctAnswer]}
                    </div>
                    <div className={styles.resultIcon}>
                      {isCorrect ? "✅" : "❌"}
                    </div>
                  </div>
                );
              })}
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
  const currentDifficulty = getDifficultyLevel(currentQuestion);

  return (
    <div className={styles.container}>
      <Navbar className={styles.nav} />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>{quiz.title}</h1>
          <div className={styles.subtitle}>
            {quiz.subject} - {quiz.topic}
          </div>
        </div>

        <div className={styles.quizCard}>
          {/* Enhanced Timer with Warning */}
          <div className={`${styles.timer} ${timeWarning ? styles.timerWarning : ''}`}>
            <div>Time Remaining: {formatTime(timeLeft)}</div>
            <div style={{ fontSize: '12px', marginTop: '5px' }}>
              Avg. {formatTime(avgTimePerQuestionLeft)} per question
            </div>
            {timeWarning && (
              <div className={styles.timeWarning}>
                ⚠️ Time is running out! Speed up!
              </div>
            )}
          </div>
          
          <div className={styles.progressBar}>
            <div 
              className={styles.progressFill} 
              style={{ width: `${progressPercentage}%` }}
            ></div>
          </div>

          {/* Question Navigation Toggle */}
          <div className={styles.navToggle}>
            <button 
              className={styles.navToggleButton}
              onClick={() => setShowQuestionNav(!showQuestionNav)}
            >
              {showQuestionNav ? 'Hide' : 'Show'} Question Navigator
            </button>
          </div>

          {/* Question Navigator */}
          {showQuestionNav && (
            <div className={styles.questionNavigator}>
              {quiz.questions.map((_, index) => (
                <button
                  key={index}
                  className={`${styles.navQuestion} ${styles[getQuestionStatus(index)]} ${
                    index === currentQuestionIndex ? styles.current : ''
                  }`}
                  onClick={() => setCurrentQuestionIndex(index)}
                >
                  {index + 1}
                </button>
              ))}
            </div>
          )}

          <div className={styles.questionContainer}>
            <div className={styles.questionTitle}>
              <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
              <span className={styles.questionNumber}>
                {currentQuestionIndex + 1}/{quiz.questions.length}
              </span>
              {/* Difficulty Badge */}
              <span 
                className={styles.difficultyBadge}
                style={{ backgroundColor: getDifficultyColor(currentDifficulty) }}
              >
                {currentDifficulty}
              </span>
            </div>
            
            <div className={styles.questionText}>{currentQuestion.question}</div>

            {/* Hint System */}
            {showHint && !selectedAnswers[currentQuestionIndex] && (
              <div className={styles.hintContainer}>
                <div className={styles.hintText}>
                  💡 Hint: Take your time to read the question carefully and consider all options!
                </div>
              </div>
            )}

            <div className={styles.options}>
              {currentQuestion.options.map((option, index) => (
                <div
                  key={index}
                  className={`${styles.option} ${
                    selectedAnswers[currentQuestionIndex] === index
                      ? styles.selected
                      : ""
                  }`}
                  onClick={() =>
                    handleAnswerSelect(currentQuestionIndex, option, index)
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
                disabled={selectedAnswers[currentQuestionIndex] === undefined}
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