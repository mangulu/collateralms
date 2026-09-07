'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { GitBranch, TrendingUp, Unlock, Scale, RefreshCw, AlertTriangle, CheckCircle2, XCircle, Loader2, ChevronRight, Activity, Zap, Search, ArrowUpRight, AlertCircle } from 'lucide-react';
import { perfectionService, PerfectionRequest } from '@/lib/supabase/perfectionService';
import { listValuations, CollateralValuation } from '@/lib/supabase/valuationService';
import { releaseRequestService, ReleaseRequest } from '@/lib/supabase/releaseRequestService';
import { listCovenants, LoanCovenant } from '@/lib/supabase/covenantService';

// ─── Types ────────────────────────────────────────────────────────────────────

type WorkflowType = 'all' | 'perfection' | 'valuation' | 'release' | 'covenant';
type SLAStatus = 'ok' | 'warning' | 'critical' | 'overdue';

interface NormalizedWorkflow {
  id: string;
  type: WorkflowType;
  title: string;
  collateralRef: string;
  obligor: string;
  status: string;
  priority: string;
  createdAt: string;
  deadline: string | null;
  href: string;
  slaStatus: SLAStatus;
  daysRemaining: number | null;
  stageIndex: number;
  totalStages: number;
  stages: string[];
  currentStage: string;
  bottleneck: boolean;
  bottleneckReason?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysRemaining(deadline: string | null): number | null {
  if (!deadline) return null;
  const diff = new Date(deadline).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function getSLAStatus(days: number | null): SLAStatus {
  if (days === null) return 'ok';
  if (days < 0) return 'overdue';
  if (days <= 2) return 'critical';
  if (days <= 7) return 'warning';
  return 'ok';
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const PERFECTION_STAGES = ['Draft', 'Submitted', 'Under Review', 'Approved', 'Perfected'];
const VALUATION_STAGES = ['Scheduled', 'In Progress', 'Completed', 'Approved'];
const RELEASE_STAGES = ['Pending', 'Under Review', 'Approved'];
const COVENANT_STAGES = ['Active', 'Under Review', 'Resolved'];

function getStageIndex(stages: string[], status: string): number {
  const idx = stages.indexOf(status);
  return idx >= 0 ? idx : 0;
}

function normalizePerfection(r: PerfectionRequest): NormalizedWorkflow {
  const days = getDaysRemaining(r.perfectionDeadline);
  const sla = getSLAStatus(days);
  const stageIdx = getStageIndex(PERFECTION_STAGES, r.requestStatus);
  const bottleneck = r.requestStatus === 'Under Review' && (days !== null && days < 5);
  return {
    id: r.id,
    type: 'perfection',
    title: `Perfection — ${r.collateralType}`,
    collateralRef: r.collateralId,
    obligor: r.obligor,
    status: r.requestStatus,
    priority: r.priority,
    createdAt: r.createdAt,
    deadline: r.perfectionDeadline || null,
    href: '/approval-inbox',
    slaStatus: sla,
    daysRemaining: days,
    stageIndex: stageIdx,
    totalStages: PERFECTION_STAGES.length,
    stages: PERFECTION_STAGES,
    currentStage: r.requestStatus,
    bottleneck,
    bottleneckReason: bottleneck ? 'Stalled in Under Review with deadline approaching' : undefined,
  };
}

function normalizeValuation(v: CollateralValuation): NormalizedWorkflow {
  const days = getDaysRemaining(v.scheduledDate);
  const sla = v.valuationStatus === 'Overdue' ? 'overdue' : getSLAStatus(days);
  const stageIdx = getStageIndex(VALUATION_STAGES, v.valuationStatus);
  const bottleneck = v.valuationStatus === 'In Progress' && (days !== null && days < 3);
  return {
    id: v.id,
    type: 'valuation',
    title: `Valuation — ${v.valuationType}`,
    collateralRef: v.collateralId,
    obligor: v.collateralDescription ?? '—',
    status: v.valuationStatus,
    priority: v.valuationStatus === 'Overdue' ? 'High' : 'Normal',
    createdAt: v.createdAt,
    deadline: v.scheduledDate,
    href: '/valuation-workflow',
    slaStatus: sla,
    daysRemaining: days,
    stageIndex: stageIdx,
    totalStages: VALUATION_STAGES.length,
    stages: VALUATION_STAGES,
    currentStage: v.valuationStatus,
    bottleneck,
    bottleneckReason: bottleneck ? 'Valuation in progress past scheduled date' : undefined,
  };
}

function normalizeRelease(r: ReleaseRequest): NormalizedWorkflow {
  const days = getDaysRemaining(r.requestedDate);
  const sla = getSLAStatus(days);
  const stageIdx = getStageIndex(RELEASE_STAGES, r.status);
  const bottleneck = r.status === 'Under Review' && r.priority === 'High';
  return {
    id: r.id,
    type: 'release',
    title: `Release — ${r.collateralType}`,
    collateralRef: r.collateralRef,
    obligor: r.clientName,
    status: r.status,
    priority: r.priority,
    createdAt: r.createdAt,
    deadline: r.requestedDate,
    href: '/release-approval',
    slaStatus: sla,
    daysRemaining: days,
    stageIndex: stageIdx,
    totalStages: RELEASE_STAGES.length,
    stages: RELEASE_STAGES,
    currentStage: r.status,
    bottleneck,
    bottleneckReason: bottleneck ? 'High-priority release stalled in review' : undefined,
  };
}

function normalizeCovenant(c: LoanCovenant): NormalizedWorkflow {
  const days = getDaysRemaining(c.nextReviewDate ?? null);
  const sla = c.covenantStatus === 'Breached' ? 'overdue' : getSLAStatus(days);
  const stageIdx = getStageIndex(COVENANT_STAGES, c.covenantStatus === 'Active' ? 'Active' : c.covenantStatus === 'Breached' ? 'Under Review' : 'Resolved');
  const bottleneck = c.covenantStatus === 'Breached';
  return {
    id: c.id,
    type: 'covenant',
    title: `Covenant — ${c.covenantName}`,
    collateralRef: c.loanNumber ?? c.loanId,
    obligor: c.obligorName ?? '—',
    status: c.covenantStatus,
    priority: c.covenantStatus === 'Breached' ? 'High' : 'Normal',
    createdAt: c.createdAt,
    deadline: c.nextReviewDate ?? null,
    href: '/covenant-tracking',
    slaStatus: sla,
    daysRemaining: days,
    stageIndex: stageIdx,
    totalStages: COVENANT_STAGES.length,
    stages: COVENANT_STAGES,
    currentStage: c.covenantStatus,
    bottleneck,
    bottleneckReason: bottleneck ? 'Covenant breach requires immediate action' : undefined,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ReactNode; dot: string }> = {
  perfection: {
    label: 'Perfection',
    color: 'text-violet-700',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    dot: 'bg-violet-500',
    icon: <GitBranch size={14} className="text-violet-600" />,
  },
  valuation: {
    label: 'Valuation',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-500',
    icon: <TrendingUp size={14} className="text-amber-600" />,
  },
  release: {
    label: 'Release',
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    icon: <Unlock size={14} className="text-rose-600" />,
  },
  covenant: {
    label: 'Covenant',
    color: 'text-teal-700',
    bg: 'bg-teal-50',
    border: 'border-teal-200',
    dot: 'bg-teal-500',
    icon: <Scale size={14} className="text-teal-600" />,
  },
};

const SLA_CONFIG: Record<SLAStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  ok: { label: 'On Track', color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200', icon: <CheckCircle2 size={12} className="text-emerald-600" /> },
  warning: { label: 'Warning', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <AlertCircle size={12} className="text-amber-600" /> },
  critical: { label: 'Critical', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: <AlertTriangle size={12} className="text-orange-600" /> },
  overdue: { label: 'Overdue', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <XCircle size={12} className="text-red-600" /> },
};

function SLACountdown({ days, slaStatus }: { days: number | null; slaStatus: SLAStatus }) {
  const cfg = SLA_CONFIG[slaStatus];
  if (days === null) return <span className="text-xs text-muted-foreground">No deadline</span>;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      {cfg.icon}
      {days < 0 ? `${Math.abs(days)}d overdue` : days === 0 ? 'Due today' : `${days}d left`}
    </span>
  );
}

function StageTimeline({ stages, currentIndex, slaStatus }: { stages: string[]; currentIndex: number; slaStatus: SLAStatus }) {
  const progressPct = stages.length > 1 ? (currentIndex / (stages.length - 1)) * 100 : 100;
  const barColor = slaStatus === 'overdue' ? 'bg-red-500' : slaStatus === 'critical' ? 'bg-orange-500' : slaStatus === 'warning' ? 'bg-amber-500' : 'bg-emerald-500';

  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-1">
        {stages.map((stage, i) => (
          <div key={stage} className="flex flex-col items-center" style={{ flex: 1 }}>
            <div className={`w-2.5 h-2.5 rounded-full border-2 z-10 ${i < currentIndex ? 'bg-slate-400 border-slate-400' : i === currentIndex ? `${barColor} border-transparent` : 'bg-white border-slate-300'}`} />
          </div>
        ))}
      </div>
      <div className="relative h-1 rounded-full bg-slate-100 -mt-1.5 mx-1.5">
        <div className={`absolute left-0 top-0 h-full rounded-full transition-all ${barColor}`} style={{ width: `${progressPct}%` }} />
      </div>
      <div className="flex items-center justify-between mt-1">
        <span className="text-[10px] text-muted-foreground truncate">{stages[0]}</span>
        <span className="text-[10px] text-muted-foreground truncate">{stages[stages.length - 1]}</span>
      </div>
    </div>
  );
}

function WorkflowRow({ wf }: { wf: NormalizedWorkflow }) {
  const typeCfg = TYPE_CONFIG[wf.type];
  const slaCfg = SLA_CONFIG[wf.slaStatus];

  return (
    <div className={`group relative bg-white rounded-xl border ${wf.bottleneck ? 'border-orange-300 shadow-sm shadow-orange-100' : 'border-slate-200'} p-4 hover:shadow-md transition-all duration-200`}>
      {/* Bottleneck indicator */}
      {wf.bottleneck && (
        <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl bg-orange-400" />
      )}

      <div className="flex items-start gap-3 pl-1">
        {/* Type badge */}
        <div className={`mt-0.5 w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${typeCfg.bg} border ${typeCfg.border}`}>
          {typeCfg.icon}
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${typeCfg.bg} ${typeCfg.color}`}>
                  {typeCfg.label}
                </span>
                <span className="text-sm font-semibold text-foreground truncate">{wf.title}</span>
                {wf.bottleneck && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 border border-orange-200">
                    <Zap size={9} /> Bottleneck
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground flex-wrap">
                <span className="font-mono">{wf.collateralRef}</span>
                <span>·</span>
                <span>{wf.obligor}</span>
                <span>·</span>
                <span>Created {formatDate(wf.createdAt)}</span>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <SLACountdown days={wf.daysRemaining} slaStatus={wf.slaStatus} />
              <Link
                href={wf.href}
                className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View <ArrowUpRight size={11} />
              </Link>
            </div>
          </div>

          {/* Stage timeline */}
          <div className="mt-3">
            <StageTimeline stages={wf.stages} currentIndex={wf.stageIndex} slaStatus={wf.slaStatus} />
          </div>

          {/* Bottleneck reason */}
          {wf.bottleneck && wf.bottleneckReason && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-orange-700 bg-orange-50 border border-orange-200 rounded-lg px-2.5 py-1.5">
              <AlertTriangle size={11} className="shrink-0" />
              {wf.bottleneckReason}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function KPICard({ label, value, sub, icon, color, loading }: { label: string; value: number | null; sub?: string; icon: React.ReactNode; color: string; loading: boolean }) {
  return (
    <div className={`bg-white rounded-xl border border-slate-200 p-4 flex items-start gap-3`}>
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-medium">{label}</p>
        {loading ? (
          <Loader2 size={16} className="animate-spin text-muted-foreground mt-1" />
        ) : (
          <p className="text-2xl font-bold text-foreground leading-tight">{value ?? '—'}</p>
        )}
        {sub && <p className="text-[11px] text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function WorkflowCommandCenterContent() {
  const [workflows, setWorkflows] = useState<NormalizedWorkflow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeType, setActiveType] = useState<WorkflowType>('all');
  const [activeSLA, setActiveSLA] = useState<SLAStatus | 'all'>('all');
  const [search, setSearch] = useState('');
  const [showBottlenecksOnly, setShowBottlenecksOnly] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    const results = await Promise.allSettled([
      perfectionService.getAll(),
      listValuations(),
      releaseRequestService.getAll(),
      listCovenants(),
    ]);

    const normalized: NormalizedWorkflow[] = [];

    // Perfection — active statuses only
    if (results[0].status === 'fulfilled') {
      const active = (results[0].value as PerfectionRequest[]).filter(
        (r) => !['Perfected', 'Rejected'].includes(r.requestStatus)
      );
      normalized.push(...active.map(normalizePerfection));
    }

    // Valuation — active statuses only
    if (results[1].status === 'fulfilled') {
      const active = (results[1].value as CollateralValuation[]).filter(
        (v) => !['Completed', 'Approved', 'Rejected'].includes(v.valuationStatus)
      );
      normalized.push(...active.map(normalizeValuation));
    }

    // Release — active statuses only
    if (results[2].status === 'fulfilled') {
      const active = (results[2].value as ReleaseRequest[]).filter(
        (r) => !['Approved', 'Rejected'].includes(r.status)
      );
      normalized.push(...active.map(normalizeRelease));
    }

    // Covenant — active/breached only
    if (results[3].status === 'fulfilled') {
      const active = (results[3].value as LoanCovenant[]).filter(
        (c) => c.covenantStatus === 'Active' || c.covenantStatus === 'Breached'
      );
      normalized.push(...active.map(normalizeCovenant));
    }

    // Sort: overdue first, then critical, then warning, then ok
    const order: Record<SLAStatus, number> = { overdue: 0, critical: 1, warning: 2, ok: 3 };
    normalized.sort((a, b) => order[a.slaStatus] - order[b.slaStatus]);

    setWorkflows(normalized);
    setLastRefreshed(new Date());
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Derived stats
  const total = workflows.length;
  const overdueCount = workflows.filter((w) => w.slaStatus === 'overdue').length;
  const criticalCount = workflows.filter((w) => w.slaStatus === 'critical').length;
  const bottleneckCount = workflows.filter((w) => w.bottleneck).length;
  const byType: Record<string, number> = { perfection: 0, valuation: 0, release: 0, covenant: 0 };
  workflows.forEach((w) => { byType[w.type] = (byType[w.type] ?? 0) + 1; });

  // Filtered list
  const filtered = workflows.filter((w) => {
    if (activeType !== 'all' && w.type !== activeType) return false;
    if (activeSLA !== 'all' && w.slaStatus !== activeSLA) return false;
    if (showBottlenecksOnly && !w.bottleneck) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !w.title.toLowerCase().includes(q) &&
        !w.collateralRef.toLowerCase().includes(q) &&
        !w.obligor.toLowerCase().includes(q) &&
        !w.status.toLowerCase().includes(q)
      ) return false;
    }
    return true;
  });

  const typeFilters: { key: WorkflowType; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'perfection', label: 'Perfection' },
    { key: 'valuation', label: 'Valuation' },
    { key: 'release', label: 'Release' },
    { key: 'covenant', label: 'Covenant' },
  ];

  const slaFilters: { key: SLAStatus | 'all'; label: string }[] = [
    { key: 'all', label: 'All SLA' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'critical', label: 'Critical' },
    { key: 'warning', label: 'Warning' },
    { key: 'ok', label: 'On Track' },
  ];

  return (
    <div className="flex flex-col gap-6 p-6 max-w-7xl mx-auto w-full">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Workflow Command Center</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Centralized view of all active perfection, valuation, release, and covenant workflows
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
          </span>
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <KPICard
          label="Total Active"
          value={total}
          sub="across all workflow types"
          icon={<Activity size={18} className="text-slate-600" />}
          color="bg-slate-100"
          loading={loading}
        />
        <KPICard
          label="Overdue"
          value={overdueCount}
          sub="past SLA deadline"
          icon={<XCircle size={18} className="text-red-600" />}
          color="bg-red-50"
          loading={loading}
        />
        <KPICard
          label="Critical (≤2d)"
          value={criticalCount}
          sub="deadline within 2 days"
          icon={<AlertTriangle size={18} className="text-orange-600" />}
          color="bg-orange-50"
          loading={loading}
        />
        <KPICard
          label="Bottlenecks"
          value={bottleneckCount}
          sub="stalled workflows detected"
          icon={<Zap size={18} className="text-amber-600" />}
          color="bg-amber-50"
          loading={loading}
        />
      </div>

      {/* Type breakdown bar */}
      {!loading && total > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Portfolio Breakdown</span>
            <span className="text-xs text-muted-foreground">{total} active workflows</span>
          </div>
          <div className="flex gap-3 flex-wrap">
            {Object.entries(byType).map(([type, count]) => {
              const cfg = TYPE_CONFIG[type];
              if (!cfg || count === 0) return null;
              const pct = Math.round((count / total) * 100);
              return (
                <button
                  key={type}
                  onClick={() => setActiveType(activeType === type as WorkflowType ? 'all' : type as WorkflowType)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-all text-xs font-medium ${activeType === type ? `${cfg.bg} ${cfg.border} ${cfg.color}` : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                  {cfg.label}
                  <span className="font-bold">{count}</span>
                  <span className="opacity-60">({pct}%)</span>
                </button>
              );
            })}
          </div>
          {/* Stacked bar */}
          <div className="mt-3 flex h-2 rounded-full overflow-hidden gap-0.5">
            {Object.entries(byType).map(([type, count]) => {
              const cfg = TYPE_CONFIG[type];
              if (!cfg || count === 0) return null;
              const pct = (count / total) * 100;
              const barColors: Record<string, string> = {
                perfection: 'bg-violet-400',
                valuation: 'bg-amber-400',
                release: 'bg-rose-400',
                covenant: 'bg-teal-400',
              };
              return <div key={type} className={`${barColors[type]} rounded-sm`} style={{ width: `${pct}%` }} />;
            })}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search collateral, obligor…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
        </div>

        {/* Type filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {typeFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveType(f.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeType === f.key ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {f.label}
              {f.key !== 'all' && byType[f.key] > 0 && (
                <span className={`ml-1 ${activeType === f.key ? 'opacity-80' : 'opacity-60'}`}>({byType[f.key]})</span>
              )}
            </button>
          ))}
        </div>

        {/* SLA filter */}
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-1">
          {slaFilters.map((f) => (
            <button
              key={f.key}
              onClick={() => setActiveSLA(f.key)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${activeSLA === f.key ? 'bg-primary text-white' : 'text-slate-600 hover:bg-slate-100'}`}
            >
              {f.label}
            </button>
          ))}
        </div>

        {/* Bottleneck toggle */}
        <button
          onClick={() => setShowBottlenecksOnly(!showBottlenecksOnly)}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${showBottlenecksOnly ? 'bg-orange-100 border-orange-300 text-orange-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
        >
          <Zap size={12} />
          Bottlenecks only
          {bottleneckCount > 0 && (
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${showBottlenecksOnly ? 'bg-orange-200 text-orange-800' : 'bg-orange-100 text-orange-700'}`}>
              {bottleneckCount}
            </span>
          )}
        </button>
      </div>

      {/* Workflow list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 size={28} className="animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading active workflows…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white rounded-xl border border-slate-200">
          <CheckCircle2 size={36} className="text-emerald-400" />
          <p className="text-base font-semibold text-foreground">No workflows match your filters</p>
          <p className="text-sm text-muted-foreground">
            {total === 0 ? 'All workflows are completed or no active workflows found.' : 'Try adjusting your filters to see more results.'}
          </p>
          {total > 0 && (
            <button
              onClick={() => { setActiveType('all'); setActiveSLA('all'); setSearch(''); setShowBottlenecksOnly(false); }}
              className="text-xs text-primary hover:underline"
            >
              Clear all filters
            </button>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground font-medium">
              {filtered.length} workflow{filtered.length !== 1 ? 's' : ''} shown
              {filtered.length !== total && ` (of ${total} total)`}
            </span>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Overdue</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-orange-500 inline-block" /> Critical</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500 inline-block" /> Warning</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> On Track</span>
            </div>
          </div>
          {filtered.map((wf) => (
            <WorkflowRow key={`${wf.type}-${wf.id}`} wf={wf} />
          ))}
        </div>
      )}

      {/* Quick links footer */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
        {[
          { label: 'Perfection Queue', href: '/approval-inbox', icon: <GitBranch size={14} />, color: 'text-violet-600' },
          { label: 'Valuation Workflow', href: '/valuation-workflow', icon: <TrendingUp size={14} />, color: 'text-amber-600' },
          { label: 'Release Approvals', href: '/release-approval', icon: <Unlock size={14} />, color: 'text-rose-600' },
          { label: 'Covenant Tracking', href: '/covenant-tracking', icon: <Scale size={14} />, color: 'text-teal-600' },
        ].map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center justify-between gap-2 px-4 py-3 bg-white rounded-xl border border-slate-200 hover:shadow-sm hover:border-slate-300 transition-all group"
          >
            <div className={`flex items-center gap-2 text-sm font-medium ${link.color}`}>
              {link.icon}
              {link.label}
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
          </Link>
        ))}
      </div>
    </div>
  );
}
