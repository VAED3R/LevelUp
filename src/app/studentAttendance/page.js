"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import Navbar from "@/components/studentNavbar";
import IntroAnimation from "../../components/IntroAnimation";
import styles from './page.module.css';

export default function StudentAttendance() {
  const { user } = useAuth();
  const [selectedSubject, setSelectedSubject] = useState('');
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [stats, setStats] = useState({
    totalClasses: 0,
    present: 0,
    absent: 0,
    percentage: 0
  });
  const [overallStats, setOverallStats] = useState({
    totalClasses: 0,
    present: 0,
    absent: 0,
    percentage: 0
  });
  const [showOverall, setShowOverall] = useState(true);

  useEffect(() => {
    if (user) {
      fetchSubjects();
      fetchOverallAttendance();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedSubject) {
      fetchAttendance();
    }
  }, [user, selectedSubject]);

  const fetchSubjects = async () => {
    try {
      const usersRef = collection(db, 'users');
      const teachersQuery = query(usersRef, where('role', '==', 'teacher'));
      const querySnapshot = await getDocs(teachersQuery);
      
      const allSubjects = new Set();
      querySnapshot.forEach((doc) => {
        const teacherData = doc.data();
        if (teacherData.subject) {
          teacherData.subject.split(',').forEach(subject => {
            allSubjects.add(subject.trim().toLowerCase().replace(/ /g, '_'));
          });
        }
      });

      setSubjects(Array.from(allSubjects).sort());
      setLoading(false);
    } catch (err) {
      console.error('Error fetching subjects:', err);
      setError('Failed to fetch subjects. Please try again later.');
      setLoading(false);
    }
  };

  const fetchAttendance = async () => {
    try {
      setLoading(true);
      setError(null);

      if (!selectedSubject) {
        setAttendance([]);
        setStats({
          totalClasses: 0,
          present: 0,
          absent: 0,
          percentage: 0
        });
        return;
      }

      const attendanceRef = collection(db, 'attendance');
      const q = query(
        attendanceRef,
        where('studentId', '==', user.uid),
        where('subject', '==', selectedSubject)
      );

      const querySnapshot = await getDocs(q);
      const attendanceData = [];
      let presentCount = 0;
      let absentCount = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        
        // Format the date string to a readable format
        let formattedDate = "Unknown Date";
        if (data.addedAt) {
          try {
            const dateObj = new Date(data.addedAt);
            formattedDate = dateObj.toLocaleDateString();
          } catch (err) {
            console.error("Error formatting date:", err);
          }
        }
        
        attendanceData.push({
          id: doc.id,
          date: formattedDate,
          status: data.status,
          subject: data.subject
        });

        if (data.status === 'present') {
          presentCount++;
        } else if (data.status === 'absent') {
          absentCount++;
        }
      });

      const totalClasses = attendanceData.length;
      const percentage = totalClasses > 0 ? Math.round((presentCount / totalClasses) * 100) : 0;

      setAttendance(attendanceData);
      setStats({
        totalClasses,
        present: presentCount,
        absent: absentCount,
        percentage
      });
    } catch (err) {
      console.error('Error fetching attendance:', err);
      setError('Failed to fetch attendance data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const fetchOverallAttendance = async () => {
    try {
      if (!user || !user.uid) {
        console.log('No user or user.uid available');
        return;
      }

      console.log('Fetching overall attendance for user:', user.uid);
      const attendanceRef = collection(db, 'attendance');
      
      // Try different possible field names for student ID
      const possibleFields = ['studentId', 'student_id', 'userId', 'user_id', 'uid'];
      let querySnapshot = null;
      let usedField = null;

      for (const field of possibleFields) {
        try {
          const q = query(attendanceRef, where(field, '==', user.uid));
          const snapshot = await getDocs(q);
          if (snapshot.size > 0) {
            querySnapshot = snapshot;
            usedField = field;
            console.log(`Found attendance records using field: ${field}`);
            break;
          }
        } catch (err) {
          console.log(`Field ${field} not found or error:`, err);
        }
      }

      // If no records found with specific fields, try without any filter
      if (!querySnapshot) {
        console.log('Trying to fetch all attendance records...');
        querySnapshot = await getDocs(attendanceRef);
      }

      console.log('Found attendance records:', querySnapshot.size);
      
      let totalPresent = 0;
      let totalAbsent = 0;
      let totalClasses = 0;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        console.log('Attendance record:', data);
        
        // Check if this record belongs to the current user
        const isUserRecord = usedField ? 
          data[usedField] === user.uid : 
          (data.studentId === user.uid || 
           data.student_id === user.uid || 
           data.userId === user.uid || 
           data.user_id === user.uid || 
           data.uid === user.uid);

        if (isUserRecord) {
          totalClasses++;
          
          if (data.status === 'present') {
            totalPresent++;
          } else if (data.status === 'absent') {
            totalAbsent++;
          }
        }
      });

      const overallPercentage = totalClasses > 0 ? Math.round((totalPresent / totalClasses) * 100) : 0;

      console.log('Overall stats calculated:', {
        totalClasses,
        totalPresent,
        totalAbsent,
        overallPercentage,
        usedField
      });

      setOverallStats({
        totalClasses,
        present: totalPresent,
        absent: totalAbsent,
        percentage: overallPercentage
      });
    } catch (err) {
      console.error('Error fetching overall attendance:', err);
      setError('Failed to fetch overall attendance data.');
    }
  };

  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
    setShowOverall(false);
  };

  const toggleOverallView = () => {
    setShowOverall(!showOverall);
    if (!showOverall) {
      setSelectedSubject('');
    }
  };

  if (!user) {
    return (
      <div>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.content}>
            <div className={styles.error}>Please log in to view attendance.</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <IntroAnimation loadingText="Loading Attendance Records...">
      <div>
        <Navbar />
        <div className={styles.container}>
          <div className={styles.content}>
            <h1 className={styles.title}>Attendance</h1>
            
            <div className={styles.viewToggle}>
              <button 
                className={`${styles.toggleButton} ${showOverall ? styles.active : ''}`}
                onClick={toggleOverallView}
              >
                Total Attendance
              </button>
              <button 
                className={`${styles.toggleButton} ${!showOverall ? styles.active : ''}`}
                onClick={() => {
                  setShowOverall(false);
                  setSelectedSubject('');
                }}
              >
                Subject Wise
              </button>
            </div>

            {showOverall ? (
              <div className={styles.attendanceContainer}>
                <div className={styles.overallHeader}>
                  <h2 className={styles.overallTitle}>Overall Attendance</h2>
                  <button 
                    className={styles.refreshButton}
                    onClick={fetchOverallAttendance}
                  >
                    🔄 Refresh
                  </button>
                </div>
                <div className={styles.statsContainer}>
                  <div className={styles.statCard}>
                    <h3>Total Classes</h3>
                    <p>{overallStats.totalClasses}</p>
                  </div>
                  <div className={styles.statCard}>
                    <h3>Present</h3>
                    <p>{overallStats.present}</p>
                  </div>
                  <div className={styles.statCard}>
                    <h3>Absent</h3>
                    <p>{overallStats.absent}</p>
                  </div>
                  <div className={styles.statCard}>
                    <h3>Overall %</h3>
                    <p>{overallStats.percentage}%</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className={styles.subjectSelector}>
                  <label htmlFor="subject">Select Subject</label>
                  <select
                    id="subject"
                    value={selectedSubject}
                    onChange={handleSubjectChange}
                  >
                    <option value="">Choose a subject</option>
                    {subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject.replace(/_/g, ' ')}
                      </option>
                    ))}
                  </select>
                </div>

                {loading ? (
                  <div className={styles.loading}>Loading...</div>
                ) : error ? (
                  <div className={styles.error}>{error}</div>
                ) : selectedSubject ? (
                  <div className={styles.attendanceContainer}>
                    <h2 className={styles.subjectTitle}>{selectedSubject.replace(/_/g, ' ')} Attendance</h2>
                    <div className={styles.statsContainer}>
                      <div className={styles.statCard}>
                        <h3>Total Classes</h3>
                        <p>{stats.totalClasses}</p>
                      </div>
                      <div className={styles.statCard}>
                        <h3>Present</h3>
                        <p>{stats.present}</p>
                      </div>
                      <div className={styles.statCard}>
                        <h3>Absent</h3>
                        <p>{stats.absent}</p>
                      </div>
                      <div className={styles.statCard}>
                        <h3>Attendance %</h3>
                        <p>{stats.percentage}%</p>
                      </div>
                    </div>

                    <div className={styles.attendanceList}>
                      {attendance.map((record) => (
                        <div
                          key={record.id}
                          className={`${styles.attendanceItem} ${styles[record.status]}`}
                        >
                          <p>{record.date}</p>
                          <p>{record.status.toUpperCase()}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.loading}>Select a subject to view attendance</div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </IntroAnimation>
  );
}
