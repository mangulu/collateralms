'use client';
import React, { useState, useEffect, useCallback } from 'react';
import AppLayout from '@/components/AppLayout';
import RegistrySettingsContent from './components/RegistrySettingsContent';
import RegistriesSettingsContent from './components/RegistriesSettingsContent';
import DocumentTypesSettingsContent from './components/DocumentTypesSettingsContent';
import CollateralTypesSettingsContent from './components/CollateralTypesSettingsContent';
import NotificationSettingsContent from './components/NotificationSettingsContent';
import EmailProviderSettingsContent from './components/EmailProviderSettingsContent';
import CollateralTypeDocumentsSettingsContent from './components/CollateralTypeDocumentsSettingsContent';
import { usePathname } from 'next/navigation';
import {
  Settings,
  Bell,
  Mail,
  Lock,
  Building2,
  FileText,
  Layers,
  Link2,
  Sliders,
  Archive,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import {
  fetchSystemConfig,
  updateSystemConfig,
  SystemConfigRecord,
} from '@/lib/supabase/systemConfigService';
import { useAuth } from '@/contexts/AuthContext';

// ─── System Config Types & Definitions ───────────────────────────────────────

type ConfigCategory = 'bank' | 'registry' | 'notifications' | 'thresholds' | 'retention';

interface TabDef {
  id: ConfigCategory;
  label: string;
  icon: React.ReactNode;
  configKey: string;
  description: string;
}

const CONFIG_TABS: TabDef[] = [
  {
    id: 'bank',
    label: 'Bank Details',
    icon: <Building2 size={15} />,
    configKey: 'bank_details',
    description: 'Bank identification and contact information used in reports and correspondence.',
  },
  {
    id: 'registry',
    label: 'BRELA Registry URLs',
    icon: <Link2 size={15} />,
    configKey: 'brela_registry_urls',
    description: 'BRELA API endpoints and connection settings for company and charge registry lookups.',
  },
  {
    id: 'notifications',
    label: 'Email Templates',
    icon: <Mail size={15} />,
    configKey: 'email_templates',
    description: 'Email subject lines and body templates for automated notifications. Use {{variable}} placeholders.',
  },
  {
    id: 'thresholds',
    label: 'Threshold Values',
    icon: <Sliders size={15} />,
    configKey: 'default_thresholds',
    description: 'System-wide default thresholds for alerts, LTV ratios, and compliance scoring.',
  },
  {
    id: 'retention',
    label: 'Retention Policies',
    icon: <Archive size={15} />,
    configKey: 'document_retention',
    description: 'Data retention periods (in years) for different document categories per regulatory requirements.',
  },
];

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'url' | 'number' | 'textarea' | 'boolean';
  placeholder?: string;
  hint?: string;
}

const FIELD_DEFS: Record<ConfigCategory, FieldDef[]> = {
  bank: [
    { key: 'bank_name', label: 'Bank Name', type: 'text', placeholder: 'e.g. EXIM Bank Tanzania' },
    { key: 'branch_name', label: 'Branch Name', type: 'text', placeholder: 'e.g. Head Office' },
    { key: 'branch_code', label: 'Branch Code', type: 'text', placeholder: 'e.g. 001' },
    { key: 'swift_code', label: 'SWIFT / BIC Code', type: 'text', placeholder: 'e.g. EXTNTZTZ' },
    { key: 'account_number', label: 'Account Number', type: 'text', placeholder: 'Bank account number' },
    { key: 'sort_code', label: 'Sort Code', type: 'text', placeholder: 'Sort / routing code' },
    { key: 'contact_email', label: 'Contact Email', type: 'email', placeholder: 'collateral@bank.co.tz' },
    { key: 'contact_phone', label: 'Contact Phone', type: 'text', placeholder: '+255 22 211 0000' },
    { key: 'physical_address', label: 'Physical Address', type: 'textarea', placeholder: 'Street, City, Country' },
  ],
  registry: [
    { key: 'base_url', label: 'Base URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1' },
    { key: 'company_search_url', label: 'Company Search URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1/companies/search' },
    { key: 'certificate_verify_url', label: 'Certificate Verify URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1/certificates/verify' },
    { key: 'charges_registry_url', label: 'Charges Registry URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1/charges' },
    { key: 'api_timeout_seconds', label: 'API Timeout (seconds)', type: 'number', placeholder: '30', hint: 'Maximum seconds to wait for BRELA API response' },
    { key: 'retry_attempts', label: 'Retry Attempts', type: 'number', placeholder: '3', hint: 'Number of retries on failed API calls' },
    { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-domain.com/webhooks/brela', hint: 'Optional: URL to receive BRELA push notifications' },
  ],
  notifications: [
    { key: 'sender_name', label: 'Sender Name', type: 'text', placeholder: 'CollateralMS – EXIM Bank' },
    { key: 'sender_email', label: 'Sender Email', type: 'email', placeholder: 'noreply@bank.co.tz' },
    { key: 'reply_to_email', label: 'Reply-To Email', type: 'email', placeholder: 'collateral@bank.co.tz' },
    { key: 'perfection_due_subject', label: 'Perfection Due – Subject', type: 'text', placeholder: 'Collateral Perfection Due: {{collateral_id}}' },
    { key: 'perfection_due_body', label: 'Perfection Due – Body', type: 'textarea', placeholder: 'Email body with {{variable}} placeholders' },
    { key: 'overdue_subject', label: 'Overdue – Subject', type: 'text', placeholder: 'OVERDUE: Collateral {{collateral_id}} Requires Immediate Action' },
    { key: 'overdue_body', label: 'Overdue – Body', type: 'textarea', placeholder: 'Email body with {{variable}} placeholders' },
    { key: 'approval_subject', label: 'Approval – Subject', type: 'text', placeholder: 'Collateral {{collateral_id}} Approved' },
    { key: 'approval_body', label: 'Approval – Body', type: 'textarea', placeholder: 'Email body with {{variable}} placeholders' },
    { key: 'rejection_subject', label: 'Rejection – Subject', type: 'text', placeholder: 'Collateral {{collateral_id}} Requires Revision' },
    { key: 'rejection_body', label: 'Rejection – Body', type: 'textarea', placeholder: 'Email body with {{variable}} placeholders' },
  ],
  thresholds: [
    { key: 'perfection_due_days', label: 'Perfection Due Warning (days)', type: 'number', hint: 'Days before due date to start showing warnings' },
    { key: 'perfection_warning_days', label: 'Perfection Urgent Warning (days)', type: 'number', hint: 'Days before due date to escalate to urgent' },
    { key: 'overdue_escalation_days', label: 'Overdue Escalation (days)', type: 'number', hint: 'Days overdue before escalating to senior management' },
    { key: 'ltv_warning_percent', label: 'LTV Warning Threshold (%)', type: 'number', hint: 'Loan-to-Value ratio that triggers a warning alert' },
    { key: 'ltv_critical_percent', label: 'LTV Critical Threshold (%)', type: 'number', hint: 'Loan-to-Value ratio that triggers a critical alert' },
    { key: 'valuation_refresh_months', label: 'Valuation Refresh Period (months)', type: 'number', hint: 'How often collateral valuations must be refreshed' },
    { key: 'document_expiry_warning_days', label: 'Document Expiry Warning (days)', type: 'number', hint: 'Days before document expiry to show warning' },
    { key: 'fraud_score_alert_threshold', label: 'Fraud Score Alert Threshold (0–100)', type: 'number', hint: 'AI fraud score above this value triggers an alert' },
    { key: 'compliance_score_minimum', label: 'Minimum Compliance Score (%)', type: 'number', hint: 'Minimum acceptable compliance score before flagging' },
    { key: 'batch_release_max_items', label: 'Batch Release Max Items', type: 'number', hint: 'Maximum collateral items per batch release operation' },
  ],
  retention: [
    { key: 'active_collateral_years', label: 'Active Collateral Records (years)', type: 'number', hint: 'Retention period for active collateral records' },
    { key: 'released_collateral_years', label: 'Released Collateral Records (years)', type: 'number', hint: 'Retention period after collateral is released' },
    { key: 'audit_log_years', label: 'Audit Logs (years)', type: 'number', hint: 'Retention period for system audit logs' },
    { key: 'perfection_records_years', label: 'Perfection Records (years)', type: 'number', hint: 'Retention period for perfection workflow records' },
    { key: 'correspondence_years', label: 'Correspondence (years)', type: 'number', hint: 'Retention period for email and letter correspondence' },
    { key: 'valuation_reports_years', label: 'Valuation Reports (years)', type: 'number', hint: 'Retention period for collateral valuation reports' },
    { key: 'legal_documents_years', label: 'Legal Documents (years)', type: 'number', hint: 'Retention period for legal and title documents' },
    { key: 'auto_archive_enabled', label: 'Auto-Archive Enabled', type: 'boolean', hint: 'Automatically archive documents when retention period is reached' },
    { key: 'auto_delete_enabled', label: 'Auto-Delete Enabled', type: 'boolean', hint: 'Automatically delete archived documents after retention period' },
    { key: 'archive_storage_path', label: 'Archive Storage Path', type: 'text', placeholder: 'archive/', hint: 'Storage bucket path prefix for archived documents' },
    { key: 'retention_review_months', label: 'Retention Review Interval (months)', type: 'number', hint: 'How often retention policies should be reviewed' },
  ],
};

// ─── Field Input Component ────────────────────────────────────────────────────

interface FieldInputProps {
  field: FieldDef;
  value: unknown;
  onChange: (key: string, value: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const baseInput =
    'w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';

  if (field.type === 'boolean') {
    return (
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => onChange(field.key, !value)}
          className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
            value ? 'bg-primary' : 'bg-muted-foreground/30'
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
              value ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </button>
        <span className="text-sm text-muted-foreground">{value ? 'Enabled' : 'Disabled'}</span>
      </div>
    );
  }

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={4}
        value={String(value ?? '')}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        className={`${baseInput} resize-y min-h-[80px] font-mono text-xs`}
      />
    );
  }

  return (
    <input
      type={field.type === 'url' ? 'text' : field.type}
      value={String(value ?? '')}
      onChange={(e) =>
        onChange(
          field.key,
          field.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value
        )
      }
      placeholder={field.placeholder}
      className={baseInput}
    />
  );
}

// ─── Config Section Component ─────────────────────────────────────────────────

interface ConfigSectionProps {
  tab: TabDef;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  onSave: () => void;
  saving: boolean;
  saved: boolean;
  error: string | null;
  lastUpdated: string | null;
}

function ConfigSection({ tab, values, onChange, onSave, saving, saved, error, lastUpdated }: ConfigSectionProps) {
  const fields = FIELD_DEFS[tab.id];
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  const textareaFields = fields.filter((f) => f.type === 'textarea');
  const regularFields = fields.filter((f) => f.type !== 'textarea');
  const hasTemplates = textareaFields.length > 0;

  const toggleGroup = (group: string) =>
    setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
            <span className="text-primary">{tab.icon}</span>
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">{tab.label}</h2>
            <p className="text-sm text-muted-foreground mt-0.5 max-w-2xl">{tab.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {lastUpdated && (
            <span className="text-xs text-muted-foreground hidden sm:block">
              Last saved: {new Date(lastUpdated).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : saved ? <CheckCircle2 size={14} /> : <Save size={14} />}
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <AlertTriangle size={14} />
          {error}
        </div>
      )}
      {saved && !error && (
        <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          <CheckCircle2 size={14} />
          Configuration saved successfully.
        </div>
      )}

      <div className="bg-card border border-border rounded-lg p-5">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
          {regularFields.map((field) => (
            <div key={field.key} className={field.type === 'boolean' ? 'flex flex-col gap-1' : ''}>
              <label className="block text-xs font-medium text-foreground mb-1">{field.label}</label>
              <FieldInput field={field} value={values[field.key]} onChange={onChange} />
              {field.hint && (
                <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                  <Info size={11} className="mt-0.5 shrink-0" />
                  {field.hint}
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {hasTemplates && (
        <div className="space-y-3">
          {textareaFields.map((field) => {
            const isOpen = expandedGroups[field.key] !== false;
            return (
              <div key={field.key} className="bg-card border border-border rounded-lg overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggleGroup(field.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors"
                >
                  <span>{field.label}</span>
                  {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>
                {isOpen && (
                  <div className="px-4 pb-4 border-t border-border/50">
                    <div className="mt-3">
                      <FieldInput field={field} value={values[field.key]} onChange={onChange} />
                      {field.hint && (
                        <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
                          <Info size={11} className="mt-0.5 shrink-0" />
                          {field.hint}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Tab Definitions ──────────────────────────────────────────────────────────

type SettingsTab =
  | 'document-types'
  | 'collateral-type-documents' |'registries' |'collateral-types' |'notifications' |'email-provider' |'registry-integrations' |'bank' |'registry' |'notifications-config' |'thresholds' |'retention';

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SettingsPage() {
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState<SettingsTab>('document-types');
  const { hasPermission, loading, permissions } = usePermissions();
  const { userProfile } = useAuth();

  // System config state
  const [configs, setConfigs] = useState<Record<string, SystemConfigRecord>>({});
  const [localValues, setLocalValues] = useState<Record<ConfigCategory, Record<string, unknown>>>({
    bank: {},
    registry: {},
    notifications: {},
    thresholds: {},
    retention: {},
  });
  const [configLoading, setConfigLoading] = useState(false);
  const [saving, setSaving] = useState<ConfigCategory | null>(null);
  const [saved, setSaved] = useState<ConfigCategory | null>(null);
  const [errors, setErrors] = useState<Record<ConfigCategory, string | null>>({
    bank: null,
    registry: null,
    notifications: null,
    thresholds: null,
    retention: null,
  });

  const isAdvancedTab = (tab: SettingsTab): tab is ConfigCategory =>
    ['bank', 'registry', 'notifications-config', 'thresholds', 'retention'].includes(tab);

  const configCategoryForTab = (tab: SettingsTab): ConfigCategory | null => {
    if (tab === 'notifications-config') return 'notifications';
    if (['bank', 'registry', 'thresholds', 'retention'].includes(tab)) return tab as ConfigCategory;
    return null;
  };

  const loadConfigs = useCallback(async () => {
    try {
      setConfigLoading(true);
      const records = await fetchSystemConfig();
      const configMap: Record<string, SystemConfigRecord> = {};
      const valuesMap: Record<ConfigCategory, Record<string, unknown>> = {
        bank: {},
        registry: {},
        notifications: {},
        thresholds: {},
        retention: {},
      };
      records.forEach((rec) => {
        configMap[rec.configKey] = rec;
        const tabDef = CONFIG_TABS.find((t) => t.configKey === rec.configKey);
        if (tabDef) {
          valuesMap[tabDef.id] = rec.configValue as Record<string, unknown>;
        }
      });
      setConfigs(configMap);
      setLocalValues(valuesMap);
    } catch {
      // silently fail
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    if (permissions.has(PERMISSIONS.SETTINGS_MANAGE)) {
      loadConfigs();
    }
  }, [loadConfigs, permissions]);

  const handleConfigChange = (category: ConfigCategory, key: string, value: unknown) => {
    setLocalValues((prev) => ({ ...prev, [category]: { ...prev[category], [key]: value } }));
    if (saved === category) setSaved(null);
  };

  const handleConfigSave = async (category: ConfigCategory) => {
    const tabDef = CONFIG_TABS.find((t) => t.id === category);
    if (!tabDef || !userProfile?.id) return;
    setSaving(category);
    setErrors((prev) => ({ ...prev, [category]: null }));
    setSaved(null);
    try {
      await updateSystemConfig(tabDef.configKey, localValues[category], userProfile.id);
      setSaved(category);
      await loadConfigs();
      setTimeout(() => setSaved(null), 3000);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [category]: err instanceof Error ? err.message : 'Failed to save configuration.',
      }));
    } finally {
      setSaving(null);
    }
  };

  const configTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'document-types', label: 'Document Types', icon: <FileText size={15} /> },
    { id: 'collateral-type-documents', label: 'Required Documents', icon: <Layers size={15} /> },
    { id: 'registries', label: 'Registries', icon: <Building2 size={15} /> },
    { id: 'collateral-types', label: 'Collateral Types', icon: <Layers size={15} /> },
  ];

  const systemTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'notifications', label: 'Notifications', icon: <Bell size={15} /> },
    { id: 'email-provider', label: 'Email Provider', icon: <Mail size={15} /> },
    { id: 'registry-integrations', label: 'Registry Integrations', icon: <Link2 size={15} /> },
  ];

  const advancedTabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: 'bank', label: 'Bank Details', icon: <Building2 size={15} /> },
    { id: 'registry', label: 'BRELA Registry URLs', icon: <Link2 size={15} /> },
    { id: 'notifications-config', label: 'Email Templates', icon: <Mail size={15} /> },
    { id: 'thresholds', label: 'Threshold Values', icon: <Sliders size={15} /> },
    { id: 'retention', label: 'Retention Policies', icon: <Archive size={15} /> },
  ];

  const canManage = hasPermission(PERMISSIONS.SETTINGS_MANAGE);

  const renderTabGroup = (
    label: string,
    tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[]
  ) => (
    <div className="flex items-center">
      <span className="px-3 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider select-none">
        {label}
      </span>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
            activeTab === tab.id
              ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
          }`}
        >
          {tab.icon}
          {tab.label}
        </button>
      ))}
    </div>
  );

  return (
    <AppLayout currentPath={pathname}>
      {!loading && !hasPermission(PERMISSIONS.SETTINGS_VIEW) ? (
        <div className="flex flex-col items-center justify-center h-full min-h-[60vh] text-center px-4">
          <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
            <Lock size={24} className="text-muted-foreground" />
          </div>
          <h3 className="text-base font-600 text-foreground mb-1">Access Restricted</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            You do not have permission to view System Settings.
          </p>
        </div>
      ) : (
        <div className="space-y-0">
          {/* Page Header */}
          <div className="px-6 pt-6 pb-0">
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                <Settings size={18} className="text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-700 text-foreground">System Settings</h1>
                <p className="text-sm text-muted-foreground">Configure document types, registries, notifications, and advanced system options</p>
              </div>
            </div>
          </div>

          {/* Tab Bar */}
          <div className="flex flex-wrap items-end gap-0 border-b border-border overflow-x-auto px-6 mt-4">
            {renderTabGroup('Configuration', configTabs)}
            <div className="w-px h-6 bg-border mx-1 self-center" />
            {renderTabGroup('System', systemTabs)}
            {canManage && (
              <>
                <div className="w-px h-6 bg-border mx-1 self-center" />
                {renderTabGroup('Advanced', advancedTabs)}
              </>
            )}
          </div>

          {/* Tab Content */}
          <div className="px-6 py-6">
          {activeTab === 'document-types' && <DocumentTypesSettingsContent />}
          {activeTab === 'collateral-type-documents' && <CollateralTypeDocumentsSettingsContent />}
          {activeTab === 'registries' && <RegistriesSettingsContent />}
          {activeTab === 'collateral-types' && <CollateralTypesSettingsContent />}
          {activeTab === 'notifications' && <NotificationSettingsContent />}
          {activeTab === 'email-provider' && (
            canManage ? (
              <EmailProviderSettingsContent />
            ) : (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <Lock size={20} className="text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">
                  Managing email provider requires Settings Manage permission.
                </p>
              </div>
            )
          )}
          {activeTab === 'registry-integrations' && <RegistrySettingsContent />}

          {/* Advanced / System Config tabs */}
          {canManage && (['bank', 'registry', 'notifications-config', 'thresholds', 'retention'] as SettingsTab[]).includes(activeTab) && (() => {
            const category = activeTab === 'notifications-config' ? 'notifications' : activeTab as ConfigCategory;
            const tabDef = CONFIG_TABS.find((t) => t.id === category)!;
            return configLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
                ))}
              </div>
            ) : (
              <ConfigSection
                tab={tabDef}
                values={localValues[category]}
                onChange={(key, value) => handleConfigChange(category, key, value)}
                onSave={() => handleConfigSave(category)}
                saving={saving === category}
                saved={saved === category}
                error={errors[category]}
                lastUpdated={configs[tabDef.configKey]?.updatedAt ?? null}
              />
            );
          })()}
          </div>
        </div>
      )}
    </AppLayout>
  );
}
