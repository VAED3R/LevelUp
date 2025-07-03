"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot, deleteDoc, addDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/teacherNavbar";
import TeacherChatbot from "@/components/TeacherChatbot";
import styles from "./page.module.css";

export default function TeacherChat() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [generatingSummary, setGeneratingSummary] = useState({});
  const [submitting, setSubmitting] = useState({});
  const [deleting, setDeleting] = useState({});
  const [editedSummaries, setEditedSummaries] = useState({});
  const [teacherName, setTeacherName] = useState("");
  const [teacherEmail, setTeacherEmail] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Subscribe to performance requests
        const requestsRef = collection(db, "performance_requests");
        const unsubscribeRequests = onSnapshot(requestsRef, (snapshot) => {
          const requestsData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
          setRequests(requestsData);
          
          // Initialize edited summaries with the current summaries
          const newEditedSummaries = {};
          requestsData.forEach(request => {
            if (request.summary) {
              newEditedSummaries[request.id] = request.summary;
            }
          });
          setEditedSummaries(prev => ({...prev, ...newEditedSummaries}));
          
          setLoading(false);
        });

        return () => unsubscribeRequests();
      } else {
        setError("Please log in to view requests");
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const fetchTeacherData = async () => {
      if (!teacherEmail) return;

      try {
        const usersRef = collection(db, "users");
        const querySnapshot = await getDocs(usersRef);
        const teacher = querySnapshot.docs.find(
          (doc) => doc.data().email === teacherEmail
        )?.data();

        if (teacher) {
          setTeacherName(teacher.name);
        }
      } catch (error) {
        console.error("Error fetching teacher data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTeacherData();
  }, [teacherEmail]);

  const generateSummary = async (requestId) => {
    setGeneratingSummary(prev => ({ ...prev, [requestId]: true }));
    try {
      const request = requests.find(r => r.id === requestId);
      if (!request) return;

      // Fetch actual data from database using API routes like learning profiles
      const studentId = request.studentId;
      let summary = `Performance Analysis for ${request.studentName}:\n\n`;

      // Fetch student data using the same API route as learning profiles
      const studentResponse = await fetch(`/api/student-data?studentId=${studentId}`);
      let studentData = null;
      if (studentResponse.ok) {
        const responseData = await studentResponse.json();
        studentData = responseData.data;
      }

      // Fetch assignments data
      const assignments = studentData?.assignments || [];

      // Fetch test results data from marks collection (like student-data API)
      const marksQuery = query(
        collection(db, "marks"),
        where("studentId", "==", studentId)
      );
      const marksSnapshot = await getDocs(marksQuery);
      const allMarks = marksSnapshot.docs.map(doc => doc.data());
      
      // Filter for test results (exclude assignments)
      const testResults = allMarks.filter(mark => {
        return mark.subject && mark.semester && !mark.assignmentId && mark.obtainedMarks !== undefined;
      });

      // Fetch quiz data from quizResults collection (primary source)
      const quizResultsQuery = query(
        collection(db, "quizResults"),
        where("studentId", "==", studentId)
      );
      const quizResultsSnapshot = await getDocs(quizResultsQuery);
      let quizzes = quizResultsSnapshot.docs.map(doc => {
        const quizData = doc.data();
        return {
          id: doc.id,
          score: quizData.score || 0,
          subject: quizData.subject || 'Unknown',
          topic: quizData.subject || 'Quiz',
          completedAt: quizData.completedAt,
          totalQuestions: quizData.totalQuestions || 0,
          points: quizData.score || 0, // Use score as points
          rawData: quizData
        };
      });

      // Also fetch quiz data from students collection as backup
      const studentsQuery = query(
        collection(db, "students"),
        where("id", "==", studentId)
      );
      const studentsSnapshot = await getDocs(studentsQuery);
      
      if (!studentsSnapshot.empty) {
        const studentDocData = studentsSnapshot.docs[0].data();
        
        // Combine points and fallPoints arrays
        const allPoints = [
          ...(studentDocData.points || []),
          ...(studentDocData.fallPoints || [])
        ];
        
        // Filter for actual quizzes (not attendance, assignments, or assessments)
        const studentQuizzes = allPoints.filter(point => {
          if (point.quizId === 'attendance') return false;
          if (point.type === 'assignment' || point.type === 'assessment') return false;
          if (point.subject === 'unknown' || point.subject === 'Unknown') return false;
          return point.subject && point.subject !== 'unknown' && point.subject !== 'Unknown';
        }).map(quiz => {
          // Calculate score percentage based on points and total questions
          let score = 0;
          if (quiz.points && quiz.totalQuestions) {
            score = Math.round((quiz.points / quiz.totalQuestions) * 100);
          } else if (quiz.score) {
            score = quiz.score;
          } else if (quiz.points) {
            // If only points available, assume it's a percentage
            score = quiz.points;
          }
          
          return {
            id: quiz.quizId,
            score: score,
            subject: quiz.subject,
            topic: quiz.topic || 'Quiz',
            completedAt: quiz.date,
            totalQuestions: quiz.totalQuestions || 0,
            points: quiz.points || 0,
            rawData: quiz
          };
        });

        // Combine both sources, avoiding duplicates
        const existingQuizIds = new Set(quizzes.map(q => q.id));
        const uniqueStudentQuizzes = studentQuizzes.filter(quiz => !existingQuizIds.has(quiz.id));
        quizzes = [...quizzes, ...uniqueStudentQuizzes];
      }

      // Calculate assignment performance
      let assignmentPerformance = 0;
      let assignmentCount = 0;
      if (assignments.length > 0) {
        const totalPercentage = assignments.reduce((sum, assignment) => {
          if (assignment.obtainedMarks && assignment.totalMarks) {
            assignmentCount++;
            return sum + assignment.percentage;
          }
          return sum;
        }, 0);
        assignmentPerformance = assignmentCount > 0 ? Math.round(totalPercentage / assignmentCount) : 0;
      }

      // Calculate test performance
      let testPerformance = 0;
      let testCount = 0;
      if (testResults.length > 0) {
        const totalPercentage = testResults.reduce((sum, test) => {
          if (test.obtainedMarks && test.totalMarks) {
            testCount++;
            // Use the percentage field if available, otherwise calculate it
            const percentage = test.percentage || Math.round((test.obtainedMarks / test.totalMarks) * 100);
            return sum + percentage;
          }
          return sum;
        }, 0);
        testPerformance = testCount > 0 ? Math.round(totalPercentage / testCount) : 0;
      }

      // Calculate quiz performance from actual quiz data
      let quizPerformance = 0;
      let quizCount = 0;
      if (quizzes.length > 0) {
        console.log('Quiz data for debugging:', quizzes); // Debug log
        const totalQuizScore = quizzes.reduce((sum, quiz) => {
          if (quiz.score !== undefined && quiz.score !== null && quiz.score > 0) {
            quizCount++;
            return sum + quiz.score;
          }
          return sum;
        }, 0);
        quizPerformance = quizCount > 0 ? Math.round(totalQuizScore / quizCount) : 0;
      }

      // Generate detailed summary
      summary += `📊 PERFORMANCE OVERVIEW:\n`;
      summary += `Assignment Performance: ${assignmentPerformance}% (${assignmentCount} assignments)\n`;
      summary += `Test Performance: ${testPerformance}% (${testCount} tests)\n`;
      summary += `Quiz Performance: ${quizPerformance}% (from analytics)\n\n`;

      // Assignment Analysis
      summary += `📝 ASSIGNMENT ANALYSIS:\n`;
      if (assignments.length > 0) {
        if (assignmentPerformance >= 80) {
          summary += "✅ Excellent assignment performance. Very consistent and high-quality work.\n";
        } else if (assignmentPerformance >= 60) {
          summary += "⚠️ Good assignment performance with room for improvement.\n";
        } else {
          summary += "❌ Assignment performance needs significant improvement.\n";
        }

        // Show recent assignments
        const recentAssignments = assignments
          .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
          .slice(0, 3);
        
        summary += `\nRecent Assignments:\n`;
        recentAssignments.forEach(assignment => {
          summary += `• ${assignment.assignmentTitle}: ${assignment.percentage}% (${assignment.obtainedMarks}/${assignment.totalMarks})\n`;
        });
      } else {
        summary += "No assignment data available.\n";
      }

      // Test Analysis
      summary += `\n📋 TEST ANALYSIS:\n`;
      if (testResults.length > 0) {
        if (testPerformance >= 80) {
          summary += "✅ Outstanding test performance. Excellent understanding of material.\n";
        } else if (testPerformance >= 60) {
          summary += "⚠️ Adequate test performance. Consider additional study time.\n";
        } else {
          summary += "❌ Test performance needs significant improvement. Recommend extra tutoring.\n";
        }

        // Show recent tests
        const recentTests = testResults
          .sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt))
          .slice(0, 3);
        
        summary += `\nRecent Tests:\n`;
        recentTests.forEach(test => {
          // Use the percentage field if available, otherwise calculate it
          const percentage = test.percentage || Math.round((test.obtainedMarks / test.totalMarks) * 100);
          summary += `• ${test.subject}: ${percentage}% (${test.obtainedMarks}/${test.totalMarks})\n`;
        });
      } else {
        summary += "No test data available.\n";
      }

      // Quiz Analysis
      summary += `\n🎯 QUIZ ANALYSIS:\n`;
      if (quizzes.length > 0) {
        if (quizPerformance >= 80) {
          summary += "✅ Excellent quiz performance. Strong grasp of concepts.\n";
        } else if (quizPerformance >= 60) {
          summary += "⚠️ Good quiz performance. Continue practicing regularly.\n";
        } else {
          summary += "❌ Quiz performance needs improvement. Focus on regular practice.\n";
        }
      } else {
        summary += "No quiz data available.\n";
      }

      // Overall Assessment
      summary += `\n📈 OVERALL ASSESSMENT:\n`;
      const overallAverage = [assignmentPerformance, testPerformance, quizPerformance]
        .filter(score => score > 0)
        .reduce((sum, score) => sum + score, 0) / 
        [assignmentPerformance, testPerformance, quizPerformance].filter(score => score > 0).length;

      if (overallAverage >= 80) {
        summary += "🌟 EXCELLENT: Student is performing exceptionally well across all areas.\n";
        summary += "Recommendation: Continue current study habits and consider advanced challenges.\n";
      } else if (overallAverage >= 60) {
        summary += "👍 GOOD: Student is performing well with some areas for improvement.\n";
        summary += "Recommendation: Focus on weaker areas while maintaining current strengths.\n";
      } else {
        summary += "⚠️ NEEDS IMPROVEMENT: Student requires additional support and guidance.\n";
        summary += "Recommendation: Implement targeted intervention strategies and regular monitoring.\n";
      }

      // Update the request with the generated summary
      const requestRef = doc(db, "performance_requests", requestId);
      await updateDoc(requestRef, {
        summary,
        status: 'generated',
        generatedAt: new Date().toISOString(),
        metrics: {
          assignmentPerformance,
          testPerformance,
          quizPerformance,
          overallAverage: Math.round(overallAverage)
        }
      });
      
      // Also update the edited summary state
      setEditedSummaries(prev => ({
        ...prev,
        [requestId]: summary
      }));

    } catch (error) {
      console.error("Error generating summary:", error);
      alert("Failed to generate summary. Please try again.");
    } finally {
      setGeneratingSummary(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const handleSummaryEdit = (requestId, newSummary) => {
    setEditedSummaries(prev => ({
      ...prev,
      [requestId]: newSummary
    }));
  };

  const submitSummary = async (requestId) => {
    setSubmitting(prev => ({ ...prev, [requestId]: true }));
    try {
      const requestRef = doc(db, "performance_requests", requestId);
      await updateDoc(requestRef, {
        summary: editedSummaries[requestId],
        status: 'submitted',
        submittedAt: new Date().toISOString()
      });
      alert("Summary submitted successfully!");
    } catch (error) {
      console.error("Error submitting summary:", error);
      alert("Failed to submit summary. Please try again.");
    } finally {
      setSubmitting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  const deleteRequest = async (requestId) => {
    if (!confirm("Are you sure you want to delete this request? This action cannot be undone.")) {
      return;
    }
    
    setDeleting(prev => ({ ...prev, [requestId]: true }));
    try {
      const requestRef = doc(db, "performance_requests", requestId);
      await deleteDoc(requestRef);
      alert("Request deleted successfully!");
    } catch (error) {
      console.error("Error deleting request:", error);
      alert("Failed to delete request. Please try again.");
    } finally {
      setDeleting(prev => ({ ...prev, [requestId]: false }));
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.mainContent}>
          <h1>Performance Analysis Requests</h1>
          <div className={styles.requestsList}>
            {requests.length === 0 ? (
              <p>No pending performance analysis requests</p>
            ) : (
              requests.map(request => (
                <div key={request.id} className={styles.requestCard}>
                  <h3>Request from {request.studentName}</h3>
                  <p>Student Email: {request.studentEmail}</p>
                  <p>Requested on: {new Date(request.timestamp).toLocaleString()}</p>
                  <p>Status: {request.status}</p>
                  
                  {request.status === 'pending' && (
                    <button
                      className={styles.generateButton}
                      onClick={() => generateSummary(request.id)}
                      disabled={generatingSummary[request.id]}
                    >
                      {generatingSummary[request.id] ? 'Generating...' : 'Generate Summary'}
                    </button>
                  )}

                  {request.status === 'generated' && (
                    <>
                      <div className={styles.summary}>
                        <h4>Generated Summary:</h4>
                        <textarea
                          className={styles.summaryTextarea}
                          value={editedSummaries[request.id] || ''}
                          onChange={(e) => handleSummaryEdit(request.id, e.target.value)}
                          rows={15}
                        />
                      </div>
                      <div className={styles.buttonGroup}>
                        <button
                          className={styles.submitButton}
                          onClick={() => submitSummary(request.id)}
                          disabled={submitting[request.id]}
                        >
                          {submitting[request.id] ? 'Submitting...' : 'Submit Summary'}
                        </button>
                        <button
                          className={styles.deleteButton}
                          onClick={() => deleteRequest(request.id)}
                          disabled={deleting[request.id]}
                        >
                          {deleting[request.id] ? 'Deleting...' : 'Delete Request'}
                        </button>
                      </div>
                    </>
                  )}

                  {request.status === 'submitted' && (
                    <div className={styles.summary}>
                      <h4>Submitted Summary:</h4>
                      <pre>{request.summary}</pre>
                      <p className={styles.submittedAt}>
                        Submitted on: {new Date(request.submittedAt).toLocaleString()}
                      </p>
                      <button
                        className={styles.deleteButton}
                        onClick={() => deleteRequest(request.id)}
                        disabled={deleting[request.id]}
                      >
                        {deleting[request.id] ? 'Deleting...' : 'Delete Request'}
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
        
        <TeacherChatbot />
      </div>
    </div>
  );
}