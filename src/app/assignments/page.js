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
              total: commonTotalMarks || "0"
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
  }, [selectedClass, selectedSubject, allStudents, commonTotalMarks]);

  const handleMarksChange = (studentId, field) => (e) => {
    const value = e.target.value;
    // Allow empty string or numbers between 0 and 100
    if (value === "" || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
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
    return ((obtained / total) * 100).toFixed(2);
  };

  const handleCommonTotalMarksChange = (e) => {
    const value = e.target.value;
    // Allow empty string or numbers between 0 and 100
    if (value === "" || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
      setCommonTotalMarks(value);
      // Update all students' total marks
      setMarks(prev => {
        const newMarks = { ...prev };
        Object.keys(newMarks).forEach(studentId => {
          newMarks[studentId] = {
            ...newMarks[studentId],
            total: value
          };
        });
        return newMarks;
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !selectedSemester || !assignmentTitle) {
      setError("Please select a class, subject, semester and enter assignment title");
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

        const assignmentData = {
          studentId: student.id,
          studentName: student.name,
          class: selectedClass,
          subject: selectedSubject,
          semester: selectedSemester,
          assignmentTitle: assignmentTitle,
          assignmentDescription: assignmentDescription,
          obtainedMarks: obtainedMarks,
          totalMarks: totalMarks,
          percentage: percentage,
          addedBy: auth.currentUser.uid,
          addedAt: new Date().toISOString(),
        };

        // Add assignment to the assignments collection
        const assignmentRef = doc(collection(db, "assignments"));
        batch.set(assignmentRef, assignmentData);

        // Calculate points based on percentage
        let pointsToAdd = 0;
        if (obtainedMarks > 5) {
          pointsToAdd = 10;
        }

        // Only proceed if points are earned
        if (pointsToAdd > 0) {
          // Create a new assignment points entry
          const newPointsEntry = {
            points: pointsToAdd,
            date: new Date().toISOString(),
            subject: selectedSubject,
            semester: selectedSemester,
            score: percentage,
            totalQuestions: totalMarks,
            quizId: "assignment_" + new Date().getTime(), // Unique ID for assignment
            topic: assignmentTitle,
            userId: student.id,
            type: "assignment" // Ensure type is set as assignment
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
            
            // Add the new assignment points entry to the array
            currentPointsArray.push(newPointsEntry);
            
            // Calculate total points
            const totalPoints = calculateTotalPoints(currentPointsArray);
            
            // Update the student document with the new points array and total points
            batch.update(studentRef, {
              points: currentPointsArray,
              totalPoints: totalPoints
            });
            
            console.log(`Added ${pointsToAdd} points for ${student.name} for assignment in ${selectedSubject}. Total points: ${totalPoints}`);
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
            console.log(`Creating new student document for ${student.name} with ${pointsToAdd} assignment points.`);
          }
        }
      });

      await Promise.all(promises);
      await batch.commit();
      
      setSuccess(true);
      setError(null);
      
      // Reset form
      setAssignmentTitle("");
      setAssignmentDescription("");
      setSelectedSemester("");
      setSelectedSubject("");
      const resetMarks = {};
      filteredStudents.forEach(student => {
        resetMarks[student.id] = {
          obtained: "0",
          total: "0"
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

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>Add Assignment Marks</h1>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.filters}>
            <div className={styles.formGroup}>
              <label htmlFor="class" className={styles.label}>Select Class:</label>
              <select
                id="class"
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
              <label htmlFor="semester" className={styles.label}>Select Semester:</label>
              <select
                id="semester"
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
              <label htmlFor="subject" className={styles.label}>Select Subject:</label>
              <select
                id="subject"
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
          </div>

          {selectedClass && selectedSubject && (
            <div className={styles.commonMarks}>
              <label htmlFor="commonTotalMarks">Common Total Marks:</label>
              <input
                type="text"
                id="commonTotalMarks"
                value={commonTotalMarks}
                onChange={handleCommonTotalMarksChange}
                className={styles.input}
                placeholder="Enter common total marks"
                inputMode="numeric"
                pattern="[0-9]*"
              />
            </div>
          )}

          <div className={styles.assignmentDetails}>
            <div className={styles.formGroup}>
              <label htmlFor="assignmentTitle" className={styles.label}>Assignment Title:</label>
              <input
                type="text"
                id="assignmentTitle"
                value={assignmentTitle}
                onChange={(e) => setAssignmentTitle(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="assignmentDescription" className={styles.label}>Assignment Description:</label>
              <textarea
                id="assignmentDescription"
                value={assignmentDescription}
                onChange={(e) => setAssignmentDescription(e.target.value)}
                className={styles.textarea}
                rows="4"
              />
            </div>
          </div>

          {filteredStudents.length > 0 ? (
            <div className={styles.marksContainer}>
              <h2 className={styles.subtitle}>Enter Marks</h2>
              <p className={styles.instruction}>Note: Only fill in marks for students who have submitted the assignment. Students who haven't submitted will automatically get 0 marks.</p>
              {filteredStudents.map((student) => (
                <div key={student.id} className={styles.studentMarks}>
                  <h3 className={styles.studentName}>{student.name}</h3>
                  <div className={styles.marksInputs}>
                    <div className={styles.formGroup}>
                      <label htmlFor={`${student.id}-obtained`} className={styles.label}>
                        Obtained Marks:
                      </label>
                      <input
                        type="text"
                        id={`${student.id}-obtained`}
                        value={marks[student.id]?.obtained || ""}
                        onChange={handleMarksChange(student.id, "obtained")}
                        className={styles.input}
                        placeholder="Enter marks"
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor={`${student.id}-total`} className={styles.label}>
                        Total Marks:
                      </label>
                      <input
                        type="text"
                        id={`${student.id}-total`}
                        value={marks[student.id]?.total || ""}
                        onChange={handleMarksChange(student.id, "total")}
                        className={styles.input}
                        placeholder="Enter total marks"
                        inputMode="numeric"
                        pattern="[0-9]*"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            selectedClass && selectedSubject && (
              <p>No students found enrolled in {selectedSubject} for {selectedClass}</p>
            )
          )}

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>Assignment marks added successfully!</p>}

          {filteredStudents.length > 0 && (
            <button type="submit" className={styles.submitButton}>
              Add Assignment Marks
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
