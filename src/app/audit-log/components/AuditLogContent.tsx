'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { History, Search, Filter, Download, RefreshCw, ChevronDown, ChevronRight, User, Clock, FileText, ArrowRight, X, Calendar, AlertCircle, Link2, Stamp, Layers, BarChart2, Unlock,  } from 'lucide-react';
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
  DOCUMENT_UPLOAD:      { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500' },
  DOCUMENT_DELETE:      { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500' },
  REVIEW:               { bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500' },
  // ── Multi-collateral events ──────────────────────────────────────────────
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
};

function getActionStyle(action: string) {
  return ACTION_STYLES[action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' };
}

// ─── Category Pills config ────────────────────────────────────────────────────

const CATEGORY_PILLS = [
  { key: 'All',                  label: 'All Events' },
  { key: 'collateral_change',    label: 'Collateral Changes' },
  { key: 'status_transition',    label: 'Status Transitions' },
  { key: 'multi_collateral',     label: 'Multi-Collateral' },
  { key: 'charge_registry',      label: 'Charge Registry' },
  { key: 'batch_operation',      label: 'Batch Operations' },
  { key: 'document',             label: 'Documents' },
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

  // Determine event-type icon
  const EventIcon = ENTITY_ICON_MAP[entry.entityType] ?? FileText;

  return (
    <div className="border-b border-border last:border-b-0">
      <div
        className={`flex items-start gap-3 px-4 py-3 hover:bg-muted/30 transition-colors ${isExpandable ? 'cursor-pointer' : ''}`}
        onClick={() => isExpandable && setExpanded((v) => !v)}
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
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                {entry.action.replace(/_/g, ' ').toUpperCase()}
              </span>
              {/* Entity type */}
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                <EventIcon size={10} />
                {ENTITY_LABELS[entry.entityType] ?? entry.entityType}
              </span>
              {/* Collateral ID */}
              {entry.collateralId && (
                <span className="text-xs font-mono text-primary bg-primary/5 px-2 py-0.5 rounded">{entry.collateralId}</span>
              )}
              {/* Multi-collateral badge */}
              {entry.eventCategory === 'multi_collateral' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 border border-indigo-200">
                  <Link2 size={9} /> Multi-Collateral
                </span>
              )}
              {/* Batch badge */}
              {entry.eventCategory === 'batch_operation' && (
                <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                  <Layers size={9} /> Batch
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
            {!hasChanges && hasBatchSummary && (
              <span className="text-xs text-amber-600 font-medium flex items-center gap-0.5">
                Batch summary {expanded ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
              </span>
            )}
          </div>

          {/* Expanded detail */}
          {expanded && (
            <div className="mt-2">
              {entry.detail && <p className="text-xs text-muted-foreground mb-2">{entry.detail}</p>}
              {hasChanges && <FieldChangeDiff changes={entry.fieldChanges!} />}
              {hasBatchSummary && <BatchSummaryPanel items={entry.batchSummary!} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Entity icon map ──────────────────────────────────────────────────────────

const ENTITY_ICON_MAP: Record<string, React.ElementType> = {
  collateral:        FileText,
  perfection_request: Stamp,
  user:              User,
  document:          FileText,
  system:            BarChart2,
  collateral_link:   Link2,
  charge_registry:   Stamp,
  batch_operation:   Layers,
};

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ label, value, icon: Icon, color }: { label: string; value: number | string; icon: React.ElementType; color: string }) {
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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_ENTRIES: AuditLogEntry[] = [
  {
    id: '1', collateralId: 'col-0312', entityType: 'collateral', action: 'created',
    message: 'New collateral registered: col-0312', detail: 'Coastal Traders Co. · Mortgage · TSh 780M',
    performedByName: 'J. Kamau', eventCategory: 'collateral_change',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: '', new_value: 'Draft' },
      { field: 'assigned_officer', label: 'Assigned Officer', old_value: '', new_value: 'J. Kamau' },
    ],
    createdAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2', collateralId: 'col-0289', entityType: 'collateral', action: 'perfected',
    message: 'Collateral col-0289 perfected at BRELA', detail: 'Karibu Textiles Ltd · Debenture',
    performedByName: 'A. Mwangi', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Under Review', new_value: 'Perfected' },
      { field: 'registration_date', label: 'Registration Date', old_value: '', new_value: '25 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3', collateralId: 'col-0041', entityType: 'collateral', action: 'overdue',
    message: 'BRELA deadline missed — col-0041', detail: 'Karibu Enterprises Ltd · 12 days overdue',
    performedByName: 'System', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'status', label: 'Status', old_value: 'Submitted', new_value: 'Overdue' },
      { field: 'days_to_deadline', label: 'Days to Deadline', old_value: '0', new_value: '-12' },
    ],
    createdAt: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4', collateralId: 'col-0298', entityType: 'perfection_request', action: 'submitted',
    message: 'Lands Registry submission filed', detail: 'col-0298 · Mwanza Holdings · Mortgage',
    performedByName: 'P. Ochieng', eventCategory: 'status_transition',
    fieldChanges: [
      { field: 'request_status', label: 'Request Status', old_value: 'Draft', new_value: 'Submitted' },
    ],
    createdAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5', collateralId: 'col-0312', entityType: 'collateral', action: 'updated',
    message: 'Collateral record updated: col-0312', detail: 'Value and deadline revised',
    performedByName: 'J. Kamau', eventCategory: 'collateral_change',
    fieldChanges: [
      { field: 'value_tsh', label: 'Value (TSh)', old_value: '500,000,000', new_value: '650,000,000' },
      { field: 'perfection_deadline', label: 'Perfection Deadline', old_value: '01 May 2026', new_value: '15 May 2026' },
    ],
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
  },
  // ── Multi-collateral: Loan Linked ─────────────────────────────────────────
  {
    id: 'mc-1', collateralId: 'col-0312', entityType: 'collateral_link', action: 'loan_linked',
    message: 'Loan LN-2026-00891 linked to collateral col-0312 (2nd charge)',
    detail: 'Beneficiary: Mwanza Holdings Ltd · Allocated: TSh 120,000,000 · Charge Rank: 2nd',
    performedByName: 'J. Kamau', eventCategory: 'multi_collateral',
    fieldChanges: [
      { field: 'charge_rank', label: 'Charge Rank', old_value: '', new_value: '2nd' },
      { field: 'allocated_amount', label: 'Allocated Amount (TSh)', old_value: '', new_value: '120,000,000' },
      { field: 'start_date', label: 'Start Date', old_value: '', new_value: '28 Apr 2026' },
    ],
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  // ── Multi-collateral: Charge Rank Changed ────────────────────────────────
  {
    id: 'mc-2', collateralId: 'col-0289', entityType: 'collateral_link', action: 'charge_rank_changed',
    message: 'Charge ranking updated for col-0289 after first-charge loan closure',
    detail: 'Loan LN-2025-00234 closed · Remaining charges promoted · BRELA notified',
    performedByName: 'System', eventCategory: 'multi_collateral',
    fieldChanges: [
      { field: 'loan_ln_2025_00567_rank', label: 'LN-2025-00567 Rank', old_value: '2nd', new_value: '1st' },
      { field: 'loan_ln_2026_00112_rank', label: 'LN-2026-00112 Rank', old_value: '3rd', new_value: '2nd' },
    ],
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  // ── Multi-collateral: Equity Recalculated ────────────────────────────────
  {
    id: 'mc-3', collateralId: 'col-0312', entityType: 'collateral_link', action: 'equity_recalculated',
    message: 'Available equity recalculated for col-0312 after loan release',
    detail: 'Triggered by: Loan LN-2026-00445 released · LTV 70% applied · New equity available for new facilities',
    performedByName: 'System', eventCategory: 'multi_collateral',
    fieldChanges: [
      { field: 'total_secured_amount', label: 'Total Secured (TSh)', old_value: '350,000,000', new_value: '230,000,000' },
      { field: 'available_equity', label: 'Available Equity (TSh)', old_value: '0', new_value: '120,000,000' },
      { field: 'utilization_pct', label: 'Utilization %', old_value: '100%', new_value: '65.7%' },
    ],
    createdAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
  },
  // ── Charge Registry: Discharge Recorded ──────────────────────────────────
  {
    id: 'mc-4', collateralId: 'col-0041', entityType: 'charge_registry', action: 'discharge_recorded',
    message: 'Charge discharge recorded at BRELA for col-0041 (1st charge)',
    detail: 'Discharge No: DIS-BR-2026-00312 · Registry: BRELA · Certificate uploaded',
    performedByName: 'P. Ochieng', eventCategory: 'charge_registry',
    fieldChanges: [
      { field: 'charge_status', label: 'Charge Status', old_value: 'ACTIVE', new_value: 'DISCHARGED' },
      { field: 'discharge_number', label: 'Discharge Number', old_value: '', new_value: 'DIS-BR-2026-00312' },
      { field: 'discharge_date', label: 'Discharge Date', old_value: '', new_value: '28 Apr 2026' },
      { field: 'registry', label: 'Registry', old_value: '', new_value: 'BRELA' },
    ],
    createdAt: new Date(Date.now() - 7 * 60 * 60 * 1000).toISOString(),
  },
  // ── Charge Registry: Second Charge Registered ────────────────────────────
  {
    id: 'mc-5', collateralId: 'col-0298', entityType: 'charge_registry', action: 'created',
    message: 'Second charge registered at Lands Registry for col-0298',
    detail: 'Reg No: LR-2026-00789 · Loan: LN-2026-00891 · Disclosure of 1st charge included',
    performedByName: 'A. Mwangi', eventCategory: 'charge_registry',
    fieldChanges: [
      { field: 'charge_rank', label: 'Charge Rank', old_value: '', new_value: '2nd' },
      { field: 'registration_number', label: 'Registration Number', old_value: '', new_value: 'LR-2026-00789' },
      { field: 'registration_date', label: 'Registration Date', old_value: '', new_value: '27 Apr 2026' },
      { field: 'prior_charge_disclosed', label: 'Prior Charge Disclosed', old_value: '', new_value: 'Yes — BR-2024-00123' },
    ],
    createdAt: new Date(Date.now() - 9 * 60 * 60 * 1000).toISOString(),
  },
  // ── Batch Operation: Batch Release ───────────────────────────────────────
  {
    id: 'mc-6', collateralId: undefined, entityType: 'batch_operation', action: 'batch_release',
    message: 'Batch collateral release completed — 4 links released across 3 collateral records',
    detail: 'Initiated from Batch Release screen · All discharge templates generated and filed',
    performedByName: 'J. Kamau', eventCategory: 'batch_operation',
    fieldChanges: null,
    batchSummary: [
      { label: 'Links Released', value: 4, highlight: true },
      { label: 'Collaterals Affected', value: 3 },
      { label: 'Equity Released (TSh)', value: '340,000,000', highlight: true },
      { label: 'Discharge Templates', value: 4 },
      { label: 'Failed', value: 0 },
      { label: 'Duration', value: '1m 12s' },
    ],
    createdAt: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  },
  // ── Multi-collateral: Loan Released ──────────────────────────────────────
  {
    id: 'mc-7', collateralId: 'col-0289', entityType: 'collateral_link', action: 'loan_released',
    message: 'Collateral allocation released: LN-2025-00234 fully repaid',
    detail: 'Release reason: LOAN_FULLY_REPAID · Equity returned to available pool',
    performedByName: 'A. Mwangi', eventCategory: 'multi_collateral',
    fieldChanges: [
      { field: 'link_status', label: 'Link Status', old_value: 'ACTIVE', new_value: 'RELEASED' },
      { field: 'release_date', label: 'Release Date', old_value: '', new_value: '26 Apr 2026' },
      { field: 'equity_released', label: 'Equity Released (TSh)', old_value: '', new_value: '200,000,000' },
    ],
    createdAt: new Date(Date.now() - 14 * 60 * 60 * 1000).toISOString(),
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

const PAGE_SIZE = 50;

export default function AuditLogContent() {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [entityFilter, setEntityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [userFilter, setUserFilter] = useState('All');
  const [distinctActions, setDistinctActions] = useState<string[]>([]);
  const [distinctUsers, setDistinctUsers] = useState<string[]>([]);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);

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

  // Client-side filters
  const filtered = entries.filter((e) => {
    if (userFilter !== 'All' && e.performedByName !== userFilter) return false;
    if (categoryFilter !== 'All' && e.eventCategory !== categoryFilter) return false;
    return true;
  });

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // KPI counts
  const totalEntries = filtered.length;
  const withChanges = filtered.filter((e) => Array.isArray(e.fieldChanges) && e.fieldChanges.length > 0).length;
  const uniqueUsers = new Set(filtered.map((e) => e.performedByName)).size;
  const today = new Date().toDateString();
  const todayCount = filtered.filter((e) => new Date(e.createdAt).toDateString() === today).length;
  const multiCollateralCount = filtered.filter((e) => e.eventCategory === 'multi_collateral').length;
  const chargeRegistryCount = filtered.filter((e) => e.eventCategory === 'charge_registry').length;
  const batchCount = filtered.filter((e) => e.eventCategory === 'batch_operation').length;
  const dischargeCount = filtered.filter((e) => e.action === 'discharge_recorded').length;

  function clearFilters() {
    setSearch('');
    setActionFilter('All');
    setEntityFilter('All');
    setCategoryFilter('All');
    setDateFrom('');
    setDateTo('');
    setUserFilter('All');
  }

  const hasActiveFilters = search || actionFilter !== 'All' || entityFilter !== 'All' || categoryFilter !== 'All' || dateFrom || dateTo || userFilter !== 'All';

  function exportCSV() {
    const headers = ['Timestamp', 'Category', 'Action', 'Entity Type', 'Collateral ID', 'Message', 'Detail', 'Performed By', 'Field Changes'];
    const rows = filtered.map((e) => [
      formatDateTime(e.createdAt),
      e.eventCategory ?? '',
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
    a.download = `change-history-${new Date().toISOString().slice(0, 10)}.csv`;
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
              <h1 className="text-xl font-bold text-foreground">Change History</h1>
              <span className="text-xs font-medium bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">Multi-Collateral Events</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Complete change history including charge ranking changes, equity recalculations, discharge dates, and batch operation summaries
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {lastRefreshed && (
              <span className="text-xs text-muted-foreground hidden sm:block">
                Updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
            <button onClick={loadData} disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50">
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
              Refresh
            </button>
            <button onClick={exportCSV}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
              <Download size={14} />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* KPI Strip — row 1: standard */}
      <div className="px-6 pt-4 pb-2 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <KpiCard label="Total Events"       value={totalEntries}   icon={History}    color="bg-primary/10 text-primary" />
        <KpiCard label="With Field Changes" value={withChanges}    icon={FileText}   color="bg-blue-100 text-blue-600" />
        <KpiCard label="Active Users"       value={uniqueUsers}    icon={User}       color="bg-green-100 text-green-600" />
        <KpiCard label="Events Today"       value={todayCount}     icon={Calendar}   color="bg-amber-100 text-amber-600" />
      </div>

      {/* KPI Strip — row 2: multi-collateral */}
      <div className="px-6 pb-4 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <KpiCard label="Multi-Collateral Events" value={multiCollateralCount} icon={Link2}        color="bg-indigo-100 text-indigo-600" />
        <KpiCard label="Charge Registry Events"  value={chargeRegistryCount}  icon={Stamp}        color="bg-rose-100 text-rose-600" />
        <KpiCard label="Discharge Events"        value={dischargeCount}       icon={Unlock}       color="bg-teal-100 text-teal-600" />
        <KpiCard label="Batch Operations"        value={batchCount}           icon={Layers}       color="bg-amber-100 text-amber-600" />
      </div>

      {/* Category Pills */}
      <div className="px-6 pb-3 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          {CATEGORY_PILLS.map((pill) => (
            <button key={pill.key}
              onClick={() => { setCategoryFilter(pill.key); setPage(1); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                categoryFilter === pill.key
                  ? 'bg-primary text-white border-primary' :'bg-white text-foreground/70 border-border hover:bg-muted'
              }`}>
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
            <input type="text" placeholder="Search by message, collateral ID, user…"
              value={search} onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
          </div>
          <div className="relative">
            <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="All">All Actions</option>
              {distinctActions.map((a) => (
                <option key={a} value={a}>{a.replace(/_/g, ' ').toUpperCase()}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
              <option value="All">All Entities</option>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <button onClick={() => setShowFilters((v) => !v)}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm border rounded-lg transition-colors ${
              showFilters ? 'border-primary bg-primary/5 text-primary' : 'border-border bg-white hover:bg-muted'
            }`}>
            <Filter size={13} />
            More Filters
            {hasActiveFilters && <span className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="flex items-center gap-3 flex-wrap p-3 bg-muted/30 rounded-lg border border-border">
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">From</label>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                className="text-sm border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-muted-foreground whitespace-nowrap">To</label>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                className="text-sm border border-border rounded-lg px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20" />
            </div>
            <div className="relative">
              <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)}
                className="appearance-none pl-3 pr-8 py-1.5 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20">
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

        {/* Legend */}
        <div className="mt-4 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <p className="text-xs font-semibold text-indigo-800 mb-2 flex items-center gap-1">
            <Link2 size={12} /> Multi-Collateral Event Types
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { action: 'loan_linked',         label: 'Loan Linked' },
              { action: 'charge_rank_changed',  label: 'Charge Rank Changed' },
              { action: 'equity_recalculated',  label: 'Equity Recalculated' },
              { action: 'discharge_recorded',   label: 'Discharge Recorded' },
              { action: 'loan_released',        label: 'Loan Released' },
              { action: 'batch_release',        label: 'Batch Release' },
            ].map(({ action, label }) => {
              const s = getActionStyle(action);
              return (
                <div key={action} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${s.dot}`} />
                  <span className="text-xs text-indigo-700">{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
