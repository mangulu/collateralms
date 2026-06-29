'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
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
  MessageSquare,
  ShieldAlert,
  Building2,
  ChevronDown,
  ChevronUp,
  X,
  UserPlus,
  Phone,
  AtSign,
  Sliders,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  notificationService,
  NotificationPreferences,
  AlertTypeKey,
  AlertChannelConfig,
  AlertRecipients,
  defaultAlertChannelConfig,
  defaultAlertRecipients,
} from '@/lib/supabase/notificationService';

// ─── Toggle ───────────────────────────────────────────────────────────────────

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

// ─── Channel Badge ────────────────────────────────────────────────────────────

interface ChannelBadgeProps {
  active: boolean;
  label: string;
  icon: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

function ChannelBadge({ active, label, icon, onClick, disabled }: ChannelBadgeProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-all ${
        active
          ? 'bg-primary/10 border-primary/40 text-primary' :'bg-muted/40 border-border text-muted-foreground hover:border-primary/30'
      } ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      {icon}
      {label}
    </button>
  );
}

// ─── Recipients Editor ────────────────────────────────────────────────────────

interface RecipientsEditorProps {
  recipients: AlertRecipients;
  onChange: (r: AlertRecipients) => void;
  emailEnabled: boolean;
  smsEnabled: boolean;
}

function RecipientsEditor({ recipients, onChange, emailEnabled, smsEnabled }: RecipientsEditorProps) {
  const [emailInput, setEmailInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);

  const addEmail = () => {
    const val = emailInput.trim();
    if (!val || !val.includes('@')) return;
    if (recipients.emails.includes(val)) return;
    onChange({ ...recipients, emails: [...recipients.emails, val] });
    setEmailInput('');
    emailRef.current?.focus();
  };

  const removeEmail = (e: string) => {
    onChange({ ...recipients, emails: recipients.emails.filter((x) => x !== e) });
  };

  const addPhone = () => {
    const val = phoneInput.trim();
    if (!val) return;
    if (recipients.phones.includes(val)) return;
    onChange({ ...recipients, phones: [...recipients.phones, val] });
    setPhoneInput('');
    phoneRef.current?.focus();
  };

  const removePhone = (p: string) => {
    onChange({ ...recipients, phones: recipients.phones.filter((x) => x !== p) });
  };

  return (
    <div className="mt-3 space-y-3 pl-1">
      {/* Email recipients */}
      {emailEnabled && (
        <div>
          <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <AtSign size={11} className="text-muted-foreground" />
            Email Recipients
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {recipients.emails.map((e) => (
              <span
                key={e}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 border border-blue-200 text-blue-700 text-xs rounded-full"
              >
                {e}
                <button type="button" onClick={() => removeEmail(e)} className="hover:text-blue-900 ml-0.5">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              ref={emailRef}
              type="email"
              placeholder="name@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addEmail())}
              className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={addEmail}
              className="px-2.5 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-md hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <UserPlus size={11} />
              Add
            </button>
          </div>
        </div>
      )}

      {/* Phone recipients */}
      {smsEnabled && (
        <div>
          <p className="text-xs font-medium text-foreground mb-1.5 flex items-center gap-1.5">
            <Phone size={11} className="text-muted-foreground" />
            SMS Recipients
          </p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {recipients.phones.map((p) => (
              <span
                key={p}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-50 border border-green-200 text-green-700 text-xs rounded-full"
              >
                {p}
                <button type="button" onClick={() => removePhone(p)} className="hover:text-green-900 ml-0.5">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              ref={phoneRef}
              type="tel"
              placeholder="+255712345678"
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPhone())}
              className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={addPhone}
              className="px-2.5 py-1.5 bg-primary/10 text-primary text-xs font-medium rounded-md hover:bg-primary/20 transition-colors flex items-center gap-1"
            >
              <UserPlus size={11} />
              Add
            </button>
          </div>
          <p className="text-xs text-muted-foreground mt-1">Include country code (e.g. +255 for Tanzania)</p>
        </div>
      )}

      {!emailEnabled && !smsEnabled && (
        <p className="text-xs text-muted-foreground italic">
          Enable Email or SMS channel above to configure recipients.
        </p>
      )}
    </div>
  );
}

// ─── Alert Type Row (matrix row with channel toggles + recipients) ─────────────

interface AlertTypeRowProps {
  alertKey: AlertTypeKey;
  icon: React.ReactNode;
  label: string;
  description: string;
  alertEnabled: boolean;
  channelConfig: AlertChannelConfig;
  recipients: AlertRecipients;
  onChannelChange: (key: AlertTypeKey, channel: keyof AlertChannelConfig, val: boolean) => void;
  onRecipientsChange: (key: AlertTypeKey, r: AlertRecipients) => void;
  globalEmailEnabled: boolean;
  globalSmsEnabled: boolean;
  globalInappEnabled: boolean;
}

function AlertTypeRow({
  alertKey,
  icon,
  label,
  description,
  alertEnabled,
  channelConfig,
  recipients,
  onChannelChange,
  onRecipientsChange,
  globalEmailEnabled,
  globalSmsEnabled,
  globalInappEnabled,
}: AlertTypeRowProps) {
  const [expanded, setExpanded] = useState(false);

  const hasRecipients =
    recipients.emails.length > 0 || recipients.phones.length > 0;

  return (
    <div className={`border border-border rounded-lg overflow-hidden ${!alertEnabled ? 'opacity-60' : ''}`}>
      {/* Row header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-card">
        <span className="text-muted-foreground shrink-0">{icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>

        {/* Channel badges */}
        <div className="flex items-center gap-1.5 shrink-0">
          <ChannelBadge
            active={channelConfig.email && globalEmailEnabled}
            label="Email"
            icon={<Mail size={10} />}
            onClick={() => onChannelChange(alertKey, 'email', !channelConfig.email)}
            disabled={!alertEnabled || !globalEmailEnabled}
          />
          <ChannelBadge
            active={channelConfig.sms && globalSmsEnabled}
            label="SMS"
            icon={<MessageSquare size={10} />}
            onClick={() => onChannelChange(alertKey, 'sms', !channelConfig.sms)}
            disabled={!alertEnabled || !globalSmsEnabled}
          />
          <ChannelBadge
            active={channelConfig.inapp && globalInappEnabled}
            label="In-App"
            icon={<Bell size={10} />}
            onClick={() => onChannelChange(alertKey, 'inapp', !channelConfig.inapp)}
            disabled={!alertEnabled || !globalInappEnabled}
          />
        </div>

        {/* Expand recipients */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          disabled={!alertEnabled}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-colors shrink-0 ${
            hasRecipients
              ? 'text-primary bg-primary/10 hover:bg-primary/20' :'text-muted-foreground hover:text-foreground hover:bg-muted'
          } ${!alertEnabled ? 'cursor-not-allowed' : ''}`}
          title="Configure recipients"
        >
          <UserPlus size={12} />
          {hasRecipients ? `${recipients.emails.length + recipients.phones.length}` : ''}
          {expanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
        </button>
      </div>

      {/* Recipients panel */}
      {expanded && alertEnabled && (
        <div className="px-4 pb-4 pt-1 bg-muted/20 border-t border-border">
          <RecipientsEditor
            recipients={recipients}
            onChange={(r) => onRecipientsChange(alertKey, r)}
            emailEnabled={channelConfig.email && globalEmailEnabled}
            smsEnabled={channelConfig.sms && globalSmsEnabled}
          />
        </div>
      )}
    </div>
  );
}

// ─── Alert type definitions ───────────────────────────────────────────────────

const ALERT_TYPES: {
  key: AlertTypeKey;
  icon: React.ReactNode;
  label: string;
  description: string;
  prefKey: keyof NotificationPreferences;
}[] = [
  {
    key: 'overdue_collateral',
    icon: <AlertTriangle size={15} />,
    label: 'Overdue Collateral',
    description: 'Alerts when collateral perfection deadlines are missed',
    prefKey: 'alertOverdueCollateral',
  },
  {
    key: 'perfection_deadline',
    icon: <Clock size={15} />,
    label: 'Perfection Deadline Approaching',
    description: 'Reminders before perfection deadlines are due',
    prefKey: 'alertPerfectionDeadline',
  },
  {
    key: 'workflow_status_change',
    icon: <GitBranch size={15} />,
    label: 'Workflow Status Changes',
    description: 'Updates when approval workflow statuses change',
    prefKey: 'alertWorkflowStatusChange',
  },
  {
    key: 'document_expiry',
    icon: <FileText size={15} />,
    label: 'Document Expiry',
    description: 'Alerts when collateral documents are nearing expiry',
    prefKey: 'alertDocumentExpiry',
  },
  {
    key: 'new_collateral_added',
    icon: <Plus size={15} />,
    label: 'New Collateral Added',
    description: 'Notifications when new collateral records are created',
    prefKey: 'alertNewCollateralAdded',
  },
  {
    key: 'audit_log_events',
    icon: <ScrollText size={15} />,
    label: 'Audit Log Events',
    description: 'Alerts for significant compliance and audit events',
    prefKey: 'alertAuditLogEvents',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function NotificationSettingsContent() {
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [smsPhone, setSmsPhone] = useState('');
  const [activeSection, setActiveSection] = useState<'preferences' | 'channels'>('preferences');

  useEffect(() => {
    if (!user?.id) return;
    setLoading(true);
    notificationService.getPreferences(user.id).then((p) => {
      setPrefs(p);
      setSmsPhone((p as any).smsPhone || '');
      setLoading(false);
    });
  }, [user?.id]);

  const update = useCallback(<K extends keyof NotificationPreferences>(key: K, value: NotificationPreferences[K]) => {
    setPrefs((prev) => (prev ? { ...prev, [key]: value } : prev));
    setSaved(false);
  }, []);

  const handleChannelChange = useCallback(
    (alertKey: AlertTypeKey, channel: keyof AlertChannelConfig, val: boolean) => {
      setPrefs((prev) => {
        if (!prev) return prev;
        const current = prev.alertChannelConfig[alertKey] ?? defaultAlertChannelConfig()[alertKey]!;
        return {
          ...prev,
          alertChannelConfig: {
            ...prev.alertChannelConfig,
            [alertKey]: { ...current, [channel]: val },
          },
        };
      });
      setSaved(false);
    },
    []
  );

  const handleRecipientsChange = useCallback((alertKey: AlertTypeKey, r: AlertRecipients) => {
    setPrefs((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        alertRecipients: { ...prev.alertRecipients, [alertKey]: r },
      };
    });
    setSaved(false);
  }, []);

  const handleSave = async () => {
    if (!prefs) return;
    setSaving(true);
    setError(null);
    const prefsWithPhone = { ...prefs, smsPhone: smsPhone.trim() || undefined };
    const result = await notificationService.savePreferences(prefsWithPhone as any);
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

  const globalSmsEnabled = (prefs as any).smsEnabled ?? false;

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

      {/* Section Tabs */}
      <div className="flex gap-1 p-1 bg-muted/40 rounded-lg border border-border w-fit">
        <button
          type="button"
          onClick={() => setActiveSection('preferences')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeSection === 'preferences' ?'bg-white text-foreground shadow-sm border border-border' :'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Bell size={14} />
          Alert Preferences
        </button>
        <button
          type="button"
          onClick={() => setActiveSection('channels')}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeSection === 'channels' ?'bg-white text-foreground shadow-sm border border-border' :'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Sliders size={14} />
          Channels &amp; Recipients
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Alert Preferences (existing functionality)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'preferences' && (
        <>
          {/* ── Alert Types ─────────────────────────────────────────────────── */}
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

          {/* ── Notification Frequency ───────────────────────────────────────── */}
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

          {/* ── Email Preferences ────────────────────────────────────────────── */}
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
            <div
              className={`mt-4 p-4 rounded-lg border border-border bg-muted/30 ${
                !prefs.emailEnabled ? 'opacity-50 pointer-events-none' : ''
              }`}
            >
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

          {/* ── In-App Notifications ─────────────────────────────────────────── */}
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

          {/* ── SMS Notifications (Twilio) ───────────────────────────────────── */}
          <div className="bg-card rounded-lg border border-border shadow-card p-5">
            <SectionHeader
              icon={<MessageSquare size={18} />}
              title="SMS Notifications (Twilio)"
              description="Receive instant SMS alerts for critical events via Twilio."
              masterToggle={{
                checked: globalSmsEnabled,
                onChange: (v) => update('smsEnabled' as any, v),
              }}
            />

            {/* Phone Number Input */}
            <div className={`mb-4 ${!globalSmsEnabled ? 'opacity-50 pointer-events-none' : ''}`}>
              <label className="block text-xs font-medium text-foreground mb-1.5">Default SMS Phone Number</label>
              <div className="flex gap-2">
                <input
                  type="tel"
                  placeholder="+255712345678"
                  value={smsPhone}
                  onChange={(e) => setSmsPhone(e.target.value)}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <p className="text-xs text-muted-foreground mt-1">Include country code (e.g. +255 for Tanzania)</p>
            </div>

            <div className="divide-y divide-border/60">
              <PrefRow
                icon={<ShieldAlert size={15} />}
                label="Fraud Detection Alerts"
                description="SMS when AI detects fraud indicators on collateral"
                checked={(prefs as any).smsFraudDetection ?? true}
                onChange={(v) => update('smsFraudDetection' as any, v)}
                disabled={!globalSmsEnabled}
              />
              <PrefRow
                icon={<Building2 size={15} />}
                label="BRELA Deadline Warnings"
                description="SMS for overdue and critical BRELA/registry deadlines"
                checked={(prefs as any).smsBrelaDeadline ?? true}
                onChange={(v) => update('smsBrelaDeadline' as any, v)}
                disabled={!globalSmsEnabled}
              />
              <PrefRow
                icon={<GitBranch size={15} />}
                label="Approval Request Alerts"
                description="SMS when perfection requests require your approval"
                checked={(prefs as any).smsApprovalRequest ?? true}
                onChange={(v) => update('smsApprovalRequest' as any, v)}
                disabled={!globalSmsEnabled}
              />
              <PrefRow
                icon={<AlertTriangle size={15} />}
                label="Overdue Collateral SMS"
                description="SMS for collateral items past perfection deadline"
                checked={(prefs as any).smsOverdueCollateral ?? false}
                onChange={(v) => update('smsOverdueCollateral' as any, v)}
                disabled={!globalSmsEnabled}
              />
            </div>

            {!globalSmsEnabled && (
              <div className="mt-4 p-3 bg-muted/30 border border-border rounded-lg">
                <p className="text-xs text-muted-foreground">
                  Enable SMS notifications above to configure Twilio SMS alerts. Requires Twilio credentials configured
                  in Supabase Edge Function secrets.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ═══════════════════════════════════════════════════════════════════════
          SECTION: Channels & Recipients (new per-alert-type matrix)
      ════════════════════════════════════════════════════════════════════════ */}
      {activeSection === 'channels' && (
        <>
          {/* Info banner */}
          <div className="flex items-start gap-3 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Sliders size={15} className="text-blue-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-800">Per-Alert Channel Configuration</p>
              <p className="text-xs text-blue-600 mt-0.5">
                For each alert type, choose which channels (Email, SMS, In-App) deliver it and add specific recipients.
                Channel badges are greyed out when the global channel is disabled.
              </p>
            </div>
          </div>

          {/* Global channel status summary */}
          <div className="bg-card rounded-lg border border-border shadow-card p-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Global Channel Status
            </p>
            <div className="flex flex-wrap gap-3">
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  prefs.emailEnabled
                    ? 'bg-green-50 border-green-200 text-green-700' :'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                <Mail size={14} />
                <span className="font-medium">Email</span>
                <span className="text-xs">{prefs.emailEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  globalSmsEnabled
                    ? 'bg-green-50 border-green-200 text-green-700' :'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                <MessageSquare size={14} />
                <span className="font-medium">SMS</span>
                <span className="text-xs">{globalSmsEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <div
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-sm ${
                  prefs.inappEnabled
                    ? 'bg-green-50 border-green-200 text-green-700' :'bg-muted/40 border-border text-muted-foreground'
                }`}
              >
                <Bell size={14} />
                <span className="font-medium">In-App</span>
                <span className="text-xs">{prefs.inappEnabled ? 'Enabled' : 'Disabled'}</span>
              </div>
              <p className="text-xs text-muted-foreground self-center ml-1">
                Manage global toggles in the{' '}
                <button
                  type="button"
                  onClick={() => setActiveSection('preferences')}
                  className="text-primary underline underline-offset-2 hover:no-underline"
                >
                  Alert Preferences
                </button>{' '}
                tab.
              </p>
            </div>
          </div>

          {/* Per-alert-type matrix */}
          <div className="bg-card rounded-lg border border-border shadow-card p-5">
            <SectionHeader
              icon={<Sliders size={18} />}
              title="Alert Type Channel Matrix"
              description="Toggle channels per alert type and add custom recipients. Click the person icon to expand recipients."
            />

            <div className="space-y-2">
              {ALERT_TYPES.map((at) => {
                const channelConfig =
                  prefs.alertChannelConfig[at.key] ?? defaultAlertChannelConfig()[at.key]!;
                const recipients =
                  prefs.alertRecipients[at.key] ?? defaultAlertRecipients()[at.key]!;
                const alertEnabled = prefs[at.prefKey] as boolean;

                return (
                  <AlertTypeRow
                    key={at.key}
                    alertKey={at.key}
                    icon={at.icon}
                    label={at.label}
                    description={at.description}
                    alertEnabled={alertEnabled}
                    channelConfig={channelConfig}
                    recipients={recipients}
                    onChannelChange={handleChannelChange}
                    onRecipientsChange={handleRecipientsChange}
                    globalEmailEnabled={prefs.emailEnabled}
                    globalSmsEnabled={globalSmsEnabled}
                    globalInappEnabled={prefs.inappEnabled}
                  />
                );
              })}
            </div>
          </div>

          {/* Frequency reminder */}
          <div className="bg-card rounded-lg border border-border shadow-card p-5">
            <SectionHeader
              icon={<Clock size={18} />}
              title="Delivery Frequency"
              description="How often bundled notifications are sent across all channels."
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
        </>
      )}

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
