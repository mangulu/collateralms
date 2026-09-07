'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, Download, RefreshCw, CheckCircle2, AlertTriangle, TrendingDown, BarChart2, ShieldAlert, Flag, Loader2, Calendar, AlertCircle, Building2,  } from 'lucide-react';
import { boardReportService, type BoardReportData } from '@/lib/supabase/boardReportService';
import Icon from '@/components/ui/AppIcon';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(v: number): string {
  if (!v || isNaN(v)) return '—';
  if (v >= 1e9) return `TZS ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `TZS ${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `TZS ${(v / 1e3).toFixed(0)}K`;
  return `TZS ${v.toLocaleString()}`;
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || isNaN(v)) return '—';
  return `${v.toFixed(1)}%`;
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface SectionCardProps {
  icon: React.ElementType;
  title: string;
  subtitle: string;
  status: 'ready' | 'warning' | 'critical' | 'ok';
  children: React.ReactNode;
}

function SectionCard({ icon: Icon, title, subtitle, status, children }: SectionCardProps) {
  const statusStyles = {
    ready: 'border-l-[#007CB3] bg-white',
    ok: 'border-l-emerald-500 bg-white',
    warning: 'border-l-amber-500 bg-white',
    critical: 'border-l-red-600 bg-white',
  };
  const badgeStyles = {
    ready: 'bg-blue-50 text-[#007CB3]',
    ok: 'bg-emerald-50 text-emerald-700',
    warning: 'bg-amber-50 text-amber-700',
    critical: 'bg-red-50 text-red-700',
  };
  const badgeLabels = { ready: 'Ready', ok: 'No Issues', warning: 'Review', critical: 'Action Required' };

  return (
    <div className={`rounded-xl border border-gray-200 border-l-4 ${statusStyles[status]} shadow-sm overflow-hidden`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#0A2A4E]/8 flex items-center justify-center">
            <Icon className="w-5 h-5 text-[#0A2A4E]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0A2A4E]">{title}</p>
            <p className="text-xs text-gray-500">{subtitle}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${badgeStyles[status]}`}>
          {badgeLabels[status]}
        </span>
      </div>
      <div className="px-5 py-4">{children}</div>
    </div>
  );
}

interface KpiChipProps {
  label: string;
  value: string;
  variant?: 'default' | 'danger' | 'warning' | 'success';
}

function KpiChip({ label, value, variant = 'default' }: KpiChipProps) {
  const styles = {
    default: 'bg-gray-50 border-gray-200 text-gray-700',
    danger: 'bg-red-50 border-red-200 text-red-700',
    warning: 'bg-amber-50 border-amber-200 text-amber-700',
    success: 'bg-emerald-50 border-emerald-200 text-emerald-700',
  };
  return (
    <div className={`rounded-lg border px-3 py-2 ${styles[variant]}`}>
      <p className="text-[10px] font-medium text-gray-500 uppercase tracking-wide mb-0.5">{label}</p>
      <p className="text-sm font-bold">{value}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function BoardReportBuilderContent() {
  const [data, setData] = useState<BoardReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [lastGenerated, setLastGenerated] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await boardReportService.fetchReportData();
      setData(result);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleGeneratePdf = async () => {
    if (!data) return;
    setGenerating(true);
    try {
      const res = await fetch('/api/board-report/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `BOT-Board-Report-${data.reportPeriod.replace(/\s/g, '-')}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      setLastGenerated(new Date().toLocaleTimeString('en-GB'));
    } catch (e: any) {
      setError(e.message ?? 'PDF generation failed');
    } finally {
      setGenerating(false);
    }
  };

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-10 h-10 text-[#007CB3] animate-spin" />
        <p className="text-sm text-gray-500">Loading live portfolio data…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <AlertCircle className="w-10 h-10 text-red-500" />
        <p className="text-sm text-red-600">{error}</p>
        <button onClick={loadData} className="text-sm text-[#007CB3] underline">Retry</button>
      </div>
    );
  }

  if (!data) return null;

  const { nplAging, provisionReconciliation, stressTests, concentrationBreaches, valuationFlagSummary, portfolioStats } = data;
  const totalFlags = valuationFlagSummary.reduce((s, f) => s + f.count, 0);
  const criticalFlags = valuationFlagSummary.reduce((s, f) => s + f.critical, 0);

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-5 h-5 text-[#007CB3]" />
            <h1 className="text-xl font-bold text-[#0A2A4E]">Board Report Builder</h1>
          </div>
          <p className="text-sm text-gray-500">
            BOT-format PDF for board approval workflows · Period: <span className="font-semibold text-[#0A2A4E]">{data.reportPeriod}</span> · As of {fmtDate(data.reportDate)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleGeneratePdf}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#0A2A4E] rounded-lg hover:bg-[#0d3566] transition-colors disabled:opacity-60"
          >
            {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {generating ? 'Generating PDF…' : 'Generate BOT PDF'}
          </button>
        </div>
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-[#0A2A4E]/4 rounded-xl border border-[#0A2A4E]/10">
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
          <span>Live data loaded</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <Calendar className="w-3.5 h-3.5 text-[#007CB3]" />
          <span>Report period: {data.reportPeriod}</span>
        </div>
        <span className="text-gray-300">|</span>
        <div className="flex items-center gap-1.5 text-xs text-gray-600">
          <FileText className="w-3.5 h-3.5 text-[#007CB3]" />
          <span>5 sections · 6 pages</span>
        </div>
        {lastGenerated && (
          <>
            <span className="text-gray-300">|</span>
            <div className="flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Last generated: {lastGenerated}</span>
            </div>
          </>
        )}
      </div>

      {/* ── Portfolio KPIs ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KpiChip label="Total Collateral" value={String(portfolioStats.totalCollateral)} />
        <KpiChip label="Portfolio Value" value={fmtNum(portfolioStats.totalPortfolioValue)} />
        <KpiChip label="Loan Exposure" value={fmtNum(portfolioStats.totalLoanExposure)} />
        <KpiChip label="Portfolio LTV" value={fmtPct(portfolioStats.portfolioLTV)} variant={portfolioStats.portfolioLTV > 80 ? 'danger' : portfolioStats.portfolioLTV > 70 ? 'warning' : 'success'} />
        <KpiChip label="NPL Count" value={String(portfolioStats.nplCount)} variant={portfolioStats.nplCount > 0 ? 'danger' : 'success'} />
        <KpiChip label="Open Flags" value={String(totalFlags)} variant={totalFlags > 0 ? 'warning' : 'success'} />
      </div>

      {/* ── Section 1: NPL Aging ────────────────────────────────────────────── */}
      <SectionCard
        icon={TrendingDown}
        title="Section 1 — NPL Aging Schedule"
        subtitle="BOT loan classification tiers with provision coverage"
        status={nplAging.nplRatio > 5 ? 'critical' : nplAging.nplRatio > 2 ? 'warning' : 'ok'}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiChip label="NPL Balance" value={fmtNum(nplAging.totalNplBalance)} variant="danger" />
          <KpiChip label="NPL Ratio" value={fmtPct(nplAging.nplRatio)} variant={nplAging.nplRatio > 5 ? 'danger' : 'warning'} />
          <KpiChip label="Total Provision" value={fmtNum(nplAging.totalProvision)} variant="warning" />
          <KpiChip label="Coverage Ratio" value={fmtPct(nplAging.coverageRatio)} variant={nplAging.coverageRatio >= 100 ? 'success' : 'danger'} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0A2A4E] text-white">
                <th className="text-left px-3 py-2 rounded-tl-lg">Classification</th>
                <th className="text-center px-3 py-2">Count</th>
                <th className="text-right px-3 py-2">Outstanding Balance</th>
                <th className="text-center px-3 py-2">Provision Rate</th>
                <th className="text-right px-3 py-2 rounded-tr-lg">Required Provision</th>
              </tr>
            </thead>
            <tbody>
              {nplAging.buckets.map((b, i) => (
                <tr key={b.classification} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 font-medium text-gray-800">{b.classification}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{b.count}</td>
                  <td className="px-3 py-2 text-right text-gray-700">{fmtNum(b.outstandingBalance)}</td>
                  <td className="px-3 py-2 text-center text-gray-600">{fmtPct(b.provisionRate)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0A2A4E]">{fmtNum(b.provisionAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Section 2: Provision Reconciliation ────────────────────────────── */}
      <SectionCard
        icon={BarChart2}
        title="Section 2 — Provision Reconciliation"
        subtitle="Opening → closing provision movement by classification tier"
        status={provisionReconciliation.netMovement > 0 ? 'warning' : 'ok'}
      >
        <div className="grid grid-cols-3 gap-3 mb-4">
          <KpiChip label="Opening Provision" value={fmtNum(provisionReconciliation.totalOpening)} />
          <KpiChip label="Closing Provision" value={fmtNum(provisionReconciliation.totalClosing)} />
          <KpiChip label="Net Movement" value={fmtNum(provisionReconciliation.netMovement)} variant={provisionReconciliation.netMovement > 0 ? 'warning' : 'success'} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-[#0A2A4E] text-white">
                <th className="text-left px-3 py-2 rounded-tl-lg">Classification</th>
                <th className="text-right px-3 py-2">Opening</th>
                <th className="text-right px-3 py-2">New Provision</th>
                <th className="text-right px-3 py-2">Written Off</th>
                <th className="text-right px-3 py-2">Recoveries</th>
                <th className="text-right px-3 py-2 rounded-tr-lg">Closing</th>
              </tr>
            </thead>
            <tbody>
              {provisionReconciliation.rows.map((r, i) => (
                <tr key={r.classification} className={i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                  <td className="px-3 py-2 font-medium text-gray-800">{r.classification}</td>
                  <td className="px-3 py-2 text-right text-gray-600">{fmtNum(r.openingProvision)}</td>
                  <td className="px-3 py-2 text-right text-amber-700">{fmtNum(r.newProvision)}</td>
                  <td className="px-3 py-2 text-right text-red-600">{fmtNum(r.writtenOff)}</td>
                  <td className="px-3 py-2 text-right text-emerald-600">{fmtNum(r.recoveries)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-[#0A2A4E]">{fmtNum(r.closingProvision)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>

      {/* ── Section 3: Stress Test Results ─────────────────────────────────── */}
      <SectionCard
        icon={AlertTriangle}
        title="Section 3 — Stress Test Results"
        subtitle="Collateral value impact under 10%, 20%, 30% decline scenarios"
        status={stressTests.some(s => s.breachCount > 5) ? 'critical' : stressTests.some(s => s.breachCount > 0) ? 'warning' : 'ok'}
      >
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stressTests.map(s => (
            <div key={s.decline} className={`rounded-xl border p-4 ${s.stressedPortfolioLTV > 85 ? 'border-red-200 bg-red-50' : s.stressedPortfolioLTV > 75 ? 'border-amber-200 bg-amber-50' : 'border-emerald-200 bg-emerald-50'}`}>
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-bold text-gray-800">{s.label}</span>
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${s.breachCount > 0 ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {s.breachCount} breach{s.breachCount !== 1 ? 'es' : ''}
                </span>
              </div>
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-gray-500">Stressed Value</span>
                  <span className="font-semibold text-gray-800">{fmtNum(s.stressedPortfolioValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Value at Risk</span>
                  <span className="font-semibold text-red-700">{fmtNum(s.valueAtRisk)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Stressed LTV</span>
                  <span className={`font-bold ${s.stressedPortfolioLTV > 85 ? 'text-red-700' : s.stressedPortfolioLTV > 75 ? 'text-amber-700' : 'text-emerald-700'}`}>{fmtPct(s.stressedPortfolioLTV)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Breach Exposure</span>
                  <span className="font-semibold text-gray-700">{fmtNum(s.breachExposure)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── Section 4: Concentration Breach List ───────────────────────────── */}
      <SectionCard
        icon={ShieldAlert}
        title="Section 4 — Concentration Breach List"
        subtitle={`Single-obligor BOT limit: 25% of portfolio · ${concentrationBreaches.length} breach${concentrationBreaches.length !== 1 ? 'es' : ''} detected`}
        status={concentrationBreaches.some(b => b.severity === 'high') ? 'critical' : concentrationBreaches.length > 0 ? 'warning' : 'ok'}
      >
        {concentrationBreaches.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-emerald-700 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>No concentration breaches. All obligors within BOT single-obligor limit.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0A2A4E] text-white">
                  <th className="text-left px-3 py-2 rounded-tl-lg">Obligor</th>
                  <th className="text-left px-3 py-2">Collateral Type</th>
                  <th className="text-right px-3 py-2">Exposure</th>
                  <th className="text-center px-3 py-2">Portfolio Share</th>
                  <th className="text-center px-3 py-2">BOT Limit</th>
                  <th className="text-right px-3 py-2">Breach Amount</th>
                  <th className="text-center px-3 py-2 rounded-tr-lg">Severity</th>
                </tr>
              </thead>
              <tbody>
                {concentrationBreaches.map((b, i) => (
                  <tr key={b.id} className={i % 2 === 0 ? 'bg-red-50' : 'bg-white'}>
                    <td className="px-3 py-2 font-medium text-gray-800">{b.obligorName}</td>
                    <td className="px-3 py-2 text-gray-600">{b.collateralType}</td>
                    <td className="px-3 py-2 text-right text-gray-700">{fmtNum(b.exposureAmount)}</td>
                    <td className="px-3 py-2 text-center font-bold text-red-700">{fmtPct(b.portfolioShare)}</td>
                    <td className="px-3 py-2 text-center text-gray-500">{fmtPct(b.botLimit)}</td>
                    <td className="px-3 py-2 text-right text-red-700 font-semibold">{fmtNum(b.breachAmount)}</td>
                    <td className="px-3 py-2 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${b.severity === 'high' ? 'bg-red-100 text-red-700' : b.severity === 'medium' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>
                        {b.severity}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Section 5: Valuation Flag Summary ──────────────────────────────── */}
      <SectionCard
        icon={Flag}
        title="Section 5 — Valuation Flag Summary"
        subtitle="Pricing integrity alerts and overdue valuation flags"
        status={criticalFlags > 0 ? 'critical' : totalFlags > 0 ? 'warning' : 'ok'}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          <KpiChip label="Total Open Flags" value={String(totalFlags)} variant={totalFlags > 0 ? 'warning' : 'success'} />
          <KpiChip label="Critical" value={String(criticalFlags)} variant={criticalFlags > 0 ? 'danger' : 'success'} />
          <KpiChip label="High Severity" value={String(valuationFlagSummary.reduce((s, f) => s + f.high, 0))} variant="warning" />
          <KpiChip label="Flag Types Active" value={String(valuationFlagSummary.length)} />
        </div>
        {valuationFlagSummary.length === 0 ? (
          <div className="flex items-center gap-2 py-3 text-emerald-700 text-sm">
            <CheckCircle2 className="w-4 h-4" />
            <span>No open valuation flags. All collateral valuations are current and market-priced.</span>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#0A2A4E] text-white">
                  <th className="text-left px-3 py-2 rounded-tl-lg">Flag Type</th>
                  <th className="text-center px-3 py-2">Total</th>
                  <th className="text-center px-3 py-2">Critical</th>
                  <th className="text-center px-3 py-2">High</th>
                  <th className="text-center px-3 py-2">Medium</th>
                  <th className="text-center px-3 py-2 rounded-tr-lg">Low</th>
                </tr>
              </thead>
              <tbody>
                {valuationFlagSummary.map((f, i) => {
                  const labels: Record<string, string> = {
                    overdue_valuation: 'Overdue Valuation',
                    market_unavailable: 'Market Unavailable',
                    theoretical_pricing_required: 'Theoretical Pricing Required',
                    stale_valuation: 'Stale Valuation',
                    no_market_data: 'No Market Data',
                  };
                  return (
                    <tr key={f.flagType} className={i % 2 === 0 ? 'bg-amber-50' : 'bg-white'}>
                      <td className="px-3 py-2 font-medium text-gray-800">{labels[f.flagType] ?? f.flagType.replace(/_/g, ' ')}</td>
                      <td className="px-3 py-2 text-center font-bold text-gray-800">{f.count}</td>
                      <td className="px-3 py-2 text-center font-semibold text-red-700">{f.critical}</td>
                      <td className="px-3 py-2 text-center text-amber-700">{f.high}</td>
                      <td className="px-3 py-2 text-center text-gray-600">{f.medium}</td>
                      <td className="px-3 py-2 text-center text-gray-500">{f.low}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ── Generate CTA ────────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#0A2A4E]/20 bg-[#0A2A4E] p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <p className="text-white font-bold text-base mb-1">Ready to generate board report</p>
          <p className="text-blue-200 text-sm">6-page BOT-format PDF · NPL Aging · Provision Reconciliation · Stress Tests · Concentration Breaches · Valuation Flags · Board Approval Block</p>
        </div>
        <button
          onClick={handleGeneratePdf}
          disabled={generating}
          className="flex items-center gap-2 px-6 py-3 text-sm font-bold text-[#0A2A4E] bg-white rounded-xl hover:bg-blue-50 transition-colors disabled:opacity-60 whitespace-nowrap"
        >
          {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
          {generating ? 'Generating…' : 'Download BOT PDF'}
        </button>
      </div>

    </div>
  );
}
