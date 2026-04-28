'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ShieldCheck, Search, Filter, Download, RefreshCw, ChevronDown, ChevronRight, User, Clock, FileText, ArrowRight, X, AlertCircle, Globe, LogIn, FolderOpen, GitBranch, Upload, Activity,  } from 'lucide-react';
import { auditLogService, AuditLogEntry, FieldChange } from '@/lib/supabase/auditLogService';
import Icon from '@/components/ui/AppIcon';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  login:             { label: 'Login / Auth',        icon: LogIn,      bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  collateral_change: { label: 'Collateral Change',   icon: FolderOpen, bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  status_transition: { label: 'Status Transition',   icon: GitBranch,  bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  export:            { label: 'Export',               icon: Download,   bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500' },
  document:          { label: 'Document',             icon: Upload,     bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500' },
  user_management:   { label: 'User Management',      icon: User,       bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  system:            { label: 'System',               icon: Activity,   bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
};

const ACTION_DOT: Record<string, string> = {
  created:   'bg-green-500',
  updated:   'bg-blue-500',
  deleted:   'bg-red-500',
  perfected: 'bg-teal-500',
  overdue:   'bg-red-500',
  submitted: 'bg-purple-500',
  reviewed:  'bg-amber-500',
  approved:  'bg-green-500',
  rejected:  'bg-rose-500',
  returned:  'bg-orange-500',
  login:     'bg-violet-500',
  export:    'bg-teal-500',
};

function getCategoryConfig(category?: string) {
  return CATEGORY_CONFIG[category ?? 'collateral_change'] ?? CATEGORY_CONFIG['collateral_change'];
}

function getDot(action: string, category?: string) {
  return ACTION_DOT[action] ?? getCategoryConfig(category).dot;
}

// ─── FieldChangeDiff ──────────────────────────────────────────────────────────

function FieldChangeDiff({ changes }: { changes: FieldChange[] }) {
  if (!changes || changes.length === 0) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Field-Level Changes
        </p>
      </div>
      <div className="divide-y divide-border">
        {changes.map((change, idx) => (
          <div key={idx} className="px-3 py-2.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground mb-1">{change.label}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {change.old_value ? (
                  <span className="inline-flex items-center text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 font-mono">
                    {change.old_value}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">empty</span>
                )}
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                {change.new_value ? (
                  <span className="inline-flex items-center text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 font-mono">
                    {change.new_value}
                  </span>
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

// ─── AuditTrailRow ────────────────────────────────────────────────────────────

function AuditTrailRow({ entry, index }: { entry: AuditLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = getCategoryConfig(entry.eventCategory);
  const dot = getDot(entry.action, entry.eventCategory);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
  const hasDetail = !!entry.detail;
  const isExpandable = hasChanges || hasDetail;

  return (
    <tr
      className={`border-b border-border last:border-b-0 ${isExpandable ? 'cursor-pointer' : ''} hover:bg-muted/20 transition-colors`}
      onClick={() => isExpandable && setExpanded((v) => !v)}
    >
      <td className="px-4 py-3 text-xs text-muted-foreground font-mono whitespace-nowrap">
        {index + 1}
      </td>
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
          <Clock size={11} className="text-muted-foreground shrink-0" />
          {formatDateTime(entry.createdAt)}
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${catConfig.bg} ${catConfig.text}`}>
            <catConfig.icon size={10} />
            {catConfig.label}
          </span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-foreground">
          <User size={11} className="text-muted-foreground shrink-0" />
          <span className="font-medium">{entry.performedByName || 'System'}</span>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
          <Globe size={11} className="shrink-0" />
          {entry.ipAddress ?? '—'}
        </div>
      </td>
      <td className="px-4 py-3 max-w-xs">
        <p className="text-sm text-foreground leading-snug truncate">{entry.message}</p>
        {entry.collateralId && (
          <span className="text-xs font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded mt-0.5 inline-block">
            {entry.collateralId}
          </span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          {hasChanges && (
            <span className="text-xs text-primary font-medium flex items-center gap-0.5">
              {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''}
              {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
          )}
          {!hasChanges && hasDetail && (
            <span className="text-xs text-muted-foreground flex items-center gap-0.5">
              Details {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            </span>
          )}
          {!hasChanges && !hasDetail && (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Expanded Detail Row ──────────────────────────────────────────────────────

function AuditTrailExpandedRow({ entry, colSpan }: { entry: AuditLogEntry; colSpan: number }) {
  const [expanded, setExpanded] = useState(false);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;

  return (
    <>
      <AuditTrailRow entry={entry} index={0} />
      {expanded && (
        <tr className="bg-muted/10">
          <td colSpan={colSpan} className="px-8 pb-3 pt-0">
            {entry.detail && (
              <p className="text-xs text-muted-foreground mb-2">{entry.detail}</p>
            )}
            {hasChanges && <FieldChangeDiff changes={entry.fieldChanges!} />}
          </td>
        </tr>
      )}
    </>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: IconComp,
  color,
  sub,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
  sub?: string;
}) {
  const Icon = IconComp;
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground font-mono">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 leading-tight mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ENTRIES: AuditLogEntry[] = [
  {
    id: 'm1', collateralId: undefined, entityType: 'system', action: 'login',
    message: 'User login successful', detail: 'Session started via web browser',
    performedByName: 'J. Kamau', ipAddress: '196.216.10.45', eventCategory: 'login',
    fieldChanges: null, createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'm2', collateralId: 'col-0312', entityType: 'collateral', action: 'created',
    message: 'New collateral registered: col-0312', detail: 'Coastal Traders Co. · Mortgage · TSh 780M',
    performedByName: 'J. Kamau', ipAddress: '196.216.10.45', eventCategory: 'collateral_change',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: '', new_value: 'Draft' },
      { field: 'assigned_officer', label: 'Assigned Officer', old_value: '', new_value: 'J. Kamau' },
    ],
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm3', collateralId: 'col-0289', entityType: 'collateral', action: 'perfected',
    message: 'Collateral col-0289 perfected at BRELA', detail: 'Karibu Textiles Ltd · Debenture',
    performedByName: 'A. Mwangi', ipAddress: '196.216.10.67', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Under Review', new_value: 'Perfected' },
      { field: 'registration_date', label: 'Registration Date', old_value: '', new_value: '25 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm4', collateralId: undefined, entityType: 'system', action: 'export',
    message: 'Collateral registry exported to CSV', detail: 'Exported 47 records — all collateral types',
    performedByName: 'A. Mwangi', ipAddress: '196.216.10.67', eventCategory: 'export',
    fieldChanges: null, createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm5', collateralId: 'col-0041', entityType: 'collateral', action: 'overdue',
    message: 'BRELA deadline missed — col-0041', detail: 'Karibu Enterprises Ltd · 12 days overdue',
    performedByName: 'System', ipAddress: '127.0.0.1', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Submitted', new_value: 'Overdue' },
    ],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm6', collateralId: 'col-0298', entityType: 'document', action: 'DOCUMENT_UPLOAD',
    message: 'Perfection certificate uploaded for col-0298', detail: 'BRELA_cert_col0298.pdf · 2.4 MB',
    performedByName: 'P. Ochieng', ipAddress: '41.188.32.12', eventCategory: 'document',
    fieldChanges: null, createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm7', collateralId: undefined, entityType: 'system', action: 'login',
    message: 'User login successful', detail: 'Session started via web browser',
    performedByName: 'P. Ochieng', ipAddress: '41.188.32.12', eventCategory: 'login',
    fieldChanges: null, createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'm8', collateralId: 'col-0312', entityType: 'collateral', action: 'updated',
    message: 'Collateral record updated: col-0312', detail: 'Value and deadline revised',
    performedByName: 'J. Kamau', ipAddress: '196.216.10.45', eventCategory: 'collateral_change',
    fieldChanges: [
      { field: 'value_tsh', label: 'Value (TSh)', old_value: '500,000,000', new_value: '650,000,000' },
      { field: 'perfection_deadline', label: 'Perfection Deadline', old_value: '01 May 2026', new_value: '15 May 2026' },
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Category Filter Pills ────────────────────────────────────────────────────

const CATEGORY_PILLS = [
  { key: 'All', label: 'All Events' },
  { key: 'login', label: 'Login / Auth' },
  { key: 'collateral_change', label: 'Collateral Changes' },
  { key: 'status_transition', label: 'Status Transitions' },
  { key: 'export', label: 'Exports' },
  { key: 'document', label: 'Documents' },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditTrailContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [distinctActions, setDistinctActions] = useState<string[]>([]);
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [data, actions, users] = await Promise.all([
        auditLogService.getAll({
          search,
          action: actionFilter,
          eventCategory: categoryFilter,
          dateFrom,
          dateTo,
        }),
        auditLogService.getDistinctActions(),
        auditLogService.getDistinctUsers(),
      ]);
      setEntries(data);
      setDistinctActions(actions);
      setDistinctUsers(users);
      setLastRefreshed(new Date());
    } catch {
      setFetchError('Failed to load audit trail. Please refresh to try again.');
      setEntries([]);
      setDistinctActions([]);
      setDistinctUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, actionFilter, categoryFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
    setPage(1);
  }, [loadData]);

  const filtered = entries.filter((e) =>
    userFilter === 'All' ? true : e.performedByName === userFilter
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI counts
  const loginCount = filtered.filter((e) => e.eventCategory === 'login').length;
  const collateralChangeCount = filtered.filter((e) => e.eventCategory === 'collateral_change').length;
  const statusTransitionCount = filtered.filter((e) => e.eventCategory === 'status_transition').length;
  const exportCount = filtered.filter((e) => e.eventCategory === 'export').length;
  const uniqueIPs = new Set(filtered.map((e) => e.ipAddress).filter(Boolean)).size;
  const uniqueActors = new Set(filtered.map((e) => e.performedByName)).size;

  const hasActiveFilters = search || actionFilter !== 'All' || categoryFilter !== 'All' || dateFrom || dateTo || userFilter !== 'All';

  function clearFilters() {
    setSearch('');
    setActionFilter('All');
    setCategoryFilter('All');
    setDateFrom('');
    setDateTo('');
    setUserFilter('All');
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function exportCSV() {
    const headers = ['#', 'Timestamp', 'Category', 'Action', 'Actor', 'IP Address', 'Collateral ID', 'Message', 'Detail', 'Field Changes'];
    const rows = filtered.map((e, i) => [
      String(i + 1),
      formatDateTime(e.createdAt),
      getCategoryConfig(e.eventCategory).label,
      e.action,
      e.performedByName,
      e.ipAddress ?? '',
      e.collateralId ?? '',
      e.message,
      e.detail,
      e.fieldChanges
        ? e.fieldChanges.map((f) => `${f.label}: ${f.old_value || 'empty'} → ${f.new_value || 'empty'}`).join('; ')
        : '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={20} className="text-primary" />
              <h1 className="text-xl font-bold text-foreground">Audit Trail</h1>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                Regulatory Compliance
              </span>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete immutable record of all system actions — logins, collateral changes, status transitions, and exports
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
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        <KpiCard label="Login Events"       value={loginCount}           icon={LogIn}      color="bg-violet-100 text-violet-600" />
        <KpiCard label="Collateral Changes" value={collateralChangeCount} icon={FolderOpen} color="bg-blue-100 text-blue-600" />
        <KpiCard label="Status Transitions" value={statusTransitionCount} icon={GitBranch}  color="bg-amber-100 text-amber-600" />
        <KpiCard label="Export Events"      value={exportCount}           icon={Download}  color="bg-teal-100 text-teal-600" />
        <KpiCard label="Unique Actors"      value={uniqueActors}          icon={User}       color="bg-green-100 text-green-600" />
        <KpiCard label="Unique IPs"         value={uniqueIPs}             icon={Globe}      color="bg-rose-100 text-rose-600" />
      </div>

      {/* Category Pills */}
      <div className="px-6 pb-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => { setCategoryFilter(pill.key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                categoryFilter === pill.key
                  ? 'bg-primary text-white border-primary' :'bg-white text-foreground/70 border-border hover:bg-muted'
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {/* Search + Filters */}
      <div className="px-6 pb-3 shrink-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by message, collateral ID, actor, IP address…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="relative">
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="All">All Actions</option>
              {distinctActions.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
              showFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white hover:bg-muted'
            }`}
          >
            <Filter size={13} />
            More Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={12} />
              Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <div className="relative">
              <select
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="All">All Actors</option>
                {distinctUsers.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
          {/* Table header bar */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {isLoading ? 'Loading…' : `${filtered.length.toLocaleString()} event${filtered.length !== 1 ? 's' : ''}`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Page {page} of {totalPages}</span>
                <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}
                  className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors">‹</button>
                <button disabled={page === totalPages} onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors">›</button>
              </div>
            )}
          </div>

          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-center gap-4 animate-pulse">
                  <div className="h-4 w-6 bg-muted rounded" />
                  <div className="h-4 w-36 bg-muted rounded" />
                  <div className="h-5 w-28 bg-muted rounded-full" />
                  <div className="h-4 w-24 bg-muted rounded" />
                  <div className="h-4 w-28 bg-muted rounded" />
                  <div className="h-4 flex-1 bg-muted rounded" />
                </div>
              ))}
            </div>
          ) : fetchError ? (
            <div className="flex flex-col items-center justify-center py-16 text-center px-6">
              <AlertCircle size={32} className="text-red-400 mb-3" />
              <p className="text-sm font-semibold text-red-600">Failed to load audit trail</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">{fetchError}</p>
              <button
                onClick={loadData}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
              >
                <RefreshCw size={13} />
                Retry
              </button>
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No audit events found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-border bg-muted/20">
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider w-10">#</th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">
                      <div className="flex items-center gap-1"><Clock size={11} /> Timestamp</div>
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1"><Activity size={11} /> Event Type</div>
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1"><User size={11} /> Actor</div>
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1"><Globe size={11} /> IP Address</div>
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      <div className="flex items-center gap-1"><FileText size={11} /> Description</div>
                    </th>
                    <th className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Changes</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map((entry, idx) => {
                    const catConfig = getCategoryConfig(entry.eventCategory);
                    const dot = getDot(entry.action, entry.eventCategory);
                    const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
                    const hasDetail = !!entry.detail;
                    const isExpandable = hasChanges || hasDetail;
                    const isExpanded = expandedRows.has(entry.id);

                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          className={`border-b border-border last:border-b-0 ${isExpandable ? 'cursor-pointer' : ''} hover:bg-muted/20 transition-colors`}
                          onClick={() => isExpandable && toggleRow(entry.id)}
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                            {(page - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
                              <Clock size={11} className="text-muted-foreground shrink-0" />
                              {formatDateTime(entry.createdAt)}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${catConfig.bg} ${catConfig.text}`}>
                                <catConfig.icon size={10} />
                                {catConfig.label}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-foreground">
                              <User size={11} className="text-muted-foreground shrink-0" />
                              <span className="font-medium">{entry.performedByName || 'System'}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-mono">
                              <Globe size={11} className="shrink-0" />
                              {entry.ipAddress ?? '—'}
                            </div>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-sm text-foreground leading-snug">{entry.message}</p>
                            {entry.collateralId && (
                              <span className="text-xs font-mono text-primary bg-primary/5 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                                {entry.collateralId}
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {hasChanges ? (
                              <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                                {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''}
                                {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                              </span>
                            ) : hasDetail ? (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                Details {isExpanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/10">
                            <td colSpan={7} className="px-8 pb-4 pt-1">
                              {entry.detail && (
                                <p className="text-xs text-muted-foreground mb-2 italic">{entry.detail}</p>
                              )}
                              {hasChanges && <FieldChangeDiff changes={entry.fieldChanges!} />}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Compliance notice */}
        <div className="mt-4 flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <ShieldCheck size={14} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">
            <span className="font-semibold">Regulatory Notice:</span> This audit trail is an immutable record of all system actions. Records are retained for compliance with Bank of Tanzania and BRELA regulatory requirements. Export this log periodically for offline archival.
          </p>
        </div>
      </div>
    </div>
  );
}
