"use client";

import Link from "next/link";
import styles from './navbar.module.css';

export default function Navbar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        Student
      </div>
      <ul className={styles.navList}>
        <li className={styles.navItem}>
          <Link href="/studentDashboard" className={styles.navLink}>Dashboard</Link>
        </li>
        <li className={styles.navItem}>
          <Link href="/Attendance" className={styles.navLink}>Attendance</Link>
        </li>
        <li className={styles.navItem}>
          <Link href="/courseMats" className={styles.navLink}>Course Materials</Link>
        </li>
      </ul>
    </nav>
  );
}
