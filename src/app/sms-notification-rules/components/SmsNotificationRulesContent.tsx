'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell, Plus, Trash2, Save, RefreshCw, Phone, User, Shield,
  AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp,
  MessageSquare, Info, Loader2, ToggleLeft, ToggleRight,
} from 'lucide-react';
import {
  smsNotificationRulesService,
  type SmsNotificationRule,
  type SmsRecipient,
  type SmsEventType,
  type SmsSeverity,
} from '@/lib/supabase/smsNotificationRulesService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


// ─── Config ───────────────────────────────────────────────────────────────────

const EVENT_META: Record<SmsEventType, { icon: React.ElementType; color: string; bg: string; border: string }> = {
  COVENANT_BREACH: {
    icon: AlertTriangle,
    color: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
  OVERDUE_ACTION: {
    icon: RefreshCw,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
  STATUS_CHANGE: {
    icon: Bell,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
};

const SEVERITY_OPTIONS: { value: SmsSeverity; label: string; desc: string }[] = [
  { value: 'all', label: 'All Events', desc: 'Notify for every occurrence' },
  { value: 'high', label: 'High & Critical', desc: 'Skip low-priority events' },
  { value: 'critical', label: 'Critical Only', desc: 'Only the most urgent events' },
];

// ─── Recipient Row ────────────────────────────────────────────────────────────

interface RecipientRowProps {
  recipient: SmsRecipient;
  index: number;
  onChange: (index: number, field: keyof SmsRecipient, value: string) => void;
  onRemove: (index: number) => void;
}

function RecipientRow({ recipient, index, onChange, onRemove }: RecipientRowProps) {
  return (
    <div className="flex items-center gap-2 p-2.5 bg-muted/20 rounded-lg border border-border">
      <div className="flex-1 grid grid-cols-3 gap-2">
        <div className="relative">
          <User size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={recipient.name}
            onChange={(e) => onChange(index, 'name', e.target.value)}
            placeholder="Officer name"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="relative">
          <Phone size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="tel"
            value={recipient.phone}
            onChange={(e) => onChange(index, 'phone', e.target.value)}
            placeholder="+255712345678"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
        <div className="relative">
          <Shield size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={recipient.role ?? ''}
            onChange={(e) => onChange(index, 'role', e.target.value)}
            placeholder="Role (optional)"
            className="w-full pl-7 pr-2 py-1.5 text-xs border border-border rounded-md bg-background focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>
      <button
        onClick={() => onRemove(index)}
        className="shrink-0 p-1.5 rounded-md text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
        title="Remove recipient"
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: SmsNotificationRule;
  onSave: (rule: SmsNotificationRule) => Promise<void>;
  saving: boolean;
}

function RuleCard({ rule, onSave, saving }: RuleCardProps) {
  const meta = EVENT_META[rule.eventType] ?? EVENT_META.STATUS_CHANGE;
  const Icon = meta.icon;

  const [expanded, setExpanded] = useState(false);
  const [local, setLocal] = useState<SmsNotificationRule>(rule);

  useEffect(() => {
    setLocal(rule);
  }, [rule]);

  const handleToggleEnabled = () => {
    setLocal((prev) => ({ ...prev, isEnabled: !prev.isEnabled }));
  };

  const handleAddRecipient = () => {
    setLocal((prev) => ({
      ...prev,
      recipients: [...prev.recipients, { name: '', phone: '', role: '' }],
    }));
    setExpanded(true);
  };

  const handleRecipientChange = (index: number, field: keyof SmsRecipient, value: string) => {
    setLocal((prev) => {
      const updated = [...prev.recipients];
      updated[index] = { ...updated[index], [field]: value };
      return { ...prev, recipients: updated };
    });
  };

  const handleRemoveRecipient = (index: number) => {
    setLocal((prev) => ({
      ...prev,
      recipients: prev.recipients.filter((_, i) => i !== index),
    }));
  };

  const isDirty =
    local.isEnabled !== rule.isEnabled ||
    local.minSeverity !== rule.minSeverity ||
    JSON.stringify(local.recipients) !== JSON.stringify(rule.recipients);

  const validRecipients = local.recipients.filter((r) => r.name.trim() && r.phone.trim());

  return (
    <div className={`rounded-xl border ${meta.border} bg-card overflow-hidden`}>
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <div className={`shrink-0 w-9 h-9 rounded-lg flex items-center justify-center ${meta.bg} border ${meta.border}`}>
          <Icon size={16} className={meta.color} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-foreground">{rule.eventLabel}</span>
            <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded border uppercase tracking-wide ${meta.bg} ${meta.color} ${meta.border}`}>
              {rule.eventType.replace(/_/g, ' ')}
            </span>
            {local.isEnabled && (
              <span className="text-[10px] font-600 px-1.5 py-0.5 rounded border uppercase tracking-wide bg-emerald-50 text-emerald-700 border-emerald-200">
                Active
              </span>
            )}
          </div>
          {rule.description && (
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{rule.description}</p>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Recipient count badge */}
          <span className="text-xs text-muted-foreground">
            {rule.recipients.length} recipient{rule.recipients.length !== 1 ? 's' : ''}
          </span>

          {/* Toggle */}
          <button
            onClick={handleToggleEnabled}
            className={`transition-colors ${local.isEnabled ? 'text-emerald-600' : 'text-muted-foreground'}`}
            title={local.isEnabled ? 'Disable' : 'Enable'}
          >
            {local.isEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>

          {/* Expand */}
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>
      </div>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-4">
          {/* Severity */}
          <div>
            <label className="block text-xs font-600 text-foreground/70 mb-2">Minimum Severity</label>
            <div className="flex gap-2 flex-wrap">
              {SEVERITY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setLocal((prev) => ({ ...prev, minSeverity: opt.value }))}
                  className={`px-3 py-1.5 rounded-lg text-xs font-500 border transition-colors ${
                    local.minSeverity === opt.value
                      ? 'bg-primary text-white border-primary' :'bg-background text-muted-foreground border-border hover:bg-muted/30'
                  }`}
                  title={opt.desc}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Recipients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-600 text-foreground/70">
                SMS Recipients ({validRecipients.length} valid)
              </label>
              <button
                onClick={handleAddRecipient}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-500 text-primary border border-primary/30 rounded-lg hover:bg-primary/5 transition-colors"
              >
                <Plus size={11} />
                Add Officer
              </button>
            </div>

            {local.recipients.length === 0 ? (
              <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-dashed border-border text-xs text-muted-foreground">
                <Info size={13} />
                No recipients configured. Add officers to receive SMS alerts for this event.
              </div>
            ) : (
              <div className="space-y-2">
                {local.recipients.map((r, i) => (
                  <RecipientRow
                    key={i}
                    recipient={r}
                    index={i}
                    onChange={handleRecipientChange}
                    onRemove={handleRemoveRecipient}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Save */}
          <div className="flex items-center justify-between pt-1">
            <div className="text-xs text-muted-foreground">
              {isDirty ? (
                <span className="text-amber-600 font-500">Unsaved changes</span>
              ) : (
                <span className="text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 size={11} /> Saved
                </span>
              )}
            </div>
            <button
              onClick={() => onSave(local)}
              disabled={saving || !isDirty}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              Save Rule
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function SmsNotificationRulesContent() {
  const { userProfile } = useAuth();
  const [rules, setRules] = useState<SmsNotificationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await smsNotificationRulesService.listRules();
      setRules(data);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load notification rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = async (updated: SmsNotificationRule) => {
    setSavingId(updated.id);
    setError(null);
    try {
      const saved = await smsNotificationRulesService.updateRule(
        updated.id,
        {
          isEnabled: updated.isEnabled,
          recipients: updated.recipients.filter((r) => r.name.trim() && r.phone.trim()),
          minSeverity: updated.minSeverity,
        },
        userProfile?.id
      );
      setRules((prev) => prev.map((r) => (r.id === saved.id ? saved : r)));
      setSuccessMsg(`"${saved.eventLabel}" rule saved successfully.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (e: any) {
      setError(e.message ?? 'Failed to save rule');
    } finally {
      setSavingId(null);
    }
  };

  const totalRecipients = rules.reduce((sum, r) => sum + r.recipients.length, 0);
  const enabledCount = rules.filter((r) => r.isEnabled).length;

  return (
    <div className="p-6 space-y-6 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <MessageSquare size={20} className="text-primary" />
            <h1 className="text-xl font-bold text-foreground">SMS Notification Rules</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure which officers receive real-time SMS alerts for critical collateral events via Twilio.
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors"
          title="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Event Rules', value: rules.length, color: 'text-foreground', bg: 'bg-muted/30' },
          { label: 'Active Rules', value: enabledCount, color: 'text-emerald-700', bg: 'bg-emerald-50' },
          { label: 'Total Recipients', value: totalRecipients, color: 'text-blue-700', bg: 'bg-blue-50' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 border border-border`}>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-muted-foreground mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-sm text-blue-800">
        <Info size={16} className="shrink-0 mt-0.5 text-blue-600" />
        <div>
          <span className="font-semibold">Twilio SMS is active.</span>{' '}
          Rules below define who gets notified and for which events. SMS messages are sent automatically when events occur — no manual action needed.
        </div>
      </div>

      {/* Feedback */}
      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={14} />
          {error}
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-700">
          <CheckCircle2 size={14} />
          {successMsg}
        </div>
      )}

      {/* Rules */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-muted-foreground">
          <Loader2 size={20} className="animate-spin mr-2" />
          Loading notification rules…
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Bell size={32} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No notification rules found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onSave={handleSave}
              saving={savingId === rule.id}
            />
          ))}
        </div>
      )}

      {/* Footer note */}
      <div className="flex items-start gap-2 p-3 bg-muted/20 rounded-lg border border-border text-xs text-muted-foreground">
        <Info size={12} className="shrink-0 mt-0.5" />
        <span>
          Phone numbers must be in international format (e.g. <code className="font-mono">+255712345678</code>).
          SMS delivery is logged in <strong>Alerts Delivery</strong>. Twilio credentials are managed via environment variables.
        </span>
      </div>
    </div>
  );
}
