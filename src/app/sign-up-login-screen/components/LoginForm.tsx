'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Eye, EyeOff, Copy, CheckCircle2, AlertCircle } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { useAuth } from '@/contexts/AuthContext';

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
      await signIn(data.email, data.password);
      const cred = mockCredentials.find((c) => c.email === data.email);
      toast.success(`Welcome back${cred ? ` — signed in as ${cred.role}` : ''}`);
      router.push('/collateral-dashboard');
      router.refresh();
    } catch (err: any) {
      toast.error(err?.message ?? 'Invalid credentials — please try again');
    } finally {
      setIsLoading(false);
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

          {/* Feature highlights */}
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

        {/* Footer */}
        <div className="relative z-10">
          <p className="text-white/40 text-xs">
            © 2026 EXIM Bank Tanzania · Ghana Avenue, Dar es Salaam
          </p>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex flex-col justify-center px-6 sm:px-12 lg:px-16 xl:px-20 bg-background overflow-y-auto py-10">
        {/* Mobile logo */}
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
              <label
                htmlFor="email"
                className="block text-sm font-500 text-foreground mb-1.5"
              >
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="yourname@eximbank.co.tz"
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                  errors.email
                    ? 'border-destructive focus:ring-destructive/30' :'border-border hover:border-primary/40'
                }`}
                {...register('email', {
                  required: 'Email address is required',
                  pattern: {
                    value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                    message: 'Enter a valid email address',
                  },
                })}
              />
              {errors.email && (
                <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.email.message}
                </p>
              )}
            </div>

            {/* Password */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label
                  htmlFor="password"
                  className="block text-sm font-500 text-foreground"
                >
                  Password
                </label>
                <button
                  type="button"
                  className="text-xs text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="••••••••••••"
                  className={`w-full px-3 py-2.5 pr-10 rounded-md border text-sm bg-white transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                    errors.password
                      ? 'border-destructive focus:ring-destructive/30' :'border-border hover:border-primary/40'
                  }`}
                  {...register('password', {
                    required: 'Password is required',
                    minLength: {
                      value: 6,
                      message: 'Password must be at least 6 characters',
                    },
                  })}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                  <AlertCircle size={12} />
                  {errors.password.message}
                </p>
              )}
            </div>

            {/* Remember me */}
            <div className="flex items-center gap-2">
              <input
                id="rememberMe"
                type="checkbox"
                className="w-4 h-4 rounded border-border accent-primary"
                {...register('rememberMe')}
              />
              <label htmlFor="rememberMe" className="text-sm text-muted-foreground">
                Keep me signed in for 8 hours
              </label>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white text-sm font-600 rounded-md hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-all duration-150 active:scale-[0.98]"
              style={{ minHeight: '42px' }}
            >
              {isLoading ? (
                <>
                  <svg
                    className="animate-spin w-4 h-4"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8v8H4z"
                    />
                  </svg>
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Demo credentials */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-px bg-border" />
              <p className="text-xs text-muted-foreground font-500 px-2">
                Demo accounts — click to autofill
              </p>
              <div className="flex-1 h-px bg-border" />
            </div>

            <div className="border border-border rounded-lg overflow-hidden">
              <div className="bg-muted px-3 py-2 border-b border-border">
                <div className="grid grid-cols-3 gap-2">
                  <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Role</p>
                  <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Email</p>
                  <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Password</p>
                </div>
              </div>
              {mockCredentials.map((cred) => (
                <div
                  key={`cred-${cred.role}`}
                  onClick={() => autofill(cred.email, cred.password)}
                  className="px-3 py-2.5 border-b border-border last:border-0 hover:bg-primary/5 cursor-pointer transition-colors group"
                >
                  <div className="grid grid-cols-3 gap-2 items-center">
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center shrink-0">
                        <span className="text-white text-[9px] font-700">{cred.initials}</span>
                      </div>
                      <span className="text-xs font-500 text-foreground truncate">{cred.role}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        {cred.email}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(cred.email, `email-${cred.role}`);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Copy email"
                      >
                        {copiedField === `email-${cred.role}` ? (
                          <CheckCircle2 size={11} className="text-accent" />
                        ) : (
                          <Copy size={11} className="text-muted-foreground" />
                        )}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-muted-foreground font-mono truncate">
                        {cred.password}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(cred.password, `pw-${cred.role}`);
                        }}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                        aria-label="Copy password"
                      >
                        {copiedField === `pw-${cred.role}` ? (
                          <CheckCircle2 size={11} className="text-accent" />
                        ) : (
                          <Copy size={11} className="text-muted-foreground" />
                        )}
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5 pl-7">{cred.description}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="text-xs text-muted-foreground text-center mt-6">
            Having trouble? Contact{' '}
            <a
              href="mailto:it.support@eximbank.co.tz"
              className="text-primary hover:underline"
            >
              it.support@eximbank.co.tz
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}