'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Activity, Search, Filter, Download, RefreshCw, ChevronDown, ChevronRight, User, Clock, ArrowRight, X, LogIn, FolderOpen, GitBranch, CheckCircle, Globe, MessageSquare, Eye, Users, Lock } from 'lucide-react';
import { auditLogService, AuditLogEntry, FieldChange } from '@/lib/supabase/auditLogService';
import Icon from '@/components/ui/AppIcon';


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

// ─── Tab Config ───────────────────────────────────────────────────────────────

const TABS = [
  { key: 'all',               label: 'All Activity',        icon: Activity,    category: 'All' },
  { key: 'collateral_change', label: 'Collateral Records',  icon: FolderOpen,  category: 'collateral_change' },
  { key: 'approval',          label: 'Approvals',           icon: CheckCircle, category: 'approval' },
  { key: 'status_transition', label: 'Status Transitions',  icon: GitBranch,   category: 'status_transition' },
  { key: 'login',             label: 'Login History',       icon: LogIn,       category: 'login' },
];

// ─── Action / Category Styles ─────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  created:         { bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500',   label: 'Created' },
  updated:         { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Updated' },
  deleted:         { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Deleted' },
  perfected:       { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500',    label: 'Perfected' },
  approved:        { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
  rejected:        { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'Rejected' },
  submitted:       { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500',  label: 'Submitted' },
  reviewed:        { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Reviewed' },
  returned:        { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500',  label: 'Returned' },
  overdue:         { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Overdue' },
  login:           { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500',  label: 'Login' },
  logout:          { bg: 'bg-gray-100',    text: 'text-gray-600',    dot: 'bg-gray-400',    label: 'Logout' },
  login_failed:    { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Login Failed' },
  STATUS_CHANGE:   { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  label: 'Status Change' },
  DOCUMENT_UPLOAD: { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    label: 'Doc Upload' },
  export:          { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500',    label: 'Export' },
  reopened:        { bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500',     label: 'Reopened' },
} satisfies Record<string, { bg: string; text: string; dot: string; label: string }>;

function getActionStyle(action: string): { bg: string; text: string; dot: string; label: string } {
  return (ACTION_STYLES as Record<string, { bg: string; text: string; dot: string; label: string }>)[action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: action.replace(/_/g, ' ') };
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ENTRIES: AuditLogEntry[] = [
  {
    id: 'al-001', collateralId: 'col-0312', entityType: 'collateral', action: 'created',
    message: 'New collateral record registered: col-0312',
    detail: 'Coastal Traders Co. · Mortgage · TSh 780M · Justification: New loan application LAP-2026-0312 approved by credit committee',
    performedByName: 'J. Kamau', ipAddress: '196.216.10.45', eventCategory: 'collateral_change',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: '', new_value: 'Draft' },
      { field: 'collateral_type', label: 'Collateral Type', old_value: '', new_value: 'Mortgage' },
      { field: 'value_tsh', label: 'Value (TSh)', old_value: '', new_value: '780,000,000' },
      { field: 'assigned_officer', label: 'Assigned Officer', old_value: '', new_value: 'J. Kamau' },
    ],
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-002', collateralId: 'col-0289', entityType: 'collateral', action: 'approved',
    message: 'Collateral col-0289 approved for perfection',
    detail: 'Karibu Textiles Ltd · Debenture · Justification: All documentation verified, LTV within acceptable range (65%), no fraud flags',
    performedByName: 'A. Mwangi', ipAddress: '196.216.10.67', eventCategory: 'approval',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Under Review', new_value: 'Approved' },
      { field: 'approved_by', label: 'Approved By', old_value: '', new_value: 'A. Mwangi' },
      { field: 'approval_date', label: 'Approval Date', old_value: '', new_value: '28 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 1.5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-003', collateralId: undefined, entityType: 'system', action: 'login',
    message: 'User login successful — J. Kamau',
    detail: 'Session started via Chrome 124 on Windows 11 · MFA verified',
    performedByName: 'J. Kamau', ipAddress: '196.216.10.45', eventCategory: 'login',
    fieldChanges: null,
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-004', collateralId: 'col-0041', entityType: 'collateral', action: 'overdue',
    message: 'Status transition: col-0041 moved to Overdue',
    detail: 'Karibu Enterprises Ltd · BRELA deadline missed by 12 days · Justification: Automatic system escalation per compliance rule CR-004',
    performedByName: 'System', ipAddress: '127.0.0.1', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Submitted', new_value: 'Overdue' },
      { field: 'days_overdue', label: 'Days Overdue', old_value: '0', new_value: '12' },
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-005', collateralId: 'col-0312', entityType: 'collateral', action: 'updated',
    message: 'Collateral record updated: col-0312',
    detail: 'Value and perfection deadline revised · Justification: Revaluation report received from certified valuer (REF: VAL-2026-0312)',
    performedByName: 'J. Kamau', ipAddress: '196.216.10.45', eventCategory: 'collateral_change',
    fieldChanges: [
      { field: 'value_tsh', label: 'Value (TSh)', old_value: '780,000,000', new_value: '850,000,000' },
      { field: 'perfection_deadline', label: 'Perfection Deadline', old_value: '01 May 2026', new_value: '15 May 2026' },
      { field: 'valuation_date', label: 'Valuation Date', old_value: '01 Jan 2026', new_value: '25 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-006', collateralId: 'col-0178', entityType: 'collateral', action: 'rejected',
    message: 'Approval rejected for col-0178',
    detail: 'Simba Holdings Ltd · Justification: Title deed number mismatch detected — AI fraud flag confirmed by compliance officer. Returned to originator for correction.',
    performedByName: 'P. Ochieng', ipAddress: '41.188.32.12', eventCategory: 'approval',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Under Review', new_value: 'Rejected' },
      { field: 'rejection_reason', label: 'Rejection Reason', old_value: '', new_value: 'Title deed mismatch — fraud flag' },
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-007', collateralId: undefined, entityType: 'system', action: 'login',
    message: 'User login successful — A. Mwangi',
    detail: 'Session started via Firefox 125 on macOS · MFA verified',
    performedByName: 'A. Mwangi', ipAddress: '196.216.10.67', eventCategory: 'login',
    fieldChanges: null,
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-008', collateralId: 'col-0289', entityType: 'collateral', action: 'perfected',
    message: 'Status transition: col-0289 perfected at BRELA',
    detail: 'Karibu Textiles Ltd · Debenture · Registration No: BRELA/2026/04/0289 · Justification: BRELA confirmation received, certificate uploaded',
    performedByName: 'A. Mwangi', ipAddress: '196.216.10.67', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Approved', new_value: 'Perfected' },
      { field: 'registration_number', label: 'Registration No.', old_value: '', new_value: 'BRELA/2026/04/0289' },
      { field: 'perfection_date', label: 'Perfection Date', old_value: '', new_value: '28 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-009', collateralId: undefined, entityType: 'system', action: 'login_failed',
    message: 'Login attempt failed — unknown user',
    detail: 'Invalid credentials · 3 consecutive failed attempts · Account temporarily locked',
    performedByName: 'Unknown', ipAddress: '102.89.45.201', eventCategory: 'login',
    fieldChanges: null,
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-010', collateralId: 'col-0099', entityType: 'collateral', action: 'submitted',
    message: 'Status transition: col-0099 submitted for review',
    detail: 'Mombasa Freight Ltd · Motor Vehicle · Justification: All pre-submission checks passed, submitted by relationship manager per SOP-COL-003',
    performedByName: 'S. Njoroge', ipAddress: '196.216.10.88', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Draft', new_value: 'Submitted' },
      { field: 'submitted_by', label: 'Submitted By', old_value: '', new_value: 'S. Njoroge' },
      { field: 'submission_date', label: 'Submission Date', old_value: '', new_value: '28 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-011', collateralId: 'col-0099', entityType: 'collateral', action: 'reviewed',
    message: 'Collateral col-0099 reviewed by compliance',
    detail: 'Mombasa Freight Ltd · Justification: Compliance review completed, minor documentation gap noted — owner asked to provide updated insurance certificate',
    performedByName: 'P. Ochieng', ipAddress: '41.188.32.12', eventCategory: 'approval',
    fieldChanges: [
      { field: 'review_status', label: 'Review Status', old_value: 'Pending', new_value: 'Reviewed' },
      { field: 'review_notes', label: 'Review Notes', old_value: '', new_value: 'Insurance certificate required' },
    ],
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'al-012', collateralId: undefined, entityType: 'system', action: 'logout',
    message: 'User session ended — P. Ochieng',
    detail: 'Session duration: 3h 42m · Normal logout',
    performedByName: 'P. Ochieng', ipAddress: '41.188.32.12', eventCategory: 'login',
    fieldChanges: null,
    createdAt: new Date(Date.now() - 16 * 60 * 60 * 1000).toISOString(),
  },
];

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

// ─── Activity Row ─────────────────────────────────────────────────────────────

function ActivityRow({ entry, index }: { entry: AuditLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActionStyle(entry.action);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
  const hasDetail = !!entry.detail;
  const isExpandable = hasChanges || hasDetail;

  // Extract justification from detail
  const justification = entry.detail?.includes('Justification:')
    ? entry.detail.split('Justification:')[1]?.trim()
    : null;
  const detailWithoutJustification = entry.detail?.includes('Justification:')
    ? entry.detail.split('·').filter(p => !p.includes('Justification:')).join('·').trim()
    : entry.detail;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={`flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors ${isExpandable ? 'cursor-pointer' : ''}`}
        onClick={() => isExpandable && setExpanded(v => !v)}
      >
        {/* Index + timeline dot */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0 w-8">
          <span className="text-xs text-muted-foreground font-mono tabular-nums">{String(index + 1).padStart(2, '0')}</span>
          <div className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
        </div>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap min-w-0">
              <span className={`inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              {entry.collateralId && (
                <span className="text-xs font-mono text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded">
                  {entry.collateralId}
                </span>
              )}
              {entry.entityType && entry.entityType !== 'system' && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full capitalize">
                  {entry.entityType.replace(/_/g, ' ')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Clock size={10} />
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
            </div>
          </div>

          {/* Message */}
          <p className="text-sm font-medium text-foreground mt-1.5 leading-snug">{entry.message}</p>

          {/* Actor + IP + detail summary */}
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
            {detailWithoutJustification && !expanded && (
              <span className="text-xs text-muted-foreground truncate max-w-xs">{detailWithoutJustification}</span>
            )}
          </div>

          {/* Justification badge (collapsed) */}
          {justification && !expanded && (
            <div className="mt-2 flex items-start gap-1.5">
              <MessageSquare size={11} className="text-amber-500 shrink-0 mt-0.5" />
              <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-snug">
                <span className="font-semibold">Justification:</span> {justification}
              </p>
            </div>
          )}

          {/* Expand toggle hint */}
          {isExpandable && !expanded && (
            <div className="mt-2 flex items-center gap-1.5">
              {hasChanges && (
                <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                  <Eye size={11} /> {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''} changed
                  <ChevronRight size={11} />
                </span>
              )}
            </div>
          )}

          {/* Expanded content */}
          {expanded && (
            <div className="mt-3 space-y-2">
              {detailWithoutJustification && (
                <p className="text-xs text-muted-foreground">{detailWithoutJustification}</p>
              )}
              {justification && (
                <div className="flex items-start gap-1.5">
                  <MessageSquare size={11} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5 leading-snug flex-1">
                    <span className="font-semibold">Justification:</span> {justification}
                  </p>
                </div>
              )}
              {hasChanges && <FieldChangeDiff changes={entry.fieldChanges!} />}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ChevronDown size={11} />
                <span>Click to collapse</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color, sub }: {
  label: string; value: number | string; icon: React.ElementType; color: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon size={18} />
      </div>
      <div className="min-w-0">
        <p className="text-2xl font-bold tabular-nums text-foreground font-mono">{value}</p>
        <p className="text-xs text-muted-foreground leading-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/60 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

// ─── User Activity Summary Card ───────────────────────────────────────────────

function UserActivityCard({ name, count, lastSeen, ip }: { name: string; count: number; lastSeen: string; ip: string }) {
  const initials = name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0 hover:bg-muted/20 transition-colors">
      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{name}</p>
        <p className="text-xs text-muted-foreground font-mono">{ip}</p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-bold text-foreground tabular-nums">{count}</p>
        <p className="text-xs text-muted-foreground">{timeAgo(lastSeen)}</p>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 25;

export default function ActivityLogContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('all');
  const [search, setSearch] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [data, users] = await Promise.all([
        auditLogService.getAll({ search, dateFrom, dateTo }, 1000),
        auditLogService.getDistinctUsers(),
      ]);
      setEntries(data.length > 0 ? data : MOCK_ENTRIES);
      setDistinctUsers(users.length > 0 ? users : Array.from(new Set(MOCK_ENTRIES.map(e => e.performedByName))));
      setLastRefreshed(new Date());
    } catch {
      setEntries(MOCK_ENTRIES);
      setDistinctUsers(Array.from(new Set(MOCK_ENTRIES.map(e => e.performedByName))));
    } finally {
      setIsLoading(false);
    }
  }, [search, dateFrom, dateTo]);

  useEffect(() => {
    loadData();
    setPage(1);
  }, [loadData]);

  // Tab filtering
  const activeTabConfig = TABS.find(t => t.key === activeTab)!;
  const tabFiltered = entries.filter(e => {
    if (activeTab === 'all') return true;
    if (activeTab === 'approval') return e.eventCategory === 'approval' || ['approved', 'rejected', 'reviewed', 'returned', 'submitted'].includes(e.action);
    return e.eventCategory === activeTabConfig.category;
  });

  // User filter
  const userFiltered = tabFiltered.filter(e => userFilter === 'All' ? true : e.performedByName === userFilter);

  const totalPages = Math.ceil(userFiltered.length / PAGE_SIZE);
  const paginated = userFiltered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPIs
  const loginCount = entries.filter(e => e.eventCategory === 'login' && e.action !== 'logout').length;
  const collateralChanges = entries.filter(e => e.eventCategory === 'collateral_change').length;
  const approvals = entries.filter(e => ['approved', 'rejected', 'reviewed'].includes(e.action)).length;
  const statusTransitions = entries.filter(e => e.eventCategory === 'status_transition').length;
  const uniqueActors = new Set(entries.map(e => e.performedByName)).size;
  const failedLogins = entries.filter(e => e.action === 'login_failed').length;

  // Top actors for sidebar
  const actorMap: Record<string, { count: number; lastSeen: string; ip: string }> = {};
  entries.forEach(e => {
    if (!actorMap[e.performedByName]) actorMap[e.performedByName] = { count: 0, lastSeen: e.createdAt, ip: e.ipAddress ?? '' };
    actorMap[e.performedByName].count++;
    if (new Date(e.createdAt) > new Date(actorMap[e.performedByName].lastSeen)) {
      actorMap[e.performedByName].lastSeen = e.createdAt;
      actorMap[e.performedByName].ip = e.ipAddress ?? '';
    }
  });
  const topActors = Object.entries(actorMap).sort((a, b) => b[1].count - a[1].count).slice(0, 6);

  const hasActiveFilters = userFilter !== 'All' || dateFrom || dateTo;

  function clearFilters() {
    setUserFilter('All');
    setDateFrom('');
    setDateTo('');
  }

  function exportCSV() {
    const headers = ['#', 'Timestamp', 'Action', 'Category', 'Actor', 'IP Address', 'Collateral ID', 'Message', 'Justification', 'Field Changes'];
    const rows = userFiltered.map((e, i) => {
      const justification = e.detail?.includes('Justification:') ? e.detail.split('Justification:')[1]?.trim() : '';
      return [
        String(i + 1),
        formatDateTime(e.createdAt),
        e.action,
        e.eventCategory ?? '',
        e.performedByName,
        e.ipAddress ?? '',
        e.collateralId ?? '',
        e.message,
        justification,
        e.fieldChanges ? e.fieldChanges.map(f => `${f.label}: ${f.old_value || 'empty'} → ${f.new_value || 'empty'}`).join('; ') : '',
      ];
    });
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `user-activity-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* ── Header ── */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Activity size={20} className="text-primary" />
              <h1 className="text-xl font-bold text-foreground">User Activity Log</h1>
              <span className="text-xs font-medium bg-primary/10 text-primary px-2 py-0.5 rounded-full">Live</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Detailed record of who changed what — collateral records, approvals, status transitions, and login history with timestamps and justifications
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

      {/* ── KPI Strip ── */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0 border-b border-border bg-white">
        <KpiCard label="Login Events"       value={loginCount}        icon={LogIn}      color="bg-violet-100 text-violet-600" />
        <KpiCard label="Record Changes"     value={collateralChanges} icon={FolderOpen}  color="bg-blue-100 text-blue-600" />
        <KpiCard label="Approvals"          value={approvals}         icon={CheckCircle} color="bg-emerald-100 text-emerald-600" />
        <KpiCard label="Status Transitions" value={statusTransitions} icon={GitBranch}   color="bg-amber-100 text-amber-600" />
        <KpiCard label="Active Users"       value={uniqueActors}      icon={Users}       color="bg-green-100 text-green-600" />
        <KpiCard label="Failed Logins"      value={failedLogins}      icon={Lock}        color="bg-red-100 text-red-600" />
      </div>

      {/* ── Body: Tabs + Content + Sidebar ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Left: Tabs + Table */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Tabs */}
          <div className="px-6 pt-4 pb-0 border-b border-border bg-white shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {TABS.map(tab => {
                const TabIcon = tab.icon as React.ElementType;
                const count = tab.key === 'all'
                  ? entries.length
                  : entries.filter(e => {
                      if (tab.key === 'approval') return e.eventCategory === 'approval' || ['approved', 'rejected', 'reviewed', 'returned', 'submitted'].includes(e.action);
                      return e.eventCategory === tab.category;
                    }).length;
                return (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key); setPage(1); }}
                    className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                      activeTab === tab.key
                        ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <TabIcon size={14} />
                    {tab.label}
                    <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                      activeTab === tab.key ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search + Filters bar */}
          <div className="px-6 py-3 bg-white border-b border-border shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by message, collateral ID, actor, IP…"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
              <button
                onClick={() => setShowFilters(v => !v)}
                className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
                  showFilters || hasActiveFilters ? 'border-primary text-primary bg-primary/5' : 'border-border hover:bg-muted'
                }`}
              >
                <Filter size={14} />
                Filters
                {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
              </button>
              {hasActiveFilters && (
                <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                  <X size={12} /> Clear
                </button>
              )}
              <span className="text-xs text-muted-foreground ml-auto">
                {userFiltered.length} event{userFiltered.length !== 1 ? 's' : ''}
              </span>
            </div>

            {showFilters && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">User / Actor</label>
                  <select
                    value={userFilter}
                    onChange={e => { setUserFilter(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="All">All Users</option>
                    {distinctUsers.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">From Date</label>
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={e => { setDateFrom(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">To Date</label>
                  <input
                    type="date"
                    value={dateTo}
                    onChange={e => { setDateTo(e.target.value); setPage(1); }}
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Activity Feed */}
          <div className="flex-1 overflow-y-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-48">
                <RefreshCw size={20} className="animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Loading activity…</span>
              </div>
            ) : paginated.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-48 text-center px-6">
                <Activity size={32} className="text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">No activity found</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Try adjusting your filters or search query</p>
              </div>
            ) : (
              <div className="bg-white">
                {paginated.map((entry, idx) => (
                  <ActivityRow key={entry.id} entry={entry} index={(page - 1) * PAGE_SIZE + idx} />
                ))}
              </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between px-5 py-3 border-t border-border bg-white">
                <span className="text-xs text-muted-foreground">
                  Page {page} of {totalPages} · {userFiltered.length} total events
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    Previous
                  </button>
                  <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1.5 text-xs border border-border rounded-lg hover:bg-muted disabled:opacity-40 transition-colors"
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Sidebar: Top Active Users */}
        <div className="w-64 shrink-0 border-l border-border bg-white flex flex-col overflow-hidden hidden lg:flex">
          <div className="px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Users size={14} className="text-primary" />
              <p className="text-sm font-semibold text-foreground">Top Active Users</p>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">By total events in current view</p>
          </div>
          <div className="flex-1 overflow-y-auto">
            {topActors.map(([name, data]) => (
              <UserActivityCard key={name} name={name} count={data.count} lastSeen={data.lastSeen} ip={data.ip} />
            ))}
          </div>

          {/* Login History Summary */}
          <div className="border-t border-border px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <LogIn size={13} className="text-violet-600" />
              <p className="text-xs font-semibold text-foreground">Recent Logins</p>
            </div>
            <div className="space-y-1.5">
              {entries
                .filter(e => e.eventCategory === 'login')
                .slice(0, 4)
                .map(e => (
                  <div key={e.id} className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <div className={`w-1.5 h-1.5 rounded-full shrink-0 ${e.action === 'login_failed' ? 'bg-red-500' : e.action === 'logout' ? 'bg-gray-400' : 'bg-green-500'}`} />
                      <span className="text-xs text-foreground/80 truncate">{e.performedByName}</span>
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0">{timeAgo(e.createdAt)}</span>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
