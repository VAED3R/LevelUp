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
  const [marks, setMarks] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [teacherEmail, setTeacherEmail] = useState("");
  const [assignmentTitle, setAssignmentTitle] = useState("");
  const [assignmentDescription, setAssignmentDescription] = useState("");

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
        // Fetch teacher info
        const teacherQuery = await getDocs(collection(db, "users"));
        const teacher = teacherQuery.docs.find(
          (doc) => doc.data().email === teacherEmail
        )?.data();

        if (teacher) {
          const teacherSubjects = teacher.subject
            .split(",")
            .map((sub) => sub.trim().toLowerCase().replace(/ /g, "_"));
          setSubjects(teacherSubjects);
        }

        // Fetch students
        const studentQuery = await getDocs(collection(db, "users"));
        const studentList = studentQuery.docs
          .filter((doc) => doc.data().role === "student")
          .map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }));

        setStudents(studentList);

        // Extract unique classes
        const uniqueClasses = [...new Set(studentList.map((student) => student.class))];
        setClasses(uniqueClasses.sort());
      } catch (error) {
        console.error("Error fetching data:", error);
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [teacherEmail]);

  useEffect(() => {
    if (selectedClass) {
      const filtered = students.filter(
        (student) => student.class === selectedClass
      );
      // Sort students by name in ascending order
      const sortedStudents = filtered.sort((a, b) => 
        a.name.localeCompare(b.name)
      );
      setFilteredStudents(sortedStudents);
      
      // Initialize marks for each student with the faculty's subjects
      const initialMarks = {};
      sortedStudents.forEach(student => {
        const studentMarks = {};
        subjects.forEach(subject => {
          studentMarks[subject] = {
            obtained: "0",
            total: "0"
          };
        });
        initialMarks[student.id] = studentMarks;
      });
      setMarks(initialMarks);
    } else {
      setFilteredStudents([]);
      setMarks({});
    }
  }, [selectedClass, students, subjects]);

  const handleMarksChange = (studentId, subject, field) => (e) => {
    const value = e.target.value;
    if (value === "" || (value >= 0 && value <= 100)) {
      setMarks(prev => ({
        ...prev,
        [studentId]: {
          ...prev[studentId],
          [subject]: {
            ...prev[studentId]?.[subject],
            [field]: value
          }
        }
      }));
    }
  };

  const calculatePercentage = (obtained, total) => {
    if (!obtained || !total || total === 0) return 0;
    return ((obtained / total) * 100).toFixed(2);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject || !assignmentTitle) {
      setError("Please select a class, subject and enter assignment title");
      return;
    }

    try {
      setLoading(true);
      const batch = writeBatch(db);
      
      const promises = filteredStudents.map(async (student) => {
        const studentMarks = marks[student.id][selectedSubject];
        // If marks are empty or not filled, use 0 as default
        const obtainedMarks = Number(studentMarks.obtained) || 0;
        const totalMarks = Number(studentMarks.total) || 0;
        const percentage = Number(calculatePercentage(obtainedMarks, totalMarks));

        const assignmentData = {
          studentId: student.id,
          studentName: student.name,
          class: selectedClass,
          subject: selectedSubject,
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
          // Create a new assignment points entry
          const newPointsEntry = {
            points: pointsToAdd,
            date: new Date().toISOString(),
            subject: selectedSubject,
            score: percentage,
            totalQuestions: totalMarks,
            quizId: "assignment_" + new Date().getTime(), // Unique ID for assignment
            topic: assignmentTitle,
            userId: student.id,
            type: "assignment" // Ensure type is set as assignment
          };

          // Create bonus points entry if needed (will be used later if marks > 5)
          const additionalPointsEntry = {
            points: 10,
            date: new Date().toISOString(),
            subject: selectedSubject,
            score: percentage,
            totalQuestions: totalMarks,
            quizId: "assignment_bonus_" + new Date().getTime(), // Unique ID for bonus
            topic: assignmentTitle + " (Bonus)",
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
            
            // If marks are above 5, add 10 additional points
            if (obtainedMarks > 5) {
              // Add the additional points entry
              currentPointsArray.push(additionalPointsEntry);
              
              // Update total points with bonus
              const totalPointsWithBonus = totalPoints + 10;
              
              // Update the student document with the new points array and total points
              batch.update(studentRef, {
                points: currentPointsArray,
                totalPoints: totalPointsWithBonus
              });
              
              console.log(`Added ${pointsToAdd} points and 10 bonus points for ${student.name} for assignment in ${selectedSubject}. Total points: ${totalPointsWithBonus}`);
            } else {
              // Update the student document with the new points array and total points
              batch.update(studentRef, {
                points: currentPointsArray,
                totalPoints: totalPoints
              });
              
              console.log(`Added ${pointsToAdd} points for ${student.name} for assignment in ${selectedSubject}. Total points: ${totalPoints}`);
            }
          } else {
            // Student doesn't exist, create new document
            let initialPoints = [newPointsEntry];
            let initialTotalPoints = pointsToAdd;
            
            // If marks are above 5, add 10 additional points
            if (obtainedMarks > 5) {
              initialPoints.push(additionalPointsEntry);
              initialTotalPoints += 10;
            }
            
            const newStudentData = {
              id: student.id,
              name: student.name,
              email: student.email || "",
              class: student.class,
              createdAt: new Date().toISOString(),
              points: initialPoints,
              totalPoints: initialTotalPoints
            };
            
            batch.set(studentRef, newStudentData);
            console.log(`Creating new student document for ${student.name} with ${initialTotalPoints} assignment points.`);
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
      const resetMarks = {};
      filteredStudents.forEach(student => {
        const studentMarks = {};
        subjects.forEach(subject => {
          studentMarks[subject] = {
            obtained: "0",
            total: "0"
          };
        });
        resetMarks[student.id] = studentMarks;
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
              <label htmlFor="subject" className={styles.label}>Select Subject:</label>
              <select
                id="subject"
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className={styles.select}
                required
              >
                <option value="">Select Subject</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>
          </div>

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

          {filteredStudents.length > 0 && (
            <div className={styles.marksContainer}>
              <h2 className={styles.subtitle}>Enter Marks</h2>
              <p className={styles.instruction}>Note: Only fill in marks for students who have submitted the assignment. Students who haven't submitted will automatically get 0 marks.</p>
              {filteredStudents.map((student) => (
                <div key={student.id} className={styles.studentMarks}>
                  <h3 className={styles.studentName}>{student.name}</h3>
                  <div className={styles.marksInputs}>
                    <div className={styles.formGroup}>
                      <label htmlFor={`${student.id}-${selectedSubject}-obtained`} className={styles.label}>
                        Obtained Marks:
                      </label>
                      <input
                        type="number"
                        id={`${student.id}-${selectedSubject}-obtained`}
                        value={marks[student.id]?.[selectedSubject]?.obtained || "0"}
                        onChange={handleMarksChange(student.id, selectedSubject, "obtained")}
                        min="0"
                        max="100"
                        className={styles.input}
                        placeholder="Enter marks if submitted"
                      />
                    </div>
                    <div className={styles.formGroup}>
                      <label htmlFor={`${student.id}-${selectedSubject}-total`} className={styles.label}>
                        Total Marks:
                      </label>
                      <input
                        type="number"
                        id={`${student.id}-${selectedSubject}-total`}
                        value={marks[student.id]?.[selectedSubject]?.total || "0"}
                        onChange={handleMarksChange(student.id, selectedSubject, "total")}
                        min="0"
                        max="100"
                        className={styles.input}
                        placeholder="Enter total marks if submitted"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
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
