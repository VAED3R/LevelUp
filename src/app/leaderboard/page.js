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
import { useAuth } from "@/context/AuthContext";

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
    subject: "",
    topic: "",
    difficulty: "medium",
    timeLimit: 30,
    pointsWagered: 10
  });
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState(false);
  const [showActionPopup, setShowActionPopup] = useState(false);
  const [sortBy, setSortBy] = useState("points-desc"); // points-desc, points-asc, name-asc, name-desc
  const [subjects, setSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [topicsLoading, setTopicsLoading] = useState(false);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  // Fetch subjects from RAG API for semester 6
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        console.log("Fetching subjects for semester 6 from RAG API...");
        
        const res = await fetch('http://localhost:8000/semester_subjects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ semester: "6" })
        });
        
        console.log("Subjects API response status:", res.status);
        console.log("Subjects API response ok:", res.ok);
        
        if (!res.ok) {
          console.error("Subjects API error - status:", res.status);
          const errorText = await res.text();
          console.error("Subjects API error text:", errorText);
          setSubjects([]);
          return;
        }
        
        const data = await res.json();
        console.log("Subjects API response data:", data);
        
        if (data.subjects && data.subjects.length > 0) {
          console.log("Raw subjects for semester 6:", data.subjects);
          console.log("Number of raw subjects:", data.subjects.length);
          
          // Filter subjects to only include those that have topics in quiz_topics.txt
          // The subjects from RAG API might include course codes and descriptions
          // We need to extract just the subject names that match quiz_topics.txt
          const validSubjects = [
            "Linear Regression Analysis",
            "Multivariate Analysis", 
            "Statistical Machine Learning",
            "Biostatistics",
            "Econometrics",
            "Statistical Quality Control",
            "Operations Research",
            "Simulation Techniques",
            "Basic Research Methodology"
          ];
          
          // Filter subjects that match any of the valid subjects
          const filteredSubjects = data.subjects.filter(subject => {
            // Check if any valid subject is contained in the raw subject string
            return validSubjects.some(validSubject => 
              subject.toLowerCase().includes(validSubject.toLowerCase())
            );
          });
          
          // Extract the actual subject names from the filtered subjects
          const extractedSubjects = filteredSubjects.map(subject => {
            // Find which valid subject this matches
            const matchedSubject = validSubjects.find(validSubject => 
              subject.toLowerCase().includes(validSubject.toLowerCase())
            );
            return matchedSubject || subject;
          });
          
          // Remove duplicates
          const uniqueSubjects = [...new Set(extractedSubjects)];
          
          console.log("Filtered subjects:", uniqueSubjects);
          console.log("Number of filtered subjects:", uniqueSubjects.length);
          setSubjects(uniqueSubjects.sort());
        } else {
          console.log("No subjects found for semester 6");
          setSubjects([]);
        }
      } catch (error) {
        console.error("Error fetching subjects:", error);
        console.error("Error details:", error.message);
        setSubjects([]);
      }
    };

    fetchSubjects();
  }, []);

  // Fetch topics for selected subject
  useEffect(() => {
    const fetchTopics = async () => {
      if (quizParams.subject) {
        console.log("Fetching topics for subject:", quizParams.subject);
        console.log("Subject type:", typeof quizParams.subject);
        console.log("Subject length:", quizParams.subject.length);
        setTopicsLoading(true);
        try {
          const res = await fetch("/api/get-topics", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ subject: quizParams.subject }),
          });
          console.log("Topics API response status:", res.status);
          console.log("Topics API response ok:", res.ok);
          
          if (!res.ok) {
            console.error("Topics API error - status:", res.status);
            const errorText = await res.text();
            console.error("Topics API error text:", errorText);
            setTopics([]);
            return;
          }
          
          const data = await res.json();
          console.log("Topics API response data:", data);
          setTopics(data.topics || []);
        } catch (e) {
          console.error("Error fetching topics:", e);
          console.error("Error details:", e.message);
          setTopics([]);
        }
        setTopicsLoading(false);
      } else {
        console.log("No subject selected, clearing topics");
        setTopics([]);
        setTopicsLoading(false);
      }
    };
    fetchTopics();
  }, [quizParams.subject]);

  useEffect(() => {
    if (!user || authLoading) return;
    
    const fetchStudents = async () => {
      setLoading(true);
      try {
        // Use cached auth user instead of auth.currentUser
        if (!user) {
          console.log("No user logged in");
          setAuthError(true);
          setLoading(false);
          return;
        }

        console.log("Current user UID:", user.uid); // Debug log

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
        const currentUserStudent = studentsList.find(student => student.id === user.uid);
        
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
  }, [user?.uid, authLoading]);

  // Handle sticky positioning for bottom half users
  useEffect(() => {
    if (currentUser && !loading) {
      const currentUserRow = document.querySelector(`[data-position="bottom"]`);
      if (currentUserRow) {
        const container = document.querySelector(`.${styles.leaderboardContainer}`);
        if (container) {
          const handleScroll = () => {
            const containerRect = container.getBoundingClientRect();
            const rowRect = currentUserRow.getBoundingClientRect();
            
            // If the row is near the bottom of the container, keep it visible
            if (rowRect.bottom > containerRect.bottom) {
              currentUserRow.style.position = 'sticky';
              currentUserRow.style.bottom = '0';
            } else {
              currentUserRow.style.position = '';
              currentUserRow.style.bottom = '';
            }
          };
          
          container.addEventListener('scroll', handleScroll);
          return () => container.removeEventListener('scroll', handleScroll);
        }
      }
    }
  }, [currentUser, loading, styles.leaderboardContainer]);

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
    
    // Apply sorting
    filtered = sortStudents(filtered, sortBy);
    
    setFilteredStudents(filtered);
  };

  // Sort students based on sortBy option
  const sortStudents = (studentsList, sortOption) => {
    const sorted = [...studentsList];
    
    switch (sortOption) {
      case "points-desc":
        return sorted.sort((a, b) => b.totalPoints - a.totalPoints);
      case "points-asc":
        return sorted.sort((a, b) => a.totalPoints - b.totalPoints);
      case "name-asc":
        return sorted.sort((a, b) => a.name.localeCompare(b.name));
      case "name-desc":
        return sorted.sort((a, b) => b.name.localeCompare(a.name));
      default:
        return sorted.sort((a, b) => b.totalPoints - a.totalPoints);
    }
  };

  // Handle sort change
  const handleSortChange = (event) => {
    const newSortBy = event.target.value;
    setSortBy(newSortBy);
    applyFilters(selectedClass, searchQuery);
  };

  // Handle action popup close
  const handleActionPopupClose = () => {
    setShowActionPopup(false);
  };

  // Apply changes from action popup
  const handleApplyChanges = () => {
    applyFilters(selectedClass, searchQuery);
    setShowActionPopup(false);
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

    if (!quizParams.subject.trim()) {
      alert("Please select a subject");
      return;
    }

    if (!quizParams.topic.trim()) {
      alert("Please select a topic");
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
        subject: quizParams.subject,
        topic: quizParams.topic,
        semester: 6, // Default semester as requested
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
        subject: "",
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
      subject: "",
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
                        <label htmlFor="subject" className={styles.formLabel}>Subject:</label>
                        <select
                          id="subject"
                          name="subject"
                          value={quizParams.subject}
                          onChange={handleInputChange}
                          className={styles.formSelect}
                          onBlur={() => setQuizParams(prev => ({ ...prev, topic: "" }))} // Clear topic when subject changes
                        >
                          <option value="">Select a Subject</option>
                          {subjects.map((subject, index) => (
                            <option key={index} value={subject}>
                              {subject}
                            </option>
                          ))}
                        </select>
                      </div>

                      {topicsLoading ? (
                        <p className={styles.loading}>Loading topics...</p>
                      ) : topics.length > 0 ? (
                        <div className={styles.formGroup}>
                          <label htmlFor="topic" className={styles.formLabel}>Topic:</label>
                          <select
                            id="topic"
                            name="topic"
                            value={quizParams.topic}
                            onChange={handleInputChange}
                            className={styles.formSelect}
                          >
                            <option value="">Select a Topic</option>
                            {topics.map((topic, index) => (
                              <option key={index} value={topic}>
                                {topic}
                              </option>
                            ))}
                          </select>
                        </div>
                      ) : (
                        <p className={styles.noTopics}>No topics available for this subject.</p>
                      )}
                      
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
                        disabled={requestLoading || !quizParams.topic.trim() || !quizParams.subject}
                      >
                        {requestLoading ? "Sending..." : "Send Challenge Request"}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Button and Search */}
              <div className={styles.filterContainer}>
                <div className={styles.actionGroup}>
                  <button 
                    className={styles.actionButton}
                    onClick={() => setShowActionPopup(true)}
                  >
                    Action
                  </button>
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

              {/* Action Popup */}
              {showActionPopup && (
                <div className={styles.actionPopupOverlay}>
                  <div className={styles.actionPopupContent}>
                    <button className={styles.actionCloseButton} onClick={handleActionPopupClose}>×</button>
                    <h2 className={styles.actionPopupTitle}>Filter & Sort Options</h2>
                    
                    <div className={styles.actionSection}>
                      <h3 className={styles.actionSectionTitle}>Filter by Class</h3>
                      <select
                        value={selectedClass}
                        onChange={handleClassChange}
                        className={styles.actionSelect}
                      >
                        {classes.map((className, index) => (
                          <option key={index} value={className}>
                            {className}
                          </option>
                        ))}
                      </select>
                    </div>
                    
                    <div className={styles.actionSection}>
                      <h3 className={styles.actionSectionTitle}>Sort by</h3>
                      <select
                        value={sortBy}
                        onChange={handleSortChange}
                        className={styles.actionSelect}
                      >
                        <option value="points-desc">Points (High to Low)</option>
                        <option value="points-asc">Points (Low to High)</option>
                      </select>
                    </div>
                    
                    <div className={styles.actionButtons}>
                      <button 
                        className={styles.applyButton}
                        onClick={handleApplyChanges}
                      >
                        Apply Changes
                      </button>
                      <button 
                        className={styles.cancelButton}
                        onClick={handleActionPopupClose}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {loading || authLoading ? (
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
                          const totalStudents = filteredStudents.length;
                          const isTopHalf = index < Math.ceil(totalStudents / 2);
                          const position = isCurrentUser ? (isTopHalf ? "top" : "bottom") : null;
                          
                          return (
                            <tr 
                              key={student.id} 
                              onClick={() => {
                                if (!isCurrentUser) {
                                  handleStudentClick(student.id);
                                }
                              }}
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
