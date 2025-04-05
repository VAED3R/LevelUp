"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import IntroAnimation from "@/components/IntroAnimation";

export default function ChallengeResults() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const challengeId = searchParams.get("challengeId");
  
  const [challenge, setChallenge] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Get the current user's data from students collection
          const studentDoc = await getDoc(doc(db, "students", user.uid));
          if (studentDoc.exists()) {
            setCurrentUser({
              id: studentDoc.id,
              ...studentDoc.data()
            });
          }
        } catch (err) {
          console.error("Error fetching user data:", err);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchChallenge = async () => {
      if (!challengeId) return;

      try {
        console.log("Fetching challenge with ID:", challengeId);
        
        // Fetch the request document
        const requestRef = doc(db, "onevsoneRequests", challengeId);
        const requestDoc = await getDoc(requestRef);
        
        if (!requestDoc.exists()) {
          console.error("Request document not found for ID:", challengeId);
          setError("Challenge not found");
          return;
        }

        const requestData = requestDoc.data();
        console.log("Request data:", requestData);
        
        // Fetch both users' challenge documents
        const fromUserChallengeId = `${challengeId}_${requestData.fromUserId}`;
        const toUserChallengeId = `${challengeId}_${requestData.toUserId}`;
        
        console.log("Fetching challenge documents:", {
          fromUserChallengeId,
          toUserChallengeId
        });
        
        const [fromUserChallengeDoc, toUserChallengeDoc] = await Promise.all([
          getDoc(doc(db, "challenges", fromUserChallengeId)),
          getDoc(doc(db, "challenges", toUserChallengeId))
        ]);

        if (!fromUserChallengeDoc.exists() || !toUserChallengeDoc.exists()) {
          console.error("Challenge documents not found:", {
            fromUserExists: fromUserChallengeDoc.exists(),
            toUserExists: toUserChallengeDoc.exists()
          });
          setError("Challenge results not found");
          return;
        }

        const fromUserChallenge = fromUserChallengeDoc.data();
        const toUserChallenge = toUserChallengeDoc.data();
        
        console.log("Challenge documents data:", {
          fromUser: fromUserChallenge,
          toUser: toUserChallenge
        });

        // Use the stored scores and times directly from the challenge documents
        const fromUserScore = fromUserChallenge.fromUserScore || 0;
        const toUserScore = toUserChallenge.toUserScore || 0;
        const fromUserTime = fromUserChallenge.fromUserTime || 0;
        const toUserTime = toUserChallenge.toUserTime || 0;

        // Combine the data
        const combinedChallenge = {
          ...requestData,
          fromUserScore,
          toUserScore,
          fromUserTime,
          toUserTime,
          fromUserAnswers: fromUserChallenge.answers || [],
          toUserAnswers: toUserChallenge.answers || [],
          fromUserQuestions: fromUserChallenge.questions || [],
          toUserQuestions: toUserChallenge.questions || [],
          fromUserCompleted: fromUserChallenge.fromUserCompleted || false,
          toUserCompleted: toUserChallenge.toUserCompleted || false,
          fromUserCompletedAt: fromUserChallenge.fromUserCompletedAt,
          toUserCompletedAt: toUserChallenge.toUserCompletedAt,
          winner: requestData.winner || null,
          resultsCompared: requestData.resultsCompared || false
        };
        
        console.log("Combined challenge data:", combinedChallenge);
        setChallenge(combinedChallenge);
      } catch (err) {
        console.error("Error fetching challenge:", err);
        setError("Failed to load challenge data");
      } finally {
        setLoading(false);
      }
    };

    fetchChallenge();
  }, [challengeId]);

  const formatTime = (seconds) => {
    if (!seconds) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <IntroAnimation loadingText="Loading Challenge Results...">
        <div className={styles.container}>
          <Navbar />
          <div className={styles.content}>
            <p>Loading results...</p>
          </div>
        </div>
      </IntroAnimation>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <p className={styles.error}>{error}</p>
        </div>
      </div>
    );
  }

  if (!challenge) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <p>No challenge data found</p>
        </div>
      </div>
    );
  }

  const isSender = challenge.fromUserId === currentUser?.id;
  
  // Determine winner based on stored data or calculate if needed
  const fromUserWins = challenge.winner === "fromUser" || 
    (challenge.fromUserScore > challenge.toUserScore || 
     (challenge.fromUserScore === challenge.toUserScore && 
      challenge.fromUserTime < challenge.toUserTime));
  
  // Get winner name
  const getWinnerName = () => {
    if (challenge.winner === "fromUser") {
      return isSender ? "You" : challenge.fromUserName;
    } else if (challenge.winner === "toUser") {
      return isSender ? challenge.toUserName : "You";
    } else {
      // If no winner is set but we can determine it
      return fromUserWins 
        ? (isSender ? "You" : challenge.fromUserName)
        : (isSender ? challenge.toUserName : "You");
    }
  };

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>Challenge Results</h1>
        
        <div className={styles.resultsCard}>
          <div className={styles.challengeInfo}>
            <h2>{challenge.topic}</h2>
            <p className={styles.difficulty}>Difficulty: {challenge.difficulty}</p>
          </div>

          <div className={styles.scoresContainer}>
            <div className={styles.scoreCard}>
              <h3>{isSender ? "Your Score" : "Opponent's Score"}</h3>
              <div className={styles.scoreDetails}>
                <p>Score: {isSender ? challenge.fromUserScore : challenge.toUserScore}</p>
                <p>Time: {formatTime(isSender ? challenge.fromUserTime : challenge.toUserTime)}</p>
              </div>
            </div>

            <div className={styles.scoreCard}>
              <h3>{isSender ? "Opponent's Score" : "Your Score"}</h3>
              <div className={styles.scoreDetails}>
                <p>Score: {isSender ? challenge.toUserScore : challenge.fromUserScore}</p>
                <p>Time: {formatTime(isSender ? challenge.toUserTime : challenge.fromUserTime)}</p>
              </div>
            </div>
          </div>

          <div className={styles.detailedResults}>
            <h3>Detailed Results</h3>
            <div className={styles.questionsContainer}>
              {challenge.fromUserQuestions.map((question, index) => {
                const fromUserAnswer = challenge.fromUserAnswers[index];
                const toUserAnswer = challenge.toUserAnswers[index];
                const isFromUserCorrect = fromUserAnswer?.isCorrect;
                const isToUserCorrect = toUserAnswer?.isCorrect;

                return (
                  <div key={index} className={styles.questionResult}>
                    <h4>Question {index + 1}</h4>
                    <p className={styles.questionText}>{question.question}</p>
                    
                    <div className={styles.answersContainer}>
                      <div className={styles.answerCard}>
                        <h5>{isSender ? "Your Answer" : "Opponent's Answer"}</h5>
                        <p className={isFromUserCorrect ? styles.correct : styles.incorrect}>
                          {fromUserAnswer?.selectedAnswer || "Not answered"}
                        </p>
                        <p className={styles.timeTaken}>
                          Time: {formatTime(fromUserAnswer?.timeTaken)}
                        </p>
                      </div>

                      <div className={styles.answerCard}>
                        <h5>{isSender ? "Opponent's Answer" : "Your Answer"}</h5>
                        <p className={isToUserCorrect ? styles.correct : styles.incorrect}>
                          {toUserAnswer?.selectedAnswer || "Not answered"}
                        </p>
                        <p className={styles.timeTaken}>
                          Time: {formatTime(toUserAnswer?.timeTaken)}
                        </p>
                      </div>
                    </div>

                    <div className={styles.correctAnswer}>
                      <p>Correct Answer: {question.correctAnswer}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={styles.winnerSection}>
            <h3 className={styles.winnerTitle}>Winner</h3>
            <p className={styles.winnerName}>
              {getWinnerName()}
            </p>
            {challenge.winner && (
              <p className={styles.winnerScore}>
                Score: {challenge.fromUserScore} - {challenge.toUserScore}
              </p>
            )}
          </div>

          <div className={styles.actions}>
            <button 
              className={styles.returnButton}
              onClick={() => router.push('/onevsoneRequests')}
            >
              Return to Challenges
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 