'use client';
import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, RefreshCw, CheckCircle2, AlertCircle, ShieldCheck } from 'lucide-react';
import AppLogo from '@/components/ui/AppLogo';
import { createClient } from '@/lib/supabase/client';

interface ResetPasswordFormData {
  password: string;
  confirmPassword: string;
}

export default function ResetPasswordPage() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ResetPasswordFormData>();

  const password = watch('password');

  const onSubmit = async (data: ResetPasswordFormData) => {
    setIsLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: data.password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => router.push('/sign-up-login-screen'), 3000);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to update password. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen grid lg:grid-cols-[minmax(0,42%)_minmax(0,58%)]"
    >
      {/* Left panel */}
      <div
        className="relative flex min-h-screen flex-col overflow-hidden"
        style={{
          background: 'linear-gradient(155deg, #007CB3 0%, #008FBE 28%, #00A9E0 58%, #1AB8E6 82%, #35C8F3 100%)'
        }}
      >
        <div className="pointer-events-none absolute -left-16 top-0 h-72 w-72 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(255,255,255,0.08)' }} />
        <div className="pointer-events-none absolute bottom-0 right-0 h-64 w-64 rounded-full blur-3xl" style={{ backgroundColor: 'rgba(53,200,243,0.2)' }} />
        <div className="relative z-10 flex flex-1 flex-col justify-center px-8 py-12 sm:px-10">
          <div className="mx-auto w-full max-w-sm">
            <AppLogo size={40} />
            <h1 className="mt-5 text-2xl font-bold tracking-tight text-white sm:text-[1.75rem]">Account Recovery</h1>
            <p className="mt-1.5 text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.75)' }}>
              Set a new password for your <span className="font-semibold text-white">CollateralMS</span> account
            </p>
            <div className="flex items-center gap-2 mt-8">
              <span className="inline-flex items-center gap-1.5 text-[12px] font-medium text-white/90">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
                  <ShieldCheck size={11} className="text-white" />
                </span>
                Secure password reset
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Right panel */}
      <aside
        className="relative flex min-h-screen items-center justify-center px-6 py-10 lg:px-10"
        style={{ backgroundColor: '#f8fafc' }}
      >
        <div className="w-full max-w-[30rem]">
          <div
            className="bg-white rounded-2xl shadow-xl p-8 sm:p-9"
            style={{ border: '1px solid var(--izou-border)' }}
          >
            {success ? (
              <div className="text-center py-4">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: '#f0fdf4' }}>
                  <CheckCircle2 size={28} className="text-green-600" />
                </div>
                <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--izou-text)' }}>Password Updated</h2>
                <p className="text-sm" style={{ color: 'var(--izou-muted)' }}>
                  Your password has been changed successfully. Redirecting you to sign in…
                </p>
              </div>
            ) : (
              <>
                <div className="mb-6">
                  <h2 className="text-xl font-bold" style={{ color: 'var(--izou-text)' }}>Set new password</h2>
                  <p className="text-sm mt-1" style={{ color: 'var(--izou-muted)' }}>Choose a strong password for your account</p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
                    <AlertCircle size={14} className="text-red-600 shrink-0" />
                    <p className="text-xs text-red-700">{error}</p>
                  </div>
                )}

                <form onSubmit={handleSubmit(onSubmit)} noValidate className="grid gap-4">
                  {/* New password */}
                  <label className="block">
                    <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--izou-text)' }}>New password</span>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Minimum 8 characters"
                        className="w-full rounded-xl px-3.5 pr-10 text-sm outline-none transition h-12 focus:ring-2"
                        style={{
                          border: errors.password ? '1px solid #dc2626' : '1px solid var(--izou-border)',
                          backgroundColor: 'var(--izou-primary-light)',
                          color: 'var(--izou-text)',
                        }}
                        {...register('password', {
                          required: 'Password is required',
                          minLength: { value: 8, message: 'Password must be at least 8 characters' },
                          pattern: {
                            value: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                            message: 'Must include uppercase, lowercase, and a number',
                          },
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5"
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

                  {/* Confirm password */}
                  <label className="block">
                    <span className="block text-sm font-medium mb-1.5" style={{ color: 'var(--izou-text)' }}>Confirm new password</span>
                    <div className="relative">
                      <input
                        type={showConfirm ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Re-enter your password"
                        className="w-full rounded-xl px-3.5 pr-10 text-sm outline-none transition h-12 focus:ring-2"
                        style={{
                          border: errors.confirmPassword ? '1px solid #dc2626' : '1px solid var(--izou-border)',
                          backgroundColor: 'var(--izou-primary-light)',
                          color: 'var(--izou-text)',
                        }}
                        {...register('confirmPassword', {
                          required: 'Please confirm your password',
                          validate: (value) => value === password || 'Passwords do not match',
                        })}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5"
                        style={{ color: 'var(--izou-muted)' }}
                        aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      >
                        {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="mt-1.5 text-xs text-red-600 flex items-center gap-1">
                        <AlertCircle size={12} />{errors.confirmPassword.message}
                      </p>
                    )}
                  </label>

                  <button
                    type="submit"
                    disabled={isLoading}
                    className="izou-btn-primary inline-flex items-center justify-center gap-2 rounded-xl font-semibold h-12 w-full text-base disabled:opacity-50 disabled:cursor-not-allowed mt-1"
                  >
                    {isLoading ? (
                      <><RefreshCw size={16} className="animate-spin" /> Updating…</>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
