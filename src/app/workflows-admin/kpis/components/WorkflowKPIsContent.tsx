'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { BarChart3, Loader2, RefreshCw, Clock, AlertTriangle, Users, GitBranch, CheckCircle2, Activity, TrendingUp, Gauge, Timer } from 'lucide-react';
import { workflowInstanceService, workflowTemplateService, type WorkflowInstance, type WorkflowTemplate } from '@/lib/supabase/workflowEngineService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

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

interface StepDurationRow {
  stepName: string;
  templateName: string;
  avgDays: number;
  count: number;
}

interface BottleneckByRole {
  role: string;
  activeSteps: number;
  pendingSteps: number;
  total: number;
}

interface ThroughputPoint {
  week: string;
  started: number;
  completed: number;
  escalated: number;
}

interface SLAByTemplate {
  name: string;
  compliant: number;
  breached: number;
  rate: number;
}

interface AnalyticsData {
  avgCycleTimeDays: number | null;
  overallSLARate: number | null;
  totalCompleted: number;
  totalActive: number;
  totalInstances: number;
  escalatedInstances: number;
  stepDurations: StepDurationRow[];
  bottleneckByRole: BottleneckByRole[];
  throughputTrend: ThroughputPoint[];
  slaByTemplate: SLAByTemplate[];
  completionByTemplate: { name: string; completed: number; active: number; escalated: number }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekLabel(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - d.getDay());
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

// workflowInstanceService doesn't populate instanceStep.step, so step display
// names are looked up from the owning template's step definitions instead.
function buildStepNameMap(templates: WorkflowTemplate[]): Record<string, string> {
  const map: Record<string, string> = {};
  templates.forEach((t) => {
    t.steps.forEach((s) => { map[s.id] = s.name; });
  });
  return map;
}

function computeKPIs(instances: WorkflowInstance[], templates: WorkflowTemplate[]): KPIData {
  const stepNameById = buildStepNameMap(templates);
  const total = instances.length;
  const active = instances.filter((i) => i.instanceStatus === 'active').length;
  const completed = instances.filter((i) => i.instanceStatus === 'completed').length;
  const escalated = instances.filter((i) => i.instanceStatus === 'escalated').length;

  const completedWithDates = instances.filter(
    (i) => i.instanceStatus === 'completed' && i.startedAt && i.completedAt
  );
  const avgCycleTimeDays = completedWithDates.length > 0
    ? completedWithDates.reduce((sum, i) => {
        const start = new Date(i.startedAt!).getTime();
        const end = new Date(i.completedAt!).getTime();
        return sum + (end - start) / (1000 * 60 * 60 * 24);
      }, 0) / completedWithDates.length
    : null;

  const slaComplianceRate = completed > 0
    ? Math.round(((completed - escalated) / completed) * 100)
    : null;

  const roleMap: Record<string, number> = {};
  instances.forEach((inst) => {
    inst.instanceSteps?.forEach((step) => {
      if (step.stepStatus === 'active' || step.stepStatus === 'pending') {
        const role = step.assignedRole ?? 'unassigned';
        roleMap[role] = (roleMap[role] ?? 0) + 1;
      }
    });
  });
  const pendingByRole = Object.entries(roleMap)
    .map(([role, count]) => ({ role: role.replace(/_/g, ' '), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  const stepMap: Record<string, { count: number; templateName: string }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.templateId);
    inst.instanceSteps?.forEach((step) => {
      if (step.stepStatus === 'active') {
        const key = stepNameById[step.stepId] ?? 'Unknown Step';
        if (!stepMap[key]) stepMap[key] = { count: 0, templateName: template?.name ?? '—' };
        stepMap[key].count++;
      }
    });
  });
  const bottleneckSteps = Object.entries(stepMap)
    .map(([stepName, v]) => ({ stepName, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  const templateMap: Record<string, { name: string; completed: number; active: number; escalated: number }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.templateId);
    const name = template?.name ?? 'Unknown';
    if (!templateMap[name]) templateMap[name] = { name, completed: 0, active: 0, escalated: 0 };
    if (inst.instanceStatus === 'completed') templateMap[name].completed++;
    else if (inst.instanceStatus === 'active') templateMap[name].active++;
    else if (inst.instanceStatus === 'escalated') templateMap[name].escalated++;
  });
  const completionByTemplate = Object.values(templateMap)
    .sort((a, b) => (b.completed + b.active) - (a.completed + a.active))
    .slice(0, 6);

  return { totalInstances: total, activeInstances: active, completedInstances: completed, escalatedInstances: escalated, avgCycleTimeDays, slaComplianceRate, pendingByRole, bottleneckSteps, completionByTemplate };
}

function computeAnalytics(instances: WorkflowInstance[], templates: WorkflowTemplate[]): AnalyticsData {
  const stepNameById = buildStepNameMap(templates);
  const completed = instances.filter((i) => i.instanceStatus === 'completed');
  const active = instances.filter((i) => i.instanceStatus === 'active');
  const escalated = instances.filter((i) => i.instanceStatus === 'escalated');

  const withDates = completed.filter((i) => i.startedAt && i.completedAt);
  const avgCycleTimeDays = withDates.length > 0
    ? withDates.reduce((sum, i) => {
        const ms = new Date(i.completedAt!).getTime() - new Date(i.startedAt!).getTime();
        return sum + ms / 86400000;
      }, 0) / withDates.length
    : null;

  const overallSLARate = completed.length > 0
    ? Math.round(((completed.length - escalated.length) / completed.length) * 100)
    : null;

  const stepDurationMap: Record<string, { totalDays: number; count: number; templateName: string }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.templateId);
    inst.instanceSteps?.forEach((step) => {
      if (step.startedAt && step.completedAt) {
        const days = (new Date(step.completedAt).getTime() - new Date(step.startedAt).getTime()) / 86400000;
        const key = stepNameById[step.stepId] ?? 'Unknown Step';
        if (!stepDurationMap[key]) stepDurationMap[key] = { totalDays: 0, count: 0, templateName: template?.name ?? '—' };
        stepDurationMap[key].totalDays += days;
        stepDurationMap[key].count++;
      }
    });
  });
  const stepDurations: StepDurationRow[] = Object.entries(stepDurationMap)
    .map(([stepName, v]) => ({ stepName, templateName: v.templateName, avgDays: v.totalDays / v.count, count: v.count }))
    .sort((a, b) => b.avgDays - a.avgDays)
    .slice(0, 8);

  const roleMap: Record<string, { active: number; pending: number }> = {};
  instances.forEach((inst) => {
    inst.instanceSteps?.forEach((step) => {
      const role = step.assignedRole ?? 'unassigned';
      if (!roleMap[role]) roleMap[role] = { active: 0, pending: 0 };
      if (step.stepStatus === 'active') roleMap[role].active++;
      else if (step.stepStatus === 'pending') roleMap[role].pending++;
    });
  });
  const bottleneckByRole: BottleneckByRole[] = Object.entries(roleMap)
    .map(([role, v]) => ({ role: role.replace(/_/g, ' '), activeSteps: v.active, pendingSteps: v.pending, total: v.active + v.pending }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  const weekMap: Record<string, { started: number; completed: number; escalated: number }> = {};
  instances.forEach((inst) => {
    if (inst.startedAt) {
      const wk = getWeekLabel(new Date(inst.startedAt));
      if (!weekMap[wk]) weekMap[wk] = { started: 0, completed: 0, escalated: 0 };
      weekMap[wk].started++;
    }
    if (inst.completedAt) {
      const wk = getWeekLabel(new Date(inst.completedAt));
      if (!weekMap[wk]) weekMap[wk] = { started: 0, completed: 0, escalated: 0 };
      weekMap[wk].completed++;
    }
  });
  escalated.forEach((inst) => {
    if (inst.startedAt) {
      const wk = getWeekLabel(new Date(inst.startedAt));
      if (!weekMap[wk]) weekMap[wk] = { started: 0, completed: 0, escalated: 0 };
      weekMap[wk].escalated++;
    }
  });
  const throughputTrend: ThroughputPoint[] = Object.entries(weekMap)
    .map(([week, v]) => ({ week, ...v }))
    .sort((a, b) => a.week.localeCompare(b.week))
    .slice(-8);

  const slaTemplateMap: Record<string, { compliant: number; breached: number }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.templateId);
    const name = template?.name ?? 'Unknown';
    if (!slaTemplateMap[name]) slaTemplateMap[name] = { compliant: 0, breached: 0 };
    if (inst.instanceStatus === 'completed') slaTemplateMap[name].compliant++;
    else if (inst.instanceStatus === 'escalated') slaTemplateMap[name].breached++;
  });
  const slaByTemplate: SLAByTemplate[] = Object.entries(slaTemplateMap)
    .map(([name, v]) => {
      const total = v.compliant + v.breached;
      return { name, compliant: v.compliant, breached: v.breached, rate: total > 0 ? Math.round((v.compliant / total) * 100) : 0 };
    })
    .sort((a, b) => b.rate - a.rate);

  const completionTemplateMap: Record<string, { name: string; completed: number; active: number; escalated: number }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.templateId);
    const name = template?.name ?? 'Unknown';
    if (!completionTemplateMap[name]) completionTemplateMap[name] = { name, completed: 0, active: 0, escalated: 0 };
    if (inst.instanceStatus === 'completed') completionTemplateMap[name].completed++;
    else if (inst.instanceStatus === 'active') completionTemplateMap[name].active++;
    else if (inst.instanceStatus === 'escalated') completionTemplateMap[name].escalated++;
  });
  const completionByTemplate = Object.values(completionTemplateMap)
    .sort((a, b) => (b.completed + b.active) - (a.completed + a.active))
    .slice(0, 6);

  return {
    avgCycleTimeDays,
    overallSLARate,
    totalCompleted: completed.length,
    totalActive: active.length,
    totalInstances: instances.length,
    escalatedInstances: escalated.length,
    stepDurations,
    bottleneckByRole,
    throughputTrend,
    slaByTemplate,
    completionByTemplate,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

type Tab = 'kpis' | 'analytics';

export default function WorkflowKPIsContent() {
  const [activeTab, setActiveTab] = useState<Tab>('kpis');
  const [kpis, setKpis] = useState<KPIData | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
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
      setAnalytics(computeAnalytics(instances, templates));
    } catch {
      setKpis(null);
      setAnalytics(null);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const tabs: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: 'kpis', label: 'Efficiency KPIs', icon: <BarChart3 size={14} /> },
    { id: 'analytics', label: 'Process Analytics', icon: <TrendingUp size={14} /> },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--izou-success)' }}>
              <BarChart3 size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--izou-primary)' }}>Analytics & KPIs</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Workflow performance metrics, cycle times, SLA compliance, and process analytics
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

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-muted rounded-xl mb-6 w-fit">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-white text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 size={24} className="animate-spin text-muted-foreground" />
        </div>
      ) : activeTab === 'kpis' ? (
        <KPIsTab kpis={kpis} />
      ) : (
        <AnalyticsTab analytics={analytics} />
      )}
    </div>
  );
}

// ─── KPIs Tab ─────────────────────────────────────────────────────────────────

function KPIsTab({ kpis }: { kpis: KPIData | null }) {
  if (!kpis) {
    return (
      <div className="text-center py-16 bg-white border border-border rounded-2xl">
        <BarChart3 size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Unable to load KPI data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Instances', value: kpis.totalInstances, icon: <Activity size={16} style={{ color: 'var(--izou-secondary)' }} />, color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)' },
          { label: 'Avg Cycle Time', value: kpis.avgCycleTimeDays !== null ? `${kpis.avgCycleTimeDays.toFixed(1)}d` : '—', icon: <Clock size={16} style={{ color: 'var(--izou-warning)' }} />, color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)' },
          { label: 'SLA Compliance', value: kpis.slaComplianceRate !== null ? `${kpis.slaComplianceRate}%` : '—', icon: <CheckCircle2 size={16} style={{ color: 'var(--izou-success)' }} />, color: 'var(--izou-success)', bg: 'var(--izou-success-light)' },
          { label: 'Escalated', value: kpis.escalatedInstances, icon: <AlertTriangle size={16} style={{ color: 'var(--izou-danger)' }} />, color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-border rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <div className="flex items-center gap-2 mb-2">
              {kpi.icon}
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Pending by Role */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} style={{ color: 'var(--izou-secondary)' }} />
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
                <Bar dataKey="count" fill="var(--izou-secondary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Bottleneck Steps */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle size={16} style={{ color: 'var(--izou-danger)' }} />
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
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (step.count / (kpis.bottleneckSteps[0]?.count || 1)) * 100)}%`, backgroundColor: 'var(--izou-danger)' }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-6 text-right" style={{ color: 'var(--izou-danger)' }}>{step.count}</span>
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
          <GitBranch size={16} style={{ color: 'var(--izou-highlight)' }} />
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
              <Bar dataKey="completed" name="Completed" fill="var(--izou-success)" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="active" name="Active" fill="var(--izou-secondary)" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="escalated" name="Escalated" fill="var(--izou-warning)" radius={[0, 0, 4, 4]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

// ─── Analytics Tab ────────────────────────────────────────────────────────────

function AnalyticsTab({ analytics }: { analytics: AnalyticsData | null }) {
  if (!analytics) {
    return (
      <div className="text-center py-16 bg-white border border-border rounded-2xl">
        <TrendingUp size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
        <p className="text-sm text-muted-foreground">Unable to load analytics data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Instances', value: analytics.totalInstances, icon: <Activity size={16} style={{ color: 'var(--izou-secondary)' }} />, color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)' },
          { label: 'Avg Cycle Time', value: analytics.avgCycleTimeDays !== null ? `${analytics.avgCycleTimeDays.toFixed(1)}d` : '—', icon: <Clock size={16} style={{ color: 'var(--izou-warning)' }} />, color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)' },
          { label: 'SLA Compliance', value: analytics.overallSLARate !== null ? `${analytics.overallSLARate}%` : '—', icon: <CheckCircle2 size={16} style={{ color: 'var(--izou-success)' }} />, color: 'var(--izou-success)', bg: 'var(--izou-success-light)' },
          { label: 'Escalated', value: analytics.escalatedInstances, icon: <AlertTriangle size={16} style={{ color: 'var(--izou-danger)' }} />, color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
        ].map((kpi) => (
          <div key={kpi.label} className="border border-border rounded-xl p-4" style={{ backgroundColor: kpi.bg }}>
            <div className="flex items-center gap-2 mb-2">
              {kpi.icon}
              <span className="text-xs text-muted-foreground">{kpi.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
          </div>
        ))}
      </div>

      {/* Throughput Trend */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp size={16} style={{ color: 'var(--izou-secondary)' }} />
          <h2 className="text-sm font-semibold text-foreground">Weekly Throughput Trend</h2>
        </div>
        {analytics.throughputTrend.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No throughput data available</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={analytics.throughputTrend} margin={{ left: 0, right: 16, top: 4 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="week" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Area type="monotone" dataKey="started" name="Started" stroke="var(--izou-secondary)" fill="var(--izou-secondary-light)" strokeWidth={2} />
              <Area type="monotone" dataKey="completed" name="Completed" stroke="var(--izou-success)" fill="var(--izou-success-light)" strokeWidth={2} />
              <Area type="monotone" dataKey="escalated" name="Escalated" stroke="var(--izou-warning)" fill="var(--izou-warning-light)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Step Durations + Bottleneck by Role */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Step Durations */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Timer size={16} style={{ color: 'var(--izou-highlight)' }} />
            <h2 className="text-sm font-semibold text-foreground">Avg Step Duration (days)</h2>
          </div>
          {analytics.stepDurations.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No step duration data available</p>
          ) : (
            <div className="space-y-2">
              {analytics.stepDurations.map((step, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{step.stepName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{step.templateName} · {step.count} samples</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.min(100, (step.avgDays / (analytics.stepDurations[0]?.avgDays || 1)) * 100)}%`, backgroundColor: 'var(--izou-highlight)' }}
                      />
                    </div>
                    <span className="text-xs font-semibold w-10 text-right" style={{ color: 'var(--izou-highlight)' }}>{step.avgDays.toFixed(1)}d</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottleneck by Role */}
        <div className="bg-white border border-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={16} style={{ color: 'var(--izou-warning)' }} />
            <h2 className="text-sm font-semibold text-foreground">Workload by Role</h2>
          </div>
          {analytics.bottleneckByRole.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-8">No role workload data</p>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={analytics.bottleneckByRole} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="role" tick={{ fontSize: 11 }} width={110} />
                <Tooltip />
                <Bar dataKey="activeSteps" name="Active" fill="var(--izou-warning)" stackId="a" radius={[0, 0, 0, 0]} />
                <Bar dataKey="pendingSteps" name="Pending" fill="var(--izou-warning-light)" stackId="a" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* SLA by Template */}
      <div className="bg-white border border-border rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Gauge size={16} style={{ color: 'var(--izou-success)' }} />
          <h2 className="text-sm font-semibold text-foreground">SLA Compliance by Template</h2>
        </div>
        {analytics.slaByTemplate.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-8">No SLA data available</p>
        ) : (
          <div className="space-y-3">
            {analytics.slaByTemplate.map((row, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-36 min-w-0 shrink-0">
                  <p className="text-xs font-medium text-foreground truncate">{row.name}</p>
                  <p className="text-[10px] text-muted-foreground">{row.compliant} compliant · {row.breached} breached</p>
                </div>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${row.rate}%`, backgroundColor: row.rate >= 80 ? 'var(--izou-success)' : row.rate >= 60 ? 'var(--izou-warning)' : 'var(--izou-danger)' }}
                  />
                </div>
                <span
                  className="text-xs font-semibold w-10 text-right shrink-0"
                  style={{ color: row.rate >= 80 ? 'var(--izou-success)' : row.rate >= 60 ? 'var(--izou-warning)' : 'var(--izou-danger)' }}
                >
                  {row.rate}%
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
