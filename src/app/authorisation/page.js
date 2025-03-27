"use client";
import styles from "./page.module.css";
import Link from "next/link";
import { Cabin_Sketch } from "next/font/google";

const cabinSketch = Cabin_Sketch({ weight: "400", subsets: ["latin"] });

export default function Authorisation() {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.heading}>Choose Your Login</h1>
        <div className={styles.buttons}>
          <Link href="/login?role=student" className={styles.link}>
            <div className={styles.button}>Student</div>
          </Link>

          <Link href="/login?role=teacher" className={styles.link}>
            <div className={styles.button}>Teacher</div>
          </Link>

          <Link href="/login?role=parent" className={styles.link}>
            <div className={styles.button}>Parent</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
