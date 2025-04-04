"use client";

import { useEffect, useState } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";

export default function OneVsOneRequests() {
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
        status: "accepted",
        createdAt: requestData.createdAt,
        acceptedAt: new Date().toISOString(),
        quizId: null, // Will be set when quiz is generated
        fromUserScore: null,
        toUserScore: null,
        winner: null
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
            ? { ...request, status: "accepted" } 
            : request
        )
      );
      
      alert("Request accepted! The AI will now generate the quiz.");
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
      // In a real app, this would navigate to the quiz page with the request ID
      // For now, we'll just show an alert
      alert("Starting quiz... This would navigate to the quiz page in a real app.");
      
      // Update the local state to mark this user as having started the quiz
      if (isReceived) {
        setReceivedRequests(prevRequests => 
          prevRequests.map(request => 
            request.id === requestId 
              ? { 
                  ...request, 
                  hasStartedQuiz: true,
                  quizStartedAt: new Date()
                } 
              : request
          )
        );
      } else {
        setSentRequests(prevRequests => 
          prevRequests.map(request => 
            request.id === requestId 
              ? { 
                  ...request, 
                  hasStartedQuiz: true,
                  quizStartedAt: new Date()
                } 
              : request
          )
        );
      }
    } catch (err) {
      console.error("Error starting quiz:", err);
      alert("Failed to start quiz. Please try again.");
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

  // Get status badge color
  const getStatusBadgeClass = (status) => {
    switch (status) {
      case "pending": return styles.statusPending;
      case "accepted": return styles.statusAccepted;
      case "rejected": return styles.statusRejected;
      case "cancelled": return styles.statusCancelled;
      case "completed": return styles.statusCompleted;
      default: return "";
    }
  };

  // Get status text
  const getStatusText = (status) => {
    switch (status) {
      case "pending": return "PENDING";
      case "accepted": return "ACCEPTED";
      case "rejected": return "REJECTED";
      case "cancelled": return "CANCELLED";
      case "completed": return "COMPLETED";
      default: return status.toUpperCase();
    }
  };

  // Render the request card based on user role
  const renderRequestCard = (request, isReceived) => {
    return (
      <div key={request.id} className={styles.requestCard}>
        <div className={styles.requestHeader}>
          <h3 className={styles.requestTitle}>
            {isReceived ? `Challenge from ${request.fromUserName || request.fromUsername}` : `Challenge to ${request.toUserName || request.toUsername}`}
          </h3>
          <span className={`${styles.statusBadge} ${getStatusBadgeClass(request.status)}`}>
            {getStatusText(request.status)}
          </span>
        </div>
        
        <div className={styles.requestDetails}>
          <p><strong>Topic:</strong> {request.topic}</p>
          <p><strong>Difficulty:</strong> {request.difficulty}</p>
          <p><strong>Sent:</strong> {formatDate(request.createdAt)}</p>
          {request.acceptedAt && <p><strong>Accepted:</strong> {formatDate(request.acceptedAt)}</p>}
          {request.rejectedAt && <p><strong>Rejected:</strong> {formatDate(request.rejectedAt)}</p>}
          {request.cancelledAt && <p><strong>Cancelled:</strong> {formatDate(request.cancelledAt)}</p>}
        </div>
        
        <div className={styles.requestActions}>
          {request.status === "pending" && isReceived && (
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
          
          {request.status === "pending" && !isReceived && (
            <button 
              className={styles.cancelButton}
              onClick={() => handleCancelRequest(request.id)}
            >
              Cancel
            </button>
          )}
          
          {request.status === "accepted" && request.quizId && !request.hasStartedQuiz && (
            <button 
              className={styles.startButton}
              onClick={() => handleStartQuiz(request.id, isReceived)}
            >
              Start Quiz
            </button>
          )}
          
          {/* Show delete button only for completed or rejected requests */}
          {(request.status === "completed" || request.status === "rejected" || request.status === "cancelled") && (
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
      </div>
    );
  };

    return (
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
    );
  }