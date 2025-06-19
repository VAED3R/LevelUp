"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function TestResults() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("");
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [percentages, setPercentages] = useState({});
  const [totalScore, setTotalScore] = useState("");
  const [allSubjectsData, setAllSubjectsData] = useState([]);
  const [allStudents, setAllStudents] = useState([]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setTeacherEmail(user.email);
      } else {
        setTeacherEmail("");
      }
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!teacherEmail) return;

    const fetchData = async () => {
      try {
        // Fetch subjects and semesters from subjects collection
        const subjectsQuery = await getDocs(collection(db, "subjects"));
        const subjectsData = subjectsQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log("All subjects from collection:", subjectsData);

        // Store all subjects data for filtering later
        setAllSubjectsData(subjectsData);

        // Extract unique semesters
        const uniqueSemesters = [...new Set(
          subjectsData.map(subject => subject.semester).filter(Boolean)
        )];

        console.log("Available semesters:", uniqueSemesters);
        setSemesters(uniqueSemesters.sort());
        
        // Clear subjects initially
        setSubjects([]);

        // Fetch students from users collection
        const usersQuery = await getDocs(collection(db, "users"));
        const usersList = usersQuery.docs
          .filter((doc) => doc.data().role === "student")
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

        // Fetch students from students collection
        const studentsQuery = await getDocs(collection(db, "students"));
        const studentsList = studentsQuery.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        // Create a map of existing student documents
        const studentsMap = {};
        studentsList.forEach(student => {
          studentsMap[student.id] = student;
        });

        // Ensure all users are in the students collection
        let batch = writeBatch(db);
        let batchCount = 0;
        const batchPromises = [];

        for (const user of usersList) {
          if (!studentsMap[user.id]) {
            // Student doesn't exist in students collection, create it
            const studentRef = doc(db, "students", user.id);
            const studentData = {
              ...user,
              points: [],
              totalPoints: 0,
              lastUpdated: new Date().toISOString()
            };
            
            batch.set(studentRef, studentData);
            batchCount++;
            
            if (batchCount >= 500) {
              // Firestore has a limit of 500 operations per batch
              batchPromises.push(batch.commit());
              batch = writeBatch(db);
              batchCount = 0;
            }
          }
        }
        
        // Commit any remaining operations
        if (batchCount > 0) {
          batchPromises.push(batch.commit());
        }
        
        // Wait for all batches to complete
        if (batchPromises.length > 0) {
          await Promise.all(batchPromises);
        }

        // Now fetch the updated students list
        const updatedStudentsQuery = await getDocs(collection(db, "students"));
        const updatedStudentsList = updatedStudentsQuery.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));

        setAllStudents(updatedStudentsList);
        setStudents(updatedStudentsList);

        // Extract unique classes
        const uniqueClasses = [...new Set(updatedStudentsList.map((student) => student.class))];
        setClasses(uniqueClasses.sort());
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data. Please try again later.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teacherEmail]);

  // Filter subjects based on selected semester
  useEffect(() => {
    if (selectedSemester && allSubjectsData.length > 0) {
      // Filter subjects by selected semester
      const filteredSubjects = allSubjectsData.filter(
        subject => subject.semester === selectedSemester
      );

      // Extract unique subject names for the selected semester
      const uniqueSubjects = [...new Set(
        filteredSubjects.map(subject => subject.courseName).filter(Boolean)
      )];

      console.log(`Subjects for semester ${selectedSemester}:`, uniqueSubjects);
      setSubjects(uniqueSubjects.sort());
      
      // Reset selected subject when semester changes
      setSelectedSubject("");
    } else {
      setSubjects([]);
      setSelectedSubject("");
    }
  }, [selectedSemester, allSubjectsData]);

  // Filter students based on class and subject using coursemap
  useEffect(() => {
    if (selectedClass && selectedSubject) {
      const fetchStudentsForSubject = async () => {
        try {
          // Fetch coursemap data for the selected subject
          const coursemapQuery = await getDocs(collection(db, "coursemap"));
          const coursemapData = coursemapQuery.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));

          console.log("Coursemap data:", coursemapData);

          // Find students enrolled in the selected subject
          const enrolledStudents = coursemapData.filter(course => {
            // Check if the student is in the selected class
            if (course.class !== selectedClass) return false;
            
            // Check if any semester contains the selected subject
            if (course.semesters && Array.isArray(course.semesters)) {
              return course.semesters.some(semester => 
                semester.courses && Array.isArray(semester.courses) &&
                semester.courses.some(courseItem => 
                  courseItem.courseName === selectedSubject
                )
              );
            }
            return false;
          });

          console.log("Enrolled students for subject:", enrolledStudents);

          // Get student IDs enrolled in this subject
          const enrolledStudentIds = enrolledStudents.map(course => course.studentId);

          // Filter students by class and enrollment
          const filtered = allStudents.filter(student => 
            student.class === selectedClass && 
            enrolledStudentIds.includes(student.id)
          );

          // Sort students alphabetically by name
          const sortedStudents = filtered.sort((a, b) => 
            a.name.localeCompare(b.name)
          );

          console.log("Filtered students:", sortedStudents);
          setFilteredStudents(sortedStudents);

          // Initialize marks for each student
          const initialMarks = {};
          sortedStudents.forEach(student => {
            initialMarks[student.id] = {
              obtained: "0",
              total: totalScore || "0"
            };
          });
          setMarks(initialMarks);
        } catch (error) {
          console.error("Error fetching coursemap data:", error);
          setFilteredStudents([]);
          setMarks({});
        }
      };

      fetchStudentsForSubject();
    } else {
      setFilteredStudents([]);
      setMarks({});
    }
  }, [selectedClass, selectedSubject, allStudents, totalScore]);

  const calculatePercentage = (obtained, total) => {
    if (!obtained || !total || total === 0) return 0;
    return ((obtained / total) * 100).toFixed(2);
  };

  const handleMarksChange = (studentId, field) => (e) => {
    const value = e.target.value;
    if (value === "" || (value >= 0 && value <= Number(totalScore))) {
      setMarks(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [field]: value
        }
      }));

      // Calculate percentage when obtained marks change
      if (field === "obtained" && totalScore) {
        const percentage = calculatePercentage(
          Number(value),
          Number(totalScore)
        );
        setPercentages(prev => ({
          ...prev,
          [studentId]: percentage
        }));
      }
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Focus on the next input if available
      const inputs = document.querySelectorAll('input[type="number"]');
      const currentIndex = Array.from(inputs).indexOf(e.target);
      if (currentIndex < inputs.length - 1) {
        inputs[currentIndex + 1].focus();
      }
    }
  };

  const handleTotalScoreChange = (e) => {
    const value = e.target.value;
    if (value === "" || (value >= 0 && value <= 100)) {
      setTotalScore(value);
      // Reset all obtained marks when total score changes
      const resetMarks = {};
      filteredStudents.forEach(student => {
        resetMarks[student.id] = {
          obtained: "0",
          total: value
        };
      });
      setMarks(resetMarks);
      setPercentages({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !selectedSemester) {
      setError("Please select a class, subject, and semester");
      return;
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      const promises = filteredStudents.map(async (student) => {
        const studentMarks = marks[student.id];
        // If marks are empty or not filled, use 0 as default
        const obtainedMarks = Number(studentMarks.obtained) || 0;
        const totalMarks = Number(studentMarks.total) || 0;
        const percentage = Number(calculatePercentage(obtainedMarks, totalMarks));

        const marksData = {
          studentId: student.id,
          studentName: student.name,
          class: selectedClass,
          subject: selectedSubject,
          semester: selectedSemester,
          obtainedMarks: obtainedMarks,
          totalMarks: totalMarks,
          percentage: percentage,
          addedBy: auth.currentUser.uid,
          addedAt: new Date().toISOString(),
        };

        // Add marks to the marks collection
        const marksRef = doc(collection(db, "marks"));
        batch.set(marksRef, marksData);

        // Calculate points based on percentage
        let pointsToAdd = 0;
        if (percentage >= 90 && percentage <= 100) {
          pointsToAdd = 50;
        } else if (percentage >= 80 && percentage < 90) {
          pointsToAdd = 25;
        } else if (percentage >= 70 && percentage < 80) {
          pointsToAdd = 15;
        } else if (percentage >= 60 && percentage < 70) {
          pointsToAdd = 10;
        } else if (percentage >= 50 && percentage < 60) {
          pointsToAdd = 5;
        } else if (percentage >= 40 && percentage < 50) {
          pointsToAdd = 2;
        }

        // Only proceed if points are earned
        if (pointsToAdd > 0) {
          // Create a new assessment points entry
          const newPointsEntry = {
            points: pointsToAdd,
            date: new Date().toISOString(),
            subject: selectedSubject,
            semester: selectedSemester,
            score: percentage,
            totalQuestions: totalMarks,
            quizId: "test_result_" + new Date().getTime(), // Unique ID for test result
            topic: "test_result",
            userId: student.id,
            type: "assessment" // Add type field to identify as assessment points
          };

          // Check if student document exists in students collection
          const studentRef = doc(db, "students", student.id);
          const studentDoc = await getDoc(studentRef);
          
          if (studentDoc.exists()) {
            // Student exists, update points array
            const studentData = studentDoc.data();
            
            // Get the current points array or initialize an empty array
            let currentPointsArray = [];
            if (studentData.points && Array.isArray(studentData.points)) {
              currentPointsArray = [...studentData.points];
            }
            
            // Add the new assessment points entry to the array
            currentPointsArray.push(newPointsEntry);
            
            // Calculate total points
            const totalPoints = calculateTotalPoints(currentPointsArray);
            
            // Update the student document with the new points array and total points
            batch.update(studentRef, {
              points: currentPointsArray,
              totalPoints: totalPoints
            });
            
            console.log(`Added ${pointsToAdd} points for ${student.name} for test result in ${selectedSubject}. Total points: ${totalPoints}`);
          } else {
            // Student doesn't exist, create new document
            const newStudentData = {
              id: student.id,
              name: student.name,
              email: student.email || "",
              class: student.class,
              createdAt: new Date().toISOString(),
              points: [newPointsEntry],
              totalPoints: pointsToAdd
            };
            
            batch.set(studentRef, newStudentData);
            console.log(`Creating new student document for ${student.name} with ${pointsToAdd} assessment points.`);
          }
        }
      });

      await Promise.all(promises);
      await batch.commit();
      
      setSuccess(true);
      setError(null);
      
      // Reset form
      const resetMarks = {};
      filteredStudents.forEach(student => {
        resetMarks[student.id] = {
          obtained: "0",
          total: "0"
        };
      });
      setMarks(resetMarks);
    } catch (error) {
      console.error("Error adding test results:", error);
      setError("Failed to add test results");
      setSuccess(false);
    } finally {
      setLoading(false);
    }
  };

  // Helper function to calculate total points
  const calculateTotalPoints = (pointsArray) => {
    if (!pointsArray || !Array.isArray(pointsArray)) return 0;
    
    return pointsArray.reduce((total, entry) => {
      return total + (entry.points || 0);
    }, 0);
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p className={styles.loadingText}>Loading test results...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.errorState}>
            <div className={styles.errorIcon}>❌</div>
            <h2 className={styles.errorTitle}>Error</h2>
            <div className={styles.error}>{error}</div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h1 className={styles.sectionTitle}>Add Test Results</h1>
            <p className={styles.sectionSubtitle}>Enter and manage student test scores</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.testForm}>
            <div className={styles.filtersRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Class</label>
                <select
                  key="class-select"
                  value={selectedClass}
                  onChange={(e) => setSelectedClass(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">Select Class</option>
                  {classes.map((className, index) => (
                    <option key={index} value={className}>
                      {className}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Semester</label>
                <select
                  key="semester-select"
                  value={selectedSemester}
                  onChange={(e) => setSelectedSemester(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">Select Semester</option>
                  {semesters.map((semesterItem) => (
                    <option key={semesterItem} value={semesterItem}>
                      {semesterItem}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Subject</label>
                <select
                  key="subject-select"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className={styles.select}
                  required
                  disabled={!selectedSemester}
                >
                  <option value="">
                    {selectedSemester ? "Select Subject" : "Select semester first"}
                  </option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject}
                    </option>
                  ))}
                </select>
              </div>

              <div className={styles.formGroup}>
                <label className={styles.label}>Total Score</label>
                <input
                  key="total-score-input"
                  type="number"
                  value={totalScore}
                  onChange={handleTotalScoreChange}
                  min="0"
                  max="100"
                  className={styles.input}
                  required
                  placeholder="Enter total score"
                />
              </div>
            </div>

            {filteredStudents.length > 0 ? (
              <div className={styles.studentsSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Enter Marks</h2>
                  <p className={styles.sectionSubtitle}>
                    Only fill in marks for students who have taken the test. Students who haven't taken the test will automatically get 0 marks.
                  </p>
                </div>

                <div className={styles.studentsGrid}>
                  {filteredStudents.map((student) => (
                    <div key={student.id} className={styles.studentCard}>
                      <div className={styles.studentHeader}>
                        <div className={styles.studentIcon}>👤</div>
                        <h3 className={styles.studentName}>{student.name}</h3>
                      </div>
                      <div className={styles.marksInputs}>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Obtained Marks</label>
                          <input
                            key={`${student.id}-obtained`}
                            type="number"
                            value={marks[student.id]?.obtained || "0"}
                            onChange={handleMarksChange(student.id, "obtained")}
                            min="0"
                            max={totalScore}
                            className={styles.input}
                            placeholder="Enter marks if taken test"
                          />
                        </div>
                        <div className={styles.percentageDisplay}>
                          <span className={styles.percentageLabel}>Percentage</span>
                          <span className={styles.percentageValue}>
                            {percentages[student.id] || "0"}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              selectedClass && selectedSubject && (
                <div className={styles.emptyState}>
                  <div className={styles.emptyIcon}>👥</div>
                  <p className={styles.emptyText}>No students found enrolled in {selectedSubject} for {selectedClass}</p>
                </div>
              )
            )}

            {error && (
              <div className={`${styles.message} ${styles.error}`}>
                <span className={styles.messageIcon}>❌</span>
                {error}
              </div>
            )}
            
            {success && (
              <div className={`${styles.message} ${styles.success}`}>
                <span className={styles.messageIcon}>✅</span>
                Marks added successfully!
              </div>
            )}

            {filteredStudents.length > 0 && (
              <div className={styles.submitSection}>
                <button type="submit" className={styles.submitButton}>
                  <span className={styles.buttonIcon}>💾</span>
                  Add Marks
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
