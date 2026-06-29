'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Copy, CheckCircle2, AlertCircle, Smartphone, RefreshCw } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

interface LoginFormData {
  email: string;
  password: string;
  rememberMe: boolean;
}

const mockCredentials = [
  {
    role: 'Credit Officer',
    email: 'j.kamau@eximbank.co.tz',
    password: 'CreditOfficer@2026',
    initials: 'JK',
    description: 'Create & edit collateral records',
  },
  {
    role: 'Legal Officer',
    email: 'a.mwangi@eximbank.co.tz',
    password: 'LegalOfficer@2026',
    initials: 'AM',
    description: 'Approve & manage perfection workflows',
  },
  {
    role: 'System Admin',
    email: 'admin@eximbank.co.tz',
    password: 'SysAdmin@2026',
    initials: 'SA',
    description: 'Full system control & user management',
  },
];

export default function LoginForm() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  // 2FA state
  const [twoFARequired, setTwoFARequired] = useState(false);
  const [pendingUser, setPendingUser] = useState<any>(null);
  const [otp, setOtp] = useState('');
  const [otpId, setOtpId] = useState<string | null>(null);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<LoginFormData>({
    defaultValues: { rememberMe: false },
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    try {
      const result = await signIn(data.email, data.password);
      const supabase = createClient();

      // Check if 2FA is enabled for this user
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('two_fa_enabled, phone, full_name')
        .eq('id', result.user?.id)
        .single();

      if (profile?.two_fa_enabled && profile?.phone) {
        // Sign out temporarily and require 2FA
        await supabase.auth.signOut();
        setPendingUser({ ...result.user, email: data.email, password: data.password, phone: profile.phone, name: profile.full_name });
        await sendOTP(profile.phone, result.user?.id);
        setTwoFARequired(true);
        setIsLoading(false);
        return;
      }

      const cred = mockCredentials.find((c) => c.email === data.email);
      toast.success(`Welcome back${cred ? ` — signed in as ${cred.role}` : ''}`);
      router.push('/collateral-dashboard');
      router.refresh();
    } catch (err: any) {
      setIsLoading(false);
      toast.error(err?.message ?? 'Invalid credentials — please try again');
    }
  };

  const sendOTP = async (phone: string, userId?: string) => {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
    const supabase = createClient();

    const { data: otpRow } = await supabase
      .from('otp_verifications')
      .insert({ user_id: userId, phone, otp_code: code, expires_at: expiresAt })
      .select()
      .single();

    setOtpId(otpRow?.id ?? null);

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
  };

  const verifyOTP = async () => {
    if (!otp || otp.length !== 6) { setOtpError('Enter the 6-digit code'); return; }
    setOtpLoading(true);
    setOtpError(null);
    try {
      const supabase = createClient();
      const { data: otpRow } = await supabase.from('otp_verifications').select('*').eq('id', otpId).single();
      if (!otpRow) throw new Error('OTP not found');
      if (new Date(otpRow.expires_at) < new Date()) throw new Error('OTP expired. Please sign in again.');
      if (otpRow.otp_code !== otp) {
        await supabase.from('otp_verifications').update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq('id', otpId);
        throw new Error('Invalid code');
      }
      await supabase.from('otp_verifications').update({ verified_at: new Date().toISOString() }).eq('id', otpId);

      // Re-sign in
      await signIn(pendingUser.email, pendingUser.password);
      toast.success('Welcome back — 2FA verified');
      router.push('/collateral-dashboard');
      router.refresh();
    } catch (err: any) {
      setOtpError(err?.message ?? 'Verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  const autofill = (email: string, password: string) => {
    setValue('email', email);
    setValue('password', password);
    toast.info('Credentials autofilled — click Sign In to continue');
  };

  const copyToClipboard = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(key);
    setTimeout(() => setCopiedField(null), 2000);
  };

  // 2FA verification screen
  if (twoFARequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm">
          <div className="text-center mb-6">
            <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
              <Smartphone size={24} className="text-primary" />
            </div>
            <h2 className="text-xl font-bold text-foreground">Two-Factor Verification</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Enter the 6-digit code sent to <strong>{pendingUser?.phone}</strong>
            </p>
          </div>

          {otpError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
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
              className="w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border border-border rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={verifyOTP}
              disabled={otpLoading || otp.length !== 6}
              className="w-full py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {otpLoading ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
              Verify & Sign In
            </button>
            <div className="flex items-center justify-between text-sm">
              <button onClick={() => { setTwoFARequired(false); setPendingUser(null); setOtp(''); }} className="text-muted-foreground hover:text-foreground">
                ← Back to login
              </button>
              {countdown > 0 ? (
                <p className="text-muted-foreground">Resend in {countdown}s</p>
              ) : (
                <button onClick={() => sendOTP(pendingUser?.phone)} className="text-primary hover:underline">Resend code</button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex">
      {/* Left branding panel */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 bg-primary flex-col justify-between p-10 relative overflow-hidden">
        {/* Background pattern */}
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-20 left-10 w-64 h-64 border border-white rounded-full" />
          <div className="absolute top-10 left-32 w-96 h-96 border border-white rounded-full" />
          <div className="absolute bottom-20 right-10 w-48 h-48 border border-white rounded-full" />
          <div className="absolute bottom-40 right-20 w-72 h-72 border border-white rounded-full" />
        </div>

        {/* Logo */}
        <div className="relative z-10 flex items-center gap-3">
          <AppLogo size={40} />
          <div>
            <p className="text-white font-700 text-lg leading-tight">CollateralMS</p>
            <p className="text-white/60 text-sm">EXIM Bank Tanzania</p>
          </div>
        </div>

        {/* Hero content */}
        <div className="relative z-10">
          <h1 className="text-3xl xl:text-4xl font-700 text-white leading-tight mb-4">
            Collateral Lifecycle
            <br />
            Management Platform
          </h1>
          <p className="text-white/70 text-base leading-relaxed mb-8 max-w-sm">
            Automate perfection tracking, enforce BRELA 42-day submission rules,
            and maintain a complete audit trail across all collateral types.
          </p>

          <div className="space-y-3">
            {[
              'Automated BRELA & Lands Registry submission tracking',
              'Real-time perfection status across mortgages, debentures & shares',
              'Integrated with TRA, DSE, and TASAC registries',
              'Role-based access for Credit Officers and Legal teams',
            ].map((feature) => (
              <div key={`feat-${feature.slice(0, 20)}`} className="flex items-start gap-2">
                <CheckCircle2 size={16} className="text-accent mt-0.5 shrink-0" />
                <p className="text-white/80 text-sm">{feature}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10">
          <p className="text-white/40 text-xs">
            © 2026 EXIM Bank Tanzania · Ghana Avenue, Dar es Salaam
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 bg-background overflow-y-auto py-10">
        <div className="flex items-center gap-2 mb-8 lg:hidden">
          <AppLogo size={32} />
          <span className="font-700 text-primary text-lg">CollateralMS</span>
        </div>

        <div className="w-full max-w-md">
          <div className="mb-8">
            <h2 className="text-2xl font-700 text-foreground mb-1">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">
              Enter your EXIM Bank credentials to access the collateral management system.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-500 text-foreground mb-1.5">Email address</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="yourname@eximbank.co.tz"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.email ? 'border-destructive focus:ring-destructive/30' : 'border-border hover:border-primary/40'}`}
                {...register('email', {
                  required: 'Email address is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                })}
              />
              {errors.email && <p className="mt-1.5 text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{errors.email.message}</p>}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="password" className="block text-sm font-500 text-foreground">Password</label>
                <button type="button" className="text-xs text-primary hover:underline">Forgot password?</button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className={`w-full px-3 py-2.5 pr-10 rounded-md border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${errors.password ? 'border-destructive focus:ring-destructive/30' : 'border-border hover:border-primary/40'}`}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: { value: 6, message: 'Password must be at least 6 characters' },
                  })}
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && <p className="mt-1.5 text-xs text-destructive flex items-center gap-1"><AlertCircle size={12} />{errors.password.message}</p>}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input id="rememberMe" type="checkbox" className="w-4 h-4 rounded border-border accent-primary" {...register('rememberMe')} />
              <label htmlFor="rememberMe" className="text-sm text-muted-foreground">Keep me signed in for 8 hours</label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2.5 bg-primary text-white font-600 rounded-md text-sm hover:bg-primary/90 transition-all active:scale-[0.98] disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <><RefreshCw size={16} className="animate-spin" /> Signing in…</>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 h-px bg-border" />
              <p className="text-xs text-muted-foreground font-500">Demo Credentials</p>
              <div className="flex-1 h-px bg-border" />
            </div>
            <div className="space-y-2">
              {mockCredentials.map((cred) => (
                <div key={cred.role} className="flex items-center gap-3 p-3 bg-muted/40 rounded-lg border border-border/50 hover:border-primary/30 transition-colors">
                  <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                    <span className="text-white text-xs font-700">{cred.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-600 text-foreground">{cred.role}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{cred.email}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => copyToClipboard(cred.password, `${cred.role}-pw`)} className="p-1.5 rounded hover:bg-muted transition-colors" title="Copy password">
                      {copiedField === `${cred.role}-pw` ? <CheckCircle2 size={13} className="text-green-600" /> : <Copy size={13} className="text-muted-foreground" />}
                    </button>
                    <button onClick={() => autofill(cred.email, cred.password)} className="px-2 py-1 text-[10px] font-600 bg-primary/10 text-primary rounded hover:bg-primary/20 transition-colors">
                      Use
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}