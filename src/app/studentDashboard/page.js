"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";  // Ensure you import your Firebase config
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, limit, updateDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import style from './page.module.css';
import IntroAnimation from "../../components/IntroAnimation";
import Navbar from "@/components/studentNavbar";
import StudentChatbot from "@/components/StudentChatbot";

// Helper to get the notification read doc ref
const getReadNotificationsDocRef = (userId) => doc(db, "students", userId, "meta", "notificationRead");

export default function StudentDashboard() {
  const [userData, setUserData] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pointsData, setPointsData] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [readNotificationIds, setReadNotificationIds] = useState(new Set());
  const [achievements, setAchievements] = useState([]);
  const [studentActivity, setStudentActivity] = useState({
    quizzesCompleted: 0,
    materialsAccessed: 0,
    perfectScores: 0,
    totalPoints: 0,
    loginStreak: 0,
    challengesWon: 0,
    averageScore: 0
  });
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;

        if (!user) {
          console.log("No user is signed in.");
          router.push("/login");
          return;
        }

        // First get user data from users collection
        const userRef = doc(db, "users", user.uid);
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          setUserData(userDoc.data());
          
          // Then get points data from students collection
          const studentRef = doc(db, "students", user.uid);
          const studentDoc = await getDoc(studentRef);
          
          if (studentDoc.exists()) {
            const studentData = studentDoc.data();
            setPointsData({
              totalPoints: studentData.totalPoints || 0,
              recentPoints: studentData.points || []
            });
            console.log("Fetched student points:", studentData); // Debug log
          } else {
            console.log("No student document found for points"); // Debug log
            setPointsData({
              totalPoints: 0,
              recentPoints: []
            });
          }

          // Fetch available quizzes for the student's class
          const quizzesRef = collection(db, "quizzes");
          const quizzesQuery = query(quizzesRef, where("class", "==", userDoc.data().class));
          const quizzesSnapshot = await getDocs(quizzesQuery);
          
          const quizzesList = quizzesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
            questions: doc.data().questions || []
          }));

          quizzesList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
          setQuizzes(quizzesList);
        } else {
          console.error("No user data found in Firestore.");
          setError("No data found.");
        }
      } catch (error) {
        console.error("Error fetching user data:", error);
        setError("Failed to load data.");
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, [router]);

  // Load read notification IDs from Firestore on mount
  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;
    const docRef = getReadNotificationsDocRef(user.uid);
    getDoc(docRef).then((docSnap) => {
      if (docSnap.exists()) {
        const ids = docSnap.data().ids || [];
        setReadNotificationIds(new Set(ids));
      }
    });
  }, []);

  // Save read notification IDs to Firestore
  const persistReadNotifications = async (ids) => {
    const user = auth.currentUser;
    if (!user) return;
    const docRef = getReadNotificationsDocRef(user.uid);
    await setDoc(docRef, { ids: Array.from(ids) });
  };

  // Notification system
  useEffect(() => {
    const user = auth.currentUser;
    if (!user || !userData) return;

    let currentNotifications = [];
    let existingNotificationIds = new Set();

    // 1. Monitor 1v1 challenges
    const challengesQuery = query(
      collection(db, "onevsoneRequests"),
      where("toUserId", "==", user.uid),
      where("status", "==", "pending")
    );

    const challengesUnsubscribe = onSnapshot(challengesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const challenge = change.doc.data();
          const notificationId = `challenge_${change.doc.id}`;
          
          // Only create notification if it's truly new
          if (!existingNotificationIds.has(notificationId)) {
            const newNotification = {
              id: notificationId,
              type: "challenge",
              title: "New 1v1 Challenge!",
              message: `${challenge.fromUserName} has challenged you to a ${challenge.topic} quiz for ${challenge.pointsWagered} points!`,
              timestamp: challenge.createdAt?.toDate() || new Date(),
              read: false,
              action: () => router.push("/onevsoneRequests")
            };
            
            currentNotifications.push(newNotification);
            setNotifications(prev => [...prev, newNotification]);
            setUnreadCount(prev => prev + 1);
            existingNotificationIds.add(notificationId);
          }
        }
      });
    });

    // 2. Monitor new quizzes for the student's class
    const newQuizzesQuery = query(
      collection(db, "quizzes"),
      where("class", "==", userData.class),
      limit(5)
    );

    const quizzesUnsubscribe = onSnapshot(newQuizzesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added") {
          const quiz = change.doc.data();
          const quizDate = quiz.createdAt?.toDate() || new Date();
          const isRecent = (new Date() - quizDate) < (24 * 60 * 60 * 1000); // Last 24 hours
          const notificationId = `quiz_${change.doc.id}`;
          
          if (isRecent && !existingNotificationIds.has(notificationId)) {
            const newNotification = {
              id: notificationId,
              type: "quiz",
              title: "New Quiz Available!",
              message: `A new ${quiz.subject} quiz on "${quiz.topic}" is now available!`,
              timestamp: quizDate,
              read: false,
              action: () => router.push("/Studentquiz")
            };
            
            currentNotifications.push(newNotification);
            setNotifications(prev => [...prev, newNotification]);
            setUnreadCount(prev => prev + 1);
            existingNotificationIds.add(notificationId);
          }
        }
      });
    });

    // 3. Monitor challenge results
    const completedChallengesQuery = query(
      collection(db, "onevsoneRequests"),
      where("fromUserId", "==", user.uid),
      where("status", "==", "completed"),
      limit(5)
    );

    const completedChallengesUnsubscribe = onSnapshot(completedChallengesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const challenge = change.doc.data();
          if (challenge.completedAt && !challenge.notificationSent) {
            const isWinner = challenge.winner === "fromUser";
            const notificationId = `result_${change.doc.id}`;
            
            // Only create notification if it's truly new
            if (!existingNotificationIds.has(notificationId)) {
              const newNotification = {
                id: notificationId,
                type: "result",
                title: isWinner ? "Challenge Won! 🏆" : "Challenge Result",
                message: isWinner 
                  ? `Congratulations! You won the ${challenge.topic} challenge and earned ${challenge.pointsWagered} points!`
                  : `The ${challenge.topic} challenge is complete. Check the results!`,
                timestamp: challenge.completedAt?.toDate() || new Date(),
                read: false,
                action: () => router.push("/onevsoneRequests")
              };
              
              currentNotifications.push(newNotification);
              setNotifications(prev => [...prev, newNotification]);
              setUnreadCount(prev => prev + 1);
              existingNotificationIds.add(notificationId);
            }
          }
        }
      });
    });

    // 3.5. Monitor challenge responses (accept/decline)
    const sentChallengesQuery = query(
      collection(db, "onevsoneRequests"),
      where("fromUserId", "==", user.uid),
      where("status", "in", ["accepted", "declined"]),
      limit(5)
    );

    const sentChallengesUnsubscribe = onSnapshot(sentChallengesQuery, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === "modified") {
          const challenge = change.doc.data();
          const notificationId = `response_${change.doc.id}`;
          
          // Only create notification if it's truly new
          if (!existingNotificationIds.has(notificationId)) {
            const isAccepted = challenge.status === "accepted";
            const newNotification = {
              id: notificationId,
              type: "response",
              title: isAccepted ? "Challenge Accepted! ✅" : "Challenge Declined ❌",
              message: isAccepted 
                ? `${challenge.toUserName} accepted your ${challenge.topic} challenge! Get ready to compete!`
                : `${challenge.toUserName} declined your ${challenge.topic} challenge.`,
              timestamp: new Date(),
              read: false,
              action: () => router.push("/onevsoneRequests")
            };
            
            currentNotifications.push(newNotification);
            setNotifications(prev => [...prev, newNotification]);
            setUnreadCount(prev => prev + 1);
            existingNotificationIds.add(notificationId);
          }
        }
      });
    });

    // 4. Monitor points updates
    const pointsUnsubscribe = onSnapshot(doc(db, "students", user.uid), (doc) => {
      if (doc.exists()) {
        const studentData = doc.data();
        const recentPoints = studentData.points || [];
        
        if (recentPoints.length > 0) {
          const latestPoint = recentPoints[recentPoints.length - 1];
          const pointDate = new Date(latestPoint.date);
          const isRecent = (new Date() - pointDate) < (5 * 60 * 1000); // Last 5 minutes
          const notificationId = `points_${latestPoint.date}_${latestPoint.points}`;
          
          if (isRecent && latestPoint.type === "challenge_win" && !existingNotificationIds.has(notificationId)) {
            const newNotification = {
              id: notificationId,
              type: "points",
              title: "Points Earned! 💰",
              message: `You earned ${latestPoint.points} points from the challenge!`,
              timestamp: pointDate,
              read: false,
              action: () => router.push("/leaderboard")
            };
            
            currentNotifications.push(newNotification);
            setNotifications(prev => [...prev, newNotification]);
            setUnreadCount(prev => prev + 1);
            existingNotificationIds.add(notificationId);
          }
        }
      }
    });

    // Cleanup listeners
    return () => {
      challengesUnsubscribe();
      quizzesUnsubscribe();
      completedChallengesUnsubscribe();
      sentChallengesUnsubscribe();
      pointsUnsubscribe();
    };
  }, [userData, router]);

  // Click outside handler for notifications
  useEffect(() => {
    const handleClickOutside = (event) => {
      const notificationContainer = document.querySelector(`.${style.notificationContainer}`);
      if (notificationContainer && !notificationContainer.contains(event.target)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications, style.notificationContainer]);

  // Update markAsRead and markAllAsRead to persist
  const markAsRead = (notificationId) => {
    setNotifications(prev =>
      prev.map(notif =>
        notif.id === notificationId
          ? { ...notif, read: true }
          : notif
      )
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
    setReadNotificationIds(prev => {
      const newSet = new Set(prev);
      newSet.add(notificationId);
      persistReadNotifications(newSet);
      return newSet;
    });
  };

  const markAllAsRead = () => {
    setNotifications(prev =>
      prev.map(notif => ({ ...notif, read: true }))
    );
    setUnreadCount(0);
    setReadNotificationIds(prev => {
      const newSet = new Set(prev);
      notifications.forEach(n => newSet.add(n.id));
      persistReadNotifications(newSet);
      return newSet;
    });
  };

  // When new notifications arrive, set their read status from Firestore
  useEffect(() => {
    setNotifications(prev =>
      prev.map(n =>
        readNotificationIds.has(n.id)
          ? { ...n, read: true }
          : n
      )
    );
    setUnreadCount(
      notifications.filter(n => !readNotificationIds.has(n.id)).length
    );
  }, [readNotificationIds, notifications.length]);

  const handleNotificationClick = (notification) => {
    markAsRead(notification.id);
    if (notification.action) {
      notification.action();
    }
  };

  const handleNotificationDropdownToggle = () => {
    const newShowState = !showNotifications;
    setShowNotifications(newShowState);
    
    // Mark all notifications as read when opening the dropdown
    if (newShowState && unreadCount > 0) {
      markAllAsRead();
    }
  };

  const handleStartQuiz = (quizId) => {
    router.push(`/Studentquiz/${quizId}`);
  };

  const clearOldNotifications = () => {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    setNotifications(prev =>
      prev.filter(notif => notif.timestamp > oneDayAgo)
    );
  };

  // Clear old notifications periodically
  useEffect(() => {
    const interval = setInterval(clearOldNotifications, 60 * 60 * 1000); // Every hour
    return () => clearInterval(interval);
  }, []);

  // Limit notifications to prevent memory issues
  useEffect(() => {
    if (notifications.length > 50) {
      setNotifications(prev => 
        prev
          .sort((a, b) => b.timestamp - a.timestamp)
          .slice(0, 50)
      );
    }
  }, [notifications.length]);

  // Fetch student activity data for achievements
  useEffect(() => {
    const fetchStudentActivity = async () => {
      if (!userData) return;

      try {
        const user = auth.currentUser;
        if (!user) return;

        // Fetch completed quizzes
        const completedQuizzesQuery = query(
          collection(db, "quizzes"),
          where("studentId", "==", user.uid)
        );
        const completedQuizzesSnapshot = await getDocs(completedQuizzesQuery);
        const completedQuizzes = completedQuizzesSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));

        // Fetch materials accessed (from download history or access logs)
        const materialsQuery = query(
          collection(db, "fileAccess"),
          where("studentId", "==", user.uid)
        );
        const materialsSnapshot = await getDocs(materialsQuery);
        const materialsAccessed = materialsSnapshot.size;

        // Fetch challenge wins
        const challengesQuery = query(
          collection(db, "onevsoneRequests"),
          where("fromUserId", "==", user.uid),
          where("status", "==", "completed"),
          where("winner", "==", "fromUser")
        );
        const challengesSnapshot = await getDocs(challengesQuery);
        const challengesWon = challengesSnapshot.size;

        // Calculate statistics
        const totalPoints = pointsData?.totalPoints || 0;
        const perfectScores = completedQuizzes.filter(q => q.score === 100).length;
        const averageScore = completedQuizzes.length > 0 
          ? completedQuizzes.reduce((sum, q) => sum + (q.score || 0), 0) / completedQuizzes.length 
          : 0;

        // Calculate login streak (simplified - you might want to implement this differently)
        const loginStreak = Math.floor(Math.random() * 10) + 1; // Placeholder

        const activity = {
          quizzesCompleted: completedQuizzes.length,
          materialsAccessed,
          perfectScores,
          totalPoints,
          loginStreak,
          challengesWon,
          averageScore: Math.round(averageScore)
        };

        setStudentActivity(activity);
        checkAchievements(activity);
      } catch (error) {
        console.error('Error fetching student activity:', error);
      }
    };

    fetchStudentActivity();
  }, [userData, pointsData]);

  // Achievement checking logic
  const checkAchievements = (activity) => {
    const allAchievements = [
      {
        id: 'first_quiz',
        icon: '🥇',
        title: 'First Quiz',
        description: 'Completed your first quiz',
        condition: activity.quizzesCompleted >= 1,
        progress: Math.min(activity.quizzesCompleted, 1),
        maxProgress: 1
      },
      {
        id: 'quiz_master',
        icon: '🎯',
        title: 'Quiz Master',
        description: 'Completed 10 quizzes',
        condition: activity.quizzesCompleted >= 10,
        progress: Math.min(activity.quizzesCompleted, 10),
        maxProgress: 10
      },
      {
        id: 'perfect_score',
        icon: '⭐',
        title: 'Perfect Score',
        description: 'Got 100% on a quiz',
        condition: activity.perfectScores >= 1,
        progress: Math.min(activity.perfectScores, 1),
        maxProgress: 1
      },
      {
        id: 'high_achiever',
        icon: '🏆',
        title: 'High Achiever',
        description: 'Got 3 perfect scores',
        condition: activity.perfectScores >= 3,
        progress: Math.min(activity.perfectScores, 3),
        maxProgress: 3
      },
      {
        id: 'bookworm',
        icon: '📚',
        title: 'Bookworm',
        description: 'Accessed 10+ materials',
        condition: activity.materialsAccessed >= 10,
        progress: Math.min(activity.materialsAccessed, 10),
        maxProgress: 10
      },
      {
        id: 'knowledge_seeker',
        icon: '🔍',
        title: 'Knowledge Seeker',
        description: 'Accessed 25+ materials',
        condition: activity.materialsAccessed >= 25,
        progress: Math.min(activity.materialsAccessed, 25),
        maxProgress: 25
      },
      {
        id: 'point_collector',
        icon: '💰',
        title: 'Point Collector',
        description: 'Earned 500 points',
        condition: activity.totalPoints >= 500,
        progress: Math.min(activity.totalPoints, 500),
        maxProgress: 500
      },
      {
        id: 'point_master',
        icon: '💎',
        title: 'Point Master',
        description: 'Earned 1000 points',
        condition: activity.totalPoints >= 1000,
        progress: Math.min(activity.totalPoints, 1000),
        maxProgress: 1000
      },
      {
        id: 'streak_master',
        icon: '🔥',
        title: 'Streak Master',
        description: '7 days login streak',
        condition: activity.loginStreak >= 7,
        progress: Math.min(activity.loginStreak, 7),
        maxProgress: 7
      },
      {
        id: 'challenge_champion',
        icon: '⚔️',
        title: 'Challenge Champion',
        description: 'Won 5 challenges',
        condition: activity.challengesWon >= 5,
        progress: Math.min(activity.challengesWon, 5),
        maxProgress: 5
      },
      {
        id: 'consistent_performer',
        icon: '📈',
        title: 'Consistent Performer',
        description: 'Average score above 80%',
        condition: activity.averageScore >= 80,
        progress: Math.min(activity.averageScore, 80),
        maxProgress: 80
      },
      {
        id: 'excellent_student',
        icon: '🎓',
        title: 'Excellent Student',
        description: 'Average score above 90%',
        condition: activity.averageScore >= 90,
        progress: Math.min(activity.averageScore, 90),
        maxProgress: 90
      }
    ];

    setAchievements(allAchievements);
  };

  return (
    <IntroAnimation loadingText="Loading Student Dashboard...">
      <div className={style.container}>
        <Navbar />
        <StudentChatbot showWelcome={true} />
        <div className={style.content}>
          <div className={style.header}>
            <h1 className={style.title}>Welcome, {userData?.name}</h1>
            <p className={style.subtitle}>Student Dashboard</p>
            
            {/* Notification Bell */}
            <div className={style.notificationContainer}>
              <button 
                className={style.notificationBell}
                onClick={handleNotificationDropdownToggle}
              >
                🔔
                {unreadCount > 0 && (
                  <span className={style.notificationBadge}>{unreadCount}</span>
                )}
              </button>
              
              {/* Notification Dropdown */}
              {showNotifications && (
                <div className={style.notificationDropdown}>
                  <div className={style.notificationHeader}>
                    <h3>Notifications</h3>
                    <div className={style.notificationActions}>
                      {unreadCount > 0 && (
                        <button 
                          className={style.markAllRead}
                          onClick={markAllAsRead}
                        >
                          Mark all read
                        </button>
                      )}
                      {notifications.length > 0 && (
                        <button 
                          className={style.clearAll}
                          onClick={() => setNotifications([])}
                        >
                          Clear all
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className={style.notificationList}>
                    {notifications.length === 0 ? (
                      <p className={style.noNotifications}>No new notifications</p>
                    ) : (
                      notifications
                        .sort((a, b) => b.timestamp - a.timestamp)
                        .slice(0, 10)
                        .map((notification) => (
                          <div 
                            key={notification.id}
                            className={`${style.notificationItem} ${!notification.read ? style.unread : ''}`}
                            onClick={() => handleNotificationClick(notification)}
                          >
                            <div className={style.notificationContent}>
                              <h4>{notification.title}</h4>
                              <p>{notification.message}</p>
                              <small>{notification.timestamp.toLocaleString()}</small>
                            </div>
                            {!notification.read && (
                              <div className={style.unreadDot}></div>
                            )}
                          </div>
                        ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Hero Card - User Information */}
          <div className={style.heroCard}>
            <div className={style.heroContent}>
              <div className={style.heroLeft}>
                <div className={style.heroAvatar}>
                  <span className={style.avatarText}>{userData?.name?.charAt(0) || 'S'}</span>
                </div>
                <div className={style.heroInfo}>
                  <h2 className={style.heroName}>{userData?.name}</h2>
                  <p className={style.heroClass}>{userData?.class}</p>
                  <p className={style.heroCourse}>B.Sc. APPLIED STATISTICS WITH DATA SCIENCE HONOURS</p>
                  <p className={style.heroUniversity}>Calicut University-FYUGP</p>
                </div>
              </div>
              <div className={style.heroRight}>
                <div className={style.heroPoints}>
                  <div className={style.pointsIcon}>⭐</div>
                  <div className={style.pointsContent}>
                    <span className={style.pointsValue}>{pointsData?.totalPoints || 0}</span>
                    <span className={style.pointsLabel}>Total Points</span>
                  </div>
                </div>
                <div className={style.heroStats}>
                  <div className={style.statItem}>
                    <span className={style.statValue}>{quizzes.length}</span>
                    <span className={style.statLabel}>Quizzes</span>
                  </div>
                  <div className={style.statItem}>
                    <span className={style.statValue}>85%</span>
                    <span className={style.statLabel}>Attendance</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions Section */}
          <div className={style.quickActionsSection}>
            <h2 className={style.sectionTitle}>Quick Actions</h2>
            <div className={style.quickActionsGrid}>
              <button 
                className={style.quickActionCard}
                onClick={() => router.push('/Studentquiz')}
              >
                <div className={style.quickActionIcon}>📝</div>
                <h3>Take Quiz</h3>
                <p>Start a new quiz</p>
              </button>
              
              <button 
                className={style.quickActionCard}
                onClick={() => router.push('/courseMats')}
              >
                <div className={style.quickActionIcon}>📚</div>
                <h3>Study Materials</h3>
                <p>Access course materials</p>
              </button>
              
              <button 
                className={style.quickActionCard}
                onClick={() => router.push('/viewresults')}
              >
                <div className={style.quickActionIcon}>📊</div>
                <h3>View Results</h3>
                <p>Check your performance</p>
              </button>
              
              <button 
                className={style.quickActionCard}
                onClick={() => router.push('/leaderboard')}
              >
                <div className={style.quickActionIcon}>🏆</div>
                <h3>Leaderboard</h3>
                <p>See rankings</p>
              </button>
            </div>
          </div>

          {/* Progress Cards Section */}
          <div className={style.progressSection}>
            <h2 className={style.sectionTitle}>Your Progress</h2>
            <div className={style.progressGrid}>
              <div className={style.progressCard}>
                <div className={style.progressHeader}>
                  <h3>Total Points</h3>
                  <div className={style.progressIcon}>⭐</div>
                </div>
                <div className={style.progressValue}>{pointsData?.totalPoints || 0}</div>
                <div className={style.progressBar}>
                  <div 
                    className={style.progressFill} 
                    style={{width: `${Math.min((pointsData?.totalPoints || 0) / 1000 * 100, 100)}%`}}
                  ></div>
                </div>
                <p className={style.progressLabel}>Next milestone: 1000 points</p>
              </div>
              
              <div className={style.progressCard}>
                <div className={style.progressHeader}>
                  <h3>Quizzes Completed</h3>
                  <div className={style.progressIcon}>🎯</div>
                </div>
                <div className={style.progressValue}>{quizzes.length}</div>
                <div className={style.progressBar}>
                  <div 
                    className={style.progressFill} 
                    style={{width: `${Math.min(quizzes.length / 10 * 100, 100)}%`}}
                  ></div>
                </div>
                <p className={style.progressLabel}>Keep up the good work!</p>
              </div>
              
              <div className={style.progressCard}>
                <div className={style.progressHeader}>
                  <h3>Attendance</h3>
                  <div className={style.progressIcon}>📅</div>
                </div>
                <div className={style.progressValue}>85%</div>
                <div className={style.progressBar}>
                  <div 
                    className={style.progressFill} 
                    style={{width: '85%'}}
                  ></div>
                </div>
                <p className={style.progressLabel}>Excellent attendance!</p>
              </div>
            </div>
          </div>

          {/* Achievement Badges Section */}
          <div className={style.achievementsSection}>
            <h2 className={style.sectionTitle}>Achievements</h2>
            <div className={style.achievementsGrid}>
              {achievements.map((achievement) => (
                <div 
                  key={achievement.id} 
                  className={`${style.achievementBadge} ${achievement.condition ? style.unlocked : style.locked}`}
                >
                  <div className={style.badgeIcon}>{achievement.icon}</div>
                  <h4>{achievement.title}</h4>
                  <p>{achievement.description}</p>
                  <div className={style.achievementProgress}>
                    <div className={style.progressBar}>
                      <div 
                        className={style.progressFill} 
                        style={{width: `${(achievement.progress / achievement.maxProgress) * 100}%`}}
                      ></div>
                    </div>
                    <span className={style.progressText}>
                      {achievement.progress}/{achievement.maxProgress}
                    </span>
                  </div>
                  {achievement.condition && (
                    <div className={style.unlockIndicator}>✓ Unlocked</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Recent Activity Section */}
          <div className={style.recentActivitySection}>
            <h2 className={style.sectionTitle}>Recent Activity</h2>
            <div className={style.activityTimeline}>
              <div className={style.activityItem}>
                <div className={style.activityIcon}>📝</div>
                <div className={style.activityContent}>
                  <h4>Completed Mathematics Quiz</h4>
                  <p>Score: 85% - 2 hours ago</p>
                </div>
              </div>
              
              <div className={style.activityItem}>
                <div className={style.activityIcon}>📚</div>
                <div className={style.activityContent}>
                  <h4>Downloaded Statistics Notes</h4>
                  <p>Chapter 5 - 1 day ago</p>
                </div>
              </div>
              
              <div className={style.activityItem}>
                <div className={style.activityIcon}>🏆</div>
                <div className={style.activityContent}>
                  <h4>Earned 50 points</h4>
                  <p>Quiz completion bonus - 2 days ago</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </IntroAnimation>
  );
}
