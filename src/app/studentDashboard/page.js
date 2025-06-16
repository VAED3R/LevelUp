"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";  // Ensure you import your Firebase config
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, orderBy, limit, updateDoc, setDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import style from './page.module.css';
import IntroAnimation from "../../components/IntroAnimation";

import Navbar from "@/components/studentNavbar";

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

  return (
    <IntroAnimation loadingText="Loading Student Dashboard...">
      <div className={style.container}>
        <Navbar />
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

          <div className={style.cardContainer}>
            <div className={style.userCard}>
              <h2>Your Information</h2>
              <p><strong>Name:</strong> {userData?.name}</p>
              <p><strong>Class:</strong> {userData?.class}</p>
              <p><strong>University:</strong> Calicut University</p>
              <div className={style.pointsInfo}>
                <p><strong>Total Points:</strong> {pointsData?.totalPoints || 0}</p>
              </div>
            </div>
            
            <div className={style.userCard}>
              <h2>Your Results</h2>
              <p>View your test results and performance across all subjects</p>
              <button 
                className={style.viewButton}
                onClick={() => router.push('/viewresults')}
              >
                View Test Results
              </button>
            </div>
          </div>

          {loading ? (
            <div className={style.loading}>Loading quizzes...</div>
          ) : (
            <div className={style.quizzesSection}>
              <h2 className={style.sectionTitle}>Available Quizzes</h2>
              <div className={style.quizzesGrid}>
                {quizzes.length === 0 ? (
                  <div className={style.quizCard}>
                    <div className={style.quizActions}>
                      <button className={style.viewButton} onClick={() => router.push('/Studentquiz')}>
                        View All Quizzes
                      </button>
                    </div>
                  </div>
                ) : (
                  quizzes.map((quiz) => (
                    <div key={quiz.id} className={style.quizCard}>
                      <h3 className={style.quizTitle}>{quiz.topic || 'Untitled Quiz'}</h3>
                      <p className={style.quizSubject}>{quiz.subject ? quiz.subject.replace(/_/g, " ") : 'No Subject'}</p>
                      <div className={style.quizDetails}>
                        <p>Questions: {quiz.questions.length}</p>
                        <p>Created: {new Date(quiz.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className={style.quizActions}>
                        <button 
                          className={style.viewButton}
                          onClick={() => handleStartQuiz(quiz.id)}
                        >
                          Start Quiz
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </IntroAnimation>
  );
}
