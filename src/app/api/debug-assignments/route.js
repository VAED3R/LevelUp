import { NextResponse } from 'next/server';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, orderBy } from 'firebase/firestore';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const studentId = searchParams.get('studentId');

  if (!studentId) {
    return NextResponse.json({ error: 'Student ID is required' }, { status: 400 });
  }

  try {
    // Test assignment fetching
    const assignmentsRef = collection(db, 'assignments');
    const assignmentsQuery = query(
      assignmentsRef,
      where('studentId', '==', studentId),
      orderBy('addedAt', 'desc')
    );
    const assignmentsSnapshot = await getDocs(assignmentsQuery);
    
    const assignments = assignmentsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    // Test without orderBy to see if that's the issue
    const assignmentsQuery2 = query(
      assignmentsRef,
      where('studentId', '==', studentId)
    );
    const assignmentsSnapshot2 = await getDocs(assignmentsQuery2);
    
    const assignments2 = assignmentsSnapshot2.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));

    return NextResponse.json({ 
      success: true,
      studentId,
      assignmentsWithOrderBy: assignments,
      assignmentsWithoutOrderBy: assignments2,
      totalAssignments: assignments.length,
      totalAssignments2: assignments2.length
    });
  } catch (error) {
    console.error('Error debugging assignments:', error);
    return NextResponse.json({ 
      error: 'Failed to debug assignments',
      message: error.message,
      studentId
    }, { status: 500 });
  }
} 