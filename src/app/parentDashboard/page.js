"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs, getDoc, doc } from 'firebase/firestore';
import Navbar from "@/components/parentNavbar";
import ParentChatbot from '@/components/ParentChatbot';
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
          <div className={styles.errorCard}>
            <div className={styles.errorIcon}>⚠️</div>
            <h3>Authentication Required</h3>
            <p>Please log in to view the dashboard.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        {/* Welcome Section */}
        <div className={styles.welcomeSection}>
          <div className={styles.welcomeCard}>
            <div className={styles.welcomeIcon}>👋</div>
            <div className={styles.welcomeContent}>
              <h1 className={styles.welcomeTitle}>Welcome back, {parentName}</h1>
              <p className={styles.welcomeSubtitle}>Monitor your child's academic progress</p>
            </div>
          </div>
        </div>

        {loading ? (
          <div className={styles.loadingSection}>
            <div className={styles.loadingCard}>
              <div className={styles.loadingSpinner}></div>
              <h3>Loading your dashboard...</h3>
              <p>Please wait while we fetch your child's information</p>
            </div>
          </div>
        ) : error ? (
          <div className={styles.errorSection}>
            <div className={styles.errorCard}>
              <div className={styles.errorIcon}>❌</div>
              <h3>Error Loading Data</h3>
              <p>{error}</p>
            </div>
          </div>
        ) : (
          <div className={styles.dashboardContent}>
            {/* Child Information Card */}
            <div className={styles.infoSection}>
              <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Child Information</h2>
                <p className={styles.sectionSubtitle}>Personal and academic details</p>
              </div>
              <div className={styles.infoCard}>
                <div className={styles.infoGrid}>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}>👤</div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Full Name</span>
                      <span className={styles.infoValue}>{childData?.name}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}>🎓</div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Class</span>
                      <span className={styles.infoValue}>{childData?.class}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}>📧</div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Email</span>
                      <span className={styles.infoValue}>{childData?.email}</span>
                    </div>
                  </div>
                  <div className={styles.infoItem}>
                    <div className={styles.infoIcon}>⭐</div>
                    <div className={styles.infoContent}>
                      <span className={styles.infoLabel}>Total Points</span>
                      <span className={styles.infoValue}>{childData?.totalPoints || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <ParentChatbot />
    </div>
  );
}
