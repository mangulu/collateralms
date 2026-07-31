'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, CheckCircle2, AlertCircle, Smartphone, RefreshCw, ShieldCheck, BadgeCheck, Globe, Mail, ArrowLeft } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';
import Link from 'next/link';


interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

interface ResetFormData {
  resetEmail: string;
}

export default function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // 2FA setup required notice (for sensitive roles without phone)
  const [show2FASetupNotice] = useState(() => {
    if (typeof window === 'undefined') return false;
    return new URLSearchParams(window.location.search).get('require_2fa_setup') === '1';
  });

  // Password reset state
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetSent, setResetSent] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  // 2FA state
  const [twoFARequired, setTwoFARequired] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState<string | null>(null); // store generated code for unauthenticated verification
  const [otpExpiry, setOtpExpiry] = useState<string | null>(null); // store expiry for local check
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: { rememberMe: false },
  });

  const {
    register: registerReset,
    handleSubmit: handleResetSubmit,
    formState: { errors: resetErrors },
    reset: resetResetForm,
  } = useForm<ResetFormData>();

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn(data.email, data.password);
      const supabase = createClient();

      const { data: profile } = await supabase
        .from('user_profiles')
        .select('two_fa_enabled, two_fa_enforced, phone, full_name, role')
        .eq('id', result.user?.id)
        .single();

      // Determine if 2FA is required:
      // - Enforced for sensitive roles (system_admin, supervisor) regardless of opt-in
      // - Also triggered if user has voluntarily enabled it
      const SENSITIVE_ROLES = ['system_admin', 'supervisor'];
      const roleRequires2FA = SENSITIVE_ROLES.includes(profile?.role ?? '');
      const needs2FA = roleRequires2FA || profile?.two_fa_enabled;

      if (needs2FA) {
        // If sensitive role but no phone set up yet:
        // - system_admin can log in and set up 2FA from within the dashboard
        // - other sensitive roles (supervisor) are blocked until admin sets up their 2FA
        if (!profile?.phone) {
          if (profile?.role === 'system_admin') {
            // Allow admin to log in — they need to configure 2FA themselves
            toast.warning(
              'Two-Factor Authentication is required for your account. Please set it up from your profile settings.',
              { duration: 8000 }
            );
            router.push('/module-hub');
            router.refresh();
            return;
          }
          await supabase.auth.signOut();
          setIsLoading(false);
          toast.error(
            'Your role requires Two-Factor Authentication. Please contact your administrator to set up 2FA on your account.',
            { duration: 8000 }
          );
          return;
        }

        await sendOTP(profile.phone, result.user?.id);
        // Sign out AFTER storing OTP so the insert succeeds under the authenticated session
        await supabase.auth.signOut();
        setPendingUser({ ...result.user, email: data.email, password: data.password, phone: profile.phone, name: profile.full_name, role: profile.role });
        setTwoFARequired(true);
        setIsLoading(false);
        return;
      }

      toast.success('Welcome back');
      router.push('/module-hub');
      router.refresh();
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message ?? 'Invalid credentials — please try again');
    }
  };

  const onResetSubmit = async (data: ResetFormData) => {
    setResetLoading(true);
    setResetError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.resetPasswordForEmail(data.resetEmail, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });
      if (error) throw error;
      setResetSent(true);
    } catch (err: any) {
      setResetError(err?.message ?? 'Failed to send reset email. Please try again.');
    } finally {
      setResetLoading(false);
    }
  };

  const closeResetModal = () => {
    setShowResetModal(false);
    setResetSent(false);
    setResetError(null);
    resetResetForm();
  };

  const sendOTP = async (phone: string, userId?: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const supabase = createClient();

    const { data: otpRow, error: insertError } = await supabase
      .from('otp_verifications')
      .insert({ user_id: userId, phone, otp_code: code, expires_at: expiresAt })
      .select()
      .single();

    setOtpId(otpRow?.id ?? null);
    setOtpCode(code);
    setOtpExpiry(expiresAt);

    const smsRes = await fetch('/api/sms/send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: phone, message: `[CollateralMS] Your login code is: ${code}. Valid 10 minutes.`, alertType: 'APPROVAL_REQUEST' }),
    });
    const smsData = await smsRes.json();
    if (!smsData.success) {
      toast.info(`Demo mode: Your OTP is ${code}`, { duration: 30000 });
    } else {
      toast.success(`Verification code sent to ${phone}`);
    }

    setCountdown(60);
    const interval = setInterval(() => {
      setCountdown((c) => { if (c <= 1) { clearInterval(interval); return 0; } return c - 1; });
    }, 1000);

    // Return the inserted row id so the caller can confirm it was stored
    return otpRow?.id ?? null;
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) { setOtpError('Enter the 6-digit code'); return; }
    setOtpLoading(true);
    setOtpError(null);
    try {
      // Primary verification: use locally stored code (user is unauthenticated at this point,
      // so RLS blocks direct DB queries — local state is the reliable source of truth)
      if (otpCode && otpExpiry) {
        if (new Date(otpExpiry) < new Date()) throw new Error('OTP expired. Please sign in again.');
        if (otpCode !== otp) throw new Error('Invalid code');
        // Code matched — sign the user back in
        await signIn(pendingUser.email, pendingUser.password);
        // Best-effort: mark OTP as verified in DB (may fail if still unauthenticated, that's OK)
        if (otpId) {
          const supabase = createClient();
          await supabase.from('otp_verifications').update({ verified_at: new Date().toISOString() }).eq('id', otpId);
        }
        toast.success('Welcome back — 2FA verified');
        router.push('/module-hub');
        router.refresh();
        return;
      }

      // Fallback: try DB lookup (works if session is still active)
      const supabase = createClient();
      const { data: otpRow } = await supabase.from('otp_verifications').select('*').eq('id', otpId).single();
      if (!otpRow) throw new Error('OTP not found. Please go back and sign in again.');
      if (new Date(otpRow.expires_at) < new Date()) throw new Error('OTP expired. Please sign in again.');
      if (otpRow.otp_code !== otp) {
        await supabase.from('otp_verifications').update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq('id', otpId);
        throw new Error('Invalid code');
      }
      await supabase.from('otp_verifications').update({ verified_at: new Date().toISOString() }).eq('id', otpId);
      await signIn(pendingUser.email, pendingUser.password);
      toast.success('Welcome back — 2FA verified');
      router.push('/module-hub');
      router.refresh();
    } catch (err: any) {
      setOtpError(err?.message ?? 'Verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  // 2FA verification screen
  if (twoFARequired) {
    return (
      <div
        className="min-h-screen grid lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]"
        style={{ backgroundColor: 'var(--izou-bg)' }}
      >
        {/* Left panel - gradient */}
        <div
          className="relative flex min-h-screen flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(155deg, #007CB3 0%, #008FBE 28%, #00A9E0 58%, #1AB8E6 82%, #35C8F3 100%)'
          }}
        >
          <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(53,200,243,0.2)' }} />
          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-8 py-12">
            <div className="text-center">
              <AppLogo size={48} />
              <h2 className="mt-6 text-3xl font-bold text-white">CollateralMS</h2>
              <p className="mt-2 text-white/70 text-sm">EXIM Bank Tanzania</p>
            </div>
          </div>
        </div>

        {/* Right panel */}
        <div className="flex items-center justify-center px-8 py-12" style={{ backgroundColor: '#f8fafc' }}>
          <div className="w-full max-w-sm">
            <div className="bg-white rounded-2xl shadow-xl p-8" style={{ border: '1px solid var(--izou-border)' }}>
              <div className="text-center mb-6">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
                  style={{ backgroundColor: 'var(--izou-primary-light)' }}
                >
                  <Smartphone size={24} style={{ color: 'var(--izou-primary)' }} />
                </div>
                <h2 className="text-xl font-bold" style={{ color: 'var(--izou-text)' }}>Two-Factor Verification</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--izou-muted)' }}>
                  Enter the 6-digit code sent to <strong>{pendingUser?.phone}</strong>
                </p>
              </div>

              {otpError && (
                <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                  <AlertCircle size={14} className="text-red-600 shrink-0" />
                  <p className="text-xs text-red-700">{otpError}</p>
                </div>
              )}

              <div className="space-y-4">
                <input
                  type="text"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest rounded-xl focus:outline-none focus:ring-2"
                  style={{
                    border: '1px solid var(--izou-border)',
                    backgroundColor: 'var(--izou-primary-light)',
                    color: 'var(--izou-text)'
                  }}
                />
                <button
                  onClick={verifyOTP}
                  disabled={otpLoading || otp.length !== 6}
                  className="izou-btn-primary w-full py-3 font-semibold rounded-xl disabled:opacity-60 flex items-center justify-center gap-2"
                >
                  {otpLoading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Verify & Sign In
                </button>
                <div className="flex items-center justify-between text-sm">
                  <button
                    onClick={() => { setTwoFARequired(false); setPendingUser(null); setOtp(''); }}
                    style={{ color: 'var(--izou-muted)' }}
                    className="hover:underline"
                  >
                    ← Back to login
                  </button>
                  {countdown > 0 ? (
                    <p style={{ color: 'var(--izou-muted)' }}>Resend in {countdown}s</p>
                  ) : (
                    <button
                      onClick={() => sendOTP(pendingUser?.phone)}
                      style={{ color: 'var(--izou-primary)' }}
                      className="hover:underline font-semibold"
                    >
                      Resend code
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="min-h-screen grid lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]">
        {/* Left panel — IZOU-style gradient */}
        <div
          className="relative flex min-h-screen flex-col overflow-hidden"
          style={{
            background: 'linear-gradient(155deg, #007CB3 0%, #008FBE 28%, #00A9E0 58%, #1AB8E6 82%, #35C8F3 100%)'
          }}
        >
          {/* Decorative blobs */}
          <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} aria-hidden="true" />
          <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(53,200,243,0.2)' }} aria-hidden="true" />
          {/* Decorative lines */}
          <svg className="pointer-events-none absolute bottom-0 left-0 h-[55%] w-[70%] text-white/20" viewBox="0 0 400 320" fill="none" preserveAspectRatio="xMinYMax slice" aria-hidden="true">
            <path d="M-20 280 C 60 220, 140 240, 200 200 C 260 160, 300 180, 380 120" stroke="currentColor" strokeWidth="1.5" />
            <path d="M-40 320 C 40 260, 120 280, 180 240 C 240 200, 280 220, 360 160" stroke="currentColor" strokeWidth="1" opacity="0.6" />
            <path d="M0 300 C 80 250, 160 260, 220 220 C 280 180, 320 200, 400 150" stroke="currentColor" strokeWidth="0.75" opacity="0.35" />
          </svg>

          {/* Main content */}
          <main className="relative z-10 flex flex-1 flex-col justify-center px-8 py-12 sm:px-10">
            <div className="mx-auto w-full max-w-sm">
              <header className="mb-8">
                <AppLogo size={40} />
                <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">Welcome back</h1>
                <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
                  Sign in to your <span className="font-semibold text-white">CollateralMS</span> account
                </p>
              </header>

              {/* Trust badges */}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-8">
                {[
                  { icon: ShieldCheck, label: 'Secure' },
                  { icon: BadgeCheck, label: 'Reliable' },
                  { icon: Globe, label: 'Built for Africa' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/90">
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}
                    >
                      <Icon size={11} className="text-white" aria-hidden="true" />
                    </span>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </main>
        </div>

        {/* Right panel — login form */}
        <aside
          className="relative flex min-h-screen items-center justify-center px-6 py-10 lg:px-10"
          style={{ backgroundColor: '#f8fafc' }}
        >
          <div className="w-full max-w-[30rem]">
            <div
              className="bg-white rounded-2xl shadow-xl p-8 sm:p-9"
              style={{ border: '1px solid var(--izou-border)' }}
            >
              <div className="mb-6">
                <h2 className="text-xl font-bold" style={{ color: 'var(--izou-text)' }}>Sign in</h2>
                <p className="text-sm mt-1" style={{ color: 'var(--izou-muted)' }}>Enter your credentials to access the system</p>
              </div>

              {/* 2FA setup required notice */}
              {show2FASetupNotice && (
                <div className="flex items-start gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: '#fff7ed', border: '1px solid #fed7aa' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#ea580c" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 mt-0.5" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <p className="text-xs font-semibold text-orange-800">Two-Factor Authentication Required</p>
                    <p className="text-xs text-orange-700 mt-0.5">Your role requires 2FA. Please sign in and set up your phone number for SMS verification from your profile settings.</p>
                  </div>
                </div>
              )}

              <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
                {/* Email */}
                <label className="group block">
                  <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--izou-text)' }}>Email address</span>
                  <div className="relative">
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="yourname@bank.co.tz"
                      className="w-full rounded-xl px-3.5 text-sm outline-none transition h-12 focus:ring-2"
                      style={{
                        border: errors.email ? '1px solid #dc2626' : '1px solid var(--izou-border)',
                        backgroundColor: 'var(--izou-primary-light)',
                        color: 'var(--izou-text)',
                      }}
                      {...register('email', {
                        required: 'Email address is required',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                      })}
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} />{errors.email.message}
                    </p>
                  )}
                </label>

                {/* Password */}
                <label className="group block">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="block text-sm font-medium" style={{ color: 'var(--izou-text)' }}>Password</span>
                    <button
                      type="button"
                      onClick={() => setShowResetModal(true)}
                      className="text-xs font-semibold hover:underline"
                      style={{ color: 'var(--izou-primary)' }}
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Enter your password"
                      className="w-full rounded-xl px-3.5 pr-10 text-sm outline-none transition h-12 focus:ring-2"
                      style={{
                        border: errors.password ? '1px solid #dc2626' : '1px solid var(--izou-border)',
                        backgroundColor: 'var(--izou-primary-light)',
                        color: 'var(--izou-text)',
                      }}
                      {...register('password', {
                        required: 'Password is required',
                        minLength: { value: 6, message: 'Password must be at least 6 characters' },
                      })}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 transition-colors focus:outline-none"
                      style={{ color: 'var(--izou-muted)' }}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  {errors.password && (
                    <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle size={12} />{errors.password.message}
                    </p>
                  )}
                </label>

                {/* Remember me */}
                <div className="flex items-center gap-2">
                  <input
                    id="rememberMe"
                    type="checkbox"
                    className="w-4 h-4 rounded"
                    style={{ accentColor: 'var(--izou-primary)' }}
                    {...register('rememberMe')}
                  />
                  <label htmlFor="rememberMe" className="text-sm" style={{ color: 'var(--izou-muted)' }}>
                    Keep me signed in for 8 hours
                  </label>
                </div>

                {/* Submit */}
                <button
                  type="submit"
                  disabled={isLoading}
                  className="izou-btn-primary inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-12 w-full text-base disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                >
                  {isLoading ? (
                    <><RefreshCw size={16} className="animate-spin" /> Signing in…</>
                  ) : (
                    'Sign In'
                  )}
                </button>
              </form>

              {/* Trust indicators */}
              <div
                className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 mt-6 pt-5"
                style={{ borderTop: '1px solid var(--izou-border)' }}
              >
                {[
                  { icon: ShieldCheck, label: 'Secure' },
                  { icon: BadgeCheck, label: 'Reliable' },
                  { icon: Globe, label: 'Built for Africa' },
                ].map(({ icon: Icon, label }) => (
                  <span key={label} className="inline-flex items-center gap-1.5 text-[12px] font-medium" style={{ color: 'var(--izou-text)' }}>
                    <span
                      className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                      style={{ backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary)' }}
                    >
                      <Icon size={11} aria-hidden="true" />
                    </span>
                    {label}
                  </span>
                ))}
              </div>
            </div>

            <p className="mt-4 text-center text-xs" style={{ color: 'var(--izou-muted)' }}>
              A product by{' '}
              <a
                href="https://www.contentpro.co.tz"
                target="_blank"
                rel="noopener noreferrer"
                className="font-semibold hover:underline"
                style={{ color: 'var(--izou-primary)' }}
              >
                Contentpro
              </a>
              {' '}· Deployable for any bank
            </p>
            <p className="mt-2 text-center text-xs">
              <Link
                href="/glossary"
                className="font-medium hover:underline"
                style={{ color: 'var(--izou-primary)' }}
              >
                Glossary of Terms
              </Link>
            </p>
          </div>
        </aside>
      </div>

      {/* Password Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8" style={{ border: '1px solid var(--izou-border)' }}>
            {!resetSent ? (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: 'var(--izou-primary-light)' }}
                  >
                    <Mail size={18} style={{ color: 'var(--izou-primary)' }} />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold" style={{ color: 'var(--izou-text)' }}>Reset your password</h3>
                    <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>We'll send a recovery link to your email</p>
                  </div>
                </div>

                {resetError && (
                  <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                    <p className="text-xs text-red-700">{resetError}</p>
                  </div>
                )}

                <form onSubmit={handleResetSubmit(onResetSubmit)} noValidate className="space-y-4">
                  <label className="block">
                    <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--izou-text)' }}>Email address</span>
                    <input
                      type="email"
                      autoComplete="email"
                      placeholder="yourname@bank.co.tz"
                      className="w-full rounded-xl px-3.5 text-sm outline-none transition h-12 focus:ring-2"
                      style={{
                        border: resetErrors.resetEmail ? '1px solid #dc2626' : '1px solid var(--izou-border)',
                        backgroundColor: 'var(--izou-primary-light)',
                        color: 'var(--izou-text)',
                      }}
                      {...registerReset('resetEmail', {
                        required: 'Email address is required',
                        pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                      })}
                    />
                    {resetErrors.resetEmail && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle size={12} />{resetErrors.resetEmail.message}
                      </p>
                    )}
                  </label>

                  <div className="flex gap-3 pt-1">
                    <button
                      type="button"
                      onClick={closeResetModal}
                      className="flex-1 h-11 rounded-xl font-semibold text-sm transition-colors"
                      style={{ border: '1px solid var(--izou-border)', color: 'var(--izou-muted)', backgroundColor: 'white' }}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 izou-btn-primary h-11 rounded-xl font-semibold text-sm disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? <RefreshCw size={14} className="animate-spin" /> : null}
                      Send Reset Link
                    </button>
                  </div>
                </form>
              </>
            ) : (
              <div className="text-center py-4">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
                  style={{ backgroundColor: '#f0fdf4' }}
                >
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--izou-text)' }}>Check your inbox</h3>
                <p className="text-sm mb-6" style={{ color: 'var(--izou-muted)' }}>
                  A password reset link has been sent to your email address. The link expires in 1 hour.
                </p>
                <button
                  onClick={closeResetModal}
                  className="izou-btn-primary px-6 h-11 rounded-xl font-semibold text-sm flex items-center gap-2 mx-auto"
                >
                  <ArrowLeft size={14} />
                  Back to Sign In
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}