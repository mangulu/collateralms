'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText, RefreshCw, AlertCircle, Search, Filter,
} from 'lucide-react';
import { archiveAuditService, ArchiveAuditEntry, ArchiveEventType } from '@/lib/supabase/archiveService';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';

const EVENT_CONFIG: Record<ArchiveEventType, { label: string; color: string; bg: string }> = {
  vault_created:       { label: 'Vault Created',       color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)' },
  vault_updated:       { label: 'Vault Updated',       color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)' },
  placement_assigned:  { label: 'Placement Assigned',  color: 'var(--izou-success)', bg: 'var(--izou-success-light)' },
  placement_updated:   { label: 'Placement Updated',   color: 'var(--izou-success)', bg: 'var(--izou-success-light)' },
  placement_removed:   { label: 'Placement Removed',   color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
  collateral_moved:    { label: 'Collateral Moved',    color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)' },
  custody_handoff:     { label: 'Custody Handoff',     color: 'var(--izou-highlight)', bg: 'var(--izou-highlight-light)' },
  custody_received:    { label: 'Custody Received',    color: 'var(--izou-highlight)', bg: 'var(--izou-highlight-light)' },
  officer_assigned:    { label: 'Officer Assigned',    color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)' },
  request_raised:      { label: 'Request Raised',      color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)' },
  request_approved:    { label: 'Request Approved',    color: 'var(--izou-success)', bg: 'var(--izou-success-light)' },
  request_rejected:    { label: 'Request Rejected',    color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
  checked_out:         { label: 'Checked Out',         color: 'var(--izou-highlight)', bg: 'var(--izou-highlight-light)' },
  returned:            { label: 'Returned',            color: 'var(--izou-secondary-mid)', bg: 'var(--izou-secondary-light)' },
  overdue_flagged:     { label: 'Overdue Flagged',     color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
  sms_sent:            { label: 'SMS Sent',            color: 'var(--izou-secondary-mid)', bg: 'var(--izou-secondary-light)' },
  document_added:      { label: 'Document Added',      color: 'var(--izou-success)', bg: 'var(--izou-success-light)' },
  document_removed:    { label: 'Document Removed',    color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
  disposal_flagged:    { label: 'Disposal Flagged',    color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)' },
  disposal_approved:   { label: 'Disposal Approved',   color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)' },
  disposed:            { label: 'Disposed',            color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
  reconciliation_started:      { label: 'Reconciliation Started',    color: 'var(--izou-secondary-mid)', bg: 'var(--izou-secondary-light)' },
  reconciliation_completed:    { label: 'Reconciliation Completed',  color: 'var(--izou-success)', bg: 'var(--izou-success-light)' },
  reconciliation_discrepancy:  { label: 'Reconciliation Discrepancy', color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)' },
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function ArchiveAuditLogContent() {
  const [entries, setEntries] = useState<ArchiveAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState<ArchiveEventType | 'all'>('all');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await archiveAuditService.getAll(200);
      setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter((e) => {
    const q = search.toLowerCase();
    const matchSearch = !q || e.description.toLowerCase().includes(q) || e.performedByProfile?.full_name?.toLowerCase().includes(q) || e.collateral?.description?.toLowerCase().includes(q);
    const matchEvent = eventFilter === 'all' || e.eventType === eventFilter;
    return matchSearch && matchEvent;
  });

  const uniqueEvents = Array.from(new Set(entries.map((e) => e.eventType)));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--izou-primary)', fontFamily: 'DM Sans, sans-serif' }}>Archive Audit Log</h1>
        </div>
        <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: 'var(--izou-border)' }}>
          <RefreshCw size={16} style={{ color: 'var(--izou-secondary)' }} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Events', value: entries.length, color: 'var(--izou-secondary)' },
          { label: 'Check-outs', value: entries.filter((e) => e.eventType === 'checked_out' || e.eventType === 'request_approved').length, color: 'var(--izou-highlight)' },
          { label: 'Returns', value: entries.filter((e) => e.eventType === 'returned').length, color: 'var(--izou-secondary-mid)' },
          { label: 'SMS Sent', value: entries.filter((e) => e.eventType === 'sms_sent').length, color: 'var(--izou-warning)' },
        ].map((s) => (
          <StatCard key={s.label} label={s.label} value={s.value} color={s.color} />
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--izou-muted)' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: 'var(--izou-border)', backgroundColor: 'var(--izou-secondary-light)' }}
            placeholder="Search events…" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--izou-muted)' }} />
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value as ArchiveEventType | 'all')}
            className="pl-8 pr-8 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
            style={{ borderColor: 'var(--izou-border)', backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-muted)' }}>
            <option value="all">All Events</option>
            {uniqueEvents.map((ev) => (
              <option key={ev} value={ev}>{EVENT_CONFIG[ev]?.label ?? ev}</option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-skeleton)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ScrollText size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-secondary-light)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>No audit entries found</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((entry) => {
            const ec = EVENT_CONFIG[entry.eventType] ?? { label: entry.eventType, color: 'var(--izou-muted)', bg: 'var(--izou-bg)' };
            return (
              <div key={entry.id} className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)' }}>
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ec.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <StatusBadge label={ec.label} bg={ec.bg} text={ec.color} />
                    {entry.collateral && (
                      <span className="text-xs font-medium" style={{ color: 'var(--izou-secondary)' }}>
                        {entry.collateral.collateral_type}
                      </span>
                    )}
                    {entry.location && (
                      <span className="text-xs font-mono" style={{ color: 'var(--izou-muted)' }}>
                        @ {entry.location.code}
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: 'var(--izou-text)' }}>{entry.description}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>
                      {entry.performedByProfile?.full_name ?? 'System'}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>
                      {formatDateTime(entry.createdAt)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
