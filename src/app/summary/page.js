"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";

export default function Summary() {
  const [pdfText, setPdfText] = useState("");
  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState({
    extraction: true,
    summarization: false
  });
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get("fileUrl");

  const summarizeText = async (text) => {
    try {
      setLoading(prev => ({ ...prev, summarization: true }));
      setError("");
      
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_GROQ_API_KEY}`
        },
        body: JSON.stringify({
          model: "llama-3.1-8b-instant",
          messages: [
            {
              role: "system",
              content: "You are a helpful assistant that summarizes text content. Provide a concise summary of the following text in 3-5 bullet points."
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.5,
          max_tokens: 1024
        })
      });

      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error?.message || "Failed to generate summary");
      }

      setSummary(data.choices[0]?.message?.content || "No summary generated");
    } catch (err) {
      setError(err.message);
      console.error("Summarization error:", err);
    } finally {
      setLoading(prev => ({ ...prev, summarization: false }));
    }
  };

  useEffect(() => {
    const extractText = async () => {
      if (!fileUrl) {
        setError("No PDF file URL provided");
        setLoading({ extraction: false, summarization: false });
        return;
      }

      try {
        setLoading({ extraction: true, summarization: false });
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
        // Automatically summarize after extraction
        await summarizeText(data.text);
      } catch (err) {
        setError(err.message);
        console.error("Extraction error:", err);
      } finally {
        setLoading(prev => ({ ...prev, extraction: false }));
      }
    };

    extractText();
  }, [fileUrl]);

  if (loading.extraction) return (
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
        
        {loading.summarization ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Generating summary...</p>
          </div>
        ) : (
          <div className={styles.summarySection}>
            <h2>AI Summary</h2>
            {summary ? (
              <div className={styles.summaryContent}>
                {summary.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            ) : (
              <p>No summary could be generated</p>
            )}
          </div>
        )}

        <div className={styles.pdfSection}>
          <h2>Original Text</h2>
          <div className={styles.pdfContent}>
            {pdfText ? (
              <pre>{pdfText}</pre>
            ) : (
              <p>No text could be extracted from this PDF</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}