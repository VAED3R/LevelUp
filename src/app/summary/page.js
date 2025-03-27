"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";

export default function Summary() {
  const [pdfText, setPdfText] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get("fileUrl");

  useEffect(() => {
    const extractText = async () => {
      if (!fileUrl) {
        setError("No PDF file URL provided");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        
        const response = await fetch("http://localhost:8000/extract-text", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ pdf_url: fileUrl }),
        });

        const data = await response.json();
        
        if (!response.ok) {
          throw new Error(data.detail || "Failed to extract text");
        }

        setPdfText(data.text);
      } catch (err) {
        setError(err.message);
        console.error("Extraction error:", err);
      } finally {
        setLoading(false);
      }
    };

    extractText();
  }, [fileUrl]);

  if (loading) return (
    <div className={styles.loading}>
      <div className={styles.spinner}></div>
      <p>Extracting text from PDF...</p>
    </div>
  );

  if (error) return (
    <div className={styles.errorContainer}>
      <h2>Error Processing PDF</h2>
      <p>{error}</p>
      <button 
        className={styles.retryButton}
        onClick={() => window.location.reload()}
      >
        Try Again
      </button>
    </div>
  );

  return (
    <div>
      <Navbar />
      <div className={styles.container}>
        <h1>PDF Summary</h1>
        <div className={styles.pdfContent}>
          {pdfText ? (
            <pre>{pdfText}</pre>
          ) : (
            <p>No text could be extracted from this PDF</p>
          )}
        </div>
      </div>
    </div>
  );
}