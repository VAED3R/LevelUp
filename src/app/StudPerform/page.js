"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc, addDoc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/parentNavbar";
import styles from "./page.module.css";
import { Line, Pie } from "react-chartjs-2";
import ParentChatbot from '@/components/ParentChatbot';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
} from 'chart.js';

// Register ChartJS components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ArcElement
);

export default function StudentPerformance() {
  const [student, setStudent] = useState(null);
  const [performanceData, setPerformanceData] = useState({
    quizzes: [],
    assignments: [],
    tests: [],
    attendance: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performanceDescription, setPerformanceDescription] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const router = useRouter();

  // Format date from ISO string to local date string
  const formatDate = (dateString) => {
    if (!dateString) return '';
    
    try {
      // Check if the date is in ISO format
      if (dateString.includes('T')) {
        const date = new Date(dateString);
        return date.toLocaleDateString();
      } else {
        // Handle other date formats if needed
        return dateString;
      }
    } catch (error) {
      console.error("Error formatting date:", error);
      return '';
    }
  };

  // Fetch student data based on parent email
  useEffect(() => {
    const fetchStudentData = async (userEmail) => {
      setLoading(true);
      try {
        if (!userEmail) {
          setError("User email not found. Please log in again.");
          setLoading(false);
          return;
        }

        // Query the users collection to find the parent document
        const usersQuery = query(
          collection(db, "users"),
          where("email", "==", userEmail),
          where("role", "==", "parent")
        );
        
        const usersSnapshot = await getDocs(usersQuery);
        
        if (usersSnapshot.empty) {
          setError("Parent account not found. Please log in with a parent account.");
          setLoading(false);
          return;
        }

        const parentDoc = usersSnapshot.docs[0];
        const parentData = parentDoc.data();
        
        // Get the child's email from the parent document
        const childEmail = parentData.child;
        
        if (!childEmail) {
          setError("No child associated with this parent account.");
          setLoading(false);
          return;
        }

        // Query the users collection to find the student document
        const studentQuery = query(
          collection(db, "users"),
          where("email", "==", childEmail),
          where("role", "==", "student")
        );
        
        const studentSnapshot = await getDocs(studentQuery);
        
        if (studentSnapshot.empty) {
          setError("Student account not found.");
          setLoading(false);
          return;
        }

        const studentDoc = studentSnapshot.docs[0];
        const studentData = studentDoc.data();
        
        // Get the student document from the students collection
        const studentRef = doc(db, "students", studentDoc.id);
        const studentSnap = await getDoc(studentRef);
        
        if (!studentSnap.exists()) {
          setError("Student data not found in students collection.");
          setLoading(false);
          return;
        }

        const studentInfo = {
          id: studentDoc.id,
          ...studentData,
          ...studentSnap.data()
        };
        
        setStudent(studentInfo);
        
        // Fetch performance data for the student
        await fetchPerformanceData(studentDoc.id);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching student data:", error);
        setError("Failed to fetch student data");
        setLoading(false);
      }
    };

    // Set up auth state listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // User is signed in
        fetchStudentData(user.email);
      } else {
        // User is signed out
        setError("You must be logged in to view this page.");
        setLoading(false);
      }
    });

    // Clean up the listener when component unmounts
    return () => unsubscribe();
  }, []);

  // Fetch performance data for the student
  const fetchPerformanceData = async (studentId) => {
    try {
      // Fetch quizzes
      const quizzesQuery = query(
        collection(db, "quizzes"),
        where("studentId", "==", studentId)
      );
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizzes = quizzesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch assignments
      const assignmentsQuery = query(
        collection(db, "assignments"),
        where("studentId", "==", studentId)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      // Fetch test results from marks collection instead of testResults
      const testsQuery = query(
        collection(db, "marks"),
        where("studentId", "==", studentId)
      );
      const testsSnapshot = await getDocs(testsQuery);
      const tests = testsSnapshot.docs.map(doc => {
        const data = doc.data();
        // Calculate percentage based on obtained marks and total marks
        const percentage = data.totalMarks > 0 
          ? ((data.obtainedMarks / data.totalMarks) * 100).toFixed(2) 
          : 0;
        
        return {
          id: doc.id,
          ...data,
          percentage
        };
      });

      // Fetch attendance
      const attendanceQuery = query(
        collection(db, "attendance"),
        where("studentId", "==", studentId)
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      const attendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      setPerformanceData({
        quizzes,
        assignments,
        tests,
        attendance
      });
    } catch (error) {
      console.error("Error fetching performance data:", error);
      setError("Failed to fetch performance data");
    }
  };

  // Calculate performance metrics
  const calculateMetrics = () => {
    if (!student) return null;

    const { quizzes, assignments, tests, attendance } = performanceData;

    // Quiz performance
    const quizScores = quizzes.map(q => q.score || 0);
    const avgQuizScore = quizScores.length > 0 
      ? (quizScores.reduce((a, b) => a + b, 0) / quizScores.length).toFixed(2)
      : 0;

    // Assignment performance
    const assignmentScores = assignments.map(a => a.percentage || 0);
    const avgAssignmentScore = assignmentScores.length > 0
      ? (assignmentScores.reduce((a, b) => a + b, 0) / assignmentScores.length).toFixed(2)
      : 0;

    // Test performance
    const testScores = tests.map(t => t.percentage || 0);
    const avgTestScore = testScores.length > 0
      ? (testScores.reduce((a, b) => a + b, 0) / testScores.length).toFixed(2)
      : 0;

    // Attendance rate
    const totalAttendance = attendance.length;
    const presentDays = attendance.filter(a => a.status === "present").length;
    const attendanceRate = totalAttendance > 0
      ? ((presentDays / totalAttendance) * 100).toFixed(2)
      : 0;

    return {
      avgQuizScore,
      avgAssignmentScore,
      avgTestScore,
      attendanceRate,
      totalQuizzes: quizzes.length,
      totalAssignments: assignments.length,
      totalTests: tests.length,
      totalAttendance: totalAttendance
    };
  };

  // Generate performance description using DeepSeek API
  const generatePerformanceDescription = async () => {
    if (!student || !metrics) return;
    
    setGeneratingDescription(true);
    
    try {
      const prompt = `
        Generate a supportive and encouraging performance analysis for a parent about their child with the following data:
        
        Student Name: ${student.name}
        Class: ${student.class}
        Total Points: ${student.totalPoints || 0}
        
        Performance Metrics:
        - Quiz Performance: ${metrics.avgQuizScore}% (${metrics.totalQuizzes} quizzes)
        - Assignment Performance: ${metrics.avgAssignmentScore}% (${metrics.totalAssignments} assignments)
        - Test Performance: ${metrics.avgTestScore}% (${metrics.totalTests} tests)
        - Attendance Rate: ${metrics.attendanceRate}% (${metrics.totalAttendance} days)
        
        Please provide a gentle and supportive analysis of the student's performance, highlighting strengths and areas for improvement.
        Address the analysis to the parent, not the student.
        Focus on positive aspects and frame suggestions for improvement in an encouraging way.
        Avoid using harsh language, unnecessary symbols (like asterisks or hash symbols), or anything that might discourage the parent or student.
        Include specific, actionable recommendations for how the parent can support their child's improvement based on the data.
        The tone should be supportive and motivating, emphasizing that improvement is always possible.
        
        End the analysis with a warm, supportive statement that encourages the parent to continue supporting their child's efforts.
        Do not include any signature or "Warm regards" at the end.
      `;
      
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
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.7,
          max_tokens: 1000
        })
      });
      
      if (!response.ok) {
        throw new Error('Failed to generate performance description');
      }
      
      const data = await response.json();
      
      // Clean up any remaining asterisks or hash symbols
      let cleanedDescription = data.choices[0].message.content
        .replace(/\*/g, '')
        .replace(/#/g, '');
      
      // Format the description into paragraphs and points
      const formatDescription = (text) => {
        // Split by double newlines to separate paragraphs
        const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
        
        // Process each paragraph
        return paragraphs.map(paragraph => {
          // Check if paragraph contains bullet points or numbered lists
          if (paragraph.includes('•') || paragraph.includes('-') || paragraph.includes('*') || /^\d+\./.test(paragraph)) {
            // Split by bullet points or numbers
            const points = paragraph.split(/(?:•|-|\*|\d+\.)\s+/).filter(p => p.trim());
            
            // Return as a list
            return {
              type: 'list',
              items: points
            };
          } else {
            // Return as a paragraph
            return {
              type: 'paragraph',
              text: paragraph.trim()
            };
          }
        });
      };

      const formattedDescription = formatDescription(cleanedDescription);
      setPerformanceDescription(formattedDescription);
    } catch (error) {
      console.error('Error generating performance description:', error);
      setPerformanceDescription('Failed to generate performance description. Please try again later.');
    } finally {
      setGeneratingDescription(false);
    }
  };

  const sendPerformanceRequest = async () => {
    if (!student) return;
    
    setSendingRequest(true);
    try {
      const metrics = calculateMetrics();
      if (!metrics) {
        throw new Error("No performance metrics available");
      }

      const requestData = {
        studentId: student.id,
        studentName: student.name,
        studentEmail: student.email,
        timestamp: new Date().toISOString(),
        status: 'pending',
        metrics: {
          quizPerformance: metrics.avgQuizScore,
          assignmentPerformance: metrics.avgAssignmentScore,
          testPerformance: metrics.avgTestScore,
          attendanceRate: metrics.attendanceRate
        }
      };

      // Add the request to the performance_requests collection
      await addDoc(collection(db, "performance_requests"), requestData);
      
      alert("Performance analysis request sent to teacher successfully!");
    } catch (error) {
      console.error("Error sending performance request:", error);
      alert("Failed to send performance request. Please try again.");
    } finally {
      setSendingRequest(false);
    }
  };

  // Prepare chart data
  const prepareChartData = () => {
    if (!metrics) return null;
    
    // Performance comparison chart data
    const performanceChartData = {
      labels: ['Quizzes', 'Assignments', 'Tests', 'Attendance'],
      datasets: [
        {
          label: 'Performance (%)',
          data: [
            parseFloat(metrics.avgQuizScore),
            parseFloat(metrics.avgAssignmentScore),
            parseFloat(metrics.avgTestScore),
            parseFloat(metrics.attendanceRate)
          ],
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
    
    // Activity distribution pie chart data
    const activityData = {
      labels: ['Quizzes', 'Assignments', 'Tests', 'Attendance'],
      datasets: [
        {
          data: [
            metrics.totalQuizzes,
            metrics.totalAssignments,
            metrics.totalTests,
            metrics.totalAttendance
          ],
          backgroundColor: [
            'rgba(255, 99, 132, 0.5)',
            'rgba(54, 162, 235, 0.5)',
            'rgba(255, 206, 86, 0.5)',
            'rgba(75, 192, 192, 0.5)'
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)',
            'rgba(75, 192, 192, 1)'
          ],
          borderWidth: 1
        }
      ]
    };
    
    // Quiz performance over time
    const quizPerformanceData = {
      labels: [],
      datasets: [
        {
          label: 'Quiz Score (%)',
          data: [],
          fill: false,
          borderColor: 'rgba(255, 99, 132, 1)',
          tension: 0.1
        }
      ]
    };
    
    // Only add quiz data if we have quizzes
    if (performanceData.quizzes && performanceData.quizzes.length > 0) {
      // Sort quizzes by date
      const sortedQuizzes = [...performanceData.quizzes].sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
      });
      
      // Set labels and data
      quizPerformanceData.labels = sortedQuizzes.map(quiz => formatDate(quiz.date));
      quizPerformanceData.datasets[0].data = sortedQuizzes.map(quiz => quiz.score || 0);
    }
    
    // Test performance over time
    const testPerformanceData = {
      labels: [],
      datasets: [
        {
          label: 'Test Score (%)',
          data: [],
          fill: false,
          borderColor: 'rgba(255, 206, 86, 1)',
          tension: 0.1
        }
      ]
    };
    
    // Only add test data if we have tests
    if (performanceData.tests && performanceData.tests.length > 0) {
      // Sort tests by date
      const sortedTests = [...performanceData.tests].sort((a, b) => {
        const dateA = a.date ? new Date(a.date) : new Date(0);
        const dateB = b.date ? new Date(b.date) : new Date(0);
        return dateA - dateB;
      });
      
      // Set labels and data
      testPerformanceData.labels = sortedTests.map(test => formatDate(test.date));
      testPerformanceData.datasets[0].data = sortedTests.map(test => test.percentage || 0);
    }
    
    return {
      performanceData: performanceChartData,
      activityData,
      quizPerformanceData,
      testPerformanceData
    };
  };

  const metrics = calculateMetrics();
  const chartData = prepareChartData();

  // Add this new useEffect to listen for performance requests
  useEffect(() => {
    if (!student) return;

    const requestsRef = collection(db, "performance_requests");
    const q = query(requestsRef, where("studentId", "==", student.id));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // Get the most recent request
      const latestRequest = requests.sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
      )[0];

      if (latestRequest) {
        setRequestStatus(latestRequest.status);
        if (latestRequest.status === 'submitted') {
          setPerformanceDescription(latestRequest.summary);
        }
      } else {
        // No requests found, reset status
        setRequestStatus(null);
        setPerformanceDescription("");
      }
    });

    return () => unsubscribe();
  }, [student]);

  return (
    <div className={styles.container}>
      <Navbar />
      <ParentChatbot />
      <div className={styles.content}>
        <h1 className={styles.title}>Student Performance</h1>

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : error ? (
          <div className={styles.errorContainer}>
            <p className={styles.error}>{error}</p>
            <button 
              className={styles.backButton}
              onClick={() => router.push('/dashboard')}
            >
              Back to Dashboard
            </button>
          </div>
        ) : student && metrics ? (
          <div className={styles.performanceData}>
            {/* Student Info */}
            <div className={styles.studentInfo}>
              <h2>{student.name}</h2>
              <p>Class: {student.class}</p>
              <p>Total Points: {student.totalPoints || 0}</p>
            </div>

            {/* Performance Metrics */}
            <div className={styles.metrics}>
              <h2>Performance Metrics</h2>
              <div className={styles.metricGrid}>
                <div className={styles.metricCard}>
                  <h3>Quiz Performance</h3>
                  <p>Average Score: {metrics.avgQuizScore}%</p>
                  <p>Total Quizzes: {metrics.totalQuizzes}</p>
                </div>
                <div className={styles.metricCard}>
                  <h3>Assignment Performance</h3>
                  <p>Average Score: {metrics.avgAssignmentScore}%</p>
                  <p>Total Assignments: {metrics.totalAssignments}</p>
                </div>
                <div className={styles.metricCard}>
                  <h3>Test Performance</h3>
                  <p>Average Score: {metrics.avgTestScore}%</p>
                  <p>Total Tests: {metrics.totalTests}</p>
                </div>
                <div className={styles.metricCard}>
                  <h3>Attendance</h3>
                  <p>Attendance Rate: {metrics.attendanceRate}%</p>
                  <p>Total Days: {metrics.totalAttendance}</p>
                </div>
              </div>
            </div>

            {/* Visualizations */}
            <div className={styles.visualizations}>
              <h2>Performance Visualizations</h2>
              
              <div className={styles.chartContainer}>
                <div className={styles.chart}>
                  <h3>Performance Comparison</h3>
                  {chartData && (
                    <Line 
                      data={chartData.performanceData} 
                      options={{
                        responsive: true,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100
                          }
                        }
                      }}
                    />
                  )}
                </div>
                
                <div className={styles.chart}>
                  <h3>Activity Distribution</h3>
                  {chartData && (
                    <Pie 
                      data={chartData.activityData} 
                      options={{
                        responsive: true
                      }}
                    />
                  )}
                </div>
                
                <div className={styles.chart}>
                  <h3>Quiz Performance Over Time</h3>
                  {chartData && performanceData.quizzes.length > 0 && (
                    <Line 
                      data={chartData.quizPerformanceData} 
                      options={{
                        responsive: true,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100
                          }
                        }
                      }}
                    />
                  )}
                  {performanceData.quizzes.length === 0 && (
                    <p className={styles.noData}>No quiz data available</p>
                  )}
                </div>
                
                <div className={styles.chart}>
                  <h3>Test Performance Over Time</h3>
                  {chartData && performanceData.tests.length > 0 && (
                    <Line 
                      data={chartData.testPerformanceData} 
                      options={{
                        responsive: true,
                        scales: {
                          y: {
                            beginAtZero: true,
                            max: 100
                          }
                        }
                      }}
                    />
                  )}
                  {performanceData.tests.length === 0 && (
                    <p className={styles.noData}>No test data available</p>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Analysis */}
            <div className={styles.performanceAnalysis}>
              {!requestStatus && (
                
                <button 
                  className={styles.sendRequestButton}
                  onClick={sendPerformanceRequest}
                  disabled={sendingRequest}
                >
                  {sendingRequest ? "Sending Request..." : "Send Request to Teacher"}
                </button>
              )}
              
              {requestStatus === 'pending' && (
                <div className={styles.requestStatus}>
                  <p>Request sent to teacher. Waiting for response...</p>
                </div>
              )}
              
              {requestStatus === 'generated' && (
                <div className={styles.requestStatus}>
                  <p>Teacher has generated the summary. Waiting for submission...</p>
                </div>
              )}
              
              {requestStatus === 'submitted' && performanceDescription && (
                <>
                  <div className={styles.description}>
                  <h2>Performance Analysis</h2>
                    <h3>Teacher's Analysis</h3>
                    <pre>{performanceDescription}</pre>
                    <button 
                    className={styles.sendRequestButton}
                    onClick={sendPerformanceRequest}
                    disabled={sendingRequest}
                  >
                    {sendingRequest ? "Sending Request..." : "Request New Analysis"}
                  </button>
                  </div>

                </>
              )}
            </div>

            {/* Detailed Performance Data */}
            <div className={styles.detailedData}>
              <h2>Detailed Performance</h2>
              
              {/* Quizzes */}
              <div className={styles.dataSection}>
                <h3>Quizzes</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Score</th>
                      <th>Total Questions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.quizzes.map(quiz => (
                      <tr key={quiz.id}>
                        <td>{formatDate(quiz.date)}</td>
                        <td>{quiz.subject}</td>
                        <td>{quiz.score}%</td>
                        <td>{quiz.totalQuestions}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Assignments */}
              <div className={styles.dataSection}>
                <h3>Assignments</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Title</th>
                      <th>Score</th>
                      <th>Total Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.assignments.map(assignment => (
                      <tr key={assignment.id}>
                        <td>{formatDate(assignment.addedAt)}</td>
                        <td>{assignment.subject}</td>
                        <td>{assignment.assignmentTitle}</td>
                        <td>{assignment.obtainedMarks}</td>
                        <td>{assignment.totalMarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Tests */}
              <div className={styles.dataSection}>
                <h3>Tests</h3>
                {performanceData.tests.length > 0 ? (
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Subject</th>
                        <th>Score</th>
                        <th>Total Marks</th>
                        <th>Percentage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData.tests.map(test => (
                        <tr key={test.id}>
                          <td>{test.subject}</td>
                          <td>{test.obtainedMarks}</td>
                          <td>{test.totalMarks}</td>
                          <td>{test.percentage}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className={styles.noData}>No test data available</p>
                )}
              </div>

              {/* Attendance */}
              <div className={styles.dataSection}>
                <h3>Attendance</h3>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Subject</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.attendance.map(record => (
                      <tr key={record.id}>
                        <td>{formatDate(record.addedAt)}</td>
                        <td>{record.status}</td>
                        <td>{record.subject}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <p className={styles.noSelection}>No student data available</p>
        )}
      </div>
    </div>
  );
}
