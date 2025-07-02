"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './AttentionSpanSettings.module.css';

export default function AttentionSpanSettings({ currentAttentionSpan, currentStudyPreference, currentLearningStyle, currentStudyTimePreference, currentPreferredDifficulty, onUpdate }) {
  const { user } = useAuth();
  const [attentionSpan, setAttentionSpan] = useState(currentAttentionSpan || 25);
  const [studyPreference, setStudyPreference] = useState(currentStudyPreference || 'visual');
  const [learningStyle, setLearningStyle] = useState(currentLearningStyle || 'active');
  const [studyTimePreference, setStudyTimePreference] = useState(currentStudyTimePreference || 'morning');
  const [preferredDifficulty, setPreferredDifficulty] = useState(currentPreferredDifficulty || 'medium');
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    setAttentionSpan(currentAttentionSpan || 25);
    setStudyPreference(currentStudyPreference || 'visual');
    setLearningStyle(currentLearningStyle || 'active');
    setStudyTimePreference(currentStudyTimePreference || 'morning');
    setPreferredDifficulty(currentPreferredDifficulty || 'medium');
  }, [currentAttentionSpan, currentStudyPreference, currentLearningStyle, currentStudyTimePreference, currentPreferredDifficulty]);

  const handleSave = async () => {
    if (!user) return;

    setIsSaving(true);
    setMessage('');

    try {
      const requestData = {
        studentId: user.uid,
        attentionSpan: attentionSpan,
        studyPreference: studyPreference,
        learningStyle: learningStyle,
        studyTimePreference: studyTimePreference,
        preferredDifficulty: preferredDifficulty
      };

      console.log('Sending request:', requestData);

      const response = await fetch('/api/learning-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
      });

      console.log('Response status:', response.status);
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error('API Error:', errorData);
        setMessage(`Failed to update study preferences: ${errorData.error || 'Unknown error'}`);
        return;
      }

      const result = await response.json();
      
      if (result.profile || result.success) {
        setMessage('Study preferences updated successfully!');
        if (onUpdate && result.profile) {
          onUpdate(result.profile);
        }
        // Clear message after 3 seconds
        setTimeout(() => setMessage(''), 3000);
      } else {
        setMessage('Failed to update study preferences. Please try again.');
      }
    } catch (error) {
      console.error('Error updating study preferences:', error);
      setMessage(`Error updating study preferences: ${error.message}`);
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

  const studyPreferences = [
    { value: 'visual', label: 'Visual', icon: '🎨', description: 'Diagrams, charts, videos' },
    { value: 'auditory', label: 'Auditory', icon: '🎧', description: 'Podcasts, discussions, lectures' },
    { value: 'reading', label: 'Reading', icon: '📚', description: 'Books, articles, notes' },
    { value: 'kinesthetic', label: 'Hands-on', icon: '🔧', description: 'Experiments, practice, projects' },
    { value: 'mixed', label: 'Mixed', icon: '🔄', description: 'Combination of methods' }
  ];

  const learningStyles = [
    { value: 'active', label: 'Active Learner', icon: '⚡', description: 'Learn by doing and discussing' },
    { value: 'reflective', label: 'Reflective Learner', icon: '🤔', description: 'Learn by thinking and analyzing' },
    { value: 'sequential', label: 'Sequential Learner', icon: '📋', description: 'Learn step-by-step, logically' },
    { value: 'global', label: 'Global Learner', icon: '🌍', description: 'Learn big picture first, then details' },
    { value: 'sensing', label: 'Sensing Learner', icon: '🔍', description: 'Learn facts and concrete examples' },
    { value: 'intuitive', label: 'Intuitive Learner', icon: '💡', description: 'Learn concepts and theories' }
  ];

  const timePreferences = [
    { value: 'early_morning', label: 'Early Morning', icon: '🌅', description: '5:00 AM - 8:00 AM' },
    { value: 'morning', label: 'Morning', icon: '☀️', description: '8:00 AM - 12:00 PM' },
    { value: 'afternoon', label: 'Afternoon', icon: '🌤️', description: '12:00 PM - 5:00 PM' },
    { value: 'evening', label: 'Evening', icon: '🌆', description: '5:00 PM - 9:00 PM' },
    { value: 'night', label: 'Night', icon: '🌙', description: '9:00 PM - 12:00 AM' },
    { value: 'late_night', label: 'Late Night', icon: '🌃', description: '12:00 AM - 5:00 AM' }
  ];

  const difficultyPreferences = [
    { value: 'beginner', label: 'Beginner', icon: '🌱', description: 'Start with basics and fundamentals' },
    { value: 'easy', label: 'Easy', icon: '😊', description: 'Simple concepts and straightforward content' },
    { value: 'medium', label: 'Medium', icon: '⚖️', description: 'Balanced challenge and complexity' },
    { value: 'hard', label: 'Hard', icon: '🔥', description: 'Advanced concepts and complex problems' },
    { value: 'expert', label: 'Expert', icon: '🏆', description: 'Master-level content and deep analysis' }
  ];

  const hasChanges = () => {
    return attentionSpan !== currentAttentionSpan || 
           studyPreference !== currentStudyPreference || 
           learningStyle !== currentLearningStyle ||
           studyTimePreference !== currentStudyTimePreference ||
           preferredDifficulty !== currentPreferredDifficulty;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h3>Study Preferences & Learning Style</h3>
        <p>Customize your learning experience for better results</p>
      </div>
      
      {/* Attention Span Section */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Attention Span</h4>
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
      </div>

      {/* Preferred Difficulty Section */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Preferred Difficulty Level</h4>
        <p className={styles.sectionDescription}>What level of challenge do you prefer in your learning materials?</p>
        <div className={styles.optionsGrid}>
          {difficultyPreferences.map((difficulty) => (
            <button
              key={difficulty.value}
              className={`${styles.optionCard} ${preferredDifficulty === difficulty.value ? styles.active : ''}`}
              onClick={() => setPreferredDifficulty(difficulty.value)}
            >
              <div className={styles.optionIcon}>{difficulty.icon}</div>
              <div className={styles.optionContent}>
                <h5>{difficulty.label}</h5>
                <p>{difficulty.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Study Time Preference Section */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Preferred Study Time</h4>
        <p className={styles.sectionDescription}>When do you feel most productive and focused?</p>
        <div className={styles.optionsGrid}>
          {timePreferences.map((time) => (
            <button
              key={time.value}
              className={`${styles.optionCard} ${studyTimePreference === time.value ? styles.active : ''}`}
              onClick={() => setStudyTimePreference(time.value)}
            >
              <div className={styles.optionIcon}>{time.icon}</div>
              <div className={styles.optionContent}>
                <h5>{time.label}</h5>
                <p>{time.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Study Preference Section */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Study Preference</h4>
        <p className={styles.sectionDescription}>How do you prefer to study and absorb information?</p>
        <div className={styles.optionsGrid}>
          {studyPreferences.map((pref) => (
            <button
              key={pref.value}
              className={`${styles.optionCard} ${studyPreference === pref.value ? styles.active : ''}`}
              onClick={() => setStudyPreference(pref.value)}
            >
              <div className={styles.optionIcon}>{pref.icon}</div>
              <div className={styles.optionContent}>
                <h5>{pref.label}</h5>
                <p>{pref.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Learning Style Section */}
      <div className={styles.section}>
        <h4 className={styles.sectionTitle}>Learning Style</h4>
        <p className={styles.sectionDescription}>How do you process and understand new information?</p>
        <div className={styles.optionsGrid}>
          {learningStyles.map((style) => (
            <button
              key={style.value}
              className={`${styles.optionCard} ${learningStyle === style.value ? styles.active : ''}`}
              onClick={() => setLearningStyle(style.value)}
            >
              <div className={styles.optionIcon}>{style.icon}</div>
              <div className={styles.optionContent}>
                <h5>{style.label}</h5>
                <p>{style.description}</p>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className={styles.actions}>
        <button 
          className={styles.saveButton}
          onClick={handleSave}
          disabled={isSaving || !hasChanges()}
        >
          {isSaving ? 'Saving...' : 'Save Study Preferences'}
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
          <li>Content recommendations will match your study preferences</li>
          <li>Learning materials will be tailored to your learning style</li>
          <li>AI recommendations will consider all your preferences</li>
          <li>Break recommendations will be calculated accordingly</li>
        </ul>
      </div>
    </div>
  );
} 