"use client";

import { useState, useEffect } from 'react';
import { useAuth } from '@/context/AuthContext';
import styles from './StudentStats.module.css';

export default function StudentStats() {
  const { user } = useAuth();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (user) {
      fetchStats();
    }
  }, [user]);

  const fetchStats = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/student-stats?studentId=${user.uid}`);
      const data = await response.json();
      
      if (data.success) {
        setStats(data.stats);
      } else {
        setError(data.error || 'Failed to fetch statistics');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getImprovementIcon = (improvement) => {
    if (improvement > 0) return '📈';
    if (improvement < 0) return '📉';
    return '➡️';
  };

  if (loading) {
    return (
      <div className={styles.statsContainer}>
        <div className={styles.loadingSpinner}></div>
        <p>Loading your statistics...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.statsContainer}>
        <div className={styles.errorMessage}>
          <span>⚠️</span>
          <p>{error}</p>
          <button onClick={fetchStats} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.statsContainer}>
      <h2 className={styles.statsTitle}>Your Academic Statistics</h2>
      
      <div className={styles.statsGrid}>
        {/* Average Score Card */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📊</span>
            <h3>Average Score</h3>
          </div>
          <div className={styles.statValue} style={{ color: getScoreColor(stats?.averageScore || 0) }}>
            {stats?.averageScore || 0}%
          </div>
          <div className={styles.statDetails}>
            <p>Based on {stats?.scoreDetails?.recentScores?.length || 0} recent assessments</p>
            {stats?.scoreDetails?.improvement !== undefined && stats.scoreDetails.improvement !== 0 && (
              <div className={styles.improvement}>
                <span>{getImprovementIcon(stats.scoreDetails.improvement)}</span>
                <span style={{ color: stats.scoreDetails.improvement > 0 ? '#4CAF50' : '#F44336' }}>
                  {stats.scoreDetails.improvement > 0 ? '+' : ''}{stats.scoreDetails.improvement.toFixed(1)}% change
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Quiz Performance Card */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📝</span>
            <h3>Quiz Progress</h3>
          </div>
          <div className={styles.statValue}>
            {stats?.totalQuizzes || 0}
          </div>
          <div className={styles.statDetails}>
            <p>Quizzes completed</p>
            {stats?.totalQuizzes > 0 && (
              <div className={styles.quizProgress}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ 
                      width: `${Math.min((stats.totalQuizzes / 20) * 100, 100)}%`,
                      backgroundColor: getScoreColor(stats?.averageScore || 0)
                    }}
                  ></div>
                </div>
                <span>Progress: {Math.min((stats.totalQuizzes / 20) * 100, 100).toFixed(0)}%</span>
              </div>
            )}
          </div>
        </div>

        {/* Assignment Completion Card */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📋</span>
            <h3>Assignments</h3>
          </div>
          <div className={styles.statValue}>
            {stats?.completedAssignments || 0}/{stats?.totalAssignments || 0}
          </div>
          <div className={styles.statDetails}>
            <p>Completed assignments</p>
            {stats?.totalAssignments > 0 && (
              <div className={styles.assignmentProgress}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ 
                      width: `${(stats.completedAssignments / stats.totalAssignments) * 100}%`,
                      backgroundColor: '#4CAF50'
                    }}
                  ></div>
                </div>
                <span>Completion: {((stats.completedAssignments / stats.totalAssignments) * 100).toFixed(0)}%</span>
              </div>
            )}
            {stats?.assignmentDetails?.totalMarks > 0 && (
              <div className={styles.assignmentMarks}>
                <span>Average: {stats?.assignmentAverage?.toFixed(1) || 'N/A'}%</span>
                <span>Marks: {stats.assignmentDetails.obtainedMarks}/{stats.assignmentDetails.totalMarks}</span>
              </div>
            )}
          </div>
        </div>

        {/* Test Results Card */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📋</span>
            <h3>Test Results</h3>
          </div>
          <div className={styles.statValue}>
            {stats?.completedTests || 0}/{stats?.totalTests || 0}
          </div>
          <div className={styles.statDetails}>
            <p>Completed tests</p>
            {stats?.totalTests > 0 && (
              <div className={styles.testProgress}>
                <div className={styles.progressBar}>
                  <div 
                    className={styles.progressFill}
                    style={{ 
                      width: `${(stats.completedTests / stats.totalTests) * 100}%`,
                      backgroundColor: '#FF9800'
                    }}
                  ></div>
                </div>
                <span>Completion: {((stats.completedTests / stats.totalTests) * 100).toFixed(0)}%</span>
              </div>
            )}
            {stats?.testDetails?.totalMarks > 0 && (
              <div className={styles.testMarks}>
                <span>Average: {stats?.testAverage?.toFixed(1) || 'N/A'}%</span>
                <span>Marks: {stats.testDetails.obtainedMarks}/{stats.testDetails.totalMarks}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Assignment Performance */}
      {Object.keys(stats?.assignmentDetails?.subjects || {}).length > 0 && (
        <div className={styles.subjectSection}>
          <h3 className={styles.sectionTitle}>Assignment Performance by Subject</h3>
          <div className={styles.subjectGrid}>
            {Object.entries(stats.assignmentDetails.subjects).map(([subject, data]) => {
              const subjectAverage = data.total > 0 ? (data.obtained / data.total) * 100 : 0;
              return (
                <div key={subject} className={styles.subjectCard}>
                  <h4>{subject}</h4>
                  <div className={styles.subjectScore} style={{ color: getScoreColor(subjectAverage) }}>
                    {subjectAverage.toFixed(1)}%
                  </div>
                  <div className={styles.subjectDetails}>
                    <span>{data.count} assignments</span>
                    <span>{data.obtained}/{data.total} marks</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Test Performance by Subject */}
      {Object.keys(stats?.testDetails?.subjects || {}).length > 0 && (
        <div className={styles.subjectSection}>
          <h3 className={styles.sectionTitle}>Test Performance by Subject</h3>
          <div className={styles.subjectGrid}>
            {Object.entries(stats.testDetails.subjects).map(([subject, data]) => {
              const subjectAverage = data.total > 0 ? (data.obtained / data.total) * 100 : 0;
              return (
                <div key={subject} className={styles.subjectCard}>
                  <h4>{subject}</h4>
                  <div className={styles.subjectScore} style={{ color: getScoreColor(subjectAverage) }}>
                    {subjectAverage.toFixed(1)}%
                  </div>
                  <div className={styles.subjectDetails}>
                    <span>{data.count} tests</span>
                    <span>{data.obtained}/{data.total} marks</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Assignments */}
      {stats?.assignmentDetails?.recentAssignments?.length > 0 && (
        <div className={styles.recentSection}>
          <h3 className={styles.sectionTitle}>Recent Assignments</h3>
          <div className={styles.recentScores}>
            {stats.assignmentDetails.recentAssignments.map((assignment, index) => (
              <div key={index} className={styles.recentScore}>
                <span className={styles.scoreSubject}>{assignment.title}</span>
                <span 
                  className={styles.scoreValue}
                  style={{ color: getScoreColor(assignment.percentage) }}
                >
                  {assignment.percentage}%
                </span>
                <span className={styles.scoreDate}>
                  {new Date(assignment.addedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Test Results */}
      {stats?.testDetails?.recentTests?.length > 0 && (
        <div className={styles.recentSection}>
          <h3 className={styles.sectionTitle}>Recent Test Results</h3>
          <div className={styles.recentScores}>
            {stats.testDetails.recentTests.map((test, index) => (
              <div key={index} className={styles.recentScore}>
                <span className={styles.scoreSubject}>{test.subject} (Sem {test.semester})</span>
                <span 
                  className={styles.scoreValue}
                  style={{ color: getScoreColor(parseFloat(test.percentage)) }}
                >
                  {test.percentage}%
                </span>
                <span className={styles.scoreDate}>
                  {new Date(test.addedAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
} 