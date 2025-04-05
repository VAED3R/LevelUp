'use client';

import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, addDoc, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import styles from './page.module.css';

export default function TeacherChat() {
  const { user } = useAuth();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [teacherInfo, setTeacherInfo] = useState(null);
  const [chatHistory, setChatHistory] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [activeTab, setActiveTab] = useState('chat');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [performanceData, setPerformanceData] = useState([]);
  const [classes, setClasses] = useState([]);
  const [students, setStudents] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [studentPerformance, setStudentPerformance] = useState(null);
  const [viewMode, setViewMode] = useState('classes'); // 'classes', 'students', 'performance'
  const [waitingForClassSelection, setWaitingForClassSelection] = useState(false);
  const [waitingForStudentSelection, setWaitingForStudentSelection] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadTeacherData();
      loadChatHistory();
      loadClasses();
    }
  }, [user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadTeacherData = async () => {
    try {
      const teachersRef = collection(db, 'teachers');
      const q = query(teachersRef, where('email', '==', user.email));
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const teacherData = querySnapshot.docs[0].data();
        setTeacherInfo(teacherData);
        
        // Add welcome message
        const welcomeMessage = {
          type: 'bot',
          content: `Hello ${teacherData.name}! I'm your AI teaching assistant. How can I help you today?`,
          timestamp: new Date().toISOString()
        };
        setMessages([welcomeMessage]);
      }
    } catch (error) {
      console.error('Error loading teacher data:', error);
    }
  };

  const loadClasses = async () => {
    try {
      if (!user || !user.uid) {
        console.error('User not authenticated');
        return [];
      }

      // Fetch all classes from the classes collection
      const classesRef = collection(db, 'classes');
      const querySnapshot = await getDocs(classesRef);
      
      const classesData = [];
      querySnapshot.forEach(doc => {
        classesData.push({
          id: doc.id,
          ...doc.data()
        });
      });

      console.log('Loaded classes from database:', classesData);

      // If we have classes, fetch students for each class
      if (classesData.length > 0) {
        // Fetch all users who are students
        const usersRef = collection(db, 'users');
        const studentsSnapshot = await getDocs(query(usersRef, where('role', '==', 'student')));
        
        const students = [];
        studentsSnapshot.forEach(doc => {
          students.push({
            id: doc.id,
            ...doc.data()
          });
        });

        // Add students to their respective classes
        const classesWithStudents = classesData.map(classData => {
          const classStudents = students.filter(student => student.class === classData.id);
          return {
            ...classData,
            studentCount: classStudents.length,
            students: classStudents
          };
        });

        setClasses(classesWithStudents);
        console.log('Classes with students:', classesWithStudents);
        return classesWithStudents;
      }

      setClasses(classesData);
      return classesData;
    } catch (error) {
      console.error('Error loading classes:', error);
      return [];
    }
  };

  const loadStudentPerformance = async (studentId) => {
    try {
      // Get student details
      const studentDoc = await getDoc(doc(db, 'students', studentId));
      const studentData = studentDoc.data();
      
      // Get performance data
      const performanceRef = collection(db, 'performance');
      const q = query(performanceRef, where('studentId', '==', studentId));
      const querySnapshot = await getDocs(q);
      
      const performanceData = [];
      querySnapshot.forEach(doc => {
        performanceData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      // Get assignment submissions
      const submissionsRef = collection(db, 'submissions');
      const submissionsQuery = query(submissionsRef, where('studentId', '==', studentId));
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      const submissionsData = [];
      submissionsSnapshot.forEach(doc => {
        submissionsData.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      setStudentPerformance({
        student: { id: studentId, ...studentData },
        performance: performanceData,
        submissions: submissionsData
      });
    } catch (error) {
      console.error('Error loading student performance:', error);
    }
  };

  const loadChatHistory = async () => {
    try {
      const chatsRef = collection(db, 'teacherChats');
      const q = query(
        chatsRef,
        where('teacherId', '==', user.uid),
        orderBy('timestamp', 'desc'),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      
      const history = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setChatHistory(history);
    } catch (error) {
      console.error('Error loading chat history:', error);
    }
  };

  const saveMessage = async (message) => {
    try {
      const chatsRef = collection(db, 'teacherChats');
      await addDoc(chatsRef, {
        teacherId: user.uid,
        ...message,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error saving message:', error);
    }
  };

  const processMessage = async (userInput) => {
    if (!userInput.trim()) return;

    const newMessage = {
      id: Date.now(),
      text: userInput,
      sender: 'user'
    };
    
    setIsLoading(true);
    
    // Add user message
    const userMessage = {
      type: 'user',
      content: userInput,
      timestamp: new Date().toISOString()
    };
    setMessages(prev => [...prev, userMessage]);
    await saveMessage(userMessage);
    
    // Process the message and generate response
    let response;
    const lowerInput = userInput.toLowerCase();
    
    if (lowerInput.includes('student') && lowerInput.includes('performance')) {
      // Load classes and show them in chat
      const classesData = await loadClasses();
      
      if (classesData.length === 0) {
        response = {
          type: 'bot',
          content: "I couldn't find any classes assigned to you. This could be because:\n\n" +
                  "1. Your user profile doesn't have a 'class' field\n" +
                  "2. The class ID in your profile doesn't match any class in the database\n" +
                  "3. There might be a temporary issue with the database\n\n" +
                  "To fix this:\n" +
                  "- Check your user profile in the database to ensure it has a 'class' field\n" +
                  "- Verify that the class ID in your profile exists in the classes collection\n" +
                  "- Contact your administrator if you need help with this setup",
          timestamp: new Date().toISOString()
        };
      } else {
        // Create a message with class selection options
        const classOptions = classesData.map((cls, index) => 
          `${index + 1}. ${cls.name} (${cls.studentCount || 0} students)`
        ).join('\n');
        
        response = {
          type: 'bot',
          content: `Here are your classes. Please select a class by clicking on it:\n\n${classOptions}`,
          timestamp: new Date().toISOString()
        };
        
        // Set a flag to indicate we're waiting for class selection
        setWaitingForClassSelection(true);
      }
    } else if (waitingForClassSelection) {
      // User has selected a class
      const selectedClass = classes.find(cls => 
        cls.name.toLowerCase() === userInput.toLowerCase()
      );
      
      if (selectedClass) {
        // Get the students for this class
        const classStudents = selectedClass.students;
        setStudents(classStudents);
        
        // Create a message with student selection options
        const studentOptions = classStudents.map((student, index) => 
          `${index + 1}. ${student.name}`
        ).join('\n');
        
        response = {
          type: 'bot',
          content: `Here are the students in ${selectedClass.name}. Please select a student by clicking on their name:\n\n${studentOptions}`,
          timestamp: new Date().toISOString()
        };
        
        // Set flags for selection state
        setWaitingForClassSelection(false);
        setWaitingForStudentSelection(true);
      } else {
        response = {
          type: 'bot',
          content: "I couldn't find that class. Please try again with the exact class name.",
          timestamp: new Date().toISOString()
        };
      }
    } else if (waitingForStudentSelection) {
      // User has selected a student
      const selectedStudent = students.find(student => 
        student.name === userInput.split(' (')[0] // Remove the average part if present
      );
      
      if (selectedStudent) {
        // Instead of showing performance data, send a request for a report
        const response = {
          type: 'bot',
          content: `I've sent a request for a performance report for ${selectedStudent.name} in ${selectedStudent.class}.\n\n` +
                  `The report will be generated and sent to you shortly. It will include:\n` +
                  `- Academic performance\n` +
                  `- Attendance records\n` +
                  `- Assignment completion\n` +
                  `- Participation metrics\n\n` +
                  `You'll receive a notification when the report is ready.`,
          timestamp: new Date().toISOString()
        };
        
        setMessages(prev => [...prev, response]);
        await saveMessage(response);
        
        // Reset selection flags
        setWaitingForStudentSelection(false);
      } else {
        response = {
          type: 'bot',
          content: `I couldn't find the student "${userInput}". Please try again.`,
          timestamp: new Date().toISOString()
        };
      }
    } else if (lowerInput.includes('assignment')) {
      response = await getAssignmentInfo();
    } else if (lowerInput.includes('quiz')) {
      response = await getQuizInfo();
    } else if (lowerInput.includes('class') && lowerInput.includes('stat')) {
      response = await getClassStatistics();
    } else if (lowerInput.includes('student') && lowerInput.includes('info')) {
      response = await getStudentInfo();
    } else if (lowerInput.includes('schedule')) {
      response = await getScheduleInfo();
    } else if (lowerInput.includes('material') || lowerInput.includes('search')) {
      response = await getMaterialInfo(userInput);
    } else {
      response = {
        type: 'bot',
        content: "I can help you with:\n- Student performance reports\n- Assignment information\n- Quiz details\n- Class statistics\n- Student information\n- Schedule details\n- Search learning materials\n\nWhat would you like to know?",
        timestamp: new Date().toISOString()
      };
    }
    
    setMessages(prev => [...prev, response]);
    await saveMessage(response);
    setIsLoading(false);
  };

  const getStudentPerformance = async () => {
    try {
      const studentsRef = collection(db, 'students');
      const querySnapshot = await getDocs(studentsRef);
      
      const students = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        type: 'bot',
        content: `Here's the student performance overview:\n\n${students.map(student => 
          `${student.name}: ${student.average || 'N/A'}% average`
        ).join('\n')}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting student performance:', error);
      return {
        type: 'bot',
        content: "Sorry, I couldn't retrieve the student performance data at the moment.",
        timestamp: new Date().toISOString()
      };
    }
  };

  const getAssignmentInfo = async () => {
    try {
      const assignmentsRef = collection(db, 'assignments');
      const querySnapshot = await getDocs(assignmentsRef);
      
      const assignments = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        type: 'bot',
        content: `Here are the recent assignments:\n\n${assignments.map(assignment => 
          `${assignment.title} - Due: ${assignment.dueDate}`
        ).join('\n')}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting assignment info:', error);
      return {
        type: 'bot',
        content: "Sorry, I couldn't retrieve the assignment information at the moment.",
        timestamp: new Date().toISOString()
      };
    }
  };

  const getQuizInfo = async () => {
    try {
      const quizzesRef = collection(db, 'quizzes');
      const querySnapshot = await getDocs(quizzesRef);
      
      const quizzes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        type: 'bot',
        content: `Here are the upcoming quizzes:\n\n${quizzes.map(quiz => 
          `${quiz.title} - Date: ${quiz.date}`
        ).join('\n')}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting quiz info:', error);
      return {
        type: 'bot',
        content: "Sorry, I couldn't retrieve the quiz information at the moment.",
        timestamp: new Date().toISOString()
      };
    }
  };

  const getClassStatistics = async () => {
    try {
      const classesRef = collection(db, 'classes');
      const querySnapshot = await getDocs(classesRef);
      
      const classes = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        type: 'bot',
        content: `Here are the class statistics:\n\n${classes.map(cls => 
          `${cls.name}: ${cls.averageAttendance || 0}% attendance, ${cls.averageGrade || 0}% average grade`
        ).join('\n')}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting class statistics:', error);
      return {
        type: 'bot',
        content: "Sorry, I couldn't retrieve the class statistics at the moment.",
        timestamp: new Date().toISOString()
      };
    }
  };

  const getStudentInfo = async () => {
    try {
      const studentsRef = collection(db, 'students');
      const querySnapshot = await getDocs(studentsRef);
      
      const students = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        type: 'bot',
        content: `Here's the student information:\n\n${students.map(student => 
          `${student.name} - Grade: ${student.grade}, Class: ${student.class}`
        ).join('\n')}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting student info:', error);
      return {
        type: 'bot',
        content: "Sorry, I couldn't retrieve the student information at the moment.",
        timestamp: new Date().toISOString()
      };
    }
  };

  const getScheduleInfo = async () => {
    try {
      const schedulesRef = collection(db, 'schedules');
      const querySnapshot = await getDocs(schedulesRef);
      
      const schedules = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return {
        type: 'bot',
        content: `Here's your schedule:\n\n${schedules.map(schedule => 
          `${schedule.day}: ${schedule.subjects.join(', ')}`
        ).join('\n')}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting schedule info:', error);
      return {
        type: 'bot',
        content: "Sorry, I couldn't retrieve the schedule information at the moment.",
        timestamp: new Date().toISOString()
      };
    }
  };

  const getMaterialInfo = async (query) => {
    try {
      const materialsRef = collection(db, 'materials');
      const q = query(materialsRef, where('keywords', 'array-contains-any', query.toLowerCase().split(' ')));
      const querySnapshot = await getDocs(q);
      
      const materials = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      if (materials.length === 0) {
        return {
          type: 'bot',
          content: "I couldn't find any materials matching your search. Try different keywords or check the materials section.",
          timestamp: new Date().toISOString()
        };
      }
      
      return {
        type: 'bot',
        content: `Here are the relevant materials:\n\n${materials.map(material => 
          `${material.title}\nSubject: ${material.subject}\nDescription: ${material.description}\nLink: ${material.link}`
        ).join('\n\n')}`,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error getting material info:', error);
      return {
        type: 'bot',
        content: "Sorry, I couldn't search for materials at the moment.",
        timestamp: new Date().toISOString()
      };
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    
    const userInput = input.trim();
    setInput('');
    await processMessage(userInput);
  };

  const handleSuggestionClick = (suggestion) => {
    setInput(suggestion);
  };

  const toggleSidebar = () => {
    setShowSidebar(!showSidebar);
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    
    setIsLoading(true);
    const response = await getMaterialInfo(searchQuery);
    setSearchResults(response.content.split('\n\n').filter(item => item.trim()));
    setIsLoading(false);
  };

  const handleClassClick = async (className) => {
    // Find the selected class from the classes array
    const selectedClass = classes.find(cls => cls.name === className);
    
    if (selectedClass) {
      // Get the students for this class
      const classStudents = selectedClass.students;
      setStudents(classStudents);
      
      // Create a message with student selection options
      const studentOptions = classStudents.map((student, index) => 
        `${index + 1}. ${student.name}`
      ).join('\n');
      
      const response = {
        type: 'bot',
        content: `Here are the students in ${className}. Please select a student by clicking on their name:\n\n${studentOptions}`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, response]);
      await saveMessage(response);
      
      // Set flags for selection state
      setWaitingForClassSelection(false);
      setWaitingForStudentSelection(true);
    } else {
      const response = {
        type: 'bot',
        content: `I couldn't find the class "${className}". Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, response]);
      await saveMessage(response);
    }
  };

  const handleStudentClick = async (studentName) => {
    // Find the selected student from the students array
    const selectedStudent = students.find(student => 
      student.name === studentName.split(' (')[0] // Remove the average part if present
    );
    
    if (selectedStudent) {
      // Instead of showing performance data, send a request for a report
      const response = {
        type: 'bot',
        content: `I've sent a request for a performance report for ${selectedStudent.name} in ${selectedStudent.class}.\n\n` +
                `The report will be generated and sent to you shortly. It will include:\n` +
                `- Academic performance\n` +
                `- Attendance records\n` +
                `- Assignment completion\n` +
                `- Participation metrics\n\n` +
                `You'll receive a notification when the report is ready.`,
        timestamp: new Date().toISOString()
      };
      
      setMessages(prev => [...prev, response]);
      await saveMessage(response);
      
      // Reset selection flags
      setWaitingForStudentSelection(false);
    } else {
      const response = {
        type: 'bot',
        content: `I couldn't find the student "${studentName}". Please try again.`,
        timestamp: new Date().toISOString()
      };
      setMessages(prev => [...prev, response]);
      await saveMessage(response);
    }
  };

  const handleBackToClasses = () => {
    setViewMode('classes');
    setSelectedStudent(null);
    setStudentPerformance(null);
  };

  const handleBackToStudents = () => {
    setViewMode('students');
    setSelectedStudent(null);
    setStudentPerformance(null);
  };

  const renderPerformanceView = () => {
    if (viewMode === 'classes') {
      return (
        <div className={styles.performancePanel}>
          <h3>Select a Class</h3>
          <div className={styles.classList}>
            {classes.length > 0 ? (
              classes.map(cls => (
                <div 
                  key={cls.id} 
                  className={styles.classCard}
                  onClick={() => handleClassClick(cls.name)}
                >
                  <h4>{cls.name}</h4>
                  <p>{cls.description || 'No description available'}</p>
                  <div className={styles.classStats}>
                    <span>Students: {cls.studentCount || 0}</span>
                    <span>Average: {cls.averageGrade || 'N/A'}%</span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.noData}>No classes available</div>
            )}
          </div>
        </div>
      );
    } else if (viewMode === 'students') {
      return (
        <div className={styles.performancePanel}>
          <div className={styles.panelHeader}>
            <h3>Select a Student</h3>
            <button className={styles.backButton} onClick={handleBackToClasses}>
              Back to Classes
            </button>
          </div>
          <div className={styles.studentList}>
            {students.length > 0 ? (
              students.map(student => (
                <div 
                  key={student.id} 
                  className={styles.studentCard}
                  onClick={() => handleStudentClick(student.name)}
                >
                  <div className={styles.studentHeader}>
                    <span className={styles.studentName}>{student.name}</span>
                    <span className={styles.studentAverage}>{student.average || 'N/A'}%</span>
                  </div>
                  <div className={styles.studentInfo}>
                    <span>ID: {student.id}</span>
                    <span>Grade: {student.grade || 'N/A'}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className={styles.noData}>No students in this class</div>
            )}
          </div>
        </div>
      );
    } else if (viewMode === 'performance' && studentPerformance) {
      const student = studentPerformance.student;
      const performance = studentPerformance.performance;
      const submissions = studentPerformance.submissions;
      
      return (
        <div className={styles.performancePanel}>
          <div className={styles.panelHeader}>
            <h3>Student Performance</h3>
            <button className={styles.backButton} onClick={handleBackToStudents}>
              Back to Students
            </button>
          </div>
          
          <div className={styles.studentProfile}>
            <h4>{student.name}</h4>
            <div className={styles.profileInfo}>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>ID:</span>
                <span className={styles.infoValue}>{student.id}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Grade:</span>
                <span className={styles.infoValue}>{student.grade || 'N/A'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Class:</span>
                <span className={styles.infoValue}>{student.class || 'N/A'}</span>
              </div>
              <div className={styles.infoItem}>
                <span className={styles.infoLabel}>Average:</span>
                <span className={styles.infoValue}>{student.average || 'N/A'}%</span>
              </div>
            </div>
          </div>
          
          <div className={styles.performanceDetails}>
            <h4>Subject Performance</h4>
            {performance.length > 0 ? (
              <div className={styles.subjectList}>
                {performance.map(subject => (
                  <div key={subject.id} className={styles.subjectCard}>
                    <div className={styles.subjectHeader}>
                      <span className={styles.subjectName}>{subject.subject}</span>
                      <span className={styles.subjectScore}>{subject.score}%</span>
                    </div>
                    <div className={styles.subjectDetails}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Attendance:</span>
                        <span className={styles.detailValue}>{subject.attendance || 'N/A'}%</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Participation:</span>
                        <span className={styles.detailValue}>{subject.participation || 'N/A'}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Last Updated:</span>
                        <span className={styles.detailValue}>{new Date(subject.lastUpdated).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noData}>No performance data available</div>
            )}
          </div>
          
          <div className={styles.assignmentDetails}>
            <h4>Assignment History</h4>
            {submissions.length > 0 ? (
              <div className={styles.assignmentList}>
                {submissions.map(submission => (
                  <div key={submission.id} className={styles.assignmentItem}>
                    <div className={styles.assignmentHeader}>
                      <span className={styles.assignmentTitle}>{submission.title}</span>
                      <span className={styles.assignmentScore}>{submission.score}%</span>
                    </div>
                    <div className={styles.assignmentDetails}>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Subject:</span>
                        <span className={styles.detailValue}>{submission.subject}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Submitted:</span>
                        <span className={styles.detailValue}>{new Date(submission.submittedAt).toLocaleDateString()}</span>
                      </div>
                      <div className={styles.detailItem}>
                        <span className={styles.detailLabel}>Feedback:</span>
                        <span className={styles.detailValue}>{submission.feedback || 'No feedback provided'}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className={styles.noData}>No assignment submissions found</div>
            )}
          </div>
        </div>
      );
    }
    
    return null;
  };

  return (
    <div className={styles.chatbotContainer}>
      <div className={styles.chatbotHeader}>
        <h2>AI Teaching Assistant</h2>
        <button className={styles.toggleButton} onClick={toggleSidebar}>
          {showSidebar ? 'Hide Options' : 'Show Options'}
        </button>
      </div>
      
      <div className={styles.chatbotContent}>
        {showSidebar && (
          <div className={styles.sidebar}>
            <div className={styles.tabs}>
              <button 
                className={`${styles.tabButton} ${activeTab === 'chat' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('chat')}
              >
                Chat
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'performance' ? styles.activeTab : ''}`}
                onClick={() => {
                  setActiveTab('performance');
                  setViewMode('classes');
                }}
              >
                Performance
              </button>
              <button 
                className={`${styles.tabButton} ${activeTab === 'materials' ? styles.activeTab : ''}`}
                onClick={() => setActiveTab('materials')}
              >
                Materials
              </button>
            </div>
            
            {activeTab === 'performance' && renderPerformanceView()}
            
            {activeTab === 'materials' && (
              <div className={styles.materialsPanel}>
                <h3>Learning Materials</h3>
                <form className={styles.searchForm} onSubmit={handleSearch}>
                  <input
                    type="text"
                    className={styles.searchInput}
                    placeholder="Search materials..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <button type="submit" className={styles.searchButton}>
                    Search
                  </button>
                </form>
                <div className={styles.searchResults}>
                  {searchResults.length > 0 ? (
                    <>
                      <h4>Search Results</h4>
                      <div className={styles.materialList}>
                        {searchResults.map((material, index) => (
                          <div key={index} className={styles.materialCard}>
                            <h5>{material.title}</h5>
                            <div className={styles.materialSubject}>{material.subject}</div>
                            <div className={styles.materialDescription}>{material.description}</div>
                            <a href={material.link} className={styles.materialLink} target="_blank" rel="noopener noreferrer">
                              View Material
                            </a>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className={styles.noData}>
                      {searchQuery ? 'No materials found' : 'Search for learning materials'}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
        
        <div className={styles.mainContent}>
          <div className={styles.messagesContainer}>
            {messages.map((message, index) => (
              <div
                key={message.id || `message-${index}`}
                className={`${styles.message} ${
                  (message.sender === 'user' || message.type === 'user') ? styles.userMessage : styles.botMessage
                }`}
              >
                {(message.text || message.content || '').split('\n').map((line, lineIndex) => {
                  // Check if this line is a class option
                  if (waitingForClassSelection && line.match(/^\d+\.\s+.+$/)) {
                    const className = line.split('. ')[1];
                    return (
                      <button
                        key={`class-${lineIndex}`}
                        className={styles.optionButton}
                        onClick={() => handleClassClick(className)}
                      >
                        {line}
                      </button>
                    );
                  }
                  // Check if this line is a student option
                  if (waitingForStudentSelection && line.match(/^\d+\.\s+.+$/)) {
                    const studentName = line.split('. ')[1];
                    return (
                      <button
                        key={`student-${lineIndex}`}
                        className={styles.optionButton}
                        onClick={() => handleStudentClick(studentName)}
                      >
                        {line}
                      </button>
                    );
                  }
                  return <p key={`line-${lineIndex}`}>{line}</p>;
                })}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
          
          <div className={styles.suggestionsContainer}>
            <button
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick('Show me student performance')}
            >
              Student Performance
            </button>
            <button
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick('Show me assignment information')}
            >
              Assignment Info
            </button>
            <button
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick('Show me quiz details')}
            >
              Quiz Details
            </button>
            <button
              className={styles.suggestionButton}
              onClick={() => handleSuggestionClick('Show me class statistics')}
            >
              Class Statistics
            </button>
          </div>
          
          <form className={styles.inputForm} onSubmit={handleSubmit}>
            <input
              type="text"
              className={styles.input}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                waitingForClassSelection 
                  ? "Select a class from the list above..." 
                  : waitingForStudentSelection 
                    ? "Select a student from the list above..." 
                    : "Type your message..."
              }
              disabled={isLoading || waitingForClassSelection || waitingForStudentSelection}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={isLoading || !input.trim() || waitingForClassSelection || waitingForStudentSelection}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
