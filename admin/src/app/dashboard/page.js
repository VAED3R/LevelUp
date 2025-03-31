"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut } from 'firebase/auth';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import styles from './page.module.css'; // Import the updated CSS

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function Dashboard() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('teacher');
  const [classField, setClassField] = useState('');
  const [subject, setSubject] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [error, setError] = useState('');
  const router = useRouter();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (!user) {
        router.push('/');
      } else {
        fetchUsers();
      }
    });
    return () => unsubscribe();
  }, [router]);

  const fetchUsers = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'users'));
      const usersList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setUsers(usersList);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching users:', error);
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    router.push('/');
  };

  const handleAddUser = async () => {
    // Handle user addition logic with Firebase auth and Firestore.
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Admin Dashboard</h1>
        <button className={styles.logoutBtn} onClick={handleLogout}>Logout</button>
      </div>

      <div className={styles.addUserSection}>
        <h2>Add New User</h2>
        {error && <p className={styles.errorMessage}>{error}</p>}

        <div>
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={styles.inputField}
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.inputField}
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.inputField}
          />
          {role !== 'teacher' && (
            <input
              type="text"
              placeholder="Class (e.g., S6CS)"
              value={classField}
              onChange={(e) => setClassField(e.target.value)}
              className={styles.inputField}
            />
          )}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className={styles.selectRole}
          >
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
            <option value="parent">Parent</option>
          </select>

          {role === 'parent' && (
            <input
              type="email"
              placeholder="Child's Email"
              value={childEmail}
              onChange={(e) => setChildEmail(e.target.value)}
              className={styles.inputField}
            />
          )}

          {role === 'teacher' && (
            <input
              type="text"
              placeholder="Subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className={styles.inputField}
            />
          )}

          <button onClick={handleAddUser} className={styles.addUserBtn}>Add User</button>
        </div>
      </div>
    </div>
  );
}
