import styles from "./loading.module.css";

const Loading = () => {
  return (
    <div className={styles.loaderContainer}>
      <div className={styles.loader}></div>
      <p>Loading...</p>
    </div>
  );
};

export default Loading;
