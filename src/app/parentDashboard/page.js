"use client";
import { useEffect, useState } from "react";
import { auth, db } from "@/lib/firebase";  // Ensure you import your Firebase config
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";
import style from './page.module.css';

import Navbar from "@/components/parentNavbar";

export default function StudentDashboard() {
  const [userData, setUserData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;

        if (!user) {
          console.log("No user is signed in.");
          router.push("/login");  // Redirect if no user is logged in
          return;
        }

        const userRef = doc(db, "users", user.uid);  // Get the Firestore document by UID
        const userDoc = await getDoc(userRef);

        if (userDoc.exists()) {
          setUserData(userDoc.data());
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

  if (loading) return <p>Loading...</p>;
  if (error) return <p className={style.error}>{error}</p>;

  return (
    <div>
    <div className={style.dashboard}>
      <Navbar />
      {userData && (
        <div className={style.card}>
          <p><strong>Email:</strong> {userData.email}</p>
          <p><strong>Role:</strong> {userData.role}</p>
          {/* <p><strong>Attendance:</strong> {userData.attendance}</p>
          <p><strong>Points:</strong> {userData.points}</p> */}
        </div>
      )}
    </div>
    </div>
  );
}
