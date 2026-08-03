'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Download, FileText, Sheet, FileSpreadsheet, Filter, Calendar, CheckCircle2, Clock, RefreshCw, ChevronDown, X, BarChart2, Shield, ClipboardList, FolderOpen, TrendingUp, AlertTriangle, Layers, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';



// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'pdf' | 'excel' | 'csv';
type ReportType =
  | 'collateral_aging' |'perfection_rate' |'deadline_adherence' |'compliance_scorecard' |'collateral_registry' |'audit_summary';

type PerfReportCategory = 'performance' | 'trends' | 'compliance';

interface ExportConfig {
  reportType: ReportType;
  format: ExportFormat;
  dateFrom: string;
  dateTo: string;
  registries: string[];
  statuses: string[];
  collateralTypes: string[];
  includeCharts: boolean;
  includeSummary: boolean;
  includeDetails: boolean;
  stakeholderMode: boolean;
}

interface PerfExportConfig {
  category: PerfReportCategory;
  format: ExportFormat;
  dateFrom: string;
  dateTo: string;
  registries: string[];
  includeCharts: boolean;
  includeSummary: boolean;
  includeBreakdown: boolean;
}

interface CollateralRow {
  id: string;
  obligor: string;
  type: string;
  registry: string;
  status: string;
  valueTSh: string;
  perfectionDeadline: string;
  daysToDeadline: number | null;
  assignedOfficer: string;
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

interface PerfExportJob {
  id: string;
  label: string;
  format: ExportFormat;
  category: PerfReportCategory;
  timestamp: string;
  status: 'success' | 'failed';
  filename: string;
}

interface ReportOption {
  id: ReportType;
  label: string;
  description: string;
  icon: React.ElementType;
  color: string;
  bg: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const REPORT_OPTIONS: ReportOption[] = [
  {
    id: 'collateral_aging',
    label: 'Collateral Aging Analysis',
    description: 'Breakdown of collateral by days-to-deadline buckets',
    icon: BarChart2,
    color: 'text-blue-700',
    bg: 'bg-blue-50',
  },
  {
    id: 'perfection_rate',
    label: 'Perfection Rate Trends',
    description: 'Perfection rate over time vs. 80% target benchmark',
    icon: TrendingUp,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
  },
  {
    id: 'deadline_adherence',
    label: 'Deadline Adherence Metrics',
    description: 'On-time vs. overdue perfection actions by period',
    icon: Clock,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
  },
  {
    id: 'compliance_scorecard',
    label: 'Regulatory Compliance Scorecard',
    description: 'Per-registry compliance grades and breakdown',
    icon: Shield,
    color: 'text-purple-700',
    bg: 'bg-purple-50',
  },
  {
    id: 'collateral_registry',
    label: 'Collateral Registry Export',
    description: 'Full collateral list with status, value, and officer',
    icon: FolderOpen,
    color: 'text-primary',
    bg: 'bg-primary/5',
  },
  {
    id: 'audit_summary',
    label: 'Audit Trail Summary',
    description: 'System activity log for compliance and governance',
    icon: ClipboardList,
    color: 'text-slate-700',
    bg: 'bg-slate-50',
  },
];

const FORMAT_OPTIONS: { id: ExportFormat; label: string; ext: string; icon: React.ElementType; desc: string }[] = [
  { id: 'pdf', label: 'PDF', ext: '.pdf', icon: FileText, desc: 'Stakeholder-ready, print-optimised' },
  { id: 'excel', label: 'Excel', ext: '.xlsx', icon: Sheet, desc: 'Pivot-ready workbook with formatting' },
  { id: 'csv', label: 'CSV', ext: '.csv', icon: FileSpreadsheet, desc: 'Raw data for further analysis' },
];

const PERF_REPORT_CATEGORIES: {
  id: PerfReportCategory;
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

const PERF_FORMAT_META: Record<ExportFormat, { label: string; ext: string; icon: React.ElementType; desc: string }> = {
  pdf: { label: 'PDF', ext: '.pdf', icon: FileText, desc: 'Stakeholder-ready, print-optimised' },
  excel: { label: 'Excel', ext: '.xlsx', icon: FileSpreadsheet, desc: 'Pivot-ready workbook' },
  csv: { label: 'CSV', ext: '.csv', icon: FileSpreadsheet, desc: 'Raw data for analysis' },
};

const REGISTRIES = ['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];
const STATUSES = ['Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected'];
const COLLATERAL_TYPES = ['Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel'];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function sixMonthsAgo(): string {
  const d = new Date();
  d.setMonth(d.getMonth() - 6);
  return d.toISOString().slice(0, 10);
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

function generateCSV(rows: CollateralRow[], config: ExportConfig): string {
  const filtered = rows.filter((c) => {
    if (config.registries.length && !config.registries.includes(c.registry)) return false;
    if (config.statuses.length && !config.statuses.includes(c.status)) return false;
    if (config.collateralTypes.length && !config.collateralTypes.includes(c.type)) return false;
    return true;
  });

  const headers = ['ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Perfection Deadline', 'Days to Deadline', 'Assigned Officer'];
  const lines = [
    headers.join(','),
    ...filtered.map((r) =>
      [r.id, `"${r.obligor}"`, r.type, r.registry, r.status, r.valueTSh, r.perfectionDeadline, r.daysToDeadline ?? '', `"${r.assignedOfficer}"`].join(',')
    ),
  ];
  return lines.join('\n');
}

function generatePerfCSV(stats: PortfolioStats, config: PerfExportConfig): string {
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

function buildFilename(config: ExportConfig): string {
  const label = REPORT_OPTIONS.find((r) => r.id === config.reportType)?.label ?? config.reportType;
  const slug = label.toLowerCase().replace(/\s+/g, '_');
  const date = today().replace(/-/g, '');
  const ext = FORMAT_OPTIONS.find((f) => f.id === config.format)?.ext ?? '';
  return `${slug}_${date}${ext}`;
}

function buildPerfFilename(config: PerfExportConfig): string {
  const cat = PERF_REPORT_CATEGORIES.find((c) => c.id === config.category)!;
  const slug = cat.label.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  const date = today().replace(/-/g, '');
  return `${slug}_${date}${PERF_FORMAT_META[config.format].ext}`;
}

// ─── Multi-select Dropdown ────────────────────────────────────────────────────

function MultiSelect({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);

  const toggle = (opt: string) => {
    onChange(selected.includes(opt) ? selected.filter((s) => s !== opt) : [...selected, opt]);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground hover:border-primary/40 transition-colors"
      >
        <span className="truncate text-left">
          {selected.length === 0
            ? `All ${label}`
            : selected.length === 1
            ? selected[0]
            : `${selected.length} selected`}
        </span>
        <ChevronDown size={14} className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute z-30 top-full left-0 mt-1 w-full bg-white border border-border rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-1.5 hover:bg-muted cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => toggle(opt)}
                className="accent-primary"
              />
              <span>{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Registry Select (for Performance Export) ─────────────────────────────────

function RegistrySelect({ selected, onChange }: { selected: string[]; onChange: (v: string[]) => void }) {
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

// ─── Preview Stats ────────────────────────────────────────────────────────────

function PreviewStats({ config, allRows }: { config: ExportConfig; allRows: CollateralRow[] }) {
  const filtered = allRows.filter((c) => {
    if (config.registries.length && !config.registries.includes(c.registry)) return false;
    if (config.statuses.length && !config.statuses.includes(c.status)) return false;
    if (config.collateralTypes.length && !config.collateralTypes.includes(c.type)) return false;
    return true;
  });

  const compliant = filtered.filter((c) => c.status === 'Perfected').length;
  const overdue = filtered.filter((c) => c.status === 'Overdue').length;
  const pending = filtered.filter((c) => ['Draft', 'Submitted', 'Under Review'].includes(c.status)).length;
  const totalValue = filtered.reduce((sum, c) => sum + parseInt((c.valueTSh ?? '0').replace(/,/g, ''), 10), 0);

  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="bg-white rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground mb-0.5">Records</p>
        <p className="text-xl font-700 text-foreground tabular-nums">{filtered.length}</p>
      </div>
      <div className="bg-white rounded-lg border border-border p-3">
        <p className="text-xs text-muted-foreground mb-0.5">Total Value (TSh)</p>
        <p className="text-xl font-700 text-foreground tabular-nums">{totalValue.toLocaleString()}</p>
      </div>
      <div className="bg-emerald-50 rounded-lg border border-emerald-100 p-3">
        <p className="text-xs text-emerald-700 mb-0.5">Perfected</p>
        <p className="text-xl font-700 text-emerald-800 tabular-nums">{compliant}</p>
      </div>
      <div className="bg-red-50 rounded-lg border border-red-100 p-3">
        <p className="text-xs text-red-700 mb-0.5">Overdue</p>
        <p className="text-xl font-700 text-red-800 tabular-nums">{overdue}</p>
      </div>
      <div className="col-span-2 bg-amber-50 rounded-lg border border-amber-100 p-3">
        <p className="text-xs text-amber-700 mb-0.5">Pending Review</p>
        <p className="text-xl font-700 text-amber-800 tabular-nums">{pending}</p>
      </div>
    </div>
  );
}

// ─── Perf Stats Panel ─────────────────────────────────────────────────────────

function PerfStatsPanel({ stats, loading }: { stats: PortfolioStats | null; loading: boolean }) {
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
    : stats.perfectionRate >= 60 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-red-700 bg-red-50 border-red-200';
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
        <p className="text-base font-700 text-foreground tabular-nums">{stats.totalValueTSh.toLocaleString()}</p>
      </div>
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

// ─── Perf Export History ──────────────────────────────────────────────────────

function PerfExportHistory({ jobs, onClear }: { jobs: PerfExportJob[]; onClear: () => void }) {
  if (jobs.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-border p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-700 text-foreground flex items-center gap-2">
          <Clock size={14} className="text-muted-foreground" />
          Recent Exports
        </h2>
        <button onClick={onClear} className="text-xs text-muted-foreground hover:text-foreground transition-colors">Clear</button>
      </div>
      <div className="space-y-2">
        {jobs.slice(0, 5).map((job) => {
          const cat = PERF_REPORT_CATEGORIES.find((c) => c.id === job.category)!;
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
                <CheckCircle size={14} className="text-emerald-500 shrink-0" />
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

export default function ExportContent() {
  const [activeTab, setActiveTab] = useState<'general' | 'performance'>('general');

  // ── General Export State ──────────────────────────────────────────────────
  const [config, setConfig] = useState<ExportConfig>({
    reportType: 'collateral_registry',
    format: 'pdf',
    dateFrom: sixMonthsAgo(),
    dateTo: today(),
    registries: [],
    statuses: [],
    collateralTypes: [],
    includeCharts: true,
    includeSummary: true,
    includeDetails: true,
    stakeholderMode: true,
  });

  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState<string | null>(null);
  const [allRows, setAllRows] = useState<CollateralRow[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  // ── Performance Export State ──────────────────────────────────────────────
  const [perfConfig, setPerfConfig] = useState<PerfExportConfig>({
    category: 'performance',
    format: 'pdf',
    dateFrom: nMonthsAgo(3),
    dateTo: today(),
    registries: [],
    includeCharts: true,
    includeSummary: true,
    includeBreakdown: true,
  });
  const [perfExporting, setPerfExporting] = useState(false);
  const [perfExported, setPerfExported] = useState<string | null>(null);
  const [perfExportError, setPerfExportError] = useState<string | null>(null);
  const [perfStats, setPerfStats] = useState<PortfolioStats | null>(null);
  const [perfStatsLoading, setPerfStatsLoading] = useState(true);
  const [perfHistory, setPerfHistory] = useState<PerfExportJob[]>([]);

  // Load live collateral data from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('collateral_records')
      .select('collateral_id, obligor, collateral_type, registry, status, value_tsh, perfection_deadline, days_to_deadline, assigned_officer')
      .order('created_at', { ascending: false })
      .then(({ data, error }) => {
        if (!error && data) {
          setAllRows(data.map((row: any) => ({
            id: row.collateral_id,
            obligor: row.obligor ?? '',
            type: row.collateral_type ?? '',
            registry: row.registry ?? '',
            status: row.status ?? '',
            valueTSh: row.value_tsh ?? '0',
            perfectionDeadline: row.perfection_deadline ?? '',
            daysToDeadline: row.days_to_deadline ?? null,
            assignedOfficer: row.assigned_officer ?? '',
          })));
        }
        setDataLoading(false);
      })
      .catch(() => setDataLoading(false));
  }, []);

  // Load performance stats
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
          setPerfStats({ total, perfected, overdue, pending, perfectionRate: total > 0 ? (perfected / total) * 100 : 0, totalValueTSh, brela, landsRegistry });
        }
        setPerfStatsLoading(false);
      })
      .catch(() => setPerfStatsLoading(false));
  }, []);

  const set = useCallback(<K extends keyof ExportConfig>(key: K, value: ExportConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setExported(null);
  }, []);

  const setPerf = useCallback(<K extends keyof PerfExportConfig>(key: K, value: PerfExportConfig[K]) => {
    setPerfConfig((prev) => ({ ...prev, [key]: value }));
    setPerfExported(null);
    setPerfExportError(null);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExported(null);
    const filename = buildFilename(config);
    try {
      if (config.format === 'csv') {
        await new Promise((r) => setTimeout(r, 400));
        const csv = generateCSV(allRows, config);
        downloadBlob(csv, filename, 'text/csv');
        setExported(filename);
      } else if (config.format === 'excel') {
        await new Promise((r) => setTimeout(r, 400));
        const csv = generateCSV(allRows, config).replace(/,/g, '\t');
        downloadBlob(csv, filename, 'application/vnd.ms-excel');
        setExported(filename);
      } else {
        const response = await fetch('/api/export/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reportType: config.reportType,
            dateFrom: config.dateFrom,
            dateTo: config.dateTo,
            registries: config.registries,
            statuses: config.statuses,
            collateralTypes: config.collateralTypes,
            includeCharts: config.includeCharts,
            includeSummary: config.includeSummary,
            includeDetails: config.includeDetails,
            stakeholderMode: config.stakeholderMode,
          }),
        });
        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Unknown error' }));
          throw new Error(err.error ?? `HTTP ${response.status}`);
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = filename; a.click();
        URL.revokeObjectURL(url);
        setExported(filename);
      }
    } catch (err: any) {
      console.error('Export failed:', err);
      setExported(null);
      alert(`Export failed: ${err.message ?? 'Unknown error'}. Please try again.`);
    } finally {
      setExporting(false);
    }
  }, [config, allRows]);

  const handlePerfExport = useCallback(async () => {
    setPerfExporting(true);
    setPerfExported(null);
    setPerfExportError(null);
    const filename = buildPerfFilename(perfConfig);
    try {
      if (perfConfig.format === 'csv') {
        await new Promise((r) => setTimeout(r, 300));
        const csv = generatePerfCSV(perfStats!, perfConfig);
        downloadBlob(csv, filename, 'text/csv');
      } else if (perfConfig.format === 'excel') {
        const reportTypeMap: Record<PerfReportCategory, string> = { performance: 'performance_summary', trends: 'trend_analysis', compliance: 'compliance_metrics' };
        const response = await fetch('/api/performance-export/excel', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportType: reportTypeMap[perfConfig.category], dateFrom: perfConfig.dateFrom, dateTo: perfConfig.dateTo, registries: perfConfig.registries, includeSummary: perfConfig.includeSummary, includeCharts: perfConfig.includeCharts, includeBreakdown: perfConfig.includeBreakdown }),
        });
        if (!response.ok) { const err = await response.json().catch(() => ({ error: 'Unknown error' })); throw new Error(err.error ?? `HTTP ${response.status}`); }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
      } else {
        const reportTypeMap: Record<PerfReportCategory, string> = { performance: 'performance_summary', trends: 'trend_analysis', compliance: 'compliance_metrics' };
        const response = await fetch('/api/performance-export/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reportType: reportTypeMap[perfConfig.category], dateFrom: perfConfig.dateFrom, dateTo: perfConfig.dateTo, registries: perfConfig.registries, includeSummary: perfConfig.includeSummary, includeCharts: perfConfig.includeCharts, includeBreakdown: perfConfig.includeBreakdown }),
        });
        if (!response.ok) { const err = await response.json().catch(() => ({ error: 'Unknown error' })); throw new Error(err.error ?? `HTTP ${response.status}`); }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = filename; a.click(); URL.revokeObjectURL(url);
      }
      setPerfExported(filename);
      setPerfHistory((prev) => [{ id: Date.now().toString(), label: PERF_REPORT_CATEGORIES.find((c) => c.id === perfConfig.category)!.label, format: perfConfig.format, category: perfConfig.category, timestamp: new Date().toISOString(), status: 'success', filename }, ...prev]);
    } catch (err: any) {
      setPerfExportError(err.message ?? 'Export failed. Please try again.');
      setPerfHistory((prev) => [{ id: Date.now().toString(), label: PERF_REPORT_CATEGORIES.find((c) => c.id === perfConfig.category)!.label, format: perfConfig.format, category: perfConfig.category, timestamp: new Date().toISOString(), status: 'failed', filename }, ...prev]);
    } finally {
      setPerfExporting(false);
    }
  }, [perfConfig, perfStats]);

  const selectedReport = REPORT_OPTIONS.find((r) => r.id === config.reportType)!;
  const selectedFormat = FORMAT_OPTIONS.find((f) => f.id === config.format)!;
  const selectedPerfCat = PERF_REPORT_CATEGORIES.find((c) => c.id === perfConfig.category)!;

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white shrink-0">
        <div>
          <h1 className="text-lg font-700 text-foreground">Export Analytics</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Generate stakeholder-ready reports in PDF, Excel, or CSV
          </p>
        </div>
        {activeTab === 'general' ? (
          <button
            onClick={handleExport}
            disabled={exporting || dataLoading}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {exporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
            {exporting ? 'Generating…' : `Export ${selectedFormat.label}`}
          </button>
        ) : (
          <button
            onClick={handlePerfExport}
            disabled={perfExporting || perfStatsLoading || !perfStats}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {perfExporting ? <RefreshCw size={15} className="animate-spin" /> : <Download size={15} />}
            {perfExporting ? 'Generating…' : `Export ${PERF_FORMAT_META[perfConfig.format].label}`}
          </button>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-0.5 px-6 border-b border-border bg-white">
        {[
          { key: 'general', label: 'General Export' },
          { key: 'performance', label: 'Performance Export' },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`px-4 py-2.5 text-sm font-500 border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Success / Error banners */}
      {activeTab === 'general' && exported && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 slide-up">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span><span className="font-600">{exported}</span> exported successfully.</span>
          <button onClick={() => setExported(null)} className="ml-auto text-emerald-600 hover:text-emerald-800"><X size={14} /></button>
        </div>
      )}
      {activeTab === 'performance' && perfExported && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span><span className="font-600">{perfExported}</span> exported successfully.</span>
          <button onClick={() => setPerfExported(null)} className="ml-auto text-emerald-600 hover:text-emerald-800"><X size={14} /></button>
        </div>
      )}
      {activeTab === 'performance' && perfExportError && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
          <AlertTriangle size={16} className="text-red-600 shrink-0" />
          <span>{perfExportError}</span>
          <button onClick={() => setPerfExportError(null)} className="ml-auto text-red-600 hover:text-red-800"><X size={14} /></button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">

        {/* ── General Export Tab ── */}
        {activeTab === 'general' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
            {/* Left: Config */}
            <div className="lg:col-span-2 flex flex-col gap-5">
              {/* Report Type */}
              <section className="bg-white rounded-xl border border-border p-5">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <BarChart2 size={15} className="text-primary" />
                  Report Type
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {REPORT_OPTIONS.map((opt) => {
                    const OptIcon = opt.icon;
                    const active = config.reportType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => set('reportType', opt.id)}
                        className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
                      >
                        <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${opt.bg}`}>
                          <OptIcon size={15} className={opt.color} />
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-600 leading-tight ${active ? 'text-primary' : 'text-foreground'}`}>{opt.label}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{opt.description}</p>
                        </div>
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
                  {FORMAT_OPTIONS.map((fmt) => {
                    const FmtIcon = fmt.icon;
                    const active = config.format === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => set('format', fmt.id)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
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
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-500 text-muted-foreground mb-1">From</label>
                    <input type="date" value={config.dateFrom} onChange={(e) => set('dateFrom', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-500 text-muted-foreground mb-1">To</label>
                    <input type="date" value={config.dateTo} onChange={(e) => set('dateTo', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
              </section>

              {/* Filters */}
              <section className="bg-white rounded-xl border border-border p-5">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <Filter size={15} className="text-primary" />
                  Filters
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-500 text-muted-foreground mb-1">Registries</label>
                    <MultiSelect label="Registries" options={REGISTRIES} selected={config.registries} onChange={(v) => set('registries', v)} />
                  </div>
                  <div>
                    <label className="block text-xs font-500 text-muted-foreground mb-1">Statuses</label>
                    <MultiSelect label="Statuses" options={STATUSES} selected={config.statuses} onChange={(v) => set('statuses', v)} />
                  </div>
                  <div>
                    <label className="block text-xs font-500 text-muted-foreground mb-1">Collateral Types</label>
                    <MultiSelect label="Types" options={COLLATERAL_TYPES} selected={config.collateralTypes} onChange={(v) => set('collateralTypes', v)} />
                  </div>
                </div>
              </section>

              {/* Options */}
              <section className="bg-white rounded-xl border border-border p-5">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <Shield size={15} className="text-primary" />
                  Report Options
                </h2>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { key: 'includeCharts' as const, label: 'Include Charts' },
                    { key: 'includeSummary' as const, label: 'Include Summary' },
                    { key: 'includeDetails' as const, label: 'Include Details' },
                    { key: 'stakeholderMode' as const, label: 'Stakeholder Mode' },
                  ].map(({ key, label }) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer group">
                      <input type="checkbox" checked={config[key] as boolean} onChange={(e) => set(key, e.target.checked)} className="accent-primary w-4 h-4" />
                      <span className="text-sm text-foreground group-hover:text-primary transition-colors">{label}</span>
                    </label>
                  ))}
                </div>
              </section>
            </div>

            {/* Right: Preview */}
            <div className="flex flex-col gap-5">
              <section className="bg-white rounded-xl border border-border p-5 sticky top-0">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp size={15} className="text-primary" />
                  Preview
                </h2>
                {dataLoading ? (
                  <div className="space-y-2">
                    {Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
                  </div>
                ) : (
                  <PreviewStats config={config} allRows={allRows} />
                )}
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                      {React.createElement(selectedReport.icon, { size: 13, className: 'text-primary' })}
                    </div>
                    <p className="text-xs font-600 text-foreground">{selectedReport.label}</p>
                  </div>
                  <p className="text-xs text-muted-foreground">{selectedReport.description}</p>
                </div>
              </section>
            </div>
          </div>
        )}

        {/* ── Performance Export Tab ── */}
        {activeTab === 'performance' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 max-w-7xl mx-auto">
            {/* Left: Config */}
            <div className="lg:col-span-2 flex flex-col gap-4 sm:gap-5">
              {/* Report Category */}
              <section className="bg-white rounded-xl border border-border p-5">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <Layers size={15} className="text-primary" />
                  Report Category
                </h2>
                <div className="flex flex-col gap-2.5">
                  {PERF_REPORT_CATEGORIES.map((cat) => {
                    const CatIcon = cat.icon;
                    const active = perfConfig.category === cat.id;
                    return (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => {
                          setPerf('category', cat.id);
                          if (!cat.formats.includes(perfConfig.format)) setPerf('format', cat.formats[0]);
                        }}
                        className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30 hover:bg-muted/40'}`}
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 border ${cat.bg}`}>
                          <CatIcon size={18} className={cat.accent} />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`text-sm font-600 leading-tight ${active ? 'text-primary' : 'text-foreground'}`}>{cat.label}</p>
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{cat.description}</p>
                          <div className="flex items-center gap-1.5 mt-2">
                            {cat.formats.map((f) => (
                              <span key={f} className="text-xs px-1.5 py-0.5 bg-muted rounded font-500 text-muted-foreground uppercase">{f}</span>
                            ))}
                          </div>
                        </div>
                        {active && <CheckCircle2 size={16} className="text-primary shrink-0 mt-0.5" />}
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
                  {selectedPerfCat.formats.map((fmtId) => {
                    const fmt = PERF_FORMAT_META[fmtId];
                    const FmtIcon = fmt.icon;
                    const active = perfConfig.format === fmtId;
                    return (
                      <button
                        key={fmtId}
                        type="button"
                        onClick={() => setPerf('format', fmtId)}
                        className={`flex flex-col items-center gap-2 p-4 rounded-lg border transition-all ${active ? 'border-primary bg-primary/5 ring-1 ring-primary/20' : 'border-border hover:border-primary/30 hover:bg-muted/50'}`}
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
                    <input type="date" value={perfConfig.dateFrom} onChange={(e) => setPerf('dateFrom', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-xs font-500 text-muted-foreground mb-1">To</label>
                    <input type="date" value={perfConfig.dateTo} onChange={(e) => setPerf('dateTo', e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary" />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {[{ label: 'Last 30 days', months: 1 }, { label: 'Last 3 months', months: 3 }, { label: 'Last 6 months', months: 6 }, { label: 'Last 12 months', months: 12 }].map(({ label, months }) => (
                    <button key={label} type="button" onClick={() => { setPerf('dateFrom', nMonthsAgo(months)); setPerf('dateTo', today()); }} className="text-xs px-2.5 py-1 rounded-md border border-border bg-muted hover:border-primary/40 hover:bg-primary/5 text-muted-foreground hover:text-primary transition-colors">{label}</button>
                  ))}
                </div>
              </section>

              {/* Registry Filter */}
              <section className="bg-white rounded-xl border border-border p-5">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <Filter size={15} className="text-primary" />
                  Registry Filter
                </h2>
                <RegistrySelect selected={perfConfig.registries} onChange={(v) => setPerf('registries', v)} />
                {perfConfig.registries.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {perfConfig.registries.map((r) => (
                      <span key={r} className="flex items-center gap-1 text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-500">
                        {r}
                        <button onClick={() => setPerf('registries', perfConfig.registries.filter((x) => x !== r))}><X size={10} /></button>
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
                      <input type="checkbox" checked={perfConfig[key] as boolean} onChange={(e) => setPerf(key, e.target.checked)} className="accent-primary w-4 h-4 mt-0.5 shrink-0" />
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
              <section className="bg-white rounded-xl border border-border p-5">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <TrendingUp size={15} className="text-primary" />
                  Live Portfolio Snapshot
                </h2>
                <PerfStatsPanel stats={perfStats} loading={perfStatsLoading} />
              </section>

              <section className="bg-white rounded-xl border border-border p-5">
                <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                  <BarChart2 size={15} className="text-primary" />
                  Export Summary
                </h2>
                <div className={`flex items-start gap-3 p-3 rounded-lg border ${selectedPerfCat.bg}`}>
                  <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${selectedPerfCat.bg}`}>
                    {React.createElement(selectedPerfCat.icon, { size: 15, className: selectedPerfCat.accent })}
                  </div>
                  <div>
                    <p className={`text-sm font-600 ${selectedPerfCat.accent}`}>{selectedPerfCat.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{selectedPerfCat.description}</p>
                  </div>
                </div>
                <div className="mt-3 space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between"><span>Format</span><span className="font-600 text-foreground uppercase">{perfConfig.format}</span></div>
                  <div className="flex justify-between"><span>Date Range</span><span className="font-600 text-foreground">{perfConfig.dateFrom} → {perfConfig.dateTo}</span></div>
                  <div className="flex justify-between"><span>Registries</span><span className="font-600 text-foreground">{perfConfig.registries.length === 0 ? 'All' : perfConfig.registries.length}</span></div>
                </div>
              </section>

              <PerfExportHistory jobs={perfHistory} onClear={() => setPerfHistory([])} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
