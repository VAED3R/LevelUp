import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
  }

  try {
    const studentData = {};
    
    // Get student name for fallback attendance query
    let studentName = '';
    try {
      const usersRef = collection(db, 'users');
      const userQuery = query(usersRef, where('__name__', '==', studentId));
      const userSnapshot = await getDocs(userQuery);
      if (!userSnapshot.empty) {
        studentName = userSnapshot.docs[0].data().name || '';
      }
    } catch (error) {
      console.error('Error fetching student name:', error);
    }

    // Fetch Assignments
    try {
      const assignmentsRef = collection(db, 'assignments');
      const assignmentsQuery = query(
        assignmentsRef,
        where('studentId', '==', studentId)
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      studentData.assignments = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching assignments:', error);
      studentData.assignments = [];
    }

    // Fetch Challenges
    try {
      const challengesRef = collection(db, 'challenges');
      const challengesQuery = query(
        challengesRef,
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const challengesSnapshot = await getDocs(challengesQuery);
      studentData.challenges = challengesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching challenges:', error);
      studentData.challenges = [];
    }

    // Fetch Course Map
    try {
      const courseMapRef = collection(db, 'coursemap');
      const courseMapQuery = query(
        courseMapRef,
        where('studentId', '==', studentId)
      );
      const courseMapSnapshot = await getDocs(courseMapQuery);
      studentData.courseMap = courseMapSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching course map:', error);
      studentData.courseMap = [];
    }

    // Fetch Marks
    try {
      const marksRef = collection(db, 'marks');
      const marksQuery = query(
        marksRef,
        where('studentId', '==', studentId),
        orderBy('date', 'desc')
      );
      const marksSnapshot = await getDocs(marksQuery);
      studentData.marks = marksSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching marks:', error);
      studentData.marks = [];
    }

    // Fetch Test Results from marks collection
    try {
      const marksRef = collection(db, 'marks');
      const testResultsQuery = query(
        marksRef,
        where('studentId', '==', studentId),
        orderBy('addedAt', 'desc')
      );
      const testResultsSnapshot = await getDocs(testResultsQuery);
      
      // Filter for test results (exclude assignments and other types)
      studentData.testResults = testResultsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(mark => {
          // Include marks that have subject, semester, and are not assignments
          // Check if it's a test result by looking for subject, semester, and absence of assignmentId
          return mark.subject && mark.semester && !mark.assignmentId && mark.obtainedMarks !== undefined;
        });
    } catch (error) {
      console.error('Error fetching test results:', error);
      studentData.testResults = [];
    }

    // Fetch One vs One Requests
    try {
      const oneVsOneRef = collection(db, 'onevsoneRequests');
      const oneVsOneQuery = query(
        oneVsOneRef,
        where('studentId', '==', studentId),
        orderBy('createdAt', 'desc')
      );
      const oneVsOneSnapshot = await getDocs(oneVsOneQuery);
      studentData.oneVsOneRequests = oneVsOneSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching one vs one requests:', error);
      studentData.oneVsOneRequests = [];
    }

    // Fetch Attendance Data
    try {
      const attendanceRef = collection(db, 'attendance');
      const attendanceQuery = query(
        attendanceRef,
        where('studentId', '==', studentId),
        orderBy('addedAt', 'desc')
      );
      const attendanceSnapshot = await getDocs(attendanceQuery);
      studentData.attendance = attendanceSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      // If no attendance found with studentId, try to find by student name or other fields
      if (studentData.attendance.length === 0) {
        // Try to find attendance by student name
        const nameQuery = query(
          attendanceRef,
          where('studentName', '==', studentName),
          orderBy('addedAt', 'desc')
        );
        const nameSnapshot = await getDocs(nameQuery);
        if (!nameSnapshot.empty) {
          studentData.attendance = nameSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } else {
          // Try to find by student name from students collection
          try {
            const studentsRef = collection(db, 'students');
            const studentQuery = query(studentsRef, where('id', '==', studentId));
            const studentSnapshot = await getDocs(studentQuery);
            if (!studentSnapshot.empty) {
              const studentDocData = studentSnapshot.docs[0].data();
              const studentNameFromStudents = studentDocData.name || '';
              
              const studentsNameQuery = query(
                attendanceRef,
                where('studentName', '==', studentNameFromStudents),
                orderBy('addedAt', 'desc')
              );
              const studentsNameSnapshot = await getDocs(studentsNameQuery);
              if (!studentsNameSnapshot.empty) {
                studentData.attendance = studentsNameSnapshot.docs.map(doc => ({
                  id: doc.id,
                  ...doc.data()
                }));
              }
            }
          } catch (error) {
            console.error('Error in students collection fallback:', error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      studentData.attendance = [];
    }

    // Fetch Quiz Data from students collection
    try {
      const studentsRef = collection(db, 'students');
      const studentQuery = query(
        studentsRef,
        where('id', '==', studentId)
      );
      const studentSnapshot = await getDocs(studentQuery);
      
      if (!studentSnapshot.empty) {
        const studentDocData = studentSnapshot.docs[0].data();
        
        // Combine points and fallPoints arrays
        const allPoints = [
          ...(studentDocData.points || []),
          ...(studentDocData.fallPoints || [])
        ];
        
        // Filter for actual quizzes (not attendance, assignments, or assessments)
        studentData.quizzes = allPoints.filter(point => {
          // Exclude attendance records
          if (point.quizId === 'attendance') {
            return false;
          }
          // Exclude assignments and assessments
          if (point.type === 'assignment' || point.type === 'assessment') {
            return false;
          }
          // Exclude quizzes with unknown subject
          if (point.subject === 'unknown' || point.subject === 'Unknown') {
            return false;
          }
          // Include only quizzes with valid subjects
          if (point.subject && point.subject !== 'unknown' && point.subject !== 'Unknown') {
            return true;
          }
          return false;
        }).map(quiz => ({
          id: quiz.quizId,
          score: quiz.score || 0,
          subject: quiz.subject,
          topic: quiz.topic || 'Quiz',
          completedAt: quiz.date,
          totalQuestions: quiz.totalQuestions || 0,
          points: quiz.points || 0
        }));
      } else {
        studentData.quizzes = [];
      }
    } catch (error) {
      console.error('Error fetching quiz data from students collection:', error);
      studentData.quizzes = [];
    }

    // Calculate analytics
    studentData.analytics = calculateAnalytics(studentData);
    
    // Add assignment average to main studentData for easy access
    studentData.assignmentAverage = studentData.analytics.academic.assignmentAverage;
    
    // Add test average to main studentData for easy access
    studentData.testAverage = studentData.analytics.academic.testAverage;
    
    // Add attendance analytics to main studentData for easy access
    const totalAttendance = studentData.attendance.length;
    const presentDays = studentData.attendance.filter(a => a.status === "present").length;
    studentData.attendanceRate = totalAttendance > 0 ? ((presentDays / totalAttendance) * 100).toFixed(2) : 0;

    return NextResponse.json({ data: studentData });
  } catch (error) {
    console.error('Error fetching student data:', error);
    return NextResponse.json({ error: 'Failed to fetch student data' }, { status: 500 });
  }
}

function calculateAnalytics(studentData) {
  const analytics = {
    academic: {
      averageScore: 0,
      totalAssignments: studentData.assignments.length,
      completedAssignments: studentData.assignments.filter(a => (a.obtainedMarks || 0) > 0).length, // Only completed if obtained marks > 0
      totalQuizzes: studentData.quizzes.length,
      quizAverage: 0,
      assignmentAverage: 0,
      totalTests: studentData.testResults.length,
      completedTests: studentData.testResults.filter(t => (t.obtainedMarks || 0) > 0).length,
      testAverage: 0,
      subjectPerformance: {}
    },
    engagement: {
      totalChallenges: studentData.challenges.length,
      activeChallenges: studentData.challenges.filter(c => c.status === 'active').length,
      oneVsOneRequests: studentData.oneVsOneRequests.length,
      recentActivity: []
    }
  };

  // Calculate assignment average
  const completedAssignments = studentData.assignments.filter(a => (a.obtainedMarks || 0) > 0);
  if (completedAssignments.length > 0) {
    const totalAssignmentScore = completedAssignments.reduce((sum, assignment) => sum + (assignment.percentage || 0), 0);
    analytics.academic.assignmentAverage = totalAssignmentScore / completedAssignments.length;
  }

  // Calculate quiz average
  if (analytics.academic.totalQuizzes > 0) {
    const totalQuizScore = studentData.quizzes.reduce((sum, quiz) => sum + (quiz.score || 0), 0);
    analytics.academic.quizAverage = totalQuizScore / analytics.academic.totalQuizzes;
  }

  // Calculate test average
  const completedTests = studentData.testResults.filter(t => (t.obtainedMarks || 0) > 0);
  if (completedTests.length > 0) {
    const totalTestScore = completedTests.reduce((sum, test) => {
      const percentage = test.percentage || (test.totalMarks > 0 ? ((test.obtainedMarks / test.totalMarks) * 100) : 0);
      return sum + percentage;
    }, 0);
    analytics.academic.testAverage = totalTestScore / completedTests.length;
  }

  // Calculate subject performance from quizzes
  const quizSubjects = {};
  studentData.quizzes.forEach(quiz => {
    if (!quizSubjects[quiz.subject]) {
      quizSubjects[quiz.subject] = { total: 0, count: 0 };
    }
    quizSubjects[quiz.subject].total += quiz.score || 0;
    quizSubjects[quiz.subject].count += 1;
  });

  // Calculate subject performance from test results
  studentData.testResults.forEach(test => {
    if (test.subject) {
      if (!quizSubjects[test.subject]) {
        quizSubjects[test.subject] = { total: 0, count: 0 };
      }
      const percentage = test.percentage || (test.totalMarks > 0 ? ((test.obtainedMarks / test.totalMarks) * 100) : 0);
      quizSubjects[test.subject].total += percentage;
      quizSubjects[test.subject].count += 1;
    }
  });

  // Calculate subject averages
  Object.keys(quizSubjects).forEach(subject => {
    analytics.academic.subjectPerformance[subject] = {
      average: quizSubjects[subject].total / quizSubjects[subject].count,
      total: quizSubjects[subject].total,
      count: quizSubjects[subject].count
    };
  });

  // Calculate overall average score
  const allScores = Object.values(analytics.academic.subjectPerformance);
  if (allScores.length > 0) {
    analytics.academic.averageScore = allScores.reduce((sum, scoreData) => sum + scoreData.average, 0) / allScores.length;
  } else {
    // Fallback: calculate average from completed assignments
    const completedAssignments = studentData.assignments.filter(a => (a.obtainedMarks || 0) > 0);
    if (completedAssignments.length > 0) {
      const totalAssignmentScore = completedAssignments.reduce((sum, assignment) => sum + (assignment.percentage || 0), 0);
      analytics.academic.averageScore = totalAssignmentScore / completedAssignments.length;
    }
  }

  // Generate recent activity
  const allActivities = [
    ...studentData.assignments.map(a => ({ ...a, type: 'assignment', date: a.addedAt })),
    ...studentData.testResults.map(t => ({ ...t, type: 'test', date: t.addedAt })),
    ...studentData.challenges.map(c => ({ ...c, type: 'challenge', date: c.createdAt }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  analytics.engagement.recentActivity = allActivities.slice(0, 10).map(activity => ({
    type: activity.type,
    title: activity.type === 'assignment' ? activity.assignmentTitle : 
           activity.type === 'test' ? `Test - ${activity.subject}` :
           (activity.title || 'Activity'),
    date: activity.date,
    score: activity.type === 'assignment' ? activity.percentage : 
           activity.type === 'test' ? (activity.percentage || ((activity.obtainedMarks / activity.totalMarks) * 100).toFixed(1)) :
           (activity.score || 0),
    subject: activity.subject
  }));

  return analytics;
} 