"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, getDocs, query, where } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";

export default function StudentQuizChallenge() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challengeId");
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [challenge, setChallenge] = useState(null);
  const [quiz, setQuiz] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizCompleted, setQuizCompleted] = useState(false);
  const [score, setScore] = useState(0);
  const [totalTime, setTotalTime] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(null);
  const [questionTimes, setQuestionTimes] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timerInterval, setTimerInterval] = useState(null);
  
  // Redirect if no challengeId is provided
  useEffect(() => {
    if (!challengeId) {
      console.error("No challenge ID provided, redirecting to onevsoneRequests page");
      router.push('/onevsoneRequests');
    }
  }, [challengeId, router]);
  
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setLoading(true);
          console.log("Challenge ID:", challengeId);
          
          // Get the current user's data from students collection
          const studentDoc = await getDoc(doc(db, "students", user.uid));
          if (studentDoc.exists()) {
            const studentData = {
              id: studentDoc.id,
              ...studentDoc.data()
            };
            setCurrentUser(studentData);
            console.log("Current user:", studentData.id);
            
            // Get the challenge data
            if (challengeId) {
              console.log("Fetching challenge data for ID:", challengeId);
              const challengeDoc = await getDoc(doc(db, "challenges", challengeId));
              if (challengeDoc.exists()) {
                const challengeData = challengeDoc.data();
                console.log("Challenge data:", challengeData);
                setChallenge(challengeData);
                
                // Check if the user has already completed the quiz
                const isFromUser = challengeData.fromUserId === user.uid;
                console.log("Is from user:", isFromUser);
                
                // Always load the quiz data if available, regardless of completion status
                if (challengeData.quizId) {
                  console.log("Fetching quiz data for ID:", challengeData.quizId);
                  const quizDoc = await getDoc(doc(db, "quizzes", challengeData.quizId));
                  if (quizDoc.exists()) {
                    const quizData = quizDoc.data();
                    console.log("Quiz data:", quizData);
                    setQuiz(quizData);
                  } else {
                    console.error("Quiz not found for ID:", challengeData.quizId);
                    setError("Quiz not found. Please try again later.");
                  }
                } else {
                  console.error("Quiz ID not found in challenge data");
                  setError("Quiz not generated yet. Please try again later.");
                }
                
                // Set completion status and score after loading quiz data
                if ((isFromUser && challengeData.fromUserScore !== null) || 
                    (!isFromUser && challengeData.toUserScore !== null)) {
                  setQuizCompleted(true);
                  setScore(isFromUser ? challengeData.fromUserScore : challengeData.toUserScore);
                  setTotalTime(isFromUser ? challengeData.fromUserTime : challengeData.toUserTime);
                }
              } else {
                console.error("Challenge not found for ID:", challengeId);
                setError("Challenge not found. Please return to the challenges page.");
              }
            } else {
              console.error("No challenge ID provided");
              setError("No challenge ID provided. Please return to the challenges page.");
            }
          } else {
            console.error("Student data not found for user:", user.uid);
            setError("Student data not found. Please try again later.");
          }
        } catch (err) {
          console.error("Error fetching data:", err);
          setError(`Failed to load quiz data: ${err.message}`);
        } finally {
          setLoading(false);
        }
      } else {
        console.error("User not authenticated");
        setError("User not authenticated. Please log in and try again.");
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [challengeId]);
  
  // Start the quiz
  const startQuiz = () => {
    setQuizStarted(true);
    setQuestionStartTime(Date.now());
    
    // Set up timer for the current question
    const timeLimit = challenge.timeLimit || 30; // Default to 30 seconds if not specified
    setTimeRemaining(timeLimit);
    
    const interval = setInterval(() => {
      setTimeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          handleNextQuestion();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    
    setTimerInterval(interval);
  };
  
  // Handle answer selection
  const handleAnswerSelect = (answerIndex) => {
    setSelectedAnswer(answerIndex);
  };
  
  // Handle next question
  const handleNextQuestion = () => {
    // Clear the timer
    if (timerInterval) {
      clearInterval(timerInterval);
    }
    
    // Calculate time taken for this question
    const timeTaken = (Date.now() - questionStartTime) / 1000; // in seconds
    setQuestionTimes(prev => [...prev, timeTaken]);
    
    // Check if answer is correct
    const isCorrect = selectedAnswer === quiz.questions[currentQuestionIndex].correctAnswer;
    setAnswers(prev => [...prev, { 
      questionIndex: currentQuestionIndex, 
      selectedAnswer, 
      isCorrect 
    }]);
    
    // Update score if correct
    if (isCorrect) {
      setScore(prev => prev + 1);
    }
    
    // Move to next question or complete quiz
    if (currentQuestionIndex < quiz.questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setQuestionStartTime(Date.now());
      
      // Set up timer for the next question
      const timeLimit = challenge.timeLimit || 30;
      setTimeRemaining(timeLimit);
      
      const interval = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(interval);
            handleNextQuestion();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      setTimerInterval(interval);
    } else {
      // Quiz completed
      setQuizCompleted(true);
      
      // Calculate total time
      const totalTimeTaken = questionTimes.reduce((sum, time) => sum + time, 0) + timeTaken;
      setTotalTime(totalTimeTaken);
      
      // Save the results
      saveQuizResults(totalTimeTaken);
    }
  };
  
  // Save quiz results
  const saveQuizResults = async () => {
    try {
      const isFromUser = challenge.fromUserId === currentUser.id;
      const challengeRef = doc(db, "challenges", challengeId);
      
      // Update the challenge document with the user's score and time
      const updateData = isFromUser 
        ? { 
            fromUserScore: score, 
            fromUserTime: totalTime,
            fromUserCompletedAt: new Date().toISOString()
          } 
        : { 
            toUserScore: score, 
            toUserTime: totalTime,
            toUserCompletedAt: new Date().toISOString()
          };
      
      await updateDoc(challengeRef, updateData);
      
      // Check if both users have completed the quiz
      const challengeDoc = await getDoc(challengeRef);
      const updatedChallenge = challengeDoc.data();
      
      if (updatedChallenge.fromUserScore !== null && updatedChallenge.toUserScore !== null) {
        // Both users have completed the quiz, determine the winner
        let winner = null;
        let pointsWagered = updatedChallenge.pointsWagered || 10;
        
        // First check scores - higher score wins
        if (updatedChallenge.fromUserScore > updatedChallenge.toUserScore) {
          winner = "fromUser";
        } else if (updatedChallenge.toUserScore > updatedChallenge.fromUserScore) {
          winner = "toUser";
        } else {
          // Scores are equal, check time - faster time wins
          if (updatedChallenge.fromUserTime < updatedChallenge.toUserTime) {
            winner = "fromUser";
          } else {
            winner = "toUser";
          }
        }
        
        // Update the challenge with the winner
        await updateDoc(challengeRef, {
          winner,
          status: "completed",
          completedAt: new Date().toISOString()
        });
        
        // Update the onevsoneRequests document
        const requestRef = doc(db, "onevsoneRequests", challenge.requestId);
        await updateDoc(requestRef, {
          status: "completed",
          completedAt: new Date().toISOString(),
          winner: winner === "fromUser" ? challenge.fromUserId : challenge.toUserId
        });
        
        // Transfer points between users
        const winnerId = winner === "fromUser" ? challenge.fromUserId : challenge.toUserId;
        const loserId = winner === "fromUser" ? challenge.toUserId : challenge.fromUserId;
        
        // Get the current points for both users
        const [winnerDoc, loserDoc] = await Promise.all([
          getDoc(doc(db, "students", winnerId)),
          getDoc(doc(db, "students", loserId))
        ]);
        
        const winnerPoints = winnerDoc.data().totalPoints || 0;
        const loserPoints = loserDoc.data().totalPoints || 0;
        
        // Update points
        await Promise.all([
          updateDoc(doc(db, "students", winnerId), {
            totalPoints: winnerPoints + pointsWagered
          }),
          updateDoc(doc(db, "students", loserId), {
            totalPoints: Math.max(0, loserPoints - pointsWagered)
          })
        ]);
      }
    } catch (err) {
      console.error("Error saving quiz results:", err);
      alert("Failed to save quiz results. Please try again.");
    }
  };
  
  // Get the current question
  const getCurrentQuestion = () => {
    if (!quiz || !quiz.questions || currentQuestionIndex >= quiz.questions.length) {
      return null;
    }
    return quiz.questions[currentQuestionIndex];
  };
  
  // Format time in seconds to MM:SS
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  // Render the quiz
  const renderQuiz = () => {
    const currentQuestion = getCurrentQuestion();
    
    if (!currentQuestion) {
      return <div className={styles.error}>No questions available</div>;
    }
    
    return (
      <div className={styles.quizContainer}>
        <div className={styles.quizHeader}>
          <h2 className={styles.quizTitle}>{quiz.topic} Quiz</h2>
          <div className={styles.quizInfo}>
            <span>Question {currentQuestionIndex + 1} of {quiz.questions.length}</span>
            <span className={styles.timer}>Time: {formatTime(timeRemaining)}</span>
          </div>
        </div>
        
        <div className={styles.questionContainer}>
          <h3 className={styles.questionText}>{currentQuestion.question}</h3>
          
          <div className={styles.optionsContainer}>
            {currentQuestion.options.map((option, index) => (
              <div 
                key={index} 
                className={`${styles.option} ${selectedAnswer === index ? styles.selected : ''}`}
                onClick={() => handleAnswerSelect(index)}
              >
                <span className={styles.optionLabel}>{String.fromCharCode(65 + index)}.</span>
                {option}
              </div>
            ))}
          </div>
          
          <button 
            className={styles.nextButton}
            onClick={handleNextQuestion}
            disabled={selectedAnswer === null}
          >
            {currentQuestionIndex < quiz.questions.length - 1 ? 'Next Question' : 'Finish Quiz'}
          </button>
        </div>
      </div>
    );
  };
  
  // Render the quiz results
  const renderResults = () => {
    const isFromUser = challenge.fromUserId === currentUser.id;
    const isWinner = challenge.winner === (isFromUser ? "fromUser" : "toUser");
    const pointsWagered = challenge.pointsWagered || 10;
    
    // If quiz data is not available, show a simplified results view
    if (!quiz) {
      return (
        <div className={styles.resultsContainer}>
          <h2 className={styles.resultsTitle}>Quiz Results</h2>
          
          <div className={styles.resultCard}>
            <div className={styles.resultHeader}>
              <h3>Quiz Results</h3>
              <span className={`${styles.resultBadge} ${isWinner ? styles.winner : styles.loser}`}>
                {isWinner ? 'Winner!' : 'Better luck next time!'}
              </span>
            </div>
            
            <div className={styles.resultDetails}>
              <p><strong>Your Score:</strong> {score}</p>
              <p><strong>Time Taken:</strong> {formatTime(totalTime)}</p>
              <p><strong>Points {isWinner ? 'Won' : 'Lost'}:</strong> {pointsWagered}</p>
            </div>
            
            <div className={styles.resultActions}>
              <button 
                className={styles.returnButton}
                onClick={() => router.push('/onevsoneRequests')}
              >
                Return to Challenges
              </button>
            </div>
          </div>
        </div>
      );
    }
    
    return (
      <div className={styles.resultsContainer}>
        <h2 className={styles.resultsTitle}>Quiz Results</h2>
        
        <div className={styles.resultCard}>
          <div className={styles.resultHeader}>
            <h3>{quiz.topic} Quiz</h3>
            <span className={`${styles.resultBadge} ${isWinner ? styles.winner : styles.loser}`}>
              {isWinner ? 'Winner!' : 'Better luck next time!'}
            </span>
          </div>
          
          <div className={styles.resultDetails}>
            <p><strong>Your Score:</strong> {score} / {quiz.questions.length}</p>
            <p><strong>Time Taken:</strong> {formatTime(totalTime)}</p>
            <p><strong>Points {isWinner ? 'Won' : 'Lost'}:</strong> {pointsWagered}</p>
          </div>
          
          <div className={styles.resultActions}>
            <button 
              className={styles.returnButton}
              onClick={() => router.push('/onevsoneRequests')}
            >
              Return to Challenges
            </button>
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>1v1 Quiz Challenge</h1>
        
        {loading ? (
          <p className={styles.loading}>Loading quiz...</p>
        ) : error ? (
          <div className={styles.errorContainer}>
            <div className={styles.error}>{error}</div>
            <button 
              className={styles.returnButton}
              onClick={() => router.push('/onevsoneRequests')}
            >
              Return to Challenges
            </button>
          </div>
        ) : !quizStarted && !quizCompleted ? (
          <div className={styles.startContainer}>
            <div className={styles.challengeInfo}>
              <h2>Challenge Details</h2>
              <p><strong>Topic:</strong> {quiz?.topic}</p>
              <p><strong>Difficulty:</strong> {challenge?.difficulty}</p>
              <p><strong>Time Limit:</strong> {challenge?.timeLimit || 30} seconds per question</p>
              <p><strong>Points Wagered:</strong> {challenge?.pointsWagered || 10}</p>
              <p><strong>Opponent:</strong> {challenge?.fromUserId === currentUser?.id ? challenge?.toUserName : challenge?.fromUserName}</p>
            </div>
            
            <button 
              className={styles.startButton}
              onClick={startQuiz}
            >
              Start Quiz
            </button>
          </div>
        ) : quizCompleted ? (
          renderResults()
        ) : (
          renderQuiz()
        )}
      </div>
    </div>
  );
}
