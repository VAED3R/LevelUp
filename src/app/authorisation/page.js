"use client";
import styles from "./page.module.css";
import Link from "next/link";
import { Cabin_Sketch } from "next/font/google";
import { motion } from "framer-motion";

const cabinSketch = Cabin_Sketch({ weight: "400", subsets: ["latin"] });

export default function Authorisation() {
  return (
    <div className={styles.container}>
      <motion.div
        className={styles.card}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6 }}
      >
        <motion.h1
          className={styles.heading}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2, duration: 0.5 }}
        >
          Choose Your Login
        </motion.h1>

        <motion.div
          className={styles.buttons}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4, duration: 0.5 }}
        >
          <Link href="/login?role=student" className={styles.link}>
            <motion.div
              className={styles.button}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.4 }}
            >
              Student
            </motion.div>
          </Link>

          <Link href="/login?role=teacher" className={styles.link}>
            <motion.div
              className={styles.button}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8, duration: 0.4 }}
            >
              Teacher
            </motion.div>
          </Link>

          <Link href="/login?role=parent" className={styles.link}>
            <motion.div
              className={styles.button}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1, duration: 0.4 }}
            >
              Parent
            </motion.div>
          </Link>
        </motion.div>
      </motion.div>
    </div>
  );
}
