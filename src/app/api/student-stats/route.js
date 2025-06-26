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

    // Fetch Quiz Data from students collection
    try {
      const studentsRef = collection(db, 'students');
      const studentQuery = query(
        studentsRef,
        where('id', '==', studentId)
      );
      const studentSnapshot = await getDocs(studentQuery);
      
      if (!studentSnapshot.empty) {
        const studentData = studentSnapshot.docs[0].data();
        console.log('Student data fetched:', studentData);
        
        // Combine points and fallPoints arrays
        const allPoints = [
          ...(studentData.points || []),
          ...(studentData.fallPoints || [])
        ];
        
        console.log('Total points entries:', allPoints.length);
        console.log('Points array length:', studentData.points?.length || 0);
        console.log('FallPoints array length:', studentData.fallPoints?.length || 0);
        
        // Filter for actual quizzes (not attendance, assignments, or assessments)
        const quizData = allPoints.filter(point => {
          // Exclude attendance records
          if (point.quizId === 'attendance') {
            console.log('Excluding attendance:', point);
            return false;
          }
          // Exclude assignments and assessments
          if (point.type === 'assignment' || point.type === 'assessment') {
            console.log('Excluding assignment/assessment:', point);
            return false;
          }
          // Include quizzes with unknown subject and score > 0 as completed
          if (point.subject === 'unknown' && (point.score || 0) > 0) {
            console.log('Including unknown subject quiz with score > 0:', point);
            return true;
          }
          // Include other quizzes with valid subjects (not unknown)
          if (point.subject && point.subject !== 'unknown' && point.subject !== 'Unknown') {
            console.log('Including valid subject quiz:', point);
            return true;
          }
          console.log('Excluding other entry:', point);
          return false;
        });

        console.log('Filtered quiz data:', quizData);
        stats.totalQuizzes = quizData.length;
        
        // Calculate quiz statistics
        if (quizData.length > 0) {
          const quizScores = quizData.map(quiz => quiz.score || 0).filter(score => score > 0);
          if (quizScores.length > 0) {
            stats.averageScore = quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length;
          }
          
          // Group by subject for subject performance
          const quizSubjects = {};
          quizData.forEach(quiz => {
            const subject = (quiz.subject === 'unknown' || quiz.subject === 'Unknown') ? 'General' : quiz.subject;
            if (!quizSubjects[subject]) {
              quizSubjects[subject] = { total: 0, count: 0, scores: [] };
            }
            quizSubjects[subject].total += quiz.score || 0;
            quizSubjects[subject].count += 1;
            quizSubjects[subject].scores.push(quiz.score || 0);
          });

          // Calculate subject averages
          Object.keys(quizSubjects).forEach(subject => {
            stats.scoreDetails.subjects[subject] = {
              average: quizSubjects[subject].total / quizSubjects[subject].count,
              total: quizSubjects[subject].total,
              count: quizSubjects[subject].count,
              scores: quizSubjects[subject].scores
            };
          });

          // Get recent scores for trend analysis
          stats.scoreDetails.recentScores = quizData
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10)
            .map(quiz => ({
              subject: (quiz.subject === 'unknown' || quiz.subject === 'Unknown') ? 'General' : quiz.subject,
              score: quiz.score || 0,
              date: quiz.date,
              topic: quiz.topic || 'Quiz'
            }));

          // Calculate improvement (comparing recent vs older scores)
          if (quizScores.length >= 10) {
            const recentScores = quizScores.slice(0, 5);
            const olderScores = quizScores.slice(-5);
            const recentAvg = recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length;
            const olderAvg = olderScores.reduce((sum, score) => sum + score, 0) / olderScores.length;
            stats.scoreDetails.improvement = recentAvg - olderAvg;
          }
        }
      }
    } catch (error) {
      console.error('Error fetching quiz data from students collection:', error);
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