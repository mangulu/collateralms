'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, CheckCircle2, XCircle, RotateCcw, ChevronRight, Loader2, Pause, X, Search, RefreshCw, SkipForward, Flag, Clock, ShieldCheck, AlertTriangle, Users, GitBranch } from 'lucide-react';
import {
  workflowInstanceService, workflowTemplateService,
  WorkflowInstance, WorkflowTemplate, WorkflowTransitionLog,
  WorkflowInstanceStatus, WorkflowStepStatus
} from '@/lib/supabase/workflowEngineService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { sendEscalationEmails } from '@/lib/supabase/escalationEmailService';
import { useEscalationRealtime } from '@/lib/hooks/useEscalationRealtime';

// ─── Constants ────────────────────────────────────────────────────────────────

const INSTANCE_STATUS_CONFIG: Record<WorkflowInstanceStatus, { label: string; color: string; bg: string; dot: string }> = {
  active: { label: 'Active', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', dot: 'bg-blue-500' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200', dot: 'bg-red-500' },
  on_hold: { label: 'On Hold', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', dot: 'bg-amber-500' },
  escalated: { label: 'Escalated', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', dot: 'bg-orange-500' },
};

const STEP_STATUS_CONFIG: Record<WorkflowStepStatus, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-slate-600', bg: 'bg-slate-100' },
  active: { label: 'In Progress', color: 'text-blue-700', bg: 'bg-blue-100' },
  completed: { label: 'Completed', color: 'text-emerald-700', bg: 'bg-emerald-100' },
  skipped: { label: 'Skipped', color: 'text-slate-500', bg: 'bg-slate-100' },
  rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100' },
  escalated: { label: 'Escalated', color: 'text-orange-700', bg: 'bg-orange-100' },
};

const ACTION_LOG_LABELS: Record<string, { label: string; color: string }> = {
  started: { label: 'Workflow Started', color: 'bg-blue-500' },
  approve: { label: 'Approved', color: 'bg-emerald-500' },
  reject: { label: 'Rejected', color: 'bg-red-500' },
  return: { label: 'Returned', color: 'bg-orange-500' },
  skip: { label: 'Step Skipped', color: 'bg-slate-400' },
  escalate: { label: 'Escalated', color: 'bg-amber-500' },
  cancel: { label: 'Cancelled', color: 'bg-red-600' },
  hold: { label: 'Put On Hold', color: 'bg-amber-400' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Workflow Efficiency KPIs ─────────────────────────────────────────────────

interface WorkflowKPIs {
  avgCycleTimeDays: number | null;
  slaComplianceRate: number | null;
  escalationFrequency: number | null;
  pendingByRole: { role: string; count: number }[];
  bottleneckSteps: { stepName: string; count: number; templateName: string }[];
}

function computeKPIs(instances: WorkflowInstance[], templates: WorkflowTemplate[]): WorkflowKPIs {
  // Average cycle time (completed instances only)
  const completed = instances.filter((i) => i.instanceStatus === 'completed' && i.startedAt && i.completedAt);
  const avgCycleTimeDays = completed.length > 0
    ? completed.reduce((sum, i) => {
        const diff = new Date(i.completedAt!).getTime() - new Date(i.startedAt!).getTime();
        return sum + diff / (1000 * 60 * 60 * 24);
      }, 0) / completed.length
    : null;

  // SLA compliance: steps with slaHours defined — check if completed within SLA
  let slaTotal = 0;
  let slaCompliant = 0;
  instances.forEach((inst) => {
    const tpl = templates.find((t) => t.id === inst.templateId);
    if (!tpl) return;
    (inst.instanceSteps ?? []).forEach((is) => {
      const step = tpl.steps.find((s) => s.id === is.stepId);
      if (!step?.slaHours || is.stepStatus !== 'completed') return;
      slaTotal++;
      if (is.startedAt && is.completedAt) {
        const hours = (new Date(is.completedAt).getTime() - new Date(is.startedAt).getTime()) / (1000 * 60 * 60);
        if (hours <= step.slaHours) slaCompliant++;
      }
    });
  });
  const slaComplianceRate = slaTotal > 0 ? Math.round((slaCompliant / slaTotal) * 100) : null;

  // Escalation frequency (% of active+completed instances that were escalated)
  const relevantInstances = instances.filter((i) => ['active', 'completed', 'escalated'].includes(i.instanceStatus));
  const escalatedCount = instances.filter((i) => i.instanceStatus === 'escalated').length;
  const escalationFrequency = relevantInstances.length > 0
    ? Math.round((escalatedCount / relevantInstances.length) * 100)
    : null;

  // Pending actions by role: look at active instances, find current step actors
  const roleCountMap: Record<string, number> = {};
  instances.filter((i) => i.instanceStatus === 'active').forEach((inst) => {
    const tpl = templates.find((t) => t.id === inst.templateId);
    if (!tpl || !inst.currentStepId) return;
    const step = tpl.steps.find((s) => s.id === inst.currentStepId);
    if (!step) return;
    step.actors.forEach((a) => {
      const role = a.actorLabel ?? a.actorType ?? 'Unknown';
      roleCountMap[role] = (roleCountMap[role] ?? 0) + 1;
    });
  });
  const pendingByRole = Object.entries(roleCountMap)
    .map(([role, count]) => ({ role, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Bottleneck steps: active steps with the most instances stuck on them
  const stepCountMap: Record<string, { count: number; stepName: string; templateName: string }> = {};
  instances.filter((i) => i.instanceStatus === 'active' && i.currentStepId).forEach((inst) => {
    const tpl = templates.find((t) => t.id === inst.templateId);
    if (!tpl || !inst.currentStepId) return;
    const step = tpl.steps.find((s) => s.id === inst.currentStepId);
    if (!step) return;
    const key = `${tpl.id}::${step.id}`;
    if (!stepCountMap[key]) stepCountMap[key] = { count: 0, stepName: step.name, templateName: tpl.name };
    stepCountMap[key].count++;
  });
  const bottleneckSteps = Object.values(stepCountMap)
    .sort((a, b) => b.count - a.count)
    .slice(0, 4);

  return { avgCycleTimeDays, slaComplianceRate, escalationFrequency, pendingByRole, bottleneckSteps };
}

interface WorkflowEfficiencyKPIsProps {
  instances: WorkflowInstance[];
  templates: WorkflowTemplate[];
}

function WorkflowEfficiencyKPIs({ instances, templates }: WorkflowEfficiencyKPIsProps) {
  const kpis = computeKPIs(instances, templates);

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <h2 className="text-sm font-700 text-foreground">Workflow Efficiency KPIs</h2>
        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-600 rounded-full border border-indigo-100">Live</span>
      </div>

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-3">
        {/* Avg Cycle Time */}
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <Clock size={13} className="text-blue-600" />
            </div>
            <span className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide">Avg Cycle Time</span>
          </div>
          {kpis.avgCycleTimeDays !== null ? (
            <div className="flex items-baseline gap-1">
              <span className="text-2xl font-800 text-foreground">{kpis.avgCycleTimeDays.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">days</span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground italic">No completed instances</span>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">Across completed workflows</p>
        </div>

        {/* SLA Compliance */}
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 flex items-center justify-center">
              <ShieldCheck size={13} className="text-emerald-600" />
            </div>
            <span className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide">SLA Compliance</span>
          </div>
          {kpis.slaComplianceRate !== null ? (
            <>
              <div className="flex items-baseline gap-1">
                <span className={`text-2xl font-800 ${kpis.slaComplianceRate >= 80 ? 'text-emerald-700' : kpis.slaComplianceRate >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                  {kpis.slaComplianceRate}%
                </span>
              </div>
              <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full ${kpis.slaComplianceRate >= 80 ? 'bg-emerald-500' : kpis.slaComplianceRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                  style={{ width: `${kpis.slaComplianceRate}%` }}
                />
              </div>
            </>
          ) : (
            <span className="text-sm text-muted-foreground italic">No SLA data yet</span>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">Steps completed within SLA</p>
        </div>

        {/* Escalation Frequency */}
        <div className="bg-white border border-border rounded-xl p-4 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
              <AlertTriangle size={13} className="text-orange-600" />
            </div>
            <span className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide">Escalation Rate</span>
          </div>
          {kpis.escalationFrequency !== null ? (
            <div className="flex items-baseline gap-1">
              <span className={`text-2xl font-800 ${kpis.escalationFrequency === 0 ? 'text-emerald-700' : kpis.escalationFrequency <= 15 ? 'text-amber-700' : 'text-red-700'}`}>
                {kpis.escalationFrequency}%
              </span>
            </div>
          ) : (
            <span className="text-sm text-muted-foreground italic">No data</span>
          )}
          <p className="text-[10px] text-muted-foreground mt-1">Instances escalated</p>
        </div>
      </div>

      {/* Bottom Row: Pending by Role + Bottleneck Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* Pending Actions by Role */}
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
              <Users size={13} className="text-violet-600" />
            </div>
            <span className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide">Pending Actions by Role</span>
          </div>
          {kpis.pendingByRole.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No pending actions</p>
          ) : (
            <div className="space-y-2">
              {kpis.pendingByRole.map(({ role, count }) => {
                const maxCount = kpis.pendingByRole[0].count;
                const pct = Math.round((count / maxCount) * 100);
                return (
                  <div key={role}>
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-xs font-500 text-foreground capitalize">{role.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-700 text-violet-700">{count}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-violet-400 rounded-full" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Bottleneck Steps */}
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-7 h-7 rounded-lg bg-rose-50 flex items-center justify-center">
              <GitBranch size={13} className="text-rose-600" />
            </div>
            <span className="text-[11px] font-600 text-muted-foreground uppercase tracking-wide">Bottleneck Steps</span>
          </div>
          {kpis.bottleneckSteps.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">No active bottlenecks</p>
          ) : (
            <div className="space-y-2">
              {kpis.bottleneckSteps.map(({ stepName, count, templateName }, idx) => (
                <div key={idx} className="flex items-center gap-3 p-2 rounded-lg bg-rose-50/60 border border-rose-100">
                  <div className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                    <span className="text-[10px] font-700 text-rose-700">{count}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-600 text-foreground truncate">{stepName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{templateName}</p>
                  </div>
                  <span className="text-[10px] text-rose-600 font-600 shrink-0">{count} stuck</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Instance Detail Panel ────────────────────────────────────────────────────

interface InstanceDetailProps {
  instance: WorkflowInstance;
  template: WorkflowTemplate | null;
  log: WorkflowTransitionLog[];
  onAction: (action: 'approve' | 'reject' | 'return' | 'skip' | 'escalate' | 'cancel' | 'hold', comment: string) => Promise<void>;
  onClose: () => void;
  acting: boolean;
}

function InstanceDetail({ instance, template, log, onAction, onClose, acting }: InstanceDetailProps) {
  const [comment, setComment] = useState('');
  const [confirmAction, setConfirmAction] = useState<string | null>(null);

  const currentStep = template?.steps.find((s) => s.id === instance.currentStepId);
  const instanceSteps = instance.instanceSteps ?? [];

  async function handleAction(action: 'approve' | 'reject' | 'return' | 'skip' | 'escalate' | 'cancel' | 'hold') {
    await onAction(action, comment);
    setComment('');
    setConfirmAction(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-end">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-xl h-full bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Panel Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border bg-white">
          <div>
            <h2 className="text-sm font-700 text-foreground">{instance.referenceLabel ?? instance.referenceId}</h2>
            <p className="text-xs text-muted-foreground">{template?.name ?? 'Workflow Instance'}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-full text-xs font-600 border ${INSTANCE_STATUS_CONFIG[instance.instanceStatus].bg} ${INSTANCE_STATUS_CONFIG[instance.instanceStatus].color}`}>
              <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${INSTANCE_STATUS_CONFIG[instance.instanceStatus].dot}`} />
              {INSTANCE_STATUS_CONFIG[instance.instanceStatus].label}
            </span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
              <X size={15} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Current Step Banner */}
          {currentStep && instance.instanceStatus === 'active' && (
            <div className="mx-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
              <div className="flex items-center gap-2 mb-1">
                <Activity size={13} className="text-blue-600" />
                <span className="text-xs font-700 text-blue-800">Current Step</span>
              </div>
              <p className="text-sm font-600 text-blue-900">{currentStep.name}</p>
              {currentStep.description && (
                <p className="text-xs text-blue-700 mt-0.5">{currentStep.description}</p>
              )}
              {currentStep.actors.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {currentStep.actors.map((a) => (
                    <span key={a.id} className="px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-[10px] font-600">
                      {a.actorLabel}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Step Progress */}
          {template && template.steps.length > 0 && (
            <div className="px-4 mt-4">
              <p className="text-xs font-700 text-foreground mb-3">Step Progress</p>
              <div className="space-y-2">
                {template.steps.map((step, i) => {
                  const instStep = instanceSteps.find((is) => is.stepId === step.id);
                  const status = instStep?.stepStatus ?? 'pending';
                  const cfg = STEP_STATUS_CONFIG[status];
                  const isCurrent = step.id === instance.currentStepId;
                  return (
                    <div key={step.id} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${isCurrent ? 'border-blue-200 bg-blue-50' : 'border-border bg-white'}`}>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-700 shrink-0 ${status === 'completed' ? 'bg-emerald-500 text-white' : status === 'active' ? 'bg-blue-500 text-white' : status === 'rejected' ? 'bg-red-500 text-white' : status === 'skipped' ? 'bg-slate-300 text-slate-600' : 'bg-slate-100 text-slate-500'}`}>
                        {status === 'completed' ? <CheckCircle2 size={12} /> : status === 'rejected' ? <XCircle size={12} /> : status === 'skipped' ? <SkipForward size={12} /> : i + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-600 ${isCurrent ? 'text-blue-800' : 'text-foreground'}`}>{step.name}</p>
                        {step.slaHours && (
                          <p className="text-[10px] text-muted-foreground">SLA: {step.slaHours}h</p>
                        )}
                      </div>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-600 ${cfg.bg} ${cfg.color}`}>
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Actions */}
          {instance.instanceStatus === 'active' && (
            <div className="px-4 mt-5">
              <p className="text-xs font-700 text-foreground mb-3">Actions</p>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                placeholder="Add a comment (optional)..."
                className="w-full px-3 py-2 text-xs border border-border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-indigo-500/30 resize-none mb-3"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => handleAction('approve')}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  {acting ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                  Approve & Advance
                </button>
                <button
                  onClick={() => handleAction('return')}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-orange-100 hover:bg-orange-200 text-orange-700 text-xs font-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  <RotateCcw size={12} /> Return to Previous
                </button>
                <button
                  onClick={() => handleAction('skip')}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  <SkipForward size={12} /> Skip Step
                </button>
                <button
                  onClick={() => handleAction('escalate')}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-100 hover:bg-amber-200 text-amber-700 text-xs font-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Flag size={12} /> Escalate
                </button>
                <button
                  onClick={() => handleAction('reject')}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-red-50 hover:bg-red-100 text-red-700 text-xs font-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  <XCircle size={12} /> Reject
                </button>
                <button
                  onClick={() => handleAction('hold')}
                  disabled={acting}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-600 rounded-lg transition-colors disabled:opacity-60"
                >
                  <Pause size={12} /> Hold
                </button>
              </div>
            </div>
          )}

          {/* Transition Log */}
          <div className="px-4 mt-5 pb-6">
            <p className="text-xs font-700 text-foreground mb-3">Transition Log</p>
            {log.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No transitions recorded yet</p>
            ) : (
              <div className="relative">
                <div className="absolute left-2.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-3">
                  {log.map((entry) => {
                    const cfg = ACTION_LOG_LABELS[entry.action] ?? { label: entry.action, color: 'bg-slate-400' };
                    return (
                      <div key={entry.id} className="flex gap-3 pl-7 relative">
                        <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full ${cfg.color} flex items-center justify-center`}>
                          <Activity size={9} className="text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-600 text-foreground">{cfg.label}</span>
                            {entry.performedByName && (
                              <span className="text-[10px] text-muted-foreground">by {entry.performedByName}</span>
                            )}
                            {entry.performedByRole && (
                              <span className="px-1.5 py-0.5 bg-muted rounded text-[10px] text-muted-foreground">
                                {entry.performedByRole.replace(/_/g, ' ')}
                              </span>
                            )}
                          </div>
                          {entry.comment && (
                            <p className="text-xs text-muted-foreground mt-0.5 italic">"{entry.comment}"</p>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-0.5">{formatDateTime(entry.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Instance Row ─────────────────────────────────────────────────────────────

interface InstanceRowProps {
  instance: WorkflowInstance;
  template: WorkflowTemplate | undefined;
  onOpen: () => void;
}

function InstanceRow({ instance, template, onOpen }: InstanceRowProps) {
  const cfg = INSTANCE_STATUS_CONFIG[instance.instanceStatus];
  const currentStep = template?.steps.find((s) => s.id === instance.currentStepId);
  const progress = template
    ? Math.round(((instance.instanceSteps?.filter((s) => s.stepStatus === 'completed').length ?? 0) / Math.max(template.steps.length, 1)) * 100)
    : 0;

  return (
    <div
      onClick={onOpen}
      className="bg-white border border-border rounded-xl p-4 hover:border-indigo-200 hover:shadow-sm transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-600 text-foreground truncate">{instance.referenceLabel ?? instance.referenceId}</p>
          <p className="text-xs text-muted-foreground">{template?.name ?? '—'}</p>
        </div>
        <span className={`shrink-0 px-2.5 py-1 rounded-full text-xs font-600 border ${cfg.bg} ${cfg.color}`}>
          <span className={`inline-block w-1.5 h-1.5 rounded-full mr-1.5 ${cfg.dot}`} />
          {cfg.label}
        </span>
      </div>
      {currentStep && (
        <div className="flex items-center gap-1.5 mb-3">
          <Activity size={11} className="text-blue-500 shrink-0" />
          <span className="text-xs text-muted-foreground">Current: <span className="font-600 text-foreground">{currentStep.name}</span></span>
        </div>
      )}
      {template && template.steps.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Progress</span>
            <span className="text-[10px] font-600 text-foreground">{progress}%</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${instance.instanceStatus === 'completed' ? 'bg-emerald-500' : instance.instanceStatus === 'cancelled' ? 'bg-red-400' : 'bg-indigo-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">Started {formatDate(instance.startedAt)}</span>
        <span className="text-[10px] font-600 text-indigo-600 group-hover:text-indigo-700 flex items-center gap-1">
          View <ChevronRight size={10} />
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowInstancesContent() {
  const { userProfile } = useAuth();
  const [instances, setInstances] = useState<WorkflowInstance[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInstance, setSelectedInstance] = useState<WorkflowInstance | null>(null);
  const [selectedLog, setSelectedLog] = useState<WorkflowTransitionLog[]>([]);
  const [acting, setActing] = useState(false);
  const [filterStatus, setFilterStatus] = useState<WorkflowInstanceStatus | 'all'>('all');
  const [filterTemplate, setFilterTemplate] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [stats, setStats] = useState({ active: 0, completed: 0, escalated: 0, onHold: 0, cancelled: 0 });
  const [newEscalationCount, setNewEscalationCount] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [instanceData, templateData, statsData] = await Promise.all([
        workflowInstanceService.getAll(),
        workflowTemplateService.getAll(),
        workflowInstanceService.getStats(),
      ]);
      // Attach instance steps to each instance
      const enriched = await Promise.all(
        instanceData.map(async (inst) => {
          const full = await workflowInstanceService.getById(inst.id);
          return full ?? inst;
        })
      );
      setInstances(enriched);
      setTemplates(templateData);
      setStats(statsData);
    } catch {
      toast.error('Failed to load workflow instances');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // ─── Realtime escalation subscription ────────────────────────────────────────
  useEscalationRealtime({
    onEscalation: (event) => {
      const label = event.referenceLabel ?? event.referenceType ?? 'Workflow';
      const stepInfo = event.stepName ? ` · Step: ${event.stepName}` : '';
      const workflowInfo = event.workflowName ? ` (${event.workflowName})` : '';
      toast.warning(
        `⚠️ Escalation triggered: ${label}${workflowInfo}${stepInfo}`,
        {
          description: event.performedByName
            ? `Escalated by ${event.performedByName}${event.comment ? ` — "${event.comment}"` : ''}`
            : event.comment ?? 'A workflow step has been escalated',
          duration: 8000,
          action: {
            label: 'View',
            onClick: () => {
              const inst = instances.find((i) => i.id === event.instanceId);
              if (inst) openInstance(inst);
            },
          },
        }
      );
      setNewEscalationCount((c) => c + 1);
      // Refresh list and stats silently
      workflowInstanceService.getStats().then((s) => setStats(s)).catch(() => {});
      workflowInstanceService.getAll().then(async (data) => {
        const enriched = await Promise.all(
          data.map(async (inst) => {
            const full = await workflowInstanceService.getById(inst.id);
            return full ?? inst;
          })
        );
        setInstances(enriched);
      }).catch(() => {});
    },
    onEscalatedCountChange: (count) => {
      setStats((prev) => ({ ...prev, escalated: count }));
    },
  });

  async function openInstance(instance: WorkflowInstance) {
    setSelectedInstance(instance);
    try {
      const log = await workflowInstanceService.getTransitionLog(instance.id);
      setSelectedLog(log);
    } catch {
      setSelectedLog([]);
    }
  }

  const filteredInstances = instances.filter((inst) => {
    if (filterStatus !== 'all' && inst.instanceStatus !== filterStatus) return false;
    if (filterTemplate !== 'all' && inst.templateId !== filterTemplate) return false;
    if (search) {
      const q = search.toLowerCase();
      if (!(inst.referenceLabel ?? '').toLowerCase().includes(q) &&
          !inst.referenceId.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const selectedTemplate = selectedInstance
    ? templates.find((t) => t.id === selectedInstance.templateId) ?? null
    : null;

  async function handleAction(action: 'approve' | 'reject' | 'return' | 'skip' | 'escalate' | 'cancel' | 'hold', comment: string) {
    if (!selectedInstance || !userProfile) return;
    setActing(true);
    try {
      await workflowInstanceService.transition({
        instanceId: selectedInstance.id,
        action,
        performedBy: userProfile.id,
        performedByName: userProfile.full_name ?? userProfile.email ?? 'User',
        performedByRole: userProfile.role ?? 'user',
        comment: comment || undefined,
      });
      toast.success(`Action recorded: ${action}`);

      // Send escalation email notifications for notify_manager / notify_and_hold actions
      if (action === 'escalate' && selectedTemplate) {
        const currentStep = selectedTemplate.steps.find((s) => s.id === selectedInstance.currentStepId);
        if (currentStep && (currentStep.escalationAction === 'notify_manager' || currentStep.escalationAction === 'notify_and_hold')) {
          sendEscalationEmails({
            escalationAction: currentStep.escalationAction,
            workflowName: selectedTemplate.name,
            stepName: currentStep.name,
            referenceLabel: selectedInstance.referenceLabel,
            referenceType: selectedInstance.referenceType,
            instanceId: selectedInstance.id,
            triggeredBy: userProfile.full_name ?? userProfile.email ?? 'User',
            slaHours: currentStep.slaHours,
            comment: comment || undefined,
            notifyRoles: currentStep.escalationNotifyRoles?.length
              ? currentStep.escalationNotifyRoles
              : ['credit_manager'],
          }).catch((err) => console.error('[escalation email]', err));
        }
      }

      // Refresh instance
      const updated = await workflowInstanceService.getById(selectedInstance.id);
      if (updated) {
        setSelectedInstance(updated);
        setInstances((prev) => prev.map((i) => i.id === updated.id ? updated : i));
      }
      const log = await workflowInstanceService.getTransitionLog(selectedInstance.id);
      setSelectedLog(log);
      const statsData = await workflowInstanceService.getStats();
      setStats(statsData);
    } catch {
      toast.error('Failed to record action');
    } finally {
      setActing(false);
    }
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Activity size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-800 text-foreground">Workflow Instances</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Live view of all running, completed, and escalated workflow instances
          </p>
        </div>
        <button
          onClick={() => load()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} /> Refresh
        </button>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {[
          { label: 'Active', value: stats.active, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-100', dot: 'bg-blue-500' },
          { label: 'Completed', value: stats.completed, color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-100', dot: 'bg-emerald-500' },
          { label: 'Escalated', value: stats.escalated, color: 'text-orange-700', bg: 'bg-orange-50 border-orange-100', dot: 'bg-orange-500', badge: newEscalationCount },
          { label: 'On Hold', value: stats.onHold, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-100', dot: 'bg-amber-500' },
          { label: 'Cancelled', value: stats.cancelled, color: 'text-red-700', bg: 'bg-red-50 border-red-100', dot: 'bg-red-500' },
        ].map((s) => (
          <div
            key={s.label}
            className={`relative flex items-center gap-3 p-3 rounded-xl border ${s.bg}`}
            onClick={s.label === 'Escalated' && newEscalationCount > 0 ? () => { setFilterStatus('escalated'); setNewEscalationCount(0); } : undefined}
            style={s.label === 'Escalated' && newEscalationCount > 0 ? { cursor: 'pointer' } : undefined}
          >
            <div className={`w-2 h-2 rounded-full ${s.dot} shrink-0`} />
            <div>
              <p className={`text-lg font-800 ${s.color}`}>{s.value}</p>
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
            </div>
            {'badge' in s && (s as any).badge > 0 && (
              <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-orange-500 text-white text-[10px] font-700 rounded-full flex items-center justify-center shadow-sm animate-pulse">
                {(s as any).badge > 9 ? '9+' : (s as any).badge}
              </span>
            )}
          </div>
        ))}
      </div>

      {/* Workflow Efficiency KPIs */}
      <WorkflowEfficiencyKPIs instances={instances} templates={templates} />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <div className="relative flex-1 min-w-48">
          <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search instances..."
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as WorkflowInstanceStatus | 'all')}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="all">All Statuses</option>
          {Object.entries(INSTANCE_STATUS_CONFIG).map(([v, c]) => (
            <option key={v} value={v}>{c.label}</option>
          ))}
        </select>
        <select
          value={filterTemplate}
          onChange={(e) => setFilterTemplate(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
        >
          <option value="all">All Templates</option>
          {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
        </select>
      </div>

      {/* Instances Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : filteredInstances.length === 0 ? (
        <div className="text-center py-20">
          <Activity size={32} className="text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-sm text-muted-foreground">No workflow instances found</p>
          <p className="text-xs text-muted-foreground mt-1">Instances are created when a workflow is started from a collateral record</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredInstances.map((instance) => (
            <InstanceRow
              key={instance.id}
              instance={instance}
              template={templates.find((t) => t.id === instance.templateId)}
              onOpen={() => openInstance(instance)}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {selectedInstance && (
        <InstanceDetail
          instance={selectedInstance}
          template={selectedTemplate}
          log={selectedLog}
          onAction={handleAction}
          onClose={() => setSelectedInstance(null)}
          acting={acting}
        />
      )}
    </div>
  );
}
