"use client";

import { useState, useEffect } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc, addDoc, onSnapshot } from "firebase/firestore";
import { useRouter } from "next/navigation";
import ReactMarkdown from 'react-markdown';
import Navbar from "@/components/parentNavbar";
import styles from "./page.module.css";
import { Line, Pie } from "react-chartjs-2";
import ParentChatbot from '@/components/ParentChatbot';
import { useAuth } from "@/context/AuthContext";
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
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [performanceDescription, setPerformanceDescription] = useState("");
  const [generatingDescription, setGeneratingDescription] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const [requestStatus, setRequestStatus] = useState(null);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

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

    // Only fetch data when user is available and auth is not loading
    if (user && !authLoading) {
      fetchStudentData(user.email);
    }
  }, [user?.uid, authLoading]);

  // Fetch performance data for the student using the same approach as personalized learning
  const fetchPerformanceData = async (studentId) => {
    try {
      // Fetch comprehensive student data using the same API route as personalized learning
      const studentResponse = await fetch(`/api/student-data?studentId=${studentId}`);
      
      if (studentResponse.ok) {
        const responseData = await studentResponse.json();
        setStudentData(responseData);
        
        // Extract data from the student-data API response
        const quizzes = responseData.data?.quizzes || [];
        const assignments = responseData.data?.assignments || [];
        const tests = responseData.data?.testResults || [];
        const attendance = responseData.data?.attendance || [];

        setPerformanceData({
          quizzes,
          assignments,
          tests,
          attendance
        });
      } else {
        console.error('Failed to fetch student data:', studentResponse.status);
        setError("Failed to fetch student data");
      }
    } catch (error) {
      console.error("Error fetching performance data:", error);
      setError("Failed to fetch performance data");
    }
  };

  // Calculate performance metrics using the same approach as personalized learning
  const calculateMetrics = () => {
    if (!student || !studentData) return null;

    const { quizzes, assignments, tests, attendance } = performanceData;

    // Quiz performance - using analytics from student-data API (same as personalized learning)
    const avgQuizScore = studentData?.data?.analytics?.academic?.quizAverage || 0;

    // Assignment performance - using analytics from student-data API
    const avgAssignmentScore = studentData?.data?.analytics?.academic?.assignmentAverage || 0;

    // Test performance - using analytics from student-data API
    const avgTestScore = studentData?.data?.testAverage || 0;

    // Attendance rate - using analytics from student-data API with fallback
    let attendanceRate = studentData?.data?.attendanceRate || 0;
    const totalAttendance = attendance.length;
    
    // Fallback calculation if API doesn't provide attendance rate
    if (!attendanceRate && totalAttendance > 0) {
      const presentDays = attendance.filter(a => a.status === "present").length;
      attendanceRate = ((presentDays / totalAttendance) * 100).toFixed(2);
    }



    return {
      avgQuizScore: avgQuizScore.toFixed(2),
      avgAssignmentScore: avgAssignmentScore.toFixed(2),
      avgTestScore: avgTestScore.toFixed(2),
      attendanceRate,
      totalQuizzes: studentData?.data?.analytics?.academic?.totalQuizzes || 0,
      totalAssignments: studentData?.data?.analytics?.academic?.totalAssignments || 0,
      totalTests: studentData?.data?.analytics?.academic?.totalTests || 0,
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
      // Sort quizzes by date (using completedAt from student-data API)
      const sortedQuizzes = [...performanceData.quizzes].sort((a, b) => {
        const dateA = a.completedAt ? new Date(a.completedAt) : new Date(0);
        const dateB = b.completedAt ? new Date(b.completedAt) : new Date(0);
        return dateA - dateB;
      });
      
      // Set labels and data
      quizPerformanceData.labels = sortedQuizzes.map(quiz => formatDate(quiz.completedAt));
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

  // Recalculate metrics when studentData changes
  useEffect(() => {
    if (studentData && student) {
      // This will trigger a re-render with updated metrics
    }
  }, [studentData, student]);

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
        {/* Welcome Section */}
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeCard}>
            <div className={styles.welcomeIcon}>📊</div>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>Student Performance Dashboard</h1>
              <p className={styles.welcomeSubtitle}>Comprehensive analysis of academic progress</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingSection}>
            <div className={styles.loadingCard}>
              <div className={styles.loadingSpinner}></div>
              <h3>Loading Performance Data...</h3>
              <p>Please wait while we fetch your child's academic information</p>
            </div>
          </div>
        ) : error ? (
          <div className={styles.errorSection}>
            <div className={styles.errorCard}>
              <div className={styles.errorIcon}>❌</div>
              <h3>Error Loading Data</h3>
              <p>{error}</p>
              <button 
                className={styles.backButton}
                onClick={() => router.push('/dashboard')}
              >
                Back to Dashboard
              </button>
            </div>
          </div>
        ) : student && metrics ? (
          <div className={styles.dashboardContent}>
            {/* Student Info Card */}
            <div className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Student Information</h2>
                <p className={styles.sectionSubtitle}>Personal and academic details</p>
              </div>
              <div className={styles.infoCard}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}>👤</div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Student Name</span>
                      <span className={styles.infoValue}>{student.name}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}>🎓</div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Class</span>
                      <span className={styles.infoValue}>{student.class}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}>⭐</div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Total Points</span>
                      <span className={styles.infoValue}>{student.totalPoints || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Metrics */}
            <div className={styles.metricsSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Performance Metrics</h2>
                <p className={styles.sectionSubtitle}>Key academic indicators</p>
              </div>
              <div className={styles.metricsGrid}>
                <div className={styles.metricCard}>
                  <div className={styles.metricIcon}>📚</div>
                  <div className={styles.metricContent}>
                    <h3>Assignment Performance</h3>
                    <div className={styles.metricValue}>{metrics.avgAssignmentScore}%</div>
                    <p>Average Score</p>
                    <div className={styles.metricDetail}>Total Assignments: {metrics.totalAssignments}</div>
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricIcon}>📋</div>
                  <div className={styles.metricContent}>
                    <h3>Test Performance</h3>
                    <div className={styles.metricValue}>{metrics.avgTestScore}%</div>
                    <p>Average Score</p>
                    <div className={styles.metricDetail}>Total Tests: {metrics.totalTests}</div>
                  </div>
                </div>
                <div className={styles.metricCard}>
                  <div className={styles.metricIcon}>📅</div>
                  <div className={styles.metricContent}>
                    <h3>Attendance</h3>
                    <div className={styles.metricValue}>{metrics.attendanceRate}%</div>
                    <p>Attendance Rate</p>
                    <div className={styles.metricDetail}>Total Days: {metrics.totalAttendance}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Visualizations */}
            <div className={styles.visualizationsSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Performance Visualizations</h2>
                <p className={styles.sectionSubtitle}>Interactive charts and graphs</p>
              </div>
              <div className={styles.chartsGrid}>
                <div className={styles.chartCard}>
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
                
                <div className={styles.chartCard}>
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
                
                <div className={styles.chartCard}>
                  <h3>Quiz Performance Over Time</h3>
                  {chartData && performanceData.quizzes.length > 0 ? (
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
                  ) : (
                    <div className={styles.noDataCard}>
                      <div className={styles.noDataIcon}>📊</div>
                      <p>No quiz data available</p>
                    </div>
                  )}
                </div>
                
                <div className={styles.chartCard}>
                  <h3>Test Performance Over Time</h3>
                  {chartData && performanceData.tests.length > 0 ? (
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
                  ) : (
                    <div className={styles.noDataCard}>
                      <div className={styles.noDataIcon}>📊</div>
                      <p>No test data available</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Performance Analysis */}
            <div className={styles.analysisSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Performance Analysis</h2>
                <p className={styles.sectionSubtitle}>Teacher insights and recommendations</p>
              </div>
              <div className={styles.analysisCard}>
                {!requestStatus && (
                  <div className={styles.requestSection}>
                    <div className={styles.requestIcon}>📤</div>
                    <h3>Request Teacher Analysis</h3>
                    <p>Get personalized feedback and recommendations from your child's teachers</p>
                    <button 
                      className={styles.sendRequestButton}
                      onClick={sendPerformanceRequest}
                      disabled={sendingRequest}
                    >
                      {sendingRequest ? "Sending Request..." : "Send Request to Teacher"}
                    </button>
                  </div>
                )}
                
                {requestStatus === 'pending' && (
                  <div className={styles.statusCard}>
                    <div className={styles.statusIcon}>⏳</div>
                    <h3>Request Pending</h3>
                    <p>Request sent to teacher. Waiting for response...</p>
                  </div>
                )}
                
                {requestStatus === 'generated' && (
                  <div className={styles.statusCard}>
                    <div className={styles.statusIcon}>✅</div>
                    <h3>Analysis Generated</h3>
                    <p>Teacher has generated the summary. Waiting for submission...</p>
                  </div>
                )}
                
                {requestStatus === 'submitted' && performanceDescription && (
                  <div className={styles.descriptionCard}>
                    <div className={styles.descriptionHeader}>
                      <div className={styles.descriptionIcon}>📋</div>
                      <h3>Teacher's Analysis</h3>
                    </div>
                    <div className={styles.descriptionContent}>
                      <div className={styles.summaryMarkdown}>
                        <ReactMarkdown>
                          {performanceDescription}
                        </ReactMarkdown>
                      </div>
                    </div>
                    <button 
                      className={styles.sendRequestButton}
                      onClick={sendPerformanceRequest}
                      disabled={sendingRequest}
                    >
                      {sendingRequest ? "Sending Request..." : "Request New Analysis"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Detailed Performance Data */}
            <div className={styles.detailedSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Detailed Performance</h2>
                <p className={styles.sectionSubtitle}>Comprehensive breakdown of all assessments</p>
              </div>
              
              {/* Quizzes */}
              <div className={styles.dataCard}>
                <div className={styles.dataHeader}>
                  <div className={styles.dataIcon}>📝</div>
                  <h3>Quizzes</h3>
                </div>
                <div className={styles.tableContainer}>
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
                      {performanceData.quizzes.map((quiz, index) => (
                        <tr key={quiz.id || `quiz-${index}`}>
                          <td>{formatDate(quiz.completedAt)}</td>
                          <td>{quiz.subject}</td>
                          <td>{quiz.score}%</td>
                          <td>{quiz.totalQuestions}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Assignments */}
              <div className={styles.dataCard}>
                <div className={styles.dataHeader}>
                  <div className={styles.dataIcon}>📚</div>
                  <h3>Assignments</h3>
                </div>
                <div className={styles.tableContainer}>
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
                      {performanceData.assignments.map((assignment, index) => (
                        <tr key={assignment.id || `assignment-${index}`}>
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
              </div>

              {/* Tests */}
              <div className={styles.dataCard}>
                <div className={styles.dataHeader}>
                  <div className={styles.dataIcon}>📋</div>
                  <h3>Tests</h3>
                </div>
                <div className={styles.tableContainer}>
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
                        {performanceData.tests.map((test, index) => (
                          <tr key={test.id || `test-${index}`}>
                            <td>{test.subject}</td>
                            <td>{test.obtainedMarks}</td>
                            <td>{test.totalMarks}</td>
                            <td>{test.percentage}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className={styles.noDataCard}>
                      <div className={styles.noDataIcon}>📊</div>
                      <p>No test data available</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Attendance */}
              <div className={styles.dataCard}>
                <div className={styles.dataHeader}>
                  <div className={styles.dataIcon}>📅</div>
                  <h3>Attendance</h3>
                </div>
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Status</th>
                        <th>Subject</th>
                      </tr>
                    </thead>
                    <tbody>
                      {performanceData.attendance.map((record, index) => (
                        <tr key={record.id || `attendance-${index}`}>
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
          </div>
        ) : (
          <div className={styles.noDataSection}>
            <div className={styles.noDataCard}>
              <div className={styles.noDataIcon}>📊</div>
              <h3>No Data Available</h3>
              <p>No student data available for performance analysis</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
