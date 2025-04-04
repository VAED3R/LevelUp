"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import Navbar from "@/components/parentNavbar";
import styles from './page.module.css';

export default function ParentDashboard() {
  const { user } = useAuth();
  const [childData, setChildData] = useState(null);
  const [parentName, setParentName] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchParentAndChildData();
    }
  }, [user]);

  const fetchParentAndChildData = async () => {
    try {
      const usersRef = collection(db, 'users');
      
      // First, get the parent's document
      const parentQuery = query(
        usersRef, 
        where('email', '==', user.email),
        where('role', '==', 'parent')
      );
      const parentSnapshot = await getDocs(parentQuery);
      
      if (!parentSnapshot.empty) {
        const parentDoc = parentSnapshot.docs[0];
        const parentData = parentDoc.data();
        
        // Set parent name
        setParentName(parentData.name);
        
        // Get child's email from parent document
        const childEmail = parentData.child;
        
        if (childEmail) {
          // Now fetch the child's document from users collection
          const childQuery = query(
            usersRef, 
            where('email', '==', childEmail),
            where('role', '==', 'student')
          );
          const childSnapshot = await getDocs(childQuery);
          
          if (!childSnapshot.empty) {
            const childDoc = childSnapshot.docs[0];
            const childUserData = childDoc.data();
            
            // Get the student document from the students collection
            const studentRef = doc(db, "students", childDoc.id);
            const studentSnap = await getDoc(studentRef);
            
            if (studentSnap.exists()) {
              // Combine data from both collections
              const completeChildData = {
                id: childDoc.id,
                ...childUserData,
                ...studentSnap.data()
              };
              setChildData(completeChildData);
            } else {
              setError('Student data not found in students collection');
            }
          } else {
            setError('Child account not found');
          }
        } else {
          setError('No child email found in parent document');
        }
      } else {
        setError('Parent data not found');
      }
    } catch (err) {
      console.error('Error fetching data:', err);
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.error}>Please log in to view the dashboard.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Welcome, {parentName}</h1>
          <p className={styles.subtitle}>Parent Dashboard</p>
        </div>

        {loading ? (
          <div className={styles.loading}>Loading data...</div>
        ) : error ? (
          <div className={styles.error}>{error}</div>
        ) : (
          <div className={styles.studentInfo}>
            <h2>Child Information</h2>
            <p><strong>Name:</strong> {childData?.name}</p>
            <p><strong>Class:</strong> {childData?.class}</p>
            <p><strong>Email:</strong> {childData?.email}</p>
            <p><strong>Total Points:</strong> {childData?.totalPoints || 0}</p>
          </div>
        )}
      </div>
    </div>
  );
}
