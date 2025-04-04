"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import remarkMath from "remark-math";
import "katex/dist/katex.min.css";

export default function Summary() {
  const [pdfText, setPdfText] = useState("");
  const [summary, setSummary] = useState("");
  const [customPrompt, setCustomPrompt] = useState(
    "You are a helpful assistant that summarizes text content. Provide a concise summary of the following text in 3-5 bullet points."
  );
  const [charCount, setCharCount] = useState(0);
  const [loading, setLoading] = useState({
    extraction: true,
    summarization: false,
  });
  const [error, setError] = useState("");
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get("fileUrl");

  const summarizeText = async (text) => {
    try {
      setLoading((prev) => ({ ...prev, summarization: true }));
      setError("");

      const response = await fetch("https://api.deepseek.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY}`,
        },
        body: JSON.stringify({
          model: "deepseek-chat",
          messages: [
            {
              role: "system",
              content: customPrompt, 
            },
            {
              role: "user",
              content: text,
            },
          ],
          temperature: 0.5,
          max_tokens: 1024,
        }),
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
      setLoading((prev) => ({ ...prev, summarization: false }));
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

        await summarizeText(data.text);
      } catch (err) {
        setError(err.message);
        console.error("Extraction error:", err);
      } finally {
        setLoading((prev) => ({ ...prev, extraction: false }));
      }
    };

    extractText();
  }, [fileUrl]);

  const handlePromptChange = (e) => {
    setCustomPrompt(e.target.value);
    setCharCount(e.target.value.length);
  };

  const handleSummarizeClick = () => {
    summarizeText(pdfText);
  };

  if (loading.extraction)
    return (
      <div className={styles.loading}>
        <div className={styles.spinner}></div>
        <p>Extracting text from PDF...</p>
      </div>
    );

  if (error)
    return (
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

        <div className={styles.promptContainer} data-char-count={`${charCount} characters`}>
          <label htmlFor="prompt">Custom Summary Prompt:</label>
          <textarea
            id="prompt"
            value={customPrompt}
            onChange={handlePromptChange}
            className={styles.promptInput}
            placeholder="Enter your custom prompt..."
            maxLength={500}
          />
          <button onClick={handleSummarizeClick} className={styles.summarizeButton}>
            Summarize Again
          </button>
        </div>

        {loading.summarization ? (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Generating summary...</p>
          </div>
        ) : (
          <div className={styles.summarySection}>
            {summary ? (
              <div className={styles.summaryContent}>
                <h2>AI Summary</h2>
                <ReactMarkdown
                  children={summary}
                  remarkPlugins={[remarkMath]}
                  rehypePlugins={[rehypeKatex]}
                />
              </div>
            ) : (
              <p>No summary could be generated</p>
            )}
          </div>
        )}

        <div className={styles.pdfSection}>
          <h2>Original Text</h2>
          <div className={styles.pdfContent}>
            {pdfText ? <pre>{pdfText}</pre> : <p>No text could be extracted from this PDF</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
