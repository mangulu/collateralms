'use client';
import React, { useState, useEffect } from 'react';
import { Shield, Smartphone, CheckCircle2, AlertCircle, RefreshCw, Lock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

interface TwoFASetupProps {
  onVerified?: () => void;
  mode?: 'setup' | 'verify';
}

export default function TwoFASetup({ onVerified, mode = 'setup' }: TwoFASetupProps) {
  const { user, userProfile } = useAuth();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [step, setStep] = useState<'phone' | 'otp' | 'done'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [otpId, setOtpId] = useState<string | null>(null);

  useEffect(() => {
    if (userProfile?.phone) setPhone(userProfile.phone);
    if (userProfile?.two_fa_enabled) setStep('done');
  }, [userProfile]);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  const sendOTP = async () => {
    if (!phone.trim()) { setError('Please enter a valid phone number'); return; }
    setLoading(true);
    setError(null);
    try {
      // Generate 6-digit OTP
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min

      const supabase = createClient();

      // Store OTP in DB
      const { data: otpRow, error: dbErr } = await supabase
        .from('otp_verifications')
        .insert({
          user_id: user?.id,
          phone: phone.trim(),
          otp_code: code,
          expires_at: expiresAt,
        })
        .select()
        .single();

      if (dbErr) throw new Error(dbErr.message);
      setOtpId(otpRow.id);

      // Send via Twilio API route
      const smsRes = await fetch('/api/sms/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: phone.trim(),
          message: `[CollateralMS] Your verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
          alertType: 'APPROVAL_REQUEST',
        }),
      });

      const smsData = await smsRes.json();
      if (!smsRes.ok || !smsData.success) {
        // For demo: show OTP in toast if Twilio not configured
        toast.info(`Demo mode: Your OTP is ${code}`, { duration: 30000 });
      } else {
        toast.success('OTP sent to your phone');
      }

      setStep('otp');
      setCountdown(60);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const verifyOTP = async () => {
    if (!otp.trim() || otp.length !== 6) { setError('Enter the 6-digit code'); return; }
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Fetch OTP record
      const { data: otpRow, error: fetchErr } = await supabase
        .from('otp_verifications')
        .select('*')
        .eq('id', otpId)
        .single();

      if (fetchErr || !otpRow) throw new Error('OTP record not found');
      if (new Date(otpRow.expires_at) < new Date()) throw new Error('OTP has expired. Please request a new one.');
      if (otpRow.attempts >= 3) throw new Error('Too many failed attempts. Please request a new OTP.');
      if (otpRow.otp_code !== otp.trim()) {
        await supabase.from('otp_verifications').update({ attempts: (otpRow.attempts ?? 0) + 1 }).eq('id', otpId);
        throw new Error('Invalid code. Please try again.');
      }

      // Mark verified
      await supabase.from('otp_verifications').update({ verified_at: new Date().toISOString() }).eq('id', otpId);

      // Update user profile
      await supabase.from('user_profiles').update({
        phone: phone.trim(),
        two_fa_enabled: true,
        two_fa_verified_at: new Date().toISOString(),
      }).eq('id', user?.id);

      setStep('done');
      toast.success('Two-factor authentication enabled!');
      onVerified?.();
    } catch (err: any) {
      setError(err?.message ?? 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    const supabase = createClient();
    await supabase.from('user_profiles').update({ two_fa_enabled: false }).eq('id', user?.id);
    setStep('phone');
    toast.success('Two-factor authentication disabled');
  };

  if (step === 'done') {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-5">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <Shield size={18} className="text-green-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-green-800">Two-Factor Authentication Active</p>
            <p className="text-xs text-green-600">Your account is protected with SMS verification</p>
          </div>
        </div>
        <p className="text-xs text-green-700 mb-3">Phone: <strong>{userProfile?.phone || phone}</strong></p>
        <button onClick={disable2FA} className="text-xs text-red-600 hover:underline">Disable 2FA</button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-border rounded-xl p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Lock size={18} className="text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">Two-Factor Authentication</p>
          <p className="text-xs text-muted-foreground">Add an extra layer of security via SMS</p>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertCircle size={14} className="text-red-600 shrink-0" />
          <p className="text-xs text-red-700">{error}</p>
        </div>
      )}

      {step === 'phone' && (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Mobile Phone Number</label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+255 7XX XXX XXX"
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              <button
                onClick={sendOTP}
                disabled={loading || !phone.trim()}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <Smartphone size={14} />}
                Send OTP
              </button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">A 6-digit code will be sent to this number via SMS.</p>
        </div>
      )}

      {step === 'otp' && (
        <div className="space-y-3">
          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-700">Code sent to <strong>{phone}</strong>. Valid for 10 minutes.</p>
          </div>
          <div>
            <label className="text-xs font-medium text-foreground mb-1 block">Enter 6-Digit Code</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 font-mono tracking-widest text-center text-lg"
              />
              <button
                onClick={verifyOTP}
                disabled={loading || otp.length !== 6}
                className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 flex items-center gap-1.5"
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Verify
              </button>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <button onClick={() => setStep('phone')} className="text-xs text-muted-foreground hover:text-foreground">← Change number</button>
            {countdown > 0 ? (
              <p className="text-xs text-muted-foreground">Resend in {countdown}s</p>
            ) : (
              <button onClick={sendOTP} disabled={loading} className="text-xs text-primary hover:underline">Resend code</button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
