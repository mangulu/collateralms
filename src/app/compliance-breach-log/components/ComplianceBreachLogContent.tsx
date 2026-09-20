'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Search, RefreshCw, ChevronDown, ChevronUp, Play,
  AlertTriangle, XCircle, Info, Clock, Scale, Shield,
  Filter, X, ExternalLink, User, Calendar, CheckCircle2, Loader2,
} from 'lucide-react';
import Link from 'next/link';
import { complianceBreachService, type ComplianceBreach, type BreachSeverity, type BreachStatus } from '@/lib/supabase/complianceBreachService';
import { complianceEngineService } from '@/lib/supabase/complianceEngineService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Config ───────────────────────────────────────────────────────────────────

type RuleType = 'LTV' | 'DEADLINE' | 'ELIGIBILITY';
type RuleAction = 'BLOCK' | 'WARN' | 'LOG';

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

const SEVERITY_CONFIG: Record<BreachSeverity, { label: string; dot: string; badge: string; row: string }> = {
  Critical: { label: 'Critical', dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700 border border-red-200',    row: 'bg-red-50/30' },
  High:     { label: 'High',     dot: 'bg-orange-500', badge: 'bg-orange-100 text-orange-700 border border-orange-200', row: 'bg-orange-50/20' },
  Medium:   { label: 'Medium',   dot: 'bg-amber-500',  badge: 'bg-amber-100 text-amber-700 border border-amber-200',  row: '' },
  Low:      { label: 'Low',      dot: 'bg-blue-400',   badge: 'bg-blue-100 text-blue-700 border border-blue-200',    row: '' },
};

const ACTION_CONFIG: Record<RuleAction, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  BLOCK: { label: 'Block',  icon: XCircle,       color: 'text-red-700',    bg: 'bg-red-50 border border-red-200' },
  WARN:  { label: 'Warn',   icon: AlertTriangle, color: 'text-amber-700',  bg: 'bg-amber-50 border border-amber-200' },
  LOG:   { label: 'Log',    icon: Info,          color: 'text-blue-700',   bg: 'bg-blue-50 border border-blue-200' },
};

const RULE_TYPE_CONFIG: Record<RuleType, { label: string; icon: React.ElementType; color: string }> = {
  LTV:         { label: 'LTV Limit',   icon: Scale,          color: 'text-blue-600' },
  DEADLINE:    { label: 'Deadline',    icon: Clock,          color: 'text-amber-600' },
  ELIGIBILITY: { label: 'Eligibility', icon: Shield,         color: 'text-purple-600' },
};

// ─── Row Component ────────────────────────────────────────────────────────────

function BreachRow({ entry, expanded, onToggle, onResolve, resolving }: {
  entry: ComplianceBreach;
  expanded: boolean;
  onToggle: () => void;
  onResolve: () => void;
  resolving: boolean;
}) {
  const sev = SEVERITY_CONFIG[entry.severity];
  const act = ACTION_CONFIG[entry.action];
  const rt = RULE_TYPE_CONFIG[entry.ruleType] ?? RULE_TYPE_CONFIG.ELIGIBILITY;
  const ActIcon = act.icon;
  const RtIcon = rt.icon;

  return (
    <>
      <tr
        className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${sev.row}`}
        onClick={onToggle}
      >
        <td className="pl-4 pr-2 py-3 w-8">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${sev.dot}`} />
        </td>
        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="shrink-0" />
            {formatDateTime(entry.breachedAt)}
          </div>
        </td>
        <td className="px-3 py-3">
          <div className="text-sm font-600 text-foreground leading-tight">{entry.collateralId ?? entry.obligorName ?? '—'}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[180px]">{entry.collateralRef ?? (entry.collateralId ? '' : 'Obligor-level')}</div>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <RtIcon size={13} className={`shrink-0 ${rt.color}`} />
            <span className="text-sm font-500 text-foreground">{entry.ruleName}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{rt.label}</div>
        </td>
        <td className="px-3 py-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-600 ${sev.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
            {sev.label}
          </span>
        </td>
        <td className="px-3 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-600 ${act.bg} ${act.color}`}>
            <ActIcon size={11} />
            {act.label}
          </span>
        </td>
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={11} className="text-primary" />
            </div>
            <span className="text-sm text-foreground">{entry.obligorName ?? '—'}</span>
          </div>
        </td>
        <td className="px-3 py-3">
          {entry.status === 'Resolved' ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-green-100 text-green-700 border border-green-200">
              Resolved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-red-100 text-red-700 border border-red-200">
              Open
            </span>
          )}
        </td>
        <td className="px-3 py-3 text-right pr-4">
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </td>
      </tr>

      {expanded && (
        <tr className="bg-muted/20 border-b border-border/50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Breach Details</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trigger Value</span>
                    <span className="font-600 text-foreground">{entry.triggerValue}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Threshold</span>
                    <span className="font-600 text-foreground">{entry.thresholdValue}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Collateral Type</span>
                    <span className="font-600 text-foreground">{entry.collateralType ?? '—'}</span>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Rule Message</p>
                <p className="text-sm text-foreground/80 leading-relaxed">{entry.message || 'No message defined for this rule.'}</p>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Resolution</p>
                <div className="space-y-1">
                  {entry.resolvedAt ? (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Resolved At</span>
                      <span className="font-500 text-green-700 text-xs">{formatDateTime(entry.resolvedAt)}</span>
                    </div>
                  ) : (
                    <button
                      onClick={(e) => { e.stopPropagation(); onResolve(); }}
                      disabled={resolving}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 transition-colors disabled:opacity-50"
                    >
                      {resolving ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                      Mark Resolved
                    </button>
                  )}
                </div>
                {entry.collateralRecordId && (
                  <Link
                    href={`/collateral-detail/${entry.collateralRecordId}`}
                    className="inline-flex items-center gap-1 text-xs font-600 text-primary hover:underline mt-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <ExternalLink size={11} />
                    View Collateral
                  </Link>
                )}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceBreachLogContent() {
  const { user } = useAuth();
  const [allBreaches, setAllBreaches] = useState<ComplianceBreach[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [runSummary, setRunSummary] = useState<string | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<BreachSeverity | 'All'>('All');
  const [filterAction, setFilterAction] = useState<RuleAction | 'All'>('All');
  const [filterRuleType, setFilterRuleType] = useState<RuleType | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | BreachStatus>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const breaches = await complianceBreachService.list();
      setAllBreaches(breaches);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load breach log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleRunEngine = async () => {
    setRunning(true);
    setRunSummary(null);
    setError(null);
    try {
      const result = await complianceEngineService.runFullSweep();
      setRunSummary(
        result.rulesEvaluated === 0
          ? 'No active compliance rules to evaluate.'
          : `Evaluated ${result.rulesEvaluated} active rule${result.rulesEvaluated === 1 ? '' : 's'} — ${result.breachesCreated} new breach${result.breachesCreated === 1 ? '' : 'es'} found.`
      );
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to run compliance engine');
    } finally {
      setRunning(false);
    }
  };

  const handleResolve = async (id: string) => {
    if (!user?.id) return;
    setResolvingId(id);
    try {
      const updated = await complianceBreachService.resolve(id, user.id);
      if (updated) setAllBreaches((prev) => prev.map((b) => (b.id === id ? updated : b)));
    } finally {
      setResolvingId(null);
    }
  };

  const filtered = allBreaches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (
      b.ruleName.toLowerCase().includes(q) ||
      (b.collateralId ?? '').toLowerCase().includes(q) ||
      (b.collateralRef ?? '').toLowerCase().includes(q) ||
      (b.obligorName ?? '').toLowerCase().includes(q) ||
      (b.collateralType ?? '').toLowerCase().includes(q)
    );
    const matchSeverity = filterSeverity === 'All' || b.severity === filterSeverity;
    const matchAction = filterAction === 'All' || b.action === filterAction;
    const matchType = filterRuleType === 'All' || b.ruleType === filterRuleType;
    const matchStatus = filterStatus === 'All' || b.status === filterStatus;
    return matchSearch && matchSeverity && matchAction && matchType && matchStatus;
  });

  const stats = {
    total: allBreaches.length,
    critical: allBreaches.filter((b) => b.severity === 'Critical').length,
    open: allBreaches.filter((b) => b.status === 'Open').length,
    resolved: allBreaches.filter((b) => b.status === 'Resolved').length,
  };

  const hasActiveFilters = filterSeverity !== 'All' || filterAction !== 'All' || filterRuleType !== 'All' || filterStatus !== 'All';

  const clearFilters = () => {
    setFilterSeverity('All');
    setFilterAction('All');
    setFilterRuleType('All');
    setFilterStatus('All');
    setSearch('');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <ShieldAlert size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-700" style={{ color: 'var(--izou-primary)' }}>Compliance Breach Log</h1>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={load}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={handleRunEngine}
              disabled={running}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-600 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
              title="Evaluate all active compliance rules against current data now"
            >
              {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
              Run Engine Now
            </button>
          </div>
        </div>

        {runSummary && (
          <div className="flex items-center gap-2 p-3 mt-4 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-700">
            <Info size={14} />
            {runSummary}
          </div>
        )}

        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Total Breaches', value: stats.total, color: 'text-foreground', bg: 'bg-muted/40' },
            { label: 'Critical', value: stats.critical, color: 'text-red-700', bg: 'bg-red-50' },
            { label: 'Open', value: stats.open, color: 'text-orange-700', bg: 'bg-orange-50' },
            { label: 'Resolved', value: stats.resolved, color: 'text-green-700', bg: 'bg-green-50' },
          ].map((s) => (
            <div key={s.label} className={`${s.bg} rounded-xl px-4 py-3 border border-border/50`}>
              <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider">{s.label}</p>
              <p className={`text-2xl font-700 mt-1 ${s.color}`}>{loading ? '—' : s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-4 bg-white border-b border-border flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rule, collateral, obligor…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        <button
          onClick={() => setShowFilters((v) => !v)}
          className={`flex items-center gap-1.5 px-3 py-2 text-sm font-500 border rounded-lg transition-colors ${showFilters || hasActiveFilters ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:bg-muted'}`}
        >
          <Filter size={14} />
          Filters
          {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-white/80" />}
        </button>

        {hasActiveFilters && (
          <button onClick={clearFilters} className="flex items-center gap-1 text-xs font-500 text-muted-foreground hover:text-foreground transition-colors">
            <X size={12} />
            Clear filters
          </button>
        )}

        <div className="ml-auto text-sm text-muted-foreground">
          {filtered.length} {filtered.length === 1 ? 'breach' : 'breaches'}
        </div>
      </div>

      {showFilters && (
        <div className="px-6 py-4 bg-muted/20 border-b border-border flex flex-wrap gap-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Severity</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['All', 'Critical', 'High', 'Medium', 'Low'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterSeverity(s)}
                  className={`px-2.5 py-1 text-xs font-600 rounded-full border transition-colors ${filterSeverity === s ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:bg-muted'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Action</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['All', 'BLOCK', 'WARN', 'LOG'] as const).map((a) => (
                <button
                  key={a}
                  onClick={() => setFilterAction(a)}
                  className={`px-2.5 py-1 text-xs font-600 rounded-full border transition-colors ${filterAction === a ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:bg-muted'}`}
                >
                  {a === 'All' ? 'All' : ACTION_CONFIG[a].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Rule Type</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['All', 'LTV', 'DEADLINE', 'ELIGIBILITY'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setFilterRuleType(t)}
                  className={`px-2.5 py-1 text-xs font-600 rounded-full border transition-colors ${filterRuleType === t ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:bg-muted'}`}
                >
                  {t === 'All' ? 'All' : RULE_TYPE_CONFIG[t].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1.5">Status</label>
            <div className="flex gap-1.5 flex-wrap">
              {(['All', 'Open', 'Resolved'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 text-xs font-600 rounded-full border transition-colors ${filterStatus === s ? 'bg-primary text-white border-primary' : 'bg-white text-muted-foreground border-border hover:bg-muted'}`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="px-6 py-4">
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 mb-4">
            <AlertTriangle size={15} />
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <ShieldAlert size={24} className="text-muted-foreground" />
            </div>
            <p className="text-base font-600 text-foreground">No breaches found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters || search
                ? 'Try adjusting your filters or search query.'
                : 'No compliance rule breaches have been recorded yet. Click "Run Engine Now" to evaluate current data.'}
            </p>
            {(hasActiveFilters || search) && (
              <button onClick={clearFilters} className="mt-3 text-sm font-600 text-primary hover:underline">
                Clear all filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-border overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="pl-4 pr-2 py-3 w-8" />
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider whitespace-nowrap">Timestamp</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Collateral / Obligor</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Rule Name</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Severity</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Action</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Obligor</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Status</th>
                    <th className="px-3 py-3 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((entry) => (
                    <BreachRow
                      key={entry.id}
                      entry={entry}
                      expanded={expandedId === entry.id}
                      onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
                      onResolve={() => handleResolve(entry.id)}
                      resolving={resolvingId === entry.id}
                    />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Showing <span className="font-600 text-foreground">{filtered.length}</span> of <span className="font-600 text-foreground">{allBreaches.length}</span> breach records
              </p>
              <Link href="/compliance-rules" className="text-xs font-600 text-primary hover:underline flex items-center gap-1">
                <ExternalLink size={11} />
                Manage Compliance Rules
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
