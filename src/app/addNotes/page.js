"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";

export default function AddNotes() {
  const searchParams = useSearchParams();
  const className = searchParams.get("class") || "Unknown Class";

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
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
    if (!file || !title || !subject || !description) {
      setError("Please fill in all fields and select a file.");
      return;
    }

    // Validate file size
    if (file.size > 10 * 1024 * 1024) {
      setError("File size exceeds 10MB limit. Please choose a smaller file.");
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    const formData = new FormData();
    formData.append("file", file);
    formData.append("title", title);
    formData.append("subject", subject);
    formData.append("description", description);
    formData.append("class", className);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to upload file.");
      }

      setSuccess("File uploaded successfully!");

      // Reset form
      setFile(null);
      setTitle("");
      setSubject("");
      setDescription("");

      // Clear the file input field
      document.getElementById("fileInput").value = "";
    } catch (error) {
      console.error("Upload failed:", error);
      setError(error.message || "Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  };


  return (
    <div className={styles.addNotesRoot}>
      <Navbar />
      <div className={styles.container}>
        <div className={styles.content}>
          <h1>Upload Notes for {className}</h1>

          <input
            type="text"
            placeholder="Title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className={styles.textBox}
          />

          <input
            type="text"
            placeholder="Subject"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className={styles.textBox}
          />

          <textarea
            placeholder="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={styles.textArea}
          />

          <input
            id="fileInput"
            type="file"
            onChange={handleFileChange}
            className={styles.fileInput}
          />

          <button
            onClick={handleUpload}
            className={styles.uploadButton}
            disabled={uploading}
          >
            {uploading ? "Uploading..." : "Upload"}
          </button>

          {error && <p className={styles.error}>{error}</p>}
          {success && <p className={styles.success}>{success}</p>}
        </div>
      </div>
    </div>
  );
}
