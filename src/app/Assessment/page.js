"use client";

import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";
import Link from "next/link";
import { useSearchParams } from "next/navigation";

export default function Assessment() {
    const searchParams = useSearchParams();
    const className = searchParams.get('class');

    return (
        <div className={styles.container}>
            <Navbar />
            <div className={styles.content}>
                <div className={styles.section}>
                    <div className={styles.sectionHeader}>
                        <h1 className={styles.sectionTitle}>Assessment Dashboard</h1>
                        <p className={styles.sectionSubtitle}>Manage and analyze student performance</p>
                    </div>

                    <div className={styles.cardsGrid}>
                        <Link 
                            href={`/testResults?class=${encodeURIComponent(className)}`} 
                            className={styles.card}
                        >
                            <div className={styles.cardContent}>
                                <div className={styles.cardIcon}>📊</div>
                                <h2 className={styles.cardTitle}>Test Results</h2>
                                <p className={styles.cardDescription}>Manage and analyze student test performance with detailed insights and analytics</p>
                                <div className={styles.cardAction}>
                                    <span className={styles.actionText}>Access Results</span>
                                    <span className={styles.actionArrow}>→</span>
                                </div>
                            </div>
                        </Link>
                        
                        <Link 
                            href={`/assignments?class=${encodeURIComponent(className)}`} 
                            className={styles.card}
                        >
                            <div className={styles.cardContent}>
                                <div className={styles.cardIcon}>📝</div>
                                <h2 className={styles.cardTitle}>Assignments</h2>
                                <p className={styles.cardDescription}>Create, manage, and track class assignments with comprehensive tools</p>
                                <div className={styles.cardAction}>
                                    <span className={styles.actionText}>Manage Assignments</span>
                                    <span className={styles.actionArrow}>→</span>
                                </div>
                            </div>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}