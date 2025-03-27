"use client";

import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";
import Link from "next/link";

export default function ClassC() {
    const classes = [
        { id: 1, name: "S6CO" },
        { id: 2, name: "S6CS" },
        { id: 3, name: "S6CT" },
        { id: 4, name: "S6CS2" }
    ];

    return (
        <div>
            <Navbar />
            <div className={styles.classContainer}>
                <div className={styles.content}>
                    <h1 className={styles.title}>Class Dashboard</h1>
                    <div className={styles.cardGrid}>
                        {classes.map((cls) => (
                            <div key={cls.id} className={styles.card}>
                                <h2>{cls.name}</h2>
                                
                                {/* Dropdown only on button hover */}
                                <div className={styles.dropdownWrapper}>
                                    <button className={styles.button}>Action</button>
                                    <div className={styles.dropdown}>
                                        <Link href="/assessment" className={styles.dropdownItem}>
                                            Assessment
                                        </Link>
                                        <Link href={`/addNotes?class=${encodeURIComponent(cls.name)}`}>
                                            <div className={styles.dropdownItem}>Add Notes</div>
                                        </Link>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
