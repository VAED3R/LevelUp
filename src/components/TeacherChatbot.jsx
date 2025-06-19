"use client";

import { useState, useEffect, useRef } from "react";
import { auth } from "@/lib/firebase";
import { onAuthStateChanged } from "firebase/auth";
import { usePathname } from "next/navigation";
import styles from "./TeacherChatbot.module.css";

export default function TeacherChatbot() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [showWelcomeCard, setShowWelcomeCard] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [teacherName, setTeacherName] = useState("");
  const timerRef = useRef(null);
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // You can fetch teacher name here if needed
        setTeacherName(user.displayName || user.email);
      }
    });

    return () => unsubscribe();
  }, []);

  // Show welcome card only on teacher dashboard
  useEffect(() => {
    if (pathname === '/teacherDashboard') {
      setShowWelcomeCard(true);
    } else {
      setShowWelcomeCard(false);
      setIsFadingOut(false);
    }
  }, [pathname]);

  // Auto-hide welcome card after 3 seconds
  useEffect(() => {
    if (timerRef.current || !showWelcomeCard) return; // Don't start timer if already set or card not shown
    
    timerRef.current = setTimeout(() => {
      setIsFadingOut(true);
      // Hide the card after animation completes
      setTimeout(() => {
        setShowWelcomeCard(false);
      }, 500);
    }, 3000);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [showWelcomeCard]); // Now we can depend on showWelcomeCard since it's controlled by pathname

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

  return (
    <>
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
            <div className={`${styles.welcomeCard} ${isFadingOut ? styles.fadeOut : ''}`}>
              <div className={styles.welcomeContent}>
                <h3>Hello! 👋</h3>
                <p>I'm Lia, LevelUp Interactive Assistant. I can help you with your teaching queries and classroom management.</p>
                <button 
                  className={styles.startChatButton}
                  onClick={() => {
                    setIsFadingOut(true);
                    setTimeout(() => {
                      setShowWelcomeCard(false);
                      toggleChat();
                    }, 500);
                  }}
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
    </>
  );
} 