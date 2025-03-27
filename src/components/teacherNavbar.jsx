"use client";

import Link from "next/link";
import styles from './navbar.module.css';

export default function Navbar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>
        Teacher
      </div>
      <ul className={styles.navList}>
        <li className={styles.navItem}>
          <Link href="/teacherDashboard" className={styles.navLink}>Dashboard</Link>
        </li>
        <li className={styles.navItem}>
          <Link href="/Attendance" className={styles.navLink}>Attendance</Link>
        </li>
        <li className={styles.navItem}>
          <Link href="/addNotes" className={styles.navLink}>Notes</Link>
        </li>
      </ul>
    </nav>
  );
}
