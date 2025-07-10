"use client";

import { createContext, useContext, useState, useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import { doc, getDoc } from "firebase/firestore";
import { useRouter } from "next/navigation";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

// Cache duration: 5 minutes
const CACHE_DURATION = 5 * 60 * 1000;

const isCacheValid = (timestamp) => {
  return Date.now() - timestamp < CACHE_DURATION;
};

const getCachedAuth = () => {
  try {
    const cached = localStorage.getItem('authState');
    if (cached) {
      const { user, timestamp } = JSON.parse(cached);
      if (isCacheValid(timestamp)) {
        return user;
      }
    }
  } catch (error) {
    console.error('Error reading cached auth:', error);
  }
  return null;
};

const setCachedAuth = (user) => {
  try {
    const authData = {
      user,
      timestamp: Date.now()
    };
    localStorage.setItem('authState', JSON.stringify(authData));
  } catch (error) {
    console.error('Error caching auth:', error);
  }
};

const clearCachedAuth = () => {
  try {
    localStorage.removeItem('authState');
  } catch (error) {
    console.error('Error clearing cached auth:', error);
  }
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);
  const router = useRouter();

  useEffect(() => {
    // Try to get cached auth first
    const cachedUser = getCachedAuth();
    if (cachedUser) {
      setUser(cachedUser);
      setLoading(false);
      // Still verify with Firebase in background
    }

    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      try {
        setAuthError(null);
        
        if (currentUser) {
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));

          if (userDoc.exists()) {
            const userData = {
              uid: currentUser.uid,
              email: currentUser.email,
              role: userDoc.data().role,
            };
            setUser(userData);
            setCachedAuth(userData);
          } else {
            setAuthError("User profile not found. Please contact support.");
            clearCachedAuth();
          }
        } else {
          setUser(null);
          clearCachedAuth();
        }
      } catch (error) {
        console.error('Auth error:', error);
        setAuthError("Authentication failed. Please try again.");
        clearCachedAuth();
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, authError }}>
      {children}
    </AuthContext.Provider>
  );
};
