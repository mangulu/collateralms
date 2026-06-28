'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { Download, FileText, Sheet, FileSpreadsheet, Filter, Calendar, CheckCircle2, Clock, RefreshCw, ChevronDown, X, BarChart2, Shield, ClipboardList, FolderOpen, TrendingUp,  } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type ExportFormat = 'pdf' | 'excel' | 'csv';
type ReportType =
  | 'collateral_aging' |'perfection_rate' |'deadline_adherence' |'compliance_scorecard' |'collateral_registry' |'audit_summary';

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ExportContent() {
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

  const set = useCallback(<K extends keyof ExportConfig>(key: K, value: ExportConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setExported(null);
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
        // PDF: call backend API with Supabase filtering
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
        a.href = url;
        a.download = filename;
        a.click();
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

  const selectedReport = REPORT_OPTIONS.find((r) => r.id === config.reportType)!;
  const selectedFormat = FORMAT_OPTIONS.find((f) => f.id === config.format)!;

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
        <button
          onClick={handleExport}
          disabled={exporting || dataLoading}
          className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
        >
          {exporting ? (
            <RefreshCw size={15} className="animate-spin" />
          ) : (
            <Download size={15} />
          )}
          {exporting ? 'Generating…' : `Export ${selectedFormat.label}`}
        </button>
      </div>

      {/* Success banner */}
      {exported && (
        <div className="mx-6 mt-4 flex items-center gap-3 px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-lg text-sm text-emerald-800 slide-up">
          <CheckCircle2 size={16} className="text-emerald-600 shrink-0" />
          <span>
            <span className="font-600">{exported}</span> exported successfully.
          </span>
          <button onClick={() => setExported(null)} className="ml-auto text-emerald-600 hover:text-emerald-800">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
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
                  const Icon = opt.icon;
                  const active = config.reportType === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => set('reportType', opt.id)}
                      className={`flex items-start gap-3 p-3 rounded-lg border text-left transition-all ${
                        active
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/20' :'border-border hover:border-primary/30 hover:bg-muted/50'
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center shrink-0 ${opt.bg}`}>
                        <Icon size={15} className={opt.color} />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-sm font-600 leading-tight ${active ? 'text-primary' : 'text-foreground'}`}>
                          {opt.label}
                        </p>
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
              <div className="grid grid-cols-2 gap-3">
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
                    <input
                      type="checkbox"
                      checked={config[key] as boolean}
                      onChange={(e) => set(key, e.target.checked)}
                      className="accent-primary w-4 h-4"
                    />
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
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
                  ))}
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
      </div>
    </div>
  );
}
