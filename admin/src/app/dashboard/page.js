"use client";
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getAuth, onAuthStateChanged, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc } from 'firebase/firestore';
import { initializeApp } from 'firebase/app';

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
  const [role, setRole] = useState('teacher'); // Default role
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [classField, setClassField] = useState('');
  const [childEmail, setChildEmail] = useState('');
  const [subject, setSubject] = useState('');
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
    if (!email || !name || !password || (role !== 'teacher' && !classField)) {
      setError('Name, Email, Password, and Class (for student/parent) are required');
      return;
    }

    try {
      // Step 1: Create Firebase auth user
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 2: Add user data to Firestore with the same UID as the Firebase auth user
      const userData = {
        email,
        name,
        role,
        uid: user.uid, // Store the Firebase auth UID in Firestore
      };

      if (role === 'student') {
        // For students, add the class and email
        userData.class = classField;
      } else if (role === 'parent') {
        // For parents, add the child email and class
        userData.child = childEmail;
        userData.class = classField;
      } else if (role === 'teacher') {
        // For teachers, add subject and name
        userData.subject = subject;
      }

      await setDoc(doc(db, 'users', user.uid), userData);

      // Clear form
      setName('');
      setEmail('');
      setPassword('');
      setClassField('');
      setChildEmail('');
      setSubject('');
      setError('');
      setRole('teacher'); // Reset role to default
      fetchUsers(); // Reload users list
    } catch (error) {
      console.error('Error adding user:', error);
      if (error.code === 'auth/email-already-in-use') {
        setError('This email is already in use');
      } else {
        setError('Failed to add user');
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
        <button
          onClick={handleLogout}
          className="bg-red-500 text-white px-4 py-2 rounded hover:bg-red-600 transition"
        >
          Logout
        </button>
      </div>

      <div className="bg-white p-4 rounded shadow mb-6">
        <h2 className="text-xl font-semibold mb-4">Add New User</h2>
        {error && <p className="text-red-500 mb-4">{error}</p>}
        <div className="mb-4">
          <input
            type="text"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full p-2 border rounded mb-2"
          />
          {role !== 'teacher' && (
            <input
              type="text"
              placeholder="Class (e.g., S6CS)"
              value={classField}
              onChange={(e) => setClassField(e.target.value)}
              className="w-full p-2 border rounded mb-2"
            />
          )}
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            className="w-full p-2 border rounded mb-4"
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
              className="w-full p-2 border rounded mb-2"
            />
          )}

          {role === 'teacher' && (
            <input
              type="text"
              placeholder="Subject (e.g., Compiler Design, Machine Learning)"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full p-2 border rounded mb-4"
            />
          )}

          <button
            onClick={handleAddUser}
            className="w-full bg-blue-500 text-white p-2 rounded hover:bg-blue-600 transition"
          >
            Add User
          </button>
        </div>
      </div>

      {loading ? (
        <p>Loading users...</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {/* {users.map((user) => (
            <div key={user.id} className="bg-white p-4 rounded shadow">
              <p><strong>Email:</strong> {user.email}</p>
              <p><strong>Name:</strong> {user.name}</p>
              <p><strong>Role:</strong> {user.role}</p>
            </div>
          ))} */}
        </div>
      )}
    </div>
  );
}
