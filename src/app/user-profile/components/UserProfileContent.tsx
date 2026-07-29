'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { User, Shield, Key, Bell, Save, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff, Lock, Mail, Phone, BadgeCheck, ShieldCheck, ShieldOff, Info, Smartphone,  } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, getRoleLabel } from '@/lib/rbac';
import { createClient } from '@/lib/supabase/client';
import TwoFASetup from '@/components/TwoFASetup';
import { toast } from 'sonner';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'overview' | 'security' | 'credentials' | 'preferences';

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Profile & Role', icon: <User size={15} /> },
  { id: 'security', label: '2FA & Security', icon: <Shield size={15} /> },
  { id: 'credentials', label: 'Credentials', icon: <Key size={15} /> },
  { id: 'preferences', label: 'Preferences', icon: <Bell size={15} /> },
];

// ─── Role badge colours ───────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  system_admin: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  credit_officer: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  legal_officer: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
};

function getRoleBadge(role: string) {
  return ROLE_BADGE[role] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
}

// ─── Permission pill ──────────────────────────────────────────────────────────

function PermissionPill({ label }: { label: string }) {
  const pretty = label.replace(/\./g, ' › ').replace(/_/g, ' ');
  return (
    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary/8 text-primary border border-primary/15">
      <CheckCircle2 size={10} className="shrink-0" />
      {pretty}
    </span>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
        checked ? 'bg-primary' : 'bg-gray-200'
      }`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserProfileContent() {
  const { user, userProfile, getUserProfile } = useAuth();
  const { permissions, role, loading: permsLoading } = usePermissions();
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<Tab>('overview');

  // ── Profile form state ────────────────────────────────────────────────────
  const [fullName, setFullName] = useState('');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  // ── Credential form state ─────────────────────────────────────────────────
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [credSaving, setCredSaving] = useState(false);
  const [credError, setCredError] = useState<string | null>(null);

  // ── Preferences state ─────────────────────────────────────────────────────
  const [prefEmailAlerts, setPrefEmailAlerts] = useState(true);
  const [prefSmsAlerts, setPrefSmsAlerts] = useState(false);
  const [prefDeadlineReminders, setPrefDeadlineReminders] = useState(true);
  const [prefApprovalNotifs, setPrefApprovalNotifs] = useState(true);
  const [prefSaving, setPrefSaving] = useState(false);
  const [prefSaved, setPrefSaved] = useState(false);

  // ── Load profile data ─────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name, notification_preferences')
        .eq('id', user.id)
        .single();
      if (data) {
        setFullName(data.full_name ?? '');
        const prefs = data.notification_preferences as Record<string, boolean> | null;
        if (prefs) {
          if (typeof prefs.email_alerts === 'boolean') setPrefEmailAlerts(prefs.email_alerts);
          if (typeof prefs.sms_alerts === 'boolean') setPrefSmsAlerts(prefs.sms_alerts);
          if (typeof prefs.deadline_reminders === 'boolean') setPrefDeadlineReminders(prefs.deadline_reminders);
          if (typeof prefs.approval_notifications === 'boolean') setPrefApprovalNotifs(prefs.approval_notifications);
        }
      }
    } catch {
      // silent
    }
  }, [user, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  // ── Save profile ──────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!user) return;
    setProfileSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id);
      if (error) throw error;
      setProfileSaved(true);
      toast.success('Profile updated successfully');
      setTimeout(() => setProfileSaved(false), 3000);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save profile');
    } finally {
      setProfileSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────
  const changePassword = async () => {
    setCredError(null);
    if (!newPassword || newPassword.length < 8) {
      setCredError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setCredError('Passwords do not match');
      return;
    }
    setCredSaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password changed successfully');
    } catch (err: any) {
      setCredError(err?.message ?? 'Failed to change password');
    } finally {
      setCredSaving(false);
    }
  };

  // ── Save preferences ──────────────────────────────────────────────────────
  const savePreferences = async () => {
    if (!user) return;
    setPrefSaving(true);
    try {
      const prefs = {
        email_alerts: prefEmailAlerts,
        sms_alerts: prefSmsAlerts,
        deadline_reminders: prefDeadlineReminders,
        approval_notifications: prefApprovalNotifs,
      };
      const { error } = await supabase
        .from('user_profiles')
        .update({ notification_preferences: prefs })
        .eq('id', user.id);
      if (error) throw error;
      setPrefSaved(true);
      toast.success('Preferences saved');
      setTimeout(() => setPrefSaved(false), 3000);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save preferences');
    } finally {
      setPrefSaving(false);
    }
  };

  // ── Derived display values ────────────────────────────────────────────────
  const displayEmail = user?.email ?? '—';
  const displayRole = role ?? userProfile?.role ?? '';
  const roleLabel = displayRole ? getRoleLabel(displayRole) : 'No role assigned';
  const roleBadge = getRoleBadge(displayRole);
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : displayEmail.slice(0, 2).toUpperCase();
  const permList = Array.from(permissions).sort();
  const twoFaEnabled = userProfile?.two_fa_enabled ?? false;

  const inputBase =
    'w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* ── Page header ── */}
      <div className="px-6 pt-6 pb-4 shrink-0">
        <div className="flex items-center gap-3 mb-1">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'var(--izou-primary)', opacity: 0.9 }}
          >
            <User size={20} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">My Profile</h1>
            <p className="text-sm text-muted-foreground">Manage your account, security, and preferences</p>
          </div>
        </div>
      </div>

      {/* ── Tab bar ── */}
      <div className="px-6 shrink-0" style={{ borderBottom: '1px solid var(--izou-border)' }}>
        <div className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium rounded-t-lg transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'text-primary border-b-2 border-primary bg-primary/5' :'text-muted-foreground hover:text-foreground hover:bg-muted/40'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Tab content ── */}
      <div className="flex-1 overflow-y-auto px-6 py-6">

        {/* ══ OVERVIEW TAB ══ */}
        {activeTab === 'overview' && (
          <div className="max-w-2xl space-y-6">
            {/* Avatar + role card */}
            <div
              className="rounded-xl p-5 flex items-center gap-5"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <div
                className="w-16 h-16 rounded-2xl flex items-center justify-center shrink-0 text-white text-xl font-bold"
                style={{ background: 'var(--izou-primary)' }}
              >
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-base font-semibold text-foreground truncate">{fullName || displayEmail}</p>
                <p className="text-sm text-muted-foreground truncate">{displayEmail}</p>
                <div className="mt-2 flex items-center gap-2 flex-wrap">
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${roleBadge.bg} ${roleBadge.text} ${roleBadge.border}`}
                  >
                    <BadgeCheck size={11} />
                    {roleLabel}
                  </span>
                  {twoFaEnabled ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700 border border-green-200">
                      <ShieldCheck size={11} />
                      2FA Active
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-orange-50 text-orange-700 border border-orange-200">
                      <ShieldOff size={11} />
                      2FA Not Set
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Edit display name */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <h2 className="text-sm font-semibold text-foreground">Display Name</h2>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Full Name</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Enter your full name"
                  className={inputBase}
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email Address</label>
                <div className="flex items-center gap-2 px-3 py-2 text-sm bg-muted/30 border border-border rounded-lg text-muted-foreground">
                  <Mail size={14} className="shrink-0" />
                  {displayEmail}
                </div>
                <p className="text-xs text-muted-foreground mt-1">Email address cannot be changed here. Contact your administrator.</p>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={saveProfile}
                  disabled={profileSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {profileSaving ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : profileSaved ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  {profileSaved ? 'Saved!' : 'Save Changes'}
                </button>
              </div>
            </div>

            {/* Role & Permissions */}
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-foreground">Assigned Role & Permissions</h2>
                <span className="text-xs text-muted-foreground">(read-only)</span>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: 'var(--izou-primary)', opacity: 0.85 }}
                >
                  <BadgeCheck size={16} className="text-white" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{roleLabel}</p>
                  <p className="text-xs text-muted-foreground">System role — managed by administrator</p>
                </div>
              </div>

              {permsLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                  <RefreshCw size={14} className="animate-spin" />
                  Loading permissions…
                </div>
              ) : permList.length > 0 ? (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">
                    {permList.length} permission{permList.length !== 1 ? 's' : ''} granted
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {permList.map((p) => (
                      <PermissionPill key={p} label={p} />
                    ))}
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 p-3 bg-orange-50 border border-orange-200 rounded-lg">
                  <Info size={14} className="text-orange-600 shrink-0" />
                  <p className="text-xs text-orange-700">No permissions found for your role. Contact your administrator.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══ SECURITY TAB ══ */}
        {activeTab === 'security' && (
          <div className="max-w-2xl space-y-6">
            {/* 2FA status banner */}
            <div
              className={`rounded-xl p-4 flex items-start gap-3 ${
                twoFaEnabled
                  ? 'bg-green-50 border border-green-200' :'bg-orange-50 border border-orange-200'
              }`}
            >
              {twoFaEnabled ? (
                <ShieldCheck size={18} className="text-green-600 shrink-0 mt-0.5" />
              ) : (
                <ShieldOff size={18} className="text-orange-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className={`text-sm font-semibold ${twoFaEnabled ? 'text-green-800' : 'text-orange-800'}`}>
                  {twoFaEnabled ? 'Two-Factor Authentication is Active' : 'Two-Factor Authentication Not Configured'}
                </p>
                <p className={`text-xs mt-0.5 ${twoFaEnabled ? 'text-green-700' : 'text-orange-700'}`}>
                  {twoFaEnabled
                    ? `Your account is protected with SMS verification on ${userProfile?.phone ?? 'your registered number'}.`
                    : 'Set up 2FA below to secure your account with SMS verification.'}
                </p>
              </div>
            </div>

            {/* TwoFASetup component */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <div className="flex items-center gap-2 mb-4">
                <Smartphone size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Configure 2FA Phone Number</h2>
              </div>
              <TwoFASetup
                mode="setup"
                onVerified={() => {
                  toast.success('2FA configured successfully!');
                }}
              />
            </div>

            {/* Security info */}
            <div
              className="rounded-xl p-5 space-y-3"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <h2 className="text-sm font-semibold text-foreground">Security Information</h2>
              <div className="space-y-2">
                {[
                  { label: 'Account Email', value: displayEmail, icon: <Mail size={13} /> },
                  { label: 'Last Sign-In', value: user?.last_sign_in_at ? new Date(user.last_sign_in_at).toLocaleString() : '—', icon: <Lock size={13} /> },
                  { label: 'Phone on File', value: userProfile?.phone ?? 'Not set', icon: <Phone size={13} /> },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {row.icon}
                      {row.label}
                    </div>
                    <span className="text-xs font-medium text-foreground">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ CREDENTIALS TAB ══ */}
        {activeTab === 'credentials' && (
          <div className="max-w-2xl space-y-6">
            <div
              className="rounded-xl p-5 space-y-4"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <div className="flex items-center gap-2 mb-1">
                <Key size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Change Password</h2>
              </div>

              {credError && (
                <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <AlertCircle size={14} className="text-red-600 shrink-0" />
                  <p className="text-xs text-red-700">{credError}</p>
                </div>
              )}

              <div className="space-y-3">
                {/* Current password */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Current Password</label>
                  <div className="relative">
                    <input
                      type={showCurrent ? 'text' : 'password'}
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="Enter current password"
                      className={`${inputBase} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrent((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showCurrent ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                </div>

                {/* New password */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">New Password</label>
                  <div className="relative">
                    <input
                      type={showNew ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 characters"
                      className={`${inputBase} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNew((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {/* Strength indicator */}
                  {newPassword.length > 0 && (
                    <div className="mt-1.5 flex gap-1">
                      {[1, 2, 3, 4].map((i) => (
                        <div
                          key={i}
                          className={`h-1 flex-1 rounded-full transition-colors ${
                            newPassword.length >= i * 3
                              ? newPassword.length >= 12
                                ? 'bg-green-500'
                                : newPassword.length >= 8
                                ? 'bg-amber-400' :'bg-red-400' :'bg-gray-200'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>

                {/* Confirm password */}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Confirm New Password</label>
                  <div className="relative">
                    <input
                      type={showConfirm ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      className={`${inputBase} pr-10`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                    </button>
                  </div>
                  {confirmPassword.length > 0 && newPassword !== confirmPassword && (
                    <p className="text-xs text-red-600 mt-1">Passwords do not match</p>
                  )}
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={changePassword}
                  disabled={credSaving || !newPassword || !confirmPassword}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {credSaving ? <RefreshCw size={14} className="animate-spin" /> : <Key size={14} />}
                  Update Password
                </button>
              </div>
            </div>

            {/* Account info */}
            <div
              className="rounded-xl p-5"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <h2 className="text-sm font-semibold text-foreground mb-3">Account Details</h2>
              <div className="space-y-2">
                {[
                  { label: 'User ID', value: user?.id?.slice(0, 18) + '…' ?? '—' },
                  { label: 'Email', value: displayEmail },
                  { label: 'Account Created', value: user?.created_at ? new Date(user.created_at).toLocaleDateString() : '—' },
                  { label: 'Email Verified', value: user?.email_confirmed_at ? 'Yes' : 'No' },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-2 border-b border-border last:border-0">
                    <span className="text-xs text-muted-foreground">{row.label}</span>
                    <span className="text-xs font-medium text-foreground font-mono">{row.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ══ PREFERENCES TAB ══ */}
        {activeTab === 'preferences' && (
          <div className="max-w-2xl space-y-6">
            <div
              className="rounded-xl p-5 space-y-5"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <div className="flex items-center gap-2">
                <Bell size={16} className="text-primary" />
                <h2 className="text-sm font-semibold text-foreground">Notification Preferences</h2>
              </div>

              <div className="space-y-4">
                {[
                  {
                    label: 'Email Alerts',
                    description: 'Receive system alerts and updates via email',
                    value: prefEmailAlerts,
                    onChange: setPrefEmailAlerts,
                  },
                  {
                    label: 'SMS Alerts',
                    description: 'Receive critical alerts via SMS to your registered phone',
                    value: prefSmsAlerts,
                    onChange: setPrefSmsAlerts,
                  },
                  {
                    label: 'Deadline Reminders',
                    description: 'Get notified before collateral perfection deadlines',
                    value: prefDeadlineReminders,
                    onChange: setPrefDeadlineReminders,
                  },
                  {
                    label: 'Approval Notifications',
                    description: 'Notify me when items in my queue need approval',
                    value: prefApprovalNotifs,
                    onChange: setPrefApprovalNotifs,
                  },
                ].map((pref) => (
                  <div key={pref.label} className="flex items-center justify-between gap-4 py-3 border-b border-border last:border-0">
                    <div>
                      <p className="text-sm font-medium text-foreground">{pref.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{pref.description}</p>
                    </div>
                    <Toggle checked={pref.value} onChange={pref.onChange} />
                  </div>
                ))}
              </div>

              <div className="flex justify-end pt-1">
                <button
                  onClick={savePreferences}
                  disabled={prefSaving}
                  className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                >
                  {prefSaving ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : prefSaved ? (
                    <CheckCircle2 size={14} />
                  ) : (
                    <Save size={14} />
                  )}
                  {prefSaved ? 'Saved!' : 'Save Preferences'}
                </button>
              </div>
            </div>

            {/* SMS note */}
            {prefSmsAlerts && !userProfile?.phone && (
              <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl">
                <Info size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700">
                  SMS alerts are enabled but no phone number is configured.{' '}
                  <button
                    onClick={() => setActiveTab('security')}
                    className="font-semibold underline hover:no-underline"
                  >
                    Set up 2FA
                  </button>{' '}
                  to add your phone number.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
