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
  const [selectedSemester, setSelectedSemester] = useState('6'); // Default to semester 6
  const [attendance, setAttendance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [allSubjectsData, setAllSubjectsData] = useState([]);
  const [stats, setStats] = useState({
    totalClasses: 0,
    present: 0,
    absent: 0,
    percentage: 0
  });
  const [semesterStats, setSemesterStats] = useState({});
  const [showOverall, setShowOverall] = useState(true);
  const [selectedOverallSemester, setSelectedOverallSemester] = useState('6'); // Default to semester 6

  useEffect(() => {
    if (user) {
      fetchSubjectsAndSemesters();
      fetchOverallAttendance();
    }
  }, [user]);

  useEffect(() => {
    if (user && selectedSubject) {
      fetchAttendance();
    }
  }, [user, selectedSubject]);

  // Filter subjects based on selected semester
  useEffect(() => {
    if (selectedSemester && allSubjectsData.length > 0) {
      // Filter courses by selected semester from coursemap
      const filteredCourses = allSubjectsData.filter(
        course => course.semester === selectedSemester
      );

      // Extract unique course names for the selected semester
      const uniqueCourses = [...new Set(
        filteredCourses.map(course => course.courseName).filter(Boolean)
      )];

      console.log(`Courses for semester ${selectedSemester} from coursemap:`, uniqueCourses);
      setSubjects(uniqueCourses.sort());
      
      // Reset selected subject when semester changes
      setSelectedSubject("");
    } else {
      setSubjects([]);
      setSelectedSubject("");
    }
  }, [selectedSemester, allSubjectsData]);

  const fetchSubjectsAndSemesters = async () => {
    try {
      // Fetch subjects and semesters from coursemap collection
      const coursemapQuery = await getDocs(collection(db, "coursemap"));
      const coursemapData = coursemapQuery.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));

      console.log("All courses from coursemap collection:", coursemapData);
      console.log("Current user ID:", user.uid);

      // Filter courses based on current user ID
      const studentCourses = coursemapData.filter(course => {
        return course.studentId === user.uid;
      });

      console.log("Courses mapped to current user:", studentCourses);

      // Extract all courses from the student's coursemap
      const allCourses = [];
      studentCourses.forEach(courseMap => {
        if (courseMap.semesters && Array.isArray(courseMap.semesters)) {
          courseMap.semesters.forEach(semester => {
            if (semester.courses && Array.isArray(semester.courses)) {
              semester.courses.forEach(course => {
                allCourses.push({
                  ...course,
                  semester: course.semester,
                  courseName: course.courseName,
                  courseCode: course.courseCode,
                  courseType: course.courseType
                });
              });
            }
          });
        }
      });

      console.log("All courses for current user:", allCourses);

      // Store all courses data for filtering later
      setAllSubjectsData(allCourses);

      // Extract unique semesters from coursemap collection
      const uniqueSemesters = [...new Set(
        allCourses.map(course => course.semester).filter(Boolean)
      )];

      console.log("Available semesters from coursemap:", uniqueSemesters);
      setSemesters(uniqueSemesters.sort());
      
      // Clear subjects initially
      setSubjects([]);
      setLoading(false);
    } catch (err) {
      console.error('Error fetching courses and semesters:', err);
      setError('Failed to fetch courses and semesters. Please try again later.');
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
          subject: data.subject,
          semester: data.semester
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
      
      const semesterData = {};

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
          // Group by semester
          const semester = data.semester || 'Unknown';
          if (!semesterData[semester]) {
            semesterData[semester] = {
              totalClasses: 0,
              present: 0,
              absent: 0,
              percentage: 0
            };
          }
          
          semesterData[semester].totalClasses++;
          if (data.status === 'present') {
            semesterData[semester].present++;
          } else if (data.status === 'absent') {
            semesterData[semester].absent++;
          }
        }
      });

      // Calculate percentages for each semester
      Object.keys(semesterData).forEach(semester => {
        const semData = semesterData[semester];
        semData.percentage = semData.totalClasses > 0 ? 
          Math.round((semData.present / semData.totalClasses) * 100) : 0;
      });

      console.log('Semester stats:', semesterData);

      setSemesterStats(semesterData);
    } catch (err) {
      console.error('Error fetching overall attendance:', err);
      setError('Failed to fetch overall attendance data.');
    }
  };

  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
    setShowOverall(false);
  };

  const handleSemesterChange = (e) => {
    setSelectedSemester(e.target.value);
    setSelectedSubject('');
    setShowOverall(false);
  };

  const handleOverallSemesterChange = (e) => {
    setSelectedOverallSemester(e.target.value);
  };

  const toggleOverallView = () => {
    setShowOverall(!showOverall);
    if (!showOverall) {
      setSelectedSubject('');
      setSelectedSemester('6'); // Reset to default semester
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
                  setSelectedSemester('6'); // Reset to default semester
                }}
              >
                Subject Wise
              </button>
            </div>

            {showOverall ? (
              <div className={styles.attendanceContainer}>
                <div className={styles.overallHeader}>
                  <h2 className={styles.overallTitle}>Overall Attendance by Semester</h2>
                  <div className={styles.semesterSelector}>
                    <label htmlFor="overallSemester">Select Semester:</label>
                    <select
                      id="overallSemester"
                      value={selectedOverallSemester}
                      onChange={handleOverallSemesterChange}
                      className={styles.select}
                    >
                      {semesters.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </div>
                  <button 
                    className={styles.refreshButton}
                    onClick={fetchOverallAttendance}
                  >
                    🔄 Refresh
                  </button>
                </div>
                
                {/* Semester Stats */}
                <div className={styles.semesterStatsContainer}>
                  {semesterStats[selectedOverallSemester] ? (
                    <div className={styles.semesterStatCard}>
                      <h3 className={styles.semesterTitle}>Semester {selectedOverallSemester}</h3>
                      <div className={styles.statsContainer}>
                        <div className={styles.statCard}>
                          <h4>Total Classes</h4>
                          <p>{semesterStats[selectedOverallSemester].totalClasses}</p>
                        </div>
                        <div className={styles.statCard}>
                          <h4>Present</h4>
                          <p>{semesterStats[selectedOverallSemester].present}</p>
                        </div>
                        <div className={styles.statCard}>
                          <h4>Absent</h4>
                          <p>{semesterStats[selectedOverallSemester].absent}</p>
                        </div>
                        <div className={styles.statCard}>
                          <h4>Overall %</h4>
                          <p>{semesterStats[selectedOverallSemester].percentage}%</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.noData}>
                      <p>No attendance records found for Semester {selectedOverallSemester}.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <>
                <div className={styles.subjectSelector}>
                  <div className={styles.formGroup}>
                    <label htmlFor="semester">Select Semester</label>
                    <select
                      id="semester"
                      value={selectedSemester}
                      onChange={handleSemesterChange}
                    >
                      {semesters.map((semester) => (
                        <option key={semester} value={semester}>
                          Semester {semester}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className={styles.formGroup}>
                    <label htmlFor="subject">Select Subject</label>
                    <select
                      id="subject"
                      value={selectedSubject}
                      onChange={handleSubjectChange}
                      disabled={!selectedSemester}
                    >
                      <option value="">
                        {selectedSemester ? "Choose a subject" : "Select semester first"}
                      </option>
                      {subjects.map((subject) => (
                        <option key={subject} value={subject}>
                          {subject}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {loading ? (
                  <div className={styles.loading}>Loading...</div>
                ) : error ? (
                  <div className={styles.error}>{error}</div>
                ) : selectedSubject ? (
                  <div className={styles.attendanceContainer}>
                    <h2 className={styles.subjectTitle}>
                      {selectedSubject} Attendance (Semester {selectedSemester})
                    </h2>
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
                          {record.semester && <p>Semester: {record.semester}</p>}
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className={styles.loading}>
                    {selectedSemester ? "Select a subject to view attendance" : "Select a semester to view attendance"}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </IntroAnimation>
  );
}
