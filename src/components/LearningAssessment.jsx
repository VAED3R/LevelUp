"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './LearningAssessment.module.css';

export default function LearningAssessment({ onComplete, onClose }) {
  const { user } = useAuth();
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [answers, setAnswers] = useState({});
  const [loading, setLoading] = useState(false);

  const assessmentQuestions = [
    {
      id: 1,
      question: "When studying for an exam, I prefer to:",
      options: [
        { text: "Read textbooks and take notes", value: "reading" },
        { text: "Watch educational videos", value: "visual" },
        { text: "Listen to lectures or podcasts", value: "auditory" },
        { text: "Do hands-on activities or experiments", value: "kinesthetic" }
      ]
    },
    {
      id: 2,
      question: "I learn best when I can:",
      options: [
        { text: "See diagrams and charts", value: "visual" },
        { text: "Hear explanations and discussions", value: "auditory" },
        { text: "Move around and interact physically", value: "kinesthetic" },
        { text: "Read and write about the topic", value: "reading" }
      ]
    },
    {
      id: 3,
      question: "When solving a problem, I usually:",
      options: [
        { text: "Draw it out or visualize it", value: "visual" },
        { text: "Talk through it with someone", value: "auditory" },
        { text: "Try different approaches hands-on", value: "kinesthetic" },
        { text: "Research and read about similar problems", value: "reading" }
      ]
    },
    {
      id: 4,
      question: "My ideal study environment is:",
      options: [
        { text: "A quiet library with visual materials", value: "visual" },
        { text: "A place where I can discuss with others", value: "auditory" },
        { text: "A space where I can move and experiment", value: "kinesthetic" },
        { text: "A comfortable chair with good lighting for reading", value: "reading" }
      ]
    },
    {
      id: 5,
      question: "When I need to remember something, I:",
      options: [
        { text: "Create mental pictures", value: "visual" },
        { text: "Repeat it out loud", value: "auditory" },
        { text: "Write it down or act it out", value: "kinesthetic" },
        { text: "Read it multiple times", value: "reading" }
      ]
    },
    {
      id: 6,
      question: "I prefer to study:",
      options: [
        { text: "In the morning when I'm fresh", value: "morning" },
        { text: "In the afternoon after lunch", value: "afternoon" },
        { text: "In the evening when it's quiet", value: "evening" },
        { text: "Late at night when everyone is asleep", value: "night" }
      ]
    },
    {
      id: 7,
      question: "My typical study session lasts:",
      options: [
        { text: "15-20 minutes", value: 15 },
        { text: "25-30 minutes", value: 25 },
        { text: "35-45 minutes", value: 40 },
        { text: "50+ minutes", value: 50 }
      ]
    },
    {
      id: 8,
      question: "I prefer learning content that is:",
      options: [
        { text: "Easy and builds confidence", value: "easy" },
        { text: "Moderate difficulty with some challenge", value: "medium" },
        { text: "Challenging and pushes my limits", value: "hard" },
        { text: "Mixed difficulty levels", value: "adaptive" }
      ]
    }
  ];

  const handleAnswer = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleNext = () => {
    if (currentQuestion < assessmentQuestions.length - 1) {
      setCurrentQuestion(prev => prev + 1);
    } else {
      handleComplete();
    }
  };

  const handlePrevious = () => {
    if (currentQuestion > 0) {
      setCurrentQuestion(prev => prev - 1);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      const results = analyzeResults();
      await saveResults(results);
      onComplete(results);
    } catch (error) {
      console.error('Error saving assessment results:', error);
    } finally {
      setLoading(false);
    }
  };

  const analyzeResults = () => {
    const learningStyleCounts = { visual: 0, auditory: 0, kinesthetic: 0, reading: 0 };
    let studyTimePreference = 'evening';
    let attentionSpan = 25;
    let preferredDifficulty = 'medium';

    // Analyze learning style
    Object.values(answers).forEach(answer => {
      if (learningStyleCounts.hasOwnProperty(answer)) {
        learningStyleCounts[answer]++;
      }
    });

    const learningStyle = Object.keys(learningStyleCounts).reduce((a, b) => 
      learningStyleCounts[a] > learningStyleCounts[b] ? a : b
    );

    // Analyze study preferences
    Object.values(answers).forEach(answer => {
      if (['morning', 'afternoon', 'evening', 'night'].includes(answer)) {
        studyTimePreference = answer;
      }
      if (typeof answer === 'number') {
        attentionSpan = answer;
      }
      if (['easy', 'medium', 'hard', 'adaptive'].includes(answer)) {
        preferredDifficulty = answer;
      }
    });

    return {
      learningStyle,
      studyTimePreference,
      attentionSpan,
      preferredDifficulty,
      assessmentDate: new Date().toISOString()
    };
  };

  const saveResults = async (results) => {
    if (!user) return;

    const response = await fetch('/api/learning-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        studentId: user.uid,
        updates: results
      })
    });

    if (!response.ok) {
      throw new Error('Failed to save assessment results');
    }
  };

  const currentQ = assessmentQuestions[currentQuestion];
  const progress = ((currentQuestion + 1) / assessmentQuestions.length) * 100;

  return (
    <div className={styles.overlay}>
      <div className={styles.assessmentModal}>
        <div className={styles.header}>
          <h2>Learning Style Assessment</h2>
          <button onClick={onClose} className={styles.closeButton} suppressHydrationWarning>×</button>
        </div>

        <div className={styles.progressBar}>
          <div 
            className={styles.progressFill} 
            style={{ width: `${progress}%` }}
          ></div>
        </div>

        <div className={styles.questionContainer}>
          <div className={styles.questionNumber}>
            Question {currentQuestion + 1} of {assessmentQuestions.length}
          </div>
          
          <h3 className={styles.question}>{currentQ.question}</h3>

          <div className={styles.options}>
            {currentQ.options.map((option, index) => (
              <button
                key={index}
                className={`${styles.option} ${
                  answers[currentQ.id] === option.value ? styles.selected : ''
                }`}
                onClick={() => handleAnswer(currentQ.id, option.value)}
                suppressHydrationWarning
              >
                {option.text}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.navigation}>
          <button
            className={styles.navButton}
            onClick={handlePrevious}
            disabled={currentQuestion === 0}
            suppressHydrationWarning
          >
            Previous
          </button>
          
          <button
            className={`${styles.navButton} ${styles.primary}`}
            onClick={handleNext}
            disabled={!answers[currentQ.id]}
            suppressHydrationWarning
          >
            {currentQuestion === assessmentQuestions.length - 1 ? 'Complete' : 'Next'}
          </button>
        </div>

        {loading && (
          <div className={styles.loading}>
            <div className={styles.spinner}></div>
            <p>Saving your results...</p>
          </div>
        )}
      </div>
    </div>
  );
} 