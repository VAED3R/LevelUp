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

  // ✅ Check API Key directly
  const checkApiKey = () => {
    const apiKey = process.env.NEXT_PUBLIC_DEEPSEEK_API_KEY;
    alert(`API Key: ${apiKey ? apiKey : "Not loaded"}`);
    console.log("API Key:", apiKey);
  };

  return (
    <nav className={styles.nav}>
      {/* Logo placed on the leftmost side */}
      <div className={styles.logoContainer}>
        <div className={styles.logo}>Student</div>
      </div>

      {/* Navigation and Logout button centered */}
      <div className={styles.navContent}>
        <ul className={styles.navList}>
          <li className={styles.navItem}>
            <Link href="/studentDashboard" className={styles.navLink}>Dashboard</Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/studentAttendance" className={styles.navLink}>Attendance</Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/leaderboard" className={styles.navLink}>Leaderboard</Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/courseMats" className={styles.navLink}>Course Materials</Link>
          </li>
          <li className={styles.navItem}>
            <Link href="/globalSearch" className={styles.navLink}>Global Search</Link>
          </li>
        </ul>
      </div>
      <div className={styles.buttonContainer}>
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
