"use client";

import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function Assessment() {
    const searchParams = useSearchParams();
    const className = searchParams.get('class');

    return (
      <div className={styles.pageWrapper}>
        <Navbar />
        <div className={styles.assessmentContainer}>
            <div className={styles.headerSection}>
                <h1 className={styles.title}>Assessment Dashboard</h1>
                <div className={styles.classInfo}>
                    <span className={styles.classLabel}>Current Class:</span>
                    <span className={styles.className}>{className}</span>
                </div>
            </div>
            <div className={styles.cardGrid}>
                <Link 
                    href={`/testResults?class=${encodeURIComponent(className)}`} 
                    className={styles.card}
                >
                    <div className={styles.cardContent}>
                        <div className={styles.cardIcon}>📊</div>
                        <h2>Test Results</h2>
                        <p>Manage and analyze student test performance</p>
                        <div className={styles.cardAction}>
                            Access Results →
                        </div>
                    </div>
                </Link>
                <Link 
                    href={`/assignments?class=${encodeURIComponent(className)}`} 
                    className={styles.card}
                >
                    <div className={styles.cardContent}>
                        <div className={styles.cardIcon}>📝</div>
                        <h2>Assignments</h2>
                        <p>Create and manage class assignments</p>
                        <div className={styles.cardAction}>
                            Manage Assignments →
                        </div>
                    </div>
                </Link>
            </div>
        </div>
      </div>
    );
}