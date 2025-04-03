"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";
import { collection, query, where, getDocs, orderBy, doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from './page.module.css';

export default function ViewResults() {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const router = useRouter();

  useEffect(() => {
    const fetchResults = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
          router.push("/login");
          return;
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
        
        // Extract unique subjects
        const uniqueSubjects = [...new Set(marksData.map(mark => mark.subject))];
        setSubjects(uniqueSubjects);
        
        setLoading(false);
      } catch (error) {
        console.error("Error fetching results:", error);
        setError("Failed to load results");
        setLoading(false);
      }
    };

    fetchResults();
  }, [router]);

  const filteredResults = selectedSubject
    ? results.filter(result => result.subject === selectedSubject)
    : results;

  const calculateAverage = (results) => {
    if (results.length === 0) return 0;
    const sum = results.reduce((acc, result) => acc + result.percentage, 0);
    return (sum / results.length).toFixed(2);
  };

  return (
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
                <label htmlFor="subject" className={styles.label}>Filter by Subject:</label>
                <select
                  id="subject"
                  value={selectedSubject}
                  onChange={(e) => setSelectedSubject(e.target.value)}
                  className={styles.select}
                >
                  <option value="">All Subjects</option>
                  {subjects.map((subject) => (
                    <option key={subject} value={subject}>
                      {subject.replace(/_/g, " ")}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {filteredResults.length === 0 ? (
              <div className={styles.noResults}>
                <p>No test results found.</p>
              </div>
            ) : (
              <>
                <div className={styles.summary}>
                  <h2>Summary</h2>
                  <p>Total Tests: {filteredResults.length}</p>
                  <p>Average Score: {calculateAverage(filteredResults)}%</p>
                </div>
                
                <div className={styles.resultsGrid}>
                  {filteredResults.map((result) => (
                    <div key={result.id} className={styles.resultCard}>
                      <h3>{result.subject.replace(/_/g, " ")}</h3>
                      <div className={styles.resultDetails}>
                        <p><strong>Score:</strong> {result.obtainedMarks}/{result.totalMarks}</p>
                        <p><strong>Percentage:</strong> {result.percentage}%</p>
                        <p><strong>Date:</strong> {new Date(result.addedAt).toLocaleDateString()}</p>
                      </div>
                      <div className={styles.percentageBar}>
                        <div 
                          className={styles.percentageFill} 
                          style={{ width: `${result.percentage}%` }}
                        ></div>
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
  );
}
