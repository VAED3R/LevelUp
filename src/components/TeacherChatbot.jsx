"use client";

import { useState, useEffect, useRef } from 'react';
import { auth, db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import styles from './TeacherChatbot.module.css';

const TeacherChatbot = () => {
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teacherId, setTeacherId] = useState(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherSubjects, setTeacherSubjects] = useState([]);
  const [teacherClasses, setTeacherClasses] = useState([]);
  const [chatHistory, setChatHistory] = useState([]);
  const [suggestions, setSuggestions] = useState([
    "Show me my students' performance",
    "Create a new assignment",
    "Generate a quiz",
    "View class statistics"
  ]);
  const messagesEndRef = useRef(null);

  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Get teacher data on component mount
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        setTeacherId(user.uid);
        
        // Get teacher data from Firestore
        try {
          const teacherQuery = query(
            collection(db, "users"),
            where("uid", "==", user.uid),
            where("role", "==", "teacher")
          );
          
          const teacherSnapshot = await getDocs(teacherQuery);
          
          if (!teacherSnapshot.empty) {
            const teacherData = teacherSnapshot.docs[0].data();
            setTeacherName(teacherData.name || 'Teacher');
            
            // Get teacher's subjects
            if (teacherData.subject) {
              const subjects = teacherData.subject.split(',').map(sub => sub.trim());
              setTeacherSubjects(subjects);
            }
            
            // Get teacher's classes
            if (teacherData.classes) {
              setTeacherClasses(teacherData.classes);
            }
            
            // Add welcome message
            setMessages([
              {
                id: 'welcome',
                text: `Hello ${teacherData.name || 'Teacher'}, I'm your teaching assistant. How can I help you today?`,
                sender: 'bot',
                timestamp: new Date().toISOString()
              }
            ]);
            
            // Load chat history
            loadChatHistory(user.uid);
          }
        } catch (error) {
          console.error("Error fetching teacher data:", error);
          setMessages([
            {
              id: 'error',
              text: "There was an error loading your data. Please try again later.",
              sender: 'bot',
              timestamp: new Date().toISOString()
            }
          ]);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  // Load chat history from Firestore
  const loadChatHistory = async (uid) => {
    try {
      const chatQuery = query(
        collection(db, "teacherChats"),
        where("teacherId", "==", uid)
      );
      
      const chatSnapshot = await getDocs(chatQuery);
      
      if (!chatSnapshot.empty) {
        const chatData = chatSnapshot.docs[0].data();
        if (chatData.messages && chatData.messages.length > 0) {
          setChatHistory(chatData.messages);
        }
      }
    } catch (error) {
      console.error("Error loading chat history:", error);
    }
  };

  // Save chat to Firestore
  const saveChat = async (newMessages) => {
    if (!teacherId) return;
    
    try {
      // Check if chat document exists
      const chatQuery = query(
        collection(db, "teacherChats"),
        where("teacherId", "==", teacherId)
      );
      
      const chatSnapshot = await getDocs(chatQuery);
      
      if (!chatSnapshot.empty) {
        // Update existing chat
        const chatDoc = chatSnapshot.docs[0];
        await addDoc(collection(db, "teacherChats", chatDoc.id, "messages"), {
          messages: newMessages,
          updatedAt: serverTimestamp()
        });
      } else {
        // Create new chat document
        await addDoc(collection(db, "teacherChats"), {
          teacherId,
          teacherName,
          messages: newMessages,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }
    } catch (error) {
      console.error("Error saving chat:", error);
    }
  };

  // Process user message and generate response
  const processMessage = async (userMessage) => {
    setIsLoading(true);
    
    // Add user message to chat
    const newUserMessage = {
      id: Date.now().toString(),
      text: userMessage,
      sender: 'user',
      timestamp: new Date().toISOString()
    };
    
    setMessages(prev => [...prev, newUserMessage]);
    
    try {
      // Generate bot response based on user message
      const botResponse = await generateBotResponse(userMessage);
      
      // Add bot response to chat
      const newBotMessage = {
        id: (Date.now() + 1).toString(),
        text: botResponse,
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, newBotMessage]);
      
      // Save updated chat to Firestore
      saveChat([...messages, newUserMessage, newBotMessage]);
      
    } catch (error) {
      console.error("Error processing message:", error);
      
      // Add error message
      const errorMessage = {
        id: (Date.now() + 1).toString(),
        text: "I'm sorry, I encountered an error processing your request. Please try again.",
        sender: 'bot',
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Generate bot response based on user message
  const generateBotResponse = async (userMessage) => {
    // Convert user message to lowercase for easier matching
    const message = userMessage.toLowerCase();
    
    // Check for performance-related queries
    if (message.includes('performance') || message.includes('progress') || message.includes('grades')) {
      return await getStudentPerformance();
    }
    
    // Check for assignment-related queries
    if (message.includes('assignment') || message.includes('homework') || message.includes('task')) {
      return await getAssignmentInfo();
    }
    
    // Check for quiz-related queries
    if (message.includes('quiz') || message.includes('test') || message.includes('exam')) {
      return await getQuizInfo();
    }
    
    // Check for statistics-related queries
    if (message.includes('statistics') || message.includes('stats') || message.includes('analytics')) {
      return await getClassStatistics();
    }
    
    // Check for student-related queries
    if (message.includes('student') || message.includes('pupil') || message.includes('learner')) {
      return await getStudentInfo();
    }
    
    // Check for schedule-related queries
    if (message.includes('schedule') || message.includes('timetable') || message.includes('calendar')) {
      return await getScheduleInfo();
    }
    
    // Check for help-related queries
    if (message.includes('help') || message.includes('assist') || message.includes('support')) {
      return "I can help you with student performance, assignments, quizzes, class statistics, student information, and schedules. What would you like to know more about?";
    }
    
    // Default response for unrecognized queries
    return "I'm not sure I understand that request. You can ask me about student performance, assignments, quizzes, class statistics, student information, or schedules. How can I assist you today?";
  };

  // Get student performance data
  const getStudentPerformance = async () => {
    try {
      // Query for student performance data
      const performanceQuery = query(
        collection(db, "assignments"),
        where("addedBy", "==", teacherId)
      );
      
      const performanceSnapshot = await getDocs(performanceQuery);
      
      if (performanceSnapshot.empty) {
        return "I don't see any assignment data yet. Have you added any assignments for your students?";
      }
      
      // Process performance data
      const performanceData = performanceSnapshot.docs.map(doc => doc.data());
      
      // Group by class
      const classPerformance = {};
      performanceData.forEach(assignment => {
        if (!classPerformance[assignment.class]) {
          classPerformance[assignment.class] = {
            total: 0,
            count: 0,
            students: {}
          };
        }
        
        classPerformance[assignment.class].total += assignment.percentage || 0;
        classPerformance[assignment.class].count += 1;
        
        if (!classPerformance[assignment.class].students[assignment.studentId]) {
          classPerformance[assignment.class].students[assignment.studentId] = {
            name: assignment.studentName,
            total: 0,
            count: 0
          };
        }
        
        classPerformance[assignment.class].students[assignment.studentId].total += assignment.percentage || 0;
        classPerformance[assignment.class].students[assignment.studentId].count += 1;
      });
      
      // Generate response
      let response = "Here's a summary of your students' performance:\n\n";
      
      Object.keys(classPerformance).forEach(className => {
        const classData = classPerformance[className];
        const classAverage = classData.total / classData.count;
        
        response += `**Class ${className}**: Average performance is ${classAverage.toFixed(2)}%\n\n`;
        
        response += "Top performing students:\n";
        
        // Sort students by performance
        const sortedStudents = Object.values(classData.students)
          .sort((a, b) => (b.total / b.count) - (a.total / a.count))
          .slice(0, 5);
        
        sortedStudents.forEach(student => {
          const studentAverage = student.total / student.count;
          response += `- ${student.name}: ${studentAverage.toFixed(2)}%\n`;
        });
        
        response += "\n";
      });
      
      return response;
    } catch (error) {
      console.error("Error getting student performance:", error);
      return "I encountered an error while retrieving student performance data. Please try again later.";
    }
  };

  // Get assignment information
  const getAssignmentInfo = async () => {
    try {
      // Query for recent assignments
      const assignmentQuery = query(
        collection(db, "assignments"),
        where("addedBy", "==", teacherId)
      );
      
      const assignmentSnapshot = await getDocs(assignmentQuery);
      
      if (assignmentSnapshot.empty) {
        return "I don't see any assignments in the system yet. Would you like me to guide you through creating a new assignment?";
      }
      
      // Process assignment data
      const assignmentData = assignmentSnapshot.docs.map(doc => doc.data());
      
      // Group by subject
      const subjectAssignments = {};
      assignmentData.forEach(assignment => {
        if (!subjectAssignments[assignment.subject]) {
          subjectAssignments[assignment.subject] = [];
        }
        
        subjectAssignments[assignment.subject].push(assignment);
      });
      
      // Generate response
      let response = "Here's information about your assignments:\n\n";
      
      Object.keys(subjectAssignments).forEach(subject => {
        const assignments = subjectAssignments[subject];
        
        response += `**${subject.replace(/_/g, ' ')}**: ${assignments.length} assignments\n`;
        
        // Get unique assignment titles
        const uniqueTitles = [...new Set(assignments.map(a => a.assignmentTitle))];
        
        response += "Recent assignments:\n";
        uniqueTitles.slice(0, 3).forEach(title => {
          response += `- ${title}\n`;
        });
        
        response += "\n";
      });
      
      response += "Would you like to create a new assignment or view more details about a specific one?";
      
      return response;
    } catch (error) {
      console.error("Error getting assignment info:", error);
      return "I encountered an error while retrieving assignment information. Please try again later.";
    }
  };

  // Get quiz information
  const getQuizInfo = async () => {
    try {
      // Query for quizzes
      const quizQuery = query(
        collection(db, "quizzes"),
        where("createdBy", "==", teacherId)
      );
      
      const quizSnapshot = await getDocs(quizQuery);
      
      if (quizSnapshot.empty) {
        return "I don't see any quizzes in the system yet. Would you like me to guide you through creating a new quiz?";
      }
      
      // Process quiz data
      const quizData = quizSnapshot.docs.map(doc => doc.data());
      
      // Generate response
      let response = "Here's information about your quizzes:\n\n";
      
      response += `You have created ${quizData.length} quizzes.\n\n`;
      
      // Group by subject
      const subjectQuizzes = {};
      quizData.forEach(quiz => {
        if (!subjectQuizzes[quiz.subject]) {
          subjectQuizzes[quiz.subject] = [];
        }
        
        subjectQuizzes[quiz.subject].push(quiz);
      });
      
      Object.keys(subjectQuizzes).forEach(subject => {
        const quizzes = subjectQuizzes[subject];
        
        response += `**${subject.replace(/_/g, ' ')}**: ${quizzes.length} quizzes\n`;
        
        response += "Recent quizzes:\n";
        quizzes.slice(0, 3).forEach(quiz => {
          response += `- ${quiz.title}\n`;
        });
        
        response += "\n";
      });
      
      response += "Would you like to create a new quiz or view more details about a specific one?";
      
      return response;
    } catch (error) {
      console.error("Error getting quiz info:", error);
      return "I encountered an error while retrieving quiz information. Please try again later.";
    }
  };

  // Get class statistics
  const getClassStatistics = async () => {
    try {
      // Query for class data
      const classQuery = query(
        collection(db, "users"),
        where("role", "==", "student")
      );
      
      const classSnapshot = await getDocs(classQuery);
      
      if (classSnapshot.empty) {
        return "I don't see any student data in the system yet.";
      }
      
      // Process class data
      const studentData = classSnapshot.docs.map(doc => doc.data());
      
      // Group by class
      const classData = {};
      studentData.forEach(student => {
        if (!classData[student.class]) {
          classData[student.class] = {
            count: 0,
            subjects: {}
          };
        }
        
        classData[student.class].count += 1;
        
        // Count students by subject
        if (student.subjects) {
          student.subjects.split(',').forEach(subject => {
            const trimmedSubject = subject.trim();
            if (!classData[student.class].subjects[trimmedSubject]) {
              classData[student.class].subjects[trimmedSubject] = 0;
            }
            classData[student.class].subjects[trimmedSubject] += 1;
          });
        }
      });
      
      // Generate response
      let response = "Here are the class statistics:\n\n";
      
      Object.keys(classData).forEach(className => {
        const data = classData[className];
        
        response += `**Class ${className}**: ${data.count} students\n\n`;
        
        response += "Subject distribution:\n";
        Object.keys(data.subjects).forEach(subject => {
          response += `- ${subject}: ${data.subjects[subject]} students\n`;
        });
        
        response += "\n";
      });
      
      return response;
    } catch (error) {
      console.error("Error getting class statistics:", error);
      return "I encountered an error while retrieving class statistics. Please try again later.";
    }
  };

  // Get student information
  const getStudentInfo = async () => {
    try {
      // Query for student data
      const studentQuery = query(
        collection(db, "users"),
        where("role", "==", "student")
      );
      
      const studentSnapshot = await getDocs(studentQuery);
      
      if (studentSnapshot.empty) {
        return "I don't see any student data in the system yet.";
      }
      
      // Process student data
      const studentData = studentSnapshot.docs.map(doc => doc.data());
      
      // Group by class
      const classStudents = {};
      studentData.forEach(student => {
        if (!classStudents[student.class]) {
          classStudents[student.class] = [];
        }
        
        classStudents[student.class].push(student);
      });
      
      // Generate response
      let response = "Here's information about your students:\n\n";
      
      Object.keys(classStudents).forEach(className => {
        const students = classStudents[className];
        
        response += `**Class ${className}**: ${students.length} students\n\n`;
        
        response += "Students:\n";
        students.forEach(student => {
          response += `- ${student.name}\n`;
        });
        
        response += "\n";
      });
      
      return response;
    } catch (error) {
      console.error("Error getting student info:", error);
      return "I encountered an error while retrieving student information. Please try again later.";
    }
  };

  // Get schedule information
  const getScheduleInfo = async () => {
    try {
      // Query for schedule data
      const scheduleQuery = query(
        collection(db, "schedules"),
        where("teacherId", "==", teacherId)
      );
      
      const scheduleSnapshot = await getDocs(scheduleQuery);
      
      if (scheduleSnapshot.empty) {
        return "I don't see any schedule data in the system yet. Would you like me to help you create a schedule?";
      }
      
      // Process schedule data
      const scheduleData = scheduleSnapshot.docs.map(doc => doc.data());
      
      // Generate response
      let response = "Here's your teaching schedule:\n\n";
      
      // Group by day
      const daySchedule = {};
      scheduleData.forEach(schedule => {
        if (!daySchedule[schedule.day]) {
          daySchedule[schedule.day] = [];
        }
        
        daySchedule[schedule.day].push(schedule);
      });
      
      const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
      
      days.forEach(day => {
        if (daySchedule[day]) {
          response += `**${day}**:\n`;
          
          // Sort by time
          const sortedSchedule = daySchedule[day].sort((a, b) => {
            return a.startTime.localeCompare(b.startTime);
          });
          
          sortedSchedule.forEach(schedule => {
            response += `- ${schedule.startTime} - ${schedule.endTime}: ${schedule.class} - ${schedule.subject}\n`;
          });
          
          response += "\n";
        }
      });
      
      return response;
    } catch (error) {
      console.error("Error getting schedule info:", error);
      return "I encountered an error while retrieving schedule information. Please try again later.";
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (inputMessage.trim() === '') return;
    
    processMessage(inputMessage);
    setInputMessage('');
  };

  // Handle suggestion click
  const handleSuggestionClick = (suggestion) => {
    processMessage(suggestion);
  };

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.chatbotHeader}>
        <h2>Teaching Assistant</h2>
      </div>
      
      <div className={styles.messagesContainer}>
        {messages.map((message) => (
          <div 
            key={message.id} 
            className={`${styles.message} ${message.sender === 'user' ? styles.userMessage : styles.botMessage}`}
          >
            <div className={styles.messageContent}>
              {message.text.split('\n').map((line, index) => (
                <p key={index}>{line}</p>
              ))}
            </div>
            <div className={styles.messageTimestamp}>
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>
      
      {suggestions.length > 0 && (
        <div className={styles.suggestionsContainer}>
          {suggestions.map((suggestion, index) => (
            <button 
              key={index} 
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
      
      <form onSubmit={handleSubmit} className={styles.inputForm}>
        <input
          type="text"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          placeholder="Type your message here..."
          className={styles.input}
          disabled={isLoading}
        />
        <button 
          type="submit" 
          className={styles.sendButton}
          disabled={isLoading || inputMessage.trim() === ''}
        >
          {isLoading ? 'Processing...' : 'Send'}
        </button>
      </form>
    </div>
  );
};

export default TeacherChatbot;
