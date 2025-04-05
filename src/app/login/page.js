"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion } from "framer-motion";
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
  const [isClient, setIsClient] = useState(false);

  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    setIsClient(true); // Ensure animations only run on the client

    const roleParam = searchParams.get("role");
    if (roleParam) {
      setRole(roleParam);
    } else {
      router.push("/login");
    }

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
        }
      } /*else {
        setError("No user data found.");
      }*/
    } catch (error) {
      setError("Invalid email or password. Please try again.");
    }
  };

  if (!isClient) return null;

  return (
    <motion.div
      className={styles.container}
      initial={{ backgroundPosition: "50% 50%" }}
      animate={{ backgroundPosition: ["0% 0%", "100% 100%", "0% 0%"] }}
      transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
    >
      <div className={styles.card}>
        <motion.h1
          className={styles.heading}
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
        >
          {role ? `${role.charAt(0).toUpperCase() + role.slice(1)} Login` : "Login"}
        </motion.h1>

        <motion.form
          onSubmit={handleLogin}
          className={styles.form}
          initial="hidden"
          animate="visible"
          variants={{
            hidden: { opacity: 0 },
            visible: { opacity: 1, transition: { staggerChildren: 0.2 } },
          }}
        >
          <motion.div
            className={styles.field}
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1, transition: { duration: 0.4 } },
            }}
          >
            <label htmlFor="email">Email</label>
            <motion.input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              whileFocus={{ scale: 1.05 }} // Increases the size of the input field on focus
              transition={{ duration: 0.3 }} // Smooth transition duration
            />
          </motion.div>

          <motion.div
            className={styles.field}
            variants={{
              hidden: { y: 20, opacity: 0 },
              visible: { y: 0, opacity: 1, transition: { duration: 0.4 } },
            }}
          >
            <label htmlFor="password">Password</label>
            <motion.input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              whileFocus={{ scale: 1.05 }} // Increases the size of the input field on focus
              transition={{ duration: 0.3 }} // Smooth transition duration
            />
          </motion.div>

          {/* Animated Login Button with fade-in and smooth expansion */}
          <motion.button
            type="submit"
            className={`${styles.submitButton} ${role === "student" ? styles.student : ""} 
                      ${role === "teacher" ? styles.teacher : ""} 
                      ${role === "parent" ? styles.parent : ""}`}
            initial={{ scale: 0.8, opacity: 0 }} // Start small and invisible
            animate={{ scale: 1, opacity: 1 }}  // Final state (normal size and fully visible)
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 25,
              delay: 0.8, // Delay to create the smooth entrance
            }}
          >
            Login
          </motion.button>

          {error && (
            <motion.p
              className={styles.error}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              {error}
            </motion.p>
          )}
        </motion.form>
      </div>
    </motion.div>
  );
}
