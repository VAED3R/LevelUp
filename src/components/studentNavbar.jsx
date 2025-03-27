"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./navbar.module.css";

export default function Navbar() {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");  // Redirect to login after logout
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <nav className={styles.nav}>
      <div className={styles.logo}>Student</div>

      {/* Added wrapper for proper spacing */}
      <div className={styles.navContent}>
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

        {/* Logout button */}
        {user && (
          <button onClick={handleLogout} className={styles.logoutButton}>
            Logout
          </button>
        )}
      </div>
    </nav>
  );
}
