'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ScrollText, RefreshCw, AlertCircle, Search, Filter,
} from 'lucide-react';
import { archiveAuditService, ArchiveAuditEntry, ArchiveEventType } from '@/lib/supabase/archiveService';

const EVENT_CONFIG: Record<ArchiveEventType, { label: string; color: string; bg: string }> = {
  vault_created:       { label: 'Vault Created',       color: '#1D4ED8', bg: '#EFF6FF' },
  vault_updated:       { label: 'Vault Updated',       color: '#1D4ED8', bg: '#EFF6FF' },
  placement_assigned:  { label: 'Placement Assigned',  color: '#15803D', bg: '#F0FDF4' },
  placement_updated:   { label: 'Placement Updated',   color: '#15803D', bg: '#F0FDF4' },
  request_raised:      { label: 'Request Raised',      color: '#B45309', bg: '#FFFBEB' },
  request_approved:    { label: 'Request Approved',    color: '#15803D', bg: '#F0FDF4' },
  request_rejected:    { label: 'Request Rejected',    color: '#BE123C', bg: '#FFF1F2' },
  checked_out:         { label: 'Checked Out',         color: '#7E22CE', bg: '#FDF4FF' },
  returned:            { label: 'Returned',            color: '#0369A1', bg: '#F0F9FF' },
  overdue_flagged:     { label: 'Overdue Flagged',     color: '#BE123C', bg: '#FFF1F2' },
  sms_sent:            { label: 'SMS Sent',            color: '#0369A1', bg: '#F0F9FF' },
  document_added:      { label: 'Document Added',      color: '#15803D', bg: '#F0FDF4' },
  document_removed:    { label: 'Document Removed',    color: '#BE123C', bg: '#FFF1F2' },
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
    <div className="p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>Archive Audit Log</h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>Every vault movement timestamped and attributed</p>
        </div>
        <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}>
          <RefreshCw size={16} style={{ color: '#2563EB' }} />
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Events', value: entries.length, color: '#1D4ED8' },
          { label: 'Check-outs', value: entries.filter((e) => e.eventType === 'checked_out' || e.eventType === 'request_approved').length, color: '#7E22CE' },
          { label: 'Returns', value: entries.filter((e) => e.eventType === 'returned').length, color: '#0369A1' },
          { label: 'SMS Sent', value: entries.filter((e) => e.eventType === 'sms_sent').length, color: '#B45309' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
            placeholder="Search events…" />
        </div>
        <div className="relative">
          <Filter size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value as ArchiveEventType | 'all')}
            className="pl-8 pr-8 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 appearance-none"
            style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF', color: '#374151' }}>
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
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ScrollText size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
          <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No audit entries found</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((entry) => {
            const ec = EVENT_CONFIG[entry.eventType] ?? { label: entry.eventType, color: '#6B7280', bg: '#F9FAFB' };
            return (
              <div key={entry.id} className="flex items-start gap-3 p-3.5 rounded-xl"
                style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
                <div className="w-2 h-2 rounded-full mt-1.5 shrink-0" style={{ backgroundColor: ec.color }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: ec.bg, color: ec.color }}>
                      {ec.label}
                    </span>
                    {entry.collateral && (
                      <span className="text-xs font-medium" style={{ color: '#1E3A8A' }}>
                        {entry.collateral.collateral_type}
                      </span>
                    )}
                    {entry.location && (
                      <span className="text-xs font-mono" style={{ color: '#6B7280' }}>
                        @ {entry.location.code}
                      </span>
                    )}
                  </div>
                  <p className="text-sm mt-0.5" style={{ color: '#374151' }}>{entry.description}</p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>
                      {entry.performedByProfile?.full_name ?? 'System'}
                    </span>
                    <span className="text-xs" style={{ color: '#9CA3AF' }}>
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
