"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from './navbar.module.css';

export default function Navbar() {
  const router = useRouter();

  const handleLogout = async () => {
    await signOut(auth);
    router.push("/login");
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>Parent</div>

      <div className={styles.navContent}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <Link href="/teacherDashboard" className={styles.navLink}>Dashboard</Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/Attendance" className={styles.navLink}>Student Performance</Link>
          </li>
        </ul>
        <button className={styles.logoutButton} onClick={handleLogout}>Logout</button>
      </div>
    </nav>
  );
}
