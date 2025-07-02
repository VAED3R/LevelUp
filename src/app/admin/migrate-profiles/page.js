"use client";

import { useState } from 'react';
import styles from './page.module.css';

export default function MigrateProfiles() {
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const runMigration = async () => {
    setIsRunning(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch('/api/learning-profile', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          action: 'migrateAllProfiles'
        }),
      });

      const data = await response.json();
      
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || 'Migration failed');
      }
    } catch (err) {
      setError('Error running migration: ' + err.message);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Learning Profiles Migration</h1>
        <p>Update all existing learning profiles with new study preference and learning style fields</p>
      </div>

      <div className={styles.content}>
        <div className={styles.info}>
          <h3>What this migration does:</h3>
          <ul>
            <li>Adds <code>studyPreference</code> field (default: 'visual')</li>
            <li>Adds <code>learningStyle</code> field (default: 'active')</li>
            <li>Ensures all profiles have required fields with default values</li>
            <li>Updates <code>lastUpdated</code> timestamp</li>
          </ul>
        </div>

        <div className={styles.actions}>
          <button 
            className={styles.migrateButton}
            onClick={runMigration}
            disabled={isRunning}
          >
            {isRunning ? 'Running Migration...' : 'Run Migration'}
          </button>
        </div>

        {error && (
          <div className={styles.error}>
            <h3>Error</h3>
            <p>{error}</p>
          </div>
        )}

        {result && (
          <div className={styles.result}>
            <h3>Migration Results</h3>
            <div className={styles.resultDetails}>
              <p><strong>Status:</strong> {result.message}</p>
              <p><strong>Total Profiles:</strong> {result.results.total}</p>
              <p><strong>Profiles Updated:</strong> {result.results.migrated}</p>
              {result.results.errors.length > 0 && (
                <div className={styles.errors}>
                  <h4>Errors ({result.results.errors.length}):</h4>
                  <ul>
                    {result.results.errors.map((err, index) => (
                      <li key={index}>
                        Profile {err.profileId}: {err.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
} 