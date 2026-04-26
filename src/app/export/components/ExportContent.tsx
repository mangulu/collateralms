'use client';
import React, { useState, useCallback } from 'react';
import {
  Download, FileText, Sheet, FileSpreadsheet, Filter, Calendar,
  CheckCircle2, AlertTriangle, Clock, RefreshCw, ChevronDown, X,
  BarChart2, Shield, ClipboardList, FolderOpen, TrendingUp, Building2,
} from 'lucide-react';
import { mockCollateral } from '@/app/collateral-management/components/collateralData';
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

function generateCSV(config: ExportConfig): string {
  const rows = mockCollateral.filter((c) => {
    if (config.registries.length && !config.registries.includes(c.registry)) return false;
    if (config.statuses.length && !config.statuses.includes(c.status)) return false;
    if (config.collateralTypes.length && !config.collateralTypes.includes(c.type)) return false;
    return true;
  });

  const headers = ['ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Perfection Deadline', 'Days to Deadline', 'Assigned Officer'];
  const lines = [
    headers.join(','),
    ...rows.map((r) =>
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

function PreviewStats({ config }: { config: ExportConfig }) {
  const filtered = mockCollateral.filter((c) => {
    if (config.registries.length && !config.registries.includes(c.registry)) return false;
    if (config.statuses.length && !config.statuses.includes(c.status)) return false;
    if (config.collateralTypes.length && !config.collateralTypes.includes(c.type)) return false;
    return true;
  });

  const compliant = filtered.filter((c) => c.status === 'Perfected').length;
  const overdue = filtered.filter((c) => c.status === 'Overdue').length;
  const pending = filtered.filter((c) => ['Draft', 'Submitted', 'Under Review'].includes(c.status)).length;
  const totalValue = filtered.reduce((sum, c) => sum + parseInt(c.valueTSh.replace(/,/g, ''), 10), 0);

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

  const set = useCallback(<K extends keyof ExportConfig>(key: K, value: ExportConfig[K]) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setExported(null);
  }, []);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExported(null);

    // Simulate async export processing
    await new Promise((r) => setTimeout(r, 900));

    const filename = buildFilename(config);

    if (config.format === 'csv') {
      const csv = generateCSV(config);
      downloadBlob(csv, filename, 'text/csv');
    } else if (config.format === 'excel') {
      // Generate a simple TSV-based Excel-compatible file
      const csv = generateCSV(config).replace(/,/g, '\t');
      downloadBlob(csv, filename, 'application/vnd.ms-excel');
    } else {
      // PDF: generate a printable HTML page and open print dialog
      const rows = mockCollateral.filter((c) => {
        if (config.registries.length && !config.registries.includes(c.registry)) return false;
        if (config.statuses.length && !config.statuses.includes(c.status)) return false;
        if (config.collateralTypes.length && !config.collateralTypes.includes(c.type)) return false;
        return true;
      });

      const reportLabel = REPORT_OPTIONS.find((r) => r.id === config.reportType)?.label ?? '';
      const totalValue = rows.reduce((s, c) => s + parseInt(c.valueTSh.replace(/,/g, ''), 10), 0);
      const perfected = rows.filter((c) => c.status === 'Perfected').length;
      const overdue = rows.filter((c) => c.status === 'Overdue').length;

      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8"/>
  <title>${reportLabel} — CollateralMS</title>
  <style>
    body { font-family: 'DM Sans', Arial, sans-serif; font-size: 11px; color: #1e2a3a; margin: 0; padding: 24px; }
    h1 { font-size: 18px; font-weight: 700; margin-bottom: 2px; }
    .subtitle { color: #6b7280; font-size: 11px; margin-bottom: 16px; }
    .meta { display: flex; gap: 24px; margin-bottom: 16px; }
    .meta-item { background: #f3f4f6; border-radius: 6px; padding: 8px 12px; }
    .meta-item .label { font-size: 10px; color: #6b7280; }
    .meta-item .value { font-size: 14px; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th { background: #1a3a5c; color: white; text-align: left; padding: 6px 8px; font-size: 10px; font-weight: 600; }
    td { padding: 5px 8px; border-bottom: 1px solid #e5e7eb; font-size: 10px; }
    tr:nth-child(even) td { background: #f9fafb; }
    .badge { display: inline-block; padding: 1px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600; }
    .badge-perfected { background: #d1fae5; color: #065f46; }
    .badge-overdue { background: #fee2e2; color: #991b1b; }
    .badge-default { background: #e5e7eb; color: #374151; }
    .footer { margin-top: 16px; font-size: 9px; color: #9ca3af; border-top: 1px solid #e5e7eb; padding-top: 8px; }
    @media print { body { padding: 0; } }
  </style>
</head>
<body>
  <h1>${reportLabel}</h1>
  <div class="subtitle">EXIM Bank Tanzania — CollateralMS &nbsp;|&nbsp; Period: ${config.dateFrom} to ${config.dateTo} &nbsp;|&nbsp; Generated: ${new Date().toLocaleString('en-GB')}</div>
  <div class="meta">
    <div class="meta-item"><div class="label">Total Records</div><div class="value">${rows.length}</div></div>
    <div class="meta-item"><div class="label">Total Value (TSh)</div><div class="value">${totalValue.toLocaleString()}</div></div>
    <div class="meta-item"><div class="label">Perfected</div><div class="value">${perfected}</div></div>
    <div class="meta-item"><div class="label">Overdue</div><div class="value">${overdue}</div></div>
    <div class="meta-item"><div class="label">Perfection Rate</div><div class="value">${rows.length ? Math.round((perfected / rows.length) * 100) : 0}%</div></div>
  </div>
  <table>
    <thead>
      <tr>
        <th>ID</th><th>Obligor</th><th>Type</th><th>Registry</th><th>Status</th>
        <th>Value (TSh)</th><th>Deadline</th><th>Days Left</th><th>Officer</th>
      </tr>
    </thead>
    <tbody>
      ${rows.map((r) => `
      <tr>
        <td>${r.id}</td>
        <td>${r.obligor}</td>
        <td>${r.type}</td>
        <td>${r.registry}</td>
        <td><span class="badge ${r.status === 'Perfected' ? 'badge-perfected' : r.status === 'Overdue' ? 'badge-overdue' : 'badge-default'}">${r.status}</span></td>
        <td>${r.valueTSh}</td>
        <td>${r.perfectionDeadline}</td>
        <td>${r.daysToDeadline ?? '—'}</td>
        <td>${r.assignedOfficer}</td>
      </tr>`).join('')}
    </tbody>
  </table>
  <div class="footer">Confidential — EXIM Bank Tanzania &nbsp;|&nbsp; CollateralMS &nbsp;|&nbsp; ${new Date().toLocaleDateString('en-GB')}</div>
  <script>window.onload = function(){ window.print(); }</script>
</body>
</html>`;

      const win = window.open('', '_blank');
      if (win) {
        win.document.write(html);
        win.document.close();
      }
    }

    setExporting(false);
    setExported(filename);
  }, [config]);

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
          disabled={exporting}
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">From</label>
                  <input
                    type="date"
                    value={config.dateFrom}
                    max={config.dateTo}
                    onChange={(e) => set('dateFrom', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">To</label>
                  <input
                    type="date"
                    value={config.dateTo}
                    min={config.dateFrom}
                    max={today()}
                    onChange={(e) => set('dateTo', e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-border bg-white text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-colors"
                  />
                </div>
              </div>
              {/* Quick ranges */}
              <div className="flex flex-wrap gap-2 mt-3">
                {[
                  { label: 'Last 30 days', days: 30 },
                  { label: 'Last 90 days', days: 90 },
                  { label: 'Last 6 months', days: 180 },
                  { label: 'This year', days: 365 },
                ].map(({ label, days }) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => {
                      const from = new Date();
                      from.setDate(from.getDate() - days);
                      set('dateFrom', from.toISOString().slice(0, 10));
                      set('dateTo', today());
                    }}
                    className="px-2.5 py-1 rounded-md border border-border text-xs text-muted-foreground hover:border-primary/40 hover:text-primary hover:bg-primary/5 transition-colors"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </section>

            {/* Filters */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Filter size={15} className="text-primary" />
                Filters
                {(config.registries.length + config.statuses.length + config.collateralTypes.length) > 0 && (
                  <span className="ml-auto text-xs text-primary font-600 bg-primary/10 px-2 py-0.5 rounded-full">
                    {config.registries.length + config.statuses.length + config.collateralTypes.length} active
                  </span>
                )}
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">Registry</label>
                  <MultiSelect
                    label="Registries"
                    options={REGISTRIES}
                    selected={config.registries}
                    onChange={(v) => set('registries', v)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">Status</label>
                  <MultiSelect
                    label="Statuses"
                    options={STATUSES}
                    selected={config.statuses}
                    onChange={(v) => set('statuses', v)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-600 text-muted-foreground mb-1.5">Collateral Type</label>
                  <MultiSelect
                    label="Types"
                    options={COLLATERAL_TYPES}
                    selected={config.collateralTypes}
                    onChange={(v) => set('collateralTypes', v)}
                  />
                </div>
              </div>
              {(config.registries.length + config.statuses.length + config.collateralTypes.length) > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    set('registries', []);
                    set('statuses', []);
                    set('collateralTypes', []);
                  }}
                  className="mt-3 text-xs text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors"
                >
                  <X size={12} /> Clear all filters
                </button>
              )}
            </section>

            {/* Content Options */}
            <section className="bg-white rounded-xl border border-border p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Building2 size={15} className="text-primary" />
                Content Options
              </h2>
              <div className="space-y-3">
                {[
                  { key: 'stakeholderMode' as const, label: 'Stakeholder Mode', desc: 'Clean formatting with executive summary, logos, and cover page' },
                  { key: 'includeSummary' as const, label: 'Include Summary Section', desc: 'KPI totals, perfection rate, and key metrics at the top' },
                  { key: 'includeCharts' as const, label: 'Include Charts & Visuals', desc: 'Bar charts, trend lines, and compliance gauges (PDF only)' },
                  { key: 'includeDetails' as const, label: 'Include Detail Records', desc: 'Full row-level data table for all matching collateral' },
                ].map(({ key, label, desc }) => (
                  <label key={key} className="flex items-start gap-3 cursor-pointer group">
                    <div className="relative mt-0.5">
                      <input
                        type="checkbox"
                        checked={config[key] as boolean}
                        onChange={(e) => set(key, e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                          config[key] ? 'bg-primary border-primary' : 'border-border group-hover:border-primary/50'
                        }`}
                      >
                        {config[key] && (
                          <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                            <path d="M1 3.5L3.5 6L8 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                    </div>
                    <div>
                      <p className="text-sm font-500 text-foreground leading-tight">{label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                    </div>
                  </label>
                ))}
              </div>
            </section>
          </div>

          {/* Right: Preview panel */}
          <div className="flex flex-col gap-5">
            {/* Export Summary Card */}
            <div className="bg-white rounded-xl border border-border p-5 sticky top-0">
              <h2 className="text-sm font-700 text-foreground mb-4">Export Preview</h2>

              {/* Selected report */}
              <div className={`flex items-center gap-3 p-3 rounded-lg ${selectedReport.bg} mb-4`}>
                <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${selectedReport.bg}`}>
                  <selectedReport.icon size={18} className={selectedReport.color} />
                </div>
                <div>
                  <p className={`text-sm font-600 ${selectedReport.color}`}>{selectedReport.label}</p>
                  <p className="text-xs text-muted-foreground">{selectedReport.description}</p>
                </div>
              </div>

              {/* Format badge */}
              <div className="flex items-center gap-2 mb-4">
                <selectedFormat.icon size={14} className="text-muted-foreground" />
                <span className="text-sm text-foreground font-500">{selectedFormat.label}</span>
                <span className="text-xs text-muted-foreground">{selectedFormat.ext}</span>
                <span className="ml-auto text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                  {config.stakeholderMode ? 'Stakeholder' : 'Standard'}
                </span>
              </div>

              {/* Date range */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4 bg-muted/50 rounded-lg px-3 py-2">
                <Calendar size={12} />
                <span>{config.dateFrom}</span>
                <span>→</span>
                <span>{config.dateTo}</span>
              </div>

              {/* Active filters */}
              {(config.registries.length + config.statuses.length + config.collateralTypes.length) > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-600 text-muted-foreground mb-2">Active Filters</p>
                  <div className="flex flex-wrap gap-1.5">
                    {[...config.registries, ...config.statuses, ...config.collateralTypes].map((f) => (
                      <span key={f} className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-500">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Data preview stats */}
              <div className="mb-5">
                <p className="text-xs font-600 text-muted-foreground mb-2">Data Preview</p>
                <PreviewStats config={config} />
              </div>

              {/* Export button */}
              <button
                onClick={handleExport}
                disabled={exporting}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
              >
                {exporting ? (
                  <RefreshCw size={15} className="animate-spin" />
                ) : (
                  <Download size={15} />
                )}
                {exporting ? 'Generating…' : `Export as ${selectedFormat.label}`}
              </button>

              {exported && (
                <div className="mt-3 flex items-center gap-2 text-xs text-emerald-700">
                  <CheckCircle2 size={13} />
                  <span className="truncate">{exported}</span>
                </div>
              )}

              {/* Tip */}
              <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-100 rounded-lg">
                <AlertTriangle size={13} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-800 leading-snug">
                  PDF exports open a print dialog. Use <strong>Save as PDF</strong> in your browser for best results.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
