'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { User, Shield, Key, Bell, Save, RefreshCw, CheckCircle2, AlertCircle, Eye, EyeOff, Lock, Mail, Phone, BadgeCheck, ShieldCheck, ShieldOff, Info, Smartphone, ShieldAlert, ChevronDown, ChevronRight,  } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, getRoleLabel } from '@/lib/rbac';
import { createClient } from '@/lib/supabase/client';
import TwoFASetup from '@/components/TwoFASetup';
import { notificationService, NotificationPreferences, defaultPreferences } from '@/lib/supabase/notificationService';
import { toast } from 'sonner';

// ─── Tab definitions ──────────────────────────────────────────────────────────

type Tab = 'overview' | 'security' | 'credentials' | 'preferences' | 'permissions';

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  roles?: string[];
}

const TABS: TabDef[] = [
  { id: 'overview', label: 'Profile & Role', icon: <User size={15} /> },
  { id: 'security', label: '2FA & Security', icon: <Shield size={15} /> },
  { id: 'credentials', label: 'Credentials', icon: <Key size={15} /> },
  { id: 'preferences', label: 'Notifications', icon: <Bell size={15} /> },
  {
    id: 'permissions',
    label: 'Permissions',
    icon: <ShieldAlert size={15} />,
    roles: ['legal_officer', 'system_admin', 'supervisor'],
  },
];

// ─── Role badge colours ───────────────────────────────────────────────────────

const ROLE_BADGE: Record<string, { bg: string; text: string; border: string }> = {
  system_admin: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  credit_officer: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
  legal_officer: { bg: 'bg-purple-50', text: 'text-purple-700', border: 'border-purple-200' },
  supervisor: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
};

function getRoleBadge(role: string) {
  return ROLE_BADGE[role] ?? { bg: 'bg-gray-50', text: 'text-gray-700', border: 'border-gray-200' };
}

// ─── Permission pill ──────────────────────────────────────────────────────────

function PermissionPill({ label, granted = true }: { label: string; granted?: boolean }) {
  const pretty = label.replace(/\./g, ' › ').replace(/_/g, ' ');
  return (
    <span
      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium border ${
        granted
          ? 'bg-primary/8 text-primary border-primary/15' :'bg-red-50 text-red-600 border-red-200 line-through opacity-60'
      }`}
    >
      <CheckCircle2 size={10} className="shrink-0" />
      {pretty}
    </span>
  );
}

// ─── Toggle ───────────────────────────────────────────────────────────────────

function Toggle({ checked, onChange, disabled }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked ? 'bg-primary' : 'bg-gray-200'}`}
    >
      <span
        className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
          checked ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Permission module group ──────────────────────────────────────────────────

interface PermissionGroup {
  module: string;
  permissions: Array<{
    key: string;
    label: string;
    description: string;
    hasRole: boolean;
    override: boolean | null; // null = no override, true = granted, false = revoked
  }>;
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

  // ── Notification preferences state ───────────────────────────────────────
  const [notifPrefs, setNotifPrefs] = useState<NotificationPreferences | null>(null);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifSaving, setNotifSaving] = useState(false);
  const [notifSaved, setNotifSaved] = useState(false);

  // ── Permissions tab state ─────────────────────────────────────────────────
  const [permGroups, setPermGroups] = useState<PermissionGroup[]>([]);
  const [permOverrides, setPermOverrides] = useState<Record<string, boolean>>({});
  const [permLoading, setPermLoading] = useState(false);
  const [permSaving, setPermSaving] = useState(false);
  const [expandedModules, setExpandedModules] = useState<Set<string>>(new Set());

  // ── Load profile data ─────────────────────────────────────────────────────
  const loadProfile = useCallback(async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('id', user.id)
        .single();
      if (data) {
        setFullName(data.full_name ?? '');
      }
    } catch {
      // silent
    }
  }, [user, supabase]);

  // ── Load notification preferences ─────────────────────────────────────────
  const loadNotifPrefs = useCallback(async () => {
    if (!user) return;
    setNotifLoading(true);
    try {
      const prefs = await notificationService.getPreferences(user.id);
      setNotifPrefs(prefs);
    } catch {
      setNotifPrefs(defaultPreferences(user.id));
    } finally {
      setNotifLoading(false);
    }
  }, [user]);

  // ── Load permissions and overrides ────────────────────────────────────────
  const loadPermissions = useCallback(async () => {
    if (!user || !role) return;
    setPermLoading(true);
    try {
      // Fetch all permissions with labels
      const { data: allPerms } = await supabase
        .from('permissions')
        .select('key, label, description, module')
        .order('module')
        .order('key');

      // Fetch role permissions
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_name', role);

      const rolePermSet = new Set((rolePerms || []).map((r: any) => r.permission_key));

      // Fetch user overrides
      const { data: overrides } = await supabase
        .from('user_permission_overrides')
        .select('permission_key, granted')
        .eq('user_id', user.id);

      const overrideMap: Record<string, boolean> = {};
      (overrides || []).forEach((o: any) => {
        overrideMap[o.permission_key] = o.granted;
      });
      setPermOverrides(overrideMap);

      // Group by module
      const moduleMap: Record<string, PermissionGroup> = {};
      (allPerms || []).forEach((p: any) => {
        if (!moduleMap[p.module]) {
          moduleMap[p.module] = { module: p.module, permissions: [] };
        }
        moduleMap[p.module].permissions.push({
          key: p.key,
          label: p.label || p.key,
          description: p.description || '',
          hasRole: rolePermSet.has(p.key),
          override: overrideMap[p.key] !== undefined ? overrideMap[p.key] : null,
        });
      });

      const groups = Object.values(moduleMap);
      setPermGroups(groups);
      // Expand first module by default
      if (groups.length > 0) {
        setExpandedModules(new Set([groups[0].module]));
      }
    } catch {
      // silent
    } finally {
      setPermLoading(false);
    }
  }, [user, role, supabase]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  useEffect(() => {
    if (activeTab === 'preferences') loadNotifPrefs();
  }, [activeTab, loadNotifPrefs]);

  useEffect(() => {
    if (activeTab === 'permissions') loadPermissions();
  }, [activeTab, loadPermissions]);

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

  // ── Save notification preferences ─────────────────────────────────────────
  const saveNotifPrefs = async () => {
    if (!user || !notifPrefs) return;
    setNotifSaving(true);
    try {
      const saved = await notificationService.savePreferences(notifPrefs);
      if (!saved) throw new Error('Failed to save');
      setNotifPrefs(saved);
      setNotifSaved(true);
      toast.success('Notification preferences saved');
      setTimeout(() => setNotifSaved(false), 3000);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to save preferences');
    } finally {
      setNotifSaving(false);
    }
  };

  // ── Toggle permission override ────────────────────────────────────────────
  const togglePermOverride = async (permKey: string, currentHasRole: boolean, currentOverride: boolean | null) => {
    if (!user) return;
    setPermSaving(true);
    try {
      // Determine new state: cycle through role-default → granted → revoked → role-default
      let newGranted: boolean | null;
      if (currentOverride === null) {
        // No override → add override (grant if not in role, revoke if in role)
        newGranted = !currentHasRole;
      } else if (currentOverride === true && !currentHasRole) {
        // Was granted via override, remove override
        newGranted = null;
      } else if (currentOverride === false && currentHasRole) {
        // Was revoked via override, remove override
        newGranted = null;
      } else {
        newGranted = null;
      }

      if (newGranted === null) {
        // Remove override
        await supabase
          .from('user_permission_overrides')
          .delete()
          .eq('user_id', user.id)
          .eq('permission_key', permKey);
        const updated = { ...permOverrides };
        delete updated[permKey];
        setPermOverrides(updated);
        toast.success('Permission override removed');
      } else {
        // Upsert override
        const { error } = await supabase
          .from('user_permission_overrides')
          .upsert(
            { user_id: user.id, permission_key: permKey, granted: newGranted },
            { onConflict: 'user_id,permission_key' }
          );
        if (error) throw error;
        setPermOverrides({ ...permOverrides, [permKey]: newGranted });
        toast.success(`Permission ${newGranted ? 'granted' : 'revoked'} via override`);
      }

      // Refresh permission groups
      await loadPermissions();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to update permission');
    } finally {
      setPermSaving(false);
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

  const isLegalOfficer = displayRole === 'legal_officer';
  const isSystemAdmin = displayRole === 'system_admin';
  const isSupervisor = displayRole === 'supervisor';
  const canManagePermissions = isLegalOfficer || isSystemAdmin || isSupervisor;

  const visibleTabs = TABS.filter(
    (t) => !t.roles || t.roles.includes(displayRole)
  );

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
          {visibleTabs.map((tab) => (
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

              {canManagePermissions && (
                <div className="pt-1">
                  <button
                    onClick={() => setActiveTab('permissions')}
                    className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
                  >
                    <ShieldAlert size={12} />
                    Manage role-scoped permission overrides →
                  </button>
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

        {/* ══ NOTIFICATIONS TAB ══ */}
        {activeTab === 'preferences' && (
          <div className="max-w-2xl space-y-6">
            {notifLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <RefreshCw size={14} className="animate-spin" />
                Loading preferences…
              </div>
            ) : notifPrefs ? (
              <>
                {/* Alert Types */}
                <div
                  className="rounded-xl p-5 space-y-4"
                  style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
                >
                  <div className="flex items-center gap-2">
                    <Bell size={16} className="text-primary" />
                    <h2 className="text-sm font-semibold text-foreground">Alert Types</h2>
                  </div>
                  <div className="space-y-3">
                    {[
                      { label: 'Overdue Collateral', key: 'alertOverdueCollateral' as keyof NotificationPreferences, desc: 'Alerts when collateral becomes overdue' },
                      { label: 'Perfection Deadline', key: 'alertPerfectionDeadline' as keyof NotificationPreferences, desc: 'Reminders before perfection deadlines' },
                      { label: 'Workflow Status Change', key: 'alertWorkflowStatusChange' as keyof NotificationPreferences, desc: 'Notify when workflow stages change' },
                      { label: 'Document Expiry', key: 'alertDocumentExpiry' as keyof NotificationPreferences, desc: 'Alerts for expiring documents' },
                      { label: 'New Collateral Added', key: 'alertNewCollateralAdded' as keyof NotificationPreferences, desc: 'Notify when new collateral is registered' },
                      { label: 'Audit Log Events', key: 'alertAuditLogEvents' as keyof NotificationPreferences, desc: 'Alerts for significant audit events' },
                    ].map((item) => (
                      <div key={item.key} className="flex items-center justify-between gap-4 py-2.5 border-b border-border last:border-0">
                        <div>
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                        </div>
                        <Toggle
                          checked={notifPrefs[item.key] as boolean}
                          onChange={(v) => setNotifPrefs({ ...notifPrefs, [item.key]: v })}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* Delivery Channels */}
                <div
                  className="rounded-xl p-5 space-y-4"
                  style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
                >
                  <h2 className="text-sm font-semibold text-foreground">Delivery Channels</h2>

                  {/* Email */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Mail size={13} className="text-primary" /> Email Notifications
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Receive alerts via email</p>
                      </div>
                      <Toggle
                        checked={notifPrefs.emailEnabled}
                        onChange={(v) => setNotifPrefs({ ...notifPrefs, emailEnabled: v })}
                      />
                    </div>
                    {notifPrefs.emailEnabled && (
                      <div className="pl-4 space-y-2 pt-1">
                        {[
                          { label: 'Overdue Collateral', key: 'emailOverdueCollateral' as keyof NotificationPreferences },
                          { label: 'Perfection Deadline', key: 'emailPerfectionDeadline' as keyof NotificationPreferences },
                          { label: 'Workflow Status Change', key: 'emailWorkflowStatusChange' as keyof NotificationPreferences },
                          { label: 'Document Expiry', key: 'emailDocumentExpiry' as keyof NotificationPreferences },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1.5">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <Toggle
                              checked={notifPrefs[item.key] as boolean}
                              onChange={(v) => setNotifPrefs({ ...notifPrefs, [item.key]: v })}
                            />
                          </div>
                        ))}
                        <div className="flex items-center justify-between py-1.5">
                          <p className="text-xs text-muted-foreground">Email Digest</p>
                          <Toggle
                            checked={notifPrefs.emailDigestEnabled}
                            onChange={(v) => setNotifPrefs({ ...notifPrefs, emailDigestEnabled: v })}
                          />
                        </div>
                        {notifPrefs.emailDigestEnabled && (
                          <div className="flex items-center gap-2 pt-1">
                            <p className="text-xs text-muted-foreground">Digest frequency:</p>
                            <select
                              value={notifPrefs.emailDigestFrequency}
                              onChange={(e) => setNotifPrefs({ ...notifPrefs, emailDigestFrequency: e.target.value as 'daily' | 'weekly' })}
                              className="text-xs border border-border rounded px-2 py-1 bg-background text-foreground"
                            >
                              <option value="daily">Daily</option>
                              <option value="weekly">Weekly</option>
                            </select>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* In-App */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between py-2 border-b border-border">
                      <div>
                        <p className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Bell size={13} className="text-primary" /> In-App Notifications
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">Show alerts inside the application</p>
                      </div>
                      <Toggle
                        checked={notifPrefs.inappEnabled}
                        onChange={(v) => setNotifPrefs({ ...notifPrefs, inappEnabled: v })}
                      />
                    </div>
                    {notifPrefs.inappEnabled && (
                      <div className="pl-4 space-y-2 pt-1">
                        {[
                          { label: 'Overdue Collateral', key: 'inappOverdueCollateral' as keyof NotificationPreferences },
                          { label: 'Perfection Deadline', key: 'inappPerfectionDeadline' as keyof NotificationPreferences },
                          { label: 'Workflow Status Change', key: 'inappWorkflowStatusChange' as keyof NotificationPreferences },
                          { label: 'Document Expiry', key: 'inappDocumentExpiry' as keyof NotificationPreferences },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center justify-between py-1.5">
                            <p className="text-xs text-muted-foreground">{item.label}</p>
                            <Toggle
                              checked={notifPrefs[item.key] as boolean}
                              onChange={(v) => setNotifPrefs({ ...notifPrefs, [item.key]: v })}
                            />
                          </div>
                        ))}
                        <div className="flex items-center justify-between py-1.5">
                          <p className="text-xs text-muted-foreground">Sound Alerts</p>
                          <Toggle
                            checked={notifPrefs.inappSoundEnabled}
                            onChange={(v) => setNotifPrefs({ ...notifPrefs, inappSoundEnabled: v })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Frequency */}
                <div
                  className="rounded-xl p-5 space-y-3"
                  style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
                >
                  <h2 className="text-sm font-semibold text-foreground">Notification Frequency</h2>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {(['realtime', 'hourly', 'daily', 'weekly'] as const).map((freq) => (
                      <button
                        key={freq}
                        onClick={() => setNotifPrefs({ ...notifPrefs, notificationFrequency: freq })}
                        className={`px-3 py-2 rounded-lg text-xs font-medium border transition-colors capitalize ${
                          notifPrefs.notificationFrequency === freq
                            ? 'bg-primary text-white border-primary' :'bg-background text-muted-foreground border-border hover:border-primary/40'
                        }`}
                      >
                        {freq}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end">
                  <button
                    onClick={saveNotifPrefs}
                    disabled={notifSaving}
                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
                  >
                    {notifSaving ? (
                      <RefreshCw size={14} className="animate-spin" />
                    ) : notifSaved ? (
                      <CheckCircle2 size={14} />
                    ) : (
                      <Save size={14} />
                    )}
                    {notifSaved ? 'Saved!' : 'Save Preferences'}
                  </button>
                </div>
              </>
            ) : null}
          </div>
        )}

        {/* ══ PERMISSIONS TAB ══ */}
        {activeTab === 'permissions' && canManagePermissions && (
          <div className="max-w-2xl space-y-6">
            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-purple-50 border border-purple-200">
              <ShieldAlert size={16} className="text-purple-600 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-purple-800">Role-Scoped Permission Management</p>
                <p className="text-xs text-purple-700 mt-0.5">
                  Your base permissions are set by your <strong>{roleLabel}</strong> role. You can request overrides below.
                  Overrides are subject to administrator approval and audit logging.
                </p>
              </div>
            </div>

            {permLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                <RefreshCw size={14} className="animate-spin" />
                Loading permissions…
              </div>
            ) : permGroups.length === 0 ? (
              <div className="flex items-center gap-2 p-4 bg-muted/30 border border-border rounded-xl">
                <Info size={14} className="text-muted-foreground shrink-0" />
                <p className="text-sm text-muted-foreground">No permissions found in the system. Contact your administrator.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {permGroups.map((group) => {
                  const isExpanded = expandedModules.has(group.module);
                  const overrideCount = group.permissions.filter((p) => p.override !== null).length;
                  return (
                    <div
                      key={group.module}
                      className="rounded-xl overflow-hidden"
                      style={{ border: '1px solid var(--izou-border)' }}
                    >
                      {/* Module header */}
                      <button
                        onClick={() => {
                          const next = new Set(expandedModules);
                          if (isExpanded) next.delete(group.module);
                          else next.add(group.module);
                          setExpandedModules(next);
                        }}
                        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors"
                        style={{ background: 'var(--izou-card)' }}
                        onMouseOver={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-light)'}
                        onMouseOut={(e) => (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-card)'}
                      >
                        <div className="flex items-center gap-2">
                          {isExpanded ? <ChevronDown size={14} className="text-muted-foreground" /> : <ChevronRight size={14} className="text-muted-foreground" />}
                          <span className="text-sm font-semibold text-foreground capitalize">
                            {group.module.replace(/_/g, ' ')}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({group.permissions.length} permission{group.permissions.length !== 1 ? 's' : ''})
                          </span>
                        </div>
                        {overrideCount > 0 && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 font-medium">
                            {overrideCount} override{overrideCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </button>

                      {/* Permission rows */}
                      {isExpanded && (
                        <div style={{ borderTop: '1px solid var(--izou-border)' }}>
                          {group.permissions.map((perm, idx) => {
                            const effectiveGranted = perm.override !== null ? perm.override : perm.hasRole;
                            const hasOverride = perm.override !== null;
                            return (
                              <div
                                key={perm.key}
                                className={`flex items-center justify-between px-4 py-3 gap-4 ${
                                  idx < group.permissions.length - 1 ? 'border-b border-border' : ''
                                }`}
                                style={{ background: hasOverride ? 'rgba(var(--izou-primary-rgb, 0,100,160), 0.04)' : 'var(--izou-card)' }}
                              >
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-xs font-semibold text-foreground">{perm.label}</p>
                                    {perm.hasRole && (
                                      <span className="text-xs px-1.5 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-200">
                                        Role default
                                      </span>
                                    )}
                                    {hasOverride && (
                                      <span className={`text-xs px-1.5 py-0.5 rounded-full border font-medium ${
                                        perm.override
                                          ? 'bg-green-50 text-green-700 border-green-200' :'bg-red-50 text-red-600 border-red-200'
                                      }`}>
                                        {perm.override ? '+ Override granted' : '− Override revoked'}
                                      </span>
                                    )}
                                  </div>
                                  {perm.description && (
                                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{perm.description}</p>
                                  )}
                                  <p className="text-xs text-muted-foreground/60 mt-0.5 font-mono">{perm.key}</p>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                  <span className={`text-xs font-medium ${effectiveGranted ? 'text-green-600' : 'text-muted-foreground'}`}>
                                    {effectiveGranted ? 'Granted' : 'Denied'}
                                  </span>
                                  <Toggle
                                    checked={effectiveGranted}
                                    disabled={permSaving}
                                    onChange={() => togglePermOverride(perm.key, perm.hasRole, perm.override)}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* Legend */}
            <div
              className="rounded-xl p-4 space-y-2"
              style={{ background: 'var(--izou-card)', border: '1px solid var(--izou-border)' }}
            >
              <p className="text-xs font-semibold text-foreground">Legend</p>
              <div className="flex flex-wrap gap-3">
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-blue-200 inline-block" />
                  Role default — inherited from your role
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-green-400 inline-block" />
                  Override granted — added beyond role
                </span>
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span className="w-3 h-3 rounded-full bg-red-400 inline-block" />
                  Override revoked — removed from role
                </span>
              </div>
              <p className="text-xs text-muted-foreground pt-1">
                <Info size={11} className="inline mr-1" />
                All permission changes are recorded in the audit log for compliance.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
