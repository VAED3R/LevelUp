"use client";

import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc, addDoc, serverTimestamp } from "firebase/firestore";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";  // Import CSS module
import Link from "next/link";
import { getAuth } from "firebase/auth";
import { useRouter } from "next/navigation";
import IntroAnimation from "../../components/IntroAnimation";

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
  const [searchQuery, setSearchQuery] = useState("");
  const [quizParams, setQuizParams] = useState({
    topic: "",
    difficulty: "medium",
    timeLimit: 30,
    pointsWagered: 10
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const fetchStudents = async () => {
      setLoading(true);
      try {
        // Get current user from authentication
        const auth = getAuth();
        const currentUserAuth = auth.currentUser;
        
        if (!currentUserAuth) {
          console.log("No user logged in, redirecting to login page");
          setAuthError(true);
          setLoading(false);
          return;
        }

        console.log("Current user UID:", currentUserAuth.uid); // Debug log

        // Fetch students from the students collection
        const querySnapshot = await getDocs(collection(db, "students"));

        const studentsList = querySnapshot.docs
          .map(doc => ({
            id: doc.id,
            ...doc.data(),
            totalPoints: doc.data().totalPoints || 0
          }))
          // Filter out students with unknown names
          .filter(student => student.name && student.name !== "Unknown")
          .sort((a, b) => b.totalPoints - a.totalPoints);

        // Set the overall topper (first in the sorted list)
        const topOverall = studentsList[0] || null;

        // Identify top students by class
        const classTopperMap = {};
        studentsList.forEach((student) => {
          const className = student.class || "N/A";
          if (
            !classTopperMap[className] ||
            student.totalPoints > classTopperMap[className].totalPoints
          ) {
            classTopperMap[className] = student;
          }
        });

        // Extract unique classes for the filter dropdown
        const uniqueClasses = Array.from(
          new Set(studentsList.map(student => student.class || "N/A"))
        );

        // Find the current user in the students list by matching the UID
        const currentUserStudent = studentsList.find(student => student.id === currentUserAuth.uid);
        
        console.log("Found current user student:", currentUserStudent); // Debug log

        setStudents(studentsList);
        setFilteredStudents(studentsList);
        setClasses(["All", ...uniqueClasses]);
        setClassToppers(classTopperMap);
        setOverallTopper(topOverall);
        setCurrentUser(currentUserStudent);

      } catch (error) {
        console.error("Error fetching students:", error);
        setAuthError(true);
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
    applyFilters(selected, searchQuery);
  };

  // Handle search input change
  const handleSearchChange = (event) => {
    const query = event.target.value;
    setSearchQuery(query);
    applyFilters(selectedClass, query);
  };

  // Apply both class and search filters
  const applyFilters = (classFilter, searchText) => {
    let filtered = [...students];
    
    // Apply class filter
    if (classFilter !== "All") {
      filtered = filtered.filter(student => student.class === classFilter);
    }
    
    // Apply search filter
    if (searchText.trim()) {
      const query = searchText.toLowerCase().trim();
      filtered = filtered.filter(student => 
        student.name.toLowerCase().includes(query) || 
        (student.class && student.class.toLowerCase().includes(query))
      );
    }
    
    setFilteredStudents(filtered);
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
    // Check if the selected student is the current user
    if (currentUser && studentId === currentUser.id) {
      alert("You cannot challenge yourself!");
      return;
    }

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

    if (parseInt(quizParams.pointsWagered) <= 0) {
      alert("Please enter a valid number of points to wager");
      return;
    }

    if (parseInt(quizParams.pointsWagered) > currentUser.totalPoints) {
      alert("You don't have enough points to wager this amount");
      return;
    }

    try {
      setRequestLoading(true);
      
      // Create the request document
      const requestData = {
        fromUserId: currentUser.id,
        fromUserName: currentUser.name,
        toUserId: selectedStudent.id,
        toUserName: selectedStudent.name,
        topic: quizParams.topic,
        difficulty: quizParams.difficulty,
        timeLimit: parseInt(quizParams.timeLimit),
        pointsWagered: parseInt(quizParams.pointsWagered),
        status: "pending", // pending, accepted, rejected, completed
        createdAt: serverTimestamp(),
        quizGenerated: false
      };

      // Add the request to Firestore
      await addDoc(collection(db, "onevsoneRequests"), requestData);
      
      alert(`Challenge request sent to ${selectedStudent.name}`);
      setShowRequestForm(false);
      setSelectedStudent(null);
      setQuizParams({
        topic: "",
        difficulty: "medium",
        timeLimit: 30,
        pointsWagered: 10
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
      timeLimit: 30,
      pointsWagered: 10
    });
  };

  return (
    <IntroAnimation loadingText="Loading Leaderboard...">
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <h1 className={styles.title}>Leaderboard</h1>

          {authError ? (
            <div className={styles.authErrorContainer}>
              <h2>Authentication Required</h2>
              <p>Please log in to view the leaderboard.</p>
              <Link href="/login" className={styles.loginButton}>
                Go to Login
              </Link>
            </div>
          ) : (
            <>
              {/* 1v1 Request Form Modal */}
              {showRequestForm && selectedStudent && (
                <div className={styles.modalOverlay}>
                  <div className={styles.modalContent}>
                    <button className={styles.closeButton} onClick={handleCloseForm}>×</button>
                    <h2 className={styles.modalTitle}>1v1 Challenge Request</h2>
                    
                    <div className={styles.studentCard}>
                      <h3 className={styles.studentName}>{selectedStudent.name}</h3>
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
                      
                      <div className={styles.formGroup}>
                        <label htmlFor="pointsWagered" className={styles.formLabel}>Points to Wager:</label>
                        <input
                          type="number"
                          id="pointsWagered"
                          name="pointsWagered"
                          value={quizParams.pointsWagered}
                          onChange={handleInputChange}
                          className={styles.formInput}
                          min="1"
                          max={currentUser?.totalPoints || 100}
                        />
                        <small className={styles.helpText}>You have {currentUser?.totalPoints || 0} points available</small>
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
                <div className={styles.filterGroup}>
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
                
                <div className={styles.searchGroup}>
                  <div className={styles.searchContainer}>
                    <input
                      type="text"
                      id="searchInput"
                      value={searchQuery}
                      onChange={handleSearchChange}
                      placeholder="Search students..."
                      className={styles.searchInput}
                    />
                    <span className={styles.searchIcon}>🔍</span>
                  </div>
                </div>
                
                <div className={styles.onevoneButtonContainer}>
                  <Link href="/onevsoneRequests" className={styles.onevoneButton}>
                    Go to 1v1 Challenges
                  </Link>
                </div>
              </div>

              {loading ? (
                <p className={styles.loading}>Loading...</p>
              ) : (
                <div className={styles.leaderboardContainer}>
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
                      {filteredStudents
                        .map((student, index) => {
                          // Find the original index in the main students array to maintain original rank
                          const originalIndex = students.findIndex(s => s.id === student.id);
                          const rank = originalIndex + 1;
                          const isCurrentUser = currentUser && student.id === currentUser.id;
                          const totalStudents = students.length;
                          const isTopHalf = rank <= Math.ceil(totalStudents / 2);
                          const position = isCurrentUser ? (isTopHalf ? "top" : "bottom") : null;
                          
                          return (
                            <tr 
                              key={student.id} 
                              onClick={() => handleStudentClick(student.id)}
                              className={`${styles.tableRow} ${styles.clickableRow} ${isCurrentUser ? styles.currentUserRow : ''}`}
                              data-rank={rank}
                              data-position={position}
                            >
                              <td>{rank}</td>
                              <td>
                                {student.name} 
                                <span className={styles.badge}> {getBadges(student)}</span>
                                {isCurrentUser && <span className={styles.currentUserBadge}> (You)</span>}
                              </td>
                              <td>{student.class || "N/A"}</td>
                              <td>{student.totalPoints}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </IntroAnimation>
  );
}
