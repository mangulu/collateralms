'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { TrendingUp, Shield, AlertTriangle, Download, FileText, FileSpreadsheet, RefreshCw, CheckCircle2, Calendar, BarChart2, Clock,  } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type ReportType = 'monthly_perfection' | 'registry_compliance' | 'overdue_summary';
type ExportFormat = 'pdf' | 'csv';

interface CollateralRow {
  id: string;
  status: string;
  registry: string;
  collateral_type: string;
  value_tsh: string;
  perfection_deadline: string | null;
  created_at: string;
  obligor: string;
  assigned_officer: string | null;
}

interface MonthlyTrendPoint {
  month: string;
  total: number;
  perfected: number;
  submitted: number;
  overdue: number;
  perfectionRate: number;
}

interface RegistryComplianceRow {
  registry: string;
  total: number;
  perfected: number;
  submitted: number;
  overdue: number;
  complianceRate: number;
  status: 'Compliant' | 'At Risk' | 'Non-Compliant';
}

interface OverdueRow {
  id: string;
  obligor: string;
  collateralType: string;
  registry: string;
  valueTsh: string;
  deadline: string;
  daysOverdue: number;
  officer: string;
}

interface ReportData {
  monthlyTrend: MonthlyTrendPoint[];
  registryCompliance: RegistryComplianceRow[];
  overdueSummary: OverdueRow[];
  generatedAt: string;
  dateFrom: string;
  dateTo: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_DEFS: {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  bg: string;
  border: string;
}[] = [
  {
    id: 'monthly_perfection',
    label: 'Monthly Perfection Trends',
    description: 'Month-by-month breakdown of perfected, submitted, and overdue collateral with perfection rate vs 80% target',
    icon: TrendingUp,
    accent: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    id: 'registry_compliance',
    label: 'Registry Submission Compliance',
    description: 'Per-registry compliance scores for BRELA, Lands Registry, TRA, and others with regulatory gap analysis',
    icon: Shield,
    accent: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
  },
  {
    id: 'overdue_summary',
    label: 'Overdue Summary',
    description: 'All overdue collateral items with days overdue, obligor details, assigned officer, and portfolio value at risk',
    icon: AlertTriangle,
    accent: 'text-red-700',
    bg: 'bg-red-50',
    border: 'border-red-200',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function formatTSh(val: string | number): string {
  const n = typeof val === 'string' ? parseInt(val.replace(/,/g, ''), 10) : val;
  return isNaN(n) ? String(val) : n.toLocaleString('en-US');
}

function downloadBlob(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildReportData(rows: CollateralRow[], dateFrom: string, dateTo: string): ReportData {
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const filtered = rows.filter((r) => {
    const d = new Date(r.created_at);
    return d >= from && d <= to;
  });

  // Monthly perfection trend
  const monthMap: Record<string, { total: number; perfected: number; submitted: number; overdue: number }> = {};
  filtered.forEach((r) => {
    const month = r.created_at.slice(0, 7);
    if (!monthMap[month]) monthMap[month] = { total: 0, perfected: 0, submitted: 0, overdue: 0 };
    monthMap[month].total++;
    if (r.status === 'Perfected') monthMap[month].perfected++;
    else if (r.status === 'Overdue') monthMap[month].overdue++;
    else monthMap[month].submitted++;
  });
  const monthlyTrend: MonthlyTrendPoint[] = Object.entries(monthMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, d]) => ({
      month,
      ...d,
      perfectionRate: d.total > 0 ? parseFloat(((d.perfected / d.total) * 100).toFixed(1)) : 0,
    }));

  // Registry compliance
  const regMap: Record<string, { total: number; perfected: number; submitted: number; overdue: number }> = {};
  filtered.forEach((r) => {
    const reg = r.registry || 'Unknown';
    if (!regMap[reg]) regMap[reg] = { total: 0, perfected: 0, submitted: 0, overdue: 0 };
    regMap[reg].total++;
    if (r.status === 'Perfected') regMap[reg].perfected++;
    else if (r.status === 'Overdue') regMap[reg].overdue++;
    else regMap[reg].submitted++;
  });
  const registryCompliance: RegistryComplianceRow[] = Object.entries(regMap).map(([registry, d]) => {
    const rate = d.total > 0 ? parseFloat(((d.perfected / d.total) * 100).toFixed(1)) : 0;
    return {
      registry,
      ...d,
      complianceRate: rate,
      status: rate >= 80 ? 'Compliant' : rate >= 60 ? 'At Risk' : 'Non-Compliant',
    };
  }).sort((a, b) => b.total - a.total);

  // Overdue summary — use all records (not date-filtered) for overdue
  const now = new Date();
  const overdueSummary: OverdueRow[] = rows
    .filter((r) => r.status === 'Overdue')
    .map((r) => {
      const deadline = r.perfection_deadline ? new Date(r.perfection_deadline) : null;
      const daysOverdue = deadline ? Math.max(0, Math.floor((now.getTime() - deadline.getTime()) / 86400000)) : 0;
      return {
        id: r.id,
        obligor: r.obligor,
        collateralType: r.collateral_type,
        registry: r.registry,
        valueTsh: r.value_tsh,
        deadline: r.perfection_deadline ?? 'N/A',
        daysOverdue,
        officer: r.assigned_officer ?? 'Unassigned',
      };
    })
    .sort((a, b) => b.daysOverdue - a.daysOverdue);

  return { monthlyTrend, registryCompliance, overdueSummary, generatedAt: new Date().toISOString(), dateFrom, dateTo };
}

// ─── CSV Generators ───────────────────────────────────────────────────────────

function buildCSV(type: ReportType, data: ReportData): string {
  const lines: string[] = [];
  const header = `CollateralMS — Collateral Performance Report\nReport: ${REPORT_DEFS.find(r => r.id === type)!.label}\nPeriod: ${data.dateFrom} to ${data.dateTo}\nGenerated: ${new Date(data.generatedAt).toLocaleString('en-GB')}\n`;

  if (type === 'monthly_perfection') {
    lines.push(header);
    lines.push('Month,Total,Perfected,Submitted,Overdue,Perfection Rate (%),vs 80% Target');
    data.monthlyTrend.forEach((r) => {
      const vs = r.perfectionRate >= 80 ? `+${(r.perfectionRate - 80).toFixed(1)}%` : `${(r.perfectionRate - 80).toFixed(1)}%`;
      lines.push(`${r.month},${r.total},${r.perfected},${r.submitted},${r.overdue},${r.perfectionRate}%,${vs}`);
    });
  } else if (type === 'registry_compliance') {
    lines.push(header);
    lines.push('Registry,Total,Perfected,Submitted,Overdue,Compliance Rate (%),Status');
    data.registryCompliance.forEach((r) => {
      lines.push(`${r.registry},${r.total},${r.perfected},${r.submitted},${r.overdue},${r.complianceRate}%,${r.status}`);
    });
  } else {
    lines.push(header);
    lines.push('Obligor,Collateral Type,Registry,Value (TSh),Deadline,Days Overdue,Assigned Officer');
    data.overdueSummary.forEach((r) => {
      lines.push(`"${r.obligor}","${r.collateralType}",${r.registry},"${formatTSh(r.valueTsh)}",${r.deadline},${r.daysOverdue},"${r.officer}"`);
    });
  }
  return lines.join('\n');
}

// ─── PDF via existing API route ───────────────────────────────────────────────

async function exportPDF(type: ReportType, dateFrom: string, dateTo: string): Promise<Blob> {
  const reportTypeMap: Record<ReportType, string> = {
    monthly_perfection: 'trend_analysis',
    registry_compliance: 'compliance_metrics',
    overdue_summary: 'performance_summary',
  };
  const res = await fetch('/api/performance-export/pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reportType: reportTypeMap[type],
      dateFrom,
      dateTo,
      registries: [],
      includeSummary: true,
      includeCharts: true,
      includeBreakdown: true,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.blob();
}

// ─── Preview Tables ───────────────────────────────────────────────────────────

function MonthlyTrendTable({ data }: { data: MonthlyTrendPoint[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">No data for selected period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Month</th>
            <th className="text-right py-2 px-3 font-600 text-muted-foreground">Total</th>
            <th className="text-right py-2 px-3 font-600 text-emerald-700">Perfected</th>
            <th className="text-right py-2 px-3 font-600 text-blue-700">Submitted</th>
            <th className="text-right py-2 px-3 font-600 text-red-700">Overdue</th>
            <th className="text-right py-2 px-3 font-600 text-muted-foreground">Rate</th>
            <th className="text-right py-2 px-3 font-600 text-muted-foreground">vs Target</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => {
            const vs = r.perfectionRate - 80;
            return (
              <tr key={r.month} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                <td className="py-2 px-3 font-500 text-foreground">{r.month}</td>
                <td className="py-2 px-3 text-right tabular-nums">{r.total}</td>
                <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-500">{r.perfected}</td>
                <td className="py-2 px-3 text-right tabular-nums text-blue-700">{r.submitted}</td>
                <td className="py-2 px-3 text-right tabular-nums text-red-700">{r.overdue}</td>
                <td className="py-2 px-3 text-right tabular-nums">
                  <span className={`font-600 ${r.perfectionRate >= 80 ? 'text-emerald-700' : r.perfectionRate >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                    {r.perfectionRate}%
                  </span>
                </td>
                <td className="py-2 px-3 text-right tabular-nums">
                  <span className={vs >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                    {vs >= 0 ? '+' : ''}{vs.toFixed(1)}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function RegistryComplianceTable({ data }: { data: RegistryComplianceRow[] }) {
  if (data.length === 0) return <p className="text-sm text-muted-foreground py-4 text-center">No data for selected period.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Registry</th>
            <th className="text-right py-2 px-3 font-600 text-muted-foreground">Total</th>
            <th className="text-right py-2 px-3 font-600 text-emerald-700">Perfected</th>
            <th className="text-right py-2 px-3 font-600 text-blue-700">Submitted</th>
            <th className="text-right py-2 px-3 font-600 text-red-700">Overdue</th>
            <th className="text-right py-2 px-3 font-600 text-muted-foreground">Compliance</th>
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.registry} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
              <td className="py-2 px-3 font-500 text-foreground">{r.registry}</td>
              <td className="py-2 px-3 text-right tabular-nums">{r.total}</td>
              <td className="py-2 px-3 text-right tabular-nums text-emerald-700 font-500">{r.perfected}</td>
              <td className="py-2 px-3 text-right tabular-nums text-blue-700">{r.submitted}</td>
              <td className="py-2 px-3 text-right tabular-nums text-red-700">{r.overdue}</td>
              <td className="py-2 px-3 text-right tabular-nums">
                <div className="flex items-center justify-end gap-2">
                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full ${r.complianceRate >= 80 ? 'bg-emerald-500' : r.complianceRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
                      style={{ width: `${Math.min(r.complianceRate, 100)}%` }}
                    />
                  </div>
                  <span className={`font-600 ${r.complianceRate >= 80 ? 'text-emerald-700' : r.complianceRate >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                    {r.complianceRate}%
                  </span>
                </div>
              </td>
              <td className="py-2 px-3">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-500 ${
                  r.status === 'Compliant' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : r.status === 'At Risk'? 'bg-amber-50 text-amber-700 border border-amber-200' :'bg-red-50 text-red-700 border border-red-200'
                }`}>
                  {r.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function OverdueSummaryTable({ data }: { data: OverdueRow[] }) {
  if (data.length === 0) return (
    <div className="flex flex-col items-center justify-center py-8 gap-2">
      <CheckCircle2 size={28} className="text-emerald-500" />
      <p className="text-sm font-500 text-emerald-700">No overdue collateral items</p>
    </div>
  );
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Obligor</th>
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Type</th>
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Registry</th>
            <th className="text-right py-2 px-3 font-600 text-muted-foreground">Value (TSh)</th>
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Deadline</th>
            <th className="text-right py-2 px-3 font-600 text-red-700">Days Overdue</th>
            <th className="text-left py-2 px-3 font-600 text-muted-foreground">Officer</th>
          </tr>
        </thead>
        <tbody>
          {data.map((r) => (
            <tr key={r.id} className="border-b border-border/50 hover:bg-red-50/30 transition-colors">
              <td className="py-2 px-3 font-500 text-foreground max-w-[140px] truncate">{r.obligor}</td>
              <td className="py-2 px-3 text-muted-foreground">{r.collateralType}</td>
              <td className="py-2 px-3 text-muted-foreground">{r.registry}</td>
              <td className="py-2 px-3 text-right tabular-nums font-500">{formatTSh(r.valueTsh)}</td>
              <td className="py-2 px-3 text-muted-foreground">{r.deadline}</td>
              <td className="py-2 px-3 text-right tabular-nums">
                <span className={`font-700 ${r.daysOverdue > 30 ? 'text-red-700' : r.daysOverdue > 7 ? 'text-amber-700' : 'text-orange-600'}`}>
                  {r.daysOverdue}d
                </span>
              </td>
              <td className="py-2 px-3 text-muted-foreground">{r.officer}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollateralReportsContent() {
  const [dateFrom, setDateFrom] = useState(nMonthsAgo(6));
  const [dateTo, setDateTo] = useState(today());
  const [activeReport, setActiveReport] = useState<ReportType>('monthly_perfection');
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState<ExportFormat | null>(null);
  const [exportSuccess, setExportSuccess] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setExportSuccess(null);
    setExportError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('collateral_records')
        .select('id, status, registry, collateral_type, value_tsh, perfection_deadline, created_at, obligor, assigned_officer');
      if (error) throw error;
      const rows = (data ?? []) as CollateralRow[];
      setReportData(buildReportData(rows, dateFrom, dateTo));
    } catch {
      setReportData(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleExport = useCallback(async (format: ExportFormat) => {
    if (!reportData) return;
    setExporting(format);
    setExportSuccess(null);
    setExportError(null);
    const slug = activeReport.replace(/_/g, '-');
    const date = today().replace(/-/g, '');
    const filename = `${slug}_${date}.${format}`;
    try {
      if (format === 'csv') {
        const csv = buildCSV(activeReport, reportData);
        downloadBlob(csv, filename, 'text/csv');
        setExportSuccess(filename);
      } else {
        const blob = await exportPDF(activeReport, dateFrom, dateTo);
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename.replace('.pdf', '') + '.pdf';
        a.click();
        URL.revokeObjectURL(url);
        setExportSuccess(filename.replace('.pdf', '') + '.pdf');
      }
    } catch (err: any) {
      setExportError(err.message ?? 'Export failed. Please try again.');
    } finally {
      setExporting(null);
    }
  }, [reportData, activeReport, dateFrom, dateTo]);

  const activeReportDef = REPORT_DEFS.find((r) => r.id === activeReport)!;

  // Summary stats
  const summaryStats = reportData ? {
    totalMonths: reportData.monthlyTrend.length,
    avgPerfectionRate: reportData.monthlyTrend.length > 0
      ? (reportData.monthlyTrend.reduce((s, r) => s + r.perfectionRate, 0) / reportData.monthlyTrend.length).toFixed(1)
      : '0.0',
    compliantRegistries: reportData.registryCompliance.filter((r) => r.status === 'Compliant').length,
    totalRegistries: reportData.registryCompliance.length,
    overdueCount: reportData.overdueSummary.length,
    overdueValue: reportData.overdueSummary.reduce((s, r) => s + parseInt((r.valueTsh ?? '0').replace(/,/g, ''), 10), 0),
  } : null;

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-6 py-4 border-b border-border bg-white shrink-0 gap-3">
        <div>
          <h1 className="text-lg font-700 text-foreground">Collateral Performance Reports</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Monthly perfection trends, registry compliance, and overdue summary
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => handleExport('csv')}
            disabled={loading || !reportData || exporting !== null}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-border text-sm text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
          >
            {exporting === 'csv' ? <RefreshCw size={14} className="animate-spin" /> : <FileSpreadsheet size={14} />}
            CSV
          </button>
          <button
            onClick={() => handleExport('pdf')}
            disabled={loading || !reportData || exporting !== null}
            className="flex items-center gap-2 px-3 sm:px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {exporting === 'pdf' ? <RefreshCw size={14} className="animate-spin" /> : <FileText size={14} />}
            Export PDF
          </button>
        </div>
      </div>

      {/* Banners */}
      {exportSuccess && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span className="truncate"><span className="font-600">{exportSuccess}</span> downloaded successfully.</span>
          <button onClick={() => setExportSuccess(null)} className="ml-auto text-emerald-600 hover:text-emerald-800 shrink-0">✕</button>
        </div>
      )}
      {exportError && (
        <div className="mx-4 sm:mx-6 mt-3 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span className="flex-1 min-w-0">{exportError}</span>
          <button onClick={() => setExportError(null)} className="ml-auto text-red-600 hover:text-red-800 shrink-0">✕</button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 sm:py-5 space-y-4 sm:space-y-5">
        {/* Date Range + Summary KPIs */}
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Date filters */}
          <div className="bg-white rounded-xl border border-border p-3 sm:p-4 flex flex-wrap items-center gap-3">
            <Calendar size={16} className="text-muted-foreground shrink-0" />
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
              <input
                type="date"
                value={dateFrom}
                max={dateTo}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
              <input
                type="date"
                value={dateTo}
                min={dateFrom}
                max={today()}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-border rounded-lg px-2 py-1.5 text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* KPI summary */}
          {loading ? (
            <div className="grid grid-cols-3 gap-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-muted animate-pulse rounded-xl" />)}
            </div>
          ) : summaryStats && (
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              <div className="bg-white rounded-xl border border-border p-2.5 sm:p-3">
                <p className="text-xs text-muted-foreground mb-0.5 leading-tight">Avg Perfection</p>
                <p className={`text-lg sm:text-xl font-700 tabular-nums ${parseFloat(summaryStats.avgPerfectionRate) >= 80 ? 'text-emerald-700' : parseFloat(summaryStats.avgPerfectionRate) >= 60 ? 'text-amber-700' : 'text-red-700'}`}>
                  {summaryStats.avgPerfectionRate}%
                </p>
              </div>
              <div className="bg-white rounded-xl border border-border p-2.5 sm:p-3">
                <p className="text-xs text-muted-foreground mb-0.5 leading-tight">Compliant</p>
                <p className="text-lg sm:text-xl font-700 tabular-nums text-foreground">
                  {summaryStats.compliantRegistries}<span className="text-xs sm:text-sm font-400 text-muted-foreground">/{summaryStats.totalRegistries}</span>
                </p>
              </div>
              <div className={`rounded-xl border p-2.5 sm:p-3 ${summaryStats.overdueCount > 0 ? 'bg-red-50 border-red-200' : 'bg-white border-border'}`}>
                <p className={`text-xs mb-0.5 leading-tight ${summaryStats.overdueCount > 0 ? 'text-red-700' : 'text-muted-foreground'}`}>Overdue</p>
                <p className={`text-lg sm:text-xl font-700 tabular-nums ${summaryStats.overdueCount > 0 ? 'text-red-700' : 'text-foreground'}`}>
                  {summaryStats.overdueCount}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Report Type Selector */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {REPORT_DEFS.map((def) => {
            const Icon = def.icon;
            const isActive = activeReport === def.id;
            return (
              <button
                key={def.id}
                onClick={() => setActiveReport(def.id)}
                className={`text-left p-3 sm:p-4 rounded-xl border-2 transition-all ${
                  isActive
                    ? `${def.bg} ${def.border} shadow-sm`
                    : 'bg-white border-border hover:border-primary/30 hover:bg-muted/20'
                }`}
              >
                <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center mb-2 ${isActive ? def.bg : 'bg-muted'}`}>
                  <Icon size={15} className={isActive ? def.accent : 'text-muted-foreground'} />
                </div>
                <p className={`text-xs sm:text-sm font-600 mb-1 ${isActive ? def.accent : 'text-foreground'}`}>{def.label}</p>
                <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2 hidden sm:block">{def.description}</p>
              </button>
            );
          })}
        </div>

        {/* Report Preview Panel */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {/* Panel header */}
          <div className={`flex flex-col sm:flex-row sm:items-center justify-between px-4 sm:px-5 py-3 sm:py-3.5 border-b border-border gap-2 ${activeReportDef.bg}`}>
            <div className="flex items-center gap-2.5 min-w-0">
              <activeReportDef.icon size={16} className={activeReportDef.accent} />
              <span className={`text-sm font-600 truncate ${activeReportDef.accent}`}>{activeReportDef.label}</span>
              {reportData && (
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  — {dateFrom} to {dateTo}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {reportData && (
                <span className="text-xs text-muted-foreground flex items-center gap-1 hidden sm:flex">
                  <Clock size={11} />
                  {new Date(reportData.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button
                onClick={() => handleExport('csv')}
                disabled={loading || !reportData || exporting !== null}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md border border-border bg-white text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
              >
                <FileSpreadsheet size={11} />
                CSV
              </button>
              <button
                onClick={() => handleExport('pdf')}
                disabled={loading || !reportData || exporting !== null}
                className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-primary text-white text-xs font-500 hover:bg-primary/90 transition-colors disabled:opacity-50"
              >
                {exporting === 'pdf' ? <RefreshCw size={11} className="animate-spin" /> : <FileText size={11} />}
                PDF
              </button>
            </div>
          </div>

          {/* Table content */}
          <div className="p-1">
            {loading ? (
              <div className="space-y-2 p-4">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-8 bg-muted animate-pulse rounded" />
                ))}
              </div>
            ) : !reportData ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <BarChart2 size={32} className="text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">Failed to load report data. Try refreshing.</p>
              </div>
            ) : activeReport === 'monthly_perfection' ? (
              <MonthlyTrendTable data={reportData.monthlyTrend} />
            ) : activeReport === 'registry_compliance' ? (
              <RegistryComplianceTable data={reportData.registryCompliance} />
            ) : (
              <OverdueSummaryTable data={reportData.overdueSummary} />
            )}
          </div>

          {/* Panel footer */}
          {reportData && !loading && (
            <div className="px-4 sm:px-5 py-3 border-t border-border bg-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                {activeReport === 'monthly_perfection' && `${reportData.monthlyTrend.length} months of data`}
                {activeReport === 'registry_compliance' && `${reportData.registryCompliance.length} registries tracked`}
                {activeReport === 'overdue_summary' && `${reportData.overdueSummary.length} overdue items · TSh ${formatTSh(summaryStats?.overdueValue ?? 0)} at risk`}
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleExport('csv')}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border bg-white text-xs text-foreground hover:border-primary/40 transition-colors disabled:opacity-50"
                >
                  <FileSpreadsheet size={12} />
                  Download CSV
                </button>
                <button
                  onClick={() => handleExport('pdf')}
                  disabled={exporting !== null}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-white text-xs font-600 hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {exporting === 'pdf' ? <RefreshCw size={12} className="animate-spin" /> : <Download size={12} />}
                  Download PDF
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
