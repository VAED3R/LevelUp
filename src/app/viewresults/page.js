"use client";
import { useEffect, useState } from "react";
import { db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from './page.module.css';
import IntroAnimation from "../../components/IntroAnimation";
import { useAuth } from "@/context/AuthContext";

export default function ViewResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [semesters, setSemesters] = useState([]);
  const [selectedSemester, setSelectedSemester] = useState("6"); // Default to semester 6
  const [allSubjectsData, setAllSubjectsData] = useState([]);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        // Use cached auth user instead of auth.currentUser
        if (!user) {
          console.log("No user is signed in.");
          return; // Don't redirect, let AuthGate handle it
        }

        const userId = user.uid;
        
        // Query marks collection for this student
        const marksQuery = query(
          collection(db, "marks"),
          where("studentId", "==", userId),
          orderBy("addedAt", "desc")
        );
        
        const marksSnapshot = await getDocs(marksQuery);
        const marksData = marksSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        console.log("Fetched marks data:", marksData);
        setResults(marksData);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching results:", error);
        setError("Failed to load results");
        setLoading(false);
      }
    };

    // Only fetch data when user is available and auth is not loading
    if (user && !authLoading) {
      fetchResults();
    }
  }, [user?.uid, authLoading, router]);

  // Fetch subjects and semesters from subjects collection
  useEffect(() => {
    const fetchSubjectsAndSemesters = async () => {
      try {
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
      } catch (error) {
        console.error("Error fetching subjects and semesters:", error);
        setError("Failed to load subjects and semesters");
      }
    };

    fetchSubjectsAndSemesters();
  }, []);

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

  const filteredResults = selectedSubject
    ? results.filter(result => result.subject === selectedSubject)
    : selectedSemester
    ? results.filter(result => result.semester === selectedSemester)
    : results;

  const calculateAverage = (results) => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + result.percentage, 0);
    return (sum / results.length).toFixed(2);
  };

  const handleSemesterChange = (e) => {
    setSelectedSemester(e.target.value);
    setSelectedSubject("");
  };

  const handleSubjectChange = (e) => {
    setSelectedSubject(e.target.value);
  };

  return (
    <IntroAnimation loadingText="Loading Test Results...">
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <h1 className={styles.title}>Your Test Results</h1>
          
          {loading ? (
            <div className={styles.loading}>Loading your results...</div>
          ) : error ? (
            <div className={styles.error}>{error}</div>
          ) : (
            <>
              <div className={styles.filters}>
                <div className={styles.formGroup}>
                  <label htmlFor="semester" className={styles.label}>Filter by Semester:</label>
                  <select
                    id="semester"
                    value={selectedSemester}
                    onChange={handleSemesterChange}
                    className={styles.select}
                  >
                    <option value="">All Semesters</option>
                    {semesters.map((semester) => (
                      <option key={semester} value={semester}>
                        Semester {semester}
                      </option>
                    ))}
                  </select>
                </div>

                <div className={styles.formGroup}>
                  <label htmlFor="subject" className={styles.label}>Filter by Subject:</label>
                  <select
                    id="subject"
                    value={selectedSubject}
                    onChange={handleSubjectChange}
                    className={styles.select}
                    disabled={!selectedSemester}
                  >
                    <option value="">
                      {selectedSemester ? "All Subjects" : "Select semester first"}
                    </option>
                    {subjects.map((subject) => (
                      <option key={subject} value={subject}>
                        {subject}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              
              {filteredResults.length === 0 ? (
                <div className={styles.noResults}>
                  <p>
                    {selectedSubject 
                      ? `No test results found for ${selectedSubject} in Semester ${selectedSemester}.`
                      : selectedSemester 
                      ? `No test results found for Semester ${selectedSemester}.`
                      : "No test results found."
                    }
                  </p>
                </div>
              ) : (
                <>
                  <div className={styles.summary}>
                    <div className={styles.summaryContent}>
                      <h2>Performance Summary</h2>
                      <div className={styles.summaryStats}>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Total Tests</span>
                          <span className={styles.statValue}>{filteredResults.length}</span>
                        </div>
                        <div className={styles.statItem}>
                          <span className={styles.statLabel}>Average Score</span>
                          <span className={styles.statValue}>{calculateAverage(filteredResults)}%</span>
                        </div>
                        {selectedSemester && (
                          <div className={styles.statItem}>
                            <span className={styles.statLabel}>Semester</span>
                            <span className={styles.statValue}>{selectedSemester}</span>
                          </div>
                        )}
                        {selectedSubject && (
                          <div className={styles.statItem}>
                            <span className={styles.statLabel}>Subject</span>
                            <span className={styles.statValue}>{selectedSubject}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className={styles.resultsGrid}>
                    {filteredResults.map((result) => (
                      <div key={result.id} className={styles.resultCard}>
                        <div className={styles.cardHeader}>
                          <h3>{result.subject}</h3>
                          <div className={styles.scoreBadge}>
                            {result.percentage}%
                          </div>
                        </div>
                        
                        <div className={styles.cardBody}>
                          <div className={styles.resultDetails}>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Score</span>
                              <span className={styles.detailValue}>{result.obtainedMarks}/{result.totalMarks}</span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Percentage</span>
                              <span className={styles.detailValue}>{result.percentage}%</span>
                            </div>
                            <div className={styles.detailItem}>
                              <span className={styles.detailLabel}>Date</span>
                              <span className={styles.detailValue}>{new Date(result.addedAt).toLocaleDateString()}</span>
                            </div>
                            {result.semester && (
                              <div className={styles.detailItem}>
                                <span className={styles.detailLabel}>Semester</span>
                                <span className={styles.detailValue}>{result.semester}</span>
                              </div>
                            )}
                          </div>
                          
                          <div className={styles.percentageBar}>
                            <div className={styles.percentageLabel}>
                              Performance: {result.percentage}%
                            </div>
                            <div className={styles.percentageTrack}>
                              <div 
                                className={styles.percentageFill} 
                                style={{ width: `${result.percentage}%` }}
                              ></div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      </div>
    </IntroAnimation>
  );
}
