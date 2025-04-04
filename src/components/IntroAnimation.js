import React, { useEffect, useState } from 'react';
import styles from '../app/globalSearch/page.module.css';

const IntroAnimation = ({ children, loadingText = "Loading..." }) => {
  const [showContent, setShowContent] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowContent(true);
    }, 1500); // Show content after 1.5 seconds

    return () => clearTimeout(timer);
  }, []);

  if (!showContent) {
    return (
      <div className={styles.loadingOverlay}>
        <div className={styles.loadingContainer}>
          <div className={styles.loader}>
            <div className={styles.circles}>
              <span className={styles.one}></span>
              <span className={styles.two}></span>
              <span className={styles.three}></span>
            </div>
            <div className={styles.pacman}>
              <span className={styles.top}></span>
              <span className={styles.bottom}></span>
              <span className={styles.left}></span>
              <div className={styles.eye}></div>
            </div>
          </div>
          <div className={styles.loadingText}>{loadingText}</div>
          <div className={styles.progressBar}>
            <div className={styles.progressFill}></div>
          </div>
        </div>
      </div>
    );
  }

  return children;
};

export default IntroAnimation; 