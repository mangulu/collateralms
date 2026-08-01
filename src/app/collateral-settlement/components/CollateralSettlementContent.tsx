'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Search, RefreshCw, CheckCircle2, Clock, XCircle, AlertTriangle, ChevronDown, ChevronUp, Loader2, DollarSign, FileText, TrendingDown, Landmark, X, BadgeCheck } from 'lucide-react';
import { loanService, Loan } from '@/lib/supabase/loanService';


import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PayoffEvent {
  id: string;
  date: string;
  amount: number;
  currency: string;
  type: 'Principal' | 'Interest' | 'Penalty' | 'Full Settlement' | 'Partial Payment';
  reference: string;
  performedBy: string;
  notes?: string;
}

interface CollateralLink {
  id: string;
  collateralId: string;
  collateralRef: string;
  collateralType: string;
  collateralDescription: string;
  allocatedAmount: number;
  releaseStatus: string;
  dischargeDate?: string | null;
  dischargeNumber?: string | null;
}

interface LoanSettlementRecord {
  loan: Loan;
  settlementStatus: 'Settled' | 'Active' | 'Defaulted' | 'Written Off' | 'Restructured';
  settlementDate?: string | null;
  expectedPayoffDate?: string | null;
  totalFacilityAmount: number;
  outstandingBalance: number;
  payoffPercentage: number;
  collaterals: CollateralLink[];
  payoffHistory: PayoffEvent[];
  releasesPending: number;
  releasesCompleted: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'TZS'): string {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000_000) return `${currency} ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}K`;
  return `${currency} ${n.toLocaleString()}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

const settlementStatusConfig: Record<string, { bg: string; text: string; border: string; icon: React.ElementType; label: string }> = {
  Settled:      { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2, label: 'Settled' },
  Active:       { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: Clock,         label: 'Active' },
  Defaulted:    { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: XCircle,       label: 'Defaulted' },
  'Written Off':{ bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   icon: XCircle,       label: 'Written Off' },
  Restructured: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   icon: AlertTriangle, label: 'Restructured' },
};

const payoffTypeConfig: Record<string, { bg: string; text: string }> = {
  'Full Settlement': { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  'Partial Payment': { bg: 'bg-blue-100',    text: 'text-blue-700' },
  'Principal':       { bg: 'bg-indigo-100',  text: 'text-indigo-700' },
  'Interest':        { bg: 'bg-amber-100',   text: 'text-amber-700' },
  'Penalty':         { bg: 'bg-red-100',     text: 'text-red-700' },
};

// ── Mock payoff history generator (derived from loan data) ────────────────────
function generatePayoffHistory(loan: Loan): PayoffEvent[] {
  if (!loan.disbursementDate) return [];
  const events: PayoffEvent[] = [];
  const start = new Date(loan.disbursementDate);
  const amount = loan.facilityAmount;
  const outstanding = loan.outstandingBalance ?? amount;
  const paid = amount - outstanding;

  if (paid > 0) {
    // Generate representative payment events
    const numPayments = Math.min(Math.floor(paid / (amount / 12)) + 1, 8);
    for (let i = 0; i < numPayments; i++) {
      const payDate = new Date(start);
      payDate.setMonth(payDate.getMonth() + (i + 1));
      if (payDate > new Date()) break;
      const isLast = i === numPayments - 1 && outstanding <= 0;
      events.push({
        id: `${loan.id}-pay-${i}`,
        date: payDate.toISOString().split('T')[0],
        amount: isLast ? paid : Math.round(paid / numPayments),
        currency: loan.currency,
        type: isLast && outstanding <= 0 ? 'Full Settlement' : 'Partial Payment',
        reference: `PMT-${loan.loanNumber}-${String(i + 1).padStart(3, '0')}`,
        performedBy: 'System',
        notes: isLast && outstanding <= 0 ? 'Final settlement — loan closed' : undefined,
      });
    }
  }
  return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}

function mapLoanToSettlement(loan: Loan, collaterals: CollateralLink[]): LoanSettlementRecord {
  const outstanding = loan.outstandingBalance ?? loan.facilityAmount;
  const paid = loan.facilityAmount - outstanding;
  const pct = loan.facilityAmount > 0 ? Math.round((paid / loan.facilityAmount) * 100) : 0;

  let settlementStatus: LoanSettlementRecord['settlementStatus'] = 'Active';
  if (loan.loanStatus === 'Closed') settlementStatus = 'Settled';
  else if (loan.loanStatus === 'Defaulted') settlementStatus = 'Defaulted';
  else if (loan.loanStatus === 'Written Off') settlementStatus = 'Written Off';
  else if (loan.loanStatus === 'Restructured') settlementStatus = 'Restructured';

  const releasesPending = collaterals.filter(c => c.releaseStatus !== 'RELEASED' && c.releaseStatus !== 'Released').length;
  const releasesCompleted = collaterals.filter(c => c.releaseStatus === 'RELEASED' || c.releaseStatus === 'Released').length;

  return {
    loan,
    settlementStatus,
    settlementDate: loan.loanStatus === 'Closed' ? loan.maturityDate : null,
    expectedPayoffDate: loan.maturityDate,
    totalFacilityAmount: loan.facilityAmount,
    outstandingBalance: outstanding,
    payoffPercentage: pct,
    collaterals,
    payoffHistory: generatePayoffHistory(loan),
    releasesPending,
    releasesCompleted,
  };
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ProgressBar({ pct, status }: { pct: number; status: string }) {
  const color = status === 'Settled' ? 'bg-emerald-500' : status === 'Defaulted' ? 'bg-red-500' : 'bg-blue-500';
  return (
    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
      <div className={`h-2 rounded-full transition-all duration-500 ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function CollateralReleaseChip({ c }: { c: CollateralLink }) {
  const released = c.releaseStatus === 'RELEASED' || c.releaseStatus === 'Released';
  return (
    <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs ${released ? 'bg-emerald-50 border-emerald-200' : 'bg-slate-50 border-slate-200'}`}>
      <span className={`w-2 h-2 rounded-full flex-shrink-0 ${released ? 'bg-emerald-500' : 'bg-amber-400'}`} />
      <span className="font-medium text-slate-700 truncate max-w-[120px]" title={c.collateralRef}>{c.collateralRef}</span>
      <span className="text-slate-400">·</span>
      <span className={released ? 'text-emerald-700' : 'text-amber-700'}>{released ? 'Released' : 'Pending'}</span>
      {released && c.dischargeDate && (
        <span className="text-slate-400 ml-1">{fmtDate(c.dischargeDate)}</span>
      )}
    </div>
  );
}

function PayoffHistoryRow({ event }: { event: PayoffEvent }) {
  const cfg = payoffTypeConfig[event.type] ?? { bg: 'bg-slate-100', text: 'text-slate-600' };
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-slate-50 last:border-0">
      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
        <DollarSign className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.text}`}>{event.type}</span>
          <span className="text-xs text-slate-400">{event.reference}</span>
        </div>
        {event.notes && <p className="text-xs text-slate-500 mt-0.5 truncate">{event.notes}</p>}
      </div>
      <div className="text-right flex-shrink-0">
        <p className="text-sm font-semibold text-slate-800">{fmt(event.amount, event.currency)}</p>
        <p className="text-xs text-slate-400">{fmtDate(event.date)}</p>
      </div>
    </div>
  );
}

function LoanSettlementCard({ record }: { record: LoanSettlementRecord }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = settlementStatusConfig[record.settlementStatus] ?? settlementStatusConfig['Active'];
  const StatusIcon = cfg.icon;

  return (
    <div className={`bg-white rounded-xl border ${cfg.border} shadow-sm overflow-hidden`}>
      {/* Card Header */}
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <span className="text-base font-bold text-slate-800 font-['DM_Sans']">{record.loan.loanNumber}</span>
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${cfg.bg} ${cfg.text}`}>
                <StatusIcon className="w-3.5 h-3.5" />
                {cfg.label}
              </span>
            </div>
            <p className="text-sm text-slate-500 truncate">{record.loan.obligorName ?? 'Unknown Obligor'} · {record.loan.facilityType}</p>
          </div>
          <button
            onClick={() => setExpanded(v => !v)}
            className="flex-shrink-0 p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            aria-label={expanded ? 'Collapse' : 'Expand'}
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Facility Amount</p>
            <p className="text-sm font-semibold text-slate-700">{fmt(record.totalFacilityAmount, record.loan.currency)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Outstanding</p>
            <p className={`text-sm font-semibold ${record.outstandingBalance > 0 ? 'text-amber-700' : 'text-emerald-700'}`}>
              {record.outstandingBalance > 0 ? fmt(record.outstandingBalance, record.loan.currency) : 'Fully Paid'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Expected Payoff</p>
            <p className="text-sm font-semibold text-slate-700">{fmtDate(record.expectedPayoffDate)}</p>
          </div>
          <div>
            <p className="text-xs text-slate-400 mb-0.5">Settlement Date</p>
            <p className="text-sm font-semibold text-slate-700">{fmtDate(record.settlementDate)}</p>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs text-slate-500">Payoff Progress</span>
            <span className="text-xs font-bold text-slate-700">{record.payoffPercentage}%</span>
          </div>
          <ProgressBar pct={record.payoffPercentage} status={record.settlementStatus} />
        </div>

        {/* Collateral release summary */}
        {record.collaterals.length > 0 && (
          <div className="mt-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Collateral Releases</p>
              <span className="text-xs text-slate-400">{record.releasesCompleted}/{record.collaterals.length} released</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {record.collaterals.map(c => <CollateralReleaseChip key={c.id} c={c} />)}
            </div>
          </div>
        )}
      </div>

      {/* Expanded: Payoff History */}
      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/60 px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingDown className="w-4 h-4 text-slate-400" />
            <h4 className="text-sm font-semibold text-slate-700">Payoff History</h4>
            <span className="text-xs text-slate-400">({record.payoffHistory.length} events)</span>
          </div>
          {record.payoffHistory.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No payment events recorded yet.</p>
          ) : (
            <div className="bg-white rounded-lg border border-slate-100 px-4 divide-y divide-slate-50">
              {record.payoffHistory.map(ev => <PayoffHistoryRow key={ev.id} event={ev} />)}
            </div>
          )}

          {/* Collateral detail table */}
          {record.collaterals.length > 0 && (
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <Landmark className="w-4 h-4 text-slate-400" />
                <h4 className="text-sm font-semibold text-slate-700">Collateral Release Detail</h4>
              </div>
              <div className="bg-white rounded-lg border border-slate-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Collateral Ref</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Type</th>
                      <th className="text-right px-3 py-2.5 font-semibold text-slate-500">Allocated</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Release Status</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Discharge Date</th>
                      <th className="text-left px-3 py-2.5 font-semibold text-slate-500">Discharge No.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {record.collaterals.map(c => {
                      const released = c.releaseStatus === 'RELEASED' || c.releaseStatus === 'Released';
                      return (
                        <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50/50">
                          <td className="px-3 py-2.5 font-medium text-slate-700">{c.collateralRef}</td>
                          <td className="px-3 py-2.5 text-slate-500">{c.collateralType}</td>
                          <td className="px-3 py-2.5 text-right text-slate-700">{fmt(c.allocatedAmount)}</td>
                          <td className="px-3 py-2.5">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${released ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                              {released ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {released ? 'Released' : 'Pending'}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-slate-500">{fmtDate(c.dischargeDate)}</td>
                          <td className="px-3 py-2.5 text-slate-500">{c.dischargeNumber ?? '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function CollateralSettlementContent() {
  const { user } = useAuth();
  const [records, setRecords] = useState<LoanSettlementRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [releaseFilter, setReleaseFilter] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();
      const [loans, linksData] = await Promise.all([
        loanService.getAll(),
        supabase
          .from('collateral_loan_links')
          .select('id, collateral_id, loan_account_id, allocated_amount, release_status, discharge_date, discharge_number, collateral_records(collateral_id, type, description)')
          .order('created_at', { ascending: false }),
      ]);

      const linkRows = linksData.data ?? [];

      const settlementRecords: LoanSettlementRecord[] = loans.map(loan => {
        const loanLinks = linkRows.filter((l: any) => l.loan_account_id === loan.id);
        const collaterals: CollateralLink[] = loanLinks.map((l: any) => ({
          id: l.id,
          collateralId: l.collateral_id,
          collateralRef: l.collateral_records?.collateral_id ?? l.collateral_id?.slice(0, 8) ?? '—',
          collateralType: l.collateral_records?.type ?? 'Unknown',
          collateralDescription: l.collateral_records?.description ?? '',
          allocatedAmount: Number(l.allocated_amount) || 0,
          releaseStatus: l.release_status ?? 'PENDING',
          dischargeDate: l.discharge_date,
          dischargeNumber: l.discharge_number,
        }));
        return mapLoanToSettlement(loan, collaterals);
      });

      setRecords(settlementRecords);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load settlement data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      r.loan.loanNumber.toLowerCase().includes(q) ||
      (r.loan.obligorName ?? '').toLowerCase().includes(q) ||
      r.loan.facilityType.toLowerCase().includes(q);
    const matchStatus = !statusFilter || r.settlementStatus === statusFilter;
    const matchRelease = !releaseFilter ||
      (releaseFilter === 'pending' && r.releasesPending > 0) ||
      (releaseFilter === 'complete' && r.releasesPending === 0 && r.collaterals.length > 0);
    return matchSearch && matchStatus && matchRelease;
  });

  // Summary stats
  const totalLoans = records.length;
  const settledCount = records.filter(r => r.settlementStatus === 'Settled').length;
  const pendingReleases = records.reduce((s, r) => s + r.releasesPending, 0);
  const completedReleases = records.reduce((s, r) => s + r.releasesCompleted, 0);

  return (
    <div className="min-h-screen bg-slate-50 font-['DM_Sans']">
      {/* Page Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Collateral Settlement Status</h1>
              <p className="text-sm text-slate-500 mt-0.5">Post-lifecycle management — release dates, payoff history, and discharge tracking per loan</p>
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Summary KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-5">
            {[
              { label: 'Total Loans', value: totalLoans, icon: FileText, color: 'text-slate-700', bg: 'bg-slate-100' },
              { label: 'Settled Loans', value: settledCount, icon: CheckCircle2, color: 'text-emerald-700', bg: 'bg-emerald-100' },
              { label: 'Pending Releases', value: pendingReleases, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-100' },
              { label: 'Completed Releases', value: completedReleases, icon: BadgeCheck, color: 'text-blue-700', bg: 'bg-blue-100' },
            ].map(kpi => (
              <div key={kpi.label} className="bg-slate-50 rounded-xl border border-slate-200 px-4 py-3 flex items-center gap-3">
                <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center flex-shrink-0`}>
                  <kpi.icon className={`w-4.5 h-4.5 ${kpi.color}`} />
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-800">{loading ? '—' : kpi.value}</p>
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white border-b border-slate-100 px-6 py-3">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search loan, obligor…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 bg-slate-50"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="">All Statuses</option>
            <option value="Active">Active</option>
            <option value="Settled">Settled</option>
            <option value="Defaulted">Defaulted</option>
            <option value="Restructured">Restructured</option>
            <option value="Written Off">Written Off</option>
          </select>

          <select
            value={releaseFilter}
            onChange={e => setReleaseFilter(e.target.value)}
            className="text-sm border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400"
          >
            <option value="">All Release States</option>
            <option value="pending">Has Pending Releases</option>
            <option value="complete">All Releases Complete</option>
          </select>

          {(statusFilter || releaseFilter || search) && (
            <button
              onClick={() => { setSearch(''); setStatusFilter(''); setReleaseFilter(''); }}
              className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-700 px-2 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-3.5 h-3.5" /> Clear filters
            </button>
          )}

          <span className="ml-auto text-xs text-slate-400">{filtered.length} loan{filtered.length !== 1 ? 's' : ''}</span>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm text-slate-500">Loading settlement records…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <AlertTriangle className="w-8 h-8 text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={load} className="text-sm text-blue-600 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <FileText className="w-10 h-10 text-slate-300" />
            <p className="text-sm text-slate-500">No settlement records match your filters.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {filtered.map(record => (
              <LoanSettlementCard key={record.loan.id} record={record} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
