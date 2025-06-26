"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './AttentionSpanSettings.module.css';

export default function AttentionSpanSettings({ currentAttentionSpan, onUpdate }) {
  const { user } = useAuth();
  const [attentionSpan, setAttentionSpan] = useState(currentAttentionSpan || 25);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setAttentionSpan(currentAttentionSpan || 25);
  }, [currentAttentionSpan]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setMessage('');

    try {
      const response = await fetch('/api/learning-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: user.uid,
          action: 'updateStudyPreferences',
          data: {
            attentionSpan: attentionSpan
          }
        }),
      });

      const result = await response.json();
      
      if (result.profile) {
        setMessage('Attention span updated successfully!');
        if (onUpdate) {
          onUpdate(result.profile);
        }
        // Clear message after 3 seconds
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update attention span. Please try again.');
      }
    } catch (error) {
      console.error('Error updating attention span:', error);
      setMessage('Error updating attention span. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const getAttentionSpanDescription = (minutes) => {
    if (minutes <= 15) return 'Short (15 min or less) - Great for quick review sessions';
    if (minutes <= 30) return 'Medium (16-30 min) - Balanced study sessions';
    if (minutes <= 45) return 'Long (31-45 min) - Extended focus periods';
    return 'Extended (45+ min) - Deep work sessions';
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Set Your Attention Span</h3>
        <p>Adjust your preferred study session duration</p>
      </div>
      
      <div className={styles.sliderContainer}>
        <div className={styles.sliderHeader}>
          <span className={styles.currentValue}>{attentionSpan} minutes</span>
          <span className={styles.description}>
            {getAttentionSpanDescription(attentionSpan)}
          </span>
        </div>
        
        <div className={styles.sliderWrapper}>
          <input
            type="range"
            min="10"
            max="90"
            step="5"
            value={attentionSpan}
            onChange={(e) => setAttentionSpan(parseInt(e.target.value))}
            className={styles.slider}
          />
          <div className={styles.sliderLabels}>
            <span>10 min</span>
            <span>30 min</span>
            <span>60 min</span>
            <span>90 min</span>
          </div>
        </div>
      </div>

      <div className={styles.presetButtons}>
        <button 
          className={`${styles.presetButton} ${attentionSpan === 15 ? styles.active : ''}`}
          onClick={() => setAttentionSpan(15)}
        >
          15 min
        </button>
        <button 
          className={`${styles.presetButton} ${attentionSpan === 25 ? styles.active : ''}`}
          onClick={() => setAttentionSpan(25)}
        >
          25 min
        </button>
        <button 
          className={`${styles.presetButton} ${attentionSpan === 45 ? styles.active : ''}`}
          onClick={() => setAttentionSpan(45)}
        >
          45 min
        </button>
        <button 
          className={`${styles.presetButton} ${attentionSpan === 60 ? styles.active : ''}`}
          onClick={() => setAttentionSpan(60)}
        >
          60 min
        </button>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving || attentionSpan === currentAttentionSpan}
        >
          {isSaving ? 'Saving...' : 'Save Attention Span'}
        </button>
      </div>

      {message && (
        <div className={`${styles.message} ${message.includes('successfully') ? styles.success : styles.error}`}>
          {message}
        </div>
      )}

      <div className={styles.info}>
        <h4>How this affects your learning:</h4>
        <ul>
          <li>Study sessions will be optimized for your attention span</li>
          <li>Break recommendations will be calculated accordingly</li>
          <li>Content recommendations will consider session duration</li>
          <li>AI recommendations will be tailored to your focus patterns</li>
        </ul>
      </div>
    </div>
  );
} 