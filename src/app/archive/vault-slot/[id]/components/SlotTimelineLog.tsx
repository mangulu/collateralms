'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  History, Download, RefreshCw, AlertCircle, MoveRight, FileText,
  ArrowRight, Clock, User, MapPin, Filter, X,
} from 'lucide-react';
import { archiveAuditService, ArchiveAuditEntry, ArchiveEventType } from '@/lib/supabase/archiveService';
import Icon from '@/components/ui/AppIcon';


const EVENT_CONFIG: Partial<Record<ArchiveEventType, { label: string; color: string; bg: string; icon: React.ElementType }>> = {
  collateral_moved:    { label: 'Moved',          color: '#D97706', bg: '#FFFBEB', icon: MoveRight },
  placement_assigned:  { label: 'Filed',           color: '#15803D', bg: '#F0FDF4', icon: FileText },
  placement_removed:   { label: 'Removed',         color: '#DC2626', bg: '#FEF2F2', icon: X },
  placement_updated:   { label: 'Updated',         color: '#0369A1', bg: '#F0F9FF', icon: FileText },
  vault_created:       { label: 'Vault Created',   color: '#7C3AED', bg: '#F5F3FF', icon: MapPin },
  vault_updated:       { label: 'Vault Updated',   color: '#7C3AED', bg: '#F5F3FF', icon: MapPin },
  request_raised:      { label: 'Request Raised',  color: '#B45309', bg: '#FFFBEB', icon: FileText },
  request_approved:    { label: 'Approved',        color: '#15803D', bg: '#F0FDF4', icon: FileText },
  request_rejected:    { label: 'Rejected',        color: '#DC2626', bg: '#FEF2F2', icon: X },
  checked_out:         { label: 'Checked Out',     color: '#1D4ED8', bg: '#EFF6FF', icon: ArrowRight },
  returned:            { label: 'Returned',        color: '#0369A1', bg: '#F0F9FF', icon: ArrowRight },
  overdue_flagged:     { label: 'Overdue',         color: '#DC2626', bg: '#FEF2F2', icon: AlertCircle },
};

function getEventConfig(eventType: ArchiveEventType) {
  return EVENT_CONFIG[eventType] ?? { label: eventType.replace(/_/g, ' '), color: '#6B7280', bg: '#F9FAFB', icon: Clock };
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface SlotTimelineLogProps {
  slotId: string;
  slotCode?: string;
}

export default function SlotTimelineLog({ slotId, slotCode }: SlotTimelineLogProps) {
  const [entries, setEntries] = useState<ArchiveAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filterType, setFilterType] = useState<ArchiveEventType | 'all'>('all');
  const [showFilters, setShowFilters] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await archiveAuditService.getByLocation(slotId, 200);
      setEntries(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load timeline');
    } finally { setLoading(false); }
  }, [slotId]);

  useEffect(() => { load(); }, [load]);

  // Real-time subscription
  useEffect(() => {
    const channel = archiveAuditService.subscribeToChanges(() => { load(); });
    return () => { channel.unsubscribe(); };
  }, [load]);

  const filtered = filterType === 'all' ? entries : entries.filter((e) => e.eventType === filterType);

  const exportCSV = () => {
    const rows = [
      ['Timestamp', 'Event', 'Collateral', 'Source Slot', 'Destination Slot', 'Actor', 'Reason', 'Description'],
      ...filtered.map((e) => [
        formatDate(e.createdAt),
        getEventConfig(e.eventType).label,
        e.collateral ? `${e.collateral.collateral_type} — ${e.collateral.description}` : '—',
        e.sourceLocationId ? (e.location?.code ?? e.sourceLocationId) : '—',
        e.destinationLocationId ? e.destinationLocationId : '—',
        e.performedByProfile?.full_name ?? e.actorName ?? '—',
        e.reason ?? '—',
        e.description,
      ]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `slot-${slotCode ?? slotId}-timeline-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const uniqueEventTypes = [...new Set(entries.map((e) => e.eventType))];

  return (
    <div className="mt-8 rounded-2xl overflow-hidden" style={{ border: '1px solid #DBEAFE' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: '#F0F9FF', borderBottom: '1px solid #DBEAFE' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#DBEAFE' }}>
            <History size={16} style={{ color: '#1D4ED8' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: '#1E3A8A' }}>Movement Timeline Log</h2>
            <p className="text-xs" style={{ color: '#3B82F6' }}>
              All collateral movements for this slot · {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: showFilters ? '#93C5FD' : '#DBEAFE',
              backgroundColor: showFilters ? '#EFF6FF' : 'white',
              color: '#1D4ED8',
            }}>
            <Filter size={12} /> Filter
          </button>
          <button
            onClick={load}
            className="p-1.5 rounded-lg border transition-colors hover:bg-blue-50"
            style={{ borderColor: '#DBEAFE' }}>
            <RefreshCw size={14} style={{ color: '#2563EB' }} />
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: '#2563EB' }}>
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && uniqueEventTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-5 py-3" style={{ backgroundColor: '#F8FAFF', borderBottom: '1px solid #DBEAFE' }}>
          <button
            onClick={() => setFilterType('all')}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={filterType === 'all' ? { backgroundColor: '#2563EB', color: '#fff' } : { backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            All
          </button>
          {uniqueEventTypes.map((et) => {
            const cfg = getEventConfig(et);
            return (
              <button
                key={et}
                onClick={() => setFilterType(filterType === et ? 'all' : et)}
                className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
                style={filterType === et
                  ? { backgroundColor: cfg.color, color: '#fff' }
                  : { backgroundColor: cfg.bg, color: cfg.color }}>
                {cfg.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Content */}
      <div className="p-5" style={{ backgroundColor: 'white' }}>
        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <History size={32} className="mx-auto mb-2" style={{ color: '#BAE6FD' }} />
            <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No movement events recorded</p>
            <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
              Events will appear here as collaterals are filed, moved, or removed
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px" style={{ backgroundColor: '#DBEAFE' }} />

            <div className="space-y-4">
              {filtered.map((entry, idx) => {
                const cfg = getEventConfig(entry.eventType);
                const Icon = cfg.icon;
                return (
                  <div key={entry.id} className="flex gap-4 relative">
                    {/* Timeline dot */}
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10 border-2"
                      style={{ backgroundColor: cfg.bg, borderColor: cfg.color }}>
                      <Icon size={14} style={{ color: cfg.color }} />
                    </div>

                    {/* Content */}
                    <div
                      className="flex-1 rounded-xl p-3.5 min-w-0"
                      style={{ backgroundColor: idx % 2 === 0 ? '#F8FAFF' : 'white', border: '1px solid #DBEAFE' }}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span
                            className="text-xs font-semibold px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: cfg.bg, color: cfg.color }}>
                            {cfg.label}
                          </span>
                          {entry.collateral && (
                            <span className="text-xs font-medium" style={{ color: '#1E3A8A' }}>
                              {entry.collateral.collateral_type} — {entry.collateral.description}
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: '#9CA3AF' }}>
                          <Clock size={11} /> {formatDate(entry.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs mt-1.5" style={{ color: '#374151' }}>{entry.description}</p>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Source → Destination */}
                        {(entry.sourceLocationId || entry.destinationLocationId) && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: '#6B7280' }}>
                            <MapPin size={11} />
                            {entry.sourceLocationId ? (
                              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#FEF3C7', color: '#92400E' }}>
                                {entry.location?.code ?? 'Source'}
                              </span>
                            ) : null}
                            {entry.sourceLocationId && entry.destinationLocationId && (
                              <ArrowRight size={10} style={{ color: '#9CA3AF' }} />
                            )}
                            {entry.destinationLocationId && entry.destinationLocationId !== entry.sourceLocationId ? (
                              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#DCFCE7', color: '#166534' }}>
                                Dest
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* Actor */}
                        {(entry.performedByProfile?.full_name ?? entry.actorName) && (
                          <div className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                            <User size={11} />
                            {entry.performedByProfile?.full_name ?? entry.actorName}
                          </div>
                        )}

                        {/* Reason */}
                        {entry.reason && (
                          <span className="text-xs italic" style={{ color: '#9CA3AF' }}>
                            Reason: {entry.reason}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
