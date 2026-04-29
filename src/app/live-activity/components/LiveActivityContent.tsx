'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Radio, RefreshCw, Search, X, Filter, ChevronDown, ChevronRight,
  User, Clock, MessageSquare, ArrowRight, Eye, Globe, Bell,
  ShieldAlert, GitBranch, Activity, Pause, Play, Zap,
} from 'lucide-react';
import { auditLogService, AuditLogEntry, FieldChange } from '@/lib/supabase/auditLogService';
import { smsAlertService, SmsAlert } from '@/lib/supabase/smsAlertService';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type StreamEventType = 'audit' | 'alert' | 'status_change';

interface StreamEvent {
  id: string;
  type: StreamEventType;
  timestamp: string;
  // audit fields
  auditEntry?: AuditLogEntry;
  // alert fields
  smsAlert?: SmsAlert;
}

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
  const secs = Math.floor(diff / 1000);
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ─── Action Styles ────────────────────────────────────────────────────────────

const ACTION_STYLES: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  created:           { bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500',   label: 'Created' },
  updated:           { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Updated' },
  deleted:           { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Deleted' },
  perfected:         { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500',    label: 'Perfected' },
  overdue:           { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'Overdue' },
  submitted:         { bg: 'bg-purple-100',  text: 'text-purple-700',  dot: 'bg-purple-500',  label: 'Submitted' },
  approved:          { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Approved' },
  rejected:          { bg: 'bg-rose-100',    text: 'text-rose-700',    dot: 'bg-rose-500',    label: 'Rejected' },
  returned:          { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500',  label: 'Returned' },
  status_changed:    { bg: 'bg-violet-100',  text: 'text-violet-700',  dot: 'bg-violet-500',  label: 'Status Changed' },
  document_uploaded: { bg: 'bg-cyan-100',    text: 'text-cyan-700',    dot: 'bg-cyan-500',    label: 'Doc Uploaded' },
  document_deleted:  { bg: 'bg-orange-100',  text: 'text-orange-700',  dot: 'bg-orange-500',  label: 'Doc Deleted' },
  sms_sent:          { bg: 'bg-sky-100',     text: 'text-sky-700',     dot: 'bg-sky-500',     label: 'SMS Sent' },
  login:             { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500', label: 'Login' },
  logout:            { bg: 'bg-slate-100',   text: 'text-slate-600',   dot: 'bg-slate-400',   label: 'Logout' },
  export:            { bg: 'bg-indigo-100',  text: 'text-indigo-700',  dot: 'bg-indigo-500',  label: 'Export' },
  bulk_upload:       { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Bulk Upload' },
  user_created:      { bg: 'bg-green-100',   text: 'text-green-700',   dot: 'bg-green-500',   label: 'User Created' },
  user_updated:      { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'User Updated' },
  user_deactivated:  { bg: 'bg-red-100',     text: 'text-red-700',     dot: 'bg-red-500',     label: 'User Deactivated' },
  loan_linked:       { bg: 'bg-blue-100',    text: 'text-blue-700',    dot: 'bg-blue-500',    label: 'Loan Linked' },
  loan_released:     { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500',    label: 'Loan Released' },
  batch_release:     { bg: 'bg-amber-100',   text: 'text-amber-700',   dot: 'bg-amber-500',   label: 'Batch Release' },
  released:          { bg: 'bg-teal-100',    text: 'text-teal-700',    dot: 'bg-teal-500',    label: 'Released' },
};

const SMS_STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  SENT:      { bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500' },
  DELIVERED: { bg: 'bg-teal-100',   text: 'text-teal-700',   dot: 'bg-teal-500' },
  FAILED:    { bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-500' },
  PENDING:   { bg: 'bg-amber-100',  text: 'text-amber-700',  dot: 'bg-amber-500' },
};

function getActionStyle(action: string) {
  return ACTION_STYLES[action] ?? { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400', label: action.replace(/_/g, ' ') };
}

// ─── Filter Config ────────────────────────────────────────────────────────────

const STREAM_FILTERS = [
  { key: 'all',           label: 'All Events',       icon: Activity },
  { key: 'audit',         label: 'Audit Events',     icon: ShieldAlert },
  { key: 'alert',         label: 'Alerts Sent',      icon: Bell },
  { key: 'status_change', label: 'Status Changes',   icon: GitBranch },
];

const REFRESH_INTERVALS = [
  { value: 10,  label: '10s' },
  { value: 30,  label: '30s' },
  { value: 60,  label: '1m' },
  { value: 120, label: '2m' },
];

// ─── FieldChangeDiff ──────────────────────────────────────────────────────────

function FieldChangeDiff({ changes }: { changes: FieldChange[] }) {
  if (!changes?.length) return null;
  return (
    <div className="mt-3 rounded-lg border border-border bg-muted/30 overflow-hidden">
      <div className="px-3 py-2 border-b border-border bg-muted/50">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Field Changes</p>
      </div>
      <div className="divide-y divide-border">
        {changes.map((c, i) => (
          <div key={i} className="px-3 py-2.5 flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-foreground mb-1">{c.label}</p>
              <div className="flex items-center gap-2 flex-wrap">
                {c.old_value
                  ? <span className="text-xs bg-red-50 text-red-700 border border-red-200 rounded px-2 py-0.5 font-mono">{c.old_value}</span>
                  : <span className="text-xs text-muted-foreground italic">empty</span>}
                <ArrowRight size={12} className="text-muted-foreground shrink-0" />
                {c.new_value
                  ? <span className="text-xs bg-green-50 text-green-700 border border-green-200 rounded px-2 py-0.5 font-mono">{c.new_value}</span>
                  : <span className="text-xs text-muted-foreground italic">empty</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Audit Event Row ──────────────────────────────────────────────────────────

function AuditEventRow({ entry, isNew }: { entry: AuditLogEntry; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActionStyle(entry.action);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;
  const isExpandable = hasChanges || !!entry.detail;

  return (
    <div className={`border-b border-border last:border-b-0 transition-all duration-500 ${isNew ? 'bg-primary/5' : ''}`}>
      <div
        className={`flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors ${isExpandable ? 'cursor-pointer' : ''}`}
        onClick={() => isExpandable && setExpanded(v => !v)}
      >
        {/* Type indicator */}
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
            <ShieldAlert size={13} className="text-muted-foreground" />
          </div>
          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              {isNew && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary flex items-center gap-1">
                  <Zap size={10} /> New
                </span>
              )}
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
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Clock size={10} />
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
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
            {entry.detail && !expanded && (
              <span className="text-xs text-muted-foreground truncate max-w-xs">{entry.detail}</span>
            )}
          </div>

          {isExpandable && !expanded && hasChanges && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                <Eye size={11} /> {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''} changed
                <ChevronRight size={11} />
              </span>
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2">
              {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
              {entry.reason && (
                <div className="flex items-start gap-1.5">
                  <MessageSquare size={11} className="text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 leading-snug">
                    <span className="font-semibold">Reason:</span> {entry.reason}
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

// ─── Alert Event Row ──────────────────────────────────────────────────────────

function AlertEventRow({ alert, isNew }: { alert: SmsAlert; isNew: boolean }) {
  const statusStyle = SMS_STATUS_STYLES[alert.status] ?? SMS_STATUS_STYLES.PENDING;

  return (
    <div className={`border-b border-border last:border-b-0 transition-all duration-500 ${isNew ? 'bg-sky-50/60' : ''}`}>
      <div className="flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-sky-50 flex items-center justify-center">
            <Bell size={13} className="text-sky-600" />
          </div>
          <div className={`w-2 h-2 rounded-full ${statusStyle.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${statusStyle.bg} ${statusStyle.text}`}>
                {alert.status}
              </span>
              {isNew && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 flex items-center gap-1">
                  <Zap size={10} /> New
                </span>
              )}
              <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {alert.alertType.replace(/_/g, ' ')}
              </span>
              {alert.collateralId && (
                <span className="text-xs font-mono text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded">
                  {alert.collateralId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{timeAgo(alert.createdAt)}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Clock size={10} />
                <span>{formatDateTime(alert.createdAt)}</span>
              </div>
            </div>
          </div>

          <p className="text-sm font-medium text-foreground mt-1.5 leading-snug line-clamp-2">{alert.message}</p>

          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            {alert.recipientName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <User size={11} className="shrink-0" />
                <span className="font-medium text-foreground/80">{alert.recipientName}</span>
              </div>
            )}
            <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
              <span>{alert.recipientPhone}</span>
            </div>
            {alert.errorMessage && (
              <span className="text-xs text-red-600 bg-red-50 border border-red-200 rounded px-2 py-0.5">
                {alert.errorMessage}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Status Change Row ────────────────────────────────────────────────────────

function StatusChangeRow({ entry, isNew }: { entry: AuditLogEntry; isNew: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const style = getActionStyle(entry.action);
  const hasChanges = Array.isArray(entry.fieldChanges) && entry.fieldChanges.length > 0;

  return (
    <div className={`border-b border-border last:border-b-0 transition-all duration-500 ${isNew ? 'bg-violet-50/60' : ''}`}>
      <div
        className={`flex items-start gap-4 px-5 py-4 hover:bg-muted/20 transition-colors ${hasChanges ? 'cursor-pointer' : ''}`}
        onClick={() => hasChanges && setExpanded(v => !v)}
      >
        <div className="flex flex-col items-center gap-1 pt-0.5 shrink-0">
          <div className="w-7 h-7 rounded-lg bg-violet-50 flex items-center justify-center">
            <GitBranch size={13} className="text-violet-600" />
          </div>
          <div className={`w-2 h-2 rounded-full ${style.dot}`} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${style.bg} ${style.text}`}>
                {style.label}
              </span>
              {isNew && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 flex items-center gap-1">
                  <Zap size={10} /> New
                </span>
              )}
              {entry.collateralId && (
                <span className="text-xs font-mono text-primary bg-primary/8 border border-primary/20 px-2 py-0.5 rounded">
                  {entry.collateralId}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs text-muted-foreground">{timeAgo(entry.createdAt)}</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                <Clock size={10} />
                <span>{formatDateTime(entry.createdAt)}</span>
              </div>
            </div>
          </div>

          <p className="text-sm font-medium text-foreground mt-1.5 leading-snug">{entry.message}</p>

          <div className="flex items-center gap-4 mt-1.5 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <User size={11} className="shrink-0" />
              <span className="font-medium text-foreground/80">{entry.performedByName || 'System'}</span>
            </div>
            {entry.detail && !expanded && (
              <span className="text-xs text-muted-foreground truncate max-w-xs">{entry.detail}</span>
            )}
          </div>

          {hasChanges && !expanded && (
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-xs text-primary font-medium flex items-center gap-0.5">
                <Eye size={11} /> {entry.fieldChanges!.length} field{entry.fieldChanges!.length !== 1 ? 's' : ''} changed
                <ChevronRight size={11} />
              </span>
            </div>
          )}

          {expanded && (
            <div className="mt-3 space-y-2">
              {entry.detail && <p className="text-xs text-muted-foreground">{entry.detail}</p>}
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

function KpiCard({ label, value, icon: Icon, colorClass, sub }: {
  label: string; value: number | string; icon: React.ElementType; colorClass: string; sub?: string;
}) {
  return (
    <div className="bg-white rounded-xl border border-border p-4 flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${colorClass}`}>
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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LiveActivityContent() {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [paused, setPaused] = useState(false);
  const [activeFilter, setActiveFilter] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(30);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [totalCounts, setTotalCounts] = useState({ audit: 0, alerts: 0, statusChanges: 0 });
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevIdsRef = useRef<Set<string>>(new Set());

  const fetchData = useCallback(async (isManual = false) => {
    if (paused && !isManual) return;
    if (isManual) setRefreshing(true);

    try {
      const [auditEntries, smsAlerts] = await Promise.all([
        auditLogService.getAll(undefined, 200),
        smsAlertService.fetchAlerts(100),
      ]);

      const auditEvents: StreamEvent[] = auditEntries.map(e => ({
        id: `audit-${e.id}`,
        type: (e.action === 'status_changed' || e.eventCategory === 'status_transition')
          ? 'status_change'as StreamEventType :'audit' as StreamEventType,
        timestamp: e.createdAt,
        auditEntry: e,
      }));

      const alertEvents: StreamEvent[] = smsAlerts.map(a => ({
        id: `alert-${a.id}`,
        type: 'alert' as StreamEventType,
        timestamp: a.createdAt,
        smsAlert: a,
      }));

      const combined = [...auditEvents, ...alertEvents].sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Detect new events
      const currentIds = new Set(combined.map(e => e.id));
      const newIds = new Set<string>();
      currentIds.forEach(id => {
        if (!prevIdsRef.current.has(id) && prevIdsRef.current.size > 0) {
          newIds.add(id);
        }
      });
      prevIdsRef.current = currentIds;

      if (newIds.size > 0) {
        setNewEventIds(newIds);
        setTimeout(() => setNewEventIds(new Set()), 8000);
      }

      setEvents(combined);
      setTotalCounts({
        audit: auditEvents.filter(e => e.type === 'audit').length,
        alerts: alertEvents.length,
        statusChanges: auditEvents.filter(e => e.type === 'status_change').length,
      });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to fetch live activity:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [paused]);

  // Initial load
  useEffect(() => {
    fetchData(true);
  }, []);

  // Auto-refresh interval
  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!paused) {
      intervalRef.current = setInterval(() => fetchData(), refreshInterval * 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [refreshInterval, paused, fetchData]);

  // Filtered events
  const filteredEvents = events.filter(ev => {
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'audit' && ev.type === 'audit') ||
      (activeFilter === 'alert' && ev.type === 'alert') ||
      (activeFilter === 'status_change' && ev.type === 'status_change');

    if (!matchesFilter) return false;

    if (search.trim()) {
      const s = search.toLowerCase();
      if (ev.auditEntry) {
        return (
          ev.auditEntry.message.toLowerCase().includes(s) ||
          (ev.auditEntry.collateralId ?? '').toLowerCase().includes(s) ||
          ev.auditEntry.performedByName.toLowerCase().includes(s) ||
          (ev.auditEntry.detail ?? '').toLowerCase().includes(s)
        );
      }
      if (ev.smsAlert) {
        return (
          ev.smsAlert.message.toLowerCase().includes(s) ||
          (ev.smsAlert.collateralId ?? '').toLowerCase().includes(s) ||
          (ev.smsAlert.recipientName ?? '').toLowerCase().includes(s) ||
          ev.smsAlert.recipientPhone.toLowerCase().includes(s)
        );
      }
    }
    return true;
  });

  const [clientTime, setClientTime] = React.useState<string>('');
  useEffect(() => {
    if (lastRefreshed) {
      setClientTime(lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
  }, [lastRefreshed]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Radio size={20} className="text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Live Activity Stream</h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                Real-time audit events, alerts, and collateral status changes
              </p>
            </div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Pause/Resume */}
            <button
              onClick={() => setPaused(v => !v)}
              className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border transition-colors ${
                paused
                  ? 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' :'bg-green-50 text-green-700 border-green-200 hover:bg-green-100'
              }`}
            >
              {paused ? <><Play size={13} /> Resume</> : <><Pause size={13} /> Pause</>}
            </button>

            {/* Refresh interval */}
            <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
              {REFRESH_INTERVALS.map(opt => (
                <button
                  key={opt.value}
                  onClick={() => setRefreshInterval(opt.value)}
                  className={`text-xs px-2.5 py-1 rounded-md font-medium transition-colors ${
                    refreshInterval === opt.value
                      ? 'bg-white text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Manual refresh */}
            <button
              onClick={() => fetchData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-border bg-white hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center gap-4 mt-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${paused ? 'bg-amber-400' : 'bg-green-500 animate-pulse'}`} />
            <span className="text-xs text-muted-foreground">
              {paused ? 'Paused' : `Auto-refreshing every ${refreshInterval}s`}
            </span>
          </div>
          {clientTime && (
            <span className="text-xs text-muted-foreground">
              Last updated: {clientTime}
            </span>
          )}
          <span className="text-xs text-muted-foreground">
            {filteredEvents.length} event{filteredEvents.length !== 1 ? 's' : ''} shown
          </span>
        </div>
      </div>

      {/* KPI Row */}
      <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-3 shrink-0">
        <KpiCard
          label="Total Events"
          value={events.length}
          icon={Activity}
          colorClass="bg-primary/10 text-primary"
          sub="All streams"
        />
        <KpiCard
          label="Audit Events"
          value={totalCounts.audit}
          icon={ShieldAlert}
          colorClass="bg-indigo-100 text-indigo-600"
          sub="Actions & changes"
        />
        <KpiCard
          label="Alerts Sent"
          value={totalCounts.alerts}
          icon={Bell}
          colorClass="bg-sky-100 text-sky-600"
          sub="SMS notifications"
        />
        <KpiCard
          label="Status Changes"
          value={totalCounts.statusChanges}
          icon={GitBranch}
          colorClass="bg-violet-100 text-violet-600"
          sub="Collateral transitions"
        />
      </div>

      {/* Filters + Search */}
      <div className="px-6 pb-3 flex items-center gap-3 flex-wrap shrink-0">
        {/* Filter pills */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {STREAM_FILTERS.map(f => {
            const FIcon = f.icon;
            return (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
                  activeFilter === f.key
                    ? 'bg-primary text-white border-primary' :'bg-white text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                }`}
              >
                <FIcon size={12} />
                {f.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-sm ml-auto">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search events…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-8 pr-8 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Stream Feed */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 min-h-0">
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {loading ? (
            <div className="p-6 space-y-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex gap-4 items-start">
                  <div className="w-7 h-7 rounded-lg bg-muted animate-pulse shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 bg-muted animate-pulse rounded w-3/4" />
                    <div className="h-2.5 bg-muted animate-pulse rounded w-1/2" />
                    <div className="h-2.5 bg-muted animate-pulse rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredEvents.length === 0 ? (
            <div className="py-16 flex flex-col items-center gap-3 text-center">
              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center">
                <Activity size={22} className="text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">No events found</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                {search ? 'Try adjusting your search query.' : 'No activity matches the selected filter.'}
              </p>
            </div>
          ) : (
            <div>
              {filteredEvents.map(ev => {
                const isNew = newEventIds.has(ev.id);
                if (ev.type === 'alert' && ev.smsAlert) {
                  return <AlertEventRow key={ev.id} alert={ev.smsAlert} isNew={isNew} />;
                }
                if (ev.type === 'status_change' && ev.auditEntry) {
                  return <StatusChangeRow key={ev.id} entry={ev.auditEntry} isNew={isNew} />;
                }
                if (ev.auditEntry) {
                  return <AuditEventRow key={ev.id} entry={ev.auditEntry} isNew={isNew} />;
                }
                return null;
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
