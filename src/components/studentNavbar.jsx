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
      <div className={styles.logo}>Student</div>

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

        <div className={styles.buttonContainer}>
          {/* Button to check API key */}
          <button onClick={checkApiKey} className={styles.apiKeyButton}>
            Check API Key
          </button>

          {/* Logout button */}
          {user && (
            <button onClick={handleLogout} className={styles.logoutButton}>
              Logout
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
