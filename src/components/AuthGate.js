"use client";
import { useAuth } from "@/context/AuthContext";
import LoadingScreen from "./LoadingScreen";

export default function AuthGate({ children }) {
  const { loading } = useAuth();
  if (loading) return <LoadingScreen text="Checking authentication..." />;
  return children;
} 