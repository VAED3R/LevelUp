"use client";

import Navbar from "@/components/studentNavbar";
import styles from "./page.module.css";
import Link from "next/link";
import IntroAnimation from "../../components/IntroAnimation";

export default function CourseMats() {
    const subjects = [
        { id: 1, name: "Compiler Design" },
        { id: 2, name: "Machine Learning Concepts" },
        { id: 3, name: "Algorithm Analysis and Design" }
    ];

    return (
        <IntroAnimation loadingText="Loading Course Materials...">
            <div>
                <Navbar />
                <div className={styles.classContainer}>
                    <div className={styles.content}>
                        <h1 className={styles.title}>Course Materials</h1>
                        <div className={styles.cardGrid}>
                            {subjects.map((subject) => (
                                <div key={subject.id} className={styles.card}>
                                    <h2>{subject.name}</h2>

                                    {/* Single View Materials Button */}
                                    <Link href={`/materials?subject=${encodeURIComponent(subject.name)}`}>
                                        <button className={styles.button}>View Materials</button>
                                    </Link>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </IntroAnimation>
    );
}
