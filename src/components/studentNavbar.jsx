"use client";

import Link from "next/link";
import styles from './navbar.module.css';

export default function Navbar() {
  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>Student</div>
      <ul className={styles.navList}>
        <li className={styles.navItem}>
          <Link href="/studentDashboard" legacyBehavior>
            <a className={styles.navLink}>Dashboard</a>
          </Link>
        </li>
        <li className={styles.navItem}>
          <Link href="/Attendance" legacyBehavior>
            <a className={styles.navLink}>Attendance</a>
          </Link>
        </li>
        <li className={styles.navItem}>
          <Link href="/courseMats" legacyBehavior>
            <a className={styles.navLink}>Course Materials</a>
          </Link>
        </li>
      </ul>
    </nav>
  );
}
