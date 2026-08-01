'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Trash2, ToggleLeft, ToggleRight, Loader2, Zap, RefreshCw,
  ChevronDown, ChevronUp, Info, Plus, X, Save, Settings2,
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
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_TYPE_COLORS: Record<string, string> = {
  collateral_status_change: 'bg-blue-100 text-blue-700 border-blue-200',
  days_since_submission: 'bg-amber-100 text-amber-700 border-amber-200',
  value_threshold: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ltv_breach: 'bg-red-100 text-red-700 border-red-200',
  days_overdue: 'bg-orange-100 text-orange-700 border-orange-200',
  document_count_change: 'bg-violet-100 text-violet-700 border-violet-200',
};

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

const EVENT_COLORS: Record<WorkflowTriggerEvent, string> = {
  collateral_status_change: 'bg-violet-50 border-violet-200',
  days_since_submission: 'bg-blue-50 border-blue-200',
  value_threshold: 'bg-emerald-50 border-emerald-200',
  ltv_breach: 'bg-rose-50 border-rose-200',
  days_overdue: 'bg-amber-50 border-amber-200',
  document_count_change: 'bg-slate-50 border-slate-200',
};

function blankCondition(): Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'> {
  return { eventType: 'collateral_status_change', operator: 'equals', conditionValue: '', conditionValueTo: null, sortOrder: 1 };
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
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
      <div className={`p-3 rounded-xl border ${eventColor}`}>
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

export default function TriggerRulesAdminContent() {
  const { user } = useAuth();
  const [rules, setRules] = useState<WorkflowTriggerRule[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  // Create form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    templateId: '',
    name: '',
    description: '',
    conditionLogic: 'AND\' as \'AND\' | \'OR',
    referenceType: 'collateral',
  });
  const [conditions, setConditions] = useState<Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>[]>([blankCondition()]);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      workflowTriggerRulesService.getAll().then(setRules).catch(() => setRules([])),
      workflowTemplateService.getAll().then(setTemplates).catch(() => setTemplates([])),
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
          <button
            onClick={() => setShowCreateForm((v) => !v)}
            className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {showCreateForm ? <X size={14} /> : <Plus size={14} />}
            {showCreateForm ? 'Cancel' : 'New Rule'}
          </button>
        </div>
      </div>

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
          Rules are evaluated by the Trigger Processor job
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
            const typeColor = TRIGGER_TYPE_COLORS[firstEventType] ?? 'bg-slate-100 text-slate-700 border-slate-200';
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
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColor}`}>
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
    </div>
  );
}
