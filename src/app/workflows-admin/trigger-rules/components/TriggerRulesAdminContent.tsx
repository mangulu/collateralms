'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2, ToggleLeft, ToggleRight, Loader2, Zap, RefreshCw,
  ChevronDown, ChevronUp, Info, Plus, X, Save, Settings2,
  Play, CheckCircle2, XCircle, AlertTriangle, Clock, BarChart3,
} from 'lucide-react';
import {
  workflowTriggerRulesService,
  type WorkflowTriggerRule,
  type WorkflowTriggerCondition,
  type WorkflowTriggerEvent,
  type WorkflowTriggerOperator,
  TRIGGER_EVENT_LABELS,
  TRIGGER_EVENT_DESCRIPTIONS,
  TRIGGER_OPERATOR_LABELS,
  COLLATERAL_STATUS_OPTIONS,
} from '@/lib/supabase/workflowTriggerRulesService';
import { workflowTemplateService, type WorkflowTemplate } from '@/lib/supabase/workflowEngineService';
import { workflowTriggerProcessorService, type TriggerJobLog, type TriggerProcessorResult } from '@/lib/supabase/workflowTriggerProcessorService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_TYPE_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  collateral_status_change: { bg: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)', border: 'var(--izou-secondary-light)' },
  days_since_submission: { bg: 'var(--izou-warning-light)', color: 'var(--izou-warning)', border: 'var(--izou-warning-light)' },
  value_threshold: { bg: 'var(--izou-success-light)', color: 'var(--izou-success)', border: 'var(--izou-success-light)' },
  ltv_breach: { bg: 'var(--izou-danger-light)', color: 'var(--izou-danger)', border: 'var(--izou-danger-light)' },
  days_overdue: { bg: 'var(--izou-warning-light)', color: 'var(--izou-warning)', border: 'var(--izou-warning-light)' },
  document_count_change: { bg: 'var(--izou-highlight-light)', color: 'var(--izou-highlight)', border: 'var(--izou-highlight-light)' },
};

const TRIGGER_TYPE_FALLBACK = { bg: 'var(--izou-bg)', color: 'var(--izou-muted)', border: 'var(--izou-border)' };

const TRIGGER_EVENTS: WorkflowTriggerEvent[] = [
  'collateral_status_change',
  'days_since_submission',
  'value_threshold',
  'ltv_breach',
  'days_overdue',
  'document_count_change',
];

const NUMERIC_EVENTS: WorkflowTriggerEvent[] = [
  'days_since_submission', 'value_threshold', 'ltv_breach', 'days_overdue', 'document_count_change',
];

const NUMERIC_OPERATORS: WorkflowTriggerOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
];

const STATUS_OPERATORS: WorkflowTriggerOperator[] = ['equals', 'not_equals'];

const EVENT_COLORS: Record<WorkflowTriggerEvent, { bg: string; border: string }> = {
  collateral_status_change: { bg: 'var(--izou-highlight-light)', border: 'var(--izou-highlight-light)' },
  days_since_submission: { bg: 'var(--izou-secondary-light)', border: 'var(--izou-secondary-light)' },
  value_threshold: { bg: 'var(--izou-success-light)', border: 'var(--izou-success-light)' },
  ltv_breach: { bg: 'var(--izou-danger-light)', border: 'var(--izou-danger-light)' },
  days_overdue: { bg: 'var(--izou-warning-light)', border: 'var(--izou-warning-light)' },
  document_count_change: { bg: 'var(--izou-bg)', border: 'var(--izou-border)' },
};

const RUN_STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  success: { label: 'Success', color: 'var(--izou-success)', bg: 'var(--izou-success-light)', border: 'var(--izou-success-light)', icon: <CheckCircle2 size={14} style={{ color: 'var(--izou-success)' }} /> },
  partial: { label: 'Partial', color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)', border: 'var(--izou-warning-light)', icon: <AlertTriangle size={14} style={{ color: 'var(--izou-warning)' }} /> },
  failed: { label: 'Failed', color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)', border: 'var(--izou-danger-light)', icon: <XCircle size={14} style={{ color: 'var(--izou-danger)' }} /> },
  running: { label: 'Running', color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)', border: 'var(--izou-secondary-light)', icon: <Loader2 size={14} className="animate-spin" style={{ color: 'var(--izou-secondary)' }} /> },
};

function blankCondition(): Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'> {
  return { eventType: 'collateral_status_change', operator: 'equals', conditionValue: '', conditionValueTo: null, sortOrder: 1 };
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─── Condition Row ────────────────────────────────────────────────────────────

interface ConditionRowProps {
  condition: Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>;
  index: number;
  logic: 'AND' | 'OR';
  isLast: boolean;
  onChange: (updated: Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>) => void;
  onDelete: () => void;
}

function ConditionRow({ condition, index, logic, isLast, onChange, onDelete }: ConditionRowProps) {
  const isNumeric = NUMERIC_EVENTS.includes(condition.eventType);
  const operators = isNumeric ? NUMERIC_OPERATORS : STATUS_OPERATORS;
  const eventColor = EVENT_COLORS[condition.eventType];

  function handleEventChange(eventType: WorkflowTriggerEvent) {
    const newIsNumeric = NUMERIC_EVENTS.includes(eventType);
    onChange({ ...condition, eventType, operator: newIsNumeric ? 'greater_than' : 'equals', conditionValue: '', conditionValueTo: null });
  }

  return (
    <div className="space-y-0">
      <div className="p-3 rounded-xl border" style={{ backgroundColor: eventColor.bg, borderColor: eventColor.border }}>
        <div className="flex items-start gap-2">
          <div className="w-5 h-5 rounded-full bg-white/80 border border-current flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 text-slate-600">
            {index + 1}
          </div>
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Event type */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1 block">Event Type</label>
              <select
                value={condition.eventType}
                onChange={(e) => handleEventChange(e.target.value as WorkflowTriggerEvent)}
                className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {TRIGGER_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>{TRIGGER_EVENT_LABELS[ev]}</option>
                ))}
              </select>
            </div>
            {/* Operator */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1 block">Operator</label>
              <select
                value={condition.operator}
                onChange={(e) => onChange({ ...condition, operator: e.target.value as WorkflowTriggerOperator })}
                className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>{TRIGGER_OPERATOR_LABELS[op]}</option>
                ))}
              </select>
            </div>
            {/* Value */}
            <div>
              <label className="text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1 block">Value</label>
              {isNumeric ? (
                <input
                  type="number"
                  value={condition.conditionValue}
                  onChange={(e) => onChange({ ...condition, conditionValue: e.target.value })}
                  placeholder="e.g. 30"
                  className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
              ) : (
                <select
                  value={condition.conditionValue}
                  onChange={(e) => onChange({ ...condition, conditionValue: e.target.value })}
                  className="w-full text-xs border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                >
                  <option value="">Select status…</option>
                  {COLLATERAL_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              )}
            </div>
          </div>
          <button
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition-colors shrink-0 mt-0.5"
            title="Remove condition"
          >
            <X size={14} />
          </button>
        </div>
        {condition.eventType !== 'collateral_status_change' && (
          <p className="text-[10px] text-slate-500 mt-1.5 ml-7">{TRIGGER_EVENT_DESCRIPTIONS[condition.eventType]}</p>
        )}
      </div>
      {!isLast && (
        <div className="flex items-center justify-center py-1">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${logic === 'AND' ? 'bg-blue-100 text-blue-600' : 'bg-amber-100 text-amber-600'}`}>
            {logic}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type AdminTab = 'rules' | 'processor';

export default function TriggerRulesAdminContent() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>('rules');

  // Rules tab state
  const [rules, setRules] = useState<WorkflowTriggerRule[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    templateId: '',
    name: '',
    description: '',
    conditionLogic: 'AND' as 'AND' | 'OR',
    referenceType: 'collateral',
  });
  const [conditions, setConditions] = useState<Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>[]>([blankCondition()]);

  // Run History tab state
  const [logs, setLogs] = useState<TriggerJobLog[]>([]);
  const [runningProcessor, setRunningProcessor] = useState(false);
  const [lastResult, setLastResult] = useState<TriggerProcessorResult | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      workflowTriggerRulesService.getAll().then(setRules).catch(() => setRules([])),
      workflowTemplateService.getAll().then(setTemplates).catch(() => setTemplates([])),
      workflowTriggerProcessorService.getRecentLogs(20).then(setLogs).catch(() => setLogs([])),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleToggle = async (rule: WorkflowTriggerRule) => {
    if (!user?.id) return;
    setToggling(rule.id);
    try {
      await workflowTriggerRulesService.toggleStatus(rule.id, rule.triggerStatus, user.id);
      setRules((prev) => prev.map((r) =>
        r.id === rule.id ? { ...r, triggerStatus: r.triggerStatus === 'active' ? 'inactive' : 'active' } : r
      ));
      toast.success(`Rule ${rule.triggerStatus === 'active' ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update rule');
    } finally {
      setToggling(null);
    }
  };

  const handleDelete = async (ruleId: string) => {
    if (!confirm('Delete this trigger rule? This cannot be undone.')) return;
    setDeleting(ruleId);
    try {
      await workflowTriggerRulesService.delete(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast.success('Rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    } finally {
      setDeleting(null);
    }
  };

  const handleSaveRule = async () => {
    if (!user?.id) return;
    if (!form.templateId) { toast.error('Please select a workflow template'); return; }
    if (!form.name.trim()) { toast.error('Please enter a rule name'); return; }
    if (conditions.some((c) => !c.conditionValue)) { toast.error('All conditions must have a value'); return; }

    setSaving(true);
    try {
      const newRule = await workflowTriggerRulesService.create({
        templateId: form.templateId,
        name: form.name.trim(),
        description: form.description.trim(),
        conditionLogic: form.conditionLogic,
        referenceType: form.referenceType,
        createdBy: user.id,
        conditions: conditions.map((c, i) => ({ ...c, sortOrder: i + 1 })),
      });
      setRules((prev) => [newRule, ...prev]);
      toast.success('Trigger rule created');
      setShowCreateForm(false);
      setForm({ templateId: '', name: '', description: '', conditionLogic: 'AND', referenceType: 'collateral' });
      setConditions([blankCondition()]);
    } catch {
      toast.error('Failed to create trigger rule');
    } finally {
      setSaving(false);
    }
  };

  const handleRunNow = async () => {
    setRunningProcessor(true);
    setLastResult(null);
    try {
      const result = await workflowTriggerProcessorService.runNow();
      setLastResult(result);
      toast.success(`Trigger processor completed — ${result.instancesCreated} instance(s) created`);
      const freshLogs = await workflowTriggerProcessorService.getRecentLogs(20);
      setLogs(freshLogs);
    } catch (err: any) {
      toast.error(err?.message ?? 'Trigger processor failed');
    } finally {
      setRunningProcessor(false);
    }
  };

  const getTemplateName = (id: string | null) => {
    if (!id) return '—';
    return templates.find((t) => t.id === id)?.name ?? id;
  };

  const activeCount = rules.filter((r) => r.triggerStatus === 'active').length;

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Auto-Trigger Rules</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Rules that automatically initiate workflow instances when conditions are met
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          {activeTab === 'rules' ? (
            <button
              onClick={() => setShowCreateForm((v) => !v)}
              className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              {showCreateForm ? <X size={14} /> : <Plus size={14} />}
              {showCreateForm ? 'Cancel' : 'New Rule'}
            </button>
          ) : (
            <button
              onClick={handleRunNow}
              disabled={runningProcessor}
              className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
            >
              {runningProcessor ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
              {runningProcessor ? 'Running…' : 'Run Now'}
            </button>
          )}
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-0 border-b border-border mb-6">
        {([
          { key: 'rules', label: 'Rules', icon: Zap, count: rules.length },
          { key: 'processor', label: 'Run History', icon: Play, count: logs.length },
        ] as { key: AdminTab; label: string; icon: React.ElementType; count: number }[]).map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-1.5 px-4 py-3 text-sm font-500 whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-amber-500 text-amber-700 bg-amber-50/50' :'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              <TabIcon size={14} />
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${
                  activeTab === tab.key ? 'bg-amber-500/15 text-amber-700' : 'bg-muted text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {activeTab === 'rules' && (
        <>
          {/* Stats strip */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
            <Zap size={18} className="text-amber-600 shrink-0" />
            <div className="flex items-center gap-6 text-sm">
              <span><strong className="text-amber-700">{rules.length}</strong> <span className="text-muted-foreground">total rules</span></span>
              <span><strong className="text-emerald-700">{activeCount}</strong> <span className="text-muted-foreground">active</span></span>
              <span><strong className="text-slate-600">{rules.length - activeCount}</strong> <span className="text-muted-foreground">inactive</span></span>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-xs text-amber-700 bg-amber-100 px-2.5 py-1 rounded-full">
              <Info size={11} />
              Switch to the Run History tab to run these rules and see results
            </div>
          </div>

          {/* ── Create Rule Form ── */}
          {showCreateForm && (
            <div className="mb-6 bg-white border-2 border-amber-300 rounded-2xl overflow-hidden shadow-sm">
              <div className="flex items-center gap-2.5 px-5 py-4 bg-amber-50 border-b border-amber-200">
                <div className="w-7 h-7 rounded-lg bg-amber-500 flex items-center justify-center">
                  <Settings2 size={14} className="text-white" />
                </div>
                <h2 className="text-sm font-semibold text-amber-900">Define New Trigger Rule</h2>
              </div>

              <div className="p-5 space-y-5">
                {/* Row 1: Template + Name */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Workflow Template <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.templateId}
                      onChange={(e) => setForm((f) => ({ ...f, templateId: e.target.value }))}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="">Select template…</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>{t.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">
                      Rule Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="e.g. Auto-trigger on LTV breach"
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                </div>

                {/* Row 2: Description + Reference Type */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Description</label>
                    <input
                      type="text"
                      value={form.description}
                      onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                      placeholder="Optional description…"
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-foreground mb-1.5">Reference Type</label>
                    <select
                      value={form.referenceType}
                      onChange={(e) => setForm((f) => ({ ...f, referenceType: e.target.value }))}
                      className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
                    >
                      <option value="collateral">Collateral</option>
                      <option value="loan">Loan</option>
                      <option value="document">Document</option>
                      <option value="obligor">Obligor</option>
                    </select>
                  </div>
                </div>

                {/* Condition Logic Toggle */}
                <div>
                  <label className="block text-xs font-medium text-foreground mb-2">Condition Logic</label>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setForm((f) => ({ ...f, conditionLogic: 'AND' }))}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.conditionLogic === 'AND' ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-border hover:bg-slate-50'}`}
                    >
                      AND — All conditions must match
                    </button>
                    <button
                      onClick={() => setForm((f) => ({ ...f, conditionLogic: 'OR' }))}
                      className={`px-4 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${form.conditionLogic === 'OR' ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-600 border-border hover:bg-slate-50'}`}
                    >
                      OR — Any condition can match
                    </button>
                  </div>
                </div>

                {/* Conditions */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-foreground">
                      Conditions <span className="text-red-500">*</span>
                      <span className="ml-1.5 text-muted-foreground font-normal">({conditions.length} defined)</span>
                    </label>
                    <button
                      onClick={() => setConditions((prev) => [...prev, blankCondition()])}
                      className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-medium"
                    >
                      <Plus size={12} />
                      Add Condition
                    </button>
                  </div>
                  <div className="space-y-0">
                    {conditions.map((cond, i) => (
                      <ConditionRow
                        key={i}
                        condition={cond}
                        index={i}
                        logic={form.conditionLogic}
                        isLast={i === conditions.length - 1}
                        onChange={(updated) => setConditions((prev) => prev.map((c, idx) => idx === i ? updated : c))}
                        onDelete={() => {
                          if (conditions.length === 1) { toast.error('At least one condition is required'); return; }
                          setConditions((prev) => prev.filter((_, idx) => idx !== i));
                        }}
                      />
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
                  <button
                    onClick={() => { setShowCreateForm(false); setForm({ templateId: '', name: '', description: '', conditionLogic: 'AND', referenceType: 'collateral' }); setConditions([blankCondition()]); }}
                    className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg bg-white hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveRule}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-60"
                  >
                    {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                    {saving ? 'Saving…' : 'Create Rule'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Rules list */}
          {loading ? (
            <div className="flex items-center justify-center h-40">
              <Loader2 size={24} className="animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 ? (
            <div className="text-center py-16 bg-white border border-border rounded-2xl">
              <Zap size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
              <p className="text-sm font-medium text-foreground mb-1">No trigger rules configured</p>
              <p className="text-xs text-muted-foreground mb-4">Click <strong>New Rule</strong> above to define your first auto-trigger rule.</p>
              <button
                onClick={() => setShowCreateForm(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
              >
                <Plus size={14} />
                New Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const isExpanded = expandedRule === rule.id;
                const isActive = rule.triggerStatus === 'active';
                const firstEventType = rule.conditions?.[0]?.eventType ?? '';
                const typeColor = TRIGGER_TYPE_COLORS[firstEventType] ?? TRIGGER_TYPE_FALLBACK;
                const typeLabel = TRIGGER_EVENT_LABELS[firstEventType as keyof typeof TRIGGER_EVENT_LABELS] ?? firstEventType;
                return (
                  <div key={rule.id} className="bg-white border border-border rounded-xl overflow-hidden">
                    <div className="flex items-center gap-3 px-4 py-3">
                      <button
                        onClick={() => handleToggle(rule)}
                        disabled={toggling === rule.id}
                        className="shrink-0"
                        title={isActive ? 'Deactivate rule' : 'Activate rule'}
                      >
                        {toggling === rule.id ? (
                          <Loader2 size={20} className="animate-spin text-muted-foreground" />
                        ) : isActive ? (
                          <ToggleRight size={22} className="text-emerald-500" />
                        ) : (
                          <ToggleLeft size={22} className="text-slate-400" />
                        )}
                      </button>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground truncate">{rule.name}</span>
                          {firstEventType && (
                            <span
                              className="text-xs px-2 py-0.5 rounded-full border font-medium"
                              style={{ backgroundColor: typeColor.bg, color: typeColor.color, borderColor: typeColor.border }}
                            >
                              {typeLabel}
                            </span>
                          )}
                          {!isActive && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                              {rule.triggerStatus === 'draft' ? 'Draft' : 'Inactive'}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          Template: {getTemplateName(rule.templateId)} · Created {fmtDate(rule.createdAt)}
                        </p>
                      </div>

                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => setExpandedRule(isExpanded ? null : rule.id)}
                          className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                          title="View details"
                        >
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          disabled={deleting === rule.id}
                          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                          title="Delete rule"
                        >
                          {deleting === rule.id ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-border px-4 py-3 bg-slate-50">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                          <div>
                            <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide text-[10px]">Conditions</p>
                            {rule.conditions && rule.conditions.length > 0 ? (
                              <ul className="space-y-1">
                                {rule.conditions.map((c, i) => (
                                  <li key={i} className="flex items-center gap-1.5 text-foreground">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                    <span>
                                      {TRIGGER_EVENT_LABELS[c.eventType] ?? c.eventType}{' '}
                                      {TRIGGER_OPERATOR_LABELS[c.operator] ?? c.operator}{' '}
                                      <strong>{c.conditionValue}</strong>
                                      {c.conditionValueTo ? ` – ${c.conditionValueTo}` : ''}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            ) : (
                              <p className="text-muted-foreground italic">No conditions defined</p>
                            )}
                          </div>
                          <div>
                            <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide text-[10px]">Configuration</p>
                            <div className="space-y-1 text-foreground">
                              <p>Logic: <strong>{rule.conditionLogic}</strong></p>
                              <p>Reference: <strong>{rule.referenceType || '—'}</strong></p>
                              {rule.description && <p className="text-muted-foreground">{rule.description}</p>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'processor' && (
        <>
          {/* Last result banner */}
          {lastResult && (
            <div
              className="mb-6 p-4 rounded-xl border"
              style={{ backgroundColor: RUN_STATUS_CONFIG[lastResult.status]?.bg, borderColor: RUN_STATUS_CONFIG[lastResult.status]?.border }}
            >
              <div className="flex items-center gap-2 mb-3">
                {RUN_STATUS_CONFIG[lastResult.status]?.icon}
                <h2 className="text-sm font-semibold" style={{ color: RUN_STATUS_CONFIG[lastResult.status]?.color }}>
                  Run completed — {RUN_STATUS_CONFIG[lastResult.status]?.label}
                </h2>
                <span className="ml-auto text-xs text-muted-foreground">{fmtDuration(lastResult.durationMs)}</span>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {[
                  { label: 'Rules Evaluated', value: lastResult.rulesEvaluated },
                  { label: 'Rules Matched', value: lastResult.rulesMatched },
                  { label: 'Instances Created', value: lastResult.instancesCreated },
                  { label: 'Skipped (duplicate)', value: lastResult.instancesSkipped },
                ].map((stat) => (
                  <div key={stat.label} className="bg-white rounded-lg px-3 py-2 border border-border">
                    <p className="text-muted-foreground">{stat.label}</p>
                    <p className="text-lg font-bold text-foreground">{stat.value}</p>
                  </div>
                ))}
              </div>
              {lastResult.detail.length > 0 && (
                <div className="mt-3 space-y-1">
                  {lastResult.detail.map((d, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-1.5 border border-border">
                      <Zap size={11} className="text-amber-500 shrink-0" />
                      <span className="font-medium text-foreground truncate">{d.ruleName}</span>
                      <span className="ml-auto text-muted-foreground shrink-0">{d.matched} matched · {d.created} created · {d.skipped} skipped</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Execution history */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
              <BarChart3 size={15} className="text-muted-foreground" />
              <h2 className="text-sm font-semibold text-foreground">Execution History</h2>
              <span className="ml-auto text-xs text-muted-foreground">{logs.length} recent runs</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 size={20} className="animate-spin text-muted-foreground" />
              </div>
            ) : logs.length === 0 ? (
              <div className="text-center py-12">
                <Clock size={28} className="mx-auto mb-2 text-muted-foreground opacity-40" />
                <p className="text-sm text-muted-foreground">No execution history yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {logs.map((log) => {
                  const cfg = RUN_STATUS_CONFIG[log.status] ?? RUN_STATUS_CONFIG.failed;
                  const isExpanded = expandedLog === log.id;
                  return (
                    <div key={log.id}>
                      <button
                        onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                      >
                        <div
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium shrink-0"
                          style={{ backgroundColor: cfg.bg, borderColor: cfg.border, color: cfg.color }}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground">
                            {fmtDateTime(log.runAt)} · <span className="text-muted-foreground">{log.triggeredBy === 'manual' ? 'Manual run' : 'Scheduled'}</span>
                          </p>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {log.rulesEvaluated} rules · {log.rulesMatched} matched · {log.instancesCreated} created · {fmtDuration(log.durationMs)}
                          </p>
                        </div>
                        {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                      </button>

                      {isExpanded && log.detail.length > 0 && (
                        <div className="px-4 pb-3 bg-slate-50 border-t border-border">
                          <div className="space-y-1 mt-2">
                            {log.detail.map((d, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-1.5 border border-border">
                                <Zap size={11} className="text-amber-500 shrink-0" />
                                <span className="font-medium text-foreground truncate">{d.ruleName}</span>
                                <span className="ml-auto text-muted-foreground shrink-0">{d.matched} matched · {d.created} created · {d.skipped} skipped</span>
                              </div>
                            ))}
                            {log.errorMessages.length > 0 && (
                              <div className="mt-2 p-2 rounded-lg border" style={{ backgroundColor: 'var(--izou-danger-light)', borderColor: 'var(--izou-danger-light)' }}>
                                {log.errorMessages.map((e, i) => (
                                  <p key={i} className="text-xs" style={{ color: 'var(--izou-danger)' }}>{e}</p>
                                ))}
                              </div>
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
        </>
      )}
    </div>
  );
}
