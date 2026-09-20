'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Clock, Bell, UserCheck, ChevronDown, ChevronUp, Settings2, Pencil, Save, X,  } from 'lucide-react';
import { workflowTemplateService, type WorkflowTemplate, type WorkflowStep, type WorkflowEscalationAction } from '@/lib/supabase/workflowEngineService';
import { workflowInstanceService, type WorkflowInstance } from '@/lib/supabase/workflowEngineService';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

// ─── Constants ────────────────────────────────────────────────────────────────

// Only these two actions actually do anything at runtime (WorkflowInstancesContent
// sends an escalation email when a human clicks "Escalate" on the instance) --
// the other options this used to offer (reassign/auto_approve/auto_reject/
// escalate_to_role/hold_payment) had no execution path at all.
const ESCALATION_ACTIONS: { value: WorkflowEscalationAction; label: string; bg: string; color: string }[] = [
  { value: 'notify_manager', label: 'Notify Manager', bg: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)' },
  { value: 'notify_and_hold', label: 'Notify Manager & Flag Payment for Review', bg: 'var(--izou-danger-light)', color: 'var(--izou-danger)' },
];

function getActionMeta(action: string | null) {
  return ESCALATION_ACTIONS.find((a) => a.value === action) ?? (action ? { value: action, label: action, bg: 'var(--izou-bg)', color: 'var(--izou-muted)' } : null);
}

// ─── Step Edit Row ────────────────────────────────────────────────────────────

interface StepEscalationEditProps {
  step: WorkflowStep;
  onSave: (stepId: string, slaHours: number | null, action: WorkflowEscalationAction | null, role: string | null) => Promise<void>;
  onCancel: () => void;
}

function StepEscalationEdit({ step, onSave, onCancel }: StepEscalationEditProps) {
  const [slaHours, setSlaHours] = useState<string>(step.slaHours != null ? String(step.slaHours) : '');
  const [action, setAction] = useState<string>(step.escalationAction ?? '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(
        step.id,
        slaHours !== '' ? Number(slaHours) : null,
        (action as WorkflowEscalationAction) || null,
        null,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="px-4 py-3 border-t" style={{ backgroundColor: 'var(--izou-warning-light)', borderColor: 'var(--izou-warning-light)' }}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
        {/* SLA Hours */}
        <div>
          <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
            Reference SLA (hours)
          </label>
          <div className="relative">
            <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="number"
              min={1}
              value={slaHours}
              onChange={(e) => setSlaHours(e.target.value)}
              placeholder="e.g. 48"
              className="w-full text-sm border border-border rounded-lg pl-7 pr-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--izou-warning)]/40"
            />
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">Shown on the instance as a reference target — not automatically enforced. Escalation only fires when someone clicks "Escalate" on the instance.</p>
        </div>

        {/* Escalation Action */}
        <div>
          <label className="block text-[10px] font-medium text-slate-500 uppercase tracking-wide mb-1">
            Escalation Action
          </label>
          <select
            value={action}
            onChange={(e) => setAction(e.target.value)}
            className="w-full text-sm border border-border rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-[var(--izou-warning)]/40"
          >
            <option value="">— None —</option>
            {ESCALATION_ACTIONS.map((a) => (
              <option key={a.value} value={a.value}>{a.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2">
        <button
          onClick={onCancel}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-muted-foreground border border-border rounded-lg bg-white hover:bg-muted transition-colors"
        >
          <X size={12} />
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-1 px-3 py-1.5 text-xs text-white rounded-lg font-medium transition-colors disabled:opacity-60"
          style={{ backgroundColor: 'var(--izou-warning)' }}
        >
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function EscalationConfigContent() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [escalatedInstances, setEscalatedInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);
  const [editingStep, setEditingStep] = useState<string | null>(null); // stepId

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      workflowTemplateService.getAll().then(setTemplates).catch(() => setTemplates([])),
      workflowInstanceService.getAll().then((instances) => {
        setEscalatedInstances(instances.filter((i) => i.instanceStatus === 'escalated'));
      }).catch(() => setEscalatedInstances([])),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSaveStepEscalation = async (
    stepId: string,
    slaHours: number | null,
    escalationAction: WorkflowEscalationAction | null,
    escalationRole: string | null,
  ) => {
    const supabase = createClient();
    const { error } = await supabase
      .from('workflow_steps')
      .update({
        sla_hours: slaHours,
        escalation_action: escalationAction,
        escalation_role: escalationRole,
      })
      .eq('id', stepId);

    if (error) {
      toast.error('Failed to save escalation settings');
      throw error;
    }

    // Update local state
    setTemplates((prev) =>
      prev.map((t) => ({
        ...t,
        steps: t.steps.map((s) =>
          s.id === stepId
            ? { ...s, slaHours, escalationAction, escalationRole }
            : s
        ),
      }))
    );
    toast.success('Escalation settings saved');
    setEditingStep(null);
  };

  // Show all templates (not just those with escalation) so admins can configure any step
  const activeTemplates = templates.filter((t) => t.isActive);
  const allTemplates = templates;

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--izou-warning)' }}>
              <AlertTriangle size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--izou-primary)' }}>Escalation Configuration</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Configure SLA thresholds and escalation actions for each step across all workflow templates
          </p>
        </div>
        <button
          onClick={() => load()}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="rounded-xl border p-3 text-center" style={{ backgroundColor: 'var(--izou-warning-light)', borderColor: 'var(--izou-warning-light)' }}>
          <p className="text-xl font-bold" style={{ color: 'var(--izou-warning)' }}>{allTemplates.length}</p>
          <p className="text-xs text-muted-foreground">Templates</p>
        </div>
        <div className="rounded-xl border p-3 text-center" style={{ backgroundColor: 'var(--izou-highlight-light)', borderColor: 'var(--izou-highlight-light)' }}>
          <p className="text-xl font-bold" style={{ color: 'var(--izou-highlight)' }}>
            {allTemplates.reduce((acc, t) => acc + (t.steps?.filter((s) => s.escalationAction).length ?? 0), 0)}
          </p>
          <p className="text-xs text-muted-foreground">Steps with Escalation</p>
        </div>
        <div className="rounded-xl border p-3 text-center" style={{ backgroundColor: 'var(--izou-danger-light)', borderColor: 'var(--izou-danger-light)' }}>
          <p className="text-xl font-bold" style={{ color: 'var(--izou-danger)' }}>{escalatedInstances.length}</p>
          <p className="text-xs text-muted-foreground">Currently Escalated</p>
        </div>
      </div>

      {/* Currently Escalated */}
      {escalatedInstances.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border" style={{ backgroundColor: 'var(--izou-warning-light)', borderColor: 'var(--izou-warning-light)' }}>
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} style={{ color: 'var(--izou-warning)' }} />
            <h2 className="text-sm font-semibold" style={{ color: 'var(--izou-warning)' }}>
              {escalatedInstances.length} Currently Escalated Instance{escalatedInstances.length !== 1 ? 's' : ''}
            </h2>
          </div>
          <div className="space-y-2">
            {escalatedInstances.slice(0, 5).map((inst) => (
              <div key={inst.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border" style={{ borderColor: 'var(--izou-warning-light)' }}>
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: 'var(--izou-warning)' }} />
                <span className="font-medium text-foreground truncate">{inst.referenceLabel ?? inst.referenceId}</span>
                <span className="text-muted-foreground ml-auto shrink-0">
                  {inst.startedAt ? new Date(inst.startedAt).toLocaleDateString('en-GB') : '—'}
                </span>
              </div>
            ))}
            {escalatedInstances.length > 5 && (
              <p className="text-xs text-center" style={{ color: 'var(--izou-warning)' }}>+{escalatedInstances.length - 5} more — view in Active Instances</p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : allTemplates.length === 0 ? (
        <div className="text-center py-16 bg-white border border-border rounded-2xl">
          <Settings2 size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground mb-1">No workflow templates found</p>
          <p className="text-xs text-muted-foreground">Create workflow templates first, then configure escalation rules for each step here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {allTemplates.map((template) => {
            const isExpanded = expandedTemplate === template.id;
            const steps = template.steps ?? [];
            const configuredCount = steps.filter((s) => s.escalationAction).length;

            return (
              <div key={template.id} className="bg-white border border-border rounded-xl overflow-hidden">
                {/* Template header */}
                <button
                  onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-warning-light)' }}>
                    <AlertTriangle size={15} style={{ color: 'var(--izou-warning)' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {steps.length} step{steps.length !== 1 ? 's' : ''} ·{' '}
                      {configuredCount > 0
                        ? <span className="font-medium" style={{ color: 'var(--izou-warning)' }}>{configuredCount} with escalation rules</span>
                        : <span className="text-slate-400">no escalation configured</span>
                      }
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className="text-xs px-2 py-0.5 rounded-full font-medium"
                      style={template.isActive
                        ? { backgroundColor: 'var(--izou-success-light)', color: 'var(--izou-success)' }
                        : { backgroundColor: 'var(--izou-bg)', color: 'var(--izou-muted)' }}
                    >
                      {template.isActive ? 'Active' : 'Inactive'}
                    </span>
                    {isExpanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
                  </div>
                </button>

                {/* Steps list */}
                {isExpanded && (
                  <div className="border-t border-border">
                    {steps.length === 0 ? (
                      <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                        No steps defined for this template.
                      </div>
                    ) : (
                      <div className="divide-y divide-border">
                        {steps.map((step) => {
                          const isEditing = editingStep === step.id;
                          const actionMeta = getActionMeta(step.escalationAction);

                          return (
                            <div key={step.id}>
                              <div className="px-4 py-3 bg-slate-50 flex items-start gap-3">
                                {/* Step order badge */}
                                <div className="w-6 h-6 rounded-full flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: 'var(--izou-warning-light)' }}>
                                  <span className="text-xs font-bold" style={{ color: 'var(--izou-warning)' }}>{step.stepOrder}</span>
                                </div>

                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium text-foreground">{step.name}</p>

                                  {/* Current escalation config summary */}
                                  <div className="flex flex-wrap items-center gap-3 mt-1.5 text-xs">
                                    {step.slaHours ? (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <Clock size={11} />
                                        SLA: <strong className="text-foreground">{step.slaHours}h</strong>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-slate-400">
                                        <Clock size={11} />
                                        <span>No SLA set</span>
                                      </div>
                                    )}

                                    {actionMeta ? (
                                      <div className="flex items-center gap-1">
                                        <Bell size={11} style={{ color: 'var(--izou-warning)' }} />
                                        <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: actionMeta.bg, color: actionMeta.color }}>
                                          {actionMeta.label}
                                        </span>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 text-slate-400">
                                        <Bell size={11} />
                                        <span>No action set</span>
                                      </div>
                                    )}

                                    {step.escalationRole && (
                                      <div className="flex items-center gap-1 text-muted-foreground">
                                        <UserCheck size={11} />
                                        <span>{step.escalationRole.replace(/_/g, ' ')}</span>
                                      </div>
                                    )}

                                    {!step.slaHours && !step.escalationAction && (
                                      <span className="text-[10px] text-slate-400 italic">Click Edit to configure escalation</span>
                                    )}
                                  </div>
                                </div>

                                {/* Edit / Done button */}
                                <button
                                  onClick={() => setEditingStep(isEditing ? null : step.id)}
                                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium transition-colors shrink-0"
                                  style={isEditing
                                    ? { backgroundColor: 'var(--izou-bg)', color: 'var(--izou-muted)' }
                                    : { backgroundColor: 'var(--izou-warning-light)', color: 'var(--izou-warning)' }}
                                >
                                  {isEditing ? (
                                    <><X size={11} /> Close</>
                                  ) : (
                                    <><Pencil size={11} /> Edit</>
                                  )}
                                </button>
                              </div>

                              {/* Inline edit form */}
                              {isEditing && (
                                <StepEscalationEdit
                                  step={step}
                                  onSave={handleSaveStepEscalation}
                                  onCancel={() => setEditingStep(null)}
                                />
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
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
