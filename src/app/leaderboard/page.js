"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";  // Import CSS module

export default function Leaderboard() {
  const [students, setStudents] = useState([]);
  const [filteredStudents, setFilteredStudents] = useState([]);
  const [classes, setClasses] = useState([]);
  const [selectedClass, setSelectedClass] = useState("All");
  const [loading, setLoading] = useState(true);
  const [classToppers, setClassToppers] = useState({});
  const [overallTopper, setOverallTopper] = useState(null);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestLoading, setRequestLoading] = useState(false);
  const [quizParams, setQuizParams] = useState({
    topic: "",
    difficulty: "medium",
    timeLimit: 30
  });
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        // Fetch students from the students collection instead of users
        const querySnapshot = await getDocs(collection(db, "students"));

        const studentsList = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            // Use the totalPoints field directly from the student document
            totalPoints: doc.data().totalPoints || 0
          }))
          .sort((a, b) => b.totalPoints - a.totalPoints);  // Sort by total points (descending)

        // Set the overall topper (first in the sorted list)
        const topOverall = studentsList[0] || null;

        // Identify top students by class
        const classTopperMap = {};
        studentsList.forEach((student) => {
          const className = student.class || "Unknown";
          if (
            !classTopperMap[className] ||
            student.totalPoints > classTopperMap[className].totalPoints
          ) {
            classTopperMap[className] = student;
          }
        });

        // Extract unique classes for the filter dropdown
        const uniqueClasses = Array.from(
          new Set(studentsList.map(student => student.class || "Unknown"))
        );

        setStudents(studentsList);
        setFilteredStudents(studentsList);
        setClasses(["All", ...uniqueClasses]);
        setClassToppers(classTopperMap);
        setOverallTopper(topOverall);

        // Get current user (for now, we'll use the first student as the current user)
        // In a real app, you would get this from authentication
        if (studentsList.length > 0) {
          setCurrentUser(studentsList[0]);
        }

        console.log("Fetched students with total points:", studentsList);

      } catch (error) {
        console.error("Error fetching students:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchStudents();
  }, []);

  // Handle class filter change
  const handleClassChange = (event) => {
    const selected = event.target.value;
    setSelectedClass(selected);

    if (selected === "All") {
      setFilteredStudents(students);
    } else {
      const filtered = students.filter(student => student.class === selected);
      setFilteredStudents(filtered);
    }
  };

  // 🏅 Function to display badges with overall topper persistence
  const getBadges = (student) => {
    const isOverallTopper = overallTopper?.id === student.id;
    const isClassTopper = classToppers[student.class]?.id === student.id;

    let badges = "";
    if (isOverallTopper) badges += "🏅";  // Overall topper
    if (isClassTopper) badges += " 🎓";   // Class topper

    return badges;
  };

  // Handle student row click
  const handleStudentClick = async (studentId) => {
    try {
      setRequestLoading(true);
      const studentDoc = await getDoc(doc(db, "students", studentId));
      
      if (studentDoc.exists()) {
        setSelectedStudent({ id: studentDoc.id, ...studentDoc.data() });
        setShowRequestForm(true);
      } else {
        alert("Student not found");
      }
    } catch (err) {
      console.error("Error fetching student:", err);
      alert("Failed to load student data");
    } finally {
      setRequestLoading(false);
    }
  };

  // Handle input change for quiz parameters
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setQuizParams(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle sending request
  const handleSendRequest = async () => {
    if (!currentUser || !selectedStudent) {
      alert("Error: User information missing");
      return;
    }

    if (!quizParams.topic.trim()) {
      alert("Please enter a quiz topic");
      return;
    }

    try {
      setRequestLoading(true);
      
      // Create the request document
      const requestData = {
        fromUserId: currentUser.id,
        fromUserName: currentUser.name || "Unknown",
        toUserId: selectedStudent.id,
        toUserName: selectedStudent.name || "Unknown",
        topic: quizParams.topic,
        difficulty: quizParams.difficulty,
        timeLimit: parseInt(quizParams.timeLimit),
        status: "pending", // pending, accepted, rejected, completed
        createdAt: serverTimestamp(),
        quizGenerated: false
      };

      // Add the request to Firestore
      await addDoc(collection(db, "onevsoneRequests"), requestData);
      
      alert(`Challenge request sent to ${selectedStudent.name || "student"}`);
      setShowRequestForm(false);
      setSelectedStudent(null);
      setQuizParams({
        topic: "",
        difficulty: "medium",
        timeLimit: 30
      });
    } catch (error) {
      console.error("Error sending request:", error);
      alert("Failed to send request. Please try again.");
    } finally {
      setRequestLoading(false);
    }
  };

  // Close request form
  const handleCloseForm = () => {
    setShowRequestForm(false);
    setSelectedStudent(null);
    setQuizParams({
      topic: "",
      difficulty: "medium",
      timeLimit: 30
    });
  };

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <h1 className={styles.title}>Leaderboard</h1>

        {/* 1v1 Request Form Modal */}
        {showRequestForm && selectedStudent && (
          <div className={styles.modalOverlay}>
            <div className={styles.modalContent}>
              <button className={styles.closeButton} onClick={handleCloseForm}>×</button>
              <h2 className={styles.modalTitle}>1v1 Challenge Request</h2>
              
              <div className={styles.studentCard}>
                <h3 className={styles.studentName}>{selectedStudent.name || "Unknown Student"}</h3>
                <div className={styles.studentInfo}>
                  <p><strong>Class:</strong> {selectedStudent.class || "N/A"}</p>
                  <p><strong>Points:</strong> {selectedStudent.totalPoints || 0}</p>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="topic" className={styles.formLabel}>Quiz Topic:</label>
                  <input
                    type="text"
                    id="topic"
                    name="topic"
                    value={quizParams.topic}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    placeholder="Enter quiz topic (e.g., Math, Science)"
                  />
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="difficulty" className={styles.formLabel}>Difficulty:</label>
                  <select
                    id="difficulty"
                    name="difficulty"
                    value={quizParams.difficulty}
                    onChange={handleInputChange}
                    className={styles.formSelect}
                  >
                    <option value="easy">Easy</option>
                    <option value="medium">Medium</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
                
                <div className={styles.formGroup}>
                  <label htmlFor="timeLimit" className={styles.formLabel}>Time Limit (seconds):</label>
                  <input
                    type="number"
                    id="timeLimit"
                    name="timeLimit"
                    value={quizParams.timeLimit}
                    onChange={handleInputChange}
                    className={styles.formInput}
                    min="10"
                    max="120"
                  />
                </div>
                
                <button 
                  className={styles.requestButton}
                  onClick={handleSendRequest}
                  disabled={requestLoading || !quizParams.topic.trim()}
                >
                  {requestLoading ? "Sending..." : "Send Challenge Request"}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Dropdown for filtering */}
        <div className={styles.filterContainer}>
          <label htmlFor="classFilter" className={styles.label}>Filter by Class:</label>
          <select
            id="classFilter"
            value={selectedClass}
            onChange={handleClassChange}
            className={styles.select}
          >
            {classes.map((className, index) => (
              <option key={index} value={className}>
                {className}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <p className={styles.loading}>Loading...</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>#</th>
                <th>Name</th>
                <th>Class</th>
                <th>Points</th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.map((student, index) => (
                <tr 
                  key={student.id} 
                  onClick={() => handleStudentClick(student.id)}
                  className={styles.clickableRow}
                >
                  <td>{index + 1}</td>
                  <td>
                    {student.name || "Unknown"} 
                    <span className={styles.badge}> {getBadges(student)}</span>
                  </td>
                  <td>{student.class || "N/A"}</td>
                  <td>{student.totalPoints}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
