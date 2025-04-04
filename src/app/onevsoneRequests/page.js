"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, updateDoc, doc, deleteDoc } from "firebase/firestore";
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
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // For demo purposes, we'll use the first student as the current user
        // In a real app, you would get this from authentication
        const studentsSnapshot = await getDocs(collection(db, "students"));
        if (!studentsSnapshot.empty) {
          const firstStudent = {
            id: studentsSnapshot.docs[0].id,
            ...studentsSnapshot.docs[0].data()
          };
          setCurrentUser(firstStudent);
          
          // Fetch requests where the current user is the recipient
          const receivedRequestsQuery = query(
            collection(db, "onevsoneRequests"),
            where("toUserId", "==", firstStudent.id)
          );
          
          // Fetch requests where the current user is the sender
          const sentRequestsQuery = query(
            collection(db, "onevsoneRequests"),
            where("fromUserId", "==", firstStudent.id)
          );
          
          const [receivedSnapshot, sentSnapshot] = await Promise.all([
            getDocs(receivedRequestsQuery),
            getDocs(sentRequestsQuery)
          ]);
          
          // Process received requests
          const receivedRequestsList = [];
          for (const doc of receivedSnapshot.docs) {
            const data = doc.data();
            // Skip test or invalid requests
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
            // Skip test or invalid requests
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
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Failed to load requests");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAcceptRequest = async (requestId) => {
    try {
      await updateDoc(doc(db, "onevsoneRequests", requestId), {
        status: "accepted"
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
      await updateDoc(doc(db, "onevsoneRequests", requestId), {
        status: "rejected"
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
      await updateDoc(doc(db, "onevsoneRequests", requestId), {
        status: "cancelled"
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
      await deleteDoc(doc(db, "onevsoneRequests", requestId));
      
      // Update the local state based on whether it's a received or sent request
      if (isReceived) {
        setReceivedRequests(prevRequests => 
          prevRequests.filter(request => request.id !== requestId)
        );
      } else {
        setSentRequests(prevRequests => 
          prevRequests.filter(request => request.id !== requestId)
        );
      }
      
      alert("Request deleted.");
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
    return new Date(date).toLocaleString();
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

  // Render the appropriate action buttons based on request status and user role
  const renderActionButtons = (request, isReceived) => {
    // If the request is pending
    if (request.status === "pending") {
      // If the current user is the receiver, show accept/reject buttons
      if (isReceived) {
        return (
          <div className={styles.requestActions}>
            <button 
              className={styles.acceptButton}
              onClick={() => handleAcceptRequest(request.id)}
            >
              Accept Challenge
            </button>
            <button 
              className={styles.rejectButton}
              onClick={() => handleRejectRequest(request.id)}
            >
              Reject
            </button>
          </div>
        );
      } 
      // If the current user is the sender, show cancel button
      else {
        return (
          <div className={styles.requestActions}>
            <button 
              className={styles.cancelButton}
              onClick={() => handleCancelRequest(request.id)}
            >
              Cancel Request
            </button>
          </div>
        );
      }
    }
    
    // If the request is accepted and quiz is generated
    if (request.status === "accepted" && request.quizGenerated) {
      // If the user hasn't started the quiz yet
      if (!request.hasStartedQuiz) {
        return (
          <div className={styles.quizReady}>
            <p>Quiz is ready! Click below to start.</p>
            <button 
              className={styles.startQuizButton}
              onClick={() => handleStartQuiz(request.id, isReceived)}
            >
              Start Quiz
            </button>
          </div>
        );
      } 
      // If the user has already started the quiz
      else {
        return (
          <div className={styles.quizStarted}>
            <p>You've already started this quiz.</p>
            <p>Started at: {formatDate(request.quizStartedAt)}</p>
          </div>
        );
      }
    }
    
    // If the request is accepted but quiz is still being generated
    if (request.status === "accepted" && !request.quizGenerated) {
      return (
        <div className={styles.quizPending}>
          <p>Quiz is being generated by AI...</p>
        </div>
      );
    }
    
    // For rejected or cancelled requests, show delete button
    if (request.status === "rejected" || request.status === "cancelled") {
      return (
        <div className={styles.requestActions}>
          <button 
            className={styles.deleteButton}
            onClick={() => handleDeleteRequest(request.id, isReceived)}
          >
            Delete Request
          </button>
        </div>
      );
    }
    
    return null;
  };

  // Render the request card based on user role
  const renderRequestCard = (request, isReceived) => {
    if (isReceived) {
      // For receivers, show only challenge details and accept/decline options
      return (
        <div key={request.id} className={styles.requestCard}>
          <div className={styles.requestHeader}>
            <h3 className={styles.requestTitle}>
              Challenge from {request.fromUserName}
            </h3>
            <span className={`${styles.statusBadge} ${getStatusBadgeClass(request.status)}`}>
              {getStatusText(request.status)}
            </span>
          </div>
          
          <div className={styles.requestDetails}>
            <p><strong>Topic:</strong> {request.topic}</p>
            <p><strong>Difficulty:</strong> {request.difficulty}</p>
            <p><strong>Time Limit:</strong> {request.timeLimit} seconds per question</p>
            <p><strong>Sent:</strong> {formatDate(request.createdAt)}</p>
          </div>
          
          {renderActionButtons(request, true)}
        </div>
      );
    } else {
      // For senders, show details with status
      return (
        <div key={request.id} className={styles.requestCard}>
          <div className={styles.requestHeader}>
            <h3 className={styles.requestTitle}>
              Challenge to {request.toUserName}
            </h3>
            <span className={`${styles.statusBadge} ${getStatusBadgeClass(request.status)}`}>
              {getStatusText(request.status)}
            </span>
          </div>
          
          <div className={styles.requestDetails}>
            <p><strong>Topic:</strong> {request.topic}</p>
            <p><strong>Difficulty:</strong> {request.difficulty}</p>
            <p><strong>Time Limit:</strong> {request.timeLimit} seconds per question</p>
            <p><strong>Sent:</strong> {formatDate(request.createdAt)}</p>
            <p><strong>Status:</strong> {getStatusText(request.status)}</p>
          </div>
          
          {renderActionButtons(request, false)}
        </div>
      );
    }
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