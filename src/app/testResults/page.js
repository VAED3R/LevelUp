"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, getDocs, addDoc, doc, getDoc, updateDoc, setDoc, writeBatch } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";
import { format } from 'date-fns';

export default function TestResults() {
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
  const [percentages, setPercentages] = useState({});
  const [totalScore, setTotalScore] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

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

  const calculatePercentage = (obtained, total) => {
    if (!obtained || !total || total === 0) return 0;
    return ((obtained / total) * 100).toFixed(2);
  };

  const handleMarksChange = (studentId, subject, field) => (e) => {
    const value = e.target.value;
    if (value === "" || (value >= 0 && value <= Number(totalScore))) {
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

      // Calculate percentage when obtained marks change
      if (field === "obtained" && totalScore) {
        const percentage = calculatePercentage(
          Number(value),
          Number(totalScore)
        );
        setPercentages(prev => ({
          ...prev,
          [`${studentId}-${subject}`]: percentage
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
        const studentMarks = {};
        subjects.forEach(subject => {
          studentMarks[subject] = {
            obtained: "0",
            total: value
          };
        });
        resetMarks[student.id] = studentMarks;
      });
      setMarks(resetMarks);
      setPercentages({});
    }
  };

  const handleDateChange = (e) => {
    const { name, value } = e.target;
    if (name === "startDate") {
      setStartDate(value);
    } else if (name === "endDate") {
      setEndDate(value);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedClass || !selectedSubject) {
      setError("Please select a class and subject");
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

        const marksData = {
          studentId: student.id,
          studentName: student.name,
          class: selectedClass,
          subject: selectedSubject,
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

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>Add Test Results</h1>
        
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
                onKeyPress={handleKeyPress}
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
                onKeyPress={handleKeyPress}
              >
                <option value="">Select Subject</option>
                {subjects.map((subject) => (
                  <option key={subject} value={subject}>
                    {subject.replace(/_/g, " ")}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="totalScore" className={styles.label}>Total Score:</label>
              <input
                type="number"
                id="totalScore"
                value={totalScore}
                onChange={handleTotalScoreChange}
                onKeyPress={handleKeyPress}
                min="0"
                max="100"
                className={styles.input}
                required
                placeholder="Enter total score"
              />
            </div>

            <div className={styles.formGroup}>
              <label htmlFor="startDate" className={styles.label}>Start Date:</label>
              <input
                type="date"
                id="startDate"
                name="startDate"
                value={startDate}
                onChange={handleDateChange}
                className={styles.input}
              />
            </div>
            <div className={styles.formGroup}>
              <label htmlFor="endDate" className={styles.label}>End Date:</label>
              <input
                type="date"
                id="endDate"
                name="endDate"
                value={endDate}
                onChange={handleDateChange}
                className={styles.input}
              />
            </div>
          </div>

          {filteredResults.length > 0 && (
            <div className={styles.marksContainer}>
              <h2 className={styles.subtitle}>Enter Marks</h2>
              <p className={styles.instruction}>Note: Only fill in marks for students who have taken the test. Students who haven't taken the test will automatically get 0 marks.</p>
              {filteredResults.map((student) => (
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
                        onKeyPress={handleKeyPress}
                        min="0"
                        max={totalScore}
                        className={styles.input}
                        placeholder="Enter marks if taken test"
                      />
                    </div>
                    <div className={styles.percentageDisplay}>
                      <span className={styles.percentageLabel}>Percentage:</span>
                      <span className={styles.percentageValue}>
                        {percentages[`${student.id}-${selectedSubject}`] || "0"}%
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>Marks added successfully!</p>}

          {filteredResults.length > 0 && (
            <button type="submit" className={styles.submitButton}>
              Add Marks
            </button>
          )}
        </form>
      </div>
    </div>
  );
}
