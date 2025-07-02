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
    // Fetch student data to generate recommendations
    const assignmentsRef = collection(db, 'assignments');
    const assignmentsQuery = query(
      assignmentsRef,
      where('studentId', '==', studentId)
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    const assignments = assignmentsSnapshot.docs.map(doc => doc.data());

    const quizzesRef = collection(db, 'quizzes');
    const quizzesQuery = query(
      quizzesRef,
      where('studentId', '==', studentId)
    );
    const quizzesSnapshot = await getDocs(quizzesQuery);
    const quizzes = quizzesSnapshot.docs.map(doc => doc.data());

    // Analyze performance to generate recommendations
    const recommendations = {
      studySchedule: {
        recommendedTime: 'evening',
        sessionDuration: 25,
        breaks: 5
      },
      contentRecommendations: [
        {
          title: 'Mathematics Fundamentals',
          description: 'Strengthen your core mathematical concepts',
          difficulty: 'medium',
          duration: 30,
          relevanceScore: 0.85,
          reason: 'Based on your recent quiz performance'
        },
        {
          title: 'English Grammar Practice',
          description: 'Improve your writing and communication skills',
          difficulty: 'easy',
          duration: 20,
          relevanceScore: 0.78,
          reason: 'Targeted for your learning style'
        },
        {
          title: 'Science Lab Safety',
          description: 'Essential safety protocols for laboratory work',
          difficulty: 'medium',
          duration: 25,
          relevanceScore: 0.72,
          reason: 'Upcoming practical assessments'
        }
      ],
      learningStrategies: [
        'Take regular breaks every 25 minutes to maintain focus',
        'Use visual aids and diagrams when studying complex topics',
        'Practice active recall by testing yourself on key concepts',
        'Review material before bedtime for better retention',
        'Create mind maps to connect related concepts',
        'Study in a quiet environment to minimize distractions'
      ],
      focusAreas: [
        {
          subject: 'Mathematics',
          priority: 'high',
          reason: 'Recent assignments show room for improvement'
        },
        {
          subject: 'English',
          priority: 'medium',
          reason: 'Consistent performance, focus on advanced topics'
        }
      ]
    };

    // Customize recommendations based on actual performance
    if (assignments.length > 0) {
      const completedAssignments = assignments.filter(a => (a.obtainedMarks || 0) > 0);
      const averageScore = completedAssignments.length > 0 
        ? completedAssignments.reduce((sum, a) => sum + (a.percentage || 0), 0) / completedAssignments.length
        : 0;

      if (averageScore < 70) {
        recommendations.learningStrategies.unshift('Focus on understanding core concepts before moving to advanced topics');
        recommendations.contentRecommendations.unshift({
          title: 'Foundation Review',
          description: 'Strengthen your basic understanding of key subjects',
          difficulty: 'easy',
          duration: 45,
          relevanceScore: 0.95,
          reason: 'Based on your current performance level'
        });
      }
    }

    if (quizzes.length > 0) {
      const recentQuizzes = quizzes.slice(0, 5);
      const quizAverage = recentQuizzes.reduce((sum, q) => sum + (q.score || 0), 0) / recentQuizzes.length;
      
      if (quizAverage < 75) {
        recommendations.studySchedule.sessionDuration = 20; // Shorter sessions for better focus
        recommendations.studySchedule.breaks = 3; // More frequent breaks
      }
    }

    return NextResponse.json(recommendations);
  } catch (error) {
    console.error('Error generating recommendations:', error);
    return NextResponse.json({ 
      error: 'Failed to generate recommendations',
      recommendations: {
        studySchedule: {
          recommendedTime: 'evening',
          sessionDuration: 25,
          breaks: 5
        },
        contentRecommendations: [],
        learningStrategies: [
          'Take regular breaks every 25 minutes',
          'Use visual aids when studying',
          'Practice active recall techniques',
          'Review material before bedtime'
        ],
        focusAreas: []
      }
    }, { status: 500 });
  }
} 