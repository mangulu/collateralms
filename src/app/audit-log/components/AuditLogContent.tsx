'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Search, Filter, Download, RefreshCw, ChevronDown, ChevronRight, User, Clock, FileText, ArrowRight, X, Calendar, AlertCircle, Link2, Stamp, Layers, BarChart2, SlidersHorizontal, Database, FileDown } from 'lucide-react';
import { auditLogService, AuditLogEntry, FieldChange } from '@/lib/supabase/auditLogService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

// ─── Action Styles ────────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  created:              { bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500' },
  updated:              { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  deleted:              { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  perfected:            { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500' },
  overdue:              { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  submitted:            { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500' },
  reviewed:             { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  approved:             { bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500' },
  rejected:             { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500' },
  returned:             { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  commented:            { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400' },
  reopened:             { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  STATUS_CHANGE:        { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  status_changed:       { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500' },
  DOCUMENT_UPLOAD:      { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  DOCUMENT_DELETE:      { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  document_uploaded:    { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  document_deleted:     { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  sms_sent:             { bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  login:                { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  logout:               { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400' },
  export:               { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  bulk_upload:          { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  user_created:         { bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500' },
  user_updated:         { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  user_deactivated:     { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500' },
  REVIEW:               { bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  charge_rank_changed:  { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500' },
  equity_recalculated:  { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  discharge_recorded:   { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500' },
  batch_release:        { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500' },
  loan_linked:          { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500' },
  loan_released:        { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500' },
};

const ENTITY_LABELS: Record<string, string> = {
  collateral:           'Collateral',
  perfection_request:   'Perfection Request',
  user:                 'User',
  document:             'Document',
  system:               'System',
  collateral_link:      'Collateral Link',
  charge_registry:      'Charge Registry',
  batch_operation:      'Batch Operation',
  sms_alert:            'SMS Alert',
};

function getActionStyle(action: string) {
  return ACTION_STYLES[action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
}

const ENTITY_ICON_MAP: Record<string, React.ElementType> = {
  collateral:           FileText,
  perfection_request:   Stamp,
  user:                 User,
  document:             FileText,
  system:               BarChart2,
  collateral_link:      Link2,
  charge_registry:      Stamp,
  batch_operation:      Layers,
  sms_alert:            BarChart2,
};

// ─── FieldChangeDiff ──────────────────────────────────────────────────────────

function FieldChangeDiff({ changes }: { changes: FieldChange[] }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field-Level Changes</p>
      </div>
      <div className="divide-y divide-border">
        {changes.map((change, idx) => (
          <div key={idx} className="px-3 py-2.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground mb-1">{change.label}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {change.old_value ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 font-mono">{change.old_value}</span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">empty</span>
                )}
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                {change.new_value ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 font-mono">{change.new_value}</span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">empty</span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── BatchSummaryPanel ────────────────────────────────────────────────────────

interface BatchSummaryItem { label: string; value: string | number; highlight?: boolean }

function BatchSummaryPanel({ items }: { items: BatchSummaryItem[] }) {
  return (
    <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 overflow-hidden">
      <div className="px-3 py-2 border-b border-amber-200 bg-amber-100/60">
        <p className="text-xs font-semibold text-amber-800 uppercase tracking-wider flex items-center gap-1">
          <Layers size={11} /> Batch Operation Summary
        </p>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-px bg-amber-200">
        {items.map((item, i) => (
          <div key={i} className="bg-amber-50 px-3 py-2">
            <p className="text-xs text-amber-700">{item.label}</p>
            <p className={`text-sm font-bold font-mono ${item.highlight ? 'text-amber-900' : 'text-amber-800'}`}>{item.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── AuditLogRow ──────────────────────────────────────────────────────────────

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActionStyle(entry.action);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
  const hasDetail = !!entry.detail;
  const hasBatchSummary = !!entry.batchSummary;
  const isExpandable = hasChanges || hasDetail || hasBatchSummary;
  const EventIcon = ENTITY_ICON_MAP[entry.entityType] ?? FileText;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${isExpandable ? 'cursor-pointer' : ''}`}
        onClick={() => isExpandable && setExpanded((v) => !v)}
      >
        <div className="flex flex-col items-center pt-1.5 shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                {entry.action.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <EventIcon size={10} />
                {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
              </span>
              {entry.collateralId && (
                <span className="text-xs font-mono text-primary bg-primary/5 border border-primary/20 px-2 py-0.5 rounded">
                  {entry.collateralId}
                </span>
              )}
              {entry.eventCategory === 'multi_collateral' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                  <Link2 size={9} /> Multi-Collateral
                </span>
              )}
              {entry.eventCategory === 'batch_operation' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  <Layers size={9} /> Batch
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock size={11} />
              <span>{formatDateTime(entry.createdAt)}</span>
            </div>
          </div>

          <p className="text-sm text-foreground mt-1 leading-snug">{entry.message}</p>

          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User size={11} />
              <span>{entry.performedByName || 'System'}</span>
            </div>
            {entry.ipAddress && (
              <span className="text-xs text-muted-foreground font-mono">{entry.ipAddress}</span>
            )}
            {entry.detail && !expanded && (
              <span className="text-xs text-muted-foreground truncate max-w-xs">{entry.detail}</span>
            )}
            {entry.reason && !expanded && (
              <span className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 truncate max-w-xs" title={`Reason: ${entry.reason}`}>
                Reason: {entry.reason}
              </span>
            )}
            {hasChanges && (
              <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''} changed
                {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
            )}
            {!hasChanges && hasBatchSummary && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
                Batch summary {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
            )}
          </div>

          {expanded && (
            <div className="mt-2">
              {entry.detail && <p className="text-xs text-muted-foreground mb-2">{entry.detail}</p>}
              {entry.reason && (
                <div className="flex items-start gap-1.5 mb-2 bg-amber-50 border border-amber-200 rounded-md px-2.5 py-1.5">
                  <span className="text-xs font-semibold text-amber-700 shrink-0 mt-0.5">Reason:</span>
                  <span className="text-xs text-amber-800">{entry.reason}</span>
                </div>
              )}
              {hasChanges && <FieldChangeDiff changes={entry.fieldChanges!} />}
              {hasBatchSummary && <BatchSummaryPanel items={entry.batchSummary!} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: IconComp, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
  const Icon = IconComp;
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {Icon && <Icon size={18} className="" />}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground font-mono">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ─── Filter Select ────────────────────────────────────────────────────────────

function FilterSelect({
  label, value, onChange, options, placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-1 min-w-0">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
        >
          <option value="All">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditLogContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Primary filters (always visible)
  const [actionFilter, setActionFilter] = useState('All');
  const [userFilter, setUserFilter] = useState('All');
  const [collateralFilter, setCollateralFilter] = useState('All');

  // Secondary filters (expandable)
  const [search, setSearch] = useState('');
  const [entityFilter, setEntityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Filter options from DB
  const [distinctActions, setDistinctActions] = useState<string[]>([]);
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [distinctCollaterals, setDistinctCollaterals] = useState<string[]>([]);

  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [page, setPage] = useState(1);
  const [isExportingPdf, setIsExportingPdf] = useState(false);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [data, actions, users, collaterals] = await Promise.all([
        auditLogService.getAll({
          search,
          action: actionFilter,
          entityType: entityFilter,
          eventCategory: categoryFilter,
          dateFrom,
          dateTo,
          performedBy: userFilter,
          collateralId: collateralFilter,
        }),
        auditLogService.getDistinctActions(),
        auditLogService.getDistinctUsers(),
        auditLogService.getDistinctCollateralIds(),
      ]);
      setEntries(data);
      setDistinctActions(actions);
      setDistinctUsers(users);
      setDistinctCollaterals(collaterals);
      setLastRefreshed(new Date());
    } catch (err) {
      setError('Failed to load audit logs. Please try again.');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, actionFilter, entityFilter, categoryFilter, dateFrom, dateTo, userFilter, collateralFilter]);

  useEffect(() => {
    loadData();
    setPage(1);
  }, [loadData]);

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const paginated = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI counts
  const today = new Date().toDateString();
  const todayCount = entries.filter((e) => new Date(e.createdAt).toDateString() === today).length;
  const withChanges = entries.filter((e) => Array.isArray(e.fieldChanges) && e.fieldChanges.length > 0).length;
  const uniqueUsers = new Set(entries.map((e) => e.performedByName)).size;
  const uniqueCollaterals = new Set(entries.map((e) => e.collateralId).filter(Boolean)).size;

  const hasActiveFilters =
    actionFilter !== 'All' || userFilter !== 'All' || collateralFilter !== 'All' ||
    search || entityFilter !== 'All' || categoryFilter !== 'All' || dateFrom || dateTo;

  function clearFilters() {
    setActionFilter('All');
    setUserFilter('All');
    setCollateralFilter('All');
    setSearch('');
    setEntityFilter('All');
    setCategoryFilter('All');
    setDateFrom('');
    setDateTo('');
  }

  function exportCSV() {
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Collateral ID', 'Message', 'Detail', 'Performed By', 'IP Address', 'Category', 'Field Changes'];
    const rows = entries.map((e) => [
      formatDateTime(e.createdAt),
      e.action,
      ENTITY_LABELS[e.entityType] ?? e.entityType,
      e.collateralId ?? '',
      e.message,
      e.detail,
      e.performedByName,
      e.ipAddress ?? '',
      e.eventCategory ?? '',
      e.fieldChanges
        ? e.fieldChanges.map((f) => `${f.label}: ${f.old_value || 'empty'} → ${f.new_value || 'empty'}`).join('; ')
        : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportPDF() {
    setIsExportingPdf(true);
    try {
      const res = await fetch('/api/export/audit-log-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          search,
          action: actionFilter,
          entityType: entityFilter,
          eventCategory: categoryFilter,
          dateFrom,
          dateTo,
          performedBy: userFilter,
          collateralId: collateralFilter,
        }),
      });
      if (!res.ok) throw new Error('PDF generation failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_log_compliance_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      // silently fail — user can retry
    } finally {
      setIsExportingPdf(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ClipboardList size={20} className="text-primary" />
              <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full flex items-center gap-1">
                <Database size={10} /> Live
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete audit trail of all system actions — filter by action type, user, or collateral record
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button
              onClick={loadData}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={entries.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
            >
              <Download size={14} />
              CSV
            </button>
            <button
              onClick={exportPDF}
              disabled={entries.length === 0 || isExportingPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              <FileDown size={14} className={isExportingPdf ? 'animate-pulse' : ''} />
              {isExportingPdf ? 'Generating…' : 'Export PDF'}
            </button>
          </div>
        </div>
      </div>

      {/* ── KPI Strip ──────────────────────────────────────────────────────── */}
      <div className="px-6 pt-4 pb-3 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <KpiCard label="Total Events"        value={entries.length} icon={ClipboardList} color="bg-primary/10 text-primary" />
        <KpiCard label="Events Today"        value={todayCount}     icon={Calendar}      color="bg-amber-100 text-amber-600" />
        <KpiCard label="Active Users"        value={uniqueUsers}    icon={User}          color="bg-green-100 text-green-600" />
        <KpiCard label="Collateral Records"  value={uniqueCollaterals} icon={FileText}   color="bg-blue-100 text-blue-600" />
      </div>

      {/* ── Primary Filters ─────────────────────────────────────────────────── */}
      <div className="px-6 pb-3 shrink-0">
        <div className="bg-white border border-border rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <SlidersHorizontal size={14} className="text-primary" />
            <span className="text-sm font-semibold text-foreground">Filters</span>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={12} /> Clear all
              </button>
            )}
          </div>

          {/* Three primary filters */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <FilterSelect
              label="Action"
              value={actionFilter}
              onChange={(v) => { setActionFilter(v); setPage(1); }}
              placeholder="All Actions"
              options={distinctActions.map((a) => ({ value: a, label: a.replace(/_/g, ' ').toUpperCase() }))}
            />
            <FilterSelect
              label="User"
              value={userFilter}
              onChange={(v) => { setUserFilter(v); setPage(1); }}
              placeholder="All Users"
              options={distinctUsers.map((u) => ({ value: u, label: u }))}
            />
            <FilterSelect
              label="Collateral Record"
              value={collateralFilter}
              onChange={(v) => { setCollateralFilter(v); setPage(1); }}
              placeholder="All Records"
              options={distinctCollaterals.map((c) => ({ value: c, label: c }))}
            />
          </div>

          {/* Search + Advanced toggle */}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search by message, collateral ID, user, IP…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => setShowAdvanced((v) => !v)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                showAdvanced ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white hover:bg-muted text-foreground/70'
              }`}
            >
              <Filter size={13} />
              Advanced
              {(entityFilter !== 'All' || categoryFilter !== 'All' || dateFrom || dateTo) && (
                <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              )}
            </button>
          </div>

          {/* Advanced filters */}
          {showAdvanced && (
            <div className="mt-3 pt-3 border-t border-border grid grid-cols-1 sm:grid-cols-4 gap-3">
              <FilterSelect
                label="Entity Type"
                value={entityFilter}
                onChange={(v) => { setEntityFilter(v); setPage(1); }}
                placeholder="All Entities"
                options={Object.entries(ENTITY_LABELS).map(([k, v]) => ({ value: k, label: v }))}
              />
              <FilterSelect
                label="Event Category"
                value={categoryFilter}
                onChange={(v) => { setCategoryFilter(v); setPage(1); }}
                placeholder="All Categories"
                options={[
                  { value: 'collateral_change',  label: 'Collateral Change' },
                  { value: 'status_transition',  label: 'Status Transition' },
                  { value: 'document',           label: 'Document' },
                  { value: 'sms',                label: 'SMS' },
                  { value: 'login',              label: 'Login / Auth' },
                  { value: 'export',             label: 'Export' },
                  { value: 'batch_operation',    label: 'Batch Operation' },
                  { value: 'user_management',    label: 'User Management' },
                  { value: 'multi_collateral',   label: 'Multi-Collateral' },
                  { value: 'charge_registry',    label: 'Charge Registry' },
                  { value: 'system',             label: 'System' },
                ]}
              />
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">From Date</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                  className="text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">To Date</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                  className="text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Active Filter Chips ─────────────────────────────────────────────── */}
      {hasActiveFilters && (
        <div className="px-6 pb-2 shrink-0 flex items-center gap-2 flex-wrap">
          {actionFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-primary/10 text-primary border border-primary/20 rounded-full px-2.5 py-1">
              Action: {actionFilter.replace(/_/g, ' ')}
              <button onClick={() => setActionFilter('All')} className="hover:text-primary/60"><X size={10} /></button>
            </span>
          )}
          {userFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 border border-green-200 rounded-full px-2.5 py-1">
              User: {userFilter}
              <button onClick={() => setUserFilter('All')} className="hover:text-green-500"><X size={10} /></button>
            </span>
          )}
          {collateralFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2.5 py-1 font-mono">
              Record: {collateralFilter}
              <button onClick={() => setCollateralFilter('All')} className="hover:text-blue-500"><X size={10} /></button>
            </span>
          )}
          {search && (
            <span className="inline-flex items-center gap-1 text-xs bg-muted text-foreground/70 border border-border rounded-full px-2.5 py-1">
              Search: &ldquo;{search}&rdquo;
              <button onClick={() => setSearch('')} className="hover:text-foreground"><X size={10} /></button>
            </span>
          )}
          {entityFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-muted text-foreground/70 border border-border rounded-full px-2.5 py-1">
              Entity: {ENTITY_LABELS[entityFilter] ?? entityFilter}
              <button onClick={() => setEntityFilter('All')} className="hover:text-foreground"><X size={10} /></button>
            </span>
          )}
          {categoryFilter !== 'All' && (
            <span className="inline-flex items-center gap-1 text-xs bg-muted text-foreground/70 border border-border rounded-full px-2.5 py-1">
              Category: {categoryFilter.replace(/_/g, ' ')}
              <button onClick={() => setCategoryFilter('All')} className="hover:text-foreground"><X size={10} /></button>
            </span>
          )}
          {(dateFrom || dateTo) && (
            <span className="inline-flex items-center gap-1 text-xs bg-muted text-foreground/70 border border-border rounded-full px-2.5 py-1">
              Date: {dateFrom || '…'} → {dateTo || '…'}
              <button onClick={() => { setDateFrom(''); setDateTo(''); }} className="hover:text-foreground"><X size={10} /></button>
            </span>
          )}
        </div>
      )}

      {/* ── Error Banner ────────────────────────────────────────────────────── */}
      {error && (
        <div className="mx-6 mb-3 shrink-0 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
          <AlertCircle size={16} className="text-red-500 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={loadData} className="ml-auto text-xs text-red-600 underline hover:text-red-800">Retry</button>
        </div>
      )}

      {/* ── Log Table ───────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {isLoading
                ? 'Loading…'
                : `${entries.length.toLocaleString()} event${entries.length !== 1 ? 's' : ''}`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Page {page} of {totalPages}</span>
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
                >‹</button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
                >›</button>
              </div>
            )}
          </div>

          {/* Rows */}
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3 animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted mt-1.5 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-5 w-24 bg-muted rounded-full" />
                      <div className="h-5 w-16 bg-muted rounded-full" />
                      <div className="h-5 w-20 bg-muted rounded" />
                    </div>
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/3 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <ClipboardList size={36} className="text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No audit events found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasActiveFilters ? 'Try adjusting or clearing your filters' : 'No events have been recorded yet'}
              </p>
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="mt-3 text-xs text-primary underline hover:text-primary/80"
                >
                  Clear all filters
                </button>
              )}
            </div>
          ) : (
            <div>
              {paginated.map((entry) => (
                <AuditLogRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        {/* Bottom pagination */}
        {totalPages > 1 && !isLoading && (
          <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
            <span>Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, entries.length)} of {entries.length.toLocaleString()} events</span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(1)}
                className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
              >«</button>
              <button
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
                className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
              >‹</button>
              <span className="px-3 py-1 bg-primary text-white rounded font-medium">{page}</span>
              <button
                disabled={page === totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
              >›</button>
              <button
                disabled={page === totalPages}
                onClick={() => setPage(totalPages)}
                className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
              >»</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
