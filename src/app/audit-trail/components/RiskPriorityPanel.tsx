'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  AlertTriangle, CheckCircle2, Clock, TrendingDown, RefreshCw,
  ChevronRight, AlertCircle, ShieldAlert, Calendar, BarChart2,
  ArrowRight, Info,
} from 'lucide-react';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import Link from 'next/link';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatCurrency(val: number | null | undefined): string {
  if (val == null) return '—';
  if (val >= 1_000_000_000) return `TSh ${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `TSh ${(val / 1_000_000).toFixed(1)}M`;
  return `TSh ${val.toLocaleString()}`;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysBetween(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function valuationAgeDays(updatedAt: string | null | undefined): number | null {
  if (!updatedAt) return null;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}

// ─── Risk Tier Classification ─────────────────────────────────────────────────

type RiskTier = 'red' | 'amber' | 'green';

interface EnrichedCollateral extends CollateralRecord {
  riskTier: RiskTier;
  riskReasons: string[];
  deadlineDays: number | null;
  valuationAge: number | null;
}

function classifyRisk(c: CollateralRecord): { tier: RiskTier; reasons: string[] } {
  const reasons: string[] = [];
  let score = 0;

  // Deadline proximity
  const ddDays = c.daysToDeadline ?? daysBetween(c.perfectionDeadline);
  if (ddDays !== null) {
    if (ddDays < 0) { score += 3; reasons.push('Deadline overdue'); }
    else if (ddDays <= 7) { score += 3; reasons.push(`Deadline in ${ddDays}d`); }
    else if (ddDays <= 21) { score += 2; reasons.push(`Deadline in ${ddDays}d`); }
    else if (ddDays <= 45) { score += 1; reasons.push(`Deadline in ${ddDays}d`); }
  }

  // Status risk
  if (c.status === 'Overdue') { score += 3; reasons.push('Status: Overdue'); }
  else if (c.status === 'Rejected') { score += 2; reasons.push('Status: Rejected'); }
  else if (c.status === 'Draft') { score += 1; reasons.push('Status: Draft'); }

  // LTV risk
  if (c.ltvRatio != null) {
    if (c.ltvRatio > 0.9) { score += 3; reasons.push(`LTV ${(c.ltvRatio * 100).toFixed(0)}% (critical)`); }
    else if (c.ltvRatio > 0.75) { score += 2; reasons.push(`LTV ${(c.ltvRatio * 100).toFixed(0)}% (high)`); }
    else if (c.ltvRatio > 0.6) { score += 1; reasons.push(`LTV ${(c.ltvRatio * 100).toFixed(0)}% (elevated)`); }
  }

  // Valuation aging
  const vAge = valuationAgeDays(c.updatedAt);
  if (vAge !== null) {
    if (vAge > 365) { score += 2; reasons.push(`Valuation ${vAge}d old`); }
    else if (vAge > 180) { score += 1; reasons.push(`Valuation ${vAge}d old`); }
  }

  // No valuation
  if (!c.valuationAmount) { score += 1; reasons.push('No valuation on record'); }

  const tier: RiskTier = score >= 5 ? 'red' : score >= 2 ? 'amber' : 'green';
  return { tier, reasons: reasons.slice(0, 3) };
}

// ─── Tier Config ──────────────────────────────────────────────────────────────

const TIER_CONFIG = {
  red: {
    label: 'High Risk',
    bg: 'bg-red-50',
    border: 'border-red-200',
    headerBg: 'bg-red-100',
    headerText: 'text-red-800',
    badgeBg: 'bg-red-100',
    badgeText: 'text-red-700',
    dot: 'bg-red-500',
    icon: ShieldAlert,
    iconColor: 'text-red-500',
    pillBg: 'bg-red-100',
    pillText: 'text-red-700',
    ringColor: 'ring-red-300',
  },
  amber: {
    label: 'Medium Risk',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    headerBg: 'bg-amber-100',
    headerText: 'text-amber-800',
    badgeBg: 'bg-amber-100',
    badgeText: 'text-amber-700',
    dot: 'bg-amber-500',
    icon: AlertTriangle,
    iconColor: 'text-amber-500',
    pillBg: 'bg-amber-100',
    pillText: 'text-amber-700',
    ringColor: 'ring-amber-300',
  },
  green: {
    label: 'Low Risk',
    bg: 'bg-green-50',
    border: 'border-green-200',
    headerBg: 'bg-green-100',
    headerText: 'text-green-800',
    badgeBg: 'bg-green-100',
    badgeText: 'text-green-700',
    dot: 'bg-green-500',
    icon: CheckCircle2,
    iconColor: 'text-green-500',
    pillBg: 'bg-green-100',
    pillText: 'text-green-700',
    ringColor: 'ring-green-300',
  },
};

// ─── Collateral Row ───────────────────────────────────────────────────────────

function CollateralRow({ c, cfg }: { c: EnrichedCollateral; cfg: typeof TIER_CONFIG['red'] }) {
  const deadlineUrgent = c.deadlineDays !== null && c.deadlineDays <= 7;
  const deadlineWarning = c.deadlineDays !== null && c.deadlineDays > 7 && c.deadlineDays <= 21;
  const valuationStale = c.valuationAge !== null && c.valuationAge > 180;

  return (
    <div className={`flex items-start gap-3 px-4 py-3 border-b border-border/50 last:border-b-0 hover:bg-white/60 transition-colors`}>
      <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${cfg.dot}`} />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2 flex-wrap">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold text-foreground font-mono">{c.collateralId}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[180px]">{c.obligor}</span>
              <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{c.type}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-xs">{c.description}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
            {c.riskReasons.map((r, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.pillBg} ${cfg.pillText}`}>
                {r}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-4 mt-1.5 flex-wrap">
          {/* Deadline */}
          {c.perfectionDeadline && (
            <div className={`flex items-center gap-1 text-xs ${deadlineUrgent ? 'text-red-600 font-semibold' : deadlineWarning ? 'text-amber-600 font-medium' : 'text-muted-foreground'}`}>
              <Calendar size={11} />
              Deadline: {formatDate(c.perfectionDeadline)}
              {c.deadlineDays !== null && (
                <span className={`ml-1 px-1.5 py-0.5 rounded text-xs font-mono ${
                  c.deadlineDays < 0 ? 'bg-red-100 text-red-700' : deadlineUrgent ?'bg-red-100 text-red-700': deadlineWarning ?'bg-amber-100 text-amber-700': 'bg-muted text-muted-foreground'
                }`}>
                  {c.deadlineDays < 0 ? `${Math.abs(c.deadlineDays)}d overdue` : `${c.deadlineDays}d left`}
                </span>
              )}
            </div>
          )}

          {/* Valuation */}
          {c.valuationAmount != null && (
            <div className={`flex items-center gap-1 text-xs ${valuationStale ? 'text-amber-600' : 'text-muted-foreground'}`}>
              <BarChart2 size={11} />
              {formatCurrency(c.valuationAmount)}
              {valuationStale && c.valuationAge !== null && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 text-xs font-mono">
                  {c.valuationAge}d old
                </span>
              )}
            </div>
          )}

          {/* LTV */}
          {c.ltvRatio != null && (
            <div className={`flex items-center gap-1 text-xs ${c.ltvRatio > 0.75 ? 'text-red-600 font-medium' : 'text-muted-foreground'}`}>
              <TrendingDown size={11} />
              LTV: {(c.ltvRatio * 100).toFixed(0)}%
            </div>
          )}

          {/* Status */}
          <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${
            c.status === 'Overdue' ? 'bg-red-100 text-red-700' :
            c.status === 'Perfected' ? 'bg-green-100 text-green-700' :
            c.status === 'Rejected'? 'bg-rose-100 text-rose-700' : 'bg-muted text-muted-foreground'
          }`}>
            {c.status}
          </span>
        </div>
      </div>

      <Link
        href={`/collateral-detail/${c.id}`}
        className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        onClick={(e) => e.stopPropagation()}
      >
        <ChevronRight size={14} />
      </Link>
    </div>
  );
}

// ─── Tier Section ─────────────────────────────────────────────────────────────

function TierSection({ tier, items, defaultOpen }: { tier: RiskTier; items: EnrichedCollateral[]; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const cfg = TIER_CONFIG[tier];
  const TierIcon = cfg.icon;
  const SHOW_LIMIT = 8;
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, SHOW_LIMIT);

  return (
    <div className={`rounded-xl border ${cfg.border} overflow-hidden`}>
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center justify-between px-4 py-3 ${cfg.headerBg} hover:opacity-90 transition-opacity`}
      >
        <div className="flex items-center gap-2">
          <TierIcon size={16} className={cfg.iconColor} />
          <span className={`text-sm font-bold ${cfg.headerText}`}>{cfg.label}</span>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.badgeBg} ${cfg.badgeText}`}>
            {items.length} collateral{items.length !== 1 ? 's' : ''}
          </span>
        </div>
        <ChevronRight size={14} className={`${cfg.iconColor} transition-transform ${open ? 'rotate-90' : ''}`} />
      </button>

      {/* Body */}
      {open && (
        <div className={cfg.bg}>
          {items.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-4 text-sm text-muted-foreground">
              <CheckCircle2 size={14} className="text-green-500" />
              No collaterals in this risk tier
            </div>
          ) : (
            <>
              <div className="divide-y divide-border/30">
                {visible.map((c) => (
                  <CollateralRow key={c.id} c={c} cfg={cfg} />
                ))}
              </div>
              {items.length > SHOW_LIMIT && (
                <div className="px-4 py-2 border-t border-border/30">
                  <button
                    onClick={() => setShowAll((v) => !v)}
                    className={`text-xs font-medium flex items-center gap-1 ${cfg.badgeText} hover:underline`}
                  >
                    {showAll ? 'Show less' : `Show ${items.length - SHOW_LIMIT} more`}
                    <ArrowRight size={11} className={showAll ? 'rotate-180' : ''} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Approaching Deadlines Panel ──────────────────────────────────────────────

function ApproachingDeadlines({ items }: { items: EnrichedCollateral[] }) {
  const urgent = items.filter((c) => c.deadlineDays !== null && c.deadlineDays >= 0 && c.deadlineDays <= 7);
  const warning = items.filter((c) => c.deadlineDays !== null && c.deadlineDays > 7 && c.deadlineDays <= 30);
  const overdue = items.filter((c) => c.deadlineDays !== null && c.deadlineDays < 0);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <Clock size={15} className="text-amber-500" />
        <h3 className="text-sm font-bold text-foreground">Approaching Deadlines</h3>
        <span className="text-xs text-muted-foreground ml-auto">{overdue.length + urgent.length + warning.length} items need attention</span>
      </div>
      <div className="divide-y divide-border">
        {overdue.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertCircle size={11} /> Overdue ({overdue.length})
            </p>
            <div className="space-y-1.5">
              {overdue.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="font-mono text-foreground font-semibold">{c.collateralId}</span>
                    <span className="text-muted-foreground truncate">{c.obligor}</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono font-semibold">
                    {Math.abs(c.deadlineDays!)}d overdue
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {urgent.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-orange-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle size={11} /> Critical — within 7 days ({urgent.length})
            </p>
            <div className="space-y-1.5">
              {urgent.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-500 shrink-0" />
                    <span className="font-mono text-foreground font-semibold">{c.collateralId}</span>
                    <span className="text-muted-foreground truncate">{c.obligor}</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-orange-100 text-orange-700 font-mono font-semibold">
                    {c.deadlineDays}d left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {warning.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <Clock size={11} /> Within 30 days ({warning.length})
            </p>
            <div className="space-y-1.5">
              {warning.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-mono text-foreground font-semibold">{c.collateralId}</span>
                    <span className="text-muted-foreground truncate">{c.obligor}</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-mono font-semibold">
                    {c.deadlineDays}d left
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {overdue.length === 0 && urgent.length === 0 && warning.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 size={20} className="text-green-500 mx-auto mb-2" />
            No approaching deadlines
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Valuation Aging Panel ────────────────────────────────────────────────────

function ValuationAging({ items }: { items: EnrichedCollateral[] }) {
  const critical = items.filter((c) => c.valuationAge !== null && c.valuationAge > 365);
  const stale = items.filter((c) => c.valuationAge !== null && c.valuationAge > 180 && c.valuationAge <= 365);
  const noVal = items.filter((c) => !c.valuationAmount);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center gap-2">
        <TrendingDown size={15} className="text-rose-500" />
        <h3 className="text-sm font-bold text-foreground">Valuation Aging</h3>
        <span className="text-xs text-muted-foreground ml-auto">{critical.length + stale.length + noVal.length} need review</span>
      </div>
      <div className="divide-y divide-border">
        {critical.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-red-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertCircle size={11} /> Outdated &gt;1 year ({critical.length})
            </p>
            <div className="space-y-1.5">
              {critical.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0" />
                    <span className="font-mono text-foreground font-semibold">{c.collateralId}</span>
                    <span className="text-muted-foreground truncate">{c.obligor}</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-red-100 text-red-700 font-mono">
                    {c.valuationAge}d old
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {stale.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-amber-600 uppercase tracking-wider mb-2 flex items-center gap-1">
              <AlertTriangle size={11} /> Stale 6–12 months ({stale.length})
            </p>
            <div className="space-y-1.5">
              {stale.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" />
                    <span className="font-mono text-foreground font-semibold">{c.collateralId}</span>
                    <span className="text-muted-foreground truncate">{c.obligor}</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-amber-100 text-amber-700 font-mono">
                    {c.valuationAge}d old
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {noVal.length > 0 && (
          <div className="px-4 py-3">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 flex items-center gap-1">
              <Info size={11} /> No Valuation on Record ({noVal.length})
            </p>
            <div className="space-y-1.5">
              {noVal.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-2 text-xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-gray-400 shrink-0" />
                    <span className="font-mono text-foreground font-semibold">{c.collateralId}</span>
                    <span className="text-muted-foreground truncate">{c.obligor}</span>
                  </div>
                  <span className="shrink-0 px-2 py-0.5 rounded bg-muted text-muted-foreground font-mono">
                    No value
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {critical.length === 0 && stale.length === 0 && noVal.length === 0 && (
          <div className="px-4 py-6 text-center text-sm text-muted-foreground">
            <CheckCircle2 size={20} className="text-green-500 mx-auto mb-2" />
            All valuations are current
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RiskPriorityPanel() {
  const [collaterals, setCollaterals] = useState<EnrichedCollateral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await collateralService.getAll();
      const enriched: EnrichedCollateral[] = data.map((c) => {
        const { tier, reasons } = classifyRisk(c);
        return {
          ...c,
          riskTier: tier,
          riskReasons: reasons,
          deadlineDays: c.daysToDeadline ?? daysBetween(c.perfectionDeadline),
          valuationAge: valuationAgeDays(c.updatedAt),
        };
      });
      // Sort within each tier: most urgent first (lowest deadlineDays)
      enriched.sort((a, b) => {
        const tierOrder = { red: 0, amber: 1, green: 2 };
        if (tierOrder[a.riskTier] !== tierOrder[b.riskTier]) return tierOrder[a.riskTier] - tierOrder[b.riskTier];
        const aDays = a.deadlineDays ?? 9999;
        const bDays = b.deadlineDays ?? 9999;
        return aDays - bDays;
      });
      setCollaterals(enriched);
      setLastRefreshed(new Date());
    } catch {
      setError('Failed to load collateral risk data. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const red = collaterals.filter((c) => c.riskTier === 'red');
  const amber = collaterals.filter((c) => c.riskTier === 'amber');
  const green = collaterals.filter((c) => c.riskTier === 'green');

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldAlert size={20} className="text-primary" />
              <h2 className="text-xl font-bold text-foreground">Risk Priority View</h2>
              <span className="text-xs font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Legal Officer Focus</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Collaterals grouped by risk tier — prioritise red items first, then amber. Includes deadline tracking and valuation aging.
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={load}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Summary strip */}
        {!isLoading && !error && (
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span className="text-sm font-bold text-red-700">{red.length}</span>
              <span className="text-xs text-red-600">High Risk</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              <span className="text-sm font-bold text-amber-700">{amber.length}</span>
              <span className="text-xs text-amber-600">Medium Risk</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span className="text-sm font-bold text-green-700">{green.length}</span>
              <span className="text-xs text-green-600">Low Risk</span>
            </div>
            <div className="flex items-center gap-2 px-3 py-2 bg-muted border border-border rounded-lg ml-auto">
              <span className="text-xs text-muted-foreground">Total:</span>
              <span className="text-sm font-bold text-foreground">{collaterals.length}</span>
            </div>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 py-5">
        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl border border-border overflow-hidden animate-pulse">
                <div className="h-12 bg-muted" />
                <div className="p-4 space-y-3">
                  {[1, 2, 3].map((j) => <div key={j} className="h-10 bg-muted/50 rounded" />)}
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertCircle size={32} className="text-red-400 mb-3" />
            <p className="text-sm font-semibold text-red-600">{error}</p>
            <button onClick={load} className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              <RefreshCw size={13} /> Retry
            </button>
          </div>
        ) : (
          <div className="space-y-5">
            {/* Risk Tier Groups */}
            <div className="space-y-3">
              <TierSection tier="red" items={red} defaultOpen={true} />
              <TierSection tier="amber" items={amber} defaultOpen={true} />
              <TierSection tier="green" items={green} defaultOpen={false} />
            </div>

            {/* Bottom row: Deadlines + Valuation Aging */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ApproachingDeadlines items={collaterals} />
              <ValuationAging items={collaterals} />
            </div>

            {/* Legend */}
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <Info size={14} className="text-blue-500 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Risk Scoring:</span> Collaterals are scored based on deadline proximity, status (Overdue/Rejected), LTV ratio, and valuation age. Red = score ≥5, Amber = score 2–4, Green = score &lt;2. Click any row to open the full collateral detail.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
