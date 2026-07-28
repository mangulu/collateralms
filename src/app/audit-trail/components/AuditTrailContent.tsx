'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldCheck, Search, Filter, Download, RefreshCw, ChevronDown, ChevronRight,
  User, Clock, FileText, ArrowRight, X, AlertCircle, Globe, LogIn, FolderOpen,
  GitBranch, Upload, Activity, Pen, CheckCircle2, Stamp, FileSignature,
  PlusCircle, Printer, ShieldAlert,
} from 'lucide-react';
import { auditLogService, AuditLogEntry, FieldChange } from '@/lib/supabase/auditLogService';
import RiskPriorityPanel from './RiskPriorityPanel';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDateShort(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Category Config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ElementType; bg: string; text: string; dot: string }> = {
  login:             { label: 'Login / Auth',        icon: LogIn,         bg: 'bg-violet-100', text: 'text-violet-700', dot: 'bg-violet-500' },
  collateral_change: { label: 'Collateral Change',   icon: FolderOpen,    bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-500' },
  status_transition: { label: 'Status Transition',   icon: GitBranch,     bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
  export:            { label: 'Export',               icon: Download,      bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500' },
  document:          { label: 'Document',             icon: Upload,        bg: 'bg-cyan-100',   text: 'text-cyan-700',   dot: 'bg-cyan-500' },
  user_management:   { label: 'User Management',      icon: User,          bg: 'bg-rose-100',   text: 'text-rose-700',   dot: 'bg-rose-500' },
  legal_signoff:     { label: 'Legal Sign-Off',       icon: FileSignature, bg: 'bg-emerald-100',text: 'text-emerald-700',dot: 'bg-emerald-500' },
  system:            { label: 'System',               icon: Activity,      bg: 'bg-gray-100',   text: 'text-gray-600',   dot: 'bg-gray-400' },
};

const ACTION_DOT: Record<string, string> = {
  created:       'bg-green-500',
  updated:       'bg-blue-500',
  deleted:       'bg-red-500',
  perfected:     'bg-teal-500',
  overdue:       'bg-red-500',
  submitted:     'bg-purple-500',
  reviewed:      'bg-amber-500',
  approved:      'bg-green-500',
  rejected:      'bg-rose-500',
  returned:      'bg-orange-500',
  login:         'bg-violet-500',
  export:        'bg-teal-500',
  legal_signoff: 'bg-emerald-500',
};

// Collateral-specific action filter groups
const COLLATERAL_ACTION_PILLS = [
  { key: 'all_collateral', label: 'All Collateral Events', actions: [] as string[], icon: FolderOpen },
  { key: 'created',        label: 'Created',               actions: ['created'],                     icon: PlusCircle },
  { key: 'edited',         label: 'Edited',                actions: ['updated', 'status_changed'],   icon: Pen },
  { key: 'perfected',      label: 'Perfected',             actions: ['perfected'],                   icon: Stamp },
  { key: 'signed_off',     label: 'Signed Off',            actions: ['legal_signoff'],               icon: CheckCircle2 },
];

function getCategoryConfig(category?: string) {
  if (category === 'legal_signoff' || category === 'status_transition') {
    // legal_signoff action stored under status_transition category — check action
  }
  return CATEGORY_CONFIG[category ?? 'collateral_change'] ?? CATEGORY_CONFIG['collateral_change'];
}

function getEntryCategory(entry: AuditLogEntry) {
  if (entry.action === 'legal_signoff') return CATEGORY_CONFIG['legal_signoff'];
  return getCategoryConfig(entry.eventCategory);
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
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field-Level Changes</p>
      </div>
      <div className="divide-y divide-border">
        {changes.map((change, idx) => (
          <div key={idx} className="px-3 py-2.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground mb-1">{change.label}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {change.old_value ? (
                  <span className="inline-flex items-center text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 font-mono">{change.old_value}</span>
                ) : (
                  <span className="text-xs text-muted-foreground italic">empty</span>
                )}
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                {change.new_value ? (
                  <span className="inline-flex items-center text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 font-mono">{change.new_value}</span>
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

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: IconComp, color, sub }: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <IconComp size={18} className="" />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground font-mono">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 leading-tight mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── Category Filter Pills ────────────────────────────────────────────────────

const CATEGORY_PILLS = [
  { key: 'All',              label: 'All Events' },
  { key: 'login',            label: 'Login / Auth' },
  { key: 'collateral_change',label: 'Collateral Changes' },
  { key: 'status_transition',label: 'Status Transitions' },
  { key: 'export',           label: 'Exports' },
  { key: 'document',         label: 'Documents' },
];

// ─── PDF Export ───────────────────────────────────────────────────────────────

function buildPrintableHTML(entries: AuditLogEntry[], filters: {
  dateFrom: string; dateTo: string; collateralFilter: string; userFilter: string; collateralActionFilter: string;
}): string {
  const now = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const rows = entries.map((e, i) => {
    const catConfig = getEntryCategory(e);
    const changes = e.fieldChanges
      ? e.fieldChanges.map((f) => `${f.label}: ${f.old_value || '—'} → ${f.new_value || '—'}`).join('<br/>')
      : '—';
    return `
      <tr style="border-bottom:1px solid #e5e7eb;${i % 2 === 0 ? '' : 'background:#f9fafb'}">
        <td style="padding:6px 8px;font-size:11px;color:#6b7280;font-family:monospace">${i + 1}</td>
        <td style="padding:6px 8px;font-size:11px;font-family:monospace;white-space:nowrap">${formatDateTime(e.createdAt)}</td>
        <td style="padding:6px 8px;font-size:11px;font-weight:600">${catConfig.label}</td>
        <td style="padding:6px 8px;font-size:11px;font-weight:600;color:#111827">${e.performedByName || 'System'}</td>
        <td style="padding:6px 8px;font-size:11px;font-family:monospace;color:#6b7280">${e.ipAddress ?? '—'}</td>
        <td style="padding:6px 8px;font-size:11px">${e.collateralId ? `<span style="font-family:monospace;background:#eff6ff;color:#1d4ed8;padding:1px 4px;border-radius:3px">${e.collateralId}</span> ` : ''}${e.message}</td>
        <td style="padding:6px 8px;font-size:10px;color:#6b7280">${changes}</td>
      </tr>`;
  }).join('');

  const filterSummary = [
    filters.dateFrom && `From: ${filters.dateFrom}`,
    filters.dateTo && `To: ${filters.dateTo}`,
    filters.collateralFilter !== 'All' && `Collateral: ${filters.collateralFilter}`,
    filters.userFilter !== 'All' && `Officer: ${filters.userFilter}`,
    filters.collateralActionFilter !== 'all_collateral' && `Action: ${COLLATERAL_ACTION_PILLS.find(p => p.key === filters.collateralActionFilter)?.label}`,
  ].filter(Boolean).join(' | ');

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8"/>
  <title>Audit Trail — Regulatory Export</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; font-size:12px; color:#111827; padding:24px; }
    .header { border-bottom:2px solid #1d4ed8; padding-bottom:16px; margin-bottom:20px; }
    .header h1 { font-size:18px; font-weight:700; color:#1d4ed8; }
    .header .meta { display:flex; gap:24px; margin-top:8px; font-size:11px; color:#6b7280; }
    .header .badge { display:inline-block; background:#dbeafe; color:#1d4ed8; padding:2px 8px; border-radius:4px; font-size:10px; font-weight:600; margin-left:8px; }
    .filters { background:#f3f4f6; border:1px solid #e5e7eb; border-radius:6px; padding:8px 12px; margin-bottom:16px; font-size:11px; color:#374151; }
    table { width:100%; border-collapse:collapse; }
    thead tr { background:#1d4ed8; color:white; }
    thead th { padding:8px; font-size:10px; font-weight:600; text-align:left; text-transform:uppercase; letter-spacing:0.05em; }
    .footer { margin-top:20px; padding-top:12px; border-top:1px solid #e5e7eb; font-size:10px; color:#9ca3af; display:flex; justify-content:space-between; }
    .compliance-notice { margin-top:16px; background:#fffbeb; border:1px solid #fcd34d; border-radius:6px; padding:10px 12px; font-size:10px; color:#92400e; }
    @media print { body { padding:12px; } }
  </style>
</head>
<body>
  <div class="header">
    <h1>Security &amp; Compliance Audit Trail <span class="badge">REGULATORY EXPORT</span></h1>
    <div class="meta">
      <span>Generated: ${now}</span>
      <span>Total Events: ${entries.length}</span>
      <span>System: Collateral Management System</span>
    </div>
  </div>
  ${filterSummary ? `<div class="filters"><strong>Active Filters:</strong> ${filterSummary}</div>` : ''}
  <table>
    <thead>
      <tr>
        <th style="width:32px">#</th>
        <th style="width:140px">Timestamp</th>
        <th style="width:120px">Event Type</th>
        <th style="width:110px">Officer / Actor</th>
        <th style="width:110px">IP Address</th>
        <th>Description</th>
        <th style="width:160px">Field Changes</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="compliance-notice">
    <strong>Regulatory Notice:</strong> This audit trail is an immutable record of all system actions, retained in compliance with Bank of Tanzania regulatory requirements and applicable perfection authority rules (BRELA, Lands Registry, TRA, DSE, TASAC). This document is generated for official compliance and archival purposes. Any alteration of this record is prohibited.
  </div>
  <div class="footer">
    <span>Collateral Management System — Confidential</span>
    <span>Export Date: ${now} | Records: ${entries.length}</span>
  </div>
</body>
</html>`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditTrailContent() {
  const [activeTab, setActiveTab] = useState<'audit' | 'risk'>('audit');
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [actionFilter, setActionFilter] = useState('All');
  const [collateralActionFilter, setCollateralActionFilter] = useState('all_collateral');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [collateralFilter, setCollateralFilter] = useState('All');
  const [distinctActions, setDistinctActions] = useState<string[]>([]);
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [distinctCollaterals, setDistinctCollaterals] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  // Close export menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setExportMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setFetchError(null);
    try {
      const [data, actions, users, collaterals] = await Promise.all([
        auditLogService.getAll({
          search,
          action: actionFilter,
          eventCategory: categoryFilter,
          dateFrom,
          dateTo,
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
    } catch {
      setFetchError('Failed to load security & compliance trail. Please refresh to try again.');
      setEntries([]);
    } finally {
      setIsLoading(false);
    }
  }, [search, actionFilter, categoryFilter, dateFrom, dateTo, collateralFilter]);

  useEffect(() => {
    loadData();
    setPage(1);
  }, [loadData]);

  // Apply client-side filters: user, collateral action group
  const filtered = entries.filter((e) => {
    if (userFilter !== 'All' && e.performedByName !== userFilter) return false;
    if (collateralActionFilter !== 'all_collateral') {
      const pill = COLLATERAL_ACTION_PILLS.find((p) => p.key === collateralActionFilter);
      if (pill && pill.actions.length > 0 && !pill.actions.includes(e.action)) return false;
    }
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI counts
  const createdCount       = filtered.filter((e) => e.action === 'created').length;
  const editedCount        = filtered.filter((e) => ['updated', 'status_changed'].includes(e.action)).length;
  const perfectedCount     = filtered.filter((e) => e.action === 'perfected').length;
  const signedOffCount     = filtered.filter((e) => e.action === 'legal_signoff').length;
  const uniqueActors       = new Set(filtered.map((e) => e.performedByName)).size;
  const uniqueCollaterals  = new Set(filtered.map((e) => e.collateralId).filter(Boolean)).size;

  const hasActiveFilters = search || actionFilter !== 'All' || categoryFilter !== 'All'
    || dateFrom || dateTo || userFilter !== 'All' || collateralFilter !== 'All'
    || collateralActionFilter !== 'all_collateral';

  function clearFilters() {
    setSearch('');
    setActionFilter('All');
    setCategoryFilter('All');
    setDateFrom('');
    setDateTo('');
    setUserFilter('All');
    setCollateralFilter('All');
    setCollateralActionFilter('all_collateral');
  }

  function toggleRow(id: string) {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function exportCSV() {
    const headers = ['#', 'Timestamp', 'Event Type', 'Action', 'Officer / Actor', 'IP Address', 'Collateral ID', 'Message', 'Detail', 'Field Changes'];
    const rows = filtered.map((e, i) => [
      String(i + 1),
      formatDateTime(e.createdAt),
      getEntryCategory(e).label,
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
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-trail-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    setExportMenuOpen(false);
  }

  function exportPDF() {
    const html = buildPrintableHTML(filtered, { dateFrom, dateTo, collateralFilter, userFilter, collateralActionFilter });
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); }, 400);
    setExportMenuOpen(false);
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Tab Switcher */}
      <div className="px-6 pt-4 pb-0 bg-white border-b border-border shrink-0">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('audit')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'audit' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldCheck size={14} />
            Security &amp; Compliance Trail
          </button>
          <button
            onClick={() => setActiveTab('risk')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'risk' ?'border-amber-500 text-amber-600' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <ShieldAlert size={14} />
            Risk Priority View
          </button>
        </div>
      </div>

      {activeTab === 'risk' ? (
        <RiskPriorityPanel />
      ) : (
        <>
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck size={20} className="text-primary" />
              <h1 className="text-xl font-bold text-foreground">Security &amp; Compliance Trail</h1>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Regulatory Compliance</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Immutable record of all collateral actions — created, edited, perfected, signed off — with officer names and timestamps
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
            {/* Export dropdown */}
            <div className="relative" ref={exportMenuRef}>
              <button
                onClick={() => setExportMenuOpen((v) => !v)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Download size={14} />
                Export
                <ChevronDown size={12} className={`transition-transform ${exportMenuOpen ? 'rotate-180' : ''}`} />
              </button>
              {exportMenuOpen && (
                <div className="absolute right-0 top-full mt-1 w-44 bg-white border border-border rounded-lg shadow-lg z-20 overflow-hidden">
                  <button
                    onClick={exportCSV}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    <FileText size={14} className="text-teal-600" />
                    Export as CSV
                  </button>
                  <button
                    onClick={exportPDF}
                    className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-foreground hover:bg-muted transition-colors border-t border-border"
                  >
                    <Printer size={14} className="text-blue-600" />
                    Export as PDF
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* KPI Strip — collateral-focused */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
        <KpiCard label="Created"          value={createdCount}      icon={PlusCircle}    color="bg-green-100 text-green-600" />
        <KpiCard label="Edited"           value={editedCount}       icon={Pen}           color="bg-blue-100 text-blue-600" />
        <KpiCard label="Perfected"        value={perfectedCount}    icon={Stamp}         color="bg-teal-100 text-teal-600" />
        <KpiCard label="Signed Off"       value={signedOffCount}    icon={CheckCircle2}  color="bg-emerald-100 text-emerald-600" />
        <KpiCard label="Unique Officers"  value={uniqueActors}      icon={User}          color="bg-violet-100 text-violet-600" />
        <KpiCard label="Collaterals"      value={uniqueCollaterals} icon={FolderOpen}    color="bg-amber-100 text-amber-600" />
      </div>

      {/* Collateral Action Pills */}
      <div className="px-6 pb-2 shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Filter by Collateral Action</p>
        <div className="flex items-center gap-2 flex-wrap">
          {COLLATERAL_ACTION_PILLS.map((pill) => {
            const PillIcon = pill.icon;
            return (
              <button
                key={pill.key}
                onClick={() => { setCollateralActionFilter(pill.key); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                  collateralActionFilter === pill.key
                    ? 'bg-primary text-white border-primary' :'bg-white text-foreground/70 border-border hover:bg-muted'
                }`}
              >
                <PillIcon size={11} />
                {pill.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Category Pills */}
      <div className="px-6 pb-3 shrink-0">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Filter by Event Category</p>
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_PILLS.map((pill) => (
            <button
              key={pill.key}
              onClick={() => { setCategoryFilter(pill.key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                categoryFilter === pill.key
                  ? 'bg-foreground text-white border-foreground'
                  : 'bg-white text-foreground/70 border-border hover:bg-muted'
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
              placeholder="Search by message, collateral ID, officer, IP address…"
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
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} />
              Clear All
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
                <option value="All">All Officers</option>
                {distinctUsers.map((u) => (
                  <option key={u} value={u}>{u}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={collateralFilter}
                onChange={(e) => setCollateralFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="All">All Collaterals</option>
                {distinctCollaterals.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-6">
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
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
              <p className="text-sm font-semibold text-red-600">Failed to load security &amp; compliance trail</p>
              <p className="text-xs text-muted-foreground mt-1 mb-4">{fetchError}</p>
              <button onClick={loadData} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
                <RefreshCw size={13} /> Retry
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
                      <div className="flex items-center gap-1"><User size={11} /> Officer / Actor</div>
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
                    const catConfig = getEntryCategory(entry);
                    const dot = getDot(entry.action, entry.eventCategory);
                    const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
                    const hasDetail = !!entry.detail;
                    const isExpandable = hasChanges || hasDetail;
                    const isExpanded = expandedRows.has(entry.id);
                    const isSignOff = entry.action === 'legal_signoff';

                    const EntryIcon = catConfig.icon;

                    return (
                      <React.Fragment key={entry.id}>
                        <tr
                          className={`border-b border-border last:border-b-0 ${isExpandable ? 'cursor-pointer' : ''} hover:bg-muted/20 transition-colors ${isSignOff ? 'bg-emerald-50/30' : ''}`}
                          onClick={() => isExpandable && toggleRow(entry.id)}
                        >
                          <td className="px-4 py-3 text-xs text-muted-foreground font-mono">
                            {(page - 1) * PAGE_SIZE + idx + 1}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <div className="flex flex-col gap-0.5">
                              <div className="flex items-center gap-1.5 text-xs text-foreground font-mono">
                                <Clock size={11} className="text-muted-foreground shrink-0" />
                                {formatDateTime(entry.createdAt)}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${catConfig.bg} ${catConfig.text}`}>
                                <EntryIcon size={10} />
                                {catConfig.label}
                              </span>
                            </div>
                            <div className="mt-1 ml-4">
                              <span className="text-xs text-muted-foreground font-mono">{entry.action.replace(/_/g, ' ')}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1.5">
                              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                <User size={11} className="text-primary" />
                              </div>
                              <div>
                                <p className="text-xs font-semibold text-foreground leading-tight">
                                  {entry.performedByName || 'System'}
                                </p>
                                {isSignOff && (
                                  <p className="text-xs text-emerald-600 font-medium leading-tight">Legal Officer</p>
                                )}
                              </div>
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
            <span className="font-semibold">Regulatory Notice:</span> This security &amp; compliance trail is an immutable record of all system actions. Records are retained for compliance with Bank of Tanzania regulatory requirements and applicable perfection authority rules (BRELA, Lands Registry, TRA, DSE, TASAC). Use the Export button to download CSV or PDF for offline archival and regulatory submissions.
          </p>
        </div>
      </div>
        </>
      )}
    </div>
  );
}
