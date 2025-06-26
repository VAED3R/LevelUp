"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LearningProfile } from "@/lib/learningProfile";
import Navbar from "@/components/studentNavbar";
import StudentStats from "@/components/StudentStats";
import styles from "./page.module.css";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';

export default function PersonalizedLearning() {
  const { user } = useAuth();
  const [learningProfile, setLearningProfile] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    if (user) {
      loadPersonalizedData();
    }
  }, [user]);

  const loadPersonalizedData = async () => {
    if (!user) return;
    
    try {
      setLoading(true);
      console.log('Loading personalized data for student:', user.uid);
      
      // Load student data
      let studentData = null;
      try {
        const studentResponse = await fetch(`/api/student-data?studentId=${user.uid}`);
        const studentResult = await studentResponse.json();
        studentData = studentResult.data;
        console.log('Student data loaded:', studentData);
      } catch (error) {
        console.error('Error loading student data:', error);
        studentData = {
          assignments: [],
          challenges: [],
          courseMap: [],
          marks: [],
          oneVsOneRequests: [],
          quizzes: [],
          analytics: {
            academic: { averageScore: 0, totalAssignments: 0, completedAssignments: 0, totalQuizzes: 0, quizAverage: 0, subjectPerformance: {} },
            engagement: { totalChallenges: 0, activeChallenges: 0, oneVsOneRequests: 0, recentActivity: [] }
          }
        };
      }
      
      // Load student stats
      let statsData = null;
      try {
        const statsResponse = await fetch(`/api/student-stats?studentId=${user.uid}`);
        statsData = await statsResponse.json();
        console.log('Stats data loaded:', statsData);
      } catch (error) {
        console.error('Error loading stats:', error);
        statsData = {
          averageScore: 0,
          attendanceRate: 0,
          totalQuizzes: 0,
          totalAssignments: 0,
          completedAssignments: 0,
          assignmentAverage: 0
        };
      }
      
      // Load learning profile
      let profileData = null;
      try {
        const profileResponse = await fetch(`/api/learning-profile?studentId=${user.uid}`);
        const profileResult = await profileResponse.json();
        profileData = profileResult.profile;
        console.log('Profile data loaded:', profileData);
      } catch (error) {
        console.error('Error loading profile:', error);
        profileData = {
          learningStyle: 'visual',
          preferredDifficulty: 'medium',
          studyTimePreference: 'evening',
          attentionSpan: 25,
          subjects: {},
          learningGoals: [],
          strengths: [],
          weaknesses: [],
          interests: []
        };
      }
      
      // Load recommendations
      let recommendationsData = null;
      try {
        const recommendationsResponse = await fetch(`/api/recommendations?studentId=${user.uid}`);
        recommendationsData = await recommendationsResponse.json();
        console.log('Recommendations data loaded:', recommendationsData);
      } catch (error) {
        console.error('Error loading recommendations:', error);
        recommendationsData = {
          studySchedule: {
            recommendedTime: 'evening',
            sessionDuration: 25,
            breaks: 5
          },
          contentRecommendations: [],
          learningStrategies: [
            'Take regular breaks every 25 minutes',
            'Use visual aids when studying',
            'Practice active recall techniques',
            'Review material before bedtime'
          ],
          focusAreas: []
        };
      }
      
      setStudentData(studentData);
      setLearningProfile(profileData);
      setRecommendations(recommendationsData);
    } catch (error) {
      console.error('Error loading personalized data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getLearningStyleIcon = (style) => {
    switch (style) {
      case 'visual': return '👁️';
      case 'auditory': return '👂';
      case 'kinesthetic': return '🤲';
      case 'reading': return '📖';
      default: return '🎓';
    }
  };

  const getDifficultyColor = (difficulty) => {
    switch (difficulty) {
      case 'easy': return '#4CAF50';
      case 'medium': return '#FF9800';
      case 'hard': return '#F44336';
      default: return '#2196F3';
    }
  };

  const getPerformanceColor = (score) => {
    if (score >= 90) return '#4CAF50';
    if (score >= 80) return '#8BC34A';
    if (score >= 70) return '#FFC107';
    if (score >= 60) return '#FF9800';
    return '#F44336';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed': return '#4CAF50';
      case 'pending': return '#FF9800';
      case 'overdue': return '#F44336';
      case 'active': return '#2196F3';
      default: return '#9E9E9E';
    }
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <Navbar />
        <div className={styles.loadingCard}>
          <div className={styles.loadingSpinner}></div>
          <h3>Loading Your Learning Dashboard</h3>
          <p>Gathering your personalized data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.header}>
          <h1 className={styles.title}>Personalized Learning Dashboard</h1>
          <p className={styles.subtitle}>
            Your learning journey, tailored just for you
          </p>
        </div>

        {/* Student Statistics - Prominently Displayed */}
        <StudentStats />

        {/* Learning Profile Summary */}
        <div className={styles.profileSection}>
          <div className={styles.profileCard}>
            <div className={styles.profileHeader}>
              <div className={styles.learningStyle}>
                <span className={styles.styleIcon}>
                  {getLearningStyleIcon(learningProfile?.learningStyle)}
                </span>
                <div className={styles.styleInfo}>
                  <h3>Learning Style</h3>
                  <p>{learningProfile?.learningStyle?.charAt(0).toUpperCase() + 
                      learningProfile?.learningStyle?.slice(1)} Learner</p>
                </div>
              </div>
              <div className={styles.profileStats}>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>
                    {studentData?.analytics?.academic?.averageScore?.toFixed(1) || 'N/A'}
                  </span>
                  <span className={styles.statLabel}>Avg Score</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>
                    {studentData?.analytics?.academic?.completedAssignments || 0}
                  </span>
                  <span className={styles.statLabel}>Completed</span>
                </div>
                <div className={styles.stat}>
                  <span className={styles.statNumber}>
                    {studentData?.analytics?.academic?.totalAssignments || 0}
                  </span>
                  <span className={styles.statLabel}>Total</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className={styles.tabNavigation}>
          <button 
            className={`${styles.tabButton} ${activeTab === 'overview' ? styles.active : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            📊 Overview
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'progress' ? styles.active : ''}`}
            onClick={() => setActiveTab('progress')}
          >
            📈 Progress
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'assignments' ? styles.active : ''}`}
            onClick={() => setActiveTab('assignments')}
          >
            📝 Assignments
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'testResults' ? styles.active : ''}`}
            onClick={() => setActiveTab('testResults')}
          >
            📋 Test Results
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'recommendations' ? styles.active : ''}`}
            onClick={() => setActiveTab('recommendations')}
          >
            🎯 Recommendations
          </button>
          <button 
            className={`${styles.tabButton} ${activeTab === 'goals' ? styles.active : ''}`}
            onClick={() => setActiveTab('goals')}
          >
            🎯 Goals
          </button>
        </div>

        {/* Tab Content */}
        <div className={styles.tabContent}>
          {activeTab === 'overview' && (
            <div className={styles.overviewTab}>
              {/* Academic Performance */}
              <div className={styles.performanceSection}>
                <h2 className={styles.sectionTitle}>Academic Performance</h2>
                <div className={styles.performanceGrid}>
                  {Object.entries(studentData?.analytics?.academic?.subjectPerformance || {}).map(([subject, scoreData], index) => {
                    const score = typeof scoreData === 'number' ? scoreData : (scoreData?.average || 0);
                    return (
                      <div key={index} className={styles.performanceCard}>
                        <div className={styles.performanceHeader}>
                          <h3>{subject}</h3>
                          <span 
                            className={styles.performanceScore}
                            style={{ color: getPerformanceColor(score) }}
                          >
                            {score.toFixed(1)}%
                          </span>
                        </div>
                        <div className={styles.progressBar}>
                          <div 
                            className={styles.progressFill}
                            style={{ 
                              width: `${score}%`,
                              backgroundColor: getPerformanceColor(score)
                            }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Recent Activity */}
              <div className={styles.activitySection}>
                <h2 className={styles.sectionTitle}>Recent Activity</h2>
                <div className={styles.activityGrid}>
                  {studentData?.analytics?.engagement?.recentActivity?.slice(0, 6).map((activity, index) => (
                    <div key={index} className={styles.activityCard}>
                      <div className={styles.activityHeader}>
                        <span className={styles.activityType}>
                          {activity.type === 'assignment' && '📋'}
                          {activity.type === 'test' && '📋'}
                          {activity.type === 'challenge' && '🏆'}
                        </span>
                        <span className={styles.activityTitle}>
                          {activity.type.charAt(0).toUpperCase() + activity.type.slice(1)}
                        </span>
                        <span className={styles.activityDate}>
                          {new Date(activity.date).toLocaleDateString()}
                        </span>
                      </div>
                      {activity.score && (
                        <div className={styles.activityScore}>
                          Score: {activity.score}%
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignments Preview */}
              {studentData?.assignments?.length > 0 && (
                <div className={styles.assignmentsPreview}>
                  <h2 className={styles.sectionTitle}>Recent Assignments</h2>
                  <div className={styles.assignmentsGrid}>
                    {studentData.assignments.slice(0, 3).map((assignment, index) => {
                      const isCompleted = (assignment.obtainedMarks || 0) > 0;
                      return (
                        <div key={index} className={styles.assignmentCard}>
                          <div className={styles.assignmentHeader}>
                            <h3>{assignment.assignmentTitle}</h3>
                            <span 
                              className={styles.assignmentStatus}
                              style={{ 
                                backgroundColor: isCompleted 
                                  ? getPerformanceColor(assignment.percentage) 
                                  : '#9E9E9E'
                              }}
                            >
                              {isCompleted ? `${assignment.percentage}%` : 'Pending'}
                            </span>
                          </div>
                          <p className={styles.assignmentDescription}>
                            {assignment.assignmentDescription}
                          </p>
                          <div className={styles.assignmentMeta}>
                            <span className={styles.assignmentSubject}>
                              {assignment.subject}
                            </span>
                            <span className={styles.assignmentDue}>
                              Added: {new Date(assignment.addedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {isCompleted ? (
                            <div className={styles.assignmentScore}>
                              Score: {assignment.obtainedMarks}/{assignment.totalMarks} marks
                            </div>
                          ) : (
                            <div className={styles.assignmentPending}>
                              Not yet graded
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Test Results Preview */}
              {studentData?.testResults?.length > 0 && (
                <div className={styles.testResultsPreview}>
                  <h2 className={styles.sectionTitle}>Recent Test Results</h2>
                  <div className={styles.testResultsGrid}>
                    {studentData.testResults.slice(0, 3).map((test, index) => {
                      const isCompleted = (test.obtainedMarks || 0) > 0;
                      const percentage = isCompleted ? (test.percentage || ((test.obtainedMarks / test.totalMarks) * 100).toFixed(1)) : 0;
                      return (
                        <div key={index} className={styles.testResultCard}>
                          <div className={styles.testResultHeader}>
                            <h3>Test - {test.subject}</h3>
                            <span 
                              className={styles.testResultStatus}
                              style={{ 
                                backgroundColor: isCompleted 
                                  ? getPerformanceColor(percentage) 
                                  : '#9E9E9E'
                              }}
                            >
                              {isCompleted ? `${percentage}%` : 'Not Taken'}
                            </span>
                          </div>
                          <div className={styles.testResultMeta}>
                            <span className={styles.testResultSubject}>
                              {test.subject} - Semester {test.semester}
                            </span>
                            <span className={styles.testResultDate}>
                              Taken: {new Date(test.addedAt).toLocaleDateString()}
                            </span>
                          </div>
                          {isCompleted ? (
                            <div className={styles.testResultScore}>
                              Score: {test.obtainedMarks}/{test.totalMarks} marks
                            </div>
                          ) : (
                            <div className={styles.testResultPending}>
                              Test not yet taken
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'progress' && (
            <div className={styles.progressTab}>
              {/* Progress Charts */}
              <div className={styles.chartsSection}>
                <h2 className={styles.sectionTitle}>Learning Progress</h2>
                <div className={styles.chartsGrid}>
                  {/* Assignment Performance Over Time */}
                  <div className={styles.chartCard}>
                    <h3>Assignment Performance Trend</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={studentData?.assignments?.slice(0, 10).reverse().map(assignment => ({
                        date: new Date(assignment.addedAt).toLocaleDateString(),
                        score: assignment.percentage || 0,
                        title: assignment.assignmentTitle
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" />
                        <YAxis />
                        <Tooltip />
                        <Line type="monotone" dataKey="score" stroke="#8884d8" strokeWidth={2} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Subject Performance */}
                  <div className={styles.chartCard}>
                    <h3>Subject Performance</h3>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={Object.entries(studentData?.analytics?.academic?.subjectPerformance || {}).map(([subject, data]) => ({
                        subject,
                        score: typeof data === 'number' ? data : (data?.average || 0)
                      }))}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="subject" />
                        <YAxis />
                        <Tooltip />
                        <Bar dataKey="score" fill="#8884d8" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Assignments Tab */}
          {activeTab === 'assignments' && (
            <div className={styles.assignmentsTab}>
              <div className={styles.tabHeader}>
                <h2>Assignment Performance</h2>
                <div className={styles.assignmentStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total:</span>
                    <span className={styles.statValue}>{studentData?.assignments?.length || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Completed:</span>
                    <span className={styles.statValue}>
                      {studentData?.assignments?.filter(a => (a.obtainedMarks || 0) > 0).length || 0}
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Average:</span>
                    <span className={styles.statValue}>
                      {studentData?.assignmentAverage ? `${studentData.assignmentAverage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.assignmentsList}>
                {console.log('Rendering assignments list with data:', studentData?.assignments)}
                {studentData?.assignments?.map((assignment, index) => {
                  const isCompleted = (assignment.obtainedMarks || 0) > 0;
                  console.log('Rendering assignment:', assignment, 'isCompleted:', isCompleted);
                  return (
                    <div key={index} className={styles.assignmentItem}>
                      <div className={styles.assignmentInfo}>
                        <h3>{assignment.assignmentTitle}</h3>
                        <p>{assignment.assignmentDescription}</p>
                        <div className={styles.assignmentMeta}>
                          <span className={styles.subject}>{assignment.subject}</span>
                          <span className={styles.date}>
                            Added: {new Date(assignment.addedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className={styles.assignmentScore}>
                        {isCompleted ? (
                          <>
                            <div className={styles.scoreDisplay}>
                              <span className={styles.percentage}>
                                {assignment.percentage}%
                              </span>
                              <span className={styles.marks}>
                                {assignment.obtainedMarks}/{assignment.totalMarks} marks
                              </span>
                            </div>
                            <div 
                              className={styles.scoreBar}
                              style={{ backgroundColor: getPerformanceColor(assignment.percentage) }}
                            ></div>
                          </>
                        ) : (
                          <div className={styles.pendingStatus}>
                            <span className={styles.pendingText}>Pending</span>
                            <div className={styles.pendingBar}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Test Results Tab */}
          {activeTab === 'testResults' && (
            <div className={styles.testResultsTab}>
              <div className={styles.tabHeader}>
                <h2>Test Results Performance</h2>
                <div className={styles.testStats}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Total Tests:</span>
                    <span className={styles.statValue}>{studentData?.testResults?.length || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Completed:</span>
                    <span className={styles.statValue}>
                      {studentData?.testResults?.filter(t => (t.obtainedMarks || 0) > 0).length || 0}
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Average:</span>
                    <span className={styles.statValue}>
                      {studentData?.testAverage ? `${studentData.testAverage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.testResultsList}>
                {studentData?.testResults?.map((test, index) => {
                  const isCompleted = (test.obtainedMarks || 0) > 0;
                  const percentage = isCompleted ? (test.percentage || ((test.obtainedMarks / test.totalMarks) * 100).toFixed(1)) : 0;
                  return (
                    <div key={index} className={styles.testItem}>
                      <div className={styles.testInfo}>
                        <h3>Test - {test.subject}</h3>
                        <p>Semester: {test.semester}</p>
                        <div className={styles.testMeta}>
                          <span className={styles.subject}>{test.subject}</span>
                          <span className={styles.date}>
                            Taken: {new Date(test.addedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className={styles.testScore}>
                        {isCompleted ? (
                          <>
                            <div className={styles.scoreDisplay}>
                              <span className={styles.percentage}>
                                {percentage}%
                              </span>
                              <span className={styles.marks}>
                                {test.obtainedMarks}/{test.totalMarks} marks
                              </span>
                            </div>
                            <div 
                              className={styles.scoreBar}
                              style={{ backgroundColor: getPerformanceColor(percentage) }}
                            ></div>
                          </>
                        ) : (
                          <div className={styles.pendingStatus}>
                            <span className={styles.pendingText}>Not Taken</span>
                            <div className={styles.pendingBar}></div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!studentData?.testResults || studentData.testResults.length === 0) && (
                  <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📋</div>
                    <p className={styles.emptyText}>No test results available yet</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeTab === 'recommendations' && (
            <div className={styles.recommendationsTab}>
              {/* Content Recommendations */}
              <div className={styles.recommendationsSection}>
                <h2 className={styles.sectionTitle}>Recommended Content</h2>
                <div className={styles.recommendationsGrid}>
                  {recommendations?.contentRecommendations?.slice(0, 6).map((content, index) => (
                    <div key={index} className={styles.recommendationCard}>
                      <div className={styles.recommendationHeader}>
                        <h3>{content.title}</h3>
                        <span 
                          className={styles.relevanceScore}
                          style={{ backgroundColor: getDifficultyColor(content.difficulty) }}
                        >
                          {Math.round(content.relevanceScore * 100)}% Match
                        </span>
                      </div>
                      <p className={styles.recommendationDescription}>
                        {content.description}
                      </p>
                      <div className={styles.recommendationMeta}>
                        <span className={styles.difficulty}>
                          {content.difficulty}
                        </span>
                        <span className={styles.duration}>
                          {content.duration} min
                        </span>
                      </div>
                      <p className={styles.recommendationReason}>
                        {content.reason}
                      </p>
                      <button className={styles.startButton}>
                        Start Learning
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Learning Strategies */}
              <div className={styles.strategiesSection}>
                <h2 className={styles.sectionTitle}>Learning Strategies for You</h2>
                <div className={styles.strategiesGrid}>
                  {recommendations?.learningStrategies?.map((strategy, index) => (
                    <div key={index} className={styles.strategyCard}>
                      <span className={styles.strategyIcon}>💡</span>
                      <p>{strategy}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'goals' && (
            <div className={styles.goalsTab}>
              {/* Learning Goals */}
              <div className={styles.goalsSection}>
                <h2 className={styles.sectionTitle}>Your Learning Goals</h2>
                <div className={styles.goalsGrid}>
                  {learningProfile?.learningGoals?.map((goal, index) => (
                    <div key={index} className={styles.goalCard}>
                      <div className={styles.goalHeader}>
                        <h3>{goal.title}</h3>
                        <span className={styles.goalProgress}>
                          {goal.progress}%
                        </span>
                      </div>
                      <p>{goal.description}</p>
                      <div className={styles.goalProgressBar}>
                        <div 
                          className={styles.goalProgressFill}
                          style={{ width: `${goal.progress}%` }}
                        ></div>
                      </div>
                      <div className={styles.goalDeadline}>
                        Due: {new Date(goal.deadline).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Add New Goal Button */}
                <button className={styles.addGoalButton}>
                  + Add New Learning Goal
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 