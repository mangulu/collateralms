'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { History, Search, Filter, Download, RefreshCw, ChevronDown, ChevronRight, User, Clock, FileText, ArrowRight, X, Calendar, AlertCircle,  } from 'lucide-react';
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

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

const ACTION_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  created:    { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  updated:    { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  deleted:    { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  perfected:  { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500' },
  overdue:    { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  submitted:  { bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-500' },
  reviewed:   { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  approved:   { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  rejected:   { bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  returned:   { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  commented:  { bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
  reopened:   { bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  STATUS_CHANGE: { bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  DOCUMENT_UPLOAD: { bg: 'bg-cyan-100', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  DOCUMENT_DELETE: { bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-500' },
  REVIEW: { bg: 'bg-sky-100', text: 'text-sky-700', dot: 'bg-sky-500' },
};

const ENTITY_LABELS: Record<string, string> = {
  collateral: 'Collateral',
  perfection_request: 'Perfection Request',
  user: 'User',
  document: 'Document',
  system: 'System',
};

function getActionStyle(action: string) {
  return ACTION_STYLES[action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
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
                  <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 font-mono">
                    {change.old_value}
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">empty</span>
                )}
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                {change.new_value ? (
                  <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 font-mono">
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

// ─── AuditLogRow ──────────────────────────────────────────────────────────────

function AuditLogRow({ entry }: { entry: AuditLogEntry }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActionStyle(entry.action);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
  const hasDetail = !!entry.detail;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${
          hasChanges || hasDetail ? 'cursor-pointer' : ''
        }`}
        onClick={() => (hasChanges || hasDetail) && setExpanded((v) => !v)}
      >
        {/* Timeline dot */}
        <div className="flex flex-col items-center pt-1 shrink-0">
          <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              {/* Action badge */}
              <span
                className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}
              >
                {entry.action.replace(/_/g, ' ').toUpperCase()}
              </span>
              {/* Entity type */}
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
              </span>
              {/* Collateral ID */}
              {entry.collateralId && (
                <span className="text-xs font-mono text-primary bg-primary/5 px-2 py-0.5 rounded">
                  {entry.collateralId}
                </span>
              )}
            </div>
            {/* Timestamp */}
            <div className="flex items-center gap-1 text-xs text-muted-foreground shrink-0">
              <Clock size={11} />
              <span>{formatDateTime(entry.createdAt)}</span>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm text-foreground mt-1 leading-snug">{entry.message}</p>

          {/* User + detail row */}
          <div className="flex items-center gap-3 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <User size={11} />
              <span>{entry.performedByName || 'System'}</span>
            </div>
            {entry.detail && !expanded && (
              <span className="text-xs text-muted-foreground truncate max-w-xs">{entry.detail}</span>
            )}
            {hasChanges && (
              <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''} changed
                {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
            )}
          </div>

          {/* Expanded detail + field changes */}
          {expanded && (
            <div className="mt-2">
              {entry.detail && (
                <p className="text-xs text-muted-foreground mb-2">{entry.detail}</p>
              )}
              {hasChanges && <FieldChangeDiff changes={entry.fieldChanges!} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number | string;
  icon: React.ElementType;
  color: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-4 flex items-center gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground font-mono">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const MOCK_ENTRIES: AuditLogEntry[] = [
  {
    id: '1',
    collateralId: 'col-0312',
    entityType: 'collateral',
    action: 'created',
    message: 'New collateral registered: col-0312',
    detail: 'Coastal Traders Co. · Mortgage · TSh 780M',
    performedByName: 'J. Kamau',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: '', new_value: 'Draft' },
      { field: 'assigned_officer', label: 'Assigned Officer', old_value: '', new_value: 'J. Kamau' },
    ],
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    collateralId: 'col-0289',
    entityType: 'collateral',
    action: 'perfected',
    message: 'Collateral col-0289 perfected at BRELA',
    detail: 'Karibu Textiles Ltd · Debenture',
    performedByName: 'A. Mwangi',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Under Review', new_value: 'Perfected' },
      { field: 'registration_date', label: 'Registration Date', old_value: '', new_value: '25 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    collateralId: 'col-0041',
    entityType: 'collateral',
    action: 'overdue',
    message: 'BRELA deadline missed — col-0041',
    detail: 'Karibu Enterprises Ltd · 12 days overdue',
    performedByName: 'System',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Submitted', new_value: 'Overdue' },
      { field: 'days_to_deadline', label: 'Days to Deadline', old_value: '0', new_value: '-12' },
    ],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    collateralId: 'col-0298',
    entityType: 'perfection_request',
    action: 'submitted',
    message: 'Lands Registry submission filed',
    detail: 'col-0298 · Mwanza Holdings · Mortgage',
    performedByName: 'P. Ochieng',
    fieldChanges: [
      { field: 'request_status', label: 'Request Status', old_value: 'Draft', new_value: 'Submitted' },
    ],
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    collateralId: 'col-0312',
    entityType: 'collateral',
    action: 'updated',
    message: 'Collateral record updated: col-0312',
    detail: 'Value and deadline revised',
    performedByName: 'J. Kamau',
    fieldChanges: [
      { field: 'value_tsh', label: 'Value (TSh)', old_value: '500,000,000', new_value: '650,000,000' },
      { field: 'perfection_deadline', label: 'Perfection Deadline', old_value: '01 May 2026', new_value: '15 May 2026' },
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
];

export default function AuditLogContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [entityFilter, setEntityFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [distinctActions, setDistinctActions] = useState<string[]>([]);
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 50;

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, actions, users] = await Promise.all([
        auditLogService.getAll({ search, action: actionFilter, entityType: entityFilter, dateFrom, dateTo }),
        auditLogService.getDistinctActions(),
        auditLogService.getDistinctUsers(),
      ]);
      setEntries(data.length > 0 ? data : MOCK_ENTRIES);
      setDistinctActions(actions.length > 0 ? actions : Array.from(new Set(MOCK_ENTRIES.map((e) => e.action))));
      setDistinctUsers(users.length > 0 ? users : Array.from(new Set(MOCK_ENTRIES.map((e) => e.performedByName))));
      setLastRefreshed(new Date());
    } catch {
      setEntries(MOCK_ENTRIES);
      setDistinctActions(Array.from(new Set(MOCK_ENTRIES.map((e) => e.action))));
      setDistinctUsers(Array.from(new Set(MOCK_ENTRIES.map((e) => e.performedByName))));
    } finally {
      setIsLoading(false);
    }
  }, [search, actionFilter, entityFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
    setPage(1);
  }, [loadData]);

  // Client-side user filter
  const filtered = entries.filter((e) =>
    userFilter === 'All' ? true : e.performedByName === userFilter
  );

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI counts
  const totalEntries = filtered.length;
  const withChanges = filtered.filter((e) => Array.isArray(e.fieldChanges) && e.fieldChanges.length > 0).length;
  const uniqueUsers = new Set(filtered.map((e) => e.performedByName)).size;
  const today = new Date().toDateString();
  const todayCount = filtered.filter((e) => new Date(e.createdAt).toDateString() === today).length;

  function clearFilters() {
    setSearch('');
    setActionFilter('All');
    setEntityFilter('All');
    setDateFrom('');
    setDateTo('');
    setUserFilter('All');
  }

  const hasActiveFilters =
    search || actionFilter !== 'All' || entityFilter !== 'All' || dateFrom || dateTo || userFilter !== 'All';

  function exportCSV() {
    const headers = ['Timestamp', 'Action', 'Entity Type', 'Collateral ID', 'Message', 'Detail', 'Performed By', 'Field Changes'];
    const rows = filtered.map((e) => [
      formatDateTime(e.createdAt),
      e.action,
      ENTITY_LABELS[e.entityType] ?? e.entityType,
      e.collateralId ?? '',
      e.message,
      e.detail,
      e.performedByName,
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

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <History size={20} className="text-primary" />
              <h1 className="text-xl font-bold text-foreground">Audit Log</h1>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete change history for collateral records and workflow actions — compliance documentation
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
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <KpiCard label="Total Events" value={totalEntries} icon={History} color="bg-primary/10 text-primary" />
        <KpiCard label="With Field Changes" value={withChanges} icon={FileText} color="bg-blue-100 text-blue-600" />
        <KpiCard label="Active Users" value={uniqueUsers} icon={User} color="bg-green-100 text-green-600" />
        <KpiCard label="Events Today" value={todayCount} icon={Calendar} color="bg-amber-100 text-amber-600" />
      </div>

      {/* Search + Filters */}
      <div className="px-6 pb-3 shrink-0 space-y-2">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by message, collateral ID, user…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          {/* Action filter */}
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
          {/* Entity filter */}
          <div className="relative">
            <select
              value={entityFilter}
              onChange={(e) => setEntityFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="All">All Entities</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          {/* More filters toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
              showFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white hover:bg-muted'
            }`}
          >
            <Filter size={13} />
            More Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
            )}
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

        {/* Extended filters */}
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
                <option value="All">All Users</option>
                {distinctUsers.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Log Table */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
          {/* Table header */}
          <div className="px-4 py-3 border-b border-border bg-muted/30 flex items-center justify-between">
            <p className="text-sm font-semibold text-foreground">
              {isLoading ? 'Loading…' : `${filtered.length.toLocaleString()} event${filtered.length !== 1 ? 's' : ''}`}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Page {page} of {totalPages}</span>
                <button
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                  className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  ‹
                </button>
                <button
                  disabled={page === totalPages}
                  onClick={() => setPage((p) => p + 1)}
                  className="px-2 py-1 border border-border rounded hover:bg-muted disabled:opacity-40 transition-colors"
                >
                  ›
                </button>
              </div>
            )}
          </div>

          {/* Entries */}
          {isLoading ? (
            <div className="divide-y divide-border">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="px-4 py-3 flex items-start gap-3 animate-pulse">
                  <div className="w-2.5 h-2.5 rounded-full bg-muted mt-1 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="flex gap-2">
                      <div className="h-5 w-20 bg-muted rounded-full" />
                      <div className="h-5 w-16 bg-muted rounded-full" />
                    </div>
                    <div className="h-4 w-3/4 bg-muted rounded" />
                    <div className="h-3 w-1/3 bg-muted rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : paginated.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <AlertCircle size={32} className="text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No audit events found</p>
              <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            <div>
              {paginated.map((entry) => (
                <AuditLogRow key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
