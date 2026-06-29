'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, Save, Trash2, Calendar, FileText, Download, RefreshCw, Clock, Filter, ChevronDown, ChevronUp, Edit2, CheckCircle2, AlertCircle, FileSpreadsheet, X, Play,  } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  customReportsService,
  type CustomReport,
  type ExportFormat,
  type ScheduleFrequency,
  type ReportFilters,
} from '@/lib/supabase/customReportsService';
import Icon from '@/components/ui/AppIcon';


// ─── Constants ────────────────────────────────────────────────────────────────

const COLLATERAL_TYPES = [
  'Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel',
];
const STATUSES = [
  'Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected',
];
const REGISTRIES = ['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];
const EXPORT_FORMATS: { value: ExportFormat; label: string; icon: React.ElementType; color: string }[] = [
  { value: 'csv', label: 'CSV', icon: FileText, color: 'text-green-600 bg-green-50 border-green-200' },
  { value: 'pdf', label: 'PDF', icon: FileText, color: 'text-red-600 bg-red-50 border-red-200' },
  { value: 'excel', label: 'Excel', icon: FileSpreadsheet, color: 'text-emerald-600 bg-emerald-50 border-emerald-200' },
];
const FREQUENCIES: { value: ScheduleFrequency; label: string }[] = [
  { value: 'once', label: 'One-time' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
];

const EMPTY_FILTERS: ReportFilters = {
  collateralTypes: [],
  statuses: [],
  registries: [],
  officers: [],
};

interface FormState {
  name: string;
  description: string;
  filters: ReportFilters;
  dateFrom: string;
  dateTo: string;
  exportFormat: ExportFormat;
  isScheduled: boolean;
  scheduleFrequency: ScheduleFrequency;
  nextRunAt: string;
}

const EMPTY_FORM: FormState = {
  name: '',
  description: '',
  filters: { ...EMPTY_FILTERS },
  dateFrom: '',
  dateTo: '',
  exportFormat: 'csv',
  isScheduled: false,
  scheduleFrequency: 'once',
  nextRunAt: '',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function toggleItem<T>(arr: T[], item: T): T[] {
  return arr.includes(item) ? arr.filter((x) => x !== item) : [...arr, item];
}

function activeFilterCount(f: ReportFilters): number {
  return f.collateralTypes.length + f.statuses.length + f.registries.length + f.officers.length;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, icon: Icon, children }: {
  title: string; icon: React.ElementType; children: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          <Icon size={15} className="text-primary" />
        </div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function MultiSelect({ label, options, selected, onChange }: {
  label: string; options: string[]; selected: string[]; onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <label className="block text-xs font-500 text-muted-foreground mb-1">{label}</label>
      <button
        type="button"
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-3 py-2 border border-border rounded-lg text-sm bg-white hover:border-primary/40 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <span className={selected.length === 0 ? 'text-muted-foreground' : 'text-foreground'}>
          {selected.length === 0 ? `All ${label}` : `${selected.length} selected`}
        </span>
        {open ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
      </button>
      {open && (
        <div className="absolute z-30 top-full mt-1 left-0 right-0 bg-white border border-border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map((opt) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 hover:bg-muted cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={selected.includes(opt)}
                onChange={() => onChange(toggleItem(selected, opt))}
                className="rounded border-border accent-primary"
              />
              <span className="text-foreground">{opt}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Report Form ──────────────────────────────────────────────────────────────

function ReportForm({
  initial,
  officers,
  onSave,
  onCancel,
  saving,
}: {
  initial: FormState;
  officers: string[];
  onSave: (f: FormState) => void;
  onCancel: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const set = (key: keyof FormState, value: any) =>
    setForm((p) => ({ ...p, [key]: value }));

  const setFilter = (key: keyof ReportFilters, value: string[]) =>
    setForm((p) => ({ ...p, filters: { ...p.filters, [key]: value } }));

  const filterCount = activeFilterCount(form.filters);

  return (
    <div className="space-y-5">
      {/* Name & Description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-500 text-muted-foreground mb-1">Report Name <span className="text-red-500">*</span></label>
          <input
            type="text"
            value={form.name}
            onChange={(e) => set('name', e.target.value)}
            placeholder="e.g. Monthly Mortgage Compliance"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>
        <div>
          <label className="block text-xs font-500 text-muted-foreground mb-1">Description</label>
          <input
            type="text"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Optional description"
            className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
          />
        </div>
      </div>

      {/* Collateral Filters */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-600 text-foreground uppercase tracking-wider">Collateral Filters</span>
          {filterCount > 0 && (
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full font-600">{filterCount} active</span>
          )}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MultiSelect
            label="Collateral Types"
            options={COLLATERAL_TYPES}
            selected={form.filters.collateralTypes}
            onChange={(v) => setFilter('collateralTypes', v)}
          />
          <MultiSelect
            label="Statuses"
            options={STATUSES}
            selected={form.filters.statuses}
            onChange={(v) => setFilter('statuses', v)}
          />
          <MultiSelect
            label="Registries"
            options={REGISTRIES}
            selected={form.filters.registries}
            onChange={(v) => setFilter('registries', v)}
          />
          <MultiSelect
            label="Officers"
            options={officers}
            selected={form.filters.officers}
            onChange={(v) => setFilter('officers', v)}
          />
        </div>
      </div>

      {/* Date Range */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-muted-foreground" />
          <span className="text-xs font-600 text-foreground uppercase tracking-wider">Date Range</span>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-500 text-muted-foreground mb-1">From</label>
            <input
              type="date"
              value={form.dateFrom}
              onChange={(e) => set('dateFrom', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>
          <div>
            <label className="block text-xs font-500 text-muted-foreground mb-1">To</label>
            <input
              type="date"
              value={form.dateTo}
              onChange={(e) => set('dateTo', e.target.value)}
              className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
            />
          </div>
        </div>
      </div>

      {/* Export Format */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Download size={14} className="text-muted-foreground" />
          <span className="text-xs font-600 text-foreground uppercase tracking-wider">Export Format</span>
        </div>
        <div className="flex gap-3">
          {EXPORT_FORMATS.map((fmt) => {
            const FmtIcon = fmt.icon;
            const active = form.exportFormat === fmt.value;
            return (
              <button
                key={fmt.value}
                type="button"
                onClick={() => set('exportFormat', fmt.value)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm font-500 transition-all ${
                  active ? fmt.color + ' ring-2 ring-offset-1 ring-primary/30' : 'border-border text-muted-foreground hover:border-primary/30 hover:text-foreground'
                }`}
              >
                <FmtIcon size={14} />
                {fmt.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Schedule */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <Clock size={14} className="text-muted-foreground" />
          <span className="text-xs font-600 text-foreground uppercase tracking-wider">Schedule</span>
        </div>
        <div className="flex items-center gap-3 mb-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={form.isScheduled}
              onChange={(e) => set('isScheduled', e.target.checked)}
              className="rounded border-border accent-primary w-4 h-4"
            />
            <span className="text-sm text-foreground font-500">Enable scheduled delivery</span>
          </label>
        </div>
        {form.isScheduled && (
          <div className="grid grid-cols-2 gap-4 pl-6 border-l-2 border-primary/20">
            <div>
              <label className="block text-xs font-500 text-muted-foreground mb-1">Frequency</label>
              <select
                value={form.scheduleFrequency}
                onChange={(e) => set('scheduleFrequency', e.target.value as ScheduleFrequency)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {FREQUENCIES.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-500 text-muted-foreground mb-1">Next Run</label>
              <input
                type="datetime-local"
                value={form.nextRunAt}
                onChange={(e) => set('nextRunAt', e.target.value)}
                className="w-full px-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-2 border-t border-border">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-500 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          disabled={!form.name.trim() || saving}
          onClick={() => onSave(form)}
          className="flex items-center gap-2 px-5 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <Save size={14} />
          {saving ? 'Saving…' : 'Save Report'}
        </button>
      </div>
    </div>
  );
}

// ─── Report Card ──────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onEdit,
  onDelete,
  onRun,
}: {
  report: CustomReport;
  onEdit: () => void;
  onDelete: () => void;
  onRun: () => void;
}) {
  const filterCount = activeFilterCount(report.filters);
  const fmtObj = EXPORT_FORMATS.find((f) => f.value === report.exportFormat);
  const freqObj = FREQUENCIES.find((f) => f.value === report.scheduleFrequency);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm hover:shadow-md transition-shadow p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0">
          <h4 className="text-sm font-bold text-foreground truncate">{report.name}</h4>
          {report.description && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{report.description}</p>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {report.isScheduled && (
            <span className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-500">
              <Clock size={10} />
              {freqObj?.label}
            </span>
          )}
          <span className={`text-xs px-2 py-0.5 rounded-full border font-500 ${fmtObj?.color ?? ''}`}>
            {fmtObj?.label}
          </span>
        </div>
      </div>

      {/* Filter chips */}
      {filterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          {report.filters.collateralTypes.map((t) => (
            <span key={t} className="text-xs bg-primary/8 text-primary px-2 py-0.5 rounded-full">{t}</span>
          ))}
          {report.filters.statuses.map((s) => (
            <span key={s} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{s}</span>
          ))}
          {report.filters.registries.map((r) => (
            <span key={r} className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full">{r}</span>
          ))}
          {report.filters.officers.map((o) => (
            <span key={o} className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">{o}</span>
          ))}
        </div>
      )}

      {/* Date range */}
      {(report.dateFrom || report.dateTo) && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <Calendar size={11} />
          <span>{fmtDate(report.dateFrom)} → {fmtDate(report.dateTo)}</span>
        </div>
      )}

      {/* Schedule info */}
      {report.isScheduled && report.nextRunAt && (
        <div className="flex items-center gap-1.5 text-xs text-blue-600 mb-3">
          <Clock size={11} />
          <span>Next run: {fmtDateTime(report.nextRunAt)}</span>
        </div>
      )}
      {report.lastRunAt && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
          <CheckCircle2 size={11} />
          <span>Last run: {fmtDateTime(report.lastRunAt)}</span>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <button
          onClick={onRun}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-600 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Play size={11} />
          Run Now
        </button>
        <button
          onClick={onEdit}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-border text-xs font-500 text-foreground rounded-lg hover:bg-muted transition-colors"
        >
          <Edit2 size={11} />
          Edit
        </button>
        <button
          onClick={onDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 border border-red-200 text-xs font-500 text-red-600 rounded-lg hover:bg-red-50 transition-colors ml-auto"
        >
          <Trash2 size={11} />
          Delete
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CustomReportsContent() {
  const [reports, setReports] = useState<CustomReport[]>([]);
  const [officers, setOfficers] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingReport, setEditingReport] = useState<CustomReport | null>(null);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3500);
  };

  // Load reports and officers
  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reps, supabase] = [customReportsService.getAll(), createClient()];
      const [reportsData, officersRes] = await Promise.all([
        reps,
        supabase.from('collateral_records').select('assigned_officer').not('assigned_officer', 'is', null),
      ]);
      setReports(reportsData);
      const uniqueOfficers = Array.from(
        new Set((officersRes.data ?? []).map((r: any) => r.assigned_officer).filter(Boolean))
      ) as string[];
      setOfficers(uniqueOfficers.length > 0 ? uniqueOfficers : ['J. Kamau', 'A. Mwangi', 'P. Ochieng', 'S. Ndege']);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load reports');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Save (create or update)
  const handleSave = async (form: FormState) => {
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim(),
        filters: form.filters,
        dateFrom: form.dateFrom || null,
        dateTo: form.dateTo || null,
        exportFormat: form.exportFormat,
        isScheduled: form.isScheduled,
        scheduleFrequency: form.scheduleFrequency,
        nextRunAt: form.isScheduled && form.nextRunAt ? new Date(form.nextRunAt).toISOString() : null,
      };
      if (editingReport) {
        const updated = await customReportsService.update(editingReport.id, payload);
        setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
        showToast('success', 'Report updated successfully');
      } else {
        const created = await customReportsService.create(payload);
        setReports((prev) => [created, ...prev]);
        showToast('success', 'Report saved successfully');
      }
      setShowForm(false);
      setEditingReport(null);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to save report');
    } finally {
      setSaving(false);
    }
  };

  // Delete
  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await customReportsService.delete(id);
      setReports((prev) => prev.filter((r) => r.id !== id));
      showToast('success', 'Report deleted');
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to delete report');
    } finally {
      setDeletingId(null);
    }
  };

  // Run now — generate CSV from Supabase data
  const handleRun = async (report: CustomReport) => {
    try {
      const supabase = createClient();
      let query = supabase.from('collateral_records').select('*');

      if (report.filters.collateralTypes.length > 0)
        query = query.in('collateral_type', report.filters.collateralTypes);
      if (report.filters.statuses.length > 0)
        query = query.in('status', report.filters.statuses);
      if (report.filters.registries.length > 0)
        query = query.in('registry', report.filters.registries);
      if (report.filters.officers.length > 0)
        query = query.in('assigned_officer', report.filters.officers);
      if (report.dateFrom)
        query = query.gte('perfection_deadline', report.dateFrom);
      if (report.dateTo)
        query = query.lte('perfection_deadline', report.dateTo);

      const { data, error: qErr } = await query.order('created_at', { ascending: false });
      if (qErr) throw qErr;

      const rows = data ?? [];
      const headers = ['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Value (TSh)', 'Perfection Deadline', 'Assigned Officer'];
      const lines = [
        headers.join(','),
        ...rows.map((r: any) => [
          r.collateral_id ?? '',
          `"${r.obligor ?? ''}"`,
          r.collateral_type ?? '',
          r.registry ?? '',
          r.status ?? '',
          r.value_tsh ?? '',
          r.perfection_deadline ?? '',
          r.assigned_officer ?? '',
        ].join(',')),
      ];

      const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${report.name.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      // Update last_run_at
      const updated = await customReportsService.update(report.id, { lastRunAt: new Date().toISOString() });
      setReports((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
      showToast('success', `Report "${report.name}" exported (${rows.length} records)`);
    } catch (err: any) {
      showToast('error', err?.message ?? 'Failed to run report');
    }
  };

  const formInitial: FormState = editingReport
    ? {
        name: editingReport.name,
        description: editingReport.description,
        filters: editingReport.filters,
        dateFrom: editingReport.dateFrom ?? '',
        dateTo: editingReport.dateTo ?? '',
        exportFormat: editingReport.exportFormat,
        isScheduled: editingReport.isScheduled,
        scheduleFrequency: editingReport.scheduleFrequency,
        nextRunAt: editingReport.nextRunAt
          ? new Date(editingReport.nextRunAt).toISOString().slice(0, 16)
          : '',
      }
    : EMPTY_FORM;

  const scheduledReports = reports.filter((r) => r.isScheduled);
  const unscheduledReports = reports.filter((r) => !r.isScheduled);

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg text-sm font-500 fade-in ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
          <button onClick={() => setToast(null)} className="ml-1 opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-black text-foreground">Custom Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Build, save, and schedule tailored collateral reports with custom filters and export formats
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          {!showForm && (
            <button
              onClick={() => { setEditingReport(null); setShowForm(true); }}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus size={15} />
              New Report
            </button>
          )}
        </div>
      </div>

      {/* Form */}
      {showForm && (
        <SectionCard title={editingReport ? 'Edit Report' : 'Create New Report'} icon={FileText}>
          <ReportForm
            initial={formInitial}
            officers={officers}
            onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditingReport(null); }}
            saving={saving}
          />
        </SectionCard>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertCircle size={15} />
          {error}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-5 animate-pulse">
              <div className="h-4 bg-muted rounded w-2/3 mb-2" />
              <div className="h-3 bg-muted rounded w-1/2 mb-4" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-3/4" />
            </div>
          ))}
        </div>
      )}

      {/* Scheduled Reports */}
      {!loading && scheduledReports.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Clock size={15} className="text-blue-600" />
            <h2 className="text-sm font-bold text-foreground">Scheduled Reports</h2>
            <span className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full font-600">
              {scheduledReports.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {scheduledReports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onEdit={() => { setEditingReport(r); setShowForm(true); }}
                onDelete={() => handleDelete(r.id)}
                onRun={() => handleRun(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Saved Reports */}
      {!loading && unscheduledReports.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText size={15} className="text-muted-foreground" />
            <h2 className="text-sm font-bold text-foreground">Saved Reports</h2>
            <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded-full font-600">
              {unscheduledReports.length}
            </span>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {unscheduledReports.map((r) => (
              <ReportCard
                key={r.id}
                report={r}
                onEdit={() => { setEditingReport(r); setShowForm(true); }}
                onDelete={() => handleDelete(r.id)}
                onRun={() => handleRun(r)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && reports.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <FileText size={24} className="text-primary" />
          </div>
          <h3 className="text-base font-bold text-foreground mb-1">No custom reports yet</h3>
          <p className="text-sm text-muted-foreground mb-5 max-w-xs">
            Create your first report with custom collateral filters, date ranges, and export formats.
          </p>
          <button
            onClick={() => { setEditingReport(null); setShowForm(true); }}
            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-600 rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={15} />
            Create First Report
          </button>
        </div>
      )}
    </div>
  );
}
