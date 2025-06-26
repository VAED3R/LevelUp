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
      
      // Fetch both student data and stats for comprehensive information
      const [studentResponse, statsResponse] = await Promise.all([
        fetch(`/api/student-data?studentId=${user.uid}`),
        fetch(`/api/student-stats?studentId=${user.uid}`)
      ]);
      
      const studentData = await studentResponse.json();
      const statsData = await statsResponse.json();
      
      if (studentData.data && statsData.success) {
        // Combine data for comprehensive stats
        const combinedStats = {
          ...statsData.stats,
          studentData: studentData.data,
          // Calculate overall average from multiple sources
          overallAverage: calculateOverallAverage(studentData.data, statsData.stats),
          // Get recent activity count
          recentAssessments: (studentData.data.analytics?.engagement?.recentActivity || []).length,
          // Enhanced quiz data
          quizData: studentData.data.quizzes || [],
          // Enhanced assignment data
          assignmentData: studentData.data.assignments || [],
          // Enhanced test data
          testData: studentData.data.testResults || []
        };
        
        setStats(combinedStats);
      } else {
        setError('Failed to fetch comprehensive statistics');
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
      setError('Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const calculateOverallAverage = (studentData, statsData) => {
    const analytics = studentData?.analytics?.academic;
    if (!analytics) return statsData?.averageScore || 0;

    const averages = [];
    
    // Add quiz average if available
    if (analytics.quizAverage > 0) {
      averages.push(analytics.quizAverage);
    }
    
    // Add test average if available
    if (studentData?.testAverage > 0) {
      averages.push(studentData.testAverage);
    }
    
    // Add assignment average if available
    if (studentData?.assignmentAverage > 0) {
      averages.push(studentData.assignmentAverage);
    }
    
    // If no averages available, try to calculate from subject performance
    if (averages.length === 0 && analytics.subjectPerformance) {
      const subjectAverages = Object.values(analytics.subjectPerformance)
        .map(subject => typeof subject === 'number' ? subject : (subject?.average || 0))
        .filter(avg => avg > 0);
      
      if (subjectAverages.length > 0) {
        return subjectAverages.reduce((sum, avg) => sum + avg, 0) / subjectAverages.length;
      }
    }
    
    // Return average of available scores
    return averages.length > 0 ? averages.reduce((sum, avg) => sum + avg, 0) / averages.length : (statsData?.averageScore || 0);
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
      <div className={styles.statsHeader}>
        <h2 className={styles.statsTitle}>Your Academic Statistics</h2>
        <button onClick={fetchStats} className={styles.refreshButton} title="Refresh statistics">
          🔄
        </button>
      </div>
      
      <div className={styles.statsGrid}>
        {/* Average Score Card */}
        <div className={styles.statCard}>
          <div className={styles.statHeader}>
            <span className={styles.statIcon}>📊</span>
            <h3>Average Score</h3>
          </div>
          <div className={styles.statValue} style={{ color: getScoreColor(stats?.overallAverage || 0) }}>
            {(stats?.overallAverage || 0).toFixed(1)}%
          </div>
          <div className={styles.statDetails}>
            <p>
              {stats?.recentAssessments > 0 ? (
                `Based on ${stats.recentAssessments} recent assessment${stats.recentAssessments !== 1 ? 's' : ''} in the last 30 days`
              ) : (
                'No recent assessments in the last 30 days'
              )}
            </p>
            {stats?.recentAssessments > 0 && (
              <div className={styles.assessmentBreakdown}>
                {stats?.scoreDetails?.recentScores?.filter(score => 
                  new Date(score.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                ).length > 0 && (
                  <span className={styles.assessmentType}>
                    📝 {stats.scoreDetails.recentScores.filter(score => 
                      new Date(score.date) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    ).length} quizzes
                  </span>
                )}
                {stats?.assignmentDetails?.recentAssignments?.filter(assignment => 
                  new Date(assignment.addedAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                ).length > 0 && (
                  <span className={styles.assessmentType}>
                    📋 {stats.assignmentDetails.recentAssignments.filter(assignment => 
                      new Date(assignment.addedAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    ).length} assignments
                  </span>
                )}
                {stats?.testDetails?.recentTests?.filter(test => 
                  new Date(test.addedAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                ).length > 0 && (
                  <span className={styles.assessmentType}>
                    📊 {stats.testDetails.recentTests.filter(test => 
                      new Date(test.addedAt) >= new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
                    ).length} tests
                  </span>
                )}
              </div>
            )}
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
                      backgroundColor: getScoreColor(stats?.overallAverage || 0)
                    }}
                  ></div>
                </div>
                <span>Progress: {Math.min((stats.totalQuizzes / 20) * 100, 100).toFixed(0)}%</span>
              </div>
            )}
            {stats?.quizAverage > 0 && (
              <div className={styles.quizAverage}>
                <span>Average: {stats.quizAverage.toFixed(1)}%</span>
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
            {stats?.assignmentAverage > 0 && (
              <div className={styles.assignmentMarks}>
                <span>Average: {stats.assignmentAverage.toFixed(1)}%</span>
                {stats?.assignmentDetails?.totalMarks > 0 && (
                  <span>Marks: {stats.assignmentDetails.obtainedMarks}/{stats.assignmentDetails.totalMarks}</span>
                )}
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
            {stats?.testAverage > 0 && (
              <div className={styles.testMarks}>
                <span>Average: {stats.testAverage.toFixed(1)}%</span>
                {stats?.testDetails?.totalMarks > 0 && (
                  <span>Marks: {stats.testDetails.obtainedMarks}/{stats.testDetails.totalMarks}</span>
                )}
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