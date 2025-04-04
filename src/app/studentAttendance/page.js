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

  useEffect(() => {
    if (user) {
      fetchSubjects();
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

  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
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
          </div>
        </div>
      </div>
    </IntroAnimation>
  );
}
