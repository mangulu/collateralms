'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, Loader2, RefreshCw, Clock, Bell, UserCheck, ChevronDown, ChevronUp, Settings2 } from 'lucide-react';
import { workflowTemplateService, type WorkflowTemplate } from '@/lib/supabase/workflowEngineService';
import { workflowInstanceService, type WorkflowInstance } from '@/lib/supabase/workflowEngineService';

const ESCALATION_ACTION_LABELS: Record<string, string> = {
  notify_manager: 'Notify Manager',
  reassign: 'Reassign to Manager',
  auto_approve: 'Auto-Approve',
  auto_reject: 'Auto-Reject',
  escalate_to_role: 'Escalate to Role',
  hold_payment: 'Hold Payment',
  notify_and_hold: 'Notify & Hold Payment',
};

const ESCALATION_ACTION_COLORS: Record<string, string> = {
  notify_manager: 'bg-blue-100 text-blue-700',
  reassign: 'bg-indigo-100 text-indigo-700',
  auto_approve: 'bg-emerald-100 text-emerald-700',
  auto_reject: 'bg-red-100 text-red-700',
  escalate_to_role: 'bg-orange-100 text-orange-700',
  hold_payment: 'bg-amber-100 text-amber-700',
  notify_and_hold: 'bg-rose-100 text-rose-700',
};

export default function EscalationConfigContent() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [escalatedInstances, setEscalatedInstances] = useState<WorkflowInstance[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTemplate, setExpandedTemplate] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    await Promise.allSettled([
      workflowTemplateService.getAll().then(setTemplates).catch(() => setTemplates([])),
      workflowInstanceService.getAll().then((instances) => {
        setEscalatedInstances(instances.filter((i) => i.status === 'escalated'));
      }).catch(() => setEscalatedInstances([])),
    ]);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const templatesWithEscalation = templates.filter((t) =>
    t.steps?.some((s) => s.escalation_action)
  );

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <AlertTriangle size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Escalation Configuration</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Review SLA thresholds and escalation actions configured across all workflow templates
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

      {/* Currently Escalated */}
      {escalatedInstances.length > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-xl">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle size={16} className="text-orange-600" />
            <h2 className="text-sm font-semibold text-orange-800">{escalatedInstances.length} Currently Escalated Instance{escalatedInstances.length !== 1 ? 's' : ''}</h2>
          </div>
          <div className="space-y-2">
            {escalatedInstances.slice(0, 5).map((inst) => (
              <div key={inst.id} className="flex items-center gap-3 text-xs bg-white rounded-lg px-3 py-2 border border-orange-100">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" />
                <span className="font-medium text-foreground truncate">{inst.collateral_id}</span>
                <span className="text-muted-foreground ml-auto shrink-0">
                  {inst.started_at ? new Date(inst.started_at).toLocaleDateString('en-GB') : '—'}
                </span>
              </div>
            ))}
            {escalatedInstances.length > 5 && (
              <p className="text-xs text-orange-700 text-center">+{escalatedInstances.length - 5} more — view in Active Instances</p>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : templatesWithEscalation.length === 0 ? (
        <div className="text-center py-16 bg-white border border-border rounded-2xl">
          <Settings2 size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground mb-1">No escalation rules configured</p>
          <p className="text-xs text-muted-foreground">Add escalation actions to workflow template steps to see them here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {templatesWithEscalation.map((template) => {
            const isExpanded = expandedTemplate === template.id;
            const stepsWithEscalation = template.steps?.filter((s) => s.escalation_action) ?? [];
            return (
              <div key={template.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <button
                  onClick={() => setExpandedTemplate(isExpanded ? null : template.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
                    <AlertTriangle size={15} className="text-orange-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{template.name}</p>
                    <p className="text-xs text-muted-foreground">{stepsWithEscalation.length} step{stepsWithEscalation.length !== 1 ? 's' : ''} with escalation rules</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${template.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                      {template.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {isExpanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-border">
                    <div className="divide-y divide-border">
                      {stepsWithEscalation.map((step, idx) => (
                        <div key={idx} className="px-4 py-3 bg-slate-50">
                          <div className="flex items-start gap-3">
                            <div className="w-6 h-6 rounded-full bg-orange-100 flex items-center justify-center shrink-0 mt-0.5">
                              <span className="text-xs font-bold text-orange-600">{step.order}</span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-foreground">{step.name}</p>
                              <div className="flex flex-wrap items-center gap-3 mt-2 text-xs">
                                {step.escalation_hours && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <Clock size={11} />
                                    SLA: <strong className="text-foreground">{step.escalation_hours}h</strong>
                                  </div>
                                )}
                                {step.escalation_action && (
                                  <div className="flex items-center gap-1">
                                    <Bell size={11} className="text-orange-500" />
                                    <span className={`px-2 py-0.5 rounded-full font-medium ${ESCALATION_ACTION_COLORS[step.escalation_action] ?? 'bg-slate-100 text-slate-700'}`}>
                                      {ESCALATION_ACTION_LABELS[step.escalation_action] ?? step.escalation_action}
                                    </span>
                                  </div>
                                )}
                                {step.escalation_role && (
                                  <div className="flex items-center gap-1 text-muted-foreground">
                                    <UserCheck size={11} />
                                    Escalate to: <strong className="text-foreground">{step.escalation_role.replace(/_/g, ' ')}</strong>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <p className="text-xs text-muted-foreground mt-4">
        To modify escalation rules, edit the step configuration in Workflow Templates.
      </p>
    </div>
  );
}
