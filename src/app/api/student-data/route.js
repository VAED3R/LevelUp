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

    // Fetch Quizzes
    try {
      const quizzesRef = collection(db, 'quizzes');
      const quizzesQuery = query(
        quizzesRef,
        where('studentId', '==', studentId),
        orderBy('completedAt', 'desc')
      );
      const quizzesSnapshot = await getDocs(quizzesQuery);
      studentData.quizzes = quizzesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error fetching quizzes:', error);
      studentData.quizzes = [];
    }

    // Calculate analytics
    studentData.analytics = calculateAnalytics(studentData);

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
      subjectPerformance: {}
    },
    engagement: {
      totalChallenges: studentData.challenges.length,
      activeChallenges: studentData.challenges.filter(c => c.status === 'active').length,
      oneVsOneRequests: studentData.oneVsOneRequests.length,
      recentActivity: []
    }
  };

  // Calculate quiz average
  if (analytics.academic.totalQuizzes > 0) {
    const totalQuizScore = studentData.quizzes.reduce((sum, quiz) => sum + (quiz.score || 0), 0);
    analytics.academic.quizAverage = totalQuizScore / analytics.academic.totalQuizzes;
  }

  // Calculate subject performance from marks
  const subjectMarks = {};
  studentData.marks.forEach(mark => {
    if (!subjectMarks[mark.subject]) {
      subjectMarks[mark.subject] = { total: 0, count: 0 };
    }
    subjectMarks[mark.subject].total += mark.score || 0;
    subjectMarks[mark.subject].count += 1;
  });

  // Calculate subject performance from assignments
  const assignmentSubjects = {};
  studentData.assignments.forEach(assignment => {
    // Only include completed assignments (obtainedMarks > 0)
    if ((assignment.obtainedMarks || 0) > 0) {
      if (!assignmentSubjects[assignment.subject]) {
        assignmentSubjects[assignment.subject] = { total: 0, count: 0 };
      }
      assignmentSubjects[assignment.subject].total += assignment.percentage || 0;
      assignmentSubjects[assignment.subject].count += 1;
    }
  });

  // Combine marks and assignment performance
  Object.keys(subjectMarks).forEach(subject => {
    analytics.academic.subjectPerformance[subject] = 
      subjectMarks[subject].total / subjectMarks[subject].count;
  });

  // Add assignment subjects if not already present
  Object.keys(assignmentSubjects).forEach(subject => {
    if (!analytics.academic.subjectPerformance[subject]) {
      analytics.academic.subjectPerformance[subject] = 
        assignmentSubjects[subject].total / assignmentSubjects[subject].count;
    } else {
      // Average both marks and assignment performance
      const marksAvg = analytics.academic.subjectPerformance[subject];
      const assignmentAvg = assignmentSubjects[subject].total / assignmentSubjects[subject].count;
      analytics.academic.subjectPerformance[subject] = (marksAvg + assignmentAvg) / 2;
    }
  });

  // Calculate overall average score
  const allScores = Object.values(analytics.academic.subjectPerformance);
  if (allScores.length > 0) {
    analytics.academic.averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
  }

  // Generate recent activity
  const allActivities = [
    ...studentData.assignments.map(a => ({ ...a, type: 'assignment', date: a.addedAt })),
    ...studentData.challenges.map(c => ({ ...c, type: 'challenge', date: c.createdAt })),
    ...studentData.quizzes.map(q => ({ ...q, type: 'quiz', date: q.completedAt })),
  ].sort((a, b) => new Date(b.date) - new Date(a.date));

  analytics.engagement.recentActivity = allActivities.slice(0, 10);

  return analytics;
} 