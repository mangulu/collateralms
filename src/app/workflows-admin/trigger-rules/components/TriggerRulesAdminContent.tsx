'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, ToggleLeft, ToggleRight, Loader2, Zap, RefreshCw, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { workflowTriggerRulesService, type WorkflowTriggerRule } from '@/lib/supabase/workflowTriggerRulesService';
import { workflowTemplateService, type WorkflowTemplate } from '@/lib/supabase/workflowEngineService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

const TRIGGER_TYPE_LABELS: Record<string, string> = {
  collateral_status_change: 'Collateral Status Change',
  days_since_submission: 'Days Since Submission',
  value_threshold: 'Value Threshold',
  ltv_breach: 'LTV Breach',
  days_overdue: 'Days Overdue',
  document_count_change: 'Document Count Change',
};

const TRIGGER_TYPE_COLORS: Record<string, string> = {
  collateral_status_change: 'bg-blue-100 text-blue-700 border-blue-200',
  days_since_submission: 'bg-amber-100 text-amber-700 border-amber-200',
  value_threshold: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  ltv_breach: 'bg-red-100 text-red-700 border-red-200',
  days_overdue: 'bg-orange-100 text-orange-700 border-orange-200',
  document_count_change: 'bg-violet-100 text-violet-700 border-violet-200',
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function TriggerRulesAdminContent() {
  const { user } = useAuth();
  const [rules, setRules] = useState<WorkflowTriggerRule[]>([]);
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRule, setExpandedRule] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

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
      await workflowTriggerRulesService.update(rule.id, { is_active: !rule.is_active }, user.id);
      setRules((prev) => prev.map((r) => r.id === rule.id ? { ...r, is_active: !r.is_active } : r));
      toast.success(`Rule ${!rule.is_active ? 'activated' : 'deactivated'}`);
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

  const getTemplateName = (id: string | null) => {
    if (!id) return '—';
    return templates.find((t) => t.id === id)?.name ?? id;
  };

  const activeCount = rules.filter((r) => r.is_active).length;

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

      {/* Rules list */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-16 bg-white border border-border rounded-2xl">
          <Zap size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm font-medium text-foreground mb-1">No trigger rules configured</p>
          <p className="text-xs text-muted-foreground">Trigger rules can be created from the Workflow Templates page using the Trigger Rules Builder.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const isExpanded = expandedRule === rule.id;
            const typeColor = TRIGGER_TYPE_COLORS[rule.trigger_type] ?? 'bg-slate-100 text-slate-700 border-slate-200';
            return (
              <div key={rule.id} className="bg-white border border-border rounded-xl overflow-hidden">
                <div className="flex items-center gap-3 px-4 py-3">
                  {/* Toggle */}
                  <button
                    onClick={() => handleToggle(rule)}
                    disabled={toggling === rule.id}
                    className="shrink-0"
                    title={rule.is_active ? 'Deactivate rule' : 'Activate rule'}
                  >
                    {toggling === rule.id ? (
                      <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    ) : rule.is_active ? (
                      <ToggleRight size={22} className="text-emerald-500" />
                    ) : (
                      <ToggleLeft size={22} className="text-slate-400" />
                    )}
                  </button>

                  {/* Name & type */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold text-foreground truncate">{rule.name}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${typeColor}`}>
                        {TRIGGER_TYPE_LABELS[rule.trigger_type] ?? rule.trigger_type}
                      </span>
                      {!rule.is_active && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Inactive</span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      Template: {getTemplateName(rule.workflow_template_id)} · Created {fmtDate(rule.created_at)}
                    </p>
                  </div>

                  {/* Actions */}
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

                {/* Expanded details */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground mb-1 font-medium uppercase tracking-wide text-[10px]">Conditions</p>
                        {rule.conditions && Array.isArray(rule.conditions) && rule.conditions.length > 0 ? (
                          <ul className="space-y-1">
                            {(rule.conditions as Array<{ field?: string; operator?: string; value?: unknown }>).map((c, i) => (
                              <li key={i} className="flex items-center gap-1.5 text-foreground">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                                <span>{c.field} {c.operator} <strong>{String(c.value)}</strong></span>
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
                          <p>Logic: <strong>{rule.condition_logic?.toUpperCase() ?? 'AND'}</strong></p>
                          <p>Priority: <strong>{rule.priority ?? 'Normal'}</strong></p>
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

      <p className="text-xs text-muted-foreground mt-4">
        To create new trigger rules, open a Workflow Template and use the Trigger Rules Builder.
      </p>
    </div>
  );
}
