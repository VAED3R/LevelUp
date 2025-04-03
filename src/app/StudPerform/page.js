"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, getDoc, doc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/parentNavbar";
import styles from "./page.module.css";

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
  const router = useRouter();

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
    const assignmentScores = assignments.map(a => a.score || 0);
    const avgAssignmentScore = assignmentScores.length > 0
      ? (assignmentScores.reduce((a, b) => a + b, 0) / assignmentScores.length).toFixed(2)
      : 0;

    // Test performance
    const testScores = tests.map(t => t.score || 0);
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

  const metrics = calculateMetrics();

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
                        <td>{new Date(quiz.date).toLocaleDateString()}</td>
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
                      <th>Score</th>
                      <th>Total Marks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {performanceData.assignments.map(assignment => (
                      <tr key={assignment.id}>
                        <td>{new Date(assignment.date).toLocaleDateString()}</td>
                        <td>{assignment.subject}</td>
                        <td>{assignment.score}</td>
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
                        <td>{new Date(test.date).toLocaleDateString()}</td>
                        <td>{test.subject}</td>
                        <td>{test.score}</td>
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
                        <td>{new Date(record.date).toLocaleDateString()}</td>
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
