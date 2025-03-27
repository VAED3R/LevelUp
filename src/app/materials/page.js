"use client";

import { useEffect, useState } from "react";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";  // Import the CSS module

export default function Materials() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchFiles = async () => {
      try {
        const response = await fetch("/api/files");
        if (!response.ok) {
          throw new Error("Failed to fetch files.");
        }

        const data = await response.json();
        setFiles(data);
      } catch (error) {
        console.error("Error fetching files:", error);
        setError("Failed to load files. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchFiles();
  }, []);

  if (loading) {
    return <div>Loading...</div>;
  }

  if (error) {
    return <div>{error}</div>;
  }

  return (
    <div>
      <Navbar />
      <div className={styles.container}>
        <h1 className={styles.title}>Uploaded Materials</h1>
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
                <a>Summary</a>

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
