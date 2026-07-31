'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  TrendingUp, Loader2, RefreshCw, Clock, CheckCircle2, AlertTriangle,
  Users, BarChart3, Activity, Gauge, Timer, Layers, GitBranch
} from 'lucide-react';
import {
  workflowInstanceService,
  workflowTemplateService,
  type WorkflowInstance,
  type WorkflowTemplate,
} from '@/lib/supabase/workflowEngineService';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, Legend, Cell } from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

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

function computeAnalytics(instances: WorkflowInstance[], templates: WorkflowTemplate[]): AnalyticsData {
  const completed = instances.filter((i) => i.status === 'completed');
  const active = instances.filter((i) => i.status === 'active');
  const escalated = instances.filter((i) => i.status === 'escalated');

  // Avg cycle time
  const withDates = completed.filter((i) => i.started_at && i.completed_at);
  const avgCycleTimeDays = withDates.length > 0
    ? withDates.reduce((sum, i) => {
        const ms = new Date(i.completed_at!).getTime() - new Date(i.started_at!).getTime();
        return sum + ms / 86400000;
      }, 0) / withDates.length
    : null;

  // Overall SLA rate (completed without escalation)
  const overallSLARate = completed.length > 0
    ? Math.round(((completed.length - escalated.length) / completed.length) * 100)
    : null;

  // Step durations — estimate from step history if available
  const stepDurationMap: Record<string, { totalDays: number; count: number; templateName: string }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.workflow_template_id);
    inst.steps?.forEach((step) => {
      if (step.started_at && step.completed_at) {
        const days = (new Date(step.completed_at).getTime() - new Date(step.started_at).getTime()) / 86400000;
        const key = step.step_name ?? 'Unknown Step';
        if (!stepDurationMap[key]) stepDurationMap[key] = { totalDays: 0, count: 0, templateName: template?.name ?? '—' };
        stepDurationMap[key].totalDays += days;
        stepDurationMap[key].count++;
      }
    });
  });
  const stepDurations: StepDurationRow[] = Object.entries(stepDurationMap)
    .map(([stepName, v]) => ({ stepName, templateName: v.templateName, avgDays: parseFloat((v.totalDays / v.count).toFixed(2)), count: v.count }))
    .sort((a, b) => b.avgDays - a.avgDays)
    .slice(0, 8);

  // Bottleneck by role
  const roleMap: Record<string, { active: number; pending: number }> = {};
  instances.forEach((inst) => {
    inst.steps?.forEach((step) => {
      const role = (step.assigned_role ?? 'unassigned').replace(/_/g, ' ');
      if (!roleMap[role]) roleMap[role] = { active: 0, pending: 0 };
      if (step.status === 'active') roleMap[role].active++;
      else if (step.status === 'pending') roleMap[role].pending++;
    });
  });
  const bottleneckByRole: BottleneckByRole[] = Object.entries(roleMap)
    .map(([role, v]) => ({ role, activeSteps: v.active, pendingSteps: v.pending, total: v.active + v.pending }))
    .filter((r) => r.total > 0)
    .sort((a, b) => b.total - a.total)
    .slice(0, 8);

  // Throughput trend — last 8 weeks
  const now = Date.now();
  const weekMs = 7 * 86400000;
  const weekBuckets: Record<string, { started: number; completed: number; escalated: number }> = {};
  for (let w = 7; w >= 0; w--) {
    const d = new Date(now - w * weekMs);
    const label = getWeekLabel(d);
    if (!weekBuckets[label]) weekBuckets[label] = { started: 0, completed: 0, escalated: 0 };
  }
  instances.forEach((inst) => {
    if (inst.started_at) {
      const label = getWeekLabel(new Date(inst.started_at));
      if (weekBuckets[label]) weekBuckets[label].started++;
    }
    if (inst.completed_at) {
      const label = getWeekLabel(new Date(inst.completed_at));
      if (weekBuckets[label]) weekBuckets[label].completed++;
    }
    if (inst.status === 'escalated' && inst.started_at) {
      const label = getWeekLabel(new Date(inst.started_at));
      if (weekBuckets[label]) weekBuckets[label].escalated++;
    }
  });
  const throughputTrend: ThroughputPoint[] = Object.entries(weekBuckets).map(([week, v]) => ({ week, ...v }));

  // SLA by template
  const tplMap: Record<string, { name: string; compliant: number; breached: number }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.workflow_template_id);
    const name = template?.name ?? 'Unknown';
    if (!tplMap[name]) tplMap[name] = { name, compliant: 0, breached: 0 };
    if (inst.status === 'completed') tplMap[name].compliant++;
    else if (inst.status === 'escalated') tplMap[name].breached++;
  });
  const slaByTemplate: SLAByTemplate[] = Object.values(tplMap)
    .map((t) => {
      const total = t.compliant + t.breached;
      return { ...t, rate: total > 0 ? Math.round((t.compliant / total) * 100) : 0 };
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 6);

  // Completion by template (merged from KPIs)
  const templateMap: Record<string, { name: string; completed: number; active: number; escalated: number }> = {};
  instances.forEach((inst) => {
    const template = templates.find((t) => t.id === inst.workflow_template_id);
    const name = template?.name ?? 'Unknown';
    if (!templateMap[name]) templateMap[name] = { name, completed: 0, active: 0, escalated: 0 };
    if (inst.status === 'completed') templateMap[name].completed++;
    else if (inst.status === 'active') templateMap[name].active++;
    else if (inst.status === 'escalated') templateMap[name].escalated++;
  });
  const completionByTemplate = Object.values(templateMap)
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

// ─── SLA Gauge ────────────────────────────────────────────────────────────────

function SLAGauge({ rate }: { rate: number }) {
  const color = rate >= 90 ? '#10b981' : rate >= 70 ? '#f59e0b' : '#ef4444';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (rate / 100) * circumference;
  return (
    <div className="flex flex-col items-center justify-center gap-1">
      <svg width="100" height="100" viewBox="0 0 100 100">
        <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
        <circle
          cx="50" cy="50" r="40" fill="none"
          stroke={color} strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform="rotate(-90 50 50)"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }}
        />
        <text x="50" y="54" textAnchor="middle" fontSize="18" fontWeight="700" fill={color}>{rate}%</text>
      </svg>
      <span className="text-xs text-muted-foreground font-medium">SLA Compliance</span>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const ROLE_COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe', '#f5f3ff', '#faf5ff'];

export default function ProcessAnalyticsContent() {
  const [data, setData] = useState<AnalyticsData | null>(null);
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
      setData(computeAnalytics(instances, templates));
    } catch {
      setData(null);
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
            <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center">
              <TrendingUp size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Process Analytics & KPIs</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Cycle times, SLA compliance, bottleneck analysis, role workload, and throughput trends
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
      ) : !data ? (
        <div className="text-center py-16 bg-white border border-border rounded-2xl">
          <TrendingUp size={36} className="mx-auto mb-3 text-muted-foreground opacity-40" />
          <p className="text-sm text-muted-foreground">Unable to load analytics data</p>
        </div>
      ) : (
        <div className="space-y-6">

          {/* ── Summary KPI Row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              {
                label: 'Total Instances',
                value: data.totalInstances,
                sub: 'all time',
                icon: <Activity size={16} className="text-blue-500" />,
                bg: 'bg-blue-50',
                color: 'text-blue-700',
              },
              {
                label: 'Avg Cycle Time',
                value: data.avgCycleTimeDays !== null ? `${data.avgCycleTimeDays.toFixed(1)}d` : '—',
                sub: 'per completed instance',
                icon: <Clock size={16} className="text-amber-500" />,
                bg: 'bg-amber-50',
                color: 'text-amber-700',
              },
              {
                label: 'SLA Compliance',
                value: data.overallSLARate !== null ? `${data.overallSLARate}%` : '—',
                sub: 'completed without escalation',
                icon: <CheckCircle2 size={16} className="text-emerald-500" />,
                bg: 'bg-emerald-50',
                color: 'text-emerald-700',
              },
              {
                label: 'Escalated',
                value: data.escalatedInstances,
                sub: 'currently escalated',
                icon: <AlertTriangle size={16} className="text-orange-500" />,
                bg: 'bg-orange-50',
                color: 'text-orange-700',
              },
            ].map((kpi) => (
              <div key={kpi.label} className={`${kpi.bg} border border-border rounded-xl p-4`}>
                <div className="flex items-center gap-2 mb-1.5">
                  {kpi.icon}
                  <span className="text-xs text-muted-foreground">{kpi.label}</span>
                </div>
                <p className={`text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{kpi.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Row 2: SLA Gauge + SLA by Template ──────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* SLA Gauge */}
            <div className="bg-white border border-border rounded-xl p-5 flex flex-col items-center justify-center gap-4">
              <div className="flex items-center gap-2 self-start">
                <Gauge size={16} className="text-violet-500" />
                <h2 className="text-sm font-semibold text-foreground">Overall SLA Rate</h2>
              </div>
              {data.overallSLARate !== null ? (
                <SLAGauge rate={data.overallSLARate} />
              ) : (
                <p className="text-xs text-muted-foreground py-8">No completed instances yet</p>
              )}
              <div className="w-full grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Target', value: '95%', color: 'text-emerald-600' },
                  { label: 'Current', value: data.overallSLARate !== null ? `${data.overallSLARate}%` : '—', color: data.overallSLARate !== null && data.overallSLARate >= 90 ? 'text-emerald-600' : 'text-red-500' },
                  { label: 'Gap', value: data.overallSLARate !== null ? `${Math.max(0, 95 - data.overallSLARate)}%` : '—', color: 'text-muted-foreground' },
                ].map((s) => (
                  <div key={s.label} className="bg-muted/40 rounded-lg py-2">
                    <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* SLA by Template */}
            <div className="lg:col-span-2 bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Layers size={16} className="text-violet-500" />
                <h2 className="text-sm font-semibold text-foreground">SLA Compliance by Template</h2>
              </div>
              {data.slaByTemplate.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data available</p>
              ) : (
                <div className="space-y-3">
                  {data.slaByTemplate.map((t) => (
                    <div key={t.name} className="flex items-center gap-3">
                      <div className="w-36 shrink-0">
                        <p className="text-xs font-medium text-foreground truncate">{t.name}</p>
                        <p className="text-[10px] text-muted-foreground">{t.compliant + t.breached} instances</p>
                      </div>
                      <div className="flex-1 h-2.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-700"
                          style={{
                            width: `${t.rate}%`,
                            backgroundColor: t.rate >= 90 ? '#10b981' : t.rate >= 70 ? '#f59e0b' : '#ef4444',
                          }}
                        />
                      </div>
                      <span className={`text-xs font-semibold w-10 text-right shrink-0 ${t.rate >= 90 ? 'text-emerald-600' : t.rate >= 70 ? 'text-amber-600' : 'text-red-500'}`}>
                        {t.rate}%
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* ── Row 3: Step Duration + Bottleneck by Role ────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Step Duration */}
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Timer size={16} className="text-amber-500" />
                <h2 className="text-sm font-semibold text-foreground">Avg Step Duration (days)</h2>
              </div>
              {data.stepDurations.length === 0 ? (
                <div className="text-center py-8">
                  <Timer size={28} className="mx-auto mb-2 text-muted-foreground opacity-30" />
                  <p className="text-xs text-muted-foreground">Step timing data not yet available</p>
                  <p className="text-[11px] text-muted-foreground mt-1 opacity-70">Requires steps with started_at and completed_at timestamps</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.stepDurations} layout="vertical" margin={{ left: 8, right: 24 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} unit="d" />
                    <YAxis type="category" dataKey="stepName" tick={{ fontSize: 11 }} width={120} />
                    <Tooltip formatter={(v: number) => [`${v}d`, 'Avg Duration']} />
                    <Bar dataKey="avgDays" radius={[0, 4, 4, 0]}>
                      {data.stepDurations.map((_, i) => (
                        <Cell key={i} fill={i === 0 ? '#f97316' : i === 1 ? '#fb923c' : '#fdba74'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Bottleneck by Role */}
            <div className="bg-white border border-border rounded-xl p-5">
              <div className="flex items-center gap-2 mb-4">
                <Users size={16} className="text-indigo-500" />
                <h2 className="text-sm font-semibold text-foreground">Bottleneck Analysis by Role</h2>
              </div>
              {data.bottleneckByRole.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No active or pending steps</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.bottleneckByRole} layout="vertical" margin={{ left: 8, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="role" tick={{ fontSize: 11 }} width={110} />
                    <Tooltip />
                    <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="activeSteps" name="Active" stackId="a" fill="#6366f1" radius={[0, 0, 0, 0]} />
                    <Bar dataKey="pendingSteps" name="Pending" stackId="a" fill="#a78bfa" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* ── Row 4: Instance Throughput Trend ─────────────────────────── */}
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart3 size={16} className="text-blue-500" />
              <h2 className="text-sm font-semibold text-foreground">Instance Throughput Trends (Weekly)</h2>
              <span className="ml-auto text-[11px] text-muted-foreground">Last 8 weeks</span>
            </div>
            {data.throughputTrend.every((p) => p.started === 0 && p.completed === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-8">No throughput data in the selected period</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data.throughputTrend} margin={{ left: 0, right: 16, top: 4 }}>
                  <defs>
                    <linearGradient id="gradStarted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                    <linearGradient id="gradEscalated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#f97316" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="started" name="Started" stroke="#3b82f6" fill="url(#gradStarted)" strokeWidth={2} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="completed" name="Completed" stroke="#10b981" fill="url(#gradCompleted)" strokeWidth={2} dot={{ r: 3 }} />
                  <Area type="monotone" dataKey="escalated" name="Escalated" stroke="#f97316" fill="url(#gradEscalated)" strokeWidth={2} dot={{ r: 3 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Row 5: Instance Status by Template (merged from KPIs) ─────── */}
          <div className="bg-white border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <GitBranch size={16} className="text-violet-500" />
              <h2 className="text-sm font-semibold text-foreground">Instance Status by Template</h2>
            </div>
            {data.completionByTemplate.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No instance data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.completionByTemplate} margin={{ left: 0, right: 16, top: 4 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="completed" name="Completed" fill="#10B981" radius={[4, 4, 0, 0]} stackId="a" />
                  <Bar dataKey="active" name="Active" fill="#3B82F6" stackId="a" />
                  <Bar dataKey="escalated" name="Escalated" fill="#F97316" radius={[0, 0, 4, 4]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* ── Row 6: Process Friction Insight ──────────────────────────── */}
          <div className="bg-gradient-to-br from-violet-50 to-indigo-50 border border-violet-100 rounded-xl p-5">
            <div className="flex items-center gap-2 mb-3">
              <AlertTriangle size={16} className="text-violet-600" />
              <h2 className="text-sm font-semibold text-foreground">Process Friction Summary</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Top bottleneck role */}
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Highest Friction Role</p>
                {data.bottleneckByRole[0] ? (
                  <>
                    <p className="text-sm font-semibold text-foreground capitalize">{data.bottleneckByRole[0].role}</p>
                    <p className="text-[11px] text-violet-600 mt-0.5">{data.bottleneckByRole[0].total} steps queued</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>
              {/* Slowest step */}
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Slowest Step</p>
                {data.stepDurations[0] ? (
                  <>
                    <p className="text-sm font-semibold text-foreground truncate">{data.stepDurations[0].stepName}</p>
                    <p className="text-[11px] text-amber-600 mt-0.5">{data.stepDurations[0].avgDays}d avg · {data.stepDurations[0].templateName}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No timing data</p>
                )}
              </div>
              {/* Lowest SLA template */}
              <div className="bg-white/70 rounded-lg p-3">
                <p className="text-[11px] text-muted-foreground mb-1">Lowest SLA Template</p>
                {data.slaByTemplate.length > 0 ? (
                  <>
                    <p className="text-sm font-semibold text-foreground truncate">{data.slaByTemplate[data.slaByTemplate.length - 1].name}</p>
                    <p className={`text-[11px] mt-0.5 ${data.slaByTemplate[data.slaByTemplate.length - 1].rate < 70 ? 'text-red-500' : 'text-amber-600'}`}>
                      {data.slaByTemplate[data.slaByTemplate.length - 1].rate}% compliance
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No data</p>
                )}
              </div>
            </div>
          </div>

        </div>
      )}
    </div>
  );
}
