import React, { useState, useEffect } from 'react';
import styles from './StudentChatbot.module.css';
import { FaRobot, FaTimes, FaBook, FaQuestion, FaGraduationCap } from 'react-icons/fa';
import { db } from '@/lib/firebase';
import { collection, getDocs, query, where, getDoc, doc } from 'firebase/firestore';
import { auth } from '@/lib/firebase';

const StudentChatbot = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeChat, setActiveChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [studentPerformance, setStudentPerformance] = useState(null);
  const [showWelcomePopup, setShowWelcomePopup] = useState(true);
  const [studentName, setStudentName] = useState('');

  const currentSemester = 6; // Set this dynamically if available
  const SEMESTER_SUBJECT_REGEX = /(?:subjects|courses|papers|syllabus)[^\d]*(\d+|this|current)(?:st|nd|rd|th)?\s*semester|semester\s*(\d+|this|current)[^\w]/i;

  useEffect(() => {
    // Show welcome popup for 5 seconds
    const timer = setTimeout(() => {
      setShowWelcomePopup(false);
    }, 5000);

    // Fetch student name
    fetchStudentName();

    return () => clearTimeout(timer);
  }, []);

  const fetchStudentName = async () => {
    try {
      // Get student's email from Firebase auth or localStorage
      let studentEmail = localStorage.getItem('userEmail');
      
      // If not in localStorage, try to get from Firebase auth
      if (!studentEmail) {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email) {
          studentEmail = currentUser.email;
          // Store in localStorage for future use
          localStorage.setItem('userEmail', studentEmail);
        }
      }
      
      if (!studentEmail) {
        console.log('No student email found');
        return;
      }

      // Find student document
      const studentQuery = query(
        collection(db, "users"),
        where("email", "==", studentEmail),
        where("role", "==", "student")
      );
      const studentSnapshot = await getDocs(studentQuery);
      
      if (studentSnapshot.empty) {
        console.log('No student document found');
        return;
      }
      
      const studentData = studentSnapshot.docs[0].data();
      setStudentName(studentData.name || 'Student');
    } catch (error) {
      console.error('Error fetching student name:', error);
    }
  };

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
      // Get student's email from Firebase auth or localStorage
      let studentEmail = localStorage.getItem('userEmail');
      
      // If not in localStorage, try to get from Firebase auth
      if (!studentEmail) {
        const currentUser = auth.currentUser;
        if (currentUser && currentUser.email) {
          studentEmail = currentUser.email;
          // Store in localStorage for future use
          localStorage.setItem('userEmail', studentEmail);
        }
      }
      
      if (!studentEmail) {
        console.log('No student email found');
        return;
      }

      // Find student document
      const studentQuery = query(
        collection(db, "users"),
        where("email", "==", studentEmail),
        where("role", "==", "student")
      );
      const studentSnapshot = await getDocs(studentQuery);
      
      if (studentSnapshot.empty) {
        console.log('No student document found');
        return;
      }
      
      const studentDoc = studentSnapshot.docs[0];
      const studentId = studentDoc.id;

      // Get the student document from the students collection
      const studentRef = doc(db, "students", studentId);
      const studentSnap = await getDoc(studentRef);
      
      if (!studentSnap.exists()) {
        console.log('Student data not found in students collection');
        return;
      }

      const studentInfo = {
        id: studentId,
        ...studentDoc.data(),
        ...studentSnap.data()
      };

      // Fetch performance data from quizzes, marks, and attendance collections
      const [quizzesSnapshot, marksSnapshot, attendanceSnapshot] = await Promise.all([
        getDocs(query(collection(db, "quizzes"), where("studentId", "==", studentId))),
        getDocs(query(collection(db, "marks"), where("studentId", "==", studentId))),
        getDocs(query(collection(db, "attendance"), where("studentId", "==", studentId)))
      ]);

      const quizzes = quizzesSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id,
          type: 'quiz',
          score: data.score || 0,
          totalQuestions: data.totalQuestions || 0
        };
      });

      const tests = marksSnapshot.docs.map(doc => {
        const data = doc.data();
        const percentage = data.totalMarks > 0 
          ? ((data.obtainedMarks / data.totalMarks) * 100).toFixed(2) 
          : 0;
        
        return {
          ...data,
          id: doc.id,
          type: 'test',
          percentage
        };
      });

      const attendance = attendanceSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id
        };
      });

      // Calculate performance metrics
      const quizScores = quizzes.map(q => q.score || 0);
      const avgQuizScore = quizScores.length > 0 
        ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(2)
        : 0;

      const testScores = tests.map(t => parseFloat(t.percentage) || 0);
      const avgTestScore = testScores.length > 0
        ? (testScores.reduce((a, b) => a + b, 0) / testScores.length).toFixed(2)
        : 0;

      // Calculate attendance rate
      const totalAttendance = attendance.length;
      const presentDays = attendance.filter(a => a.status === "present").length;
      const attendanceRate = totalAttendance > 0
        ? ((presentDays / totalAttendance) * 100).toFixed(2)
        : 0;

      // Calculate subject-wise performance
      const subjectPerformance = quizzes.reduce((acc, quiz) => {
        if (!acc[quiz.subject]) {
          acc[quiz.subject] = { total: 0, count: 0 };
        }
        acc[quiz.subject].total += quiz.score || 0;
        acc[quiz.subject].count += 1;
        return acc;
      }, {});

      // Add test scores to subject performance
      tests.forEach(test => {
        if (!subjectPerformance[test.subject]) {
          subjectPerformance[test.subject] = { total: 0, count: 0 };
        }
        subjectPerformance[test.subject].total += parseFloat(test.percentage) || 0;
        subjectPerformance[test.subject].count += 1;
      });

      // Calculate average for each subject
      const subjectAverages = Object.entries(subjectPerformance).map(([subject, data]) => ({
        subject,
        average: (data.total / data.count).toFixed(2),
        count: data.count
      }));

      // Sort subjects by performance (highest first)
      const sortedSubjects = subjectAverages.sort((a, b) => parseFloat(b.average) - parseFloat(a.average));

      const performance = {
        student: studentInfo,
        quizzes,
        tests,
        attendance,
        metrics: {
          avgQuizScore,
          avgTestScore,
          totalQuizzes: quizzes.length,
          totalTests: tests.length,
          attendanceRate,
          totalAttendance,
          presentDays,
          subjectPerformance: sortedSubjects
        }
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
    
    if (option === 'performance') {
      await fetchStudentPerformance();
    }

    const initialMessage = option === 'study' 
      ? "Hello! I'm Lia, LevelUp Interactive Assistant here to help with your studies. What subject or topic would you like help with?"
      : option === 'performance'
      ? studentPerformance 
        ? "Hello! I'm Lia, LevelUp Interactive Assistant. I've analyzed your performance and can help you understand your strengths and areas for improvement. What would you like to know about your performance?"
        : "Hello! I'm Lia, LevelUp Interactive Assistant. I'm analyzing your performance data. What would you like to know about your academic progress?"
      : "Hello! I'm Lia, LevelUp Interactive Assistant. How can I help you today?";
    
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
      // Enhanced semester subject query detection
      let match = inputMessage.match(SEMESTER_SUBJECT_REGEX);
      let semesterNum = null;
      if (match) {
        semesterNum = match[1] || match[2];
        if (semesterNum && (semesterNum.toLowerCase() === 'this' || semesterNum.toLowerCase() === 'current')) {
          semesterNum = currentSemester.toString();
        }
      }
      if (semesterNum) {
        // Call the new endpoint
        const resp = await fetch('http://localhost:8000/semester_subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ semester: semesterNum })
        });
        if (resp.ok) {
          const data = await resp.json();
          let reply = `Here are your subjects for the ${semesterNum}th semester:`;
          if (data.subjects && data.subjects.length > 0) {
            reply += '<br />' + data.subjects.map(s => `• ${s}`).join('<br />');
          } else {
            reply += '<br />No subjects found for this semester.';
          }
          setMessages(prev => [...prev, { type: 'bot', text: reply }]);
        } else {
          setMessages(prev => [...prev, { type: 'bot', text: 'Sorry, I could not fetch the subjects for that semester.' }]);
        }
        setIsLoading(false);
        return;
      }

      let context = "";
      if (activeChat === 'study') {
        // Get relevant context from RAG system for study help
        const ragResponse = await fetch('http://localhost:8000/context', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: inputMessage,
            k: 3
          })
        });

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();
          context = `Note: The current semester is the 6th semester. Please tailor your responses accordingly.\n\nYou are a study assistant helping students with their academic questions. 
          Here is some relevant context from our knowledge base:
          ${ragData.context}
          
          Based on this context and the student's question, provide a clear and helpful response.
          Focus on explaining concepts in a way that's easy to understand.
          Include examples and practical applications where relevant.
          Keep responses concise and avoid using markdown formatting.`;
        } else {
          context = "Note: The current semester is the 6th semester. Please tailor your responses accordingly.\n\nYou are a study assistant helping students with their academic questions. Provide clear explanations and examples. Keep responses concise and avoid using markdown formatting.";
        }
      } else if (activeChat === 'performance') {
        // Create a performance summary
        const performanceSummary = studentPerformance ? `
          Your Performance Summary:
          Name: ${studentPerformance.student.name}
          Class: ${studentPerformance.student.class}
          Total Points: ${studentPerformance.student.totalPoints || 0}
          
          Performance Metrics:
          - Quizzes: ${studentPerformance.quizzes.length} completed
          - Tests: ${studentPerformance.tests.length} completed
          ${studentPerformance.quizzes.length > 0 ? `- Average Quiz Score: ${studentPerformance.metrics.avgQuizScore}%` : ''}
          ${studentPerformance.tests.length > 0 ? `- Average Test Score: ${studentPerformance.metrics.avgTestScore}%` : ''}
          - Attendance Rate: ${studentPerformance.metrics.attendanceRate}% (${studentPerformance.metrics.presentDays} out of ${studentPerformance.metrics.totalAttendance} days)
          
          Subject-wise Performance (sorted by performance):
          ${studentPerformance.metrics.subjectPerformance.map(subject => 
            `- ${subject.subject}: ${subject.average}% (${subject.count} assessments)`
          ).join('\n')}
          
          Strongest Subjects:
          ${studentPerformance.metrics.subjectPerformance.slice(0, 3).map(subject => 
            `- ${subject.subject}: ${subject.average}%`
          ).join('\n')}
        ` : "No performance data available yet.";
        
        // Get relevant context from RAG system
        const ragResponse = await fetch('http://localhost:8000/context', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: inputMessage,
            k: 3
          })
        });

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();
          context = `Note: The current semester is the 6th semester. Please tailor your responses accordingly.\n\nYou are a performance analysis assistant helping students understand their academic progress. 
          Based on the student's performance data: ${performanceSummary}
          
          Here is some relevant context from our knowledge base:
          ${ragData.context}
          
          Please provide personalized performance analysis by:
          1. Highlighting the student's academic strengths
          2. Identifying areas that need improvement
          3. Suggesting specific study strategies based on their performance
          4. Providing actionable recommendations for improvement
          5. Offering encouragement and motivation
          
          Keep responses focused on the student's actual performance data and provide specific, actionable recommendations.
          Be encouraging and supportive while being honest about areas for improvement.
          Keep responses concise and avoid using markdown formatting.`;
        } else {
          context = `Note: The current semester is the 6th semester. Please tailor your responses accordingly.\n\nYou are a performance analysis assistant helping students understand their academic progress. 
          Based on the student's performance data: ${performanceSummary}
          
          Please provide personalized performance analysis by:
          1. Highlighting the student's academic strengths
          2. Identifying areas that need improvement
          3. Suggesting specific study strategies based on their performance
          4. Providing actionable recommendations for improvement
          5. Offering encouragement and motivation
          
          Keep responses focused on the student's actual performance data and provide specific, actionable recommendations.
          Be encouraging and supportive while being honest about areas for improvement.
          Keep responses concise and avoid using markdown formatting.`;
        }
      } else {
        // Get relevant context from RAG system for general queries
        const ragResponse = await fetch('http://localhost:8000/context', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: inputMessage,
            k: 3
          })
        });

        if (ragResponse.ok) {
          const ragData = await ragResponse.json();
          context = `Note: The current semester is the 6th semester. Please tailor your responses accordingly.\n\nYou are a helpful assistant for students. Here is some relevant context from our knowledge base:
          ${ragData.context}
          
          Based on this context and the student's question, provide a clear and helpful response.
          Keep responses concise and avoid using markdown formatting.`;
        } else {
          context = "Note: The current semester is the 6th semester. Please tailor your responses accordingly.\n\nYou are a helpful assistant for students. Provide clear, concise answers to their questions. Avoid using markdown formatting.";
        }
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
    <>
      {showWelcomePopup && (
        <div className={styles.welcomePopup}>
          <div className={styles.welcomeContent}>
            <FaRobot className={styles.welcomeIcon} />
            <p>Hi {studentName ? studentName : 'there'}! I'm your AI study assistant. I can help you with:</p>
            <ul>
              <li>Study help and homework assistance</li>
              <li>Understanding your academic performance</li>
              <li>General questions about your education</li>
            </ul>
            <button 
              className={styles.closeWelcome}
              onClick={() => setShowWelcomePopup(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
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
              <h3>Study Assistant</h3>
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
                  onClick={() => handleOptionClick('study')}
                >
                  <FaBook className={styles.optionIcon} />
                  <span>Study Help</span>
                </button>
                <button 
                  className={styles.optionButton}
                  onClick={() => handleOptionClick('performance')}
                >
                  <FaGraduationCap className={styles.optionIcon} />
                  <span>Performance Analysis</span>
                </button>
                <button 
                  className={styles.optionButton}
                  onClick={() => handleOptionClick('general')}
                >
                  <FaQuestion className={styles.optionIcon} />
                  <span>General Questions</span>
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
    </>
  );
};

export default StudentChatbot; 