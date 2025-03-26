import styles from "./page.module.css"
export default function parentauth() {
  return (
    <div className={styles.container}>
      <div className={styles.boundary}>
      <h1>Parent Login</h1>
      <br />
    <div className={styles.email}><label for="email">Email:</label>
    <input type="email" id="email" name="email" required />
    <label for="password">Password:</label>
    <input type="password" id="password" name="password" required />
    <input type="submit" value="Submit" /></div>
    </div>
    </div>
  );
}