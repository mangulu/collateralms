'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { X, Plus, Trash2, Zap, Save, Loader2, ToggleLeft, ToggleRight, ChevronDown, ChevronUp, Info, CheckCircle2, Circle,  } from 'lucide-react';
import {
  workflowTriggerRulesService,
  WorkflowTriggerRule,
  WorkflowTriggerCondition,
  WorkflowTriggerEvent,
  WorkflowTriggerOperator,
  WorkflowTriggerStatus,
  TRIGGER_EVENT_LABELS,
  TRIGGER_EVENT_DESCRIPTIONS,
  TRIGGER_OPERATOR_LABELS,
  COLLATERAL_STATUS_OPTIONS,
} from '@/lib/supabase/workflowTriggerRulesService';
import { WorkflowTemplate } from '@/lib/supabase/workflowEngineService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_EVENTS: WorkflowTriggerEvent[] = [
  'collateral_status_change',
  'days_since_submission',
  'value_threshold',
  'ltv_breach',
  'days_overdue',
  'document_count_change',
];

const NUMERIC_EVENTS: WorkflowTriggerEvent[] = [
  'days_since_submission',
  'value_threshold',
  'ltv_breach',
  'days_overdue',
  'document_count_change',
];

const NUMERIC_OPERATORS: WorkflowTriggerOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal', 'less_than_or_equal',
];

const STATUS_OPERATORS: WorkflowTriggerOperator[] = ['equals', 'not_equals'];

const EVENT_ICONS: Record<WorkflowTriggerEvent, string> = {
  collateral_status_change: '🔄',
  days_since_submission: '📅',
  value_threshold: '💰',
  ltv_breach: '📊',
  days_overdue: '⏰',
  document_count_change: '📄',
};

const EVENT_COLORS: Record<WorkflowTriggerEvent, string> = {
  collateral_status_change: 'bg-violet-50 border-violet-200 text-violet-700',
  days_since_submission: 'bg-blue-50 border-blue-200 text-blue-700',
  value_threshold: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  ltv_breach: 'bg-rose-50 border-rose-200 text-rose-700',
  days_overdue: 'bg-amber-50 border-amber-200 text-amber-700',
  document_count_change: 'bg-slate-50 border-slate-200 text-slate-700',
};

const STATUS_BADGE: Record<WorkflowTriggerStatus, string> = {
  active: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  inactive: 'bg-slate-100 text-slate-600 border-slate-200',
  draft: 'bg-amber-100 text-amber-700 border-amber-200',
};

// ─── Blank Condition Factory ──────────────────────────────────────────────────

function blankCondition(): Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'> {
  return {
    eventType: 'collateral_status_change',
    operator: 'equals',
    conditionValue: '',
    conditionValueTo: null,
    sortOrder: 1,
  };
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

  function handleEventChange(eventType: WorkflowTriggerEvent) {
    const newIsNumeric = NUMERIC_EVENTS.includes(eventType);
    onChange({
      ...condition,
      eventType,
      operator: newIsNumeric ? 'greater_than' : 'equals',
      conditionValue: '',
      conditionValueTo: null,
    });
  }

  const eventColor = EVENT_COLORS[condition.eventType];

  return (
    <div className="space-y-0">
      <div className={`p-3 rounded-xl border ${eventColor} bg-opacity-40`}>
        <div className="flex items-start gap-2">
          {/* Index badge */}
          <div className="w-5 h-5 rounded-full bg-white/70 border border-current flex items-center justify-center text-[10px] font-700 shrink-0 mt-0.5">
            {index + 1}
          </div>

          <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-2">
            {/* Event type */}
            <div>
              <label className="block text-[10px] font-600 mb-1 opacity-70">When</label>
              <select
                value={condition.eventType}
                onChange={(e) => handleEventChange(e.target.value as WorkflowTriggerEvent)}
                className="w-full px-2.5 py-1.5 text-xs border border-current/20 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-current/30"
              >
                {TRIGGER_EVENTS.map((ev) => (
                  <option key={ev} value={ev}>
                    {EVENT_ICONS[ev]} {TRIGGER_EVENT_LABELS[ev]}
                  </option>
                ))}
              </select>
            </div>

            {/* Operator */}
            <div>
              <label className="block text-[10px] font-600 mb-1 opacity-70">Condition</label>
              <select
                value={condition.operator}
                onChange={(e) => onChange({ ...condition, operator: e.target.value as WorkflowTriggerOperator })}
                className="w-full px-2.5 py-1.5 text-xs border border-current/20 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-current/30"
              >
                {operators.map((op) => (
                  <option key={op} value={op}>{TRIGGER_OPERATOR_LABELS[op]}</option>
                ))}
              </select>
            </div>

            {/* Value */}
            <div>
              <label className="block text-[10px] font-600 mb-1 opacity-70">Value</label>
              {condition.eventType === 'collateral_status_change' ? (
                <select
                  value={condition.conditionValue}
                  onChange={(e) => onChange({ ...condition, conditionValue: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-current/20 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-current/30"
                >
                  <option value="">Select status…</option>
                  {COLLATERAL_STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={condition.conditionValue}
                  onChange={(e) => onChange({ ...condition, conditionValue: e.target.value })}
                  placeholder={
                    condition.eventType === 'value_threshold' ? 'e.g. 50000000' :
                    condition.eventType === 'ltv_breach' ? 'e.g. 80 (%)' :
                    'e.g. 30'
                  }
                  min={0}
                  className="w-full px-2.5 py-1.5 text-xs border border-current/20 rounded-lg bg-white/80 focus:outline-none focus:ring-2 focus:ring-current/30"
                />
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={onDelete}
            className="p-1 rounded-lg hover:bg-white/60 text-current/60 hover:text-red-600 transition-colors shrink-0 mt-0.5"
          >
            <Trash2 size={13} />
          </button>
        </div>

        {/* Description hint */}
        <p className="text-[10px] opacity-60 mt-1.5 ml-7 leading-relaxed">
          {TRIGGER_EVENT_DESCRIPTIONS[condition.eventType]}
        </p>
      </div>

      {/* Logic connector */}
      {!isLast && (
        <div className="flex items-center justify-center py-1">
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-700 border ${
            logic === 'AND' ?'bg-indigo-50 text-indigo-700 border-indigo-200' :'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {logic}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Rule Form ────────────────────────────────────────────────────────────────

interface RuleFormProps {
  templateId: string;
  existingRule?: WorkflowTriggerRule | null;
  onSave: () => void;
  onCancel: () => void;
}

function RuleForm({ templateId, existingRule, onSave, onCancel }: RuleFormProps) {
  const { userProfile } = useAuth();
  const [name, setName] = useState(existingRule?.name ?? '');
  const [description, setDescription] = useState(existingRule?.description ?? '');
  const [logic, setLogic] = useState<'AND' | 'OR'>(existingRule?.conditionLogic ?? 'AND');
  const [conditions, setConditions] = useState<Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>[]>(
    existingRule?.conditions.map((c) => ({
      eventType: c.eventType,
      operator: c.operator,
      conditionValue: c.conditionValue,
      conditionValueTo: c.conditionValueTo,
      sortOrder: c.sortOrder,
    })) ?? [blankCondition()]
  );
  const [saving, setSaving] = useState(false);

  function addCondition() {
    setConditions((prev) => [...prev, { ...blankCondition(), sortOrder: prev.length + 1 }]);
  }

  function updateCondition(i: number, updated: Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>) {
    setConditions((prev) => prev.map((c, idx) => idx === i ? updated : c));
  }

  function removeCondition(i: number) {
    setConditions((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function handleSave() {
    if (!name.trim()) { toast.error('Rule name is required'); return; }
    if (conditions.length === 0) { toast.error('Add at least one condition'); return; }
    const invalid = conditions.find((c) => !c.conditionValue.trim());
    if (invalid) { toast.error('All conditions must have a value'); return; }

    setSaving(true);
    try {
      if (existingRule) {
        await workflowTriggerRulesService.update(existingRule.id, {
          name,
          description,
          conditionLogic: logic,
          updatedBy: userProfile?.id,
          conditions,
        });
        toast.success('Trigger rule updated');
      } else {
        await workflowTriggerRulesService.create({
          templateId,
          name,
          description,
          conditionLogic: logic,
          referenceType: 'collateral',
          createdBy: userProfile?.id ?? '',
          conditions,
        });
        toast.success('Trigger rule created');
      }
      onSave();
    } catch {
      toast.error('Failed to save trigger rule');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5">
      {/* Rule meta */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Rule Name *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Auto-trigger on high-value collateral"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
        <div>
          <label className="block text-xs font-600 text-foreground mb-1.5">Description</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of when this fires"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
          />
        </div>
      </div>

      {/* Logic selector */}
      <div>
        <label className="block text-xs font-600 text-foreground mb-2">
          Condition Logic — how should multiple conditions be evaluated?
        </label>
        <div className="flex gap-3">
          {(['AND', 'OR'] as const).map((l) => (
            <button
              key={l}
              type="button"
              onClick={() => setLogic(l)}
              className={`flex-1 py-2.5 rounded-xl border text-sm font-700 transition-all ${
                logic === l
                  ? l === 'AND' ?'bg-indigo-600 text-white border-indigo-600' :'bg-amber-500 text-white border-amber-500' :'bg-white text-muted-foreground border-border hover:border-indigo-200'
              }`}
            >
              {l}
              <span className="block text-[10px] font-400 mt-0.5 opacity-80">
                {l === 'AND' ? 'All conditions must match' : 'Any condition can match'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Conditions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-1.5">
            <Zap size={13} className="text-amber-500" />
            <span className="text-xs font-700 text-foreground">Trigger Conditions</span>
            <span className="px-1.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-600">
              {conditions.length}
            </span>
          </div>
          <button
            type="button"
            onClick={addCondition}
            className="flex items-center gap-1 px-2.5 py-1 text-xs font-600 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
          >
            <Plus size={11} /> Add Condition
          </button>
        </div>

        {conditions.length === 0 ? (
          <div className="text-center py-6 border-2 border-dashed border-border rounded-xl">
            <Zap size={20} className="text-muted-foreground mx-auto mb-2 opacity-40" />
            <p className="text-xs text-muted-foreground">No conditions yet — add one to define when this rule fires</p>
          </div>
        ) : (
          <div className="space-y-0">
            {conditions.map((cond, i) => (
              <ConditionRow
                key={i}
                condition={cond}
                index={i}
                logic={logic}
                isLast={i === conditions.length - 1}
                onChange={(updated) => updateCondition(i, updated)}
                onDelete={() => removeCondition(i)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-end gap-2 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-600 rounded-xl transition-colors disabled:opacity-60"
        >
          {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
          {existingRule ? 'Update Rule' : 'Save Rule'}
        </button>
      </div>
    </div>
  );
}

// ─── Rule Card ────────────────────────────────────────────────────────────────

interface RuleCardProps {
  rule: WorkflowTriggerRule;
  onEdit: () => void;
  onDelete: () => void;
  onToggle: () => void;
}

function RuleCard({ rule, onEdit, onDelete, onToggle }: RuleCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${
      rule.triggerStatus === 'active' ? 'border-border bg-white' : 'border-dashed border-border bg-muted/20 opacity-70'
    }`}>
      <div className="flex items-center gap-3 px-4 py-3">
        <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
          <Zap size={14} className="text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-600 text-foreground truncate">{rule.name}</p>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 border ${STATUS_BADGE[rule.triggerStatus]}`}>
              {rule.triggerStatus}
            </span>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 border ${
              rule.conditionLogic === 'AND' ?'bg-indigo-50 text-indigo-700 border-indigo-200' :'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {rule.conditionLogic}
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}
            {rule.description ? ` · ${rule.description}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onToggle}
            className={`transition-colors ${rule.triggerStatus === 'active' ? 'text-emerald-600 hover:text-emerald-700' : 'text-muted-foreground hover:text-foreground'}`}
            title={rule.triggerStatus === 'active' ? 'Deactivate rule' : 'Activate rule'}
          >
            {rule.triggerStatus === 'active' ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
          </button>
          <button
            type="button"
            onClick={onEdit}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
          >
            <Zap size={13} />
          </button>
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {expanded && rule.conditions.length > 0 && (
        <div className="border-t border-border px-4 py-3 space-y-2 bg-muted/10">
          {rule.conditions.map((cond, i) => (
            <div key={cond.id} className="space-y-0">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${EVENT_COLORS[cond.eventType]}`}>
                <span>{EVENT_ICONS[cond.eventType]}</span>
                <span className="font-600">{TRIGGER_EVENT_LABELS[cond.eventType]}</span>
                <span className="opacity-70">{TRIGGER_OPERATOR_LABELS[cond.operator]}</span>
                <span className="font-700">
                  {cond.eventType === 'collateral_status_change'
                    ? COLLATERAL_STATUS_OPTIONS.find((s) => s.value === cond.conditionValue)?.label ?? cond.conditionValue
                    : cond.conditionValue}
                  {cond.eventType === 'value_threshold' ? ' TZS' : ''}
                  {cond.eventType === 'ltv_breach' ? '%' : ''}
                  {(cond.eventType === 'days_since_submission' || cond.eventType === 'days_overdue') ? ' days' : ''}
                </span>
              </div>
              {i < rule.conditions.length - 1 && (
                <div className="flex items-center justify-center py-0.5">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-700 border ${
                    rule.conditionLogic === 'AND' ?'bg-indigo-50 text-indigo-700 border-indigo-200' :'bg-amber-50 text-amber-700 border-amber-200'
                  }`}>
                    {rule.conditionLogic}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

interface TriggerRulesBuilderModalProps {
  template: WorkflowTemplate;
  onClose: () => void;
}

export default function TriggerRulesBuilderModal({ template, onClose }: TriggerRulesBuilderModalProps) {
  const { userProfile } = useAuth();
  const [rules, setRules] = useState<WorkflowTriggerRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingRule, setEditingRule] = useState<WorkflowTriggerRule | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workflowTriggerRulesService.getByTemplateId(template.id);
      setRules(data);
    } catch {
      toast.error('Failed to load trigger rules');
    } finally {
      setLoading(false);
    }
  }, [template.id]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(ruleId: string) {
    try {
      await workflowTriggerRulesService.delete(ruleId);
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      toast.success('Trigger rule deleted');
    } catch {
      toast.error('Failed to delete rule');
    }
  }

  async function handleToggle(rule: WorkflowTriggerRule) {
    try {
      await workflowTriggerRulesService.toggleStatus(rule.id, rule.triggerStatus, userProfile?.id ?? '');
      setRules((prev) =>
        prev.map((r) =>
          r.id === rule.id
            ? { ...r, triggerStatus: r.triggerStatus === 'active' ? 'inactive' : 'active' }
            : r
        )
      );
      toast.success(`Rule ${rule.triggerStatus === 'active' ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update rule status');
    }
  }

  function handleFormSave() {
    setShowForm(false);
    setEditingRule(null);
    load();
  }

  function openEdit(rule: WorkflowTriggerRule) {
    setEditingRule(rule);
    setShowForm(true);
  }

  const activeCount = rules.filter((r) => r.triggerStatus === 'active').length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-background rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center">
              <Zap size={16} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Auto-Trigger Rules</h2>
              <p className="text-xs text-muted-foreground">
                {template.name} · {rules.length} rule{rules.length !== 1 ? 's' : ''} · {activeCount} active
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Info banner */}
        <div className="mx-6 mt-4 flex items-start gap-2.5 p-3 bg-amber-50 border border-amber-100 rounded-xl shrink-0">
          <Info size={13} className="text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800 leading-relaxed">
            Define conditions that <strong>automatically start a new workflow instance</strong> for this template —
            no manual initiation required. Rules fire when a collateral record matches all (AND) or any (OR) of the defined conditions.
          </p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Form */}
          {showForm && (
            <div className="border-2 border-indigo-200 rounded-2xl p-5 bg-indigo-50/20">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-700 text-foreground">
                  {editingRule ? 'Edit Trigger Rule' : 'New Trigger Rule'}
                </h3>
              </div>
              <RuleForm
                templateId={template.id}
                existingRule={editingRule}
                onSave={handleFormSave}
                onCancel={() => { setShowForm(false); setEditingRule(null); }}
              />
            </div>
          )}

          {/* Rules list */}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 size={22} className="animate-spin text-muted-foreground" />
            </div>
          ) : rules.length === 0 && !showForm ? (
            <div className="text-center py-12">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center mx-auto mb-3">
                <Zap size={22} className="text-amber-500" />
              </div>
              <p className="text-sm font-600 text-foreground mb-1">No trigger rules yet</p>
              <p className="text-xs text-muted-foreground mb-4">
                Create a rule to automatically start this workflow when conditions are met
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-600 rounded-xl transition-colors"
              >
                <Plus size={13} /> Create First Rule
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => (
                <RuleCard
                  key={rule.id}
                  rule={rule}
                  onEdit={() => openEdit(rule)}
                  onDelete={() => handleDelete(rule.id)}
                  onToggle={() => handleToggle(rule)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {!showForm && (
          <div className="px-6 py-4 border-t border-border shrink-0 flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              {activeCount > 0 ? (
                <>
                  <CheckCircle2 size={13} className="text-emerald-500" />
                  <span>{activeCount} active rule{activeCount !== 1 ? 's' : ''} will auto-trigger this workflow</span>
                </>
              ) : (
                <>
                  <Circle size={13} className="text-muted-foreground" />
                  <span>No active rules — workflow requires manual initiation</span>
                </>
              )}
            </div>
            <button
              onClick={() => { setEditingRule(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-600 rounded-xl transition-colors"
            >
              <Plus size={13} /> Add Rule
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
