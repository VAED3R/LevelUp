"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/parentNavbar";
import styles from "./page.module.css";
import { Line, Pie } from "react-chartjs-2";
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
  const router = useRouter();

  // Format date from ISO string to local date string
  const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    
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
      return "Invalid Date";
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

      // Fetch test results
      const testsQuery = query(
        collection(db, "testResults"),
        where("studentId", "==", studentId)
      );
      const testsSnapshot = await getDocs(testsQuery);
      const tests = testsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

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
      
      setPerformanceDescription(cleanedDescription);
    } catch (error) {
      console.error('Error generating performance description:', error);
      setPerformanceDescription('Failed to generate performance description. Please try again later.');
    } finally {
      setGeneratingDescription(false);
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
    
    return {
      performanceData: performanceChartData,
      activityData,
      quizPerformanceData
    };
  };

  const metrics = calculateMetrics();
  const chartData = prepareChartData();

  return (
    <div className={styles.container}>
      <Navbar />
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
              <p>Email: {student.email}</p>
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
              </div>
            </div>

            {/* Performance Description */}
            <div className={styles.performanceDescription}>
              <h2>Performance Analysis</h2>
              <button 
                className={styles.generateButton}
                onClick={generatePerformanceDescription}
                disabled={generatingDescription}
              >
                {generatingDescription ? 'Generating...' : 'Generate Performance Analysis'}
              </button>
              
              {performanceDescription && (
                <div className={styles.description}>
                  <p>{performanceDescription}</p>
                </div>
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
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Subject</th>
                      <th>Score</th>
                      <th>Total Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.tests.map(test => (
                      <tr key={test.id}>
                        <td>{formatDate(test.date)}</td>
                        <td>{test.subject}</td>
                        <td>{test.obtainedMarks}</td>
                        <td>{test.totalMarks}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
