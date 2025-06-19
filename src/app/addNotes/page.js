"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/teacherNavbar";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";
import styles from "./page.module.css";

export default function AddNotes() {
  const searchParams = useSearchParams();
  const className = searchParams.get("class") || "Unknown Class";

  const [file, setFile] = useState(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [semester, setSemester] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [subjects, setSubjects] = useState([]);
  const [semesters, setSemesters] = useState([]);
  const [allSubjectsData, setAllSubjectsData] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch subjects and semesters from subjects collection
  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        const subjectsQuery = await getDocs(collection(db, "subjects"));
        const subjectsData = subjectsQuery.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        console.log("All subjects from collection:", subjectsData);

        // Store all subjects data for filtering later
        setAllSubjectsData(subjectsData);

        // Extract unique subject names and semesters
        const uniqueSubjects = [...new Set(
          subjectsData.map(subject => subject.courseName).filter(Boolean)
        )];
        const uniqueSemesters = [...new Set(
          subjectsData.map(subject => subject.semester).filter(Boolean)
        )];

        console.log("Available subjects:", uniqueSubjects);
        console.log("Available semesters:", uniqueSemesters);
        
        setSubjects(uniqueSubjects.sort());
        setSemesters(uniqueSemesters.sort());
      } catch (error) {
        console.error("Error fetching subjects:", error);
        setError("Failed to load subjects");
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  // Filter subjects based on selected semester
  useEffect(() => {
    if (semester && allSubjectsData.length > 0) {
      // Filter subjects by selected semester
      const filteredSubjects = allSubjectsData.filter(
        subject => subject.semester === semester
      );

      // Extract unique subject names for the selected semester
      const uniqueSubjects = [...new Set(
        filteredSubjects.map(subject => subject.courseName).filter(Boolean)
      )];

      console.log(`Subjects for semester ${semester}:`, uniqueSubjects);
      setSubjects(uniqueSubjects.sort());
      
      // Reset selected subject when semester changes
      setSubject("");
    } else if (allSubjectsData.length > 0) {
      // Show all subjects if no semester is selected
      const uniqueSubjects = [...new Set(
        allSubjectsData.map(subject => subject.courseName).filter(Boolean)
      )];
      setSubjects(uniqueSubjects.sort());
    }
  }, [semester, allSubjectsData]);

  const handleFileChange = (e) => {
    const selectedFile = e.target.files[0];
    if (selectedFile) {
      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file || !title || !subject || !semester || !description) {
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
    formData.append("semester", semester);
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
      setSemester("");
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

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.content}>
          <div className={styles.loadingState}>
            <div className={styles.loadingSpinner}></div>
            <p className={styles.loadingText}>Loading subjects...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h1 className={styles.sectionTitle}>Upload Course Materials</h1>
            <p className={styles.sectionSubtitle}>Add notes and materials for {className}</p>
          </div>

          <div className={styles.uploadForm}>
            <div className={styles.formRow}>
              <div className={styles.formGroup}>
                <label className={styles.label}>Title</label>
                <input
                  type="text"
                  placeholder="Enter material title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={styles.input}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className={styles.label}>Semester</label>
                <select
                  value={semester}
                  onChange={(e) => setSemester(e.target.value)}
                  className={styles.select}
                  required
                >
                  <option value="">Select Semester</option>
                  {semesters.map((semesterItem) => (
                    <option key={semesterItem} value={semesterItem}>
                      {semesterItem}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Subject</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={styles.select}
                required
                disabled={!semester}
              >
                <option value="">
                  {semester ? "Select Subject" : "Select semester first"}
                </option>
                {subjects.map((subjectName) => (
                  <option key={subjectName} value={subjectName}>
                    {subjectName}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Description</label>
              <textarea
                placeholder="Enter material description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className={styles.textarea}
                rows="4"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>File</label>
              <div className={styles.fileUploadArea}>
                <input
                  id="fileInput"
                  type="file"
                  onChange={handleFileChange}
                  className={styles.fileInput}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.jpg,.jpeg,.png"
                />
                <div className={styles.fileUploadContent}>
                  <div className={styles.fileUploadIcon}>📁</div>
                  <p className={styles.fileUploadText}>
                    {file ? file.name : "Click to select file or drag and drop"}
                  </p>
                  <p className={styles.fileUploadHint}>
                    Supported formats: PDF, DOC, DOCX, PPT, PPTX, TXT, JPG, PNG (Max 10MB)
                  </p>
                </div>
              </div>
            </div>

            {error && (
              <div className={`${styles.message} ${styles.error}`}>
                <span className={styles.messageIcon}>❌</span>
                {error}
              </div>
            )}
            
            {success && (
              <div className={`${styles.message} ${styles.success}`}>
                <span className={styles.messageIcon}>✅</span>
                {success}
              </div>
            )}

            <div className={styles.submitSection}>
              <button
                onClick={handleUpload}
                className={styles.submitButton}
                disabled={uploading}
              >
                <span className={styles.buttonIcon}>📤</span>
                {uploading ? "Uploading..." : "Upload Material"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
