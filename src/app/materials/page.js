"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation"; 
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { app } from "@/lib/firebase";  // Your Firebase config
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import Loading from '@/components/loading';
import IntroAnimation from "../../components/IntroAnimation";
import { useAuth } from "@/context/AuthContext";

export default function Materials() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userClass, setUserClass] = useState("");
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const { user, loading: authLoading } = useAuth();

  const searchParams = useSearchParams();
  const subject = searchParams.get("subject");
  const router = useRouter();  // For navigation

  useEffect(() => {
    const fetchUserClass = async (userId) => {
      try {
        const db = getFirestore(app);
        const userRef = doc(db, "users", userId);
        const userSnap = await getDoc(userRef);

        if (userSnap.exists()) {
          const userData = userSnap.data();
          setUserClass(userData.class);  // Store the user's class
        } else {
          console.error("No such user!");
          setError("User data not found.");
        }
      } catch (error) {
        console.error("Error fetching user class:", error);
        setError("Failed to load user data.");
      }
    };

    // Use cached auth user instead of onAuthStateChanged
    if (user) {
      fetchUserClass(user.uid);
    } else if (!authLoading) {
      setError("User not authenticated.");
      setLoading(false);
    }
  }, [user, authLoading]);

  useEffect(() => {
    const fetchFiles = async () => {
      if (!userClass) return;  // Wait until user class is fetched

      try {
        const response = await fetch("/api/files");
        if (!response.ok) {
          throw new Error("Failed to fetch files.");
        }

        const data = await response.json();

        // Filter files by subject and class
        const filteredFiles = data.filter(file =>
          (!subject || file.subject === subject) && file.className === userClass
        );

        setFiles(filteredFiles);
        setFilteredFiles(filteredFiles);
      } catch (error) {
        console.error("Error fetching files:", error);
        setError("Failed to load files. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    if (userClass) {
      fetchFiles();
    }
  }, [subject, userClass]);

  // Filter files based on search term
  useEffect(() => {
    if (!files || files.length === 0) return;
    
    if (searchTerm.trim() === "") {
      setFilteredFiles(files);
    } else {
      const searchTermLower = searchTerm.toLowerCase().trim();
      const filtered = files.filter(file => 
        (file.title && file.title.toLowerCase().includes(searchTermLower)) ||
        (file.description && file.description.toLowerCase().includes(searchTermLower)) ||
        (file.subject && file.subject.toLowerCase().includes(searchTermLower))
      );
      setFilteredFiles(filtered);
      console.log(`Searching for "${searchTerm}" - Found ${filtered.length} results`);
    }
  }, [searchTerm, files]);

  // 🛠️ Function to navigate to the summary page with the file URL as a query param
  const handleSummary = (fileUrl) => {
    router.push(`/summary?fileUrl=${encodeURIComponent(fileUrl)}`);
  };

  // Format date to a more readable format
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading || authLoading) {
    return (
      <IntroAnimation loadingText="Loading Study Materials...">
        <div className={styles.container}>
          <Navbar />
          <div className={styles.skeletonContainer}>
            <div className={styles.skeletonTitle}></div>
            <div className={styles.skeletonSearch}></div>
            <div className={styles.skeletonGrid}>
              {[1, 2, 3, 4].map((item) => (
                <div key={item} className={styles.skeletonCard}>
                  <div className={styles.skeletonCardTitle}></div>
                  <div className={styles.skeletonCardInfo}></div>
                  <div className={styles.skeletonCardDescription}></div>
                  <div className={styles.skeletonCardButtons}></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </IntroAnimation>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  // Log when the full page loads
  console.log("Materials page fully loaded - Files:", filteredFiles.length, "Subject:", subject, "User Class:", userClass);

  return (
    <IntroAnimation loadingText="Loading Study Materials...">
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <h1 className={styles.title}>
            {subject ? `${subject} Materials - ${userClass}` : `All Materials - ${userClass}`}
          </h1>
          
          {files.length > 0 && (
            <div className={styles.searchContainer}>
              <input
                type="text"
                placeholder="Search by title, description, or subject..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={styles.searchInput}
                aria-label="Search materials"
              />
            </div>
          )}
          
          {filteredFiles.length === 0 ? (
            <p className={styles.nofile}>
              {searchTerm ? "No materials found matching your search." : "No materials available yet."}
            </p>
          ) : (
            <div className={styles.fileList}>
              {filteredFiles.map((file) => (
                <div key={file.id} className={styles.fileCard}>
                  <div className={styles.cardContent}>
                    <h2>{file.title}</h2>
                    
                    <div className={styles.infoGrid}>
                      <div className={styles.infoItem}>
                        <strong>Subject</strong>
                        <span>{file.subject}</span>
                      </div>
                      <div className={styles.infoItem}>
                        <strong>Class</strong>
                        <span>{file.className}</span>
                      </div>
                    </div>
                    
                    <div className={styles.descriptionSection}>
                      <h3>Description</h3>
                      <p className={styles.description}>{file.description}</p>
                    </div>
                    
                    <div className={styles.buttonContainer}>
                      <a href={file.url} target="_blank" rel="noopener noreferrer">View File</a>
                      <button 
                        onClick={() => handleSummary(file.url)}
                        className={styles.summaryButton}
                      >
                        Summary
                      </button>
                    </div>
                    
                    <p className={styles.uploadDate}>
                      Uploaded: {formatDate(file.uploadedAt)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </IntroAnimation>
  );
}
