"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { signOut } from "firebase/auth";
import { auth } from "@/lib/firebase";
import styles from "./navbar.module.css";
import TeacherChatbot from "./TeacherChatbot";

export default function Navbar() {
  const router = useRouter();
  const { user } = useAuth();

  const handleLogout = async () => {
    try {
      // Clear the authentication state before signing out
      localStorage.removeItem('wasAuthenticated');
      await signOut(auth);
      router.push("/login");  // Redirect directly to login after logout
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <>
      <nav className={styles.nav}>
        <div className={styles.logoContainer}>
          <div className={styles.logo}>Teacher</div>
        </div>

        <div className={styles.navContent}>
          <ul className={styles.navList}>
            <li className={styles.navItem}>
              <Link href="/teacherDashboard" className={styles.navLink}>Dashboard</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/teacherAttendance" className={styles.navLink}>Attendance</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/classC" className={styles.navLink}>Class Communities</Link>
            </li>
            <li className={styles.navItem}>
              <Link href="/TeacherChat"className={styles.navLink}>Assistant</Link>
            </li>
          </ul>
        </div>
        <div className={styles.buttonContainer}>
          {/* Logout button */}
          {user && (
            <button onClick={handleLogout} className={styles.logoutButton} suppressHydrationWarning>
              Logout
            </button>
          )}
        </div>
      </nav>
      <TeacherChatbot />
    </>
  );
}