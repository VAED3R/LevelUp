"use client";

import { useState } from "react";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function AddNotes() {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      setError("Please select a file.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to upload file.");
      }

      const data = await response.json();
      setSuccess(`File uploaded successfully: ${data.url}`);
      setFile(null);
    } catch (error) {
      console.error("Upload failed:", error);
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className={styles.addNotesRoot}>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.content}>
          <h1>Upload Notes to Cloudinary</h1>
          <input type="file" onChange={handleFileChange} className={styles.fileInput} />
          <button onClick={handleUpload} className={styles.uploadButton} disabled={uploading}>
            {uploading ? "Uploading..." : "Upload"}
          </button>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}
        </div>
      </div>
      
    </div>
    
  );
}
