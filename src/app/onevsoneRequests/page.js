"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, getDoc, setDoc, addDoc, onSnapshot, arrayUnion } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { useRouter } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import IntroAnimation from "../../components/IntroAnimation";

export default function OneVsOneRequests() {
  const router = useRouter();
  const [receivedRequests, setReceivedRequests] = useState([]);
  const [sentRequests, setSentRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [activeTab, setActiveTab] = useState("received"); // "received" or "sent"

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          setLoading(true);
          
          // Check if challenges collection exists
          const challengesRef = collection(db, "challenges");
          const challengesSnapshot = await getDocs(challengesRef);
          
          // If challenges collection is empty, create an initial document to ensure the collection exists
          if (challengesSnapshot.empty) {
            const initialChallengeRef = doc(challengesRef);
            await setDoc(initialChallengeRef, {
              type: "initial",
              createdAt: new Date().toISOString(),
              description: "Initial document to ensure challenges collection exists"
            });
            console.log("Created challenges collection with initial document");
          }
          
          // Get the current user's data from students collection
          const studentDoc = await getDoc(doc(db, "students", user.uid));
          if (studentDoc.exists()) {
            const studentData = {
              id: studentDoc.id,
              ...studentDoc.data()
            };
            setCurrentUser(studentData);
            
            // Fetch requests where the current user is the recipient
            const receivedRequestsQuery = query(
              collection(db, "onevsoneRequests"),
              where("toUserId", "==", user.uid)
            );
            
            // Fetch requests where the current user is the sender
            const sentRequestsQuery = query(
              collection(db, "onevsoneRequests"),
              where("fromUserId", "==", user.uid)
            );
            
            const [receivedSnapshot, sentSnapshot] = await Promise.all([
              getDocs(receivedRequestsQuery),
              getDocs(sentRequestsQuery)
            ]);
            
            // Process received requests
            const receivedRequestsList = [];
            for (const doc of receivedSnapshot.docs) {
              const data = doc.data();
              if (!data.fromUserId || !data.toUserId || !data.topic) {
                console.log("Skipping invalid request:", doc.id);
                continue;
              }
              
              receivedRequestsList.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                isReceiver: true
              });
            }
            
            // Process sent requests
            const sentRequestsList = [];
            for (const doc of sentSnapshot.docs) {
              const data = doc.data();
              if (!data.fromUserId || !data.toUserId || !data.topic) {
                console.log("Skipping invalid request:", doc.id);
                continue;
              }
              
              sentRequestsList.push({
                id: doc.id,
                ...data,
                createdAt: data.createdAt?.toDate() || new Date(),
                isReceiver: false
              });
            }
            
            // Sort requests by createdAt
            receivedRequestsList.sort((a, b) => b.createdAt - a.createdAt);
            sentRequestsList.sort((a, b) => b.createdAt - a.createdAt);
            
            setReceivedRequests(receivedRequestsList);
            setSentRequests(sentRequestsList);
          } else {
            setError("Student data not found");
          }
        } catch (err) {
          console.error("Error fetching data:", err);
          setError("Failed to load requests");
        } finally {
          setLoading(false);
        }
      } else {
        setError("User not authenticated");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const handleAcceptRequest = async (requestId) => {
    try {
      const requestRef = doc(db, "onevsoneRequests", requestId);
      const requestDoc = await getDoc(requestRef);
      const requestData = requestDoc.data();

      // Update the request status
      await updateDoc(requestRef, {
        status: "accepted",
        acceptedAt: new Date().toISOString()
      });

      // Create a challenge document for both users
      const challengeData = {
        requestId: requestId,
        fromUserId: requestData.fromUserId,
        toUserId: requestData.toUserId,
        fromUserName: requestData.fromUserName,
        toUserName: requestData.toUserName,
        topic: requestData.topic,
        difficulty: requestData.difficulty,
        timeLimit: requestData.timeLimit,
        pointsWagered: requestData.pointsWagered,
        status: "accepted",
        createdAt: requestData.createdAt,
        acceptedAt: new Date().toISOString(),
        quizId: null, // Will be set when quiz is generated
        fromUserScore: null,
        toUserScore: null,
        fromUserTime: null,
        toUserTime: null,
        fromUserCompleted: false,
        toUserCompleted: false,
        winner: null,
        resultsCompared: false,
        completionTime: {
          fromUser: null,
          toUser: null
        }
      };

      // Create challenge document for the sender
      const senderChallengeRef = doc(collection(db, "challenges"), `${requestId}_${requestData.fromUserId}`);
      await setDoc(senderChallengeRef, {
        ...challengeData,
        isSender: true,
        isOpponentCompleted: false
      });

      // Create challenge document for the receiver
      const receiverChallengeRef = doc(collection(db, "challenges"), `${requestId}_${requestData.toUserId}`);
      await setDoc(receiverChallengeRef, {
        ...challengeData,
        isSender: false,
        isOpponentCompleted: false
      });
      
      // Update the local state
      setReceivedRequests(prevRequests => 
        prevRequests.map(request => 
          request.id === requestId 
            ? { ...request, status: "accepted" } 
            : request
        )
      );
      
      alert("Request accepted! You can now take the quiz when you're ready.");
    } catch (err) {
      console.error("Error accepting request:", err);
      alert("Failed to accept request. Please try again.");
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const requestRef = doc(db, "onevsoneRequests", requestId);
      const requestDoc = await getDoc(requestRef);
      const requestData = requestDoc.data();

      // Update the request status
      await updateDoc(requestRef, {
        status: "rejected",
        rejectedAt: new Date().toISOString()
      });

      // Create challenge documents for both users with rejected status
      const challengeData = {
        requestId: requestId,
        fromUserId: requestData.fromUserId,
        toUserId: requestData.toUserId,
        fromUserName: requestData.fromUserName,
        toUserName: requestData.toUserName,
        topic: requestData.topic,
        difficulty: requestData.difficulty,
        status: "rejected",
        createdAt: requestData.createdAt,
        rejectedAt: new Date().toISOString()
      };

      // Create challenge document for the sender
      const senderChallengeRef = doc(collection(db, "challenges"), `${requestId}_${requestData.fromUserId}`);
      await setDoc(senderChallengeRef, {
        ...challengeData,
        isSender: true
      });

      // Create challenge document for the receiver
      const receiverChallengeRef = doc(collection(db, "challenges"), `${requestId}_${requestData.toUserId}`);
      await setDoc(receiverChallengeRef, {
        ...challengeData,
        isSender: false
      });
      
      // Update the local state
      setReceivedRequests(prevRequests => 
        prevRequests.map(request => 
          request.id === requestId 
            ? { ...request, status: "rejected" } 
            : request
        )
      );
      
      alert("Request rejected.");
    } catch (err) {
      console.error("Error rejecting request:", err);
      alert("Failed to reject request. Please try again.");
    }
  };

  const handleCancelRequest = async (requestId) => {
    try {
      const requestRef = doc(db, "onevsoneRequests", requestId);
      const requestDoc = await getDoc(requestRef);
      const requestData = requestDoc.data();

      // Update the request status
      await updateDoc(requestRef, {
        status: "cancelled",
        cancelledAt: new Date().toISOString()
      });

      // Create challenge documents for both users with cancelled status
      const challengeData = {
        requestId: requestId,
        fromUserId: requestData.fromUserId,
        toUserId: requestData.toUserId,
        fromUserName: requestData.fromUserName,
        toUserName: requestData.toUserName,
        topic: requestData.topic,
        difficulty: requestData.difficulty,
        status: "cancelled",
        createdAt: requestData.createdAt,
        cancelledAt: new Date().toISOString()
      };

      // Create challenge document for the sender
      const senderChallengeRef = doc(collection(db, "challenges"), `${requestId}_${requestData.fromUserId}`);
      await setDoc(senderChallengeRef, {
        ...challengeData,
        isSender: true
      });

      // Create challenge document for the receiver
      const receiverChallengeRef = doc(collection(db, "challenges"), `${requestId}_${requestData.toUserId}`);
      await setDoc(receiverChallengeRef, {
        ...challengeData,
        isSender: false
      });
      
      // Update the local state
      setSentRequests(prevRequests => 
        prevRequests.map(request => 
          request.id === requestId 
            ? { ...request, status: "cancelled" } 
            : request
        )
      );
      
      alert("Request cancelled.");
    } catch (err) {
      console.error("Error cancelling request:", err);
      alert("Failed to cancel request. Please try again.");
    }
  };

  const handleDeleteRequest = async (requestId, isReceived) => {
    try {
      // Delete the request from onevsoneRequests collection
      await deleteDoc(doc(db, "onevsoneRequests", requestId));

      // Delete the corresponding challenge documents
      const challengesQuery = query(
        collection(db, "challenges"),
        where("requestId", "==", requestId)
      );
      const challengesSnapshot = await getDocs(challengesQuery);
      
      const deletePromises = challengesSnapshot.docs.map(doc => 
        deleteDoc(doc.ref)
      );
      await Promise.all(deletePromises);
      
      // Update the local state
      if (isReceived) {
        setReceivedRequests(prevRequests => 
          prevRequests.filter(request => request.id !== requestId)
        );
      } else {
        setSentRequests(prevRequests => 
          prevRequests.filter(request => request.id !== requestId)
        );
      }
      
      alert("Request deleted successfully.");
    } catch (err) {
      console.error("Error deleting request:", err);
      alert("Failed to delete request. Please try again.");
    }
  };

  const handleStartQuiz = async (requestId, isReceived) => {
    try {
      // Get the challenge document
      const userId = currentUser.id;
      const challengeId = `${requestId}_${userId}`;
      console.log("Starting quiz with challenge ID:", challengeId);
      
      const challengeRef = doc(db, "challenges", challengeId);
      const challengeDoc = await getDoc(challengeRef);
      
      if (!challengeDoc.exists()) {
        console.error("Challenge not found for ID:", challengeId);
        alert("Challenge not found");
        return;
      }
      
      const challengeData = challengeDoc.data();
      console.log("Challenge data:", challengeData);
      
      // Check if quiz already exists
      if (!challengeData.quizId) {
        console.log("Generating new quiz for topic:", challengeData.topic);
        try {
          // Generate a new quiz
          const quizData = await generateQuiz(challengeData.topic, challengeData.difficulty);
          console.log("Generated quiz with ID:", quizData.id);
          
          // Update the challenge with the quiz ID
          await updateDoc(challengeRef, {
            quizId: quizData.id,
            quizGeneratedAt: new Date().toISOString()
          });
          
          // Also update the other user's challenge document
          const otherUserId = isReceived ? challengeData.fromUserId : challengeData.toUserId;
          const otherChallengeRef = doc(db, "challenges", `${requestId}_${otherUserId}`);
          await updateDoc(otherChallengeRef, {
            quizId: quizData.id,
            quizGeneratedAt: new Date().toISOString()
          });
        } catch (quizError) {
          console.error("Error generating quiz:", quizError);
          alert(`Failed to generate quiz: ${quizError.message}`);
          return;
        }
      } else {
        console.log("Using existing quiz with ID:", challengeData.quizId);
      }
      
      // Navigate to the quiz challenge page using Next.js router
      console.log("Navigating to quiz challenge page with ID:", challengeId);
      router.push(`/studentQuizChallenge?challengeId=${challengeId}`);
      
    } catch (err) {
      console.error("Error starting quiz:", err);
      alert("Failed to start quiz. Please try again.");
    }
  };
  
  // Function to generate a quiz
  const generateQuiz = async (topic, difficulty) => {
    try {
      // Number of questions based on difficulty
      const numQuestions = difficulty === "easy" ? 5 : difficulty === "medium" ? 7 : 10;
      
      const prompt = `Generate ${numQuestions} multiple choice questions about ${topic}. 
      IMPORTANT: Return ONLY a JSON array in the following format, with no additional text or explanation:
      [
          {
              "question": "What is...",
              "options": ["Option 1", "Option 2", "Option 3", "Option 4"],
              "correctAnswer": 0
          },
          ...
      ]
      Make sure the response is valid JSON and follows this exact structure.`;

      console.log("Sending API request to generate quiz questions");
      console.log("API Key available:", !!process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY);
      
      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
          method: "POST",
          headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}`
          },
          body: JSON.stringify({
              model: "deepseek-chat",
              messages: [{ 
                  role: "user", 
                  content: prompt 
              }],
              temperature: 0.7,
              max_tokens: 2000
          })
      });

      if (!response.ok) {
          const errorText = await response.text();
          console.error("API response not OK:", response.status, errorText);
          throw new Error(`Failed to generate questions: ${response.status} ${errorText}`);
      }

      const data = await response.json();
      console.log("API response received:", data);
      
      let generatedQuestions;
      
      try {
          const content = data.choices[0].message.content.trim();
          console.log("Raw content from API:", content);
          
          // Clean the content by removing any markdown formatting
          const cleanedContent = content
              .replace(/```json\n?/g, '') // Remove ```json
              .replace(/```\n?/g, '')     // Remove ```
              .trim();
              
          console.log("Cleaned content:", cleanedContent);
          
          generatedQuestions = JSON.parse(cleanedContent);
          
          if (!Array.isArray(generatedQuestions) || generatedQuestions.length === 0) {
              throw new Error("Invalid question format: not an array or empty");
          }
          
          generatedQuestions.forEach((q, index) => {
              if (!q.question || !Array.isArray(q.options) || q.options.length !== 4 || 
                  typeof q.correctAnswer !== 'number' || q.correctAnswer < 0 || q.correctAnswer > 3) {
                  throw new Error(`Invalid question format at index ${index}`);
              }
          });
          
          // Save the quiz to Firestore
          const quizData = {
              topic,
              difficulty,
              questions: generatedQuestions,
              createdAt: new Date().toISOString()
          };
          
          const quizRef = await addDoc(collection(db, "quizzes"), quizData);
          
          return {
              id: quizRef.id,
              ...quizData
          };
      } catch (parseError) {
          console.error("Error parsing API response:", parseError);
          throw new Error(`Failed to parse generated questions: ${parseError.message}`);
      }
    } catch (error) {
      console.error("Error generating quiz:", error);
      throw error;
    }
  };

  // Format date to readable string
  const formatDate = (date) => {
    if (!date) return "N/A";
    try {
      const dateObj = date.toDate ? date.toDate() : new Date(date);
      return dateObj.toLocaleString();
    } catch (error) {
      console.error("Error formatting date:", error);
      return "N/A";
    }
  };

  // Get status text
  const getStatusText = (status, request) => {
    if (status === "accepted") {
      if (request.fromUserCompleted && request.toUserCompleted) {
        return "COMPLETED";
      }
      if (request.fromUserCompleted || request.toUserCompleted) {
        return "IN PROGRESS";
      }
    }
    switch (status) {
      case "pending": return "PENDING";
      case "accepted": return "ACCEPTED";
      case "rejected": return "REJECTED";
      case "cancelled": return "CANCELLED";
      case "completed": return "COMPLETED";
      default: return status.toUpperCase();
    }
  };

  // Get status badge color
  const getStatusBadgeClass = (status, request) => {
    if (status === "accepted") {
      if (request.fromUserCompleted && request.toUserCompleted) {
        return styles.statusCompleted;
      }
      if (request.fromUserCompleted || request.toUserCompleted) {
        return styles.statusInProgress;
      }
    }
    switch (status) {
      case "pending": return styles.statusPending;
      case "accepted": return styles.statusAccepted;
      case "rejected": return styles.statusRejected;
      case "cancelled": return styles.statusCancelled;
      case "completed": return styles.statusCompleted;
      default: return "";
    }
  };

  // Add real-time listener for challenge updates
  useEffect(() => {
    if (!currentUser) return;

    // Create queries for both received and sent requests
    const receivedQuery = query(
      collection(db, "onevsoneRequests"),
      where("toUserId", "==", currentUser.id)
    );
    
    const sentQuery = query(
      collection(db, "onevsoneRequests"),
      where("fromUserId", "==", currentUser.id)
    );

    // Set up real-time listeners
    const unsubscribeReceived = onSnapshot(receivedQuery, async (snapshot) => {
      const updatedRequests = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        if (!data.fromUserId || !data.toUserId || !data.topic) {
          console.log("Skipping invalid request:", docSnapshot.id);
          continue;
        }

        // Get the latest challenge data for both users
        const userChallengeId = `${docSnapshot.id}_${currentUser.id}`;
        const opponentChallengeId = `${docSnapshot.id}_${data.fromUserId}`;
        
        const [userChallengeDoc, opponentChallengeDoc] = await Promise.all([
          getDoc(doc(db, "challenges", userChallengeId)),
          getDoc(doc(db, "challenges", opponentChallengeId))
        ]);

        const userChallengeData = userChallengeDoc.exists() ? userChallengeDoc.data() : null;
        const opponentChallengeData = opponentChallengeDoc.exists() ? opponentChallengeDoc.data() : null;

        // Determine completion status
        const fromUserCompleted = opponentChallengeData?.fromUserCompleted || false;
        const toUserCompleted = userChallengeData?.toUserCompleted || false;
        const bothCompleted = fromUserCompleted && toUserCompleted;

        // Update request data with latest challenge status
        updatedRequests.push({
          id: docSnapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          isReceiver: true,
          fromUserCompleted,
          toUserCompleted,
          bothCompleted,
          fromUserScore: opponentChallengeData?.fromUserScore || null,
          toUserScore: userChallengeData?.toUserScore || null,
          fromUserTime: opponentChallengeData?.fromUserTime || null,
          toUserTime: userChallengeData?.toUserTime || null,
          status: bothCompleted ? "completed" : data.status
        });
      }
      updatedRequests.sort((a, b) => b.createdAt - a.createdAt);
      setReceivedRequests(updatedRequests);
    });

    const unsubscribeSent = onSnapshot(sentQuery, async (snapshot) => {
      const updatedRequests = [];
      for (const docSnapshot of snapshot.docs) {
        const data = docSnapshot.data();
        if (!data.fromUserId || !data.toUserId || !data.topic) {
          console.log("Skipping invalid request:", docSnapshot.id);
          continue;
        }

        // Get the latest challenge data for both users
        const userChallengeId = `${docSnapshot.id}_${currentUser.id}`;
        const opponentChallengeId = `${docSnapshot.id}_${data.toUserId}`;
        
        const [userChallengeDoc, opponentChallengeDoc] = await Promise.all([
          getDoc(doc(db, "challenges", userChallengeId)),
          getDoc(doc(db, "challenges", opponentChallengeId))
        ]);

        const userChallengeData = userChallengeDoc.exists() ? userChallengeDoc.data() : null;
        const opponentChallengeData = opponentChallengeDoc.exists() ? opponentChallengeDoc.data() : null;

        // Determine completion status
        const fromUserCompleted = userChallengeData?.fromUserCompleted || false;
        const toUserCompleted = opponentChallengeData?.toUserCompleted || false;
        const bothCompleted = fromUserCompleted && toUserCompleted;

        // Update request data with latest challenge status
        updatedRequests.push({
          id: docSnapshot.id,
          ...data,
          createdAt: data.createdAt?.toDate() || new Date(),
          isReceiver: false,
          fromUserCompleted,
          toUserCompleted,
          bothCompleted,
          fromUserScore: userChallengeData?.fromUserScore || null,
          toUserScore: opponentChallengeData?.toUserScore || null,
          fromUserTime: userChallengeData?.fromUserTime || null,
          toUserTime: opponentChallengeData?.toUserTime || null,
          status: bothCompleted ? "completed" : data.status
        });
      }
      updatedRequests.sort((a, b) => b.createdAt - a.createdAt);
      setSentRequests(updatedRequests);
    });

    return () => {
      unsubscribeReceived();
      unsubscribeSent();
    };
  }, [currentUser]);

  // Update the renderRequestCard function to show completion status
  const renderRequestCard = (request, isReceived) => {
    const isSender = request.fromUserId === currentUser.id;
    const isReceiver = request.toUserId === currentUser.id;
    const isPending = request.status === "pending";
    const isAccepted = request.status === "accepted";
    const isCompleted = request.status === "completed";
    const bothCompleted = request.fromUserCompleted && request.toUserCompleted;

    return (
      <div key={request.id} className={styles.requestCard}>
        <div className={styles.requestHeader}>
          <h3 className={styles.requestTitle}>
            {isReceived ? `Challenge from ${request.fromUserName || request.fromUsername}` : `Challenge to ${request.toUserName || request.toUsername}`}
          </h3>
          <span className={`${styles.statusBadge} ${getStatusBadgeClass(request.status, request)}`}>
            {getStatusText(request.status, request)}
          </span>
        </div>
        
        <div className={styles.requestDetails}>
          <p><strong>Topic:</strong> {request.topic}</p>
          <p><strong>Difficulty:</strong> {request.difficulty}</p>
          <p><strong>Time Limit:</strong> {request.timeLimit || 30} seconds per question</p>
          <p><strong>Points Wagered:</strong> {request.pointsWagered || 10}</p>
          <p><strong>Opponent:</strong> {isSender ? request.toUserName : request.fromUserName}</p>
          <p><strong>Sent:</strong> {formatDate(request.createdAt)}</p>
          {request.acceptedAt && <p><strong>Accepted:</strong> {formatDate(request.acceptedAt)}</p>}
          {request.rejectedAt && <p><strong>Rejected:</strong> {formatDate(request.rejectedAt)}</p>}
          {request.cancelledAt && <p><strong>Cancelled:</strong> {formatDate(request.cancelledAt)}</p>}
          
          {isAccepted && (
            <div className={styles.completionStatus}>
              <p>Your Status: {isSender ? (request.fromUserCompleted ? "Completed" : "Not Completed") : (request.toUserCompleted ? "Completed" : "Not Completed")}</p>
              <p>Opponent's Status: {isSender ? (request.toUserCompleted ? "Completed" : "Not Completed") : (request.fromUserCompleted ? "Completed" : "Not Completed")}</p>
            </div>
          )}
        </div>
        
        <div className={styles.requestActions}>
          {isPending && isReceiver && (
            <>
              <button 
                className={styles.acceptButton}
                onClick={() => handleAcceptRequest(request.id)}
              >
                Accept
              </button>
              <button 
                className={styles.rejectButton}
                onClick={() => handleRejectRequest(request.id)}
              >
                Reject
              </button>
            </>
          )}
          
          {isAccepted && !bothCompleted && (
            <button 
              className={styles.takeQuizButton}
              onClick={() => handleStartQuiz(request.id, isReceived)}
            >
              Take Quiz
            </button>
          )}

          {bothCompleted && (
            <button 
              className={styles.viewResultsButton}
              onClick={() => router.push(`/challengeResults?challengeId=${request.id}`)}
            >
              View Results
            </button>
          )}

          {isPending && isSender && (
            <button 
              className={styles.cancelButton}
              onClick={() => handleCancelRequest(request.id)}
            >
              Cancel
            </button>
          )}
          
          {(isCompleted || request.status === "rejected") && (
            <button 
              className={styles.deleteButton}
              onClick={() => {
                if (window.confirm("Are you sure you want to delete this request?")) {
                  handleDeleteRequest(request.id, isReceived);
                }
              }}
            >
              Delete
            </button>
          )}
        </div>

        {request.resultsCompared && (
          <div className={styles.resultsSection}>
            <h4>Challenge Results</h4>
            <div className={styles.scoreComparison}>
              <p>Your Score: <strong>{isReceived ? request.toUserScore : request.fromUserScore}</strong></p>
              <p>Opponent's Score: <strong>{isReceived ? request.fromUserScore : request.toUserScore}</strong></p>
              <p className={styles.winner}>
                {request.winner === auth.currentUser?.uid 
                  ? "🏆 You won!" 
                  : request.winner 
                    ? `🏆 ${isReceived ? request.fromUserName : request.toUserName} won!`
                    : "It's a tie!"}
              </p>
            </div>
          </div>
        )}
      </div>
    );
  };

  const ChallengeStatus = ({ challenge }) => {
    const getStatusMessage = () => {
      if (challenge.resultsCompared) {
        if (challenge.winner) {
          return challenge.winner === auth.currentUser?.uid
            ? "You won the challenge! 🏆"
            : `${challenge.winnerName} won the challenge`;
        }
        return "The challenge ended in a tie!";
      }

      if (challenge.isOpponentCompleted) {
        return "Your opponent has completed the challenge. Complete yours to see the results!";
      }

      const userCompleted = challenge.isSender 
        ? challenge.fromUserCompleted 
        : challenge.toUserCompleted;

      if (userCompleted) {
        return "Waiting for your opponent to complete the challenge...";
      }

      return "Challenge is active. Take the quiz when you're ready!";
    };

    return (
      <div className={styles.challengeStatus}>
        <div className={styles.statusMessage}>{getStatusMessage()}</div>
        {challenge.resultsCompared && challenge.winner && (
          <div className={styles.scoreComparison}>
            <div className={styles.score}>
              <span>Your Score: </span>
              <strong>
                {challenge.isSender ? challenge.fromUserScore : challenge.toUserScore}
              </strong>
              <span> ({challenge.isSender ? challenge.fromUserTime : challenge.toUserTime}s)</span>
            </div>
            <div className={styles.score}>
              <span>Opponent's Score: </span>
              <strong>
                {challenge.isSender ? challenge.toUserScore : challenge.fromUserScore}
              </strong>
              <span> ({challenge.isSender ? challenge.toUserTime : challenge.fromUserTime}s)</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  const handleCompareResults = async (requestId) => {
    try {
      const requestRef = doc(db, "onevsoneRequests", requestId);
      const requestDoc = await getDoc(requestRef);
      
      if (!requestDoc.exists()) {
        console.error("Request not found");
        return;
      }

      const request = requestDoc.data();
      const isSender = request.fromUserId === currentUser.id;

      // Determine winner based on scores and time
      const fromUserWins = 
        request.fromUserScore > request.toUserScore || 
        (request.fromUserScore === request.toUserScore && 
         request.fromUserTime < request.toUserTime);

      const winner = fromUserWins ? "fromUser" : "toUser";
      const winnerId = fromUserWins ? request.fromUserId : request.toUserId;
      const loserId = fromUserWins ? request.toUserId : request.fromUserId;
      const pointsWagered = request.pointsWagered || 10;

      // Update request with winner and status
      await updateDoc(requestRef, {
        winner,
        status: "completed",
        completedAt: new Date().toISOString()
      });

      // Update points for winner and loser
      const winnerRef = doc(db, "students", winnerId);
      const loserRef = doc(db, "students", loserId);

      const [winnerDoc, loserDoc] = await Promise.all([
        getDoc(winnerRef),
        getDoc(loserRef)
      ]);

      const winnerPoints = winnerDoc.data().totalPoints || 0;
      const loserPoints = loserDoc.data().totalPoints || 0;

      await Promise.all([
        updateDoc(winnerRef, {
          totalPoints: winnerPoints + pointsWagered,
          pointsHistory: arrayUnion({
            amount: pointsWagered,
            type: "challenge_win",
            timestamp: new Date().toISOString(),
            challengeId: requestId
          })
        }),
        updateDoc(loserRef, {
          totalPoints: Math.max(0, loserPoints - pointsWagered),
          pointsHistory: arrayUnion({
            amount: -pointsWagered,
            type: "challenge_loss",
            timestamp: new Date().toISOString(),
            challengeId: requestId
          })
        })
      ]);

      // Update local state
      setReceivedRequests(prevRequests => 
        prevRequests.map(req => 
          req.id === requestId 
            ? { ...req, winner, status: "completed" }
            : req
        )
      );

      alert(`Challenge completed! ${isSender ? (fromUserWins ? "You" : "Opponent") : (fromUserWins ? "Opponent" : "You")} won!`);
    } catch (error) {
      console.error("Error comparing results:", error);
      alert("Failed to compare results. Please try again.");
    }
  };

    return (
    <IntroAnimation loadingText="Loading Challenge Requests...">
    <div className={styles.container}>
        <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>1v1 Challenge Requests</h1>
        
        {/* Tab navigation */}
        <div className={styles.tabNavigation}>
          <button 
            className={`${styles.tabButton} ${activeTab === "received" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("received")}
          >
            Received Challenges
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === "sent" ? styles.activeTab : ""}`}
            onClick={() => setActiveTab("sent")}
          >
            Sent Challenges
          </button>
        </div>
        
        {loading ? (
          <p className={styles.loading}>Loading requests...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : activeTab === "received" && receivedRequests.length === 0 ? (
          <p className={styles.noRequests}>No received challenge requests found.</p>
        ) : activeTab === "sent" && sentRequests.length === 0 ? (
          <p className={styles.noRequests}>No sent challenge requests found.</p>
        ) : (
          <div className={styles.requestsContainer}>
            {activeTab === "received" 
              ? receivedRequests.map(request => renderRequestCard(request, true))
              : sentRequests.map(request => renderRequestCard(request, false))
            }
          </div>
        )}
      </div>
      </div>
    </IntroAnimation>
    );
  }