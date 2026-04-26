'use client';

import React, { useState, useEffect } from 'react';
import {
  Mail,
  Save,
  CheckCircle2,
  Loader2,
  AlertTriangle,
  Eye,
  EyeOff,
  ChevronDown,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  emailProviderService,
  EmailProviderConfig,
  EmailProviderType,
} from '@/lib/supabase/emailProviderService';

// ─── Provider Definitions ─────────────────────────────────────────────────────

interface ProviderMeta {
  id: EmailProviderType;
  name: string;
  description: string;
  docsUrl: string;
  color: string;
  fields: { key: keyof EmailProviderConfig; label: string; placeholder: string; isSecret?: boolean }[];
}

const PROVIDERS: ProviderMeta[] = [
  {
    id: 'resend',
    name: 'Resend',
    description: 'Developer-first transactional email API. Simple, reliable, and fast.',
    docsUrl: 'https://resend.com/docs',
    color: 'bg-black',
    fields: [
      { key: 'resendApiKey', label: 'API Key', placeholder: 're_xxxxxxxxxxxxxxxxxxxx', isSecret: true },
      { key: 'resendFromEmail', label: 'From Email', placeholder: 'noreply@yourdomain.com' },
    ],
  },
  {
    id: 'sendgrid',
    name: 'SendGrid',
    description: 'High-volume transactional email delivery with advanced analytics.',
    docsUrl: 'https://docs.sendgrid.com',
    color: 'bg-[#1A82E2]',
    fields: [
      { key: 'sendgridApiKey', label: 'API Key', placeholder: 'SG.xxxxxxxxxxxxxxxxxxxx', isSecret: true },
      { key: 'sendgridFromEmail', label: 'From Email', placeholder: 'noreply@yourdomain.com' },
    ],
  },
  {
    id: 'brevo',
    name: 'Brevo',
    description: 'All-in-one email platform with marketing automation and transactional emails.',
    docsUrl: 'https://developers.brevo.com',
    color: 'bg-[#0B996E]',
    fields: [
      { key: 'brevoApiKey', label: 'API Key', placeholder: 'xkeysib-xxxxxxxxxxxxxxxxxxxx', isSecret: true },
      { key: 'brevoFromEmail', label: 'From Email', placeholder: 'noreply@yourdomain.com' },
    ],
  },
];

// ─── Secret Input ─────────────────────────────────────────────────────────────

function SecretInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-3 py-2 pr-10 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
      />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
      >
        {visible ? <EyeOff size={15} /> : <Eye size={15} />}
      </button>
    </div>
  );
}

// ─── Provider Card ────────────────────────────────────────────────────────────

interface ProviderCardProps {
  provider: ProviderMeta;
  isActive: boolean;
  config: EmailProviderConfig;
  onSelect: () => void;
  onFieldChange: (key: keyof EmailProviderConfig, value: string) => void;
}

function ProviderCard({ provider, isActive, config, onSelect, onFieldChange }: ProviderCardProps) {
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive) setExpanded(true);
  }, [isActive]);

  return (
    <div
      className={`rounded-lg border transition-all duration-200 overflow-hidden ${
        isActive
          ? 'border-primary shadow-sm bg-card'
          : 'border-border bg-card hover:border-primary/40'
      }`}
    >
      {/* Card Header */}
      <div
        className="flex items-center gap-4 p-4 cursor-pointer"
        onClick={() => {
          onSelect();
          setExpanded(true);
        }}
      >
        {/* Radio */}
        <div
          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
            isActive ? 'border-primary' : 'border-border'
          }`}
        >
          {isActive && <div className="w-2 h-2 rounded-full bg-primary" />}
        </div>

        {/* Provider Badge */}
        <div
          className={`w-8 h-8 rounded-md ${provider.color} flex items-center justify-center shrink-0`}
        >
          <Mail size={14} className="text-white" />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground">{provider.name}</p>
            {isActive && (
              <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                Active
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate">{provider.description}</p>
        </div>

        {/* Expand toggle */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            setExpanded((v) => !v);
          }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown
            size={16}
            className={`transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`}
          />
        </button>
      </div>

      {/* Credentials Form */}
      {expanded && (
        <div className="px-4 pb-4 border-t border-border/60 pt-4 space-y-3">
          {provider.fields.map((field) => (
            <div key={field.key}>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                {field.label}
              </label>
              {field.isSecret ? (
                <SecretInput
                  value={(config[field.key] as string) ?? ''}
                  onChange={(v) => onFieldChange(field.key, v)}
                  placeholder={field.placeholder}
                />
              ) : (
                <input
                  type="text"
                  value={(config[field.key] as string) ?? ''}
                  onChange={(e) => onFieldChange(field.key, e.target.value)}
                  placeholder={field.placeholder}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                />
              )}
            </div>
          ))}
          <a
            href={provider.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
          >
            View {provider.name} docs →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EmailProviderSettingsContent() {
  const { user } = useAuth();
  const [config, setConfig] = useState<EmailProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    emailProviderService.getConfig().then((c) => {
      setConfig(c);
      setLoading(false);
    });
  }, []);

  const handleProviderSelect = (provider: EmailProviderType) => {
    setConfig((prev) => prev ? { ...prev, activeProvider: provider } : prev);
    setSaved(false);
  };

  const handleFieldChange = (key: keyof EmailProviderConfig, value: string) => {
    setConfig((prev) => prev ? { ...prev, [key]: value } : prev);
    setSaved(false);
  };

  const handleSave = async () => {
    if (!config || !user?.id) return;
    setSaving(true);
    setError(null);
    const result = await emailProviderService.saveConfig(config, user.id);
    setSaving(false);
    if (result) {
      setConfig(result);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } else {
      setError('Failed to save configuration. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (!config) return null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Email Provider</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Select the active email provider and enter its API credentials. All notification emails will be routed through the active provider.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60 shrink-0"
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

      {/* Active Provider Banner */}
      <div className="flex items-center gap-3 px-4 py-3 bg-primary/5 border border-primary/20 rounded-lg">
        <Mail size={16} className="text-primary shrink-0" />
        <p className="text-sm text-foreground">
          Currently routing emails through{' '}
          <span className="font-semibold capitalize">{config.activeProvider}</span>.
          Select a different provider below to switch.
        </p>
      </div>

      {/* Provider Cards */}
      <div className="space-y-3">
        {PROVIDERS.map((provider) => (
          <ProviderCard
            key={provider.id}
            provider={provider}
            isActive={config.activeProvider === provider.id}
            config={config}
            onSelect={() => handleProviderSelect(provider.id)}
            onFieldChange={handleFieldChange}
          />
        ))}
      </div>

      {/* Info Note */}
      <p className="text-xs text-muted-foreground">
        API keys are stored securely in your Supabase database. Only System Admins can view or modify these settings.
      </p>
    </div>
  );
}
