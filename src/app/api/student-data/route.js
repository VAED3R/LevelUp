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

    // Fetch Assignments
    try {
      console.log('Fetching assignments for student:', studentId);
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
      console.log('Assignments fetched:', studentData.assignments.length);
      console.log('Sample assignment:', studentData.assignments[0]);
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
        console.log('Student data fetched for student-data API:', studentDocData);
        
        // Combine points and fallPoints arrays
        const allPoints = [
          ...(studentDocData.points || []),
          ...(studentDocData.fallPoints || [])
        ];
        
        console.log('Total points entries for student-data:', allPoints.length);
        
        // Filter for actual quizzes (not attendance, assignments, or assessments)
        studentData.quizzes = allPoints.filter(point => {
          // Exclude attendance records
          if (point.quizId === 'attendance') {
            console.log('Excluding attendance from student-data:', point);
            return false;
          }
          // Exclude assignments and assessments
          if (point.type === 'assignment' || point.type === 'assessment') {
            console.log('Excluding assignment/assessment from student-data:', point);
            return false;
          }
          // Include quizzes with unknown subject and score > 0 as completed
          if (point.subject === 'unknown' && (point.score || 0) > 0) {
            console.log('Including unknown subject quiz with score > 0 from student-data:', point);
            return true;
          }
          // Include other quizzes with valid subjects (not unknown)
          if (point.subject && point.subject !== 'unknown' && point.subject !== 'Unknown') {
            console.log('Including valid subject quiz from student-data:', point);
            return true;
          }
          console.log('Excluding other entry from student-data:', point);
          return false;
        }).map(quiz => ({
          id: quiz.quizId,
          score: quiz.score || 0,
          subject: (quiz.subject === 'unknown' || quiz.subject === 'Unknown') ? 'General' : quiz.subject,
          topic: quiz.topic || 'Quiz',
          completedAt: quiz.date,
          totalQuestions: quiz.totalQuestions || 0,
          points: quiz.points || 0
        }));
        
        console.log('Filtered quizzes for student-data:', studentData.quizzes);
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

  // Calculate subject performance from quizzes
  const quizSubjects = {};
  studentData.quizzes.forEach(quiz => {
    if (!quizSubjects[quiz.subject]) {
      quizSubjects[quiz.subject] = { total: 0, count: 0 };
    }
    quizSubjects[quiz.subject].total += quiz.score || 0;
    quizSubjects[quiz.subject].count += 1;
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
    ...studentData.challenges.map(c => ({ ...c, type: 'challenge', date: c.createdAt }))
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  analytics.engagement.recentActivity = allActivities.slice(0, 10).map(activity => ({
    type: activity.type,
    title: activity.type === 'assignment' ? activity.assignmentTitle : (activity.title || 'Activity'),
    date: activity.date,
    score: activity.type === 'assignment' ? activity.percentage : (activity.score || 0),
    subject: activity.subject
  }));

  return analytics;
} 