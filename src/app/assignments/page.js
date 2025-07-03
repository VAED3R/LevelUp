"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function Assignments() {
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
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");
  const [commonTotalMarks, setCommonTotalMarks] = useState("");
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

          console.log("Enrolled students:", enrolledStudents);

          // Get the actual student data for enrolled students
          const enrolledStudentIds = enrolledStudents.map(course => course.studentId);
          const filteredStudentsList = allStudents.filter(student => 
            enrolledStudentIds.includes(student.id)
          );

          console.log("Filtered students:", filteredStudentsList);
          
          // Sort students alphabetically by name
          const sortedStudents = filteredStudentsList.sort((a, b) => {
            const nameA = (a.name || '').toLowerCase();
            const nameB = (b.name || '').toLowerCase();
            return nameA.localeCompare(nameB);
          });
          
          setFilteredStudents(sortedStudents);

          // Initialize marks for filtered students with empty values
          const initialMarks = {};
          filteredStudentsList.forEach(student => {
            initialMarks[student.id] = {
              obtained: "",
              total: ""
            };
          });
          setMarks(initialMarks);
        } catch (error) {
          console.error("Error fetching students for subject:", error);
          setError("Failed to load students for the selected subject.");
        }
      };

      fetchStudentsForSubject();
    } else {
      setFilteredStudents([]);
    }
  }, [selectedClass, selectedSubject, allStudents]);

  const handleMarksChange = (studentId, field) => (e) => {
    const value = e.target.value;
    // Only allow numbers and empty string
    if (value === "" || /^\d+$/.test(value)) {
      setMarks(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [field]: value
        }
      }));
    }
  };

  const calculatePercentage = (obtained, total) => {
    if (!obtained || !total || total === 0) return 0;
    return Math.round((parseFloat(obtained) / parseFloat(total)) * 100);
  };

  const handleCommonTotalMarksChange = (e) => {
    const value = e.target.value;
    // Only allow numbers and empty string
    if (value === "" || /^\d+$/.test(value)) {
      setCommonTotalMarks(value);
      
      // Update all students' total marks with the common value
      const updatedMarks = {};
      filteredStudents.forEach(student => {
        updatedMarks[student.id] = {
          ...marks[student.id],
          total: value
        };
      });
      setMarks(updatedMarks);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      // Validate that at least one student has marks
      const hasMarks = Object.values(marks).some(mark => 
        mark.obtained && mark.obtained !== "" && mark.obtained !== "0"
      );

      if (!hasMarks) {
        setError("Please enter marks for at least one student.");
        setLoading(false);
        return;
      }

      // Add assignment data for each student
      const assignmentPromises = filteredStudents.map(async (student) => {
        const studentMarks = marks[student.id];
        const obtainedMarks = parseFloat(studentMarks.obtained) || 0;
        const totalMarks = parseFloat(studentMarks.total) || 0;
        const percentage = calculatePercentage(obtainedMarks, totalMarks);

        const assignmentData = {
          addedAt: new Date().toISOString(),
          addedBy: teacherEmail,
          assignmentDescription: assignmentDescription,
          assignmentTitle: assignmentTitle,
          class: selectedClass,
          obtainedMarks: obtainedMarks,
          percentage: percentage,
          semester: selectedSemester,
          studentId: student.id,
          studentName: student.name,
          subject: selectedSubject,
          totalMarks: totalMarks
        };

        await addDoc(collection(db, "assignments"), assignmentData);

        // Update student's total points if they submitted
        if (obtainedMarks > 0) {
          const pointsToAdd = Math.round(percentage / 10); // 1 point per 10%
          
          // Get current student document
          const studentRef = doc(db, "students", student.id);
          const studentDoc = await getDoc(studentRef);
          
          if (studentDoc.exists()) {
            const currentData = studentDoc.data();
            const currentPoints = currentData.points || [];
            
            // Add new points entry
            const newPointsEntry = {
              points: pointsToAdd,
              source: "Assignment",
              assignmentTitle: assignmentTitle,
              subject: selectedSubject,
              date: new Date().toISOString()
            };
            
            const updatedPoints = [...currentPoints, newPointsEntry];
            const newTotalPoints = calculateTotalPoints(updatedPoints);
            
            await updateDoc(studentRef, {
              points: updatedPoints,
              totalPoints: newTotalPoints,
              lastUpdated: new Date().toISOString()
            });
          }
        }
      });

      await Promise.all(assignmentPromises);
      setSuccess(true);
      
      // Reset form
      setAssignmentTitle("");
      setAssignmentDescription("");
      setSelectedSemester("");
      setSelectedSubject("");
      setCommonTotalMarks("");
      const resetMarks = {};
      filteredStudents.forEach(student => {
        resetMarks[student.id] = {
          obtained: "",
          total: ""
        };
      });
      setMarks(resetMarks);
    } catch (error) {
      console.error("Error adding assignment marks:", error);
      setError("Failed to add assignment marks");
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
            <p className={styles.loadingText}>Loading assignments...</p>
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
            <h1 className={styles.sectionTitle}>Add Assignment Marks</h1>
            <p className={styles.sectionSubtitle}>Enter and manage student assignment scores</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.assignmentForm}>
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
                <label className={styles.label}>Common Total Marks</label>
                <input
                  key="total-marks-input"
                  type="text"
                  value={commonTotalMarks}
                  onChange={handleCommonTotalMarksChange}
                  className={styles.input}
                  placeholder="Enter total marks"
                  inputMode="numeric"
                  pattern="[0-9]*"
                />
              </div>
            </div>

            {selectedClass && selectedSubject && (
              <div className={styles.assignmentDetails}>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Assignment Title</label>
                  <input
                    key="title-input"
                    type="text"
                    value={assignmentTitle}
                    onChange={(e) => setAssignmentTitle(e.target.value)}
                    className={styles.input}
                    placeholder="Enter assignment title"
                    required
                  />
                </div>
                <div className={styles.formGroup}>
                  <label className={styles.label}>Description</label>
                  <textarea
                    key="description-input"
                    value={assignmentDescription}
                    onChange={(e) => setAssignmentDescription(e.target.value)}
                    className={styles.textarea}
                    placeholder="Enter assignment description (optional)"
                    rows="3"
                  />
                </div>
              </div>
            )}

            {filteredStudents.length > 0 ? (
              <div className={styles.studentsSection}>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Enter Marks</h2>
                  <p className={styles.sectionSubtitle}>
                    Only fill in marks for students who have submitted the assignment. Students who haven't submitted will automatically get 0 marks.
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
                            type="text"
                            value={marks[student.id]?.obtained || ""}
                            onChange={handleMarksChange(student.id, "obtained")}
                            className={styles.input}
                            placeholder="Enter obtained marks"
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </div>
                        <div className={styles.formGroup}>
                          <label className={styles.label}>Total Marks</label>
                          <input
                            key={`${student.id}-total`}
                            type="text"
                            value={marks[student.id]?.total || ""}
                            onChange={handleMarksChange(student.id, "total")}
                            className={styles.input}
                            placeholder="Enter total marks"
                            inputMode="numeric"
                            pattern="[0-9]*"
                          />
                        </div>
                        <div className={styles.percentageDisplay}>
                          <span className={styles.percentageLabel}>Percentage</span>
                          <span className={styles.percentageValue}>
                            {marks[student.id]?.obtained && marks[student.id]?.total 
                              ? `${calculatePercentage(marks[student.id].obtained, marks[student.id].total)}%`
                              : "0%"
                            }
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
                Assignment marks added successfully!
              </div>
            )}

            {filteredStudents.length > 0 && (
              <div className={styles.submitSection}>
                <button type="submit" className={styles.submitButton}>
                  <span className={styles.buttonIcon}>💾</span>
                  Add Assignment Marks
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
