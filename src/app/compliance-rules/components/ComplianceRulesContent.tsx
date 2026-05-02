'use client';
import React, { useState } from 'react';
import { Scale, Plus, Edit2, Trash2, CheckCircle2, XCircle, AlertTriangle, Shield, Clock, ToggleLeft, ToggleRight, Save, X, Search, Info, Send, MessageSquare, Loader2 } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';
import { smsAlertService } from '@/lib/supabase/smsAlertService';


// ─── Types ────────────────────────────────────────────────────────────────────

type RuleType = 'LTV' | 'DEADLINE' | 'ELIGIBILITY';
type RuleAction = 'BLOCK' | 'WARN' | 'LOG';

interface ComplianceRule {
  id: string;
  ruleName: string;
  ruleType: RuleType;
  condition: {
    field: string;
    operator: string;
    value: number | string;
  };
  action: RuleAction;
  message: string;
  isActive: boolean;
  createdAt: string;
  triggeredCount: number;
}

interface RuleFormData {
  ruleName: string;
  ruleType: RuleType;
  field: string;
  operator: string;
  value: string;
  action: RuleAction;
  message: string;
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const initialRules: ComplianceRule[] = [
  {
    id: 'RULE-001',
    ruleName: 'LTV Supervisor Approval',
    ruleType: 'LTV',
    condition: { field: 'ltv_ratio', operator: '>', value: 0.70 },
    action: 'BLOCK',
    message: 'LTV exceeds 70% limit. Supervisor approval required before proceeding.',
    isActive: true,
    createdAt: '2024-01-15',
    triggeredCount: 23,
  },
  {
    id: 'RULE-002',
    ruleName: 'BRELA 42-Day Deadline Warning',
    ruleType: 'DEADLINE',
    condition: { field: 'days_to_brela_deadline', operator: '<=', value: 7 },
    action: 'WARN',
    message: 'BRELA submission deadline is within 7 days. Immediate action required.',
    isActive: true,
    createdAt: '2024-01-15',
    triggeredCount: 87,
  },
  {
    id: 'RULE-003',
    ruleName: 'Overdue BRELA Filing Block',
    ruleType: 'DEADLINE',
    condition: { field: 'days_to_brela_deadline', operator: '<', value: 0 },
    action: 'BLOCK',
    message: 'BRELA filing deadline has passed. Escalate to compliance team immediately.',
    isActive: true,
    createdAt: '2024-01-15',
    triggeredCount: 12,
  },
  {
    id: 'RULE-004',
    ruleName: 'High LTV Audit Log',
    ruleType: 'LTV',
    condition: { field: 'ltv_ratio', operator: '>', value: 0.60 },
    action: 'LOG',
    message: 'LTV above 60% — logged for audit trail review.',
    isActive: true,
    createdAt: '2024-02-01',
    triggeredCount: 156,
  },
  {
    id: 'RULE-005',
    ruleName: 'New Customer Eligibility Check',
    ruleType: 'ELIGIBILITY',
    condition: { field: 'customer_relationship_years', operator: '<', value: 1 },
    action: 'WARN',
    message: 'Customer relationship is less than 1 year. Enhanced due diligence required.',
    isActive: true,
    createdAt: '2024-02-15',
    triggeredCount: 34,
  },
  {
    id: 'RULE-006',
    ruleName: 'Maximum LTV Hard Cap',
    ruleType: 'LTV',
    condition: { field: 'ltv_ratio', operator: '>', value: 0.85 },
    action: 'BLOCK',
    message: 'LTV exceeds absolute maximum of 85%. Loan cannot proceed.',
    isActive: false,
    createdAt: '2024-03-01',
    triggeredCount: 3,
  },
  {
    id: 'RULE-007',
    ruleName: 'Lands Registry 60-Day Deadline',
    ruleType: 'DEADLINE',
    condition: { field: 'days_to_lands_deadline', operator: '<=', value: 14 },
    action: 'WARN',
    message: 'Lands Registry submission due within 14 days.',
    isActive: true,
    createdAt: '2024-03-10',
    triggeredCount: 41,
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ruleTypeConfig: Record<RuleType, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  LTV: { label: 'LTV Limit', icon: Scale, color: 'text-blue-600', bg: 'bg-blue-100' },
  DEADLINE: { label: 'Deadline', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-100' },
  ELIGIBILITY: { label: 'Eligibility', icon: Shield, color: 'text-purple-600', bg: 'bg-purple-100' },
};

const actionConfig: Record<RuleAction, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  BLOCK: { label: 'Block', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: XCircle },
  WARN: { label: 'Warn', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: AlertTriangle },
  LOG: { label: 'Log', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: Info },
};

const fieldOptions = [
  { value: 'ltv_ratio', label: 'LTV Ratio' },
  { value: 'days_to_brela_deadline', label: 'Days to BRELA Deadline' },
  { value: 'days_to_lands_deadline', label: 'Days to Lands Deadline' },
  { value: 'customer_relationship_years', label: 'Customer Relationship Years' },
  { value: 'valuation_age_months', label: 'Valuation Age (months)' },
  { value: 'collateral_utilization', label: 'Collateral Utilization %' },
];

const operatorOptions = [
  { value: '>', label: 'Greater than (>)' },
  { value: '>=', label: 'Greater than or equal (>=)' },
  { value: '<', label: 'Less than (<)' },
  { value: '<=', label: 'Less than or equal (<=)' },
  { value: '=', label: 'Equal to (=)' },
];

const defaultForm: RuleFormData = {
  ruleName: '',
  ruleType: 'LTV',
  field: 'ltv_ratio',
  operator: '>',
  value: '',
  action: 'WARN',
  message: '',
};

// ─── SMS Notify Modal ─────────────────────────────────────────────────────────

interface SmsNotifyModalProps {
  rule: ComplianceRule;
  onClose: () => void;
}

function SmsNotifyModal({ rule, onClose }: SmsNotifyModalProps) {
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [collateralId, setCollateralId] = useState('');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';

  const buildMessage = (): string => {
    if (rule.ruleType === 'DEADLINE') {
      const isBrela = rule.condition.field.includes('brela');
      if (isBrela) {
        const daysLeft = Number(rule.condition.value);
        return smsAlertService.buildBrelaMessage(collateralId || 'N/A', daysLeft, appUrl);
      }
      return smsAlertService.buildOverdueMessage(collateralId || 'N/A', 0, appUrl);
    }
    return `[CollateralMS ALERT] Rule "${rule.ruleName}" triggered for ${collateralId || 'N/A'}. Action required: ${appUrl}/compliance-rules`;
  };

  const alertType = (): 'BRELA_DEADLINE' | 'OVERDUE_COLLATERAL' | 'CUSTODY_DISCREPANCY' => {
    if (rule.condition.field.includes('brela')) return 'BRELA_DEADLINE';
    if (rule.ruleType === 'DEADLINE') return 'OVERDUE_COLLATERAL';
    return 'OVERDUE_COLLATERAL';
  };

  const handleSend = async () => {
    if (!phone.trim()) return;
    setSending(true);
    setResult(null);
    const res = await smsAlertService.sendAlertViaApi({
      to: phone.trim(),
      recipientName: recipientName.trim() || undefined,
      alertType: alertType(),
      collateralId: collateralId.trim() || undefined,
      message: buildMessage(),
      actionUrl: `${appUrl}/compliance-audit`,
    });
    setSending(false);
    setResult({
      success: res.success,
      message: res.success
        ? `SMS sent successfully${res.messageSid ? ` (SID: ${res.messageSid})` : ''}`
        : `Failed: ${res.error}`,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <MessageSquare size={16} className="text-emerald-600" />
            <h2 className="text-base font-700 text-foreground">Notify Officer via SMS</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Rule summary */}
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs font-600 text-amber-800 uppercase tracking-wide mb-0.5">Triggering Rule</p>
            <p className="text-sm font-600 text-amber-900">{rule.ruleName}</p>
            <p className="text-xs text-amber-700 mt-0.5">{rule.message}</p>
          </div>

          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Officer Phone Number <span className="text-red-500">*</span></label>
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+255712345678"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p className="text-xs text-muted-foreground mt-1">Include country code (e.g. +255 for Tanzania)</p>
          </div>

          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Officer Name (optional)</label>
            <input
              type="text"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              placeholder="e.g. John Mwangi"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Collateral ID (optional)</label>
            <input
              type="text"
              value={collateralId}
              onChange={(e) => setCollateralId(e.target.value)}
              placeholder="e.g. COL-2024-001"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Message preview */}
          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Message Preview</label>
            <div className="p-3 bg-muted/30 rounded-lg border border-border">
              <p className="text-xs font-mono text-foreground/80 leading-relaxed break-words">{buildMessage()}</p>
            </div>
          </div>

          {result && (
            <div className={`flex items-start gap-2 p-3 rounded-lg text-sm ${result.success ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'}`}>
              {result.success ? <CheckCircle2 size={15} className="shrink-0 mt-0.5" /> : <XCircle size={15} className="shrink-0 mt-0.5" />}
              <span>{result.message}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors">
            {result?.success ? 'Close' : 'Cancel'}
          </button>
          {!result?.success && (
            <button
              onClick={handleSend}
              disabled={!phone.trim() || sending}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-600 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              {sending ? 'Sending…' : 'Send SMS Alert'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

function RuleCard({ rule, onToggle, onEdit, onDelete, onNotify }: {
  rule: ComplianceRule;
  onToggle: (id: string) => void;
  onEdit: (rule: ComplianceRule) => void;
  onDelete: (id: string) => void;
  onNotify: (rule: ComplianceRule) => void;
}) {
  const typeConf = ruleTypeConfig[rule.ruleType];
  const actionConf = actionConfig[rule.action];
  const TypeIcon = typeConf.icon;
  const ActionIcon = actionConf.icon;

  const canNotify = rule.ruleType === 'DEADLINE' && rule.isActive;

  return (
    <div className={`bg-white border rounded-xl p-4 shadow-card transition-opacity ${!rule.isActive ? 'opacity-60' : ''}`}>
      <div className="flex items-start gap-3">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${typeConf.bg}`}>
          <TypeIcon size={16} className={typeConf.color} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 mb-1">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-700 text-foreground">{rule.ruleName}</p>
                <span className={`text-xs font-600 px-2 py-0.5 rounded-full border ${actionConf.bg} ${actionConf.color} ${actionConf.border}`}>
                  <span className="flex items-center gap-1"><ActionIcon size={10} />{actionConf.label}</span>
                </span>
                {!rule.isActive && <span className="text-xs font-600 px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 border border-gray-200">Inactive</span>}
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{rule.id} · {ruleTypeConfig[rule.ruleType].label} · Triggered {rule.triggeredCount}×</p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {canNotify && (
                <button
                  onClick={() => onNotify(rule)}
                  className="p-1.5 rounded-lg hover:bg-emerald-50 transition-colors text-muted-foreground hover:text-emerald-600"
                  title="Send SMS alert to officer"
                >
                  <MessageSquare size={14} />
                </button>
              )}
              <button onClick={() => onToggle(rule.id)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                {rule.isActive ? <ToggleRight size={16} className="text-green-600" /> : <ToggleLeft size={16} />}
              </button>
              <button onClick={() => onEdit(rule)} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <Edit2 size={14} />
              </button>
              <button onClick={() => onDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600">
                <Trash2 size={14} />
              </button>
            </div>
          </div>

          {/* Condition */}
          <div className="flex items-center gap-2 mt-2 p-2 bg-muted/30 rounded-lg">
            <code className="text-xs font-mono text-foreground">
              IF <span className="text-primary font-700">{rule.condition.field}</span>{' '}
              <span className="text-amber-600 font-700">{rule.condition.operator}</span>{' '}
              <span className="text-green-600 font-700">{rule.condition.value}</span>{' '}
              → <span className={`font-700 ${actionConf.color}`}>{rule.action}</span>
            </code>
          </div>

          <p className="text-xs text-muted-foreground mt-2 italic">"{rule.message}"</p>
        </div>
      </div>
    </div>
  );
}

// ─── Rule Form Modal ──────────────────────────────────────────────────────────

function RuleFormModal({ form, setForm, onSave, onClose, isEdit }: {
  form: RuleFormData;
  setForm: React.Dispatch<React.SetStateAction<RuleFormData>>;
  onSave: () => void;
  onClose: () => void;
  isEdit: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-700 text-foreground">{isEdit ? 'Edit Rule' : 'Create New Rule'}</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Rule Name</label>
            <input
              type="text"
              value={form.ruleName}
              onChange={(e) => setForm((f) => ({ ...f, ruleName: e.target.value }))}
              placeholder="e.g., LTV Supervisor Approval"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Rule Type</label>
              <select
                value={form.ruleType}
                onChange={(e) => setForm((f) => ({ ...f, ruleType: e.target.value as RuleType }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="LTV">LTV Limit</option>
                <option value="DEADLINE">Deadline</option>
                <option value="ELIGIBILITY">Eligibility</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Action</label>
              <select
                value={form.action}
                onChange={(e) => setForm((f) => ({ ...f, action: e.target.value as RuleAction }))}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="BLOCK">Block</option>
                <option value="WARN">Warn</option>
                <option value="LOG">Log</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">Condition</label>
            <div className="grid grid-cols-3 gap-2">
              <select
                value={form.field}
                onChange={(e) => setForm((f) => ({ ...f, field: e.target.value }))}
                className="col-span-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {fieldOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select
                value={form.operator}
                onChange={(e) => setForm((f) => ({ ...f, operator: e.target.value }))}
                className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {operatorOptions.map((o) => <option key={o.value} value={o.value}>{o.value}</option>)}
              </select>
              <input
                type="text"
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder="Value"
                className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Preview: <code className="font-mono">IF {form.field} {form.operator} {form.value || '?'} → {form.action}</code>
            </p>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">User Message</label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              placeholder="Message shown to user when rule triggers..."
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/20">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={onSave}
            disabled={!form.ruleName || !form.value || !form.message}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save size={14} />
            {isEdit ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceRulesContent() {
  const [rules, setRules] = useState<ComplianceRule[]>(initialRules);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<ComplianceRule | null>(null);
  const [form, setForm] = useState<RuleFormData>(defaultForm);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [notifyRule, setNotifyRule] = useState<ComplianceRule | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleToggle = (id: string) => {
    setRules((prev) => prev.map((r) => r.id === id ? { ...r, isActive: !r.isActive } : r));
    showToast('Rule status updated');
  };

  const handleEdit = (rule: ComplianceRule) => {
    setEditingRule(rule);
    setForm({
      ruleName: rule.ruleName,
      ruleType: rule.ruleType,
      field: rule.condition.field,
      operator: rule.condition.operator,
      value: String(rule.condition.value),
      action: rule.action,
      message: rule.message,
    });
    setShowForm(true);
  };

  const handleDelete = (id: string) => {
    setRules((prev) => prev.filter((r) => r.id !== id));
    showToast('Rule deleted');
  };

  const handleSave = () => {
    if (editingRule) {
      setRules((prev) => prev.map((r) => r.id === editingRule.id ? {
        ...r,
        ruleName: form.ruleName,
        ruleType: form.ruleType,
        condition: { field: form.field, operator: form.operator, value: isNaN(Number(form.value)) ? form.value : Number(form.value) },
        action: form.action,
        message: form.message,
      } : r));
      showToast('Rule updated successfully');
    } else {
      const newRule: ComplianceRule = {
        id: `RULE-${String(rules.length + 1).padStart(3, '0')}`,
        ruleName: form.ruleName,
        ruleType: form.ruleType,
        condition: { field: form.field, operator: form.operator, value: isNaN(Number(form.value)) ? form.value : Number(form.value) },
        action: form.action,
        message: form.message,
        isActive: true,
        createdAt: new Date().toISOString().split('T')[0],
        triggeredCount: 0,
      };
      setRules((prev) => [newRule, ...prev]);
      showToast('Rule created successfully');
    }
    setShowForm(false);
    setEditingRule(null);
    setForm(defaultForm);
  };

  const handleCloseForm = () => {
    setShowForm(false);
    setEditingRule(null);
    setForm(defaultForm);
  };

  const filtered = rules.filter((r) => {
    const matchSearch = !search || r.ruleName.toLowerCase().includes(search.toLowerCase()) || r.id.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === 'All' || r.ruleType === typeFilter;
    const matchAction = actionFilter === 'All' || r.action === actionFilter;
    return matchSearch && matchType && matchAction;
  });

  const activeCount = rules.filter((r) => r.isActive).length;
  const blockCount = rules.filter((r) => r.action === 'BLOCK' && r.isActive).length;
  const totalTriggered = rules.reduce((s, r) => s + r.triggeredCount, 0);

  return (
    <div className="p-6 space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-500 ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <XCircle size={15} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-start gap-3">
          <div className="w-8 h-8 rounded-lg bg-indigo-100 flex items-center justify-center shrink-0">
            <Scale size={18} className="text-indigo-600" />
          </div>
          <div>
            <h1 className="text-xl font-700 text-foreground">Compliance Rule Engine</h1>
            <p className="text-sm text-muted-foreground">Configure and manage automated compliance rules for LTV, deadlines, and eligibility</p>
          </div>
        </div>
        <button
          onClick={() => { setEditingRule(null); setForm(defaultForm); setShowForm(true); }}
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus size={15} /> New Rule
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Rules', value: rules.length, sub: 'Configured rules', icon: Scale, variant: 'default' as const },
          { label: 'Active Rules', value: activeCount, sub: 'Currently enforced', icon: CheckCircle2, variant: 'success' as const },
          { label: 'Block Rules', value: blockCount, sub: 'Hard stops active', icon: XCircle, variant: 'danger' as const },
          { label: 'Total Triggered', value: totalTriggered, sub: 'All-time violations', icon: AlertTriangle, variant: 'warning' as const },
        ].map(({ label, value, sub, icon: Icon, variant }) => {
          const bg = { default: 'bg-white border-border', success: 'bg-green-50 border-green-200', danger: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200' };
          const iconBg = { default: 'bg-primary/10 text-primary', success: 'bg-green-100 text-green-600', danger: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600' };
          const valColor = { default: 'text-foreground', success: 'text-green-700', danger: 'text-red-700', warning: 'text-amber-700' };
          return (
            <div key={label} className={`rounded-xl p-4 border shadow-card ${bg[variant]}`}>
              <div className="flex items-start justify-between mb-2">
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider">{label}</p>
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
                  <Icon size={15} />
                </div>
              </div>
              <p className={`text-2xl font-700 tabular-nums font-mono ${valColor[variant]}`}>{value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
            </div>
          );
        })}
      </div>

      {/* SMS Alert Banner */}
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
        <MessageSquare size={15} className="text-emerald-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-600 text-emerald-800">SMS Notifications Active</p>
          <p className="text-xs text-emerald-700 mt-0.5">
            Deadline rules (BRELA overdue, custody discrepancies) can instantly notify responsible officers via SMS. Click the <MessageSquare size={11} className="inline" /> icon on any active Deadline rule to send an alert.
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search rules..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none">
          <option value="All">All Types</option>
          <option value="LTV">LTV Limit</option>
          <option value="DEADLINE">Deadline</option>
          <option value="ELIGIBILITY">Eligibility</option>
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none">
          <option value="All">All Actions</option>
          <option value="BLOCK">Block</option>
          <option value="WARN">Warn</option>
          <option value="LOG">Log</option>
        </select>
        <span className="text-xs text-muted-foreground">{filtered.length} rule{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Rules List */}
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Scale size={32} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No rules match your filters</p>
          </div>
        ) : (
          filtered.map((rule) => (
            <RuleCard
              key={rule.id}
              rule={rule}
              onToggle={handleToggle}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onNotify={setNotifyRule}
            />
          ))
        )}
      </div>

      {/* Info Box */}
      <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info size={15} className="text-indigo-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-600 text-indigo-800">Rule Engine Behaviour</p>
            <p className="text-xs text-indigo-700 mt-0.5">
              <strong>BLOCK</strong> rules prevent submission and require supervisor override. <strong>WARN</strong> rules display alerts but allow continuation. <strong>LOG</strong> rules silently record violations in the audit trail. All rule triggers are logged with user, timestamp, and collateral ID for regulatory readiness.
            </p>
          </div>
        </div>
      </div>

      {/* Form Modal */}
      {showForm && (
        <RuleFormModal
          form={form}
          setForm={setForm}
          onSave={handleSave}
          onClose={handleCloseForm}
          isEdit={!!editingRule}
        />
      )}

      {/* SMS Notify Modal */}
      {notifyRule && (
        <SmsNotifyModal
          rule={notifyRule}
          onClose={() => setNotifyRule(null)}
        />
      )}
    </div>
  );
}
