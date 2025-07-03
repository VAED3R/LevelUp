"use client";

import { useState, useEffect } from "react";
import { db, auth } from "@/lib/firebase";
import { collection, getDocs, query, where, doc, updateDoc, onSnapshot, deleteDoc, addDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import ReactMarkdown from 'react-markdown';
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
  const [editMode, setEditMode] = useState({});
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
        const totalQuizScore = quizzes.reduce((sum, quiz) => {
          if (quiz.score !== undefined && quiz.score !== null && quiz.score > 0) {
            quizCount++;
            return sum + quiz.score;
          }
          return sum;
        }, 0);
        quizPerformance = quizCount > 0 ? Math.round(totalQuizScore / quizCount) : 0;
      }

      // Prepare data for DeepSeek analysis
      const performanceData = {
        studentName: request.studentName,
        assignments: {
          performance: assignmentPerformance,
          count: assignmentCount,
          details: assignments.slice(0, 5).map(a => ({
            title: a.assignmentTitle,
            percentage: a.percentage,
            obtained: a.obtainedMarks,
            total: a.totalMarks,
            date: a.addedAt
          }))
        },
        tests: {
          performance: testPerformance,
          count: testCount,
          details: testResults.slice(0, 5).map(t => ({
            subject: t.subject,
            percentage: t.percentage || Math.round((t.obtainedMarks / t.totalMarks) * 100),
            obtained: t.obtainedMarks,
            total: t.totalMarks,
            date: t.addedAt
          }))
        },
        quizzes: {
          performance: quizPerformance,
          count: quizCount,
          details: quizzes.slice(0, 5).map(q => ({
            subject: q.subject,
            score: q.score,
            totalQuestions: q.totalQuestions,
            date: q.completedAt
          }))
        }
      };

      // Calculate overall average
      const overallAverage = [assignmentPerformance, testPerformance, quizPerformance]
        .filter(score => score > 0)
        .reduce((sum, score) => sum + score, 0) / 
        [assignmentPerformance, testPerformance, quizPerformance].filter(score => score > 0).length;

      // Generate detailed summary using DeepSeek API
      const deepseekPrompt = `Analyze the performance data for ${request.studentName} and provide a complete academic assessment.

STUDENT DATA:
${JSON.stringify(performanceData, null, 2)}

PERFORMANCE METRICS:
- Assignment Performance: ${assignmentPerformance}% (${assignmentCount} assignments)
- Test Performance: ${testPerformance}% (${testCount} tests)  
- Quiz Performance: ${quizPerformance}% (${quizCount} quizzes)
- Overall Average: ${Math.round(overallAverage)}%

Provide a complete analysis with these sections:

1. 📊 EXECUTIVE SUMMARY
   - Overall rating and key performance indicators
   - Primary strengths and concerns

2. 📈 PERFORMANCE BREAKDOWN
   - Assignment analysis (trends, quality, consistency)
   - Test performance (subject breakdown, knowledge retention)
   - Quiz performance (concept understanding, practice patterns)

3. 🎯 STRENGTHS & WEAKNESSES
   - Areas of excellence
   - Improvement needs and learning gaps

4. 🚀 IMPROVEMENT STRATEGIES
   - Short-term goals (2-4 weeks)
   - Medium-term objectives (2-3 months)
   - Study techniques and resources

5. 📝 ACTIONABLE RECOMMENDATIONS
   - Immediate actions
   - Teacher and parent involvement
   - Student self-help techniques

Use professional tone with emojis. Ensure the analysis is complete and actionable.`;

      // Call DeepSeek API with Reasoner model
      const deepseekResponse = await fetch('/api/deepseek', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'deepseek-reasoner',
          messages: [
            {
              role: 'user',
              content: deepseekPrompt
            }
          ]
        })
      });

      let summary;
      if (deepseekResponse.ok) {
        const deepseekData = await deepseekResponse.json();
        summary = deepseekData.response || 'Failed to generate AI summary';
        
        // Check if response is complete (has all expected sections)
        const expectedSections = ['📊 EXECUTIVE SUMMARY', '📈 PERFORMANCE BREAKDOWN', '🎯 STRENGTHS', '🚀 IMPROVEMENT', '📝 ACTIONABLE'];
        const missingSections = expectedSections.filter(section => !summary.includes(section));
        
        if (missingSections.length > 0) {
          console.warn('DeepSeek API - Incomplete response, missing sections:', missingSections);
          summary += `\n\n⚠️ Note: This analysis was cut off due to length limits. Please review the available sections above.`;
        }
        
        console.log('DeepSeek API - Response length:', summary.length);
        console.log('DeepSeek API - Response preview:', summary.substring(0, 300) + '...');
      } else {
        const errorData = await deepseekResponse.json().catch(() => ({}));
        console.error('DeepSeek API error response:', errorData);
        throw new Error(`Failed to generate summary using DeepSeek API: ${errorData.error || deepseekResponse.statusText}`);
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

  const toggleEditMode = (requestId) => {
    setEditMode(prev => ({
      ...prev,
      [requestId]: !prev[requestId]
    }));
  };

  const saveEdit = (requestId) => {
    setEditMode(prev => ({
      ...prev,
      [requestId]: false
    }));
  };

  const cancelEdit = (requestId) => {
    // Reset to original summary
    const request = requests.find(r => r.id === requestId);
    if (request && request.summary) {
      setEditedSummaries(prev => ({
        ...prev,
        [requestId]: request.summary
      }));
    }
    setEditMode(prev => ({
      ...prev,
      [requestId]: false
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
                        <div className={styles.summaryHeader}>
                          <h4>Generated Summary:</h4>
                          <button
                            className={styles.editButton}
                            onClick={() => toggleEditMode(request.id)}
                          >
                            {editMode[request.id] ? 'Cancel Edit' : 'Edit Summary'}
                          </button>
                        </div>
                        
                        {editMode[request.id] ? (
                          <div className={styles.summaryEdit}>
                            <textarea
                              className={styles.summaryTextarea}
                              value={editedSummaries[request.id] || ''}
                              onChange={(e) => handleSummaryEdit(request.id, e.target.value)}
                              rows={20}
                              placeholder="Edit the summary here..."
                            />
                            <div className={styles.editButtons}>
                              <button
                                className={styles.saveButton}
                                onClick={() => saveEdit(request.id)}
                              >
                                Save Changes
                              </button>
                              <button
                                className={styles.cancelButton}
                                onClick={() => cancelEdit(request.id)}
                              >
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className={styles.summaryDisplay}>
                            <div className={styles.summaryMarkdown}>
                              <ReactMarkdown>
                                {editedSummaries[request.id] || ''}
                              </ReactMarkdown>
                            </div>
                          </div>
                        )}
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
                      <div className={styles.summaryDisplay}>
                        <div className={styles.summaryMarkdown}>
                          <ReactMarkdown>
                            {request.summary}
                          </ReactMarkdown>
                        </div>
                      </div>
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