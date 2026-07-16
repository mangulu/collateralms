'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { DatabaseZap, Search, Download, RefreshCw, ChevronRight, User, Clock, Globe, ArrowRight, X, AlertCircle, LogIn, FolderOpen, GitBranch, Upload, Activity, Pen, FileSignature, Eye, MessageSquare, ChevronUp, FileDown, Printer, SlidersHorizontal, ShieldCheck, BarChart3, Users, Calendar, Tag,  } from 'lucide-react';
import { auditLogService, AuditLogEntry, FieldChange } from '@/lib/supabase/auditLogService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function timeAgo(iso: string): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ─── Category / Action Config ─────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  login:             { label: 'Login / Auth',       icon: LogIn,         bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  collateral_change: { label: 'Collateral Change',  icon: FolderOpen,    bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  status_transition: { label: 'Status Transition',  icon: GitBranch,     bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  export:            { label: 'Export',              icon: Download,      bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500' },
  document:          { label: 'Document',            icon: Upload,        bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500' },
  user_management:   { label: 'User Management',     icon: User,          bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  legal_signoff:     { label: 'Legal Sign-Off',      icon: FileSignature, bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  compliance:        { label: 'Compliance',          icon: ShieldCheck,   bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  system:            { label: 'System',              icon: Activity,      bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
};

const ACTION_DOT: Record<string, string> = {
  created: 'bg-green-500', updated: 'bg-blue-500', deleted: 'bg-red-500',
  perfected: 'bg-teal-500', overdue: 'bg-red-500', submitted: 'bg-purple-500',
  reviewed: 'bg-amber-500', approved: 'bg-green-500', rejected: 'bg-rose-500',
  returned: 'bg-orange-500', login: 'bg-violet-500', export: 'bg-teal-500',
  legal_signoff: 'bg-emerald-500',
};

function getCatConfig(category?: string) {
  return CATEGORY_CONFIG[category ?? 'collateral_change'] ?? CATEGORY_CONFIG['collateral_change'];
}

function getEntryCategory(entry: AuditLogEntry) {
  if (entry.action === 'legal_signoff') return CATEGORY_CONFIG['legal_signoff'];
  return getCatConfig(entry.eventCategory);
}

function getDot(action: string, category?: string) {
  return ACTION_DOT[action] ?? getCatConfig(category).dot;
}

// ─── Event type tabs ──────────────────────────────────────────────────────────

const EVENT_TABS = [
  { key: 'all',              label: 'All Events',          icon: Activity },
  { key: 'user_actions',     label: 'User Actions',        icon: Users },
  { key: 'data_changes',     label: 'Data Changes',        icon: Pen },
  { key: 'compliance',       label: 'Compliance Events',   icon: ShieldCheck },
  { key: 'login',            label: 'Login / Auth',        icon: LogIn },
  { key: 'export',           label: 'Exports',             icon: FileDown },
];

const TAB_CATEGORIES: Record<string, string[]> = {
  all:          [],
  user_actions: ['user_management', 'login'],
  data_changes: ['collateral_change', 'status_transition', 'document'],
  compliance:   ['legal_signoff', 'compliance', 'status_transition'],
  login:        ['login'],
  export:       ['export'],
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
                {change.old_value
                  ? <span className="inline-flex items-center text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 font-mono">{change.old_value}</span>
                  : <span className="text-xs text-muted-foreground italic">empty</span>}
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                {change.new_value
                  ? <span className="inline-flex items-center text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 font-mono">{change.new_value}</span>
                  : <span className="text-xs text-muted-foreground italic">empty</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Drill-down Row ───────────────────────────────────────────────────────────

function AuditRow({ entry, index }: { entry: AuditLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const catConfig = getEntryCategory(entry);
  const dot = getDot(entry.action, entry.eventCategory);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
  const hasDetail = !!entry.detail;
  const isExpandable = hasChanges || hasDetail;

  const justification = entry.detail?.includes('Justification:')
    ? entry.detail.split('Justification:')[1]?.trim()
    : null;
  const detailClean = entry.detail?.includes('Justification:')
    ? entry.detail.split('·').filter(p => !p.includes('Justification:')).join('·').trim()
    : entry.detail;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={`flex items-start gap-4 px-5 py-3.5 hover:bg-muted/20 transition-colors ${isExpandable ? 'cursor-pointer' : ''}`}
        onClick={() => isExpandable && setExpanded(v => !v)}
      >
        {/* Index + dot */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0 w-8">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">{String(index + 1).padStart(3, '0')}</span>
          <div className={`w-2.5 h-2.5 rounded-full ${dot}`} />
        </div>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full ${catConfig.bg} ${catConfig.text}`}>
                <catConfig.icon size={11} />
                {catConfig.label}
              </span>
              {entry.collateralId && (
                <span className="text-xs font-mono text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded">
                  {entry.collateralId}
                </span>
              )}
              <span className="text-xs font-medium text-foreground/80 capitalize">
                {entry.action.replace(/_/g, ' ')}
              </span>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Clock size={10} />
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
              {isExpandable && (
                expanded
                  ? <ChevronUp size={14} className="text-muted-foreground" />
                  : <ChevronRight size={14} className="text-muted-foreground" />
              )}
            </div>
          </div>

          <p className="text-sm font-medium text-foreground mt-1.5 leading-snug">{entry.message}</p>

          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User size={11} className="shrink-0" />
              <span className="font-medium text-foreground/80">{entry.performedByName || 'System'}</span>
            </div>
            {entry.ipAddress && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Globe size={10} className="shrink-0" />
                <span>{entry.ipAddress}</span>
              </div>
            )}
            {detailClean && !expanded && (
              <span className="text-xs text-muted-foreground truncate max-w-xs">{detailClean}</span>
            )}
          </div>

          {justification && !expanded && (
            <div className="mt-2 flex items-start gap-1.5">
              <MessageSquare size={11} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-snug">
                <span className="font-semibold">Justification:</span> {justification}
              </p>
            </div>
          )}

          {!expanded && hasChanges && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-primary font-medium">
              <Eye size={11} />
              <span>{entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''} changed</span>
              <ChevronRight size={11} />
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2">
              {detailClean && <p className="text-xs text-muted-foreground">{detailClean}</p>}
              {justification && (
                <div className="flex items-start gap-1.5">
                  <MessageSquare size={11} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-snug flex-1">
                    <span className="font-semibold">Justification:</span> {justification}
                  </p>
                </div>
              )}
              {hasChanges && <FieldChangeDiff changes={entry.fieldChanges!} />}
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <ChevronUp size={11} /> Click to collapse
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: IconComp, color, sub }: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        {React.createElement(IconComp as React.ElementType, { size: 18 })}
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground font-mono">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── CSV Export ───────────────────────────────────────────────────────────────

function exportCSV(entries: AuditLogEntry[]) {
  const header = ['#', 'Timestamp', 'Event Type', 'Action', 'Actor', 'IP Address', 'Collateral ID', 'Message', 'Detail', 'Field Changes'];
  const rows = entries.map((e, i) => {
    const catConfig = getEntryCategory(e);
    const changes = e.fieldChanges
      ? e.fieldChanges.map(f => `${f.label}: ${f.old_value || '—'} → ${f.new_value || '—'}`).join('; ')
      : '';
    return [
      i + 1,
      formatDateTime(e.createdAt),
      catConfig.label,
      e.action,
      e.performedByName || 'System',
      e.ipAddress ?? '',
      e.collateralId ?? '',
      `"${(e.message ?? '').replace(/"/g, '""')}"`,
      `"${(e.detail ?? '').replace(/"/g, '""')}"`,
      `"${changes.replace(/"/g, '""')}"`,
    ].join(',');
  });
  const csv = [header.join(','), ...rows].join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `audit-center-export-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function printReport(entries: AuditLogEntry[], activeTab: string, filters: Record<string, string>) {
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const tabLabel = EVENT_TABS.find(t => t.key === activeTab)?.label ?? 'All Events';
  const filterSummary = Object.entries(filters)
    .filter(([, v]) => v && v !== 'All' && v !== '')
    .map(([k, v]) => `${k}: ${v}`)
    .join(' | ');

  const rows = entries.map((e, i) => {
    const catConfig = getEntryCategory(e);
    const changes = e.fieldChanges
      ? e.fieldChanges.map(f => `${f.label}: ${f.old_value || '—'} → ${f.new_value || '—'}`).join('<br/>')
      : '—';
    return `<tr style="border-bottom:1px solid #e5e7eb;${i % 2 === 0 ? '' : 'background:#f9fafb'}">
      <td style="padding:5px 8px;font-size:11px;color:#6b7280;font-family:monospace">${i + 1}</td>
      <td style="padding:5px 8px;font-size:11px;font-family:monospace;white-space:nowrap">${formatDateTime(e.createdAt)}</td>
      <td style="padding:5px 8px;font-size:11px;font-weight:600">${catConfig.label}</td>
      <td style="padding:5px 8px;font-size:11px;text-transform:capitalize">${e.action.replace(/_/g, ' ')}</td>
      <td style="padding:5px 8px;font-size:11px;font-weight:600">${e.performedByName || 'System'}</td>
      <td style="padding:5px 8px;font-size:11px;font-family:monospace;color:#6b7280">${e.ipAddress ?? '—'}</td>
      <td style="padding:5px 8px;font-size:11px">${e.collateralId ? `<span style="font-family:monospace;background:#eff6ff;color:#1d4ed8;padding:1px 4px;border-radius:3px">${e.collateralId}</span>` : '—'}</td>
      <td style="padding:5px 8px;font-size:11px">${e.message}</td>
      <td style="padding:5px 8px;font-size:10px;color:#6b7280">${changes}</td>
    </tr>`;
  }).join('');

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
  <title>Audit Center — ${tabLabel}</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:'Segoe UI',Arial,sans-serif;font-size:12px;color:#111827;padding:24px}
    .header{border-bottom:2px solid #1d4ed8;padding-bottom:16px;margin-bottom:20px}
    .header h1{font-size:18px;font-weight:700;color:#1d4ed8}
    .header .meta{display:flex;gap:24px;margin-top:8px;font-size:11px;color:#6b7280}
    .badge{display:inline-block;background:#dbeafe;color:#1d4ed8;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;margin-left:8px}
    .filters{background:#f3f4f6;border:1px solid #e5e7eb;border-radius:6px;padding:8px 12px;margin-bottom:16px;font-size:11px;color:#374151}
    table{width:100%;border-collapse:collapse}
    thead tr{background:#1d4ed8;color:white}
    thead th{padding:7px 8px;font-size:10px;font-weight:600;text-align:left;text-transform:uppercase;letter-spacing:.05em}
    .notice{margin-top:16px;background:#fffbeb;border:1px solid #fcd34d;border-radius:6px;padding:10px 12px;font-size:10px;color:#92400e}
    .footer{margin-top:16px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:10px;color:#9ca3af;display:flex;justify-content:space-between}
    @media print{body{padding:12px}}
  </style></head><body>
  <div class="header">
    <h1>Audit Center — ${tabLabel} <span class="badge">REGULATORY EXPORT</span></h1>
    <div class="meta">
      <span>Generated: ${now}</span>
      <span>Total Events: ${entries.length}</span>
      <span>System: Collateral Management System</span>
    </div>
  </div>
  ${filterSummary ? `<div class="filters"><strong>Active Filters:</strong> ${filterSummary}</div>` : ''}
  <table>
    <thead><tr>
      <th style="width:32px">#</th>
      <th style="width:130px">Timestamp</th>
      <th style="width:110px">Event Type</th>
      <th style="width:100px">Action</th>
      <th style="width:100px">Actor</th>
      <th style="width:100px">IP Address</th>
      <th style="width:90px">Collateral ID</th>
      <th>Message</th>
      <th style="width:150px">Field Changes</th>
    </tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="notice"><strong>Regulatory Notice:</strong> This audit record is immutable and retained per Bank of Tanzania regulatory requirements. Any alteration is prohibited.</div>
  <div class="footer">
    <span>Collateral Management System — Confidential</span>
    <span>Export: ${now} | Records: ${entries.length}</span>
  </div>
  </body></html>`;

  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(html);
  win.document.close();
  win.focus();
  setTimeout(() => win.print(), 400);
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditCenterContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [collateralFilter, setCollateralFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [page, setPage] = useState(1);
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [distinctCollaterals, setDistinctCollaterals] = useState<string[]>([]);
  const [distinctActions, setDistinctActions] = useState<string[]>([]);

  // Load metadata
  useEffect(() => {
    Promise.all([
      auditLogService.getDistinctUsers(),
      auditLogService.getDistinctCollateralIds(),
      auditLogService.getDistinctActions(),
    ]).then(([users, cols, acts]) => {
      setDistinctUsers(users);
      setDistinctCollaterals(cols);
      setDistinctActions(acts);
    }).catch(() => {});
  }, []);

  const fetchEntries = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const data = await auditLogService.getAll({
        search: search || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
        performedBy: userFilter !== 'All' ? userFilter : undefined,
        collateralId: collateralFilter !== 'All' ? collateralFilter : undefined,
        action: actionFilter !== 'All' ? actionFilter : undefined,
      }, 1000);
      setEntries(data);
      setPage(1);
    } catch {
      setFetchError('Failed to load audit events. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [search, dateFrom, dateTo, userFilter, collateralFilter, actionFilter]);

  useEffect(() => { fetchEntries(); }, [fetchEntries]);

  // Tab filtering
  const tabCategories = TAB_CATEGORIES[activeTab] ?? [];
  const tabFiltered = tabCategories.length === 0
    ? entries
    : entries.filter(e => tabCategories.includes(e.eventCategory ?? '') || tabCategories.includes(e.action));

  // Pagination
  const totalPages = Math.max(1, Math.ceil(tabFiltered.length / PAGE_SIZE));
  const paginated = tabFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPIs
  const totalEvents = entries.length;
  const uniqueActors = new Set(entries.map(e => e.performedByName)).size;
  const complianceEvents = entries.filter(e =>
    ['legal_signoff', 'compliance', 'status_transition'].includes(e.eventCategory ?? '')
  ).length;
  const dataChanges = entries.filter(e =>
    ['collateral_change', 'document'].includes(e.eventCategory ?? '')
  ).length;

  const clearFilters = () => {
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setUserFilter('All');
    setCollateralFilter('All');
    setActionFilter('All');
  };

  const hasActiveFilters = search || dateFrom || dateTo || userFilter !== 'All' || collateralFilter !== 'All' || actionFilter !== 'All';

  const filterSummary = {
    'Date From': dateFrom,
    'Date To': dateTo,
    'Officer': userFilter !== 'All' ? userFilter : '',
    'Collateral': collateralFilter !== 'All' ? collateralFilter : '',
    'Action': actionFilter !== 'All' ? actionFilter : '',
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="bg-white border-b border-border px-6 py-4 shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center">
              <DatabaseZap size={20} className="text-indigo-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Audit Center</h1>
              <p className="text-sm text-muted-foreground">Full visibility into user actions, data changes &amp; compliance events</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => exportCSV(tabFiltered)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors font-medium"
            >
              <FileDown size={15} />
              Export CSV
            </button>
            <button
              onClick={() => printReport(tabFiltered, activeTab, filterSummary)}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors font-medium"
            >
              <Printer size={15} />
              Print
            </button>
            <button
              onClick={fetchEntries}
              disabled={isLoading}
              className="flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors font-medium disabled:opacity-50"
            >
              <RefreshCw size={15} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* KPI Row */}
      <div className="px-6 py-4 grid grid-cols-2 md:grid-cols-4 gap-3 shrink-0">
        <KpiCard label="Total Events" value={totalEvents.toLocaleString()} icon={Activity} color="bg-indigo-100 text-indigo-700" sub="in current filter" />
        <KpiCard label="Unique Actors" value={uniqueActors} icon={Users} color="bg-blue-100 text-blue-700" sub="users / system" />
        <KpiCard label="Compliance Events" value={complianceEvents} icon={ShieldCheck} color="bg-emerald-100 text-emerald-700" sub="legal & status" />
        <KpiCard label="Data Changes" value={dataChanges} icon={BarChart3} color="bg-amber-100 text-amber-700" sub="collateral & docs" />
      </div>

      {/* Filters */}
      <div className="px-6 pb-3 shrink-0 space-y-3">
        {/* Search + toggle */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[200px]">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by message, actor, collateral ID, IP…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowAdvanced(v => !v)}
            className={`flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg border transition-colors font-medium ${showAdvanced ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white hover:bg-muted'}`}
          >
            <SlidersHorizontal size={14} />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-primary" />}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground px-2 py-1.5 rounded-md hover:bg-muted transition-colors">
              <X size={12} /> Clear all
            </button>
          )}
        </div>

        {/* Advanced filters */}
        {showAdvanced && (
          <div className="bg-white border border-border rounded-xl p-4 grid grid-cols-2 md:grid-cols-5 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Calendar size={11} /> From</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Calendar size={11} /> To</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><User size={11} /> Officer</label>
              <select value={userFilter} onChange={e => setUserFilter(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="All">All Officers</option>
                {distinctUsers.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><FolderOpen size={11} /> Collateral</label>
              <select value={collateralFilter} onChange={e => setCollateralFilter(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="All">All Collaterals</option>
                {distinctCollaterals.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 flex items-center gap-1"><Tag size={11} /> Action</label>
              <select value={actionFilter} onChange={e => setActionFilter(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
                <option value="All">All Actions</option>
                {distinctActions.map(a => <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>)}
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Event Type Tabs */}
      <div className="px-6 shrink-0">
        <div className="flex items-center gap-1 border-b border-border overflow-x-auto">
          {EVENT_TABS.map(tab => {
            const TabIcon = tab.icon;
            const count = TAB_CATEGORIES[tab.key]?.length === 0
              ? entries.length
              : entries.filter(e => (TAB_CATEGORIES[tab.key] ?? []).includes(e.eventCategory ?? '') || (TAB_CATEGORIES[tab.key] ?? []).includes(e.action)).length;
            return (
              <button
                key={tab.key}
                onClick={() => { setActiveTab(tab.key); setPage(1); }}
                className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Results summary */}
      <div className="px-6 py-2 flex items-center justify-between shrink-0">
        <p className="text-xs text-muted-foreground">
          Showing <span className="font-semibold text-foreground">{paginated.length}</span> of <span className="font-semibold text-foreground">{tabFiltered.length}</span> events
          {hasActiveFilters && <span className="ml-1 text-primary">(filtered)</span>}
        </p>
        {totalPages > 1 && (
          <div className="flex items-center gap-1">
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-2 py-1 text-xs rounded border border-border bg-white hover:bg-muted disabled:opacity-40 transition-colors">
              ← Prev
            </button>
            <span className="text-xs text-muted-foreground px-2">Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-2 py-1 text-xs rounded border border-border bg-white hover:bg-muted disabled:opacity-40 transition-colors">
              Next →
            </button>
          </div>
        )}
      </div>

      {/* Event List */}
      <div className="flex-1 overflow-y-auto px-6 pb-6">
        {fetchError ? (
          <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
            <AlertCircle size={18} />
            <p className="text-sm">{fetchError}</p>
            <button onClick={fetchEntries} className="ml-auto text-xs underline">Retry</button>
          </div>
        ) : isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-16 bg-white border border-border rounded-xl animate-pulse" />
            ))}
          </div>
        ) : paginated.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <DatabaseZap size={40} className="text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No events match your filters</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting the date range, filters, or search query</p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="mt-3 text-xs text-primary underline">Clear all filters</button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            {paginated.map((entry, idx) => (
              <AuditRow key={entry.id} entry={entry} index={(page - 1) * PAGE_SIZE + idx} />
            ))}
          </div>
        )}

        {/* Bottom pagination */}
        {totalPages > 1 && !isLoading && paginated.length > 0 && (
          <div className="flex items-center justify-center gap-2 mt-4">
            <button onClick={() => setPage(1)} disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40 transition-colors">
              First
            </button>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40 transition-colors">
              ← Prev
            </button>
            <span className="text-sm text-muted-foreground font-medium px-2">
              Page {page} of {totalPages}
            </span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40 transition-colors">
              Next →
            </button>
            <button onClick={() => setPage(totalPages)} disabled={page === totalPages}
              className="px-3 py-1.5 text-xs rounded-lg border border-border bg-white hover:bg-muted disabled:opacity-40 transition-colors">
              Last
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
