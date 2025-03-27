"use client";

import Navbar from "@/components/teacherNavbar";
import styles from "./page.module.css";
import { useState } from "react";

export default function ClassC() {
  const classes = [
    { id: 1, name: "Class 1", description: "Grade 1 - Mathematics" },
    { id: 2, name: "Class 2", description: "Grade 2 - Science" },
    { id: 3, name: "Class 3", description: "Grade 3 - English" },
    { id: 4, name: "Class 4", description: "Grade 4 - History" },
    { id: 5, name: "Class 5", description: "Grade 5 - Geography" }
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
              <p>{cls.description}</p>

              {/* Dropdown only on button hover */}
              <div className={styles.dropdownWrapper}>
                <button className={styles.button}>Action</button>
                <div className={styles.dropdown}>
                  <button className={styles.dropdownItem}>Assessment</button>
                  <button className={styles.dropdownItem}>Add notes</button>
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
