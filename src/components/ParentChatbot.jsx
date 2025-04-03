import React, { useState } from 'react';
import styles from './ParentChatbot.module.css';
import { FaRobot, FaTimes, FaGraduationCap, FaHandHoldingHeart, FaQuestion } from 'react-icons/fa';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';

const ParentChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studentPerformance, setStudentPerformance] = useState(null);

  const formatMessage = (text) => {
    // Remove markdown symbols and format the text
    return text
      .replace(/\*\*\*/g, '') // Remove triple asterisks
      .replace(/\*\*/g, '') // Remove double asterisks
      .replace(/\*/g, '') // Remove single asterisks
      .replace(/\#\#\#/g, '') // Remove triple hashes
      .replace(/\#\#/g, '') // Remove double hashes
      .replace(/\#/g, '') // Remove single hashes
      .replace(/\-\s/g, '• ') // Convert dashes to bullets
      .replace(/\n/g, '<br />') // Convert newlines to HTML breaks
      .replace(/\`/g, ''); // Remove backticks
  };

  const fetchStudentPerformance = async () => {
    try {
      // Get parent's email from localStorage or auth context
      const parentEmail = localStorage.getItem('userEmail');
      if (!parentEmail) return;

      // Find parent document
      const parentQuery = query(
        collection(db, "users"),
        where("email", "==", parentEmail),
        where("role", "==", "parent")
      );
      const parentSnapshot = await getDocs(parentQuery);
      
      if (parentSnapshot.empty) return;
      const parentData = parentSnapshot.docs[0].data();
      const childEmail = parentData.child;

      if (!childEmail) return;

      // Find student document
      const studentQuery = query(
        collection(db, "users"),
        where("email", "==", childEmail),
        where("role", "==", "student")
      );
      const studentSnapshot = await getDocs(studentQuery);
      
      if (studentSnapshot.empty) return;
      const studentId = studentSnapshot.docs[0].id;

      // Fetch performance data
      const [quizzesSnapshot, assignmentsSnapshot, testsSnapshot] = await Promise.all([
        getDocs(query(collection(db, "quizzes"), where("studentId", "==", studentId))),
        getDocs(query(collection(db, "assignments"), where("studentId", "==", studentId))),
        getDocs(query(collection(db, "testResults"), where("studentId", "==", studentId)))
      ]);

      const performance = {
        quizzes: quizzesSnapshot.docs.map(doc => doc.data()),
        assignments: assignmentsSnapshot.docs.map(doc => doc.data()),
        tests: testsSnapshot.docs.map(doc => doc.data())
      };

      setStudentPerformance(performance);
    } catch (error) {
      console.error('Error fetching student performance:', error);
    }
  };

  const handleChatbotClick = () => {
    setIsOpen(!isOpen);
    if (!isOpen) {
      setActiveChat(null);
      setMessages([]);
    }
  };

  const handleOptionClick = async (option) => {
    setActiveChat(option);
    
    if (option === 'career') {
      await fetchStudentPerformance();
    }

    const initialMessage = option === 'counseling' 
      ? "Hello! I'm here to help with counseling. Could you please tell me what specific concerns you have about your child?"
      : option === 'career'
      ? "Hello! I'm here to help with career guidance. I'll analyze your child's performance to suggest suitable career paths. What specific career-related questions do you have?"
      : "Hello! I'm here to help. What would you like to know?";
    
    setMessages([{
      type: 'bot',
      text: initialMessage
    }]);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim()) return;

    const newMessage = {
      type: 'user',
      text: inputMessage
    };

    setMessages(prev => [...prev, newMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      let context = "";
      if (activeChat === 'counseling') {
        context = "You are a counseling assistant helping parents with their children's issues. Be empathetic and provide practical advice. Focus on understanding the parent's concerns and offering supportive guidance. Keep responses concise and avoid using markdown formatting.";
      } else if (activeChat === 'career') {
        // Create a performance summary for career guidance
        const performanceSummary = studentPerformance ? `
          Student Performance Summary:
          - Quizzes: ${studentPerformance.quizzes.length} completed
          - Assignments: ${studentPerformance.assignments.length} completed
          - Tests: ${studentPerformance.tests.length} completed
          Average scores and subject strengths will be analyzed for career recommendations.
        ` : "No performance data available yet.";
        
        context = `You are a career guidance assistant helping parents understand career options for their children. 
        Based on the student's performance data: ${performanceSummary}
        Provide relevant information about educational paths and career opportunities based on the child's academic strengths and interests.
        Keep responses concise and avoid using markdown formatting.`;
      } else {
        context = "You are a helpful assistant. Provide clear, concise answers to the user's questions. Avoid using markdown formatting.";
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
              content: inputMessage
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
      const formattedText = formatMessage(data.choices[0].message.content);
      const botResponse = {
        type: 'bot',
        text: formattedText
      };

      setMessages(prev => [...prev, botResponse]);
    } catch (error) {
      console.error('Error getting response:', error);
      setMessages(prev => [...prev, {
        type: 'bot',
        text: "I'm sorry, I encountered an error. Please try again."
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.chatbotContainer}>
      <button 
        className={styles.chatbotButton}
        onClick={handleChatbotClick}
      >
        <FaRobot className={styles.chatbotIcon} />
      </button>

      {isOpen && (
        <div className={styles.chatWindow}>
          <div className={styles.chatHeader}>
            <h3>Parent Assistant</h3>
            <button 
              className={styles.closeButton}
              onClick={handleChatbotClick}
            >
              <FaTimes />
            </button>
          </div>

          {!activeChat ? (
            <div className={styles.optionsContainer}>
              <button 
                className={styles.optionButton}
                onClick={() => handleOptionClick('counseling')}
              >
                <FaHandHoldingHeart className={styles.optionIcon} />
                Counseling
              </button>
              <button 
                className={styles.optionButton}
                onClick={() => handleOptionClick('career')}
              >
                <FaGraduationCap className={styles.optionIcon} />
                Career Guidance
              </button>
              <button 
                className={styles.optionButton}
                onClick={() => handleOptionClick('other')}
              >
                <FaQuestion className={styles.optionIcon} />
                Other
              </button>
            </div>
          ) : (
            <div className={styles.chatContent}>
              <div className={styles.messagesContainer}>
                {messages.map((message, index) => (
                  <div 
                    key={index} 
                    className={`${styles.message} ${message.type === 'user' ? styles.userMessage : styles.botMessage}`}
                    dangerouslySetInnerHTML={{ __html: message.text }}
                  />
                ))}
                {isLoading && (
                  <div className={`${styles.message} ${styles.botMessage}`}>
                    Thinking...
                  </div>
                )}
              </div>
              <form onSubmit={handleSendMessage} className={styles.inputContainer}>
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Type your message..."
                  className={styles.messageInput}
                  disabled={isLoading}
                />
                <button 
                  type="submit" 
                  className={styles.sendButton}
                  disabled={isLoading}
                >
                  Send
                </button>
              </form>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ParentChatbot; 