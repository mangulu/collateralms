'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loan } from '@/lib/supabase/loanService';
import { Building2, CreditCard, TrendingUp, Percent, RefreshCw, Scale, ArrowLeftRight, ExternalLink, Loader2, AlertCircle, ChevronRight } from 'lucide-react';

interface ObligorSummary {
  id: string;
  full_name: string;
  obligor_code: string;
  entity_type: string | null;
  risk_rating: string | null;
  total_loans: number;
  total_facility: number;
  total_outstanding: number;
  active_loans: number;
  collateral_count: number;
}

interface Props {
  loan: Loan;
}

function formatTsh(val: number | null | undefined): string {
  if (val == null || val === 0) return '—';
  if (val >= 1e9) return `TSh ${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `TSh ${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `TSh ${(val / 1e3).toFixed(0)}K`;
  return `TSh ${val.toFixed(0)}`;
}

const riskColors: Record<string, string> = {
  Low: 'text-green-700 bg-green-50 border-green-200',
  Medium: 'text-amber-700 bg-amber-50 border-amber-200',
  High: 'text-red-700 bg-red-50 border-red-200',
  Critical: 'text-rose-700 bg-rose-50 border-rose-200',
};

export default function FacilityObligorSummary({ loan }: Props) {
  const [summary, setSummary] = useState<ObligorSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        // Fetch obligor profile
        const { data: obligor, error: oErr } = await supabase
          .from('obligors')
          .select('id, full_name, obligor_code, entity_type, risk_rating')
          .eq('id', loan.obligorId)
          .maybeSingle();
        if (oErr || !obligor) {
          if (!cancelled) setError(oErr?.message ?? 'Obligor not found');
          return;
        }
        // Fetch all loans for this obligor
        const { data: loans } = await supabase
          .from('loans')
          .select('id, facility_amount, outstanding_balance, loan_status')
          .eq('obligor_id', loan.obligorId);
        // Fetch collateral count
        const { count: colCount } = await supabase
          .from('collateral_records')
          .select('*', { count: 'exact', head: true })
          .eq('obligor_ref_id', loan.obligorId);

        const loanList = loans ?? [];
        const totalFacility = loanList.reduce((s, l) => s + (parseFloat(l.facility_amount) || 0), 0);
        const totalOutstanding = loanList.reduce((s, l) => s + (parseFloat(l.outstanding_balance) || 0), 0);
        const activeLoans = loanList.filter((l) => l.loan_status === 'Active').length;

        if (!cancelled) {
          setSummary({
            ...obligor,
            total_loans: loanList.length,
            total_facility: totalFacility,
            total_outstanding: totalOutstanding,
            active_loans: activeLoans,
            collateral_count: colCount ?? 0,
          });
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load summary');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [loan.obligorId]);

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-sm p-6 flex items-center justify-center gap-2 text-muted-foreground">
        <Loader2 size={15} className="animate-spin" />
        <span className="text-xs">Loading summary…</span>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-2 text-xs text-red-600">
        <AlertCircle size={13} /> {error ?? 'Could not load obligor summary'}
      </div>
    );
  }

  const utilPct = summary.total_facility > 0
    ? Math.min(100, (summary.total_outstanding / summary.total_facility) * 100)
    : 0;

  const riskClass = riskColors[summary.risk_rating ?? ''] ?? 'text-slate-600 bg-slate-50 border-slate-200';

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Obligor Header */}
      <div className="px-4 py-3 border-b border-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Building2 size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-700 text-foreground leading-tight">{summary.full_name}</p>
              <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{summary.obligor_code}</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            {summary.risk_rating && (
              <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded border ${riskClass}`}>
                {summary.risk_rating} Risk
              </span>
            )}
            <Link
              href={`/obligors/${summary.id}`}
              className="p-1 rounded hover:bg-primary/10 text-primary transition-colors"
              title="View obligor profile"
            >
              <ExternalLink size={12} />
            </Link>
          </div>
        </div>
        {(summary.entity_type) && (
          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {summary.entity_type && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{summary.entity_type}</span>
            )}
          </div>
        )}
      </div>

      {/* Relationship KPIs */}
      <div className="p-3 grid grid-cols-2 gap-2">
        {[
          { label: 'Total Loans', value: summary.total_loans, sub: `${summary.active_loans} active`, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Collaterals', value: summary.collateral_count, sub: 'pledged assets', icon: Scale, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Total Facility', value: formatTsh(summary.total_facility), sub: 'across all loans', icon: TrendingUp, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Outstanding', value: formatTsh(summary.total_outstanding), sub: `${utilPct.toFixed(0)}% utilised`, icon: Percent, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`flex items-center gap-2 p-2.5 rounded-lg ${kpi.bg}`}>
            <kpi.icon size={14} className={kpi.color} />
            <div className="min-w-0">
              <p className="text-[10px] text-muted-foreground leading-tight">{kpi.label}</p>
              <p className={`text-sm font-700 ${kpi.color} leading-tight`}>{kpi.value}</p>
              <p className="text-[9px] text-muted-foreground">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Utilisation bar */}
      {utilPct > 0 && (
        <div className="px-3 pb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] text-muted-foreground">Portfolio Utilisation</span>
            <span className="text-[10px] font-600 text-foreground">{utilPct.toFixed(1)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${utilPct}%`,
                background: utilPct >= 90 ? '#dc2626' : utilPct >= 70 ? '#d97706' : '#2563eb',
              }}
            />
          </div>
        </div>
      )}

      {/* This Facility */}
      <div className="px-3 pb-3 border-t border-border pt-3">
        <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide mb-2">This Facility</p>
        <div className="space-y-1.5">
          {[
            { label: 'Facility Type', value: loan.facilityType },
            { label: 'Amount', value: formatTsh(loan.facilityAmount) },
            { label: 'Outstanding', value: formatTsh(loan.outstandingBalance) },
            { label: 'Rate', value: loan.interestRate != null ? `${loan.interestRate}% p.a.` : '—' },
            { label: 'Repayment', value: loan.repaymentFrequency },
            { label: 'Maturity', value: loan.maturityDate ? new Date(loan.maturityDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—' },
          ].map((row) => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-[10px] text-muted-foreground">{row.label}</span>
              <span className="text-[10px] font-600 text-foreground">{row.value}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Quick links */}
      <div className="px-3 pb-3 border-t border-border pt-3">
        <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide mb-2">Quick Actions</p>
        <div className="space-y-1">
          {[
            { label: 'All Loans for Obligor', href: `/loans?facility=${encodeURIComponent(summary.obligor_code)}`, icon: CreditCard },
            { label: 'Valuation Workflow', href: `/valuation-workflow?loanId=${loan.id}`, icon: RefreshCw },
            { label: 'Covenant Tracking', href: `/covenant-tracking?loanId=${loan.id}`, icon: Scale },
            { label: 'Collateral Substitution', href: `/collateral-substitution?loanId=${loan.id}`, icon: ArrowLeftRight },
          ].map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors group"
            >
              <action.icon size={11} className="text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors flex-1">{action.label}</span>
              <ChevronRight size={10} className="text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
