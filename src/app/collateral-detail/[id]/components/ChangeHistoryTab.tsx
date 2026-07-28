'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { RefreshCw, User, Clock, ArrowRight, Shield, FileText, Activity, Filter, AlertTriangle, CheckCircle2, Loader2, Tag, Hash, ChevronDown, ChevronUp, Lock,  } from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { auditLogService, AuditLogEntry } from '@/lib/supabase/auditLogService';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((n) => n.charAt(0).toUpperCase())
    .join('');
}

const AVATAR_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function avatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; dot: string; badge: string }> = {
  status_transition: { label: 'Status Change',    dot: 'bg-amber-500',   badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  collateral_change: { label: 'Field Update',     dot: 'bg-blue-500',    badge: 'bg-blue-50 text-blue-700 border-blue-200' },
  document:          { label: 'Document',         dot: 'bg-indigo-500',  badge: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  multi_collateral:  { label: 'Loan Link',        dot: 'bg-violet-500',  badge: 'bg-violet-50 text-violet-700 border-violet-200' },
  charge_registry:   { label: 'Charge Registry',  dot: 'bg-purple-500',  badge: 'bg-purple-50 text-purple-700 border-purple-200' },
  batch_operation:   { label: 'Batch Operation',  dot: 'bg-slate-500',   badge: 'bg-slate-50 text-slate-700 border-slate-200' },
  system:            { label: 'System',           dot: 'bg-gray-400',    badge: 'bg-gray-50 text-gray-600 border-gray-200' },
};

function getCategoryConfig(cat?: string) {
  return CATEGORY_CONFIG[cat ?? ''] ?? { label: cat ?? 'Event', dot: 'bg-gray-400', badge: 'bg-gray-50 text-gray-600 border-gray-200' };
}

// ─── ChangeEventRow ───────────────────────────────────────────────────────────

function ChangeEventRow({ entry, index }: { entry: AuditLogEntry; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const cfg = getCategoryConfig(entry.eventCategory);
  const hasFieldChanges = entry.fieldChanges && entry.fieldChanges.length > 0;
  const isStatusChange = entry.action === 'status_changed' || entry.eventCategory === 'status_transition';
  const initials = getInitials(entry.performedByName);
  const avatarCls = avatarColor(entry.performedByName);

  return (
    <div className={`group relative ${index > 0 ? 'border-t border-gray-100' : ''}`}>
      {/* Timeline connector */}
      <div className="absolute left-[2.35rem] top-0 bottom-0 w-px bg-gray-100 group-first:top-6" />

      <div className="flex gap-4 px-5 py-4 hover:bg-gray-50/70 transition-colors">
        {/* Avatar */}
        <div className={`relative z-10 w-9 h-9 rounded-full flex items-center justify-center shrink-0 text-xs font-700 shadow-sm ring-2 ring-white ${avatarCls}`}>
          {initials || <User size={14} />}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Top row: message + category badge + timestamp */}
          <div className="flex items-start gap-2 flex-wrap">
            <p className="text-sm font-600 text-gray-800 leading-snug flex-1 min-w-0">{entry.message}</p>
            <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-[10px] font-600 px-2 py-0.5 rounded-full border uppercase tracking-wide ${cfg.badge}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>
          </div>

          {/* Who + when */}
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500 flex-wrap">
            <span className="flex items-center gap-1 font-500 text-gray-700">
              <User size={10} className="text-gray-400" />
              {entry.performedByName}
            </span>
            {entry.eventCategory && (
              <>
                <span className="text-gray-300">·</span>
                <span className="flex items-center gap-1">
                  <Tag size={10} className="text-gray-400" />
                  {entry.action.replace(/_/g, ' ')}
                </span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span className="flex items-center gap-1 ml-auto">
              <Clock size={10} className="text-gray-400" />
              <span className="text-gray-400">{timeAgo(entry.createdAt)}</span>
              <span className="text-gray-300 hidden sm:inline">·</span>
              <span className="text-gray-400 font-mono text-[10px] hidden sm:inline">{formatDateTime(entry.createdAt)}</span>
            </span>
          </div>

          {/* Status transition arrow */}
          {isStatusChange && entry.detail && (
            <div className="mt-2 flex items-center gap-2 text-xs">
              <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 font-500">{entry.detail.split('→')[0]?.trim() || 'Previous'}</span>
              <ArrowRight size={12} className="text-amber-500 shrink-0" />
              <span className="px-2 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 font-600">
                {entry.detail.split('→')[1]?.trim() || entry.message.split('→')[1]?.trim() || 'New Status'}
              </span>
            </div>
          )}

          {/* Detail text (non-status) */}
          {!isStatusChange && entry.detail && (
            <p className="mt-1 text-xs text-gray-500 leading-relaxed">{entry.detail}</p>
          )}

          {/* Field changes — expandable */}
          {hasFieldChanges && (
            <div className="mt-2">
              <button
                onClick={() => setExpanded((v) => !v)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-500 transition-colors"
              >
                {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''} changed
              </button>
              {expanded && (
                <div className="mt-2 rounded-lg border border-gray-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-3 py-2 font-600 text-gray-500 uppercase tracking-wide text-[10px] w-1/4">Field</th>
                        <th className="text-left px-3 py-2 font-600 text-gray-500 uppercase tracking-wide text-[10px] w-[37.5%]">Previous Value</th>
                        <th className="text-left px-3 py-2 font-600 text-gray-500 uppercase tracking-wide text-[10px] w-[37.5%]">New Value</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entry.fieldChanges!.map((fc, i) => (
                        <tr key={i} className="border-b border-gray-100 last:border-0 hover:bg-gray-50/50">
                          <td className="px-3 py-2 font-600 text-gray-700">{fc.label}</td>
                          <td className="px-3 py-2 text-gray-400 line-through">{fc.old_value || '—'}</td>
                          <td className="px-3 py-2 text-gray-800 font-500">{fc.new_value || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Reason */}
          {entry.reason && (
            <div className="mt-2 flex items-start gap-1.5 text-xs text-gray-500 italic">
              <AlertTriangle size={10} className="text-amber-400 mt-0.5 shrink-0" />
              <span>Reason: {entry.reason}</span>
            </div>
          )}

          {/* Audit reference */}
          <div className="mt-1.5 flex items-center gap-1 text-[10px] text-gray-300">
            <Hash size={9} />
            <span className="font-mono">{entry.id.slice(0, 8).toUpperCase()}</span>
            {entry.ipAddress && (
              <>
                <span className="mx-1">·</span>
                <span className="font-mono">{entry.ipAddress}</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface ChangeHistoryTabProps {
  collateral: CollateralRecord;
}

const FILTER_OPTIONS = [
  { value: 'all',               label: 'All Changes' },
  { value: 'status_transition', label: 'Status Transitions' },
  { value: 'collateral_change', label: 'Field Updates' },
  { value: 'document',          label: 'Documents' },
  { value: 'multi_collateral',  label: 'Loan Links' },
];

export default function ChangeHistoryTab({ collateral }: ChangeHistoryTabProps) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [actorFilter, setActorFilter] = useState('All');

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const data = await auditLogService.getAll(
        { collateralId: collateral.collateralId },
        500
      );
      setEntries(data);
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [collateral.collateralId]);

  useEffect(() => { loadHistory(); }, [loadHistory]);

  // Derived filters
  const distinctActors = Array.from(new Set(entries.map((e) => e.performedByName))).sort();

  const filtered = entries.filter((e) => {
    const catMatch = categoryFilter === 'all' || e.eventCategory === categoryFilter;
    const actorMatch = actorFilter === 'All' || e.performedByName === actorFilter;
    return catMatch && actorMatch;
  });

  // Stats
  const statusChanges = entries.filter((e) => e.eventCategory === 'status_transition').length;
  const fieldUpdates = entries.filter((e) => e.eventCategory === 'collateral_change').length;
  const docEvents = entries.filter((e) => e.eventCategory === 'document').length;
  const uniqueActors = new Set(entries.map((e) => e.performedByName)).size;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading change history…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* SOX compliance banner */}
      <div className="flex items-start gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
          <Lock size={15} className="text-emerald-700" />
        </div>
        <div>
          <p className="text-sm font-600 text-emerald-800">SOX-Compliant Immutable Audit Trail</p>
          <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
            All changes to this collateral record are permanently logged and cannot be modified or deleted.
            Each entry captures the actor, timestamp, IP address, and exact field-level changes for full traceability.
          </p>
        </div>
        <div className="shrink-0 ml-auto">
          <span className="flex items-center gap-1 text-[10px] font-700 text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-1 rounded-full uppercase tracking-wide">
            <CheckCircle2 size={10} />
            Immutable
          </span>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Events',       value: entries.length,  icon: Activity,      color: 'text-gray-700',   bg: 'bg-gray-50' },
          { label: 'Status Transitions', value: statusChanges,   icon: ArrowRight,    color: 'text-amber-700',  bg: 'bg-amber-50' },
          { label: 'Field Updates',      value: fieldUpdates,    icon: FileText,      color: 'text-blue-700',   bg: 'bg-blue-50' },
          { label: 'Unique Actors',      value: uniqueActors,    icon: User,          color: 'text-violet-700', bg: 'bg-violet-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`flex items-center gap-3 p-3.5 rounded-xl border border-gray-200 ${kpi.bg}`}>
            <div className="w-8 h-8 rounded-lg bg-white/80 flex items-center justify-center shrink-0 shadow-sm">
              <kpi.icon size={15} className={kpi.color} />
            </div>
            <div>
              <p className="text-[10px] font-500 text-gray-500 uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-lg font-700 ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters + refresh */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-xs text-gray-500 font-500">
          <Filter size={12} />
          Filter:
        </div>

        {/* Category filter */}
        <div className="relative">
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none pr-7 cursor-pointer"
          >
            {FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>

        {/* Actor filter */}
        {distinctActors.length > 1 && (
          <div className="relative">
            <select
              value={actorFilter}
              onChange={(e) => setActorFilter(e.target.value)}
              className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 bg-white text-gray-700 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none pr-7 cursor-pointer"
            >
              <option value="All">All actors</option>
              {distinctActors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          </div>
        )}

        <button
          onClick={loadHistory}
          className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={11} />
          Refresh
        </button>
      </div>

      {/* Change log */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
          <div className="p-1.5 rounded-lg bg-gray-100">
            <Shield size={14} className="text-gray-600" />
          </div>
          <h3 className="text-sm font-600 text-gray-800">Change Log</h3>
          <span className="ml-1 text-xs font-500 bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">{filtered.length}</span>
          <span className="ml-auto text-[10px] text-gray-400 font-mono">
            {collateral.collateralId}
          </span>
        </div>

        {/* Entries */}
        {filtered.length === 0 ? (
          <div className="py-16 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-3">
              <Activity size={20} className="text-gray-400" />
            </div>
            <p className="text-sm font-500 text-gray-500">No change events found</p>
            <p className="text-xs text-gray-400 mt-1">
              {categoryFilter !== 'all' || actorFilter !== 'All' ?'Try adjusting your filters' :'Changes to this collateral record will appear here'}
            </p>
          </div>
        ) : (
          <div className="divide-y-0">
            {filtered.map((entry, i) => (
              <ChangeEventRow key={entry.id} entry={entry} index={i} />
            ))}
          </div>
        )}

        {/* Footer */}
        {filtered.length > 0 && (
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50/40 flex items-center justify-between">
            <p className="text-[10px] text-gray-400">
              Showing {filtered.length} of {entries.length} events · Oldest first available
            </p>
            <div className="flex items-center gap-1 text-[10px] text-gray-400">
              <Lock size={9} />
              Tamper-proof log
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
