'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { collateralLinkService, CollateralUtilization,  } from '@/lib/supabase/collateralLinkService';
import { Search, ChevronDown, ChevronUp, Shield, Link2, AlertTriangle, TrendingUp, Layers, RefreshCw, Filter, X,  } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollateralSummary {
  id: string;
  collateralId: string;
  obligor: string;
  type: string;
  valueTSh: string;
  status: string;
}

interface LoanCollateralEntry {
  loanAccountId: string;
  beneficiaryName: string;
  collaterals: {
    collateralRecordId: string;
    collateralId: string;
    obligor: string;
    type: string;
    valuationAmount: number;
    allocatedAmount: number;
    allocationPct: number;
    utilizationPct: number;
    utilizationStatus: string;
    chargeRank: number;
    linkStatus: string;
  }[];
  totalAllocated: number;
}

// ─── Utilization Bar ──────────────────────────────────────────────────────────

function UtilizationBar({ pct, status }: { pct: number; status: string }) {
  const color =
    status === 'RED' ?'bg-red-500'
      : status === 'YELLOW' ?'bg-amber-400' :'bg-emerald-500';
  const textColor =
    status === 'RED' ?'text-red-600'
      : status === 'YELLOW' ?'text-amber-600' :'text-emerald-600';
  const clamped = Math.min(100, Math.max(0, pct));
  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${clamped}%` }}
        />
      </div>
      <span className={`text-xs font-semibold tabular-nums shrink-0 ${textColor}`}>
        {pct.toFixed(1)}%
      </span>
    </div>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    GREEN: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    YELLOW: 'bg-amber-50 text-amber-700 border-amber-200',
    RED: 'bg-red-50 text-red-700 border-red-200',
    ACTIVE: 'bg-blue-50 text-blue-700 border-blue-200',
    RELEASED: 'bg-gray-50 text-gray-600 border-gray-200',
    DEFAULTED: 'bg-red-50 text-red-700 border-red-200',
  };
  const label: Record<string, string> = {
    GREEN: 'On Track',
    YELLOW: 'Near Limit',
    RED: 'Critical',
    ACTIVE: 'Active',
    RELEASED: 'Released',
    DEFAULTED: 'Defaulted',
  };
  const cls = map[status] ?? 'bg-gray-50 text-gray-600 border-gray-200';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border ${cls}`}>
      {label[status] ?? status}
    </span>
  );
}

// ─── Allocation Donut ─────────────────────────────────────────────────────────

function AllocationDonut({
  segments,
}: {
  segments: { pct: number; color: string; label: string }[];
}) {
  const size = 64;
  const cx = size / 2;
  const cy = size / 2;
  const r = 24;
  const circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
      {segments.map((seg, i) => {
        const dash = (seg.pct / 100) * circumference;
        const gap = circumference - dash;
        const el = (
          <circle
            key={i}
            cx={cx}
            cy={cy}
            r={r}
            fill="none"
            stroke={seg.color}
            strokeWidth="8"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            strokeLinecap="butt"
            style={{ transform: 'rotate(-90deg)', transformOrigin: `${cx}px ${cy}px` }}
          />
        );
        offset += dash;
        return el;
      })}
      <text x={cx} y={cy + 4} textAnchor="middle" fontSize="9" fontWeight="700" fill="#374151">
        {segments.length}
      </text>
    </svg>
  );
}

// ─── Collateral → Loans Panel ─────────────────────────────────────────────────

function CollateralToLoansPanel({
  utilizations,
  loading,
  searchTerm,
}: {
  utilizations: CollateralUtilization[];
  loading: boolean;
  searchTerm: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const filtered = utilizations.filter((u) => {
    const matchSearch =
      !searchTerm ||
      u.collateralId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.linkedLoans.some((l) =>
        l.loanAccountId.toLowerCase().includes(searchTerm.toLowerCase()) ||
        l.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase())
      );
    const matchStatus =
      statusFilter === 'ALL' || u.utilizationStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Filter row */}
      <div className="flex items-center gap-2 flex-wrap">
        {(['ALL', 'GREEN', 'YELLOW', 'RED'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
              statusFilter === s
                ? 'bg-primary text-white border-primary' :'bg-white text-gray-600 border-gray-200 hover:border-primary/40'
            }`}
          >
            {s === 'ALL' ? 'All' : s === 'GREEN' ? 'On Track' : s === 'YELLOW' ? 'Near Limit' : 'Critical'}
            {s !== 'ALL' && (
              <span className="ml-1 opacity-70">
                ({utilizations.filter((u) => u.utilizationStatus === s).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          No collaterals match the current filter.
        </div>
      )}

      {filtered.map((util) => {
        const isOpen = expanded.has(util.collateralRecordId);
        const activeLoans = util.linkedLoans.filter((l) => l.status === 'ACTIVE');
        const colors = ['#3b82f6', '#8b5cf6', '#f59e0b', '#10b981', '#ef4444', '#06b6d4'];
        const segments = activeLoans.map((l, i) => ({
          pct:
            util.maxSecurableAmount > 0
              ? (l.allocatedAmount / util.maxSecurableAmount) * 100
              : 0,
          color: colors[i % colors.length],
          label: l.loanAccountId,
        }));
        const freePct = Math.max(
          0,
          100 - segments.reduce((s, seg) => s + seg.pct, 0)
        );
        if (freePct > 0) segments.push({ pct: freePct, color: '#e5e7eb', label: 'Available' });

        return (
          <div
            key={util.collateralRecordId}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Header row */}
            <button
              onClick={() => toggle(util.collateralRecordId)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
            >
              <AllocationDonut segments={segments} />

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {util.collateralId}
                  </span>
                  <StatusBadge status={util.utilizationStatus} />
                </div>
                <UtilizationBar pct={util.utilizationPercentage} status={util.utilizationStatus} />
                <div className="flex items-center gap-4 mt-1.5 text-[10px] text-gray-500">
                  <span>
                    Secured:{' '}
                    <span className="font-semibold text-gray-700">
                      TSh {util.totalSecuredAmount.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Available:{' '}
                    <span className="font-semibold text-emerald-600">
                      TSh {util.availableEquity.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Loans:{' '}
                    <span className="font-semibold text-primary">{activeLoans.length}</span>
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-gray-400">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {/* Expanded loan list */}
            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3 space-y-2">
                {/* Summary metrics */}
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    {
                      label: 'Valuation',
                      value: `TSh ${util.valuationAmount.toLocaleString()}`,
                      color: 'text-gray-700',
                    },
                    {
                      label: 'Max Securable',
                      value: `TSh ${util.maxSecurableAmount.toLocaleString()}`,
                      color: 'text-gray-700',
                    },
                    {
                      label: 'LTV Ratio',
                      value: `${(util.ltvRatio * 100).toFixed(0)}%`,
                      color: 'text-blue-600',
                    },
                    {
                      label: 'Utilization',
                      value: `${util.utilizationPercentage.toFixed(1)}%`,
                      color:
                        util.utilizationStatus === 'RED' ?'text-red-600'
                          : util.utilizationStatus === 'YELLOW' ?'text-amber-600' :'text-emerald-600',
                    },
                  ].map((m) => (
                    <div key={m.label} className="bg-white rounded-lg p-2.5 border border-gray-100">
                      <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                        {m.label}
                      </p>
                      <p className={`text-xs font-bold ${m.color}`}>{m.value}</p>
                    </div>
                  ))}
                </div>

                {/* Loan rows */}
                {util.linkedLoans.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4">No loans linked.</p>
                ) : (
                  <div className="space-y-1.5">
                    {util.linkedLoans.map((loan, idx) => {
                      const allocationPct =
                        util.maxSecurableAmount > 0
                          ? (loan.allocatedAmount / util.maxSecurableAmount) * 100
                          : 0;
                      return (
                        <div
                          key={loan.id}
                          className="flex items-center gap-3 bg-white rounded-lg px-3 py-2.5 border border-gray-100"
                        >
                          <div
                            className="w-2 h-2 rounded-full shrink-0"
                            style={{ backgroundColor: colors[idx % colors.length] }}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-0.5">
                              <span className="text-xs font-semibold text-gray-800 truncate">
                                {loan.loanAccountId}
                              </span>
                              <StatusBadge status={loan.status} />
                              <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                                Rank #{loan.chargeRank}
                              </span>
                            </div>
                            <p className="text-[10px] text-gray-500 truncate">{loan.beneficiaryName}</p>
                            <div className="flex items-center gap-3 mt-1">
                              <UtilizationBar pct={allocationPct} status="GREEN" />
                              <span className="text-[10px] text-gray-500 shrink-0">
                                TSh {loan.allocatedAmount.toLocaleString()}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Loan → Collaterals Panel ─────────────────────────────────────────────────

function LoanToCollateralsPanel({
  loanEntries,
  loading,
  searchTerm,
}: {
  loanEntries: LoanCollateralEntry[];
  loading: boolean;
  searchTerm: string;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const filtered = loanEntries.filter(
    (e) =>
      !searchTerm ||
      e.loanAccountId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.beneficiaryName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.collaterals.some((c) =>
        c.collateralId.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (filtered.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400 text-sm">
        No loan accounts found.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {filtered.map((entry) => {
        const isOpen = expanded.has(entry.loanAccountId);
        const activeCollaterals = entry.collaterals.filter((c) => c.linkStatus === 'ACTIVE');
        const totalValuation = entry.collaterals.reduce((s, c) => s + c.valuationAmount, 0);

        return (
          <div
            key={entry.loanAccountId}
            className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow"
          >
            <button
              onClick={() => toggle(entry.loanAccountId)}
              className="w-full flex items-center gap-4 px-4 py-3 text-left hover:bg-gray-50/60 transition-colors"
            >
              {/* Icon */}
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Link2 size={16} className="text-primary" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {entry.loanAccountId}
                  </span>
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
                    {activeCollaterals.length} collateral{activeCollaterals.length !== 1 ? 's' : ''}
                  </span>
                </div>
                <p className="text-xs text-gray-500 truncate">{entry.beneficiaryName}</p>
                <div className="flex items-center gap-4 mt-1 text-[10px] text-gray-500">
                  <span>
                    Total Allocated:{' '}
                    <span className="font-semibold text-gray-700">
                      TSh {entry.totalAllocated.toLocaleString()}
                    </span>
                  </span>
                  <span>
                    Total Collateral Value:{' '}
                    <span className="font-semibold text-blue-600">
                      TSh {totalValuation.toLocaleString()}
                    </span>
                  </span>
                </div>
              </div>

              <div className="shrink-0 text-gray-400">
                {isOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              </div>
            </button>

            {isOpen && (
              <div className="border-t border-gray-100 bg-gray-50/40 px-4 py-3 space-y-2">
                {entry.collaterals.map((col, idx) => {
                  const coverageRatio =
                    entry.totalAllocated > 0
                      ? (col.allocatedAmount / entry.totalAllocated) * 100
                      : 0;
                  return (
                    <div
                      key={col.collateralRecordId}
                      className="bg-white rounded-lg px-3 py-2.5 border border-gray-100"
                    >
                      <div className="flex items-start gap-3">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0 mt-0.5">
                          <Shield size={12} className="text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <span className="text-xs font-semibold text-gray-800 truncate">
                              {col.collateralId}
                            </span>
                            <StatusBadge status={col.linkStatus} />
                            <span className="text-[10px] text-gray-400 ml-auto shrink-0">
                              Rank #{col.chargeRank}
                            </span>
                          </div>
                          <p className="text-[10px] text-gray-500 mb-1.5">
                            {col.type} · {col.obligor}
                          </p>

                          {/* Allocation % of this loan's total */}
                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                                Allocation (% of loan)
                              </p>
                              <UtilizationBar pct={coverageRatio} status="GREEN" />
                            </div>
                            <div>
                              <p className="text-[9px] text-gray-400 uppercase tracking-wide mb-0.5">
                                Collateral Utilization
                              </p>
                              <UtilizationBar
                                pct={col.utilizationPct}
                                status={col.utilizationStatus}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-4 mt-1.5 text-[10px] text-gray-500">
                            <span>
                              Allocated:{' '}
                              <span className="font-semibold text-gray-700">
                                TSh {col.allocatedAmount.toLocaleString()}
                              </span>
                            </span>
                            <span>
                              Valuation:{' '}
                              <span className="font-semibold text-blue-600">
                                TSh {col.valuationAmount.toLocaleString()}
                              </span>
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollateralLoanVisualizationContent() {
  const [utilizations, setUtilizations] = useState<CollateralUtilization[]>([]);
  const [loanEntries, setLoanEntries] = useState<LoanCollateralEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'collateral-to-loans' | 'loan-to-collaterals'>(
    'collateral-to-loans'
  );

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const allUtils = await collateralLinkService.getAllUtilizationReport();
      setUtilizations(allUtils);

      // Build loan → collaterals map
      const loanMap = new Map<string, LoanCollateralEntry>();
      for (const util of allUtils) {
        for (const loan of util.linkedLoans) {
          if (!loanMap.has(loan.loanAccountId)) {
            loanMap.set(loan.loanAccountId, {
              loanAccountId: loan.loanAccountId,
              beneficiaryName: loan.beneficiaryName,
              collaterals: [],
              totalAllocated: 0,
            });
          }
          const entry = loanMap.get(loan.loanAccountId)!;
          entry.collaterals.push({
            collateralRecordId: util.collateralRecordId,
            collateralId: util.collateralId,
            obligor: '',
            type: '',
            valuationAmount: util.valuationAmount,
            allocatedAmount: loan.allocatedAmount,
            allocationPct:
              util.maxSecurableAmount > 0
                ? (loan.allocatedAmount / util.maxSecurableAmount) * 100
                : 0,
            utilizationPct: util.utilizationPercentage,
            utilizationStatus: util.utilizationStatus,
            chargeRank: loan.chargeRank,
            linkStatus: loan.status,
          });
          if (loan.status === 'ACTIVE') {
            entry.totalAllocated += loan.allocatedAmount;
          }
        }
      }

      // Enrich with collateral metadata
      const supabase = createClient();
      const { data: records } = await supabase
        .from('collateral_records')
        .select('id, collateral_id, obligor, collateral_type');

      if (records) {
        const recMap = new Map(records.map((r: any) => [r.id, r]));
        for (const entry of loanMap.values()) {
          for (const col of entry.collaterals) {
            const rec = recMap.get(col.collateralRecordId) as any;
            if (rec) {
              col.obligor = rec.obligor ?? '';
              col.type = rec.collateral_type ?? '';
            }
          }
        }
      }

      setLoanEntries(Array.from(loanMap.values()));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ── Summary stats ──────────────────────────────────────────────────────────
  const totalCollaterals = utilizations.length;
  const totalLoans = loanEntries.length;
  const criticalCount = utilizations.filter((u) => u.utilizationStatus === 'RED').length;
  const nearLimitCount = utilizations.filter((u) => u.utilizationStatus === 'YELLOW').length;
  const sharedCollaterals = utilizations.filter((u) => u.linkedLoans.filter((l) => l.status === 'ACTIVE').length > 1).length;
  const multiCollateralLoans = loanEntries.filter((e) => e.collaterals.filter((c) => c.linkStatus === 'ACTIVE').length > 1).length;

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Collateral–Loan Visualization</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Cross-reference view of collaterals securing loans and loans secured by collaterals
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
          {[
            { label: 'Collaterals', value: totalCollaterals, icon: Shield, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Loan Accounts', value: totalLoans, icon: Link2, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'Shared Collaterals', value: sharedCollaterals, icon: Layers, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Multi-Collateral Loans', value: multiCollateralLoans, icon: TrendingUp, color: 'text-cyan-600', bg: 'bg-cyan-50' },
            { label: 'Near Limit', value: nearLimitCount, icon: AlertTriangle, color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Critical', value: criticalCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          ].map((stat) => (
            <div
              key={stat.label}
              className="flex items-center gap-2.5 bg-white border border-gray-100 rounded-xl px-3 py-2.5 shadow-sm"
            >
              <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                <stat.icon size={14} className={stat.color} />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-gray-900 leading-none">{stat.value}</p>
                <p className="text-[10px] text-gray-500 truncate">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs + Search */}
      <div className="px-6 py-3 border-b border-gray-100 bg-white shrink-0 flex items-center gap-4 flex-wrap">
        <div className="flex bg-gray-100 rounded-lg p-0.5 gap-0.5">
          <button
            onClick={() => setActiveTab('collateral-to-loans')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'collateral-to-loans' ?'bg-white text-gray-900 shadow-sm' :'text-gray-500 hover:text-gray-700'
            }`}
          >
            Collateral → Loans
          </button>
          <button
            onClick={() => setActiveTab('loan-to-collaterals')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              activeTab === 'loan-to-collaterals' ?'bg-white text-gray-900 shadow-sm' :'text-gray-500 hover:text-gray-700'
            }`}
          >
            Loan → Collaterals
          </button>
        </div>

        <div className="relative flex-1 max-w-sm ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              activeTab === 'collateral-to-loans' ?'Search collateral ID or loan account…' :'Search loan account or collateral…'
            }
            className="w-full pl-8 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {activeTab === 'collateral-to-loans' ? (
          <CollateralToLoansPanel
            utilizations={utilizations}
            loading={loading}
            searchTerm={searchTerm}
          />
        ) : (
          <LoanToCollateralsPanel
            loanEntries={loanEntries}
            loading={loading}
            searchTerm={searchTerm}
          />
        )}
      </div>
    </div>
  );
}
