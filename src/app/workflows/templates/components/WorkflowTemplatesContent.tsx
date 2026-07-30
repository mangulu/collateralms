'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, Save, Settings2, Users, GitBranch, AlertTriangle, Loader2, X, Edit2, ToggleLeft, ToggleRight, Info, ChevronRight, Bell, Clock, UserCheck, CreditCard, ShieldAlert, Zap } from 'lucide-react';
import {
  workflowTemplateService,
  WorkflowTemplate, WorkflowStep, WorkflowStepActor, WorkflowStepCondition,
  WorkflowTemplateType, WorkflowConditionField, WorkflowConditionOperator, WorkflowEscalationAction
} from '@/lib/supabase/workflowEngineService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import TriggerRulesBuilderModal from './TriggerRulesBuilderModal';

// ─── Constants ────────────────────────────────────────────────────────────────

const WORKFLOW_TYPE_LABELS: Record<WorkflowTemplateType, string> = {
  perfection: 'Collateral Perfection',
  release: 'Collateral Release',
  valuation: 'Valuation Review',
  substitution: 'Collateral Substitution',
  document_approval: 'Document Approval',
  custom: 'Custom Workflow',
};

const WORKFLOW_TYPE_COLORS: Record<WorkflowTemplateType, string> = {
  perfection: 'bg-violet-100 text-violet-700 border-violet-200',
  release: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  valuation: 'bg-amber-100 text-amber-700 border-amber-200',
  substitution: 'bg-rose-100 text-rose-700 border-rose-200',
  document_approval: 'bg-blue-100 text-blue-700 border-blue-200',
  custom: 'bg-slate-100 text-slate-700 border-slate-200',
};

const CONDITION_FIELD_LABELS: Record<WorkflowConditionField, string> = {
  collateral_value: 'Collateral Value (TZS)',
  collateral_type: 'Collateral Type',
  loan_amount: 'Loan Amount (TZS)',
  ltv_ratio: 'LTV Ratio (%)',
  obligor_tier: 'Obligor Tier',
  collateral_status: 'Collateral Status',
  days_overdue: 'Days Overdue',
  document_count: 'Document Count',
};

const CONDITION_OPERATOR_LABELS: Record<WorkflowConditionOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  greater_than: 'is greater than',
  less_than: 'is less than',
  greater_than_or_equal: 'is at least',
  less_than_or_equal: 'is at most',
  contains: 'contains',
  not_contains: 'does not contain',
  is_empty: 'is empty',
  is_not_empty: 'is not empty',
};

const ESCALATION_ACTION_LABELS: Record<WorkflowEscalationAction, string> = {
  notify_manager: 'Notify Manager',
  reassign: 'Reassign to Manager',
  auto_approve: 'Auto-Approve',
  auto_reject: 'Auto-Reject',
  escalate_to_role: 'Escalate to Role',
  hold_payment: 'Hold Payment',
  notify_and_hold: 'Notify & Hold Payment',
};

const ESCALATION_ACTION_DESCRIPTIONS: Record<WorkflowEscalationAction, string> = {
  notify_manager: 'Send an alert to the manager when the step is idle',
  reassign: 'Automatically move the task to the manager for action',
  auto_approve: 'Automatically approve and advance to the next step',
  auto_reject: 'Automatically reject and cancel the workflow',
  escalate_to_role: 'Reassign the step to a specific role',
  hold_payment: 'Place a hold on any pending payment until resolved',
  notify_and_hold: 'Notify the manager AND hold any pending payment',
};

const ESCALATION_ACTION_ICONS: Record<WorkflowEscalationAction, React.ReactNode> = {
  notify_manager: <Bell size={13} className="text-blue-500" />,
  reassign: <UserCheck size={13} className="text-indigo-500" />,
  auto_approve: <ShieldAlert size={13} className="text-green-500" />,
  auto_reject: <ShieldAlert size={13} className="text-red-500" />,
  escalate_to_role: <UserCheck size={13} className="text-violet-500" />,
  hold_payment: <CreditCard size={13} className="text-rose-500" />,
  notify_and_hold: <CreditCard size={13} className="text-amber-500" />,
};

const AVAILABLE_ROLES = [
  { value: 'credit_officer', label: 'Credit Officer' },
  { value: 'legal_officer', label: 'Legal Officer' },
  { value: 'senior_legal_officer', label: 'Senior Legal Officer' },
  { value: 'credit_manager', label: 'Credit Manager' },
  { value: 'head_of_legal', label: 'Head of Legal' },
  { value: 'system_admin', label: 'System Admin' },
  { value: 'compliance_officer', label: 'Compliance Officer' },
];

const CONDITION_FIELDS: WorkflowConditionField[] = [
  'collateral_value', 'collateral_type', 'loan_amount', 'ltv_ratio',
  'obligor_tier', 'collateral_status', 'days_overdue', 'document_count',
];

const CONDITION_OPERATORS: WorkflowConditionOperator[] = [
  'equals', 'not_equals', 'greater_than', 'less_than',
  'greater_than_or_equal', 'less_than_or_equal', 'contains', 'not_contains',
];

// ─── Blank Step Factory ───────────────────────────────────────────────────────

function blankStep(): Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'> {
  return {
    templateId: '',
    stepOrder: 1,
    name: '',
    description: '',
    isOptional: false,
    requiresAllActors: false,
    slaHours: 48,
    escalationAction: 'notify_manager',
    escalationRole: null,
    escalationNotifyRoles: [],
    notifyOnEnter: true,
    notifyOnComplete: true,
    notifyRoles: [],
    actors: [],
    conditions: [],
  };
}

// ─── Escalation Panel ─────────────────────────────────────────────────────────

interface EscalationPanelProps {
  step: Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'>;
  onChange: (updated: Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'>) => void;
}

function EscalationPanel({ step, onChange }: EscalationPanelProps) {
  const needsRole = step.escalationAction === 'escalate_to_role' || step.escalationAction === 'reassign';
  const needsNotifyRoles = step.escalationAction === 'notify_manager' || step.escalationAction === 'notify_and_hold';

  function toggleNotifyRole(role: string) {
    const current = step.escalationNotifyRoles ?? [];
    const updated = current.includes(role)
      ? current.filter((r) => r !== role)
      : [...current, role];
    onChange({ ...step, escalationNotifyRoles: updated });
  }

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/40 overflow-hidden">
      {/* Panel Header */}
      <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 border-b border-amber-100">
        <Clock size={13} className="text-amber-600" />
        <span className="text-xs font-700 text-amber-800">Escalation Conditions</span>
        <span className="ml-auto text-[10px] text-amber-600 font-500">
          Triggered when step is idle beyond SLA
        </span>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* SLA reminder */}
        <div className="flex items-center gap-2 p-3 bg-white border border-amber-100 rounded-lg">
          <Clock size={12} className="text-amber-500 shrink-0" />
          <p className="text-xs text-amber-700">
            {step.slaHours
              ? <>These conditions trigger if this step is idle for more than <strong>{step.slaHours} hours</strong>.</>
              : <span className="italic">Set an SLA (hours) above to enable time-based escalation.</span>
            }
          </p>
        </div>

        {/* Action selector — visual cards */}
        <div>
          <label className="block text-xs font-600 text-foreground mb-2">What should happen when SLA is breached?</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {(Object.keys(ESCALATION_ACTION_LABELS) as WorkflowEscalationAction[]).map((action) => (
              <button
                key={action}
                type="button"
                onClick={() => onChange({ ...step, escalationAction: action })}
                className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                  step.escalationAction === action
                    ? 'border-amber-400 bg-amber-50 ring-1 ring-amber-300' :'border-border bg-white hover:border-amber-200 hover:bg-amber-50/30'
                }`}
              >
                <span className="mt-0.5 shrink-0">{ESCALATION_ACTION_ICONS[action]}</span>
                <div>
                  <p className="text-xs font-600 text-foreground leading-tight">{ESCALATION_ACTION_LABELS[action]}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 leading-snug">{ESCALATION_ACTION_DESCRIPTIONS[action]}</p>
                </div>
                {step.escalationAction === action && (
                  <span className="ml-auto shrink-0 w-4 h-4 rounded-full bg-amber-500 flex items-center justify-center">
                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                  </span>
                )}
              </button>
            ))}
            <button
              type="button"
              onClick={() => onChange({ ...step, escalationAction: null })}
              className={`flex items-start gap-2.5 p-3 rounded-lg border text-left transition-all ${
                step.escalationAction === null
                  ? 'border-slate-400 bg-slate-50 ring-1 ring-slate-300' :'border-border bg-white hover:border-slate-200'
              }`}
            >
              <X size={13} className="text-slate-400 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-600 text-foreground leading-tight">No escalation</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">Step can remain idle indefinitely</p>
              </div>
              {step.escalationAction === null && (
                <span className="ml-auto shrink-0 w-4 h-4 rounded-full bg-slate-400 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Conditional: Role picker for reassign / escalate_to_role */}
        {needsRole && (
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">
              {step.escalationAction === 'reassign' ? 'Reassign to which role?' : 'Escalate to which role?'}
            </label>
            <select
              value={step.escalationRole ?? ''}
              onChange={(e) => onChange({ ...step, escalationRole: e.target.value || null })}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30"
            >
              <option value="">Select a role</option>
              {AVAILABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
            {!step.escalationRole && (
              <p className="text-[10px] text-amber-600 mt-1">Please select a role to complete this escalation rule.</p>
            )}
          </div>
        )}

        {/* Conditional: Notify roles for notify_manager / notify_and_hold */}
        {needsNotifyRoles && (
          <div>
            <label className="block text-xs font-600 text-foreground mb-2">
              Who should be notified?
              <span className="ml-1 font-400 text-muted-foreground">(select all that apply)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {AVAILABLE_ROLES.map((r) => {
                const selected = (step.escalationNotifyRoles ?? []).includes(r.value);
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => toggleNotifyRole(r.value)}
                    className={`px-3 py-1.5 rounded-full text-xs font-600 border transition-all ${
                      selected
                        ? 'bg-amber-500 text-white border-amber-500' :'bg-white text-foreground border-border hover:border-amber-300'
                    }`}
                  >
                    {r.label}
                  </button>
                );
              })}
            </div>
            {(step.escalationNotifyRoles ?? []).length === 0 && (
              <p className="text-[10px] text-amber-600 mt-1.5">Select at least one role to receive the notification.</p>
            )}
          </div>
        )}

        {/* hold_payment info */}
        {(step.escalationAction === 'hold_payment' || step.escalationAction === 'notify_and_hold') && (
          <div className="flex items-start gap-2 p-3 bg-rose-50 border border-rose-100 rounded-lg">
            <CreditCard size={12} className="text-rose-500 mt-0.5 shrink-0" />
            <p className="text-[10px] text-rose-700 leading-relaxed">
              A payment hold flag will be set on the associated collateral record. The hold is automatically lifted when this step is approved or the workflow is completed.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Step Editor ──────────────────────────────────────────────────────────────

interface StepEditorProps {
  step: Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'>;
  index: number;
  total: number;
  onChange: (updated: Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
}

function StepEditor({ step, index, total, onChange, onMoveUp, onMoveDown, onDelete }: StepEditorProps) {
  const [expanded, setExpanded] = useState(true);

  function addActor() {
    onChange({
      ...step,
      actors: [...step.actors, {
        id: '', stepId: '', actorRole: 'credit_officer', actorLabel: 'Credit Officer',
        canApprove: true, canReject: true, canReturn: true, canComment: true,
      }],
    });
  }

  function updateActor(i: number, patch: Partial<WorkflowStepActor>) {
    const actors = step.actors.map((a, idx) => idx === i ? { ...a, ...patch } : a);
    if (patch.actorRole) {
      const found = AVAILABLE_ROLES.find((r) => r.value === patch.actorRole);
      actors[i] = { ...actors[i], actorLabel: found?.label ?? patch.actorRole };
    }
    onChange({ ...step, actors });
  }

  function removeActor(i: number) {
    onChange({ ...step, actors: step.actors.filter((_, idx) => idx !== i) });
  }

  function addCondition() {
    onChange({
      ...step,
      conditions: [...step.conditions, {
        id: '', stepId: '', conditionGroup: 1,
        field: 'collateral_value', operator: 'greater_than', value: '', action: 'require_step',
      }],
    });
  }

  function updateCondition(i: number, patch: Partial<WorkflowStepCondition>) {
    onChange({ ...step, conditions: step.conditions.map((c, idx) => idx === i ? { ...c, ...patch } : c) });
  }

  function removeCondition(i: number) {
    onChange({ ...step, conditions: step.conditions.filter((_, idx) => idx !== i) });
  }

  // Escalation badge for header
  const escalationBadge = step.escalationAction && step.slaHours ? (
    <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-600 border border-amber-200 flex items-center gap-1">
      <Clock size={9} />
      {step.slaHours}h → {ESCALATION_ACTION_LABELS[step.escalationAction]}
    </span>
  ) : null;

  return (
    <div className="border border-border rounded-xl bg-white overflow-hidden">
      {/* Step Header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex flex-col gap-0.5">
          <button onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={index === 0}
            className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronUp size={13} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={index === total - 1}
            className="p-0.5 rounded hover:bg-muted disabled:opacity-30 transition-colors">
            <ChevronDown size={13} />
          </button>
        </div>
        <div className="w-7 h-7 rounded-full bg-indigo-600 text-white flex items-center justify-center text-xs font-700 shrink-0">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-600 text-foreground truncate">{step.name || 'Unnamed Step'}</p>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <p className="text-xs text-muted-foreground">
              {step.actors.length} actor{step.actors.length !== 1 ? 's' : ''} · {step.conditions.length} condition{step.conditions.length !== 1 ? 's' : ''}
              {step.slaHours ? ` · SLA ${step.slaHours}h` : ''}
            </p>
            {escalationBadge}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {step.isOptional && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-600">Optional</span>
          )}
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 size={13} />
          </button>
          <ChevronRight size={14} className={`text-muted-foreground transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border px-4 py-4 space-y-5">
          {/* Basic Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Step Name *</label>
              <input
                value={step.name}
                onChange={(e) => onChange({ ...step, name: e.target.value })}
                placeholder="e.g. Legal Review"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">
                <Clock size={11} className="inline mr-1 text-amber-500" />
                SLA (hours) — idle time before escalation
              </label>
              <input
                type="number"
                value={step.slaHours ?? ''}
                onChange={(e) => onChange({ ...step, slaHours: e.target.value ? parseInt(e.target.value) : null })}
                placeholder="e.g. 48"
                min={1}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Description</label>
            <textarea
              value={step.description}
              onChange={(e) => onChange({ ...step, description: e.target.value })}
              rows={2}
              placeholder="What happens in this step?"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
            />
          </div>

          {/* Flags */}
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={step.isOptional}
                onChange={(e) => onChange({ ...step, isOptional: e.target.checked })}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-foreground">Optional step</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={step.requiresAllActors}
                onChange={(e) => onChange({ ...step, requiresAllActors: e.target.checked })}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-foreground">Require all actors to approve</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={step.notifyOnEnter}
                onChange={(e) => onChange({ ...step, notifyOnEnter: e.target.checked })}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-foreground">Notify on step start</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={step.notifyOnComplete}
                onChange={(e) => onChange({ ...step, notifyOnComplete: e.target.checked })}
                className="w-4 h-4 rounded border-border text-indigo-600 focus:ring-indigo-500" />
              <span className="text-xs text-foreground">Notify on step complete</span>
            </label>
          </div>

          {/* Escalation Conditions Panel */}
          <EscalationPanel step={step} onChange={onChange} />

          {/* Actors */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <Users size={13} className="text-indigo-600" />
                <span className="text-xs font-700 text-foreground">Actors (who handles this step)</span>
              </div>
              <button onClick={addActor}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-600 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors">
                <Plus size={11} /> Add Actor
              </button>
            </div>
            {step.actors.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2">No actors assigned — add at least one role</p>
            )}
            <div className="space-y-2">
              {step.actors.map((actor, ai) => (
                <div key={ai} className="flex items-center gap-2 p-2.5 bg-muted/30 rounded-lg">
                  <select
                    value={actor.actorRole}
                    onChange={(e) => updateActor(ai, { actorRole: e.target.value })}
                    className="flex-1 px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
                  >
                    {AVAILABLE_ROLES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    {(['canApprove', 'canReject', 'canReturn'] as const).map((perm) => (
                      <label key={perm} className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                        <input type="checkbox" checked={actor[perm]}
                          onChange={(e) => updateActor(ai, { [perm]: e.target.checked })}
                          className="w-3.5 h-3.5 rounded border-border text-indigo-600" />
                        {perm === 'canApprove' ? 'Approve' : perm === 'canReject' ? 'Reject' : 'Return'}
                      </label>
                    ))}
                  </div>
                  <button onClick={() => removeActor(ai)}
                    className="p-1 text-muted-foreground hover:text-red-600 transition-colors">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Conditions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <GitBranch size={13} className="text-amber-600" />
                <span className="text-xs font-700 text-foreground">Conditions (when to apply this step)</span>
              </div>
              <button onClick={addCondition}
                className="flex items-center gap-1 px-2.5 py-1 text-xs font-600 text-amber-600 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors">
                <Plus size={11} /> Add Condition
              </button>
            </div>
            {step.conditions.length === 0 && (
              <p className="text-xs text-muted-foreground italic py-2">No conditions — step always applies</p>
            )}
            <div className="space-y-2">
              {step.conditions.map((cond, ci) => (
                <div key={ci} className="flex flex-wrap items-center gap-2 p-2.5 bg-amber-50/50 border border-amber-100 rounded-lg">
                  <span className="text-xs font-600 text-amber-700 shrink-0">IF</span>
                  <select
                    value={cond.field}
                    onChange={(e) => updateCondition(ci, { field: e.target.value as WorkflowConditionField })}
                    className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    {CONDITION_FIELDS.map((f) => <option key={f} value={f}>{CONDITION_FIELD_LABELS[f]}</option>)}
                  </select>
                  <select
                    value={cond.operator}
                    onChange={(e) => updateCondition(ci, { operator: e.target.value as WorkflowConditionOperator })}
                    className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    {CONDITION_OPERATORS.map((o) => <option key={o} value={o}>{CONDITION_OPERATOR_LABELS[o]}</option>)}
                  </select>
                  <input
                    value={cond.value}
                    onChange={(e) => updateCondition(ci, { value: e.target.value })}
                    placeholder="value"
                    className="w-28 px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  />
                  <span className="text-xs font-600 text-amber-700 shrink-0">THEN</span>
                  <select
                    value={cond.action}
                    onChange={(e) => updateCondition(ci, { action: e.target.value })}
                    className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    <option value="require_step">Require this step</option>
                    <option value="skip_step">Skip this step</option>
                    <option value="escalate">Escalate</option>
                  </select>
                  <button onClick={() => removeCondition(ci)}
                    className="p-1 text-muted-foreground hover:text-red-600 transition-colors ml-auto">
                    <X size={13} />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Trigger Rules Builder Modal */}
      {triggerRulesTemplate && (
        <TriggerRulesBuilderModal
          template={triggerRulesTemplate}
          onClose={() => setTriggerRulesTemplate(null)}
        />
      )}
    </div>
  );
}

// ─── Template Card ────────────────────────────────────────────────────────────

interface TemplateCardProps {
  template: WorkflowTemplate;
  onEdit: () => void;
  onToggle: () => void;
  onManageTriggers: () => void;
}

function TemplateCard({ template, onEdit, onToggle, onManageTriggers }: TemplateCardProps) {
  const escalatedSteps = template.steps.filter((s) => s.escalationAction && s.slaHours);
  return (
    <div className={`bg-white border-2 rounded-2xl p-5 transition-all ${template.isActive ? 'border-border hover:border-indigo-200' : 'border-dashed border-border opacity-60'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-700 border ${WORKFLOW_TYPE_COLORS[template.workflowType]}`}>
              {WORKFLOW_TYPE_LABELS[template.workflowType]}
            </span>
            {template.isBuiltin && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-600 bg-slate-100 text-slate-600 border border-slate-200">
                Built-in
              </span>
            )}
          </div>
          <h3 className="text-sm font-700 text-foreground">{template.name}</h3>
          {template.description && (
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{template.description}</p>
          )}
        </div>
        <button
          onClick={onToggle}
          className={`shrink-0 transition-colors ${template.isActive ? 'text-indigo-600 hover:text-indigo-700' : 'text-muted-foreground hover:text-foreground'}`}
          title={template.isActive ? 'Deactivate' : 'Activate'}
        >
          {template.isActive ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
        <span className="flex items-center gap-1"><GitBranch size={11} /> {template.steps.length} steps</span>
        <span className="flex items-center gap-1">
          <Users size={11} />
          {[...new Set(template.steps.flatMap((s) => s.actors.map((a) => a.actorRole)))].length} roles
        </span>
        <span className="flex items-center gap-1">
          <GitBranch size={11} className="text-amber-500" />
          {template.steps.reduce((n, s) => n + s.conditions.length, 0)} rules
        </span>
        {escalatedSteps.length > 0 && (
          <span className="flex items-center gap-1 text-amber-600">
            <AlertTriangle size={11} />
            {escalatedSteps.length} escalation{escalatedSteps.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      {/* Step preview */}
      <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-1">
        {template.steps.map((step, i) => (
          <React.Fragment key={step.id}>
            <div className={`shrink-0 px-2.5 py-1 rounded-full text-[10px] font-600 whitespace-nowrap ${step.escalationAction && step.slaHours ? 'bg-amber-100 text-amber-700' : 'bg-muted text-foreground'}`}>
              {step.name}
              {step.escalationAction && step.slaHours && <span className="ml-1 opacity-70">⚡</span>}
            </div>
            {i < template.steps.length - 1 && <ChevronRight size={10} className="text-muted-foreground shrink-0" />}
          </React.Fragment>
        ))}
      </div>
      <div className="flex gap-2">
        <button
          onClick={onEdit}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-600 rounded-lg transition-colors"
        >
          <Edit2 size={12} /> Edit Template
        </button>
        <button
          onClick={onManageTriggers}
          className="flex items-center justify-center gap-1.5 px-3 py-2 bg-amber-50 hover:bg-amber-100 text-amber-700 text-xs font-600 rounded-lg transition-colors border border-amber-200"
          title="Manage auto-trigger rules"
        >
          <Zap size={12} /> Triggers
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowTemplatesContent() {
  const { userProfile } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<WorkflowTemplate | null>(null);
  const [editSteps, setEditSteps] = useState<Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'>[]>([]);
  const [editName, setEditName] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [showNewForm, setShowNewForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newType, setNewType] = useState<WorkflowTemplateType>('custom');
  const [creatingNew, setCreatingNew] = useState(false);
  const [triggerRulesTemplate, setTriggerRulesTemplate] = useState<WorkflowTemplate | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await workflowTemplateService.getAll();
      setTemplates(data);
    } catch {
      toast.error('Failed to load workflow templates');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  function openEdit(template: WorkflowTemplate) {
    setEditingTemplate(template);
    setEditName(template.name);
    setEditDescription(template.description);
    setEditSteps(template.steps.map((s) => ({
      templateId: s.templateId,
      stepOrder: s.stepOrder,
      name: s.name,
      description: s.description,
      isOptional: s.isOptional,
      requiresAllActors: s.requiresAllActors,
      slaHours: s.slaHours,
      escalationAction: s.escalationAction,
      escalationRole: s.escalationRole,
      escalationNotifyRoles: s.escalationNotifyRoles ?? [],
      notifyOnEnter: s.notifyOnEnter,
      notifyOnComplete: s.notifyOnComplete,
      notifyRoles: s.notifyRoles,
      actors: s.actors,
      conditions: s.conditions,
    })));
  }

  function closeEdit() {
    setEditingTemplate(null);
    setEditSteps([]);
  }

  function addStep() {
    setEditSteps((prev) => [...prev, blankStep()]);
  }

  function updateStep(i: number, updated: Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'>) {
    setEditSteps((prev) => prev.map((s, idx) => idx === i ? updated : s));
  }

  function moveStep(i: number, dir: -1 | 1) {
    setEditSteps((prev) => {
      const arr = [...prev];
      const j = i + dir;
      if (j < 0 || j >= arr.length) return arr;
      [arr[i], arr[j]] = [arr[j], arr[i]];
      return arr;
    });
  }

  function deleteStep(i: number) {
    setEditSteps((prev) => prev.filter((_, idx) => idx !== i));
  }

  async function saveTemplate() {
    if (!editingTemplate) return;
    if (!editName.trim()) { toast.error('Template name is required'); return; }
    setSaving(true);
    try {
      await workflowTemplateService.update(editingTemplate.id, {
        name: editName,
        description: editDescription,
        updatedBy: userProfile?.id,
      });
      await workflowTemplateService.saveSteps(editingTemplate.id, editSteps);
      toast.success('Template saved successfully');
      closeEdit();
      load();
    } catch {
      toast.error('Failed to save template');
    } finally {
      setSaving(false);
    }
  }

  async function toggleTemplate(template: WorkflowTemplate) {
    try {
      await workflowTemplateService.update(template.id, { isActive: !template.isActive, updatedBy: userProfile?.id });
      setTemplates((prev) => prev.map((t) => t.id === template.id ? { ...t, isActive: !t.isActive } : t));
      toast.success(`Template ${template.isActive ? 'deactivated' : 'activated'}`);
    } catch {
      toast.error('Failed to update template');
    }
  }

  async function createTemplate() {
    if (!newName.trim()) { toast.error('Template name is required'); return; }
    setCreatingNew(true);
    try {
      await workflowTemplateService.create({
        name: newName,
        description: newDescription,
        workflowType: newType,
        createdBy: userProfile?.id ?? '',
      });
      toast.success('Template created');
      setShowNewForm(false);
      setNewName('');
      setNewDescription('');
      setNewType('custom');
      load();
    } catch {
      toast.error('Failed to create template');
    } finally {
      setCreatingNew(false);
    }
  }

  // ── Edit Panel ───────────────────────────────────────────────────────────────
  if (editingTemplate) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
        {/* Edit Header */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-3">
            <button onClick={closeEdit}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground">
              <X size={16} />
            </button>
            <div>
              <h1 className="text-xl font-800 text-foreground">Edit Template</h1>
              <p className="text-xs text-muted-foreground">Configure steps, actors, conditions, and escalation rules</p>
            </div>
          </div>
          <button
            onClick={saveTemplate}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-600 rounded-xl transition-colors disabled:opacity-60"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            Save Template
          </button>
        </div>

        {/* Template Meta */}
        <div className="bg-white border border-border rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-4">
            <Settings2 size={15} className="text-indigo-600" />
            <h2 className="text-sm font-700 text-foreground">Template Details</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Template Name *</label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Type</label>
              <div className={`px-3 py-2 text-sm rounded-lg border ${WORKFLOW_TYPE_COLORS[editingTemplate.workflowType]} font-600`}>
                {WORKFLOW_TYPE_LABELS[editingTemplate.workflowType]}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-600 text-foreground mb-1.5">Description</label>
              <textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 resize-none"
              />
            </div>
          </div>
        </div>

        {/* Steps */}
        <div className="bg-white border border-border rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <GitBranch size={15} className="text-indigo-600" />
              <h2 className="text-sm font-700 text-foreground">Workflow Steps</h2>
              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 text-xs font-600">{editSteps.length}</span>
            </div>
            <button onClick={addStep}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-600 rounded-lg transition-colors">
              <Plus size={13} /> Add Step
            </button>
          </div>
          {editSteps.length === 0 ? (
            <div className="text-center py-10">
              <GitBranch size={28} className="text-muted-foreground mx-auto mb-2 opacity-40" />
              <p className="text-sm text-muted-foreground">No steps yet — add the first step to define this workflow</p>
            </div>
          ) : (
            <div className="space-y-3">
              {editSteps.map((step, i) => (
                <StepEditor
                  key={i}
                  step={step}
                  index={i}
                  total={editSteps.length}
                  onChange={(updated) => updateStep(i, updated)}
                  onMoveUp={() => moveStep(i, -1)}
                  onMoveDown={() => moveStep(i, 1)}
                  onDelete={() => deleteStep(i)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Main List ────────────────────────────────────────────────────────────────
  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Settings2 size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-800 text-foreground">Workflow Templates</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Define steps, assign actors by role, set conditions, and configure escalation rules per step
          </p>
        </div>
        <button
          onClick={() => setShowNewForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-600 rounded-xl transition-colors shrink-0"
        >
          <Plus size={15} /> New Template
        </button>
      </div>

      {/* Info Banner */}
      <div className="flex items-start gap-3 p-4 bg-indigo-50 border border-indigo-100 rounded-xl mb-6">
        <Info size={15} className="text-indigo-600 mt-0.5 shrink-0" />
        <p className="text-xs text-indigo-800 leading-relaxed">
          The five built-in templates below power the Perfection, Release, Valuation, Substitution, and Document Approval workflows.
          You can modify their steps, actors, conditions, and escalation rules — changes take effect on new workflow instances.
          Steps marked with <strong>⚡</strong> have escalation conditions configured.
        </p>
      </div>

      {/* New Template Form */}
      {showNewForm && (
        <div className="bg-white border-2 border-indigo-200 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-700 text-foreground">New Workflow Template</h3>
            <button onClick={() => setShowNewForm(false)} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={14} />
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Name *</label>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="e.g. Fast-Track Approval"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Type</label>
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value as WorkflowTemplateType)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              >
                {Object.entries(WORKFLOW_TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Description</label>
              <input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Brief description"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowNewForm(false)}
              className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
            <button onClick={createTemplate} disabled={creatingNew}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-600 rounded-lg transition-colors disabled:opacity-60">
              {creatingNew ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
              Create Template
            </button>
          </div>
        </div>
      )}

      {/* Templates Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : templates.length === 0 ? (
        <div className="text-center py-20">
          <Settings2 size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No templates found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => openEdit(template)}
              onToggle={() => toggleTemplate(template)}
              onManageTriggers={() => setTriggerRulesTemplate(template)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
