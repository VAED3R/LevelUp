"use client";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "./LoadingScreen";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

export default function AuthGate({ children }) {
  const { user, loading, authError } = useAuth();
  const pathname = usePathname();
  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  
  // Pages that don't require authentication
  const publicPages = ['/login', '/'];
  
  // Check if current page is public
  const isPublicPage = publicPages.includes(pathname);
  
  // Detect logout by checking if user was previously authenticated
  useEffect(() => {
    if (user && !loading) {
      setIsLoggingOut(false);
    } else if (!user && !loading && !isPublicPage) {
      // Check if this is a logout transition
      const wasAuthenticated = localStorage.getItem('wasAuthenticated');
      if (wasAuthenticated === 'true') {
        setIsLoggingOut(true);
        localStorage.removeItem('wasAuthenticated');
        // Don't show auth prompt during logout
        return;
      }
    }
  }, [user, loading, isPublicPage]);
  
  // Track authentication state
  useEffect(() => {
    if (user) {
      localStorage.setItem('wasAuthenticated', 'true');
    }
  }, [user]);
  
  // Add a longer delay before showing auth prompt to prevent flash during logout
  useEffect(() => {
    if (!user && !isPublicPage && !loading && !isLoggingOut) {
      const timer = setTimeout(() => {
        setShowAuthPrompt(true);
      }, 1000); // 1 second delay to prevent flash during logout
      
      return () => clearTimeout(timer);
    } else {
      setShowAuthPrompt(false);
    }
  }, [user, isPublicPage, loading, isLoggingOut]);
  
  // Show auth error if there's an authentication problem
  if (authError) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '400px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{fontSize: '3rem', marginBottom: '1rem'}}>⚠️</div>
          <h2 style={{fontSize: '1.5rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem'}}>Authentication Error</h2>
          <p style={{color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5'}}>{authError}</p>
          <button 
            onClick={() => window.location.reload()} 
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // If still loading auth, show page content immediately (no skeleton overlay)
  if (loading) {
    return children;
  }

  // If user is not authenticated and not on a public page, show login prompt
  if (!user && !isPublicPage && showAuthPrompt) {
    return (
      <div style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: 'rgba(0, 0, 0, 0.9)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 9999
      }}>
        <div style={{
          background: '#ffffff',
          borderRadius: '12px',
          padding: '2rem',
          textAlign: 'center',
          maxWidth: '400px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.3)'
        }}>
          <div style={{fontSize: '3rem', marginBottom: '1rem'}}>🔐</div>
          <h2 style={{fontSize: '1.5rem', fontWeight: 600, color: '#dc2626', marginBottom: '0.5rem'}}>Authentication Required</h2>
          <p style={{color: '#6b7280', marginBottom: '1.5rem', lineHeight: '1.5'}}>Please log in to access this page.</p>
          <button 
            onClick={() => window.location.href = '/login'} 
            style={{
              background: '#dc2626',
              color: 'white',
              border: 'none',
              padding: '0.75rem 1.5rem',
              borderRadius: '8px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  // User is authenticated, show content
  return children;
}