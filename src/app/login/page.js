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
    setIsClient(true);

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
      }
    } catch (error) {
      setError("Invalid email or password. Please try again.");
    }
  };

  if (!isClient) return null;

  return (
    <div className={styles.container}>
      {/* Left Side - Login Form */}
      <motion.div 
        className={styles.loginSection}
        initial={{ x: -100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <motion.div 
          className={styles.loginCard}
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.3, duration: 0.6 }}
        >
          <motion.p 
            className={styles.loginTitle}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Sign in
          </motion.p>
          
          <motion.p 
            className={styles.loginSubtitle}
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.6, duration: 0.6 }}
          >
            {role ? `Access your ${role} account` : "Enter your credentials"}
          </motion.p>

          <motion.form
            onSubmit={handleLogin}
            className={styles.form}
            initial="hidden"
            animate="visible"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.1 } },
            }}
          >
            <motion.div
              className={styles.field}
              variants={{
                hidden: { y: 20, opacity: 0 },
                visible: { y: 0, opacity: 1, transition: { duration: 0.4 } },
              }}
            >
              <label htmlFor="email">Email Address</label>
              <motion.input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="Enter your email"
                whileFocus={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
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
                placeholder="Enter your password"
                whileFocus={{ scale: 1.02 }}
                transition={{ duration: 0.2 }}
              />
            </motion.div>

            <motion.button
              type="submit"
              className={`${styles.submitButton} ${role === "student" ? styles.student : ""} 
                        ${role === "teacher" ? styles.teacher : ""} 
                        ${role === "parent" ? styles.parent : ""}`}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              transition={{
                type: "spring",
                stiffness: 200,
                damping: 25,
                delay: 0.8,
              }}
            >
              Sign In
            </motion.button>

            {error && (
              <motion.p
                className={styles.error}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
              >
                {error}
              </motion.p>
            )}
          </motion.form>
        </motion.div>
      </motion.div>

      {/* Right Side - LEVEL UP Branding */}
      <motion.div 
        className={styles.brandSection}
        initial={{ x: 100, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      >
        <div className={styles.brandContent}>
          <motion.div 
            className={styles.logoContainer}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6, ease: "easeOut" }}
          >
            <h1 className={styles.logo}>LEVEL UP</h1>
            <div className={styles.logoSubtitle}>Gamified Learning Platform</div>
          </motion.div>

          <motion.div 
            className={styles.features}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1, duration: 0.8 }}
          >
            <motion.div 
              className={styles.feature}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.2, duration: 0.6 }}
            >
              <span className={styles.featureIcon}>🎓</span>
              <span>Comprehensive Learning</span>
            </motion.div>
            
            <motion.div 
              className={styles.feature}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.4, duration: 0.6 }}
            >
              <span className={styles.featureIcon}>📈</span>
              <span>Track Progress</span>
            </motion.div>
            
            <motion.div 
              className={styles.feature}
              initial={{ x: 50, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ delay: 1.6, duration: 0.6 }}
            >
              <span className={styles.featureIcon}>🤝</span>
              <span>Collaborative Platform</span>
            </motion.div>
          </motion.div>

          <motion.div 
            className={styles.decorativeElements}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.8, duration: 1 }}
          >
            <div className={styles.floatingShape}></div>
            <div className={styles.floatingShape}></div>
            <div className={styles.floatingShape}></div>
          </motion.div>
        </div>
      </motion.div>
    </div>
  );
}
