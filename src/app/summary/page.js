"use client";

import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import Navbar from "@/components/studentNavbar";
import Loading from "@/components/loading";
import styles from "./page.module.css";

export default function Summary() {
  const searchParams = useSearchParams();
  const fileUrl = searchParams.get("fileUrl");

  const [summary, setSummary] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        const response = await fetch("/api/summary", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileUrl })
        });

        if (!response.ok) {
          throw new Error("Failed to generate summary.");
        }

        const data = await response.json();
        setSummary(data.summary);
      } catch (error) {
        console.error("Error fetching summary:", error);
        setError("Failed to generate summary.");
      } finally {
        setLoading(false);
      }
    };

    if (fileUrl) {
      fetchSummary();
    }
  }, [fileUrl]);

  if (loading) return <Loading />;
  if (error) return <div>{error}</div>;

  return (
    <div>
      <Navbar />
      <div className={styles.container}>
        <h1 className={styles.title}>File Summary</h1>
        <div className={styles.summaryBox}>
          <pre>{summary}</pre>
        </div>
      </div>
    </div>
  );
}
