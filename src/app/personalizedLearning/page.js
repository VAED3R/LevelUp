"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { LearningProfile } from "@/lib/learningProfile";
import Navbar from "@/components/studentNavbar";
import StudentStats from "@/components/StudentStats";
import GoalForm from "@/components/GoalForm";
import LoadingScreen from "@/components/LoadingScreen";
import IntroAnimation from "@/components/IntroAnimation";
import styles from "./page.module.css";
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { getEnhancedDeepSeekRecommendations, getRecommendedContent } from "@/lib/deepseek";
import AttentionSpanSettings from "@/components/AttentionSpanSettings";
import LearningAssessment from "@/components/LearningAssessment";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

export default function PersonalizedLearning() {
  const { user } = useAuth();
  const [learningProfile, setLearningProfile] = useState(null);
  const [recommendations, setRecommendations] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingGoal, setEditingGoal] = useState(null);
  const [aiRecs, setAiRecs] = useState(null);
  const [contentRecs, setContentRecs] = useState(null);
  const [showAttentionSpanSettings, setShowAttentionSpanSettings] = useState(false);
  const [error, setError] = useState(null);
  const [subjects, setSubjects] = useState([]);
  const [regeneratingAi, setRegeneratingAi] = useState(false);
  const [regeneratingContent, setRegeneratingContent] = useState(false);
  const [showSettingsPopup, setShowSettingsPopup] = useState(false);
  const [settingsPage, setSettingsPage] = useState(0);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  useEffect(() => {
    if (user && learningProfile && studentData) {
      generateRecommendations();
    }
  }, [user, learningProfile, studentData]);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch user data from users collection
      const userRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userRef);
      
      if (userDoc.exists()) {
        setUserData(userDoc.data());
      } else {
        console.error('No user data found in Firestore.');
      }
      
      // Fetch learning profile from learningProfiles collection
      const profileResponse = await fetch(`/api/learning-profile?studentId=${user.uid}`);
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        console.log('Fetched learning profile from database:', profileData.profile);
        setLearningProfile(profileData.profile);
      } else {
        console.error('Failed to fetch learning profile:', profileResponse.status);
      }

      // Fetch student data
      const studentResponse = await fetch(`/api/student-data?studentId=${user.uid}`);
      if (studentResponse.ok) {
        const studentData = await studentResponse.json();
        console.log('Fetched student data:', studentData);
        setStudentData(studentData);
      } else {
        console.error('Failed to fetch student data:', studentResponse.status);
      }

      // Fetch subjects
      const subjectsResponse = await fetch('/api/getSubjects');
      if (subjectsResponse.ok) {
        const subjectsData = await subjectsResponse.json();
        setSubjects(subjectsData.subjects || []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const generateRecommendations = async () => {
    try {
      // Ensure we have the complete learning profile data
      if (!learningProfile) {
        console.warn('Learning profile not available for AI recommendations');
        return;
      }

      console.log('Generating AI recommendations with learning profile:', {
        learningStyle: learningProfile.learningStyle,
        studyPreference: learningProfile.studyPreference,
        attentionSpan: learningProfile.attentionSpan,
        preferredDifficulty: learningProfile.preferredDifficulty,
        studyTimePreference: learningProfile.studyTimePreference,
        interests: learningProfile.interests,
        strengths: learningProfile.strengths,
        weaknesses: learningProfile.weaknesses,
        learningGoals: learningProfile.learningGoals,
        subjects: learningProfile.subjects
      });

      const personalizedRecs = await getEnhancedDeepSeekRecommendations(
        learningProfile, // Complete learning profile from learningProfiles collection
        studentData?.data?.analytics?.academic,
        learningProfile?.learningGoals || [],
        studentData?.data?.analytics?.engagement?.recentActivity || []
      );
      setAiRecs(personalizedRecs);

      const contentRecs = await getRecommendedContent(
        learningProfile, // Complete learning profile from learningProfiles collection
        studentData?.data?.analytics?.academic,
        Object.keys(studentData?.data?.analytics?.academic?.subjectPerformance || {})
      );
      setContentRecs(contentRecs);
    } catch (error) {
      console.error('Error generating recommendations:', error);
    }
  };

  const handleProfileUpdate = async (updatedProfile) => {
    setLearningProfile(updatedProfile);
    await generateRecommendations();
  };

  const getLearningStyleIcon = (style) => {
    switch (style) {
      case 'visual':
        return '👁️';
      case 'auditory':
        return '👂';
      case 'kinesthetic':
        return '🏃';
      case 'reading':
        return '📖';
      default:
        return '🎓';
    }
  };

  const getLearningStyleDescription = (style) => {
    switch (style) {
      case 'visual':
        return 'Visual learner who excels through images, diagrams, and visual aids. You process information best when it\'s presented in a visual format.';
      case 'auditory':
        return 'Auditory learner who prefers listening and verbal communication. You learn effectively through discussions, lectures, and spoken explanations.';
      case 'kinesthetic':
        return 'Kinesthetic learner who thrives through hands-on activities and movement. You learn best by doing and experiencing things physically.';
      case 'reading':
        return 'Reading/writing learner who prefers text-based learning. You excel when information is presented through written materials and note-taking.';
      default:
        return 'A dedicated learner with unique strengths and abilities. Your learning journey is personalized to match your style and preferences.';
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

  const calculateOverallAverage = () => {
    const analytics = studentData?.data?.analytics?.academic;
    if (!analytics) return 0;

    const averages = [];
    
    // Add quiz average if available
    if (analytics.quizAverage > 0) {
      averages.push(analytics.quizAverage);
    }
    
    // Add test average if available
    if (studentData?.data?.testAverage > 0) {
      averages.push(studentData.data.testAverage);
    }
    
    // Add assignment average if available
    if (studentData?.data?.assignmentAverage > 0) {
      averages.push(studentData.data.assignmentAverage);
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
    return averages.length > 0 ? averages.reduce((sum, avg) => sum + avg, 0) / averages.length : 0;
  };

  const getAcademicStrategies = () => {
    const overallAvg = calculateOverallAverage();
    const quizAvg = studentData?.data?.analytics?.academic?.quizAverage || 0;
    const testAvg = studentData?.data?.testAverage || 0;
    const assignmentAvg = studentData?.data?.assignmentAverage || 0;
    
    const strategies = [];
    
    if (overallAvg < 70) {
      strategies.push("Focus on foundational concepts and review basic materials");
      strategies.push("Increase study time and practice with sample questions");
      strategies.push("Seek help from teachers or tutors for difficult topics");
    } else if (overallAvg < 85) {
      strategies.push("Strengthen weak areas identified in recent assessments");
      strategies.push("Practice advanced problem-solving techniques");
      strategies.push("Review and consolidate knowledge regularly");
    } else {
      strategies.push("Challenge yourself with advanced materials and concepts");
      strategies.push("Help peers and teach others to reinforce learning");
      strategies.push("Explore additional resources and research opportunities");
    }
    
    // Subject-specific strategies
    if (quizAvg < 70 && quizAvg > 0) {
      strategies.push("Improve quiz performance through regular practice and review");
    }
    if (testAvg < 70 && testAvg > 0) {
      strategies.push("Enhance test-taking strategies and time management");
    }
    if (assignmentAvg < 70 && assignmentAvg > 0) {
      strategies.push("Focus on assignment quality and thoroughness");
    }
    
    return strategies;
  };

  const handleAddGoal = () => {
    setEditingGoal(null);
    setShowGoalForm(true);
  };

  const handleEditGoal = (goal) => {
    setEditingGoal(goal);
    setShowGoalForm(true);
  };

  const handleGoalAdded = (updatedProfile) => {
    setLearningProfile(updatedProfile);
    setShowGoalForm(false);
    setEditingGoal(null);
  };

  const handleCancelGoalForm = () => {
    setShowGoalForm(false);
    setEditingGoal(null);
  };

  const handleUpdateGoalProgress = async (goalId, newProgress) => {
    try {
      const response = await fetch('/api/learning-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: user.uid,
          action: 'updateGoalProgress',
          data: { goalId, progress: newProgress }
        }),
      });

      const result = await response.json();
      if (result.profile) {
        setLearningProfile(result.profile);
      }
    } catch (error) {
      console.error('Error updating goal progress:', error);
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Are you sure you want to delete this goal?')) {
      return;
    }

    try {
      const response = await fetch('/api/learning-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          studentId: user.uid,
          action: 'deleteGoal',
          data: { goalId }
        }),
      });

      const result = await response.json();
      if (result.profile) {
        setLearningProfile(result.profile);
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
    }
  };

  const handleAttentionSpanUpdate = (updatedProfile) => {
    setLearningProfile(updatedProfile);
    setShowAttentionSpanSettings(false);
  };

  const handleRegenerateAiRecommendations = async () => {
    try {
      setRegeneratingAi(true);
      const personalizedRecs = await getEnhancedDeepSeekRecommendations(
        learningProfile,
        studentData?.data?.analytics?.academic,
        learningProfile?.learningGoals || [],
        studentData?.data?.analytics?.engagement?.recentActivity || []
      );
      setAiRecs(personalizedRecs);
    } catch (error) {
      console.error('Error regenerating AI recommendations:', error);
    } finally {
      setRegeneratingAi(false);
    }
  };

  const handleRegenerateContentRecommendations = async () => {
    try {
      setRegeneratingContent(true);
      const contentRecs = await getRecommendedContent(
        learningProfile,
        studentData?.data?.analytics?.academic,
        Object.keys(studentData?.data?.analytics?.academic?.subjectPerformance || {})
      );
      setContentRecs(contentRecs);
    } catch (error) {
      console.error('Error regenerating content recommendations:', error);
    } finally {
      setRegeneratingContent(false);
    }
  };

  if (error) {
    return (
      <div className={styles.errorContainer}>
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={fetchData} className={styles.retryButton}>
          Try Again
        </button>
      </div>
    );
  }

  return (
    <IntroAnimation loadingText="Loading Your Learning Dashboard...">
      <div className={styles.container}>
      <Navbar />
      <div className={styles.content}>
        <div className={styles.header}>
          <div className={styles.titleContainer}>
            <h1 className={styles.title}>Personalized Learning Dashboard</h1>
          </div>
          <button 
            className={styles.settingsButton}
            onClick={() => setShowSettingsPopup(true)}
            title="Learning Preferences"
          >
            ⚙️
          </button>
          <p className={styles.subtitle}>
            Your learning journey, tailored just for you
          </p>
        </div>

        {/* Learning Profile Summary - Character Card Style */}
        <div className={styles.profileSection}>
          <div className={styles.profileCard}>
            {/* Left Panel - Character Info */}
            <div className={styles.leftPanel}>
              <div className={styles.characterCard}>
                <div className={styles.characterInfo}>
                  <div className={styles.profilePicture}>
                    <span className={styles.profileIcon}>👤</span>
                  </div>
                  <div className={styles.studentNameContainer}>
                    <h2 className={styles.studentName}>{userData?.name || 'STUDENT'}</h2>
                  </div>
                  <p className={styles.learningStyleText}>
                    {learningProfile?.learningStyle || 'Learning Style'} Learner
                  </p>
                  <div className={styles.learningDescription}>
                    {getLearningStyleDescription(learningProfile?.learningStyle)}
                  </div>
                </div>
              </div>
            </div>

            {/* Main Panel - Stats and Details */}
            <div className={styles.mainPanel}>
              {/* Performance Stats */}
              <div className={styles.performanceStats}>
                <div className={styles.performanceStat}>
                  <h4>{calculateOverallAverage() ? `${calculateOverallAverage().toFixed(1)}%` : 'N/A'}</h4>
                  <p>Overall Average</p>
                </div>
                <div className={styles.performanceStat}>
                  <h4>{studentData?.data?.testResults?.length || 0}</h4>
                  <p>Tests Taken</p>
                </div>
                <div className={styles.performanceStat}>
                  <h4>{studentData?.data?.assignments?.length || 0}</h4>
                  <p>Assignments</p>
                </div>
                <div className={styles.performanceStat}>
                  <h4>{studentData?.data?.analytics?.academic?.totalQuizzes || 0}</h4>
                  <p>Quizzes Taken</p>
                </div>
              </div>

              {/* Character Stats */}
              <div className={styles.characterStats}>
                <h3>Preferences</h3>
                {learningProfile ? (
                  <ul className={styles.statsList}>
                    <li className={styles.statItem}>
                      <div className={styles.statContent}>
                        <div className={styles.statName}>Attention Span</div>
                        <div className={styles.statValue}>{learningProfile.attentionSpan || 'N/A'}</div>
                        <div className={styles.statDetails}>Minutes of focused study</div>
                      </div>
                    </li>
                    
                    <li className={styles.statItem}>
                      <div className={styles.statContent}>
                        <div className={styles.statName}>Study Preference</div>
                        <div className={styles.statValue}>{learningProfile.studyPreference || 'N/A'}</div>
                        <div className={styles.statDetails}>Preferred study method</div>
                      </div>
                    </li>
                    
                    <li className={styles.statItem}>
                      <div className={styles.statContent}>
                        <div className={styles.statName}>Preferred Time</div>
                        <div className={styles.statValue}>
                          {learningProfile.studyTimePreference ? 
                            learningProfile.studyTimePreference.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()) : 
                            'N/A'
                          }
                        </div>
                        <div className={styles.statDetails}>Optimal study period</div>
                      </div>
                    </li>
                    
                    <li className={styles.statItem}>
                      <div className={styles.statContent}>
                        <div className={styles.statName}>Difficulty</div>
                        <div className={styles.statValue}>
                          {learningProfile.preferredDifficulty ? 
                            learningProfile.preferredDifficulty.replace(/\b\w/g, l => l.toUpperCase()) : 
                            'N/A'
                          }
                        </div>
                        <div className={styles.statDetails}>Preferred challenge level</div>
                      </div>
                    </li>
                    

                  </ul>
                ) : (
                  <div className={styles.noDataMessage}>
                    <p>No learning profile data available. Complete your assessment to see your character stats!</p>
                  </div>
                )}
              </div>

              {/* Decorative Elements */}
              <div className={styles.glowCircle}></div>
              <div className={styles.characterImage}></div>
            </div>
          </div>
        </div>

        {/* Student Statistics - Now displayed after the learning profile */}
        <StudentStats />

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
                  {Object.entries(studentData?.data?.analytics?.academic?.subjectPerformance || {}).map(([subject, scoreData], index) => {
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
                  {studentData?.data?.analytics?.engagement?.recentActivity?.slice(0, 6).map((activity, index) => (
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
                      </div>
                      <span className={styles.activityDate}>
                        {new Date(activity.date).toLocaleDateString()}
                      </span>
                      <span className={styles.activityScore}>
                        {activity.score?.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Academic Strategies */}
              <div className={styles.strategiesSection}>
                <h2 className={styles.sectionTitle}>Academic Strategies</h2>
                <div className={styles.strategiesGrid}>
                  {getAcademicStrategies().map((strategy, index) => (
                    <div key={index} className={styles.strategyCard}>
                      <span className={styles.strategyIcon}>💡</span>
                      <p>{strategy}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Assignments Preview */}
              {studentData?.data?.assignments?.length > 0 && (
                <div className={styles.assignmentsPreview}>
                  <h2 className={styles.sectionTitle}>Recent Assignments</h2>
                  <div className={styles.assignmentsGrid}>
                    {studentData.data.assignments.slice(0, 3).map((assignment, index) => {
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
                              {test.subject} - Semester {typeof test.semester === 'string' ? test.semester : String(test.semester || 'N/A')}
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
                      <LineChart data={studentData?.data?.assignments?.slice(0, 10).reverse().map(assignment => ({
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
                      <BarChart data={Object.entries(studentData?.data?.analytics?.academic?.subjectPerformance || {}).map(([subject, data]) => ({
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
                    <span className={styles.statValue}>{studentData?.data?.assignments?.length || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Completed:</span>
                    <span className={styles.statValue}>
                      {studentData?.data?.assignments?.filter(a => (a.obtainedMarks || 0) > 0).length || 0}
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Average:</span>
                    <span className={styles.statValue}>
                      {studentData?.data?.assignmentAverage ? `${studentData.data.assignmentAverage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.assignmentsList}>
                {studentData?.data?.assignments?.map((assignment, index) => {
                  const isCompleted = (assignment.obtainedMarks || 0) > 0;
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
                    <span className={styles.statValue}>{studentData?.data?.testResults?.length || 0}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Completed:</span>
                    <span className={styles.statValue}>
                      {studentData?.data?.testResults?.filter(t => (t.obtainedMarks || 0) > 0).length || 0}
                    </span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Average:</span>
                    <span className={styles.statValue}>
                      {studentData?.data?.testAverage ? `${studentData.data.testAverage.toFixed(1)}%` : 'N/A'}
                    </span>
                  </div>
                </div>
              </div>

              <div className={styles.testResultsList}>
                {studentData?.data?.testResults?.map((test, index) => {
                  const isCompleted = (test.obtainedMarks || 0) > 0;
                  const percentage = isCompleted ? (test.percentage || ((test.obtainedMarks / test.totalMarks) * 100).toFixed(1)) : 0;
                  return (
                    <div key={index} className={styles.testItem}>
                      <div className={styles.testInfo}>
                        <h3>Test - {test.subject}</h3>
                        <p>Semester: {typeof test.semester === 'string' ? test.semester : String(test.semester || 'N/A')}</p>
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
                {(!studentData?.data?.testResults || studentData.data.testResults.length === 0) && (
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

              {/* Enhanced AI-Powered Recommendations Section */}
              <div className={styles.recommendationsSection}>
                <div className={styles.recommendationHeader}>
                  <h3>AI-Powered Recommendations</h3>
                  <button 
                    className={styles.regenerateButton}
                    onClick={handleRegenerateAiRecommendations}
                    disabled={regeneratingAi}
                  >
                    {regeneratingAi ? '🔄 Regenerating...' : '🔄 Regenerate'}
                  </button>
                </div>
                <div className={styles.recommendationCard}>
                  {!aiRecs && <span>Loading AI recommendations...</span>}
                  {aiRecs?.error && <div>{typeof aiRecs.error === 'string' ? aiRecs.error : JSON.stringify(aiRecs.error)}<pre>{typeof aiRecs.raw === 'string' ? aiRecs.raw : JSON.stringify(aiRecs.raw)}</pre></div>}
                  {aiRecs && !aiRecs.error && (
                    <>
                      <h4>Study Tips</h4>
                      <ul>{aiRecs.studyTips?.map((tip, i) => <li key={i}>{typeof tip === 'string' ? tip : JSON.stringify(tip)}</li>)}</ul>
                      <h4>Feedback</h4>
                      <p>{typeof aiRecs.feedback === 'string' ? aiRecs.feedback : JSON.stringify(aiRecs.feedback)}</p>
                      <h4>Learning Strategies</h4>
                      <ul>{aiRecs.learningStrategies?.map((s, i) => <li key={i}>{typeof s === 'string' ? s : JSON.stringify(s)}</li>)}</ul>
                      <h4>Motivation</h4>
                      <blockquote>{typeof aiRecs.motivation === 'string' ? aiRecs.motivation : JSON.stringify(aiRecs.motivation)}</blockquote>
                      {aiRecs.studySchedule && (
                        <>
                          <h4>Recommended Study Schedule</h4>
                          <p>{typeof aiRecs.studySchedule === 'string' ? aiRecs.studySchedule : JSON.stringify(aiRecs.studySchedule)}</p>
                        </>
                      )}
                      {aiRecs.resourceRecommendations && (
                        <>
                          <h4>Recommended Resources</h4>
                          <ul>{aiRecs.resourceRecommendations?.map((resource, i) => <li key={i}>{typeof resource === 'string' ? resource : JSON.stringify(resource)}</li>)}</ul>
                        </>
                      )}
                      {aiRecs.goalSuggestions && typeof aiRecs.goalSuggestions === 'object' && (
                        <>
                          <h4>Goal Suggestions</h4>
                          <ul>
                            {Object.entries(aiRecs.goalSuggestions).map(([goal, suggestion], i) => {
                              // Ensure both goal and suggestion are strings
                              const goalText = typeof goal === 'string' ? goal : String(goal);
                              const suggestionText = typeof suggestion === 'string' ? suggestion : String(suggestion);
                              
                              return (
                                <li key={i}>
                                  <b>{goalText}:</b> {suggestionText}
                                </li>
                              );
                            })}
                          </ul>
                        </>
                      )}
                    </>
                  )}
                </div>
              </div>

              {/* AI-Powered Content Recommendations */}
              <div className={styles.recommendationsSection}>
                <div className={styles.recommendationHeader}>
                  <h3>AI-Powered Content Recommendations</h3>
                  <button 
                    className={styles.regenerateButton}
                    onClick={handleRegenerateContentRecommendations}
                    disabled={regeneratingContent}
                  >
                    {regeneratingContent ? '🔄 Regenerating...' : '🔄 Regenerate'}
                  </button>
                </div>
                <div className={styles.recommendationCard}>
                  {!contentRecs && <span>Loading content recommendations...</span>}
                  {contentRecs?.error && <div>{typeof contentRecs.error === 'string' ? contentRecs.error : JSON.stringify(contentRecs.error)}</div>}
                  {contentRecs && !contentRecs.error && (
                    <>
                      <h4>Topics to Focus On</h4>
                      <ul>{contentRecs.topicsToFocus?.map((topic, i) => <li key={i}>{typeof topic === 'string' ? topic : JSON.stringify(topic)}</li>)}</ul>
                      <h4>Recommended Resources</h4>
                      <ul>{contentRecs.resourceTypes?.map((resource, i) => <li key={i}>{typeof resource === 'string' ? resource : JSON.stringify(resource)}</li>)}</ul>
                      <h4>Study Plan</h4>
                      <p><strong>Difficulty Level:</strong> {typeof contentRecs.difficultyLevel === 'string' ? contentRecs.difficultyLevel : JSON.stringify(contentRecs.difficultyLevel)}</p>
                      <p><strong>Time Allocation:</strong> {typeof contentRecs.timeAllocation === 'string' ? contentRecs.timeAllocation : String(contentRecs.timeAllocation || 0)} minutes per session</p>
                      {contentRecs.studySessionFormat && (
                        <p><strong>Session Format:</strong> {typeof contentRecs.studySessionFormat === 'string' ? contentRecs.studySessionFormat : JSON.stringify(contentRecs.studySessionFormat)}</p>
                      )}
                      <h4>Next Steps</h4>
                      <ul>{contentRecs.nextSteps?.map((step, i) => <li key={i}>{typeof step === 'string' ? step : JSON.stringify(step)}</li>)}</ul>
                    </>
                  )}
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
                  {learningProfile?.learningGoals?.map((goal, index) => {
                    const isOverdue = new Date(goal.deadline) < new Date() && goal.progress < 100;
                    const daysLeft = Math.ceil((new Date(goal.deadline) - new Date()) / (1000 * 60 * 60 * 24));
                    
                    return (
                      <div key={goal.id || index} className={styles.goalCard}>
                        <div className={styles.goalHeader}>
                          <div className={styles.goalTitleSection}>
                            <h3>{goal.title}</h3>
                            <div className={styles.goalMeta}>
                              <span className={styles.goalCategory}>
                                {goal.category === 'academic' && '📚'}
                                {goal.category === 'skill' && '🎯'}
                                {goal.category === 'personal' && '🌟'}
                                {goal.category === 'career' && '💼'}
                                {goal.category || '📚'}
                              </span>
                              <span 
                                className={styles.goalPriority}
                                style={{ 
                                  backgroundColor: goal.priority === 'high' ? '#f44336' : 
                                                goal.priority === 'medium' ? '#ff9800' : '#4caf50' 
                                }}
                              >
                                {goal.priority || 'medium'}
                              </span>
                            </div>
                          </div>
                          <div className={styles.goalActions}>
                            <button 
                              className={styles.editGoalButton}
                              onClick={() => handleEditGoal(goal)}
                              title="Edit Goal"
                            >
                              ✏️
                            </button>
                            <button 
                              className={styles.deleteGoalButton}
                              onClick={() => handleDeleteGoal(goal.id)}
                              title="Delete Goal"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                        <p className={styles.goalDescription}>{goal.description}</p>
                        <div className={styles.goalProgressSection}>
                          <div className={styles.goalProgressHeader}>
                            <span className={styles.goalProgress}>
                              {goal.progress || 0}%
                            </span>
                            <span className={styles.goalDeadline}>
                              {isOverdue ? 'Overdue' : daysLeft > 0 ? `${daysLeft} days left` : 'Due today'}
                            </span>
                          </div>
                          <div className={styles.goalProgressBar}>
                            <div 
                              className={styles.goalProgressFill}
                              style={{ 
                                width: `${goal.progress || 0}%`,
                                backgroundColor: isOverdue ? '#f44336' : 
                                               (goal.progress || 0) >= 100 ? '#4caf50' : '#ff9800'
                              }}
                            ></div>
                          </div>
                          <div className={styles.goalProgressControls}>
                            <button 
                              className={styles.progressButton}
                              onClick={() => handleUpdateGoalProgress(goal.id, Math.max(0, (goal.progress || 0) - 10))}
                              disabled={(goal.progress || 0) <= 0}
                            >
                              -10%
                            </button>
                            <button 
                              className={styles.progressButton}
                              onClick={() => handleUpdateGoalProgress(goal.id, Math.min(100, (goal.progress || 0) + 10))}
                              disabled={(goal.progress || 0) >= 100}
                            >
                              +10%
                            </button>
                          </div>
                        </div>
                        <div className={styles.goalDeadline}>
                          Due: {new Date(goal.deadline).toLocaleDateString()}
                        </div>
                      </div>
                    );
                  })}
                  {(!learningProfile?.learningGoals || learningProfile.learningGoals.length === 0) && (
                    <div className={styles.emptyGoalsState}>
                      <div className={styles.emptyIcon}>🎯</div>
                      <h3>No Learning Goals Yet</h3>
                      <p>Start by adding your first learning goal to track your progress!</p>
                    </div>
                  )}
                </div>
                
                {/* Add New Goal Button */}
                <button className={styles.addGoalButton} onClick={handleAddGoal}>
                  + Add New Learning Goal
                </button>
              </div>
            </div>
          )}


        </div>
      </div>
      {showGoalForm && (
        <GoalForm
          editingGoal={editingGoal}
          onGoalAdded={handleGoalAdded}
          onCancel={handleCancelGoalForm}
        />
      )}

      {/* Settings Popup */}
      {showSettingsPopup && (
        <div className={styles.settingsPopup}>
          <div className={styles.settingsPopupContent}>
            <div className={styles.settingsPopupHeader}>
              <h2>Learning Preferences</h2>
              <button 
                className={styles.closeButton}
                onClick={() => {
                  setShowSettingsPopup(false);
                  setSettingsPage(0);
                }}
              >
                ✕
              </button>
            </div>

            <div className={styles.settingsPopupBody}>
              {/* Page 1: Attention Span */}
              {settingsPage === 0 && (
                <div className={styles.settingsPage}>
                  <h3>Attention Span</h3>
                  <p>How long can you maintain focus during study sessions?</p>
                  <div className={styles.attentionSpanSection}>
                    <div className={styles.sliderContainer}>
                      <div className={styles.sliderHeader}>
                        <span className={styles.currentValue}>{learningProfile?.attentionSpan || 25} minutes</span>
                        <span className={styles.description}>
                          {learningProfile?.attentionSpan <= 15 ? 'Short (15 min or less) - Great for quick review sessions' :
                           learningProfile?.attentionSpan <= 30 ? 'Medium (16-30 min) - Balanced study sessions' :
                           learningProfile?.attentionSpan <= 45 ? 'Long (31-45 min) - Extended focus periods' :
                           'Extended (45+ min) - Deep work sessions'}
                        </span>
                      </div>
                      <div className={styles.sliderWrapper}>
                        <input
                          type="range"
                          min="10"
                          max="90"
                          step="5"
                          value={learningProfile?.attentionSpan || 25}
                          onChange={(e) => {
                            const newProfile = { ...learningProfile, attentionSpan: parseInt(e.target.value) };
                            setLearningProfile(newProfile);
                          }}
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
                        className={`${styles.presetButton} ${(learningProfile?.attentionSpan || 25) === 15 ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, attentionSpan: 15 };
                          setLearningProfile(newProfile);
                        }}
                      >
                        15 min
                      </button>
                      <button 
                        className={`${styles.presetButton} ${(learningProfile?.attentionSpan || 25) === 25 ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, attentionSpan: 25 };
                          setLearningProfile(newProfile);
                        }}
                      >
                        25 min
                      </button>
                      <button 
                        className={`${styles.presetButton} ${(learningProfile?.attentionSpan || 25) === 45 ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, attentionSpan: 45 };
                          setLearningProfile(newProfile);
                        }}
                      >
                        45 min
                      </button>
                      <button 
                        className={`${styles.presetButton} ${(learningProfile?.attentionSpan || 25) === 60 ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, attentionSpan: 60 };
                          setLearningProfile(newProfile);
                        }}
                      >
                        60 min
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Page 2: Study Preference */}
              {settingsPage === 1 && (
                <div className={styles.settingsPage}>
                  <h3>Study Preference</h3>
                  <p>How do you prefer to study and absorb information?</p>
                  <div className={styles.optionsGrid}>
                    {[
                      { value: 'visual', label: 'Visual', icon: '🎨', description: 'Diagrams, charts, videos' },
                      { value: 'auditory', label: 'Auditory', icon: '🎧', description: 'Podcasts, discussions, lectures' },
                      { value: 'reading', label: 'Reading', icon: '📚', description: 'Books, articles, notes' },
                      { value: 'kinesthetic', label: 'Hands-on', icon: '🔧', description: 'Experiments, practice, projects' },
                      { value: 'mixed', label: 'Mixed', icon: '🔄', description: 'Combination of methods' }
                    ].map((pref) => (
                      <button
                        key={pref.value}
                        className={`${styles.optionCard} ${learningProfile?.studyPreference === pref.value ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, studyPreference: pref.value };
                          setLearningProfile(newProfile);
                        }}
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
              )}

              {/* Page 3: Difficulty Level */}
              {settingsPage === 2 && (
                <div className={styles.settingsPage}>
                  <h3>Preferred Difficulty Level</h3>
                  <p>What level of challenge do you prefer in your learning materials?</p>
                  <div className={styles.optionsGrid}>
                    {[
                      { value: 'beginner', label: 'Beginner', icon: '🌱', description: 'Start with basics and fundamentals' },
                      { value: 'easy', label: 'Easy', icon: '😊', description: 'Simple concepts and straightforward content' },
                      { value: 'medium', label: 'Medium', icon: '⚖️', description: 'Balanced challenge and complexity' },
                      { value: 'hard', label: 'Hard', icon: '🔥', description: 'Advanced concepts and complex problems' },
                      { value: 'expert', label: 'Expert', icon: '🏆', description: 'Master-level content and deep analysis' }
                    ].map((difficulty) => (
                      <button
                        key={difficulty.value}
                        className={`${styles.optionCard} ${learningProfile?.preferredDifficulty === difficulty.value ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, preferredDifficulty: difficulty.value };
                          setLearningProfile(newProfile);
                        }}
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
              )}

              {/* Page 4: Study Time Preference */}
              {settingsPage === 3 && (
                <div className={styles.settingsPage}>
                  <h3>Preferred Study Time</h3>
                  <p>When do you feel most productive and focused?</p>
                  <div className={styles.optionsGrid}>
                    {[
                      { value: 'early_morning', label: 'Early Morning', icon: '🌅', description: '5:00 AM - 8:00 AM' },
                      { value: 'morning', label: 'Morning', icon: '☀️', description: '8:00 AM - 12:00 PM' },
                      { value: 'afternoon', label: 'Afternoon', icon: '🌤️', description: '12:00 PM - 5:00 PM' },
                      { value: 'evening', label: 'Evening', icon: '🌆', description: '5:00 PM - 9:00 PM' },
                      { value: 'night', label: 'Night', icon: '🌙', description: '9:00 PM - 12:00 AM' },
                      { value: 'late_night', label: 'Late Night', icon: '🌃', description: '12:00 AM - 5:00 AM' }
                    ].map((time) => (
                      <button
                        key={time.value}
                        className={`${styles.optionCard} ${learningProfile?.studyTimePreference === time.value ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, studyTimePreference: time.value };
                          setLearningProfile(newProfile);
                        }}
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
              )}

              {/* Page 5: Learning Style */}
              {settingsPage === 4 && (
                <div className={styles.settingsPage}>
                  <h3>Learning Style</h3>
                  <p>How do you process and understand new information?</p>
                  <div className={styles.optionsGrid}>
                    {[
                      { value: 'active', label: 'Active Learner', icon: '⚡', description: 'Learn by doing and discussing' },
                      { value: 'reflective', label: 'Reflective Learner', icon: '🤔', description: 'Learn by thinking and analyzing' },
                      { value: 'sequential', label: 'Sequential Learner', icon: '📋', description: 'Learn step-by-step, logically' },
                      { value: 'global', label: 'Global Learner', icon: '🌍', description: 'Learn big picture first, then details' },
                      { value: 'sensing', label: 'Sensing Learner', icon: '🔍', description: 'Learn facts and concrete examples' },
                      { value: 'intuitive', label: 'Intuitive Learner', icon: '💡', description: 'Learn concepts and theories' }
                    ].map((style) => (
                      <button
                        key={style.value}
                        className={`${styles.optionCard} ${learningProfile?.learningStyle === style.value ? styles.active : ''}`}
                        onClick={() => {
                          const newProfile = { ...learningProfile, learningStyle: style.value };
                          setLearningProfile(newProfile);
                        }}
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
              )}
            </div>

            <div className={styles.settingsPopupFooter}>
              <div className={styles.navigationButtons}>
                <button 
                  className={styles.navButton}
                  onClick={() => setSettingsPage(Math.max(0, settingsPage - 1))}
                  disabled={settingsPage === 0}
                >
                  ← Previous
                </button>
                <div className={styles.pageIndicator}>
                  {settingsPage + 1} of 5
                </div>
                <button 
                  className={styles.navButton}
                  onClick={() => setSettingsPage(Math.min(4, settingsPage + 1))}
                  disabled={settingsPage === 4}
                >
                  Next →
                </button>
              </div>
              <div className={styles.actionButtons}>
                <button 
                  className={styles.saveButton}
                  onClick={async () => {
                    await handleAttentionSpanUpdate(learningProfile);
                    setShowSettingsPopup(false);
                    setSettingsPage(0);
                  }}
                >
                  Save Preferences
                </button>
                <button 
                  className={styles.cancelButton}
                  onClick={() => {
                    setShowSettingsPopup(false);
                    setSettingsPage(0);
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      </div>
    </IntroAnimation>
  );
} 