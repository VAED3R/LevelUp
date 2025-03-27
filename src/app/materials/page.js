"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation"; 
import { getFirestore, doc, getDoc } from "firebase/firestore";
import { getAuth, onAuthStateChanged } from "firebase/auth";
import { app } from "@/lib/firebase";  // Your Firebase config
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import Loading from '@/components/loading';

export default function Materials() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userClass, setUserClass] = useState("");

  const searchParams = useSearchParams();
  const subject = searchParams.get("subject");

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
        }
      } catch (error) {
        console.error("Error fetching user class:", error);
        setError("Failed to load user data.");
      }
    };

    const auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
      if (user) {
        fetchUserClass(user.uid);  // Fetch class by current user ID
      } else {
        setError("User not authenticated.");
        setLoading(false);
      }
    });
  }, []);

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

  if (loading) {
    return <Loading />;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      <Navbar />
      <div className={styles.container}>
        <h1 className={styles.title}>
          {subject ? `Materials for ${subject} - ${userClass}` : "Uploaded Materials"}
        </h1>
        {files.length === 0 ? (
          <p>No files uploaded yet.</p>
        ) : (
          <div className={styles.fileList}>
            {files.map((file) => (
              <div key={file.id} className={styles.fileCard}>
                <h2>{file.title}</h2>
                <p><strong>Subject:</strong> {file.subject}</p>
                <p><strong>Class:</strong> {file.className}</p>
                <p>{file.description}</p>
                <a href={file.url} target="_blank" rel="noopener noreferrer">View File</a>
                <a style={{ marginLeft: "15px" }}>Summary</a>
                <p className={styles.uploadDate}>
                  Uploaded: {new Date(file.uploadedAt).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
