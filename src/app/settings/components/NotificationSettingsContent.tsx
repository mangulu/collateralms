'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Mail,
  Smartphone,
  Clock,
  AlertTriangle,
  GitBranch,
  FileText,
  Plus,
  ScrollText,
  Save,
  CheckCircle2,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { notificationService, NotificationPreferences } from '@/lib/supabase/notificationService';

// ─── Toggle Component ─────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean;
  onChange: (val: boolean) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

function Toggle({ checked, onChange, disabled = false, size = 'md' }: ToggleProps) {
  const track = size === 'sm' ? 'w-8 h-4' : 'w-10 h-5';
  const thumb = size === 'sm' ? 'w-3 h-3' : 'w-4 h-4';
  const translate = size === 'sm' ? 'translate-x-4' : 'translate-x-5';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => !disabled && onChange(!checked)}
      className={`relative inline-flex items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30 ${track} ${
        checked ? 'bg-primary' : 'bg-gray-200'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block rounded-full bg-white shadow transition-transform duration-200 ${thumb} ${
          checked ? translate : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

interface SectionHeaderProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  masterToggle?: { checked: boolean; onChange: (v: boolean) => void };
}

function SectionHeader({ icon, title, description, masterToggle }: SectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4 pb-4 border-b border-border mb-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
          {icon}
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">{title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>
      {masterToggle && (
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground">{masterToggle.checked ? 'Enabled' : 'Disabled'}</span>
          <Toggle checked={masterToggle.checked} onChange={masterToggle.onChange} />
        </div>
      )}
    </div>
  );
}

// ─── Preference Row ───────────────────────────────────────────────────────────

interface PrefRowProps {
  icon: React.ReactNode;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}

function PrefRow({ icon, label, description, checked, onChange, disabled }: PrefRowProps) {
  return (
    <div className={`flex items-center justify-between py-3 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3 min-w-0">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{description}</p>
        </div>
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={disabled} size="sm" />
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationSettingsContent() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    notificationService.getPreferences(user.id).then((p) => {
      setPrefs(p);
      setLoading(false);
    });
  }, [user?.id]);

  const update = useCallback(<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    setPrefs((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    const result = await notificationService.savePreferences(prefs);
    setSaving(false);
    if (result) {
      setPrefs(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError('Failed to save preferences. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!prefs) return null;

  const frequencyOptions: { value: NotificationPreferences['notificationFrequency']; label: string; desc: string }[] = [
    { value: 'realtime', label: 'Real-time', desc: 'Instant alerts as events occur' },
    { value: 'hourly', label: 'Hourly', desc: 'Batched every hour' },
    { value: 'daily', label: 'Daily', desc: 'Once per day summary' },
    { value: 'weekly', label: 'Weekly', desc: 'Weekly digest on Mondays' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Notification Settings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Customise which alerts you receive and how you are notified.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? (
            <Loader2 size={15} className="animate-spin" />
          ) : saved ? (
            <CheckCircle2 size={15} />
          ) : (
            <Save size={15} />
          )}
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertTriangle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* ── Alert Types ─────────────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg border border-border shadow-card p-5">
        <SectionHeader
          icon={<Bell size={18} />}
          title="Alert Types"
          description="Choose which system events trigger notifications for you."
        />
        <div className="divide-y divide-border/60">
          <PrefRow
            icon={<AlertTriangle size={15} />}
            label="Overdue Collateral"
            description="Alerts when collateral perfection deadlines are missed"
            checked={prefs.alertOverdueCollateral}
            onChange={(v) => update('alertOverdueCollateral', v)}
          />
          <PrefRow
            icon={<Clock size={15} />}
            label="Perfection Deadline Approaching"
            description="Reminders before perfection deadlines are due"
            checked={prefs.alertPerfectionDeadline}
            onChange={(v) => update('alertPerfectionDeadline', v)}
          />
          <PrefRow
            icon={<GitBranch size={15} />}
            label="Workflow Status Changes"
            description="Updates when approval workflow statuses change"
            checked={prefs.alertWorkflowStatusChange}
            onChange={(v) => update('alertWorkflowStatusChange', v)}
          />
          <PrefRow
            icon={<FileText size={15} />}
            label="Document Expiry"
            description="Alerts when collateral documents are nearing expiry"
            checked={prefs.alertDocumentExpiry}
            onChange={(v) => update('alertDocumentExpiry', v)}
          />
          <PrefRow
            icon={<Plus size={15} />}
            label="New Collateral Added"
            description="Notifications when new collateral records are created"
            checked={prefs.alertNewCollateralAdded}
            onChange={(v) => update('alertNewCollateralAdded', v)}
          />
          <PrefRow
            icon={<ScrollText size={15} />}
            label="Audit Log Events"
            description="Alerts for significant compliance and audit events"
            checked={prefs.alertAuditLogEvents}
            onChange={(v) => update('alertAuditLogEvents', v)}
          />
        </div>
      </div>

      {/* ── Notification Frequency ───────────────────────────────────────────── */}
      <div className="bg-card rounded-lg border border-border shadow-card p-5">
        <SectionHeader
          icon={<Clock size={18} />}
          title="Notification Frequency"
          description="Control how often you receive bundled notifications."
        />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {frequencyOptions.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => update('notificationFrequency', opt.value)}
              className={`flex flex-col items-start gap-1 p-3 rounded-lg border text-left transition-all ${
                prefs.notificationFrequency === opt.value
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30' :'border-border hover:border-primary/40 hover:bg-muted'
              }`}
            >
              <span className="text-sm font-medium text-foreground">{opt.label}</span>
              <span className="text-xs text-muted-foreground leading-snug">{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Email Preferences ────────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg border border-border shadow-card p-5">
        <SectionHeader
          icon={<Mail size={18} />}
          title="Email Notifications"
          description="Manage which alerts are delivered to your email inbox."
          masterToggle={{ checked: prefs.emailEnabled, onChange: (v) => update('emailEnabled', v) }}
        />
        <div className="divide-y divide-border/60">
          <PrefRow
            icon={<AlertTriangle size={15} />}
            label="Overdue Collateral Emails"
            description="Email alerts for overdue collateral items"
            checked={prefs.emailOverdueCollateral}
            onChange={(v) => update('emailOverdueCollateral', v)}
            disabled={!prefs.emailEnabled}
          />
          <PrefRow
            icon={<Clock size={15} />}
            label="Perfection Deadline Emails"
            description="Email reminders before deadlines"
            checked={prefs.emailPerfectionDeadline}
            onChange={(v) => update('emailPerfectionDeadline', v)}
            disabled={!prefs.emailEnabled}
          />
          <PrefRow
            icon={<GitBranch size={15} />}
            label="Workflow Status Emails"
            description="Email updates on approval workflow changes"
            checked={prefs.emailWorkflowStatusChange}
            onChange={(v) => update('emailWorkflowStatusChange', v)}
            disabled={!prefs.emailEnabled}
          />
          <PrefRow
            icon={<FileText size={15} />}
            label="Document Expiry Emails"
            description="Email alerts for expiring documents"
            checked={prefs.emailDocumentExpiry}
            onChange={(v) => update('emailDocumentExpiry', v)}
            disabled={!prefs.emailEnabled}
          />
        </div>

        {/* Digest */}
        <div className={`mt-4 p-4 rounded-lg border border-border bg-muted/30 ${!prefs.emailEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <p className="text-sm font-medium text-foreground">Email Digest</p>
              <p className="text-xs text-muted-foreground">Receive a bundled summary instead of individual emails</p>
            </div>
            <Toggle
              checked={prefs.emailDigestEnabled}
              onChange={(v) => update('emailDigestEnabled', v)}
              disabled={!prefs.emailEnabled}
            />
          </div>
          {prefs.emailDigestEnabled && (
            <div className="flex gap-2 mt-2">
              {(['daily', 'weekly'] as const).map((freq) => (
                <button
                  key={freq}
                  type="button"
                  onClick={() => update('emailDigestFrequency', freq)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium border transition-colors ${
                    prefs.emailDigestFrequency === freq
                      ? 'border-primary bg-primary/10 text-primary' :'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {freq === 'daily' ? 'Daily Digest' : 'Weekly Digest'}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── In-App Notifications ─────────────────────────────────────────────── */}
      <div className="bg-card rounded-lg border border-border shadow-card p-5">
        <SectionHeader
          icon={<Smartphone size={18} />}
          title="In-App Notifications"
          description="Control alerts shown within the CollateralMS interface."
          masterToggle={{ checked: prefs.inappEnabled, onChange: (v) => update('inappEnabled', v) }}
        />
        <div className="divide-y divide-border/60">
          <PrefRow
            icon={<AlertTriangle size={15} />}
            label="Overdue Collateral Alerts"
            description="In-app banners for overdue collateral"
            checked={prefs.inappOverdueCollateral}
            onChange={(v) => update('inappOverdueCollateral', v)}
            disabled={!prefs.inappEnabled}
          />
          <PrefRow
            icon={<Clock size={15} />}
            label="Perfection Deadline Alerts"
            description="In-app reminders for upcoming deadlines"
            checked={prefs.inappPerfectionDeadline}
            onChange={(v) => update('inappPerfectionDeadline', v)}
            disabled={!prefs.inappEnabled}
          />
          <PrefRow
            icon={<GitBranch size={15} />}
            label="Workflow Status Alerts"
            description="In-app updates on workflow approvals"
            checked={prefs.inappWorkflowStatusChange}
            onChange={(v) => update('inappWorkflowStatusChange', v)}
            disabled={!prefs.inappEnabled}
          />
          <PrefRow
            icon={<FileText size={15} />}
            label="Document Expiry Alerts"
            description="In-app alerts for expiring documents"
            checked={prefs.inappDocumentExpiry}
            onChange={(v) => update('inappDocumentExpiry', v)}
            disabled={!prefs.inappEnabled}
          />
          <PrefRow
            icon={prefs.inappSoundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            label="Notification Sound"
            description="Play a sound when in-app notifications arrive"
            checked={prefs.inappSoundEnabled}
            onChange={(v) => update('inappSoundEnabled', v)}
            disabled={!prefs.inappEnabled}
          />
        </div>
      </div>

      {/* Bottom Save */}
      <div className="flex justify-end pb-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={15} className="animate-spin" /> : saved ? <CheckCircle2 size={15} /> : <Save size={15} />}
          {saving ? 'Saving…' : saved ? 'Preferences Saved' : 'Save Preferences'}
        </button>
      </div>
    </div>
  );
}
