'use client';

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

// ─── Session timeout config ───────────────────────────────────────────────────
const SESSION_TIMEOUT_MS = 30 * 60 * 1000;   // 30 minutes of inactivity
const WARN_BEFORE_MS     = 2 * 60 * 1000;    // warn 2 minutes before expiry
const ACTIVITY_EVENTS    = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'];

// ─── Context ──────────────────────────────────────────────────────────────────
const AuthContext = createContext<any>({});

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

// ─── Session Timeout Warning Modal ───────────────────────────────────────────
function SessionTimeoutModal({
  secondsLeft,
  onStaySignedIn,
  onSignOut,
}: {
  secondsLeft: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}) {
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const label = mins > 0
    ? `${mins}m ${secs.toString().padStart(2, '0')}s`
    : `${secs}s`;

  return (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-timeout-title"
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-8 text-center"
        style={{ border: '1px solid var(--izou-border)' }}
      >
        {/* Icon */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ backgroundColor: '#fff7ed' }}
        >
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        </div>

        <h2 id="session-timeout-title" className="text-lg font-bold mb-2" style={{ color: 'var(--izou-text)' }}>
          Session Expiring Soon
        </h2>
        <p className="text-sm mb-1" style={{ color: 'var(--izou-muted)' }}>
          You've been inactive. Your session will expire in
        </p>
        <p className="text-2xl font-bold mb-5" style={{ color: '#f97316' }}>
          {label}
        </p>
        <p className="text-xs mb-6" style={{ color: 'var(--izou-muted)' }}>
          To protect your account, you'll be signed out automatically if no action is taken.
        </p>

        <div className="flex gap-3">
          <button
            onClick={onSignOut}
            className="flex-1 h-11 rounded-xl font-semibold text-sm transition-colors"
            style={{ border: '1px solid var(--izou-border)', color: 'var(--izou-muted)', backgroundColor: 'white' }}
          >
            Sign Out
          </button>
          <button
            onClick={onStaySignedIn}
            className="flex-1 izou-btn-primary h-11 rounded-xl font-semibold text-sm"
          >
            Stay Signed In
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Provider ─────────────────────────────────────────────────────────────────
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);

  // Session timeout state
  const [showTimeoutWarning, setShowTimeoutWarning] = useState(false);
  const [timeoutSecondsLeft, setTimeoutSecondsLeft] = useState(WARN_BEFORE_MS / 1000);

  const supabase = createClient();
  const router = useRouter();

  // Refs so callbacks always see latest values without re-registering listeners
  const userRef = useRef<any>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const warnTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownRef    = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Load user profile ──────────────────────────────────────────────────────
  const loadUserProfile = async (userId: string) => {
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();
      setUserProfile(data ?? null);
    } catch {
      setUserProfile(null);
    }
  };

  // ── Clear all timeout timers ───────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    if (timeoutTimerRef.current) clearTimeout(timeoutTimerRef.current);
    if (warnTimerRef.current)    clearTimeout(warnTimerRef.current);
    if (countdownRef.current)    clearInterval(countdownRef.current);
    timeoutTimerRef.current = null;
    warnTimerRef.current    = null;
    countdownRef.current    = null;
  }, []);

  // ── Sign out (shared logic) ────────────────────────────────────────────────
  const performSignOut = useCallback(async () => {
    clearTimers();
    setShowTimeoutWarning(false);
    await supabase.auth.signOut();
    router.push('/sign-up-login-screen');
  }, [clearTimers, router, supabase.auth]);

  // ── Start / reset the inactivity timer ────────────────────────────────────
  const resetActivityTimer = useCallback(() => {
    if (!userRef.current) return;   // only track when logged in

    clearTimers();
    setShowTimeoutWarning(false);

    // Show warning WARN_BEFORE_MS before the full timeout
    warnTimerRef.current = setTimeout(() => {
      setShowTimeoutWarning(true);
      setTimeoutSecondsLeft(WARN_BEFORE_MS / 1000);

      // Countdown ticker
      countdownRef.current = setInterval(() => {
        setTimeoutSecondsLeft((s) => {
          if (s <= 1) {
            if (countdownRef.current) clearInterval(countdownRef.current);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    }, SESSION_TIMEOUT_MS - WARN_BEFORE_MS);

    // Hard sign-out after full timeout
    timeoutTimerRef.current = setTimeout(() => {
      performSignOut();
    }, SESSION_TIMEOUT_MS);
  }, [clearTimers, performSignOut]);

  // ── Register / unregister activity listeners ───────────────────────────────
  useEffect(() => {
    if (!user) {
      clearTimers();
      setShowTimeoutWarning(false);
      return;
    }

    userRef.current = user;
    resetActivityTimer();

    const handler = () => resetActivityTimer();
    ACTIVITY_EVENTS.forEach((evt) => window.addEventListener(evt, handler, { passive: true }));

    return () => {
      ACTIVITY_EVENTS.forEach((evt) => window.removeEventListener(evt, handler));
      clearTimers();
    };
  }, [user, resetActivityTimer, clearTimers]);

  // ── Supabase auth state ────────────────────────────────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      userRef.current = session?.user ?? null;
      if (session?.user) {
        loadUserProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    }).catch(() => {
      setSession(null);
      setUser(null);
      userRef.current = null;
      setLoading(false);
    });

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      userRef.current = session?.user ?? null;
      if (session?.user) {
        loadUserProfile(session.user.id).finally(() => setLoading(false));
      } else {
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // ── Auth methods ───────────────────────────────────────────────────────────
  const signUp = async (email: string, password: string, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: (metadata as any)?.fullName || '',
          avatar_url: (metadata as any)?.avatarUrl || ''
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`
      }
    });
    if (error) throw error;
    return data;
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      if ((error as any).__isAuthError && (error as any).status === 0) {
        throw new Error('Unable to connect to the authentication server. Please check your internet connection and try again.');
      }
      throw error;
    }
    return data;
  };

  const signOut = async () => {
    await performSignOut();
  };

  const getCurrentUser = async () => {
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    return user;
  };

  const isEmailVerified = () => user?.email_confirmed_at !== null;

  const getUserProfile = async () => {
    if (!user) return null;
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (error) throw error;
    return data;
  };

  const userRole: string | null = userProfile?.role ?? null;
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
    getUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
      {showTimeoutWarning && user && (
        <SessionTimeoutModal
          secondsLeft={timeoutSecondsLeft}
          onStaySignedIn={resetActivityTimer}
          onSignOut={performSignOut}
        />
      )}
    </AuthContext.Provider>
  );
};
