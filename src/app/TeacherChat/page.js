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
      const classesRef = collection(db, 'classes');
      const querySnapshot = await getDocs(classesRef);
      
      const classesData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setClasses(classesData);
    } catch (error) {
      console.error('Error loading classes:', error);
    }
  };

  const loadStudents = async (classId) => {
    try {
      const studentsRef = collection(db, 'students');
      const q = query(studentsRef, where('classId', '==', classId));
      const querySnapshot = await getDocs(q);
      
      const studentsData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      setStudents(studentsData);
      setViewMode('students');
    } catch (error) {
      console.error('Error loading students:', error);
    }
  };

  const loadStudentPerformance = async (studentId) => {
    try {
      setIsLoading(true);
      
      // Get student details
      const studentDoc = await getDoc(doc(db, 'students', studentId));
      const studentData = studentDoc.data();
      
      // Get performance data
      const performanceRef = collection(db, 'performance');
      const q = query(performanceRef, where('studentId', '==', studentId));
      const querySnapshot = await getDocs(q);
      
      const performanceData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get assignments
      const assignmentsRef = collection(db, 'assignments');
      const assignmentsQuery = query(assignmentsRef, where('classId', '==', studentData.classId));
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      
      const assignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get student's assignment submissions
      const submissionsRef = collection(db, 'submissions');
      const submissionsQuery = query(submissionsRef, where('studentId', '==', studentId));
      const submissionsSnapshot = await getDocs(submissionsQuery);
      
      const submissions = submissionsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Combine all data
      const detailedPerformance = {
        student: studentData,
        performance: performanceData,
        assignments: assignments,
        submissions: submissions
      };
      
      setStudentPerformance(detailedPerformance);
      setSelectedStudent(studentId);
      setViewMode('performance');
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading student performance:', error);
      setIsLoading(false);
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
      // Reset view mode to show classes
      setViewMode('classes');
      response = {
        type: 'bot',
        content: "I'll show you the student performance. Please select a class from the sidebar to view students.",
        timestamp: new Date().toISOString()
      };
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
        content: "I can help you with:\n- Student performance\n- Assignment information\n- Quiz details\n- Class statistics\n- Student information\n- Schedule details\n- Search learning materials\n\nWhat would you like to know?",
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

  const handleClassClick = (classId) => {
    loadStudents(classId);
  };

  const handleStudentClick = (studentId) => {
    loadStudentPerformance(studentId);
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
                  onClick={() => handleClassClick(cls.id)}
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
                  onClick={() => handleStudentClick(student.id)}
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
                key={index}
                className={`${styles.message} ${
                  message.type === 'user' ? styles.userMessage : styles.botMessage
                }`}
              >
                <div className={styles.messageContent}>
                  {message.content.split('\n').map((line, i) => (
                    <p key={i}>{line}</p>
                  ))}
                </div>
                <div className={styles.messageTimestamp}>
                  {new Date(message.timestamp).toLocaleTimeString()}
                </div>
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
              placeholder="Type your message..."
              disabled={isLoading}
            />
            <button
              type="submit"
              className={styles.sendButton}
              disabled={isLoading || !input.trim()}
            >
              Send
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
