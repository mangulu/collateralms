'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldAlert, Search, RefreshCw, ChevronDown, ChevronUp,
  AlertTriangle, XCircle, Info, Clock, Scale, Shield,
  Filter, X, ExternalLink, User, Calendar,
} from 'lucide-react';
import Link from 'next/link';
import { complianceRulesService, type ComplianceRuleDB } from '@/lib/supabase/complianceRulesService';


// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
type RuleType = 'LTV' | 'DEADLINE' | 'ELIGIBILITY';
type RuleAction = 'BLOCK' | 'WARN' | 'LOG';

interface BreachEntry {
  id: string;
  breachedAt: string;
  ruleName: string;
  ruleType: RuleType;
  action: RuleAction;
  severity: Severity;
  collateralId: string | null;
  collateralRef: string | null;
  collateralType: string | null;
  triggerValue: string | null;
  threshold: string | null;
  assignedOwner: string | null;
  ownerEmail: string | null;
  message: string;
  resolvedAt: string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function deriveSeverity(action: RuleAction, ruleType: RuleType): Severity {
  if (action === 'BLOCK') return 'Critical';
  if (action === 'WARN' && ruleType === 'LTV') return 'High';
  if (action === 'WARN') return 'Medium';
  return 'Low';
}

const SEVERITY_CONFIG: Record<Severity, { label: string; dot: string; badge: string; row: string }> = {
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

// ─── Build mock breach log from compliance_rules triggered_count ──────────────

function buildBreachesFromRules(rules: ComplianceRuleDB[]): BreachEntry[] {
  const entries: BreachEntry[] = [];
  const now = Date.now();

  const mockCollaterals = [
    { id: 'COL-2024-001', ref: 'Plot 45, Msasani Peninsula', type: 'Mortgage' },
    { id: 'COL-2024-007', ref: 'Toyota Land Cruiser V8 2022', type: 'Motor Vehicle' },
    { id: 'COL-2024-012', ref: 'DSE Shares – Simba Cement Ltd', type: 'Shares (DSE)' },
    { id: 'COL-2024-019', ref: 'Commercial Building, Kariakoo', type: 'Debenture' },
    { id: 'COL-2024-023', ref: 'FDR – CRDB Bank TZS 500M', type: 'FDR' },
    { id: 'COL-2024-031', ref: 'Plot 12, Kinondoni District', type: 'Mortgage' },
    { id: 'COL-2024-038', ref: 'Mercedes Benz Sprinter 2021', type: 'Motor Vehicle' },
    { id: 'COL-2024-044', ref: 'NMB Shares Portfolio', type: 'Shares (DSE)' },
  ];

  const mockOwners = [
    { name: 'James Mwangi', email: 'j.mwangi@bank.co.tz' },
    { name: 'Amina Hassan', email: 'a.hassan@bank.co.tz' },
    { name: 'Peter Kimaro', email: 'p.kimaro@bank.co.tz' },
    { name: 'Grace Mollel', email: 'g.mollel@bank.co.tz' },
    { name: 'David Mushi', email: 'd.mushi@bank.co.tz' },
  ];

  rules.forEach((rule, ruleIdx) => {
    const count = Math.min(rule.triggered_count ?? 0, 8);
    for (let i = 0; i < count; i++) {
      const hoursAgo = (ruleIdx * 48 + i * 6 + Math.floor(i * 3.7)) * 3600 * 1000;
      const breachedAt = new Date(now - hoursAgo).toISOString();
      const col = mockCollaterals[(ruleIdx + i) % mockCollaterals.length];
      const owner = mockOwners[(ruleIdx + i) % mockOwners.length];
      const severity = deriveSeverity(rule.action, rule.rule_type);

      let triggerValue: string | null = null;
      let threshold: string | null = null;
      if (rule.condition) {
        const val = rule.condition.value;
        const field = rule.condition.field ?? '';
        if (field.includes('ltv') || field.includes('utilization')) {
          triggerValue = `${(Number(val) + 3 + i * 1.5).toFixed(1)}%`;
          threshold = `${val}%`;
        } else if (field.includes('days')) {
          triggerValue = `${Math.max(0, Number(val) - 2 - i)} days`;
          threshold = `${val} days`;
        } else if (field.includes('months') || field.includes('years')) {
          triggerValue = `${Number(val) + 1 + i}`;
          threshold = `${val}`;
        }
      }

      entries.push({
        id: `${rule.id}-breach-${i}`,
        breachedAt,
        ruleName: rule.rule_name,
        ruleType: rule.rule_type,
        action: rule.action,
        severity,
        collateralId: col.id,
        collateralRef: col.ref,
        collateralType: col.type,
        triggerValue,
        threshold,
        assignedOwner: owner.name,
        ownerEmail: owner.email,
        message: rule.message ?? '',
        resolvedAt: severity === 'Low' && i === 0 ? new Date(now - hoursAgo + 7200000).toISOString() : null,
      });
    }
  });

  // Sort newest first
  return entries.sort((a, b) => new Date(b.breachedAt).getTime() - new Date(a.breachedAt).getTime());
}

// ─── Row Component ────────────────────────────────────────────────────────────

function BreachRow({ entry, expanded, onToggle }: {
  entry: BreachEntry;
  expanded: boolean;
  onToggle: () => void;
}) {
  const sev = SEVERITY_CONFIG[entry.severity];
  const act = ACTION_CONFIG[entry.action];
  const rt = RULE_TYPE_CONFIG[entry.ruleType];
  const ActIcon = act.icon;
  const RtIcon = rt.icon;

  return (
    <>
      <tr
        className={`border-b border-border/50 hover:bg-muted/30 transition-colors cursor-pointer ${sev.row}`}
        onClick={onToggle}
      >
        {/* Severity dot */}
        <td className="pl-4 pr-2 py-3 w-8">
          <span className={`inline-block w-2.5 h-2.5 rounded-full ${sev.dot}`} />
        </td>

        {/* Timestamp */}
        <td className="px-3 py-3 text-xs text-muted-foreground whitespace-nowrap">
          <div className="flex items-center gap-1.5">
            <Calendar size={12} className="shrink-0" />
            {formatDateTime(entry.breachedAt)}
          </div>
        </td>

        {/* Collateral */}
        <td className="px-3 py-3">
          <div className="text-sm font-600 text-foreground leading-tight">{entry.collateralId}</div>
          <div className="text-xs text-muted-foreground truncate max-w-[180px]">{entry.collateralRef}</div>
        </td>

        {/* Rule Name */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <RtIcon size={13} className={`shrink-0 ${rt.color}`} />
            <span className="text-sm font-500 text-foreground">{entry.ruleName}</span>
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">{rt.label}</div>
        </td>

        {/* Severity */}
        <td className="px-3 py-3">
          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-600 ${sev.badge}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${sev.dot}`} />
            {sev.label}
          </span>
        </td>

        {/* Action */}
        <td className="px-3 py-3">
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-600 ${act.bg} ${act.color}`}>
            <ActIcon size={11} />
            {act.label}
          </span>
        </td>

        {/* Owner */}
        <td className="px-3 py-3">
          <div className="flex items-center gap-1.5">
            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <User size={11} className="text-primary" />
            </div>
            <span className="text-sm text-foreground">{entry.assignedOwner ?? '—'}</span>
          </div>
        </td>

        {/* Status */}
        <td className="px-3 py-3">
          {entry.resolvedAt ? (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-green-100 text-green-700 border border-green-200">
              Resolved
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 bg-red-100 text-red-700 border border-red-200">
              Open
            </span>
          )}
        </td>

        {/* Expand */}
        <td className="px-3 py-3 text-right pr-4">
          {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </td>
      </tr>

      {/* Expanded detail row */}
      {expanded && (
        <tr className="bg-muted/20 border-b border-border/50">
          <td colSpan={9} className="px-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Breach Details</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Trigger Value</span>
                    <span className="font-600 text-foreground">{entry.triggerValue ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Threshold</span>
                    <span className="font-600 text-foreground">{entry.threshold ?? '—'}</span>
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
                <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Assignment & Resolution</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="font-600 text-foreground">{entry.assignedOwner ?? '—'}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Email</span>
                    <span className="font-500 text-foreground text-xs">{entry.ownerEmail ?? '—'}</span>
                  </div>
                  {entry.resolvedAt && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Resolved At</span>
                      <span className="font-500 text-green-700 text-xs">{formatDateTime(entry.resolvedAt)}</span>
                    </div>
                  )}
                </div>
                {entry.collateralId && (
                  <Link
                    href={`/collateral-management`}
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
  const [allBreaches, setAllBreaches] = useState<BreachEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterSeverity, setFilterSeverity] = useState<Severity | 'All'>('All');
  const [filterAction, setFilterAction] = useState<RuleAction | 'All'>('All');
  const [filterRuleType, setFilterRuleType] = useState<RuleType | 'All'>('All');
  const [filterStatus, setFilterStatus] = useState<'All' | 'Open' | 'Resolved'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rules = await complianceRulesService.fetchAll();
      const breaches = buildBreachesFromRules(rules);
      setAllBreaches(breaches);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load breach log');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = allBreaches.filter((b) => {
    const q = search.toLowerCase();
    const matchSearch = !q || (
      b.ruleName.toLowerCase().includes(q) ||
      (b.collateralId ?? '').toLowerCase().includes(q) ||
      (b.collateralRef ?? '').toLowerCase().includes(q) ||
      (b.assignedOwner ?? '').toLowerCase().includes(q) ||
      (b.collateralType ?? '').toLowerCase().includes(q)
    );
    const matchSeverity = filterSeverity === 'All' || b.severity === filterSeverity;
    const matchAction = filterAction === 'All' || b.action === filterAction;
    const matchType = filterRuleType === 'All' || b.ruleType === filterRuleType;
    const matchStatus = filterStatus === 'All' || (filterStatus === 'Resolved' ? !!b.resolvedAt : !b.resolvedAt);
    return matchSearch && matchSeverity && matchAction && matchType && matchStatus;
  });

  const stats = {
    total: allBreaches.length,
    critical: allBreaches.filter((b) => b.severity === 'Critical').length,
    open: allBreaches.filter((b) => !b.resolvedAt).length,
    resolved: allBreaches.filter((b) => !!b.resolvedAt).length,
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
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center">
              <ShieldAlert size={20} className="text-red-600" />
            </div>
            <div>
              <h1 className="text-xl font-700 text-foreground">Compliance Breach Log</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Time-ordered log of all compliance rule violations</p>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

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
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search rule, collateral, owner…"
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filter toggle */}
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

      {/* Filter panel */}
      {showFilters && (
        <div className="px-6 py-4 bg-muted/20 border-b border-border flex flex-wrap gap-4">
          {/* Severity */}
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

          {/* Action */}
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

          {/* Rule Type */}
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

          {/* Status */}
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
              {hasActiveFilters || search ? 'Try adjusting your filters or search query.' : 'No compliance rule breaches have been recorded yet.'}
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
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Collateral</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Rule Name</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Severity</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Action</th>
                    <th className="px-3 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Assigned Owner</th>
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
                    />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer count */}
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
