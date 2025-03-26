import styles from "./styles.module.css"
import Link from "next/link";
export default function authorisation() {
    return (
        <div className={styles.container}>
            <Link href="/studauth"><div className={styles.button}>Student</div></Link>
            <a><div className={styles.button}>Parent</div></a>
            <a><div className={styles.button}>Teacher</div></a>
        </div>
    );
  }