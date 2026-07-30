'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Link2,
  Mail,
  Sliders,
  Archive,
  Save,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Settings2,
  Info,
  Palette,
  Eye } from
'lucide-react';
import {
  fetchSystemConfig,
  updateSystemConfig,
  SystemConfigRecord } from
'@/lib/supabase/systemConfigService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type ConfigCategory = 'bank' | 'registry' | 'notifications' | 'thresholds' | 'retention' | 'brand';

interface TabDef {
  id: ConfigCategory;
  label: string;
  icon: React.ReactNode;
  configKey: string;
  description: string;
}

const TABS: TabDef[] = [
{
  id: 'bank',
  label: 'Bank Details',
  icon: <Building2 size={15} />,
  configKey: 'bank_details',
  description: 'Bank identification and contact information used in reports and correspondence.'
},
{
  id: 'registry',
  label: 'BRELA Registry URLs',
  icon: <Link2 size={15} />,
  configKey: 'brela_registry_urls',
  description: 'BRELA API endpoints and connection settings for company and charge registry lookups.'
},
{
  id: 'notifications',
  label: 'Email Templates',
  icon: <Mail size={15} />,
  configKey: 'email_templates',
  description: 'Email subject lines and body templates for automated notifications. Use {{variable}} placeholders.'
},
{
  id: 'thresholds',
  label: 'Threshold Values',
  icon: <Sliders size={15} />,
  configKey: 'default_thresholds',
  description: 'System-wide default thresholds for alerts, LTV ratios, and compliance scoring.'
},
{
  id: 'retention',
  label: 'Retention Policies',
  icon: <Archive size={15} />,
  configKey: 'document_retention',
  description: 'Data retention periods (in years) for different document categories per regulatory requirements.'
},
{
  id: 'brand',
  label: 'Brand Kit',
  icon: <Palette size={15} />,
  configKey: 'brand_kit',
  description: 'White-label branding: bank name, logo URL, and color scheme applied globally via CSS variables.'
}];


// ─── Field Definitions ────────────────────────────────────────────────────────

interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'email' | 'url' | 'number' | 'textarea' | 'boolean' | 'color';
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
  { key: 'physical_address', label: 'Physical Address', type: 'textarea', placeholder: 'Street, City, Country' }],

  registry: [
  { key: 'base_url', label: 'Base URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1' },
  { key: 'company_search_url', label: 'Company Search URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1/companies/search' },
  { key: 'certificate_verify_url', label: 'Certificate Verify URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1/certificates/verify' },
  { key: 'charges_registry_url', label: 'Charges Registry URL', type: 'url', placeholder: 'https://api.brela.go.tz/v1/charges' },
  { key: 'api_timeout_seconds', label: 'API Timeout (seconds)', type: 'number', placeholder: '30', hint: 'Maximum seconds to wait for BRELA API response' },
  { key: 'retry_attempts', label: 'Retry Attempts', type: 'number', placeholder: '3', hint: 'Number of retries on failed API calls' },
  { key: 'webhook_url', label: 'Webhook URL', type: 'url', placeholder: 'https://your-domain.com/webhooks/brela', hint: 'Optional: URL to receive BRELA push notifications' }],

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
  { key: 'rejection_body', label: 'Rejection – Body', type: 'textarea', placeholder: 'Email body with {{variable}} placeholders' }],

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
  { key: 'batch_release_max_items', label: 'Batch Release Max Items', type: 'number', hint: 'Maximum collateral items per batch release operation' }],

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
  { key: 'retention_review_months', label: 'Retention Review Interval (months)', type: 'number', hint: 'How often retention policies should be reviewed' }],

  brand: [
  { key: 'bank_name', label: 'Bank / Client Name', type: 'text', placeholder: 'e.g. EXIM Bank Tanzania', hint: 'Displayed in the app header and login page' },
  { key: 'logo_url', label: 'Logo URL', type: 'url', placeholder: "https://img.rocket.new/generatedImages/rocket_gen_img_14265f36a-1768411597753.png", hint: 'Full URL to the bank logo image (PNG or SVG recommended)' },
  { key: 'primary_color', label: 'Primary Color', type: 'color', hint: 'Main brand color used for buttons, links, and highlights' },
  { key: 'accent_color', label: 'Accent Color', type: 'color', hint: 'Secondary color used for success states and accents' },
  { key: 'tagline', label: 'Tagline', type: 'text', placeholder: 'Collateral Lifecycle Management Platform', hint: 'Short tagline shown on the login page' }]

};

// ─── Hex to HSL conversion ────────────────────────────────────────────────────

function hexToHsl(hex: string): string {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!result) return '221 83% 53%';
  let r = parseInt(result[1], 16) / 255;
  let g = parseInt(result[2], 16) / 255;
  let b = parseInt(result[3], 16) / 255;
  const max = Math.max(r, g, b),min = Math.min(r, g, b);
  let h = 0,s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:h = ((g - b) / d + (g < b ? 6 : 0)) / 6;break;
      case g:h = ((b - r) / d + 2) / 6;break;
      case b:h = ((r - g) / d + 4) / 6;break;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

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
          value ? 'bg-primary' : 'bg-muted-foreground/30'}`
          }>
          
          <span
            className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
            value ? 'translate-x-4' : 'translate-x-0.5'}`
            } />
          
        </button>
        <span className="text-sm text-muted-foreground">{value ? 'Enabled' : 'Disabled'}</span>
      </div>);

  }

  if (field.type === 'color') {
    const colorVal = String(value ?? '#2563EB');
    return (
      <div className="flex items-center gap-3">
        <div className="relative">
          <input
            type="color"
            value={colorVal}
            onChange={(e) => onChange(field.key, e.target.value)}
            className="w-10 h-10 rounded-lg border border-border cursor-pointer p-0.5 bg-white" />
          
        </div>
        <input
          type="text"
          value={colorVal}
          onChange={(e) => onChange(field.key, e.target.value)}
          placeholder="#2563EB"
          className="flex-1 px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground font-mono focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors" />
        
        <div
          className="w-8 h-8 rounded-md border border-border shrink-0"
          style={{ backgroundColor: colorVal }}
          title="Color preview" />
        
      </div>);

  }

  if (field.type === 'textarea') {
    return (
      <textarea
        rows={4}
        value={String(value ?? '')}
        onChange={(e) => onChange(field.key, e.target.value)}
        placeholder={field.placeholder}
        className={`${baseInput} resize-y min-h-[80px] font-mono text-xs`} />);


  }

  return (
    <input
      type={field.type === 'url' ? 'text' : field.type}
      value={String(value ?? '')}
      onChange={(e) =>
      onChange(
        field.key,
        field.type === 'number' ? e.target.value === '' ? '' : Number(e.target.value) : e.target.value
      )
      }
      placeholder={field.placeholder}
      className={baseInput} />);


}

// ─── Brand Kit Preview ────────────────────────────────────────────────────────

interface BrandPreviewProps {
  values: Record<string, unknown>;
}

function BrandPreview({ values }: BrandPreviewProps) {
  const bankName = String(values.bank_name ?? 'Your Bank Name');
  const primaryColor = String(values.primary_color ?? '#2563EB');
  const accentColor = String(values.accent_color ?? '#22C55E');
  const logoUrl = String(values.logo_url ?? '');
  const tagline = String(values.tagline ?? 'Collateral Lifecycle Management Platform');

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border bg-muted/30">
        <Eye size={13} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Live Preview</span>
      </div>
      <div className="p-4">
        {/* Mini login card preview */}
        <div className="max-w-xs mx-auto rounded-xl overflow-hidden shadow-md border border-border">
          <div className="px-5 py-4 text-center" style={{ backgroundColor: primaryColor }}>
            <div className="flex items-center justify-center gap-2 mb-1">
              {logoUrl ?
              <img src={logoUrl} alt={bankName} className="h-7 w-7 rounded object-contain bg-white/20 p-0.5" /> :

              <div className="w-7 h-7 rounded bg-white/20 flex items-center justify-center">
                  <Building2 size={14} className="text-white" />
                </div>
              }
              <span className="text-white font-bold text-sm">{bankName}</span>
            </div>
            <p className="text-white/70 text-[10px]">{tagline}</p>
          </div>
          <div className="bg-white px-5 py-3 space-y-2">
            <div className="h-6 bg-gray-100 rounded" />
            <div className="h-6 bg-gray-100 rounded" />
            <div
              className="h-7 rounded text-white text-xs flex items-center justify-center font-medium"
              style={{ backgroundColor: primaryColor }}>
              
              Sign In
            </div>
          </div>
          <div className="bg-gray-50 px-5 py-2 text-center border-t border-gray-100">
            <span className="text-[9px] text-gray-400">
              A product by <span style={{ color: primaryColor }}>Contentpro</span>
            </span>
          </div>
        </div>

        {/* Color swatches */}
        <div className="flex items-center justify-center gap-4 mt-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: primaryColor }} />
            <span className="text-xs text-muted-foreground">Primary</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full border border-border" style={{ backgroundColor: accentColor }} />
            <span className="text-xs text-muted-foreground">Accent</span>
          </div>
        </div>
      </div>
    </div>);

}

// ─── Config Section ───────────────────────────────────────────────────────────

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

function ConfigSection({
  tab,
  values,
  onChange,
  onSave,
  saving,
  saved,
  error,
  lastUpdated
}: ConfigSectionProps) {
  const fields = FIELD_DEFS[tab.id];
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});

  // Group textarea fields separately for visual clarity
  const textareaFields = fields.filter((f) => f.type === 'textarea');
  const regularFields = fields.filter((f) => f.type !== 'textarea');

  const toggleGroup = (group: string) =>
  setExpandedGroups((prev) => ({ ...prev, [group]: !prev[group] }));

  const hasTemplates = textareaFields.length > 0;
  const isBrand = tab.id === 'brand';

  return (
    <div className="space-y-5">
      {/* Section header */}
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
          {lastUpdated &&
          <span className="text-xs text-muted-foreground hidden sm:block">
              Last saved: {new Date(lastUpdated).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          }
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-md hover:bg-primary/90 transition-colors disabled:opacity-60">
            
            {saving ?
            <RefreshCw size={14} className="animate-spin" /> :
            saved ?
            <CheckCircle2 size={14} /> :

            <Save size={14} />
            }
            {saving ? 'Saving…' : saved ? 'Saved' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Error / success feedback */}
      {error &&
      <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-md text-sm text-red-700">
          <AlertTriangle size={14} />
          {error}
        </div>
      }
      {saved && !error &&
      <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-md text-sm text-green-700">
          <CheckCircle2 size={14} />
          {isBrand ? 'Brand kit saved — theme applied globally across the app.' : 'Configuration saved successfully.'}
        </div>
      }

      {/* Brand Kit: two-column layout with preview */}
      {isBrand ?
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-card border border-border rounded-lg p-5 space-y-4">
            {regularFields.map((field) =>
          <div key={field.key}>
                <label className="block text-xs font-medium text-foreground mb-1.5">
                  {field.label}
                </label>
                <FieldInput field={field} value={values[field.key]} onChange={onChange} />
                {field.hint &&
            <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                    <Info size={11} className="mt-0.5 shrink-0" />
                    {field.hint}
                  </p>
            }
              </div>
          )}
          </div>
          <BrandPreview values={values} />
        </div> :

      <>
          {/* Regular fields grid */}
          <div className="bg-card border border-border rounded-lg p-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              {regularFields.map((field) =>
            <div key={field.key} className={field.type === 'boolean' ? 'flex flex-col gap-1' : ''}>
                  <label className="block text-xs font-medium text-foreground mb-1">
                    {field.label}
                  </label>
                  <FieldInput field={field} value={values[field.key]} onChange={onChange} />
                  {field.hint &&
              <p className="text-xs text-muted-foreground mt-1 flex items-start gap-1">
                      <Info size={11} className="mt-0.5 shrink-0" />
                      {field.hint}
                    </p>
              }
                </div>
            )}
            </div>
          </div>

          {/* Template fields (collapsible) */}
          {hasTemplates &&
        <div className="space-y-3">
              {textareaFields.map((field) => {
            const isOpen = expandedGroups[field.key] !== false;
            return (
              <div key={field.key} className="bg-card border border-border rounded-lg overflow-hidden">
                    <button
                  type="button"
                  onClick={() => toggleGroup(field.key)}
                  className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 transition-colors">
                  
                      <span>{field.label}</span>
                      {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                    {isOpen &&
                <div className="px-4 pb-4 border-t border-border/50">
                        <div className="mt-3">
                          <FieldInput field={field} value={values[field.key]} onChange={onChange} />
                          {field.hint &&
                    <p className="text-xs text-muted-foreground mt-1.5 flex items-start gap-1">
                              <Info size={11} className="mt-0.5 shrink-0" />
                              {field.hint}
                            </p>
                    }
                        </div>
                      </div>
                }
                  </div>);

          })}
            </div>
        }
        </>
      }
    </div>);

}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function SystemConfigContent() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<ConfigCategory>('bank');
  const [configs, setConfigs] = useState<Record<string, SystemConfigRecord>>({});
  const [localValues, setLocalValues] = useState<Record<ConfigCategory, Record<string, unknown>>>({
    bank: {},
    registry: {},
    notifications: {},
    thresholds: {},
    retention: {},
    brand: {}
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<ConfigCategory | null>(null);
  const [saved, setSaved] = useState<ConfigCategory | null>(null);
  const [errors, setErrors] = useState<Record<ConfigCategory, string | null>>({
    bank: null,
    registry: null,
    notifications: null,
    thresholds: null,
    retention: null,
    brand: null
  });

  const applyBrandCssVars = useCallback((brandValues: Record<string, unknown>) => {
    const primary = String(brandValues.primary_color ?? '#2563EB');
    const accent = String(brandValues.accent_color ?? '#22C55E');
    const root = document.documentElement;
    root.style.setProperty('--primary', hexToHsl(primary));
    root.style.setProperty('--accent', hexToHsl(accent));
    root.style.setProperty('--ring', hexToHsl(primary));
  }, []);

  const loadConfigs = useCallback(async () => {
    try {
      setLoading(true);
      const records = await fetchSystemConfig();
      const configMap: Record<string, SystemConfigRecord> = {};
      const valuesMap: Record<ConfigCategory, Record<string, unknown>> = {
        bank: {},
        registry: {},
        notifications: {},
        thresholds: {},
        retention: {},
        brand: {}
      };

      records.forEach((rec) => {
        configMap[rec.configKey] = rec;
        const tab = TABS.find((t) => t.configKey === rec.configKey);
        if (tab) {
          valuesMap[tab.id] = rec.configValue as Record<string, unknown>;
        }
      });

      setConfigs(configMap);
      setLocalValues(valuesMap);

      // Apply brand CSS vars on load
      if (valuesMap.brand && Object.keys(valuesMap.brand).length > 0) {
        applyBrandCssVars(valuesMap.brand);
      }
    } catch {










      // silently fail — show empty form
    } finally {setLoading(false);}}, [applyBrandCssVars]);useEffect(() => {loadConfigs();}, [loadConfigs]);const handleChange = (category: ConfigCategory, key: string, value: unknown) => {setLocalValues((prev) => ({
      ...prev,
      [category]: { ...prev[category], [key]: value }
    }));
    if (saved === category) setSaved(null);
  };

  const handleSave = async (category: ConfigCategory) => {
    const tab = TABS.find((t) => t.id === category);
    if (!tab || !userProfile?.id) return;

    setSaving(category);
    setErrors((prev) => ({ ...prev, [category]: null }));
    setSaved(null);

    try {
      await updateSystemConfig(tab.configKey, localValues[category], userProfile.id);
      setSaved(category);

      // Apply brand CSS vars immediately after saving
      if (category === 'brand') {
        applyBrandCssVars(localValues.brand);
      }

      await loadConfigs();
      setTimeout(() => setSaved(null), 3000);
    } catch (err) {
      setErrors((prev) => ({
        ...prev,
        [category]: err instanceof Error ? err.message : 'Failed to save configuration.'
      }));
    } finally {
      setSaving(null);
    }
  };

  const activeTabDef = TABS.find((t) => t.id === activeTab)!;

  return (
    <div className="space-y-0">
      {/* Page Header */}
      <div className="px-6 pt-6 pb-0">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-700 text-foreground">System Configuration</h1>
            <p className="text-sm text-muted-foreground">
              Configure bank details, registry URLs, email templates, thresholds, retention policies, and brand kit
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex items-center gap-0 border-b border-border px-6 mt-4 overflow-x-auto">
        {TABS.map((tab) =>
        <button
          key={tab.id}
          onClick={() => setActiveTab(tab.id)}
          className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${
          activeTab === tab.id ?
          'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'}`
          }>
          
            {tab.icon}
            {tab.label}
          </button>
        )}
      </div>

      {/* Tab Content */}
      <div className="px-6 py-6">
        {loading ?
        <div className="space-y-4">
            {[1, 2, 3].map((i) =>
          <div key={i} className="h-12 bg-muted animate-pulse rounded-md" />
          )}
          </div> :

        <ConfigSection
          tab={activeTabDef}
          values={localValues[activeTab]}
          onChange={(key, value) => handleChange(activeTab, key, value)}
          onSave={() => handleSave(activeTab)}
          saving={saving === activeTab}
          saved={saved === activeTab}
          error={errors[activeTab]}
          lastUpdated={configs[activeTabDef.configKey]?.updatedAt ?? null} />

        }
      </div>
    </div>);

}