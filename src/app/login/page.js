"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInWithEmailAndPassword, setPersistence, browserLocalPersistence } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useAuth } from "@/context/AuthContext";
import styles from "./page.module.css";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [role, setRole] = useState("");

  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    const roleParam = searchParams.get("role");
    if (roleParam) {
      setRole(roleParam);
    } else {
      router.push("/");
    }

    // Redirect if already logged in
    if (!loading && user) {
      router.push(`/${user.role}Dashboard`);
    }
  }, [searchParams, router, user, loading]);

  const handleLogin = async (e) => {
    e.preventDefault();

    try {
      await setPersistence(auth, browserLocalPersistence);

      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      const userDoc = await getDoc(doc(db, "users", user.uid));

      if (userDoc.exists()) {
        const userData = userDoc.data();

        if (userData.role === role) {
          console.log(`${role} login successful`);
          router.push(`/${role}Dashboard`);
        } else {
          console.error("Unauthorized role");
          setError(`You are not authorized to log in as ${role}.`);
        }
      } else {
        console.error("No user data found");
        setError("No user data found.");
      }
    } catch (error) {
      console.error("Error logging in:", error);
      setError("Invalid email or password. Please try again.");
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.heading}>
          {role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Login` : "Login"}
        </h1>
        <form onSubmit={handleLogin} className={styles.form}>
          <div className={styles.field}>
            <label htmlFor="email">Email</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className={`${styles.submitButton} ${role === "student" ? styles.student : ""} 
                      ${role === "teacher" ? styles.teacher : ""} 
                      ${role === "parent" ? styles.parent : ""}`}
          >
            Login
          </button>

          {error && <p className={styles.error}>{error}</p>}
        </form>
      </div>
    </div>
  );
}
