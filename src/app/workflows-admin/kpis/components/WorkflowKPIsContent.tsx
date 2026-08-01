'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, RefreshCw, Clock, AlertTriangle, Users, GitBranch, CheckCircle2, Activity } from 'lucide-react';
import { workflowInstanceService, workflowTemplateService, type WorkflowInstance, type WorkflowTemplate } from '@/lib/supabase/workflowEngineService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface KPIData {
  totalInstances: number;
  activeInstances: number;
  completedInstances: number;
  escalatedInstances: number;
  avgCycleTimeDays: number | null;
  slaComplianceRate: number | null;
  pendingByRole: { role: string; count: number }[];
  bottleneckSteps: { stepName: string; count: number; templateName: string }[];
  completionByTemplate: { name: string; completed: number; active: number; escalated: number }[];
}

function computeKPIs(instances: WorkflowInstance[], templates: WorkflowTemplate[]): KPIData {
  const total = instances.length;
  const active = instances.filter((i) => i.status === 'active').length;
  const completed = instances.filter((i) => i.status === 'completed').length;
  const escalated = instances.filter((i) => i.status === 'escalated').length;

  // Avg cycle time for completed instances
  const completedWithDates = instances.filter(
    (i) => i.status === 'completed' && i.started_at && i.completed_at
  );
  const avgCycleTimeDays = completedWithDates.length > 0
    ? completedWithDates.reduce((sum, i) => {
        const start = new Date(i.started_at!).getTime();
        const end = new Date(i.completed_at!).getTime();
        return sum + (end - start) / (1000 * 60 * 60 * 24);
      }, 0) / completedWithDates.length
    : null;

  // SLA compliance (instances completed without escalation)
  const slaComplianceRate = completed > 0
    ? Math.round(((completed - escalated) / completed) * 100)
    : null;

  // Pending by role
  const roleMap: Record<string, number> = {};
  instances.forEach((inst) => {
    inst.steps?.forEach((step) => {
      if (step.status === 'active' || step.status === 'pending') {
        const role = step.assigned_role ?? 'unassigned';
        roleMap[role] = (roleMap[role] ?? 0) + 1;
      }
    });
  });
  const pendingByRole = Object.entries(roleMap)
    .map(([role, count]) => ({ role: role.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // Bottleneck steps (active steps that appear most)
  const stepMap: Record<string, { count: number; templateName: string }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.workflow_template_id);
    inst.steps?.forEach((step) => {
      if (step.status === 'active') {
        const key = step.step_name ?? 'Unknown Step';
        if (!stepMap[key]) stepMap[key] = { count: 0, templateName: template?.name ?? '—' };
        stepMap[key].count++;
      }
    });
  });
  const bottleneckSteps = Object.entries(stepMap)
    .map(([stepName, v]) => ({ stepName, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Completion by template
  const templateMap: Record<string, { name: string; completed: number; active: number; escalated: number }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.workflow_template_id);
    const name = template?.name ?? 'Unknown';
    if (!templateMap[name]) templateMap[name] = { name, completed: 0, active: 0, escalated: 0 };
    if (inst.status === 'completed') templateMap[name].completed++;
    else if (inst.status === 'active') templateMap[name].active++;
    else if (inst.status === 'escalated') templateMap[name].escalated++;
  });
  const completionByTemplate = Object.values(templateMap).sort((a, b) => (b.completed + b.active) - (a.completed + a.active)).slice(0, 6);

  return { totalInstances: total, activeInstances: active, completedInstances: completed, escalatedInstances: escalated, avgCycleTimeDays, slaComplianceRate, pendingByRole, bottleneckSteps, completionByTemplate };
}

export default function WorkflowKPIsContent() {
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [instances, templates] = await Promise.all([
        workflowInstanceService.getAll(),
        workflowTemplateService.getAll(),
      ]);
      setKpis(computeKPIs(instances, templates));
    } catch {
      setKpis(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <BarChart3 size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Workflow Efficiency KPIs</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cycle times, SLA compliance, bottleneck analysis, and role workload metrics
          </p>
        </div>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : !kpis ? (
        <div className="text-center py-16 bg-white border border-border rounded-2xl">
          <BarChart3 size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Unable to load KPI data</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Top KPI cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Total Instances', value: kpis.totalInstances, icon: <Activity size={16} className="text-blue-500" />, color: 'text-blue-700', bg: 'bg-blue-50' },
              { label: 'Avg Cycle Time', value: kpis.avgCycleTimeDays !== null ? `${kpis.avgCycleTimeDays.toFixed(1)}d` : '—', icon: <Clock size={16} className="text-amber-500" />, color: 'text-amber-700', bg: 'bg-amber-50' },
              { label: 'SLA Compliance', value: kpis.slaComplianceRate !== null ? `${kpis.slaComplianceRate}%` : '—', icon: <CheckCircle2 size={16} className="text-emerald-500" />, color: 'text-emerald-700', bg: 'bg-emerald-50' },
              { label: 'Escalated', value: kpis.escalatedInstances, icon: <AlertTriangle size={16} className="text-orange-500" />, color: 'text-orange-700', bg: 'bg-orange-50' },
            ].map((kpi) => (
              <div key={kpi.label} className={`${kpi.bg} border border-border rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-2">
                  {kpi.icon}
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
              </div>
            ))}
          </div>

          {/* Charts row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Pending by Role */}
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-blue-500" />
                <h2 className="text-sm font-semibold text-foreground">Pending Steps by Role</h2>
              </div>
              {kpis.pendingByRole.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No pending steps</p>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={kpis.pendingByRole} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="role" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3B82F6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottleneck Steps */}
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <AlertTriangle size={16} className="text-orange-500" />
                <h2 className="text-sm font-semibold text-foreground">Bottleneck Steps (Active)</h2>
              </div>
              {kpis.bottleneckSteps.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No active bottlenecks</p>
              ) : (
                <div className="space-y-2">
                  {kpis.bottleneckSteps.map((step, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{step.stepName}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{step.templateName}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-orange-400 rounded-full"
                            style={{ width: `${Math.min(100, (step.count / (kpis.bottleneckSteps[0]?.count || 1)) * 100)}%` }}
                          />
                        </div>
                        <span className="text-xs font-semibold text-orange-700 w-6 text-right">{step.count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Completion by Template */}
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch size={16} className="text-violet-500" />
              <h2 className="text-sm font-semibold text-foreground">Instance Status by Template</h2>
            </div>
            {kpis.completionByTemplate.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No instance data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={kpis.completionByTemplate} margin={{ left: 0, right: 16, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="active" name="Active" fill="#3B82F6" radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="escalated" name="Escalated" fill="#F97316" radius={[0, 0, 4, 4]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
