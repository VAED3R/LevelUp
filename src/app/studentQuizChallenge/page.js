"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc, updateDoc, collection, getDocs, query, where, onSnapshot } from "firebase/firestore";
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
  const [totalTimeTaken, setTotalTimeTaken] = useState(0);
  const [questionTimes, setQuestionTimes] = useState([]);
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [timerInterval, setTimerInterval] = useState(null);
  
  // Add a useEffect to update the UI when the challenge state changes
  useEffect(() => {
    if (challenge) {
      console.log("[useEffect] Challenge state changed:", challenge);
      console.log("[useEffect] fromUserCompleted:", challenge.fromUserCompleted);
      console.log("[useEffect] toUserCompleted:", challenge.toUserCompleted);
      
      // Check if both players have completed the quiz
      if (challenge.fromUserCompleted && challenge.toUserCompleted) {
        console.log("[useEffect] Both players have completed");
        
        // If there's no winner set but both have completed, determine the winner
        if (!challenge.winner) {
          console.log("[useEffect] No winner set yet, determining winner");
          const challengeRef = doc(db, "challenges", challengeId);
          
          // Determine winner based on scores and time
          const fromUserWins = 
            challenge.fromUserScore > challenge.toUserScore || 
            (challenge.fromUserScore === challenge.toUserScore && 
             challenge.fromUserTime < challenge.toUserTime);
          
          const winner = fromUserWins ? "fromUser" : "toUser";
          console.log("[useEffect] Winner determined:", winner);
          
          const winnerId = fromUserWins ? challenge.fromUserId : challenge.toUserId;
          const loserId = fromUserWins ? challenge.toUserId : challenge.fromUserId;
          const pointsWagered = challenge.pointsWagered || 10;
          
          // Update challenge with winner
          updateDoc(challengeRef, {
            winner,
            status: "completed",
            completedAt: new Date().toISOString()
          }).then(() => {
            console.log("[useEffect] Updated challenge with winner");
            // Update request status
            const requestRef = doc(db, "onevsoneRequests", challenge.requestId);
            return updateDoc(requestRef, {
              status: "completed",
              completedAt: new Date().toISOString(),
              winner: winnerId
            });
          }).then(() => {
            console.log("[useEffect] Updated request status");
            // Get current points for both users
            return Promise.all([
              getDoc(doc(db, "students", winnerId)),
              getDoc(doc(db, "students", loserId))
            ]);
          }).then(([winnerDoc, loserDoc]) => {
            const winnerPoints = winnerDoc.data().totalPoints || 0;
            const loserPoints = loserDoc.data().totalPoints || 0;
            
            // Transfer points
            return Promise.all([
              updateDoc(doc(db, "students", winnerId), {
                totalPoints: winnerPoints + pointsWagered
              }),
              updateDoc(doc(db, "students", loserId), {
                totalPoints: Math.max(0, loserPoints - pointsWagered)
              })
            ]);
          }).then(() => {
            console.log("[useEffect] Transferred points");
            // Get final challenge state
            return getDoc(challengeRef);
          }).then((doc) => {
            if (doc.exists()) {
              const updatedChallenge = doc.data();
              console.log("[useEffect] Final challenge state:", updatedChallenge);
              setChallenge(updatedChallenge);
            }
          }).catch((err) => {
            console.error("[useEffect] Error updating winner:", err);
          });
        }
        
        setQuizCompleted(true);
        
        // Update the score and time if the user has already completed the quiz
        const isFromUser = challenge.fromUserId === currentUser?.id;
        if ((isFromUser && challenge.fromUserCompleted) || 
            (!isFromUser && challenge.toUserCompleted)) {
          setScore(isFromUser ? challenge.fromUserScore : challenge.toUserScore);
          setTotalTime(isFromUser ? challenge.fromUserTime : challenge.toUserTime);
        }
      }
    }
  }, [challenge, currentUser, challengeId]);
  
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
                
                // Set up real-time listener for challenge updates
                const challengeRef = doc(db, "challenges", challengeId);
                const unsubscribeChallenge = onSnapshot(challengeRef, (doc) => {
                  if (doc.exists()) {
                    const updatedChallenge = doc.data();
                    console.log("Real-time challenge update:", updatedChallenge);
                    
                    // Force a UI update by creating a new object
                    setChallenge({...updatedChallenge});
                    
                    // Update UI if the other player has completed the quiz
                    const isFromUser = updatedChallenge.fromUserId === user.uid;
                    if ((isFromUser && updatedChallenge.toUserScore !== null) || 
                        (!isFromUser && updatedChallenge.fromUserScore !== null)) {
                      // The other player has completed the quiz
                      console.log("Other player has completed the quiz");
                      
                      // If both players have completed the quiz, update the UI
                      if (updatedChallenge.fromUserScore !== null && updatedChallenge.toUserScore !== null) {
                        console.log("Both players have completed the quiz");
                        setQuizCompleted(true);
                        
                        // If the user has already completed the quiz, update their score and time
                        if ((isFromUser && updatedChallenge.fromUserScore !== null) || 
                            (!isFromUser && updatedChallenge.toUserScore !== null)) {
                          setScore(isFromUser ? updatedChallenge.fromUserScore : updatedChallenge.toUserScore);
                          setTotalTime(isFromUser ? updatedChallenge.fromUserTime : updatedChallenge.toUserTime);
                        }
                      }
                    }
                  }
                });
                
                return () => {
                  unsubscribeChallenge();
                };
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
    setTotalTimeTaken(0);
    setQuestionTimes([]);
    
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
    setTotalTimeTaken(prev => prev + timeTaken);
    
    // Check if answer is correct
    const isCorrect = selectedAnswer === quiz.questions[currentQuestionIndex].correctAnswer;
    setAnswers(prev => [...prev, { 
      questionIndex: currentQuestionIndex, 
      selectedAnswer, 
      isCorrect,
      timeTaken 
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
      
      // Calculate final total time
      const finalTotalTime = totalTimeTaken + timeTaken;
      setTotalTime(finalTotalTime);
      
      // Save the results with total time taken
      saveQuizResults(finalTotalTime);
    }
  };
  
  // Save quiz results
  const saveQuizResults = async (totalTimeTaken) => {
    try {
      const isFromUser = challenge.fromUserId === currentUser.id;
      const challengeRef = doc(db, "challenges", challengeId);
      
      console.log("[saveQuizResults] Starting to save results");
      console.log("[saveQuizResults] isFromUser:", isFromUser);
      console.log("[saveQuizResults] Current challenge state:", challenge);
      console.log("[saveQuizResults] Total time taken:", totalTimeTaken);
      
      // Update the challenge document with the user's score, time, and completion status
      const updateData = {
        ...(isFromUser ? {
          fromUserScore: score,
          fromUserTime: totalTimeTaken,
          fromUserCompletedAt: new Date().toISOString(),
          fromUserCompleted: true
        } : {
          toUserScore: score,
          toUserTime: totalTimeTaken,
          toUserCompletedAt: new Date().toISOString(),
          toUserCompleted: true
        })
      };

      // If this is the first time saving, initialize the other completion status to false
      if (!challenge.fromUserCompleted && !challenge.toUserCompleted) {
        updateData[isFromUser ? 'toUserCompleted' : 'fromUserCompleted'] = false;
      }
      
      console.log("[saveQuizResults] Update data to be saved:", updateData);
      
      // First update the user's score and time
      await updateDoc(challengeRef, updateData);
      console.log("[saveQuizResults] Updated user's score and time");
      
      // Get the latest challenge data
      const challengeDoc = await getDoc(challengeRef);
      const updatedChallenge = challengeDoc.data();
      console.log("[saveQuizResults] Latest challenge data:", updatedChallenge);
      
      // Check if both users have completed
      const bothCompleted = updatedChallenge.fromUserCompleted && updatedChallenge.toUserCompleted;
      console.log("[saveQuizResults] Both completed:", bothCompleted);
      
      // If both users have completed, determine and set the winner immediately
      if (bothCompleted) {
        console.log("[saveQuizResults] Both users have completed, determining winner");
        
        // Determine winner based on scores first, then time
        const fromUserWins = 
          updatedChallenge.fromUserScore > updatedChallenge.toUserScore || 
          (updatedChallenge.fromUserScore === updatedChallenge.toUserScore && 
           updatedChallenge.fromUserTime < updatedChallenge.toUserTime);
        
        const winner = fromUserWins ? "fromUser" : "toUser";
        console.log("[saveQuizResults] Winner determined:", winner);
        
        const winnerId = fromUserWins ? updatedChallenge.fromUserId : updatedChallenge.toUserId;
        const loserId = fromUserWins ? updatedChallenge.toUserId : updatedChallenge.fromUserId;
        const pointsWagered = updatedChallenge.pointsWagered || 10;
        
        // Update challenge with winner
        await updateDoc(challengeRef, {
          winner,
          status: "completed",
          completedAt: new Date().toISOString()
        });
        console.log("[saveQuizResults] Updated challenge with winner");
        
        // Update request status
        const requestRef = doc(db, "onevsoneRequests", challenge.requestId);
        await updateDoc(requestRef, {
          status: "completed",
          completedAt: new Date().toISOString(),
          winner: winnerId
        });
        console.log("[saveQuizResults] Updated request status");
        
        // Get current points for both users
        const [winnerDoc, loserDoc] = await Promise.all([
          getDoc(doc(db, "students", winnerId)),
          getDoc(doc(db, "students", loserId))
        ]);
        
        const winnerPoints = winnerDoc.data().totalPoints || 0;
        const loserPoints = loserDoc.data().totalPoints || 0;
        
        // Transfer points
        await Promise.all([
          updateDoc(doc(db, "students", winnerId), {
            totalPoints: winnerPoints + pointsWagered
          }),
          updateDoc(doc(db, "students", loserId), {
            totalPoints: Math.max(0, loserPoints - pointsWagered)
          })
        ]);
        console.log("[saveQuizResults] Transferred points between users");
        
        // Get final challenge state
        const finalChallengeDoc = await getDoc(challengeRef);
        const finalChallenge = finalChallengeDoc.data();
        console.log("[saveQuizResults] Final challenge state:", finalChallenge);
        
        // Update local state
        setChallenge(finalChallenge);
        setQuizCompleted(true);
      } else {
        console.log("[saveQuizResults] Only one user has completed");
        // If only one user has completed, just update the local state
        setChallenge(updatedChallenge);
        setQuizCompleted(true);
      }
    } catch (err) {
      console.error("[saveQuizResults] Error:", err);
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
    if (!seconds) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
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
  
  // Add a function to determine if the current user is the sender
  const isSender = () => {
    if (!challenge || !currentUser) return false;
    return challenge.fromUserId === currentUser.id;
  };

  // Add a function to determine if the current user is the receiver
  const isReceiver = () => {
    if (!challenge || !currentUser) return false;
    return challenge.toUserId === currentUser.id;
  };

  // Render the quiz results
  const renderResults = () => {
    if (!challenge || !currentUser) return null;

    const isFromUser = isSender();
    const bothCompleted = challenge.fromUserCompleted && challenge.toUserCompleted;
    const userCompleted = isFromUser ? challenge.fromUserCompleted : challenge.toUserCompleted;
    const opponentCompleted = isFromUser ? challenge.toUserCompleted : challenge.fromUserCompleted;

    console.log("[renderResults] isFromUser:", isFromUser);
    console.log("[renderResults] Current challenge state:", challenge);
    console.log("[renderResults] bothCompleted:", bothCompleted);
    console.log("[renderResults] userCompleted:", userCompleted);
    console.log("[renderResults] opponentCompleted:", opponentCompleted);

    let resultMessage = "";
    if (bothCompleted) {
      if (challenge.winner === (isFromUser ? "fromUser" : "toUser")) {
        resultMessage = "You won the challenge! 🎉";
      } else if (challenge.winner === (isFromUser ? "toUser" : "fromUser")) {
        resultMessage = "Your opponent won the challenge.";
      } else {
        resultMessage = "The challenge ended in a tie!";
      }
    } else if (userCompleted) {
      resultMessage = "Waiting for opponent to complete...";
    } else {
      resultMessage = "Take the quiz to complete the challenge!";
    }

    console.log("[renderResults] Final result message:", resultMessage);

    return (
      <div className={styles.resultsContainer}>
        <h2>Challenge Results</h2>
        <p className={styles.resultMessage}>{resultMessage}</p>
        
        {userCompleted && (
          <div className={styles.scoreContainer}>
            <p>Your Score: {isFromUser ? challenge.fromUserScore : challenge.toUserScore}</p>
            <p>Time Taken: {formatTime(isFromUser ? challenge.fromUserTime : challenge.toUserTime)}</p>
            <div className={styles.questionTimes}>
              <h3>Time per Question:</h3>
              {answers.map((answer, index) => (
                <p key={index}>
                  Question {index + 1}: {formatTime(answer.timeTaken)}
                </p>
              ))}
            </div>
          </div>
        )}
        
        {opponentCompleted && (
          <div className={styles.scoreContainer}>
            <p>Opponent's Score: {isFromUser ? challenge.toUserScore : challenge.fromUserScore}</p>
            <p>Time Taken: {formatTime(isFromUser ? challenge.toUserTime : challenge.fromUserTime)}</p>
          </div>
        )}

        <div className={styles.resultActions}>
          <button 
            className={styles.returnButton}
            onClick={() => router.push('/onevsoneRequests')}
          >
            Return to Challenges
          </button>
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
            
            {/* Only show the Start Quiz button if both players haven't completed the quiz */}
            {!(challenge?.fromUserScore !== null && challenge?.toUserScore !== null) && (
              <button 
                className={styles.startButton}
                onClick={startQuiz}
              >
                Start Quiz
              </button>
            )}
            
            {/* Show a message if both players have completed the quiz */}
            {challenge?.fromUserScore !== null && challenge?.toUserScore !== null && (
              <div className={styles.completedMessage}>
                <p>Both players have completed this quiz.</p>
                <p><strong>Winner:</strong> {challenge?.winner === "fromUser" ? challenge?.fromUserName : challenge?.toUserName}</p>
                <p><strong>Score:</strong> {challenge?.fromUserScore} - {challenge?.toUserScore}</p>
                <button 
                  className={styles.returnButton}
                  onClick={() => router.push('/onevsoneRequests')}
                >
                  Return to Challenges
                </button>
              </div>
            )}
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
