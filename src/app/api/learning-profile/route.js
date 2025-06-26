import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
  }

  try {
    const profileRef = doc(db, 'learningProfiles', studentId);
    const profileDoc = await getDoc(profileRef);

    if (!profileDoc.exists()) {
      return NextResponse.json({ error: 'Learning profile not found' }, { status: 404 });
    }

    const profile = profileDoc.data();
    return NextResponse.json({ profile });
  } catch (error) {
    console.error('Error fetching learning profile:', error);
    return NextResponse.json({ error: 'Failed to fetch learning profile' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { studentId, updates } = body;

    if (!studentId || !updates) {
      return NextResponse.json({ error: 'Student ID and updates are required' }, { status: 400 });
    }

    const profileRef = doc(db, 'learningProfiles', studentId);
    const profileDoc = await getDoc(profileRef);

    if (!profileDoc.exists()) {
      // Create new profile if it doesn't exist
      const defaultProfile = {
        learningStyle: 'visual',
        preferredDifficulty: 'medium',
        studyTimePreference: 'evening',
        attentionSpan: 25,
        subjects: {},
        learningGoals: [],
        strengths: [],
        weaknesses: [],
        interests: [],
        lastUpdated: new Date().toISOString(),
        ...updates
      };
      await setDoc(profileRef, defaultProfile);
      return NextResponse.json({ profile: defaultProfile });
    } else {
      // Update existing profile
      await updateDoc(profileRef, {
        ...updates,
        lastUpdated: new Date().toISOString()
      });
      
      const updatedDoc = await getDoc(profileRef);
      return NextResponse.json({ profile: updatedDoc.data() });
    }
  } catch (error) {
    console.error('Error updating learning profile:', error);
    return NextResponse.json({ error: 'Failed to update learning profile' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { studentId, action, data } = body;

    if (!studentId || !action) {
      return NextResponse.json({ error: 'Student ID and action are required' }, { status: 400 });
    }

    const profileRef = doc(db, 'learningProfiles', studentId);
    const profileDoc = await getDoc(profileRef);

    if (!profileDoc.exists()) {
      return NextResponse.json({ error: 'Learning profile not found' }, { status: 404 });
    }

    const profile = profileDoc.data();
    let updates = {};

    switch (action) {
      case 'addGoal':
        const newGoal = {
          id: Date.now().toString(),
          title: data.title,
          description: data.description,
          deadline: data.deadline,
          priority: data.priority || 'medium',
          category: data.category || 'academic',
          progress: 0,
          createdAt: new Date().toISOString(),
          lastUpdated: new Date().toISOString()
        };
        updates = {
          learningGoals: [...(profile.learningGoals || []), newGoal]
        };
        break;

      case 'updateGoal':
        const updatedGoals = profile.learningGoals.map(goal => 
          goal.id === data.goalId ? { 
            ...goal, 
            ...data.updates,
            lastUpdated: new Date().toISOString()
          } : goal
        );
        updates = { learningGoals: updatedGoals };
        break;

      case 'deleteGoal':
        const filteredGoals = profile.learningGoals.filter(goal => goal.id !== data.goalId);
        updates = { learningGoals: filteredGoals };
        break;

      case 'updateGoalProgress':
        const progressUpdatedGoals = profile.learningGoals.map(goal => 
          goal.id === data.goalId ? { 
            ...goal, 
            progress: data.progress,
            lastUpdated: new Date().toISOString()
          } : goal
        );
        updates = { learningGoals: progressUpdatedGoals };
        break;

      case 'addInterest':
        updates = {
          interests: [...new Set([...(profile.interests || []), data.interest])]
        };
        break;

      case 'updateLearningStyle':
        updates = { learningStyle: data.learningStyle };
        break;

      case 'updateStudyPreferences':
        updates = {
          studyTimePreference: data.studyTimePreference,
          attentionSpan: data.attentionSpan
        };
        break;

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    await updateDoc(profileRef, {
      ...updates,
      lastUpdated: new Date().toISOString()
    });

    const updatedDoc = await getDoc(profileRef);
    return NextResponse.json({ profile: updatedDoc.data() });
  } catch (error) {
    console.error('Error updating learning profile:', error);
    return NextResponse.json({ error: 'Failed to update learning profile' }, { status: 500 });
  }
} 