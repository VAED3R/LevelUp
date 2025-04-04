"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";  // Ensure you import your Firebase config
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore";
import { useRouter } from "next/navigation";
import Link from "next/link";
import style from './page.module.css';
import IntroAnimation from "../../components/IntroAnimation";

import Navbar from "@/components/studentNavbar";

export default function StudentDashboard() {
  const [userData, setUserData] = useState(null);
  const [quizzes, setQuizzes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();
  const [pointsData, setPointsData] = useState(null);

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

  const handleStartQuiz = (quizId) => {
    router.push(`/Studentquiz/${quizId}`);
  };

  return (
    <IntroAnimation loadingText="Loading Student Dashboard...">
      <div className={style.container}>
        <Navbar />
        <div className={style.content}>
          <div className={style.header}>
            <h1 className={style.title}>Welcome, {userData?.name}</h1>
            <p className={style.subtitle}>Student Dashboard</p>
          </div>

          <div className={style.cardContainer}>
            <div className={style.userCard}>
              <h2>Your Information</h2>
              <p><strong>Name:</strong> {userData?.name}</p>
              <p><strong>Class:</strong> {userData?.class}</p>
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
