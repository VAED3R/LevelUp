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
    const stats = {
      averageScore: 0,
      totalQuizzes: 0,
      totalAssignments: 0,
      completedAssignments: 0,
      assignmentAverage: 0,
      scoreDetails: {
        subjects: {},
        recentScores: [],
        improvement: 0
      },
      assignmentDetails: {
        subjects: {},
        recentAssignments: [],
        totalMarks: 0,
        obtainedMarks: 0
      }
    };

    // Fetch Assignment Data
    try {
      const assignmentsRef = collection(db, 'assignments');
      const assignmentsQuery = query(
        assignmentsRef,
        where('studentId', '==', studentId),
        orderBy('addedAt', 'desc')
      );
      const assignmentsSnapshot = await getDocs(assignmentsQuery);
      const assignmentsData = assignmentsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      stats.totalAssignments = assignmentsData.length;
      stats.completedAssignments = assignmentsData.filter(a => (a.obtainedMarks || 0) > 0).length; // Only completed if obtained marks > 0

      // Calculate assignment statistics
      let totalAssignmentMarks = 0;
      let totalObtainedMarks = 0;
      const assignmentSubjects = {};

      assignmentsData.forEach(assignment => {
        // Only include assignments that have been completed (obtainedMarks > 0)
        if ((assignment.obtainedMarks || 0) > 0) {
          // Calculate total and obtained marks
          totalAssignmentMarks += assignment.totalMarks || 0;
          totalObtainedMarks += assignment.obtainedMarks || 0;

          // Group by subject
          if (!assignmentSubjects[assignment.subject]) {
            assignmentSubjects[assignment.subject] = {
              total: 0,
              obtained: 0,
              count: 0,
              assignments: []
            };
          }
          assignmentSubjects[assignment.subject].total += assignment.totalMarks || 0;
          assignmentSubjects[assignment.subject].obtained += assignment.obtainedMarks || 0;
          assignmentSubjects[assignment.subject].count += 1;
          assignmentSubjects[assignment.subject].assignments.push({
            title: assignment.assignmentTitle,
            percentage: assignment.percentage,
            obtainedMarks: assignment.obtainedMarks,
            totalMarks: assignment.totalMarks,
            addedAt: assignment.addedAt
          });
        }
      });

      // Calculate assignment average
      if (totalAssignmentMarks > 0) {
        stats.assignmentAverage = (totalObtainedMarks / totalAssignmentMarks) * 100;
      }

      // Store assignment details
      stats.assignmentDetails.totalMarks = totalAssignmentMarks;
      stats.assignmentDetails.obtainedMarks = totalObtainedMarks;
      stats.assignmentDetails.subjects = assignmentSubjects;
      stats.assignmentDetails.recentAssignments = assignmentsData
        .filter(assignment => (assignment.obtainedMarks || 0) > 0) // Only completed assignments
        .slice(0, 5)
        .map(assignment => ({
          title: assignment.assignmentTitle,
          subject: assignment.subject,
          percentage: assignment.percentage,
          obtainedMarks: assignment.obtainedMarks,
          totalMarks: assignment.totalMarks,
          addedAt: assignment.addedAt
        }));

    } catch (error) {
      console.error('Error fetching assignments:', error);
    }

    // Fetch Marks/Quiz Data for Average Score
    try {
      const marksRef = collection(db, 'marks');
      const marksQuery = query(
        marksRef,
        where('studentId', '==', studentId),
        orderBy('date', 'desc')
      );
      const marksSnapshot = await getDocs(marksQuery);
      const marksData = marksSnapshot.docs.map(doc => doc.data());

      // Calculate subject-wise scores
      const subjectScores = {};
      marksData.forEach(mark => {
        if (!subjectScores[mark.subject]) {
          subjectScores[mark.subject] = { total: 0, count: 0, scores: [] };
        }
        subjectScores[mark.subject].total += mark.score || 0;
        subjectScores[mark.subject].count += 1;
        subjectScores[mark.subject].scores.push(mark.score || 0);
      });

      // Calculate average scores per subject
      Object.keys(subjectScores).forEach(subject => {
        stats.scoreDetails.subjects[subject] = {
          average: subjectScores[subject].total / subjectScores[subject].count,
          total: subjectScores[subject].total,
          count: subjectScores[subject].count,
          scores: subjectScores[subject].scores
        };
      });

      // Calculate overall average score
      const allScores = marksData.map(mark => mark.score || 0).filter(score => score > 0);
      if (allScores.length > 0) {
        stats.averageScore = allScores.reduce((sum, score) => sum + score, 0) / allScores.length;
      }

      // Get recent scores for trend analysis
      stats.scoreDetails.recentScores = marksData.slice(0, 10).map(mark => ({
        subject: mark.subject,
        score: mark.score || 0,
        date: mark.date
      }));

      // Calculate improvement (comparing recent vs older scores)
      if (allScores.length >= 10) {
        const recentScores = allScores.slice(0, 5);
        const olderScores = allScores.slice(-5);
        const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
        const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
        stats.scoreDetails.improvement = recentAvg - olderAvg;
      }
    } catch (error) {
      console.error('Error fetching marks:', error);
    }

    // Fetch Quiz Data
    try {
      const quizzesRef = collection(db, 'quizzes');
      const quizzesQuery = query(
        quizzesRef,
        where('studentId', '==', studentId),
        orderBy('completedAt', 'desc')
      );
      const quizzesSnapshot = await getDocs(quizzesQuery);
      const quizzesData = quizzesSnapshot.docs.map(doc => doc.data());

      stats.totalQuizzes = quizzesData.length;
      
      // If no marks data, use quiz scores for average
      if (stats.averageScore === 0 && quizzesData.length > 0) {
        const quizScores = quizzesData.map(quiz => quiz.score || 0).filter(score => score > 0);
        if (quizScores.length > 0) {
          stats.averageScore = quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length;
        }
      }
    } catch (error) {
      console.error('Error fetching quizzes:', error);
    }

    // Calculate overall average including assignments
    const allAverages = [];
    if (stats.averageScore > 0) allAverages.push(stats.averageScore);
    if (stats.assignmentAverage > 0) allAverages.push(stats.assignmentAverage);
    
    if (allAverages.length > 0) {
      stats.averageScore = allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length;
    }

    // Ensure all required properties exist even if data fetching fails
    if (!stats.scoreDetails) {
      stats.scoreDetails = {
        subjects: {},
        recentScores: [],
        improvement: 0
      };
    }
    
    if (!stats.assignmentDetails) {
      stats.assignmentDetails = {
        subjects: {},
        recentAssignments: [],
        totalMarks: 0,
        obtainedMarks: 0
      };
    }

    return NextResponse.json({ 
      success: true,
      stats: {
        ...stats,
        averageScore: Math.round(stats.averageScore * 10) / 10, // Round to 1 decimal
        assignmentAverage: Math.round(stats.assignmentAverage * 10) / 10 // Round to 1 decimal
      }
    });
  } catch (error) {
    console.error('Error fetching student stats:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch student statistics',
      stats: {
        averageScore: 0,
        totalQuizzes: 0,
        totalAssignments: 0,
        completedAssignments: 0,
        assignmentAverage: 0,
        scoreDetails: { subjects: {}, recentScores: [], improvement: 0 },
        assignmentDetails: { subjects: {}, recentAssignments: [], totalMarks: 0, obtainedMarks: 0 }
      }
    }, { status: 500 });
  }
} 