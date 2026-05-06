'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import {
  authenticateUser,
  getLocalSession,
  setLocalSession,
  clearLocalSession,
  getUserById,
  LocalUser,
  LocalSession,
  initLocalStore,
} from '@/lib/localUserStore';

const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<LocalUser | null>(null);
  const [session, setSession] = useState<LocalSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<LocalUser | null>(null);

  // Restore session from localStorage on mount
  useEffect(() => {
    initLocalStore();
    const stored = getLocalSession();
    if (stored) {
      const fullUser = getUserById(stored.userId);
      if (fullUser && fullUser.isActive) {
        setSession(stored);
        setUser(fullUser);
        setUserProfile(fullUser);
      } else {
        // Session references a deleted/inactive user — clear it
        clearLocalSession();
      }
    }
    setLoading(false);
  }, []);

  // Sign In — validates against local user store
  const signIn = async (email: string, password: string) => {
    const matched = authenticateUser(email, password);
    if (!matched) {
      throw new Error('Invalid email or password.');
    }
    setLocalSession(matched);
    const newSession = getLocalSession()!;
    setSession(newSession);
    setUser(matched);
    setUserProfile(matched);
    return matched;
  };

  // Sign Up — not used in local mode; kept for API compatibility
  const signUp = async (
    _email: string,
    _password: string,
    _metadata = {}
  ): Promise<void> => {
    throw new Error(
      'Self-registration is disabled. Contact your system administrator to create an account.'
    );
  };

  // Sign Out
  const signOut = async () => {
    clearLocalSession();
    setSession(null);
    setUser(null);
    setUserProfile(null);
  };

  // Get Current User
  const getCurrentUser = async () => user;

  // Email verification — always true in local mode
  const isEmailVerified = () => true;

  // Get User Profile
  const getUserProfile = async () => userProfile;

  // Convenience: current user's role
  const userRole: string | null = userProfile?.role ?? null;

  // Check if current user has a specific role
  const hasRole = (role: string): boolean => userRole === role;

  const value = {
    user,
    session,
    loading,
    userProfile,
    userRole,
    hasRole,
    signUp,
    signIn,
    signOut,
    getCurrentUser,
    isEmailVerified,
    getUserProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
