import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';

// Migration function to update existing profiles with new fields
function migrateProfile(profile) {
  const migrated = {
    ...profile,
    studyPreference: profile.studyPreference || 'mixed',
    learningStyle: profile.learningStyle || 'active',
    attentionSpan: profile.attentionSpan || 30,
    studyTimePreference: profile.studyTimePreference || 'morning',
    preferredDifficulty: profile.preferredDifficulty || 'medium',
    lastUpdated: new Date().toISOString()
  };
  
  return migrated;
}

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
    
    // Check if profile needs migration
    const needsMigration = !profile.studyPreference || !profile.learningStyle;
    
    if (needsMigration) {
      const migratedProfile = migrateProfile(profile);
      await updateDoc(profileRef, migratedProfile);
      return NextResponse.json({ profile: migratedProfile });
    }
    
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
        learningStyle: 'active',
        studyPreference: 'visual',
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
      const currentProfile = profileDoc.data();
      const migratedProfile = migrateProfile(currentProfile);
      
      await updateDoc(profileRef, {
        ...migratedProfile,
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
    const { studentId, attentionSpan, studyPreference, learningStyle, studyTimePreference, preferredDifficulty } = body;

    if (!studentId) {
      return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
    }

    const profileRef = doc(db, 'learningProfiles', studentId);
    const profileDoc = await getDoc(profileRef);

    if (!profileDoc.exists()) {
      return NextResponse.json({ error: 'Learning profile not found' }, { status: 404 });
    }

    const updateData = {};
    if (attentionSpan !== undefined) updateData.attentionSpan = attentionSpan;
    if (studyPreference !== undefined) updateData.studyPreference = studyPreference;
    if (learningStyle !== undefined) updateData.learningStyle = learningStyle;
    if (studyTimePreference !== undefined) updateData.studyTimePreference = studyTimePreference;
    if (preferredDifficulty !== undefined) updateData.preferredDifficulty = preferredDifficulty;

    await updateDoc(profileRef, updateData);

    return NextResponse.json({ success: true, message: 'Learning profile updated successfully' });
  } catch (error) {
    console.error('Error updating learning profile:', error);
    return NextResponse.json({ error: 'Failed to update learning profile' }, { status: 500 });
  }
}

// Migration endpoint to update all existing profiles
export async function PATCH(request) {
  try {
    const body = await request.json();
    const { action } = body;

    if (action !== 'migrateAllProfiles') {
      return NextResponse.json({ error: 'Invalid migration action' }, { status: 400 });
    }

    // Get all learning profiles
    const profilesRef = collection(db, 'learningProfiles');
    const profilesSnapshot = await getDocs(profilesRef);
    
    const migrationResults = {
      total: profilesSnapshot.size,
      migrated: 0,
      errors: []
    };

    // Update each profile
    for (const docSnapshot of profilesSnapshot.docs) {
      try {
        const profile = docSnapshot.data();
        const needsMigration = !profile.studyPreference || !profile.learningStyle;
        
        if (needsMigration) {
          const migratedProfile = migrateProfile(profile);
          await updateDoc(docSnapshot.ref, migratedProfile);
          migrationResults.migrated++;
        }
      } catch (error) {
        console.error(`Error migrating profile ${docSnapshot.id}:`, error);
        migrationResults.errors.push({
          profileId: docSnapshot.id,
          error: error.message
        });
      }
    }

    return NextResponse.json({ 
      success: true, 
      message: `Migration completed. ${migrationResults.migrated} profiles updated out of ${migrationResults.total} total profiles.`,
      results: migrationResults 
    });
  } catch (error) {
    console.error('Error during migration:', error);
    return NextResponse.json({ error: 'Failed to migrate profiles' }, { status: 500 });
  }
} 