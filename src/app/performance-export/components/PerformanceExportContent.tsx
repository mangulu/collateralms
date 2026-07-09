'use client';
import React, { useState, useCallback, useEffect } from 'react';
import {
  Download, FileText, TrendingUp, Shield, BarChart2, Calendar,
  ChevronDown, CheckCircle2, RefreshCw, X, FileSpreadsheet,
  AlertTriangle, Clock, Layers, Filter,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'pdf' | 'excel' | 'csv';
type ReportCategory = 'performance' | 'trends' | 'compliance';

interface ExportJob {
  id: string;
  label: string;
  format: ExportFormat;
  category: ReportCategory;
  timestamp: string;
  status: 'success' | 'failed';
  filename: string;
}

interface PerformanceSummaryConfig {
  category: ReportCategory;
  format: ExportFormat;
  dateFrom: string;
  dateTo: string;
  registries: string[];
  includeCharts: boolean;
  includeSummary: boolean;
  includeBreakdown: boolean;
}

interface PortfolioStats {
  total: number;
  perfected: number;
  overdue: number;
  pending: number;
  perfectionRate: number;
  totalValueTSh: number;
  brela: number;
  landsRegistry: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REGISTRIES = ['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];

const REPORT_CATEGORIES: {
  id: ReportCategory;
  label: string;
  description: string;
  icon: React.ElementType;
  accent: string;
  bg: string;
  formats: ExportFormat[];
}[] = [
  {
    id: 'performance',
    label: 'Collateral Performance Summary',
    description: 'Portfolio-wide KPIs: perfection rate, LTV ratios, aging buckets, and officer-level breakdown',
    icon: BarChart2,
    accent: 'text-blue-700',
    bg: 'bg-blue-50 border-blue-200',
    formats: ['pdf', 'excel', 'csv'],
  },
  {
    id: 'trends',
    label: 'Trend Analysis PDF',
    description: 'Time-series charts of perfection rate, deadline adherence, and collateral value over the selected period',
    icon: TrendingUp,
    accent: 'text-emerald-700',
    bg: 'bg-emerald-50 border-emerald-200',
    formats: ['pdf', 'excel'],
  },
  {
    id: 'compliance',
    label: 'Compliance Metrics Report',
    description: 'Per-registry compliance scores, BRELA/Lands Registry adherence rates, and regulatory gap analysis',
    icon: Shield,
    accent: 'text-purple-700',
    bg: 'bg-purple-50 border-purple-200',
    formats: ['pdf', 'excel', 'csv'],
  },
];

const FORMAT_META: Record<ExportFormat, { label: string; ext: string; icon: React.ElementType; desc: string }> = {
  pdf: { label: 'PDF', ext: '.pdf', icon: FileText, desc: 'Stakeholder-ready, print-optimised' },
  excel: { label: 'Excel', ext: '.xlsx', icon: FileSpreadsheet, desc: 'Pivot-ready workbook' },
  csv: { label: 'CSV', ext: '.csv', icon: FileSpreadsheet, desc: 'Raw data for analysis' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function nMonthsAgo(n: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - n);
  return d.toISOString().slice(0, 10);
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function buildFilename(config: PerformanceSummaryConfig): string {
  const cat = REPORT_CATEGORIES.find((c) => c.id === config.category)!;
  const slug = cat.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const date = today().replace(/-/g, '');
  return `${slug}_${date}${FORMAT_META[config.format].ext}`;
}

function generateCSVContent(stats: PortfolioStats, config: PerformanceSummaryConfig): string {
  const lines: string[] = [];

  if (config.category === 'performance') {
    lines.push('Metric,Value');
    lines.push(`Total Collateral,${stats.total}`);
    lines.push(`Perfected,${stats.perfected}`);
    lines.push(`Overdue,${stats.overdue}`);
    lines.push(`Pending Review,${stats.pending}`);
    lines.push(`Perfection Rate,${stats.perfectionRate.toFixed(1)}%`);
    lines.push(`Total Portfolio Value (TSh),${stats.totalValueTSh.toLocaleString()}`);
    if (config.includeBreakdown) {
      lines.push('');
      lines.push('Registry,Count');
      lines.push(`BRELA,${stats.brela}`);
      lines.push(`Lands Registry,${stats.landsRegistry}`);
    }
  } else if (config.category === 'compliance') {
    lines.push('Registry,Compliance Score,Status');
    lines.push(`BRELA,${Math.round((stats.brela / Math.max(stats.total, 1)) * 100)}%,Active`);
    lines.push(`Lands Registry,${Math.round((stats.landsRegistry / Math.max(stats.total, 1)) * 100)}%,Active`);
    lines.push(`Overall,${stats.perfectionRate.toFixed(1)}%,${stats.perfectionRate >= 80 ? 'Compliant' : 'Below Target'}`);
  } else {
    lines.push('Period,Perfection Rate,Overdue Count,New Collateral');
    lines.push(`${config.dateFrom} to ${config.dateTo},${stats.perfectionRate.toFixed(1)}%,${stats.overdue},${stats.total}`);
  }

  return lines.join('\n');
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

// ─── Registry Multi-select ────────────────────────────────────────────────────

function RegistrySelect({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (opt: string) =>
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground hover:border-primary/40 transition-colors"
      >
        <span className="truncate text-left">
          {selected.length === 0 ? 'All Registries' : selected.length === 1 ? selected[0] : `${selected.length} selected`}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
          {REGISTRIES.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-sm">
              <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)} className="accent-primary" />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Stats Panel ──────────────────────────────────────────────────────────────

function StatsPanel({ stats, loading }: { stats: PortfolioStats | null; loading: boolean }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
        ))}
      </div>
    );
  }
  if (!stats) return null;

  const complianceColor =
    stats.perfectionRate >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : stats.perfectionRate >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200' :'text-red-700 bg-red-50 border-red-200';

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-lg border border-border p-3">
          <p className="text-xs text-muted-foreground mb-0.5">Total Collateral</p>
          <p className="text-xl font-700 text-foreground tabular-nums">{stats.total}</p>
        </div>
        <div className={`rounded-lg border p-3 ${complianceColor}`}>
          <p className="text-xs mb-0.5 opacity-80">Perfection Rate</p>
          <p className="text-xl font-700 tabular-nums">{stats.perfectionRate.toFixed(1)}%</p>
        </div>
        <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-3">
          <p className="text-xs text-emerald-700 mb-0.5">Perfected</p>
          <p className="text-xl font-700 text-emerald-800 tabular-nums">{stats.perfected}</p>
        </div>
        <div className="bg-red-50 rounded-lg border border-red-100 p-3">
          <p className="text-xs text-red-700 mb-0.5">Overdue</p>
          <p className="text-xl font-700 text-red-800 tabular-nums">{stats.overdue}</p>
        </div>
      </div>
      <div className="bg-white rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground mb-1">Portfolio Value (TSh)</p>
        <p className="text-base font-700 text-foreground tabular-nums">
          {stats.totalValueTSh.toLocaleString()}
        </p>
      </div>
      {/* Compliance bar */}
      <div className="bg-white rounded-lg border border-border p-3">
        <div className="flex items-center justify-between mb-1.5">
          <p className="text-xs text-muted-foreground">Compliance Progress</p>
          <p className="text-xs font-600 text-foreground">{stats.perfectionRate.toFixed(0)}% / 80% target</p>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${stats.perfectionRate >= 80 ? 'bg-emerald-500' : stats.perfectionRate >= 60 ? 'bg-amber-500' : 'bg-red-500'}`}
            style={{ width: `${Math.min(stats.perfectionRate, 100)}%` }}
          />
        </div>
        {stats.perfectionRate < 80 && (
          <p className="text-xs text-amber-600 mt-1.5 flex items-center gap-1">
            <AlertTriangle size={11} />
            {(80 - stats.perfectionRate).toFixed(1)}% below regulatory target
          </p>
        )}
      </div>
    </div>
  );
}

// ─── Export History ───────────────────────────────────────────────────────────

function ExportHistory({ jobs, onClear }: { jobs: ExportJob[]; onClear: () => void }) {
  if (jobs.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-700 text-foreground flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Recent Exports
        </h2>
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Clear
        </button>
      </div>
      <div className="space-y-2">
        {jobs.slice(0, 5).map((job) => {
          const cat = REPORT_CATEGORIES.find((c) => c.id === job.category)!;
          const CatIcon = cat.icon;
          return (
            <div key={job.id} className="flex items-center gap-3 py-2 border-b border-border last:border-0">
              <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${cat.bg}`}>
                <CatIcon size={13} className={cat.accent} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-600 text-foreground truncate">{job.filename}</p>
                <p className="text-xs text-muted-foreground">{fmtTime(job.timestamp)}</p>
              </div>
              {job.status === 'success' ? (
                <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />
              ) : (
                <X size={14} className="text-red-500 shrink-0" />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PerformanceExportContent() {
  const [config, setConfig] = useState<PerformanceSummaryConfig>({
    category: 'performance',
    format: 'pdf',
    dateFrom: nMonthsAgo(3),
    dateTo: today(),
    registries: [],
    includeCharts: true,
    includeSummary: true,
    includeBreakdown: true,
  });

  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [stats, setStats] = useState<PortfolioStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [history, setHistory] = useState<ExportJob[]>([]);

  // Load live stats from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('collateral_records')
      .select('status, value_tsh, registry')
      .then(({ data, error }) => {
        if (!error && data) {
          const rows = data as { status: string; value_tsh: string; registry: string }[];
          const total = rows.length;
          const perfected = rows.filter((r) => r.status === 'Perfected').length;
          const overdue = rows.filter((r) => r.status === 'Overdue').length;
          const pending = rows.filter((r) => ['Draft', 'Submitted', 'Under Review'].includes(r.status)).length;
          const totalValueTSh = rows.reduce((sum, r) => sum + parseInt((r.value_tsh ?? '0').replace(/,/g, ''), 10), 0);
          const brela = rows.filter((r) => r.registry === 'BRELA').length;
          const landsRegistry = rows.filter((r) => r.registry === 'Lands Registry').length;
          setStats({
            total,
            perfected,
            overdue,
            pending,
            perfectionRate: total > 0 ? (perfected / total) * 100 : 0,
            totalValueTSh,
            brela,
            landsRegistry,
          });
        }
        setStatsLoading(false);
      })
      .catch(() => setStatsLoading(false));
  }, []);

  const set = useCallback(<K extends keyof PerformanceSummaryConfig>(key: K, value: PerformanceSummaryConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setExported(null);
    setExportError(null);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExported(null);
    setExportError(null);

    const filename = buildFilename(config);

    try {
      if (config.format === 'csv') {
        await new Promise((r) => setTimeout(r, 300));
        const csv = generateCSVContent(stats!, config);
        downloadBlob(csv, filename, 'text/csv');
      } else if (config.format === 'excel') {
        // Server-side Excel generation
        const reportTypeMap: Record<ReportCategory, string> = {
          performance: 'performance_summary',
          trends: 'trend_analysis',
          compliance: 'compliance_metrics',
        };
        const response = await fetch('/api/performance-export/excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportType: reportTypeMap[config.category],
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            registries: config.registries,
            includeSummary: config.includeSummary,
            includeCharts: config.includeCharts,
            includeBreakdown: config.includeBreakdown,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error ?? `HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } else {
        // Server-side PDF generation via dedicated performance-export route
        const reportTypeMap: Record<ReportCategory, string> = {
          performance: 'performance_summary',
          trends: 'trend_analysis',
          compliance: 'compliance_metrics',
        };
        const response = await fetch('/api/performance-export/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportType: reportTypeMap[config.category],
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            registries: config.registries,
            includeSummary: config.includeSummary,
            includeCharts: config.includeCharts,
            includeBreakdown: config.includeBreakdown,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error ?? `HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }

      setExported(filename);
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          label: REPORT_CATEGORIES.find((c) => c.id === config.category)!.label,
          format: config.format,
          category: config.category,
          timestamp: new Date().toISOString(),
          status: 'success',
          filename,
        },
        ...prev,
      ]);
    } catch (err: any) {
      setExportError(err.message ?? 'Export failed. Please try again.');
      setHistory((prev) => [
        {
          id: Date.now().toString(),
          label: REPORT_CATEGORIES.find((c) => c.id === config.category)!.label,
          format: config.format,
          category: config.category,
          timestamp: new Date().toISOString(),
          status: 'failed',
          filename,
        },
        ...prev,
      ]);
    } finally {
      setExporting(false);
    }
  }, [config, stats]);

  const selectedCat = REPORT_CATEGORIES.find((c) => c.id === config.category)!;
  const availableFormats = FORMAT_META
    ? Object.entries(FORMAT_META).filter(([id]) => selectedCat.formats.includes(id as ExportFormat))
    : [];

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white shrink-0">
        <div>
          <h1 className="text-lg font-700 text-foreground">Performance Export</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Export collateral performance summaries, trend PDFs, and compliance metrics
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || statsLoading || !stats}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
          {exporting ? 'Generating…' : `Export ${FORMAT_META[config.format].label}`}
        </button>
      </div>

      {/* Success / Error banners */}
      {exported && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span><span className="font-600">{exported}</span> exported successfully.</span>
          <button onClick={() => setExported(null)} className="ml-auto text-emerald-600 hover:text-emerald-800"><X size={14} /></button>
        </div>
      )}
      {exportError && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{exportError}</span>
          <button onClick={() => setExportError(null)} className="ml-auto text-red-600 hover:text-red-800"><X size={14} /></button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">

          {/* Left: Config */}
          <div className="lg:col-span-2 flex flex-col gap-5">

            {/* Report Category */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Layers size={15} className="text-primary" />
                Report Category
              </h2>
              <div className="flex flex-col gap-2.5">
                {REPORT_CATEGORIES.map((cat) => {
                  const CatIcon = cat.icon;
                  const active = config.category === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        set('category', cat.id);
                        // Reset format if not available for this category
                        if (!cat.formats.includes(config.format)) {
                          set('format', cat.formats[0]);
                        }
                      }}
                      className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20' :'border-border hover:border-primary/30 hover:bg-muted/40'
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${cat.bg}`}>
                        <CatIcon size={18} className={cat.accent} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`text-sm font-600 leading-tight ${active ? 'text-primary' : 'text-foreground'}`}>
                          {cat.label}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cat.description}</p>
                        <div className="flex items-center gap-1.5 mt-2">
                          {cat.formats.map((f) => (
                            <span key={f} className="text-xs px-1.5 py-0.5 bg-muted rounded font-500 text-muted-foreground uppercase">
                              {f}
                            </span>
                          ))}
                        </div>
                      </div>
                      {active && (
                        <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />
                      )}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Export Format */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Download size={15} className="text-primary" />
                Export Format
              </h2>
              <div className="grid grid-cols-3 gap-3">
                {selectedCat.formats.map((fmtId) => {
                  const fmt = FORMAT_META[fmtId];
                  const FmtIcon = fmt.icon;
                  const active = config.format === fmtId;
                  return (
                    <button
                      key={fmtId}
                      type="button"
                      onClick={() => set('format', fmtId)}
                      className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${
                        active
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20' :'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <FmtIcon size={22} className={active ? 'text-primary' : 'text-muted-foreground'} />
                      <div className="text-center">
                        <p className={`text-sm font-700 ${active ? 'text-primary' : 'text-foreground'}`}>{fmt.label}</p>
                        <p className="text-xs text-muted-foreground leading-snug mt-0.5">{fmt.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            {/* Date Range */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Calendar size={15} className="text-primary" />
                Date Range
              </h2>
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div>
                  <label className="block text-xs font-500 text-muted-foreground mb-1">From</label>
                  <input
                    type="date"
                    value={config.dateFrom}
                    onChange={(e) => set('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                <div>
                  <label className="block text-xs font-500 text-muted-foreground mb-1">To</label>
                  <input
                    type="date"
                    value={config.dateTo}
                    onChange={(e) => set('dateTo', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
              {/* Quick presets */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Last 30 days', months: 1 },
                  { label: 'Last 3 months', months: 3 },
                  { label: 'Last 6 months', months: 6 },
                  { label: 'Last 12 months', months: 12 },
                ].map(({ label, months }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => { set('dateFrom', nMonthsAgo(months)); set('dateTo', today()); }}
                    className="text-xs px-2.5 py-1 rounded-md border border-border bg-muted hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* Registry Filter */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Filter size={15} className="text-primary" />
                Registry Filter
              </h2>
              <RegistrySelect selected={config.registries} onChange={(v) => set('registries', v)} />
              {config.registries.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {config.registries.map((r) => (
                    <span key={r} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-500">
                      {r}
                      <button onClick={() => set('registries', config.registries.filter((x) => x !== r))}>
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </section>

            {/* Report Options */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Shield size={15} className="text-primary" />
                Report Options
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { key: 'includeCharts' as const, label: 'Include Charts', desc: 'Visual trend charts' },
                  { key: 'includeSummary' as const, label: 'Executive Summary', desc: 'High-level overview section' },
                  { key: 'includeBreakdown' as const, label: 'Detailed Breakdown', desc: 'Per-registry / per-officer rows' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 p-3 rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors group">
                    <input
                      type="checkbox"
                      checked={config[key] as boolean}
                      onChange={(e) => set(key, e.target.checked)}
                      className="accent-primary w-4 h-4 mt-0.5 shrink-0"
                    />
                    <div>
                      <p className="text-sm font-600 text-foreground group-hover:text-primary transition-colors">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Preview + History */}
          <div className="flex flex-col gap-5">
            {/* Live Stats */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <TrendingUp size={15} className="text-primary" />
                Live Portfolio Snapshot
              </h2>
              <StatsPanel stats={stats} loading={statsLoading} />
            </section>

            {/* Selected Report Summary */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <BarChart2 size={15} className="text-primary" />
                Export Summary
              </h2>
              <div className={`flex items-start gap-3 p-3 rounded-lg border ${selectedCat.bg}`}>
                <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${selectedCat.bg}`}>
                  {React.createElement(selectedCat.icon, { size: 15, className: selectedCat.accent })}
                </div>
                <div>
                  <p className={`text-sm font-600 ${selectedCat.accent}`}>{selectedCat.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{selectedCat.description}</p>
                </div>
              </div>
              <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                <div className="flex justify-between">
                  <span>Format</span>
                  <span className="font-600 text-foreground uppercase">{config.format}</span>
                </div>
                <div className="flex justify-between">
                  <span>Date Range</span>
                  <span className="font-600 text-foreground">{config.dateFrom} → {config.dateTo}</span>
                </div>
                <div className="flex justify-between">
                  <span>Registries</span>
                  <span className="font-600 text-foreground">{config.registries.length === 0 ? 'All' : config.registries.length}</span>
                </div>
              </div>
            </section>

            {/* Export History */}
            <ExportHistory jobs={history} onClear={() => setHistory([])} />
          </div>
        </div>
      </div>
    </div>
  );
}
