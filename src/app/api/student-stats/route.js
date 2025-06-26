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
      totalTests: 0,
      completedTests: 0,
      testAverage: 0,
      recentAssessments: 0,
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
      },
      testDetails: {
        subjects: {},
        recentTests: [],
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
      stats.completedAssignments = assignmentsData.filter(a => (a.obtainedMarks || 0) > 0).length;

      // Calculate assignment statistics
      let totalAssignmentMarks = 0;
      let totalObtainedMarks = 0;
      const assignmentSubjects = {};

      assignmentsData.forEach(assignment => {
        if ((assignment.obtainedMarks || 0) > 0) {
          totalAssignmentMarks += assignment.totalMarks || 0;
          totalObtainedMarks += assignment.obtainedMarks || 0;

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

      if (totalAssignmentMarks > 0) {
        stats.assignmentAverage = (totalObtainedMarks / totalAssignmentMarks) * 100;
      }

      stats.assignmentDetails.totalMarks = totalAssignmentMarks;
      stats.assignmentDetails.obtainedMarks = totalObtainedMarks;
      stats.assignmentDetails.subjects = assignmentSubjects;
      stats.assignmentDetails.recentAssignments = assignmentsData
        .filter(assignment => (assignment.obtainedMarks || 0) > 0)
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
        
        const allPoints = [
          ...(studentData.points || []),
          ...(studentData.fallPoints || [])
        ];
        
        // Filter for actual quizzes (exclude attendance, assignments, assessments)
        const quizData = allPoints.filter(point => {
          if (point.quizId === 'attendance') return false;
          if (point.type === 'assignment' || point.type === 'assessment') return false;
          if (point.subject === 'unknown' && (point.score || 0) > 0) return true;
          if (point.subject && point.subject !== 'unknown' && point.subject !== 'Unknown') return true;
          return false;
        });

        stats.totalQuizzes = quizData.length;
        
        if (quizData.length > 0) {
          const quizScores = quizData.map(quiz => quiz.score || 0).filter(score => score > 0);
          if (quizScores.length > 0) {
            stats.averageScore = quizScores.reduce((sum, score) => sum + score, 0) / quizScores.length;
          }
          
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

          Object.keys(quizSubjects).forEach(subject => {
            stats.scoreDetails.subjects[subject] = {
              average: quizSubjects[subject].total / quizSubjects[subject].count,
              total: quizSubjects[subject].total,
              count: quizSubjects[subject].count,
              scores: quizSubjects[subject].scores
            };
          });

          stats.scoreDetails.recentScores = quizData
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 10)
            .map(quiz => ({
              subject: (quiz.subject === 'unknown' || quiz.subject === 'Unknown') ? 'General' : quiz.subject,
              score: quiz.score || 0,
              date: quiz.date,
              topic: quiz.topic || 'Quiz'
            }));

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

    // Fetch Test Results from marks collection
    try {
      const marksRef = collection(db, 'marks');
      const testResultsQuery = query(
        marksRef,
        where('studentId', '==', studentId),
        orderBy('addedAt', 'desc')
      );
      const testResultsSnapshot = await getDocs(testResultsQuery);
      
      const testResultsData = testResultsSnapshot.docs
        .map(doc => ({
          id: doc.id,
          ...doc.data()
        }))
        .filter(mark => {
          return mark.subject && mark.semester && !mark.assignmentId && mark.obtainedMarks !== undefined;
        });

      stats.totalTests = testResultsData.length;
      stats.completedTests = testResultsData.filter(t => (t.obtainedMarks || 0) > 0).length;

      let totalTestMarks = 0;
      let totalObtainedTestMarks = 0;
      const testSubjects = {};

      testResultsData.forEach(test => {
        if ((test.obtainedMarks || 0) > 0) {
          totalTestMarks += test.totalMarks || 0;
          totalObtainedTestMarks += test.obtainedMarks || 0;

          if (!testSubjects[test.subject]) {
            testSubjects[test.subject] = {
              total: 0,
              obtained: 0,
              count: 0,
              tests: []
            };
          }
          testSubjects[test.subject].total += test.totalMarks || 0;
          testSubjects[test.subject].obtained += test.obtainedMarks || 0;
          testSubjects[test.subject].count += 1;
          testSubjects[test.subject].tests.push({
            subject: test.subject,
            semester: test.semester,
            percentage: test.percentage || (test.totalMarks > 0 ? ((test.obtainedMarks / test.totalMarks) * 100).toFixed(1) : 0),
            obtainedMarks: test.obtainedMarks,
            totalMarks: test.totalMarks,
            addedAt: test.addedAt
          });
        }
      });

      if (totalTestMarks > 0) {
        stats.testAverage = (totalObtainedTestMarks / totalTestMarks) * 100;
      }

      stats.testDetails = {
        totalMarks: totalTestMarks,
        obtainedMarks: totalObtainedTestMarks,
        subjects: testSubjects,
        recentTests: testResultsData
          .filter(test => (test.obtainedMarks || 0) > 0)
          .slice(0, 5)
          .map(test => ({
            subject: test.subject,
            semester: test.semester,
            percentage: test.percentage || (test.totalMarks > 0 ? ((test.obtainedMarks / test.totalMarks) * 100).toFixed(1) : 0),
            obtainedMarks: test.obtainedMarks,
            totalMarks: test.totalMarks,
            addedAt: test.addedAt
          }))
      };

    } catch (error) {
      console.error('Error fetching test results:', error);
      stats.totalTests = 0;
      stats.completedTests = 0;
      stats.testAverage = 0;
      stats.testDetails = {
        totalMarks: 0,
        obtainedMarks: 0,
        subjects: {},
        recentTests: []
      };
    }

    // Calculate recent assessments count (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    let recentCount = 0;
    
    // Count recent quizzes
    if (stats.scoreDetails.recentScores) {
      recentCount += stats.scoreDetails.recentScores.filter(score => 
        new Date(score.date) >= thirtyDaysAgo
      ).length;
    }
    
    // Count recent assignments
    if (stats.assignmentDetails.recentAssignments) {
      recentCount += stats.assignmentDetails.recentAssignments.filter(assignment => 
        new Date(assignment.addedAt) >= thirtyDaysAgo
      ).length;
    }
    
    // Count recent tests
    if (stats.testDetails.recentTests) {
      recentCount += stats.testDetails.recentTests.filter(test => 
        new Date(test.addedAt) >= thirtyDaysAgo
      ).length;
    }
    
    stats.recentAssessments = recentCount;

    // Calculate overall average including all assessment types
    const allAverages = [];
    if (stats.averageScore > 0) allAverages.push(stats.averageScore);
    if (stats.assignmentAverage > 0) allAverages.push(stats.assignmentAverage);
    if (stats.testAverage > 0) allAverages.push(stats.testAverage);
    
    if (allAverages.length > 0) {
      stats.averageScore = allAverages.reduce((sum, avg) => sum + avg, 0) / allAverages.length;
    }

    return NextResponse.json({ 
      success: true,
      stats: {
        ...stats,
        averageScore: Math.round(stats.averageScore * 10) / 10,
        assignmentAverage: Math.round(stats.assignmentAverage * 10) / 10,
        testAverage: Math.round(stats.testAverage * 10) / 10,
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
        totalTests: 0,
        completedTests: 0,
        testAverage: 0,
        recentAssessments: 0,
        scoreDetails: { subjects: {}, recentScores: [], improvement: 0 },
        assignmentDetails: { subjects: {}, recentAssignments: [], totalMarks: 0, obtainedMarks: 0 },
        testDetails: {
          totalMarks: 0,
          obtainedMarks: 0,
          subjects: {},
          recentTests: []
        }
      }
    }, { status: 500 });
  }
} 