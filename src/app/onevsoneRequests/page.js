"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, orderBy, updateDoc, doc } from "firebase/firestore";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";

export default function OneVsOneRequests() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);

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
          const requestsQuery = query(
            collection(db, "onevsoneRequests"),
            where("toUserId", "==", firstStudent.id),
            orderBy("createdAt", "desc")
          );
          
          const requestsSnapshot = await getDocs(requestsQuery);
          const requestsList = requestsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            createdAt: doc.data().createdAt?.toDate() || new Date()
          }));
          
          setRequests(requestsList);
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
      setRequests(prevRequests => 
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
      setRequests(prevRequests => 
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
      case "completed": return styles.statusCompleted;
      default: return "";
    }
  };

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>1v1 Challenge Requests</h1>
        
        {loading ? (
          <p className={styles.loading}>Loading requests...</p>
        ) : error ? (
          <p className={styles.error}>{error}</p>
        ) : requests.length === 0 ? (
          <p className={styles.noRequests}>No challenge requests found.</p>
        ) : (
          <div className={styles.requestsContainer}>
            {requests.map(request => (
              <div key={request.id} className={styles.requestCard}>
                <div className={styles.requestHeader}>
                  <h3 className={styles.requestTitle}>
                    Challenge from {request.fromUserName}
                  </h3>
                  <span className={`${styles.statusBadge} ${getStatusBadgeClass(request.status)}`}>
                    {request.status.toUpperCase()}
                  </span>
                </div>
                
                <div className={styles.requestDetails}>
                  <p><strong>Topic:</strong> {request.topic}</p>
                  <p><strong>Difficulty:</strong> {request.difficulty}</p>
                  <p><strong>Time Limit:</strong> {request.timeLimit} seconds per question</p>
                  <p><strong>Sent:</strong> {formatDate(request.createdAt)}</p>
                </div>
                
                {request.status === "pending" && (
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
                )}
                
                {request.status === "accepted" && !request.quizGenerated && (
                  <div className={styles.quizPending}>
                    <p>Quiz is being generated by AI...</p>
                  </div>
                )}
                
                {request.status === "accepted" && request.quizGenerated && (
                  <div className={styles.quizReady}>
                    <p>Quiz is ready! Click below to start.</p>
                    <button className={styles.startQuizButton}>
                      Start Quiz
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}