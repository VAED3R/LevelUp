"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot, deleteDoc, addDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function TeacherChat() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [deleting, setDeleting] = useState({});
  const [editedSummaries, setEditedSummaries] = useState({});
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Subscribe to performance requests
        const requestsRef = collection(db, "performance_requests");
        const unsubscribeRequests = onSnapshot(requestsRef, (snapshot) => {
          const requestsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setRequests(requestsData);
          
          // Initialize edited summaries with the current summaries
          const newEditedSummaries = {};
          requestsData.forEach(request => {
            if (request.summary) {
              newEditedSummaries[request.id] = request.summary;
            }
          });
          setEditedSummaries(prev => ({...prev, ...newEditedSummaries}));
          
          setLoading(false);
        });

        return () => unsubscribeRequests();
      } else {
        setError("Please log in to view requests");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const generateSummary = async (requestId) => {
    setGeneratingSummary(prev => ({ ...prev, [requestId]: true }));
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      const { metrics } = request;
      
      // Generate summary based on metrics
      let summary = `Performance Analysis for ${request.studentName}:\n\n`;
      
      // Quiz Performance
      summary += `Quiz Performance: ${metrics.quizPerformance}%\n`;
      if (metrics.quizPerformance >= 80) {
        summary += "Excellent performance in quizzes. Keep up the good work!\n";
      } else if (metrics.quizPerformance >= 60) {
        summary += "Good performance in quizzes. There's room for improvement.\n";
      } else {
        summary += "Needs improvement in quiz performance. Consider additional practice.\n";
      }

      // Assignment Performance
      summary += `\nAssignment Performance: ${metrics.assignmentPerformance}%\n`;
      if (metrics.assignmentPerformance >= 80) {
        summary += "Strong performance in assignments. Very consistent work.\n";
      } else if (metrics.assignmentPerformance >= 60) {
        summary += "Satisfactory performance in assignments. Could be more thorough.\n";
      } else {
        summary += "Assignment performance needs attention. Consider reviewing submission quality.\n";
      }

      // Test Performance
      summary += `\nTest Performance: ${metrics.testPerformance}%\n`;
      if (metrics.testPerformance >= 80) {
        summary += "Outstanding test performance. Excellent understanding of the material.\n";
      } else if (metrics.testPerformance >= 60) {
        summary += "Adequate test performance. Consider additional study time.\n";
      } else {
        summary += "Test performance needs significant improvement. Recommend extra tutoring.\n";
      }

      // Attendance
      summary += `\nAttendance Rate: ${metrics.attendanceRate}%\n`;
      if (metrics.attendanceRate >= 90) {
        summary += "Excellent attendance record. Very consistent presence in class.\n";
      } else if (metrics.attendanceRate >= 75) {
        summary += "Good attendance, but there's room for improvement.\n";
      } else {
        summary += "Attendance needs improvement. Regular class attendance is crucial.\n";
      }

      // Update the request with the generated summary
      const requestRef = doc(db, "performance_requests", requestId);
      await updateDoc(requestRef, {
        summary,
        status: 'generated',
        generatedAt: new Date().toISOString()
      });
      
      // Also update the edited summary state
      setEditedSummaries(prev => ({
        ...prev,
        [requestId]: summary
      }));

    } catch (error) {
      console.error("Error generating summary:", error);
      alert("Failed to generate summary. Please try again.");
    } finally {
      setGeneratingSummary(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleSummaryEdit = (requestId, newSummary) => {
    setEditedSummaries(prev => ({
      ...prev,
      [requestId]: newSummary
    }));
  };

  const submitSummary = async (requestId) => {
    setSubmitting(prev => ({ ...prev, [requestId]: true }));
    try {
      const requestRef = doc(db, "performance_requests", requestId);
      await updateDoc(requestRef, {
        summary: editedSummaries[requestId],
        status: 'submitted',
        submittedAt: new Date().toISOString()
      });
      alert("Summary submitted successfully!");
    } catch (error) {
      console.error("Error submitting summary:", error);
      alert("Failed to submit summary. Please try again.");
    } finally {
      setSubmitting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const deleteRequest = async (requestId) => {
    if (!confirm("Are you sure you want to delete this request? This action cannot be undone.")) {
      return;
    }
    
    setDeleting(prev => ({ ...prev, [requestId]: true }));
    try {
      const requestRef = doc(db, "performance_requests", requestId);
      await deleteDoc(requestRef);
      alert("Request deleted successfully!");
    } catch (error) {
      console.error("Error deleting request:", error);
      alert("Failed to delete request. Please try again.");
    } finally {
      setDeleting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const userMessage = {
      sender: 'user',
      text: newMessage,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setNewMessage('');
    setChatLoading(true);

    try {
      let context = "";
      // Get relevant context from RAG system
      const ragResponse = await fetch('http://localhost:8000/context', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: newMessage,
          k: 3
        })
      });

      if (ragResponse.ok) {
        const ragData = await ragResponse.json();
        context = `You are Lia, LevelUp Interactive Assistant, a helpful teaching assistant. Here is some relevant context from our knowledge base:
        ${ragData.context}
        
        Based on this context and the teacher's question, provide a clear and helpful response.
        Focus on teaching strategies, classroom management, and educational resources.
        Keep responses concise and avoid using markdown formatting.`;
      } else {
        context = `You are Lia, LevelUp Interactive Assistant, a helpful teaching assistant. 
        Provide clear, concise answers to the teacher's questions about:
        - Teaching strategies and methodologies
        - Classroom management techniques
        - Educational resources and tools
        - Student assessment and evaluation
        - Professional development opportunities
        
        Keep responses focused on practical, actionable advice.
        Avoid using markdown formatting.`;
      }

      const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}`
        },
        body: JSON.stringify({
          model: 'deepseek-chat',
          messages: [
            {
              role: 'system',
              content: context
            },
            {
              role: 'user',
              content: newMessage
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        throw new Error('Failed to get response from AI');
      }

      const data = await response.json();
      const botMessage = {
        sender: 'bot',
        text: data.choices[0].message.content,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, botMessage]);
    } catch (error) {
      console.error('Error getting response:', error);
      setMessages(prev => [...prev, {
        sender: 'bot',
        text: "I'm sorry, I encountered an error. Please try again.",
        timestamp: new Date()
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const toggleChat = () => {
    setIsChatOpen(!isChatOpen);
    if (!isChatOpen) {
      setShowWelcomeCard(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.mainContent}>
          <h1>Performance Analysis Requests</h1>
          <div className={styles.requestsList}>
            {requests.length === 0 ? (
              <p>No pending performance analysis requests</p>
            ) : (
              requests.map(request => (
                <div key={request.id} className={styles.requestCard}>
                  <h3>Request from {request.studentName}</h3>
                  <p>Student Email: {request.studentEmail}</p>
                  <p>Requested on: {new Date(request.timestamp).toLocaleString()}</p>
                  <p>Status: {request.status}</p>
                  
                  {request.status === 'pending' && (
                    <button
                      className={styles.generateButton}
                      onClick={() => generateSummary(request.id)}
                      disabled={generatingSummary[request.id]}
                    >
                      {generatingSummary[request.id] ? 'Generating...' : 'Generate Summary'}
                    </button>
                  )}

                  {request.status === 'generated' && (
                    <>
                      <div className={styles.summary}>
                        <h4>Generated Summary:</h4>
                        <textarea
                          className={styles.summaryTextarea}
                          value={editedSummaries[request.id] || ''}
                          onChange={(e) => handleSummaryEdit(request.id, e.target.value)}
                          rows={15}
                        />
                      </div>
                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.submitButton}
                          onClick={() => submitSummary(request.id)}
                          disabled={submitting[request.id]}
                        >
                          {submitting[request.id] ? 'Submitting...' : 'Submit Summary'}
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => deleteRequest(request.id)}
                          disabled={deleting[request.id]}
                        >
                          {deleting[request.id] ? 'Deleting...' : 'Delete Request'}
                        </button>
                      </div>
                    </>
                  )}

                  {request.status === 'submitted' && (
                    <div className={styles.summary}>
                      <h4>Submitted Summary:</h4>
                      <pre>{request.summary}</pre>
                      <p className={styles.submittedAt}>
                        Submitted on: {new Date(request.submittedAt).toLocaleString()}
                      </p>
                      <button
                        className={styles.deleteButton}
                        onClick={() => deleteRequest(request.id)}
                        disabled={deleting[request.id]}
                      >
                        {deleting[request.id] ? 'Deleting...' : 'Delete Request'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className={`${styles.chatContainer} ${isChatOpen ? styles.open : ''}`}>
          <div className={styles.chatHeader}>
            <h2>Chat Assistant</h2>
            <button onClick={toggleChat} className={styles.closeButton}>
              {isChatOpen ? '×' : ''}
            </button>
          </div>
          {isChatOpen && (
            <>
              <div className={styles.messagesContainer}>
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`${styles.message} ${
                      message.sender === 'user' ? styles.userMessage : styles.botMessage
                    }`}
                  >
                    <p>{message.text}</p>
                    <span className={styles.timestamp}>
                      {new Date(message.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
                {chatLoading && (
                  <div className={styles.loadingMessage}>
                    <p>Bot is typing...</p>
                  </div>
                )}
              </div>
              <form onSubmit={sendMessage} className={styles.messageForm}>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type your message..."
                  className={styles.messageInput}
                />
                <button type="submit" className={styles.sendButton}>
                  Send
                </button>
              </form>
            </>
          )}
        </div>
        {!isChatOpen && (
          <>
            {showWelcomeCard && (
              <div className={styles.welcomeCard}>
                <div className={styles.welcomeContent}>
                  <h3>Hello! 👋</h3>
                  <p>I'm Lia, LevelUp Interactive Assistant. I can help you with your teaching queries and classroom management.</p>
                  <button 
                    className={styles.startChatButton}
                    onClick={toggleChat}
                  >
                    Start Chat
                  </button>
                </div>
              </div>
            )}
            <button onClick={toggleChat} className={styles.chatButton}>
              <span className={styles.chatIcon}>💬</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}