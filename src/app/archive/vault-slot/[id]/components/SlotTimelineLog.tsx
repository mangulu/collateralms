'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  History, Download, RefreshCw, AlertCircle, MoveRight, FileText,
  ArrowRight, Clock, User, MapPin, Filter, X,
} from 'lucide-react';
import { archiveAuditService, ArchiveAuditEntry, ArchiveEventType } from '@/lib/supabase/archiveService';
import Icon from '@/components/ui/AppIcon';
import StatusBadge from '@/components/ui/StatusBadge';


const EVENT_CONFIG: Partial<Record<ArchiveEventType, { label: string; color: string; bg: string; icon: React.ElementType }>> = {
  collateral_moved:    { label: 'Moved',          color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)', icon: MoveRight },
  placement_assigned:  { label: 'Filed',           color: 'var(--izou-success)', bg: 'var(--izou-success-light)', icon: FileText },
  placement_removed:   { label: 'Removed',         color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)', icon: X },
  placement_updated:   { label: 'Updated',         color: 'var(--izou-secondary-mid)', bg: 'var(--izou-secondary-light)', icon: FileText },
  vault_created:       { label: 'Vault Created',   color: 'var(--izou-highlight)', bg: 'var(--izou-highlight-light)', icon: MapPin },
  vault_updated:       { label: 'Vault Updated',   color: 'var(--izou-highlight)', bg: 'var(--izou-highlight-light)', icon: MapPin },
  request_raised:      { label: 'Request Raised',  color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)', icon: FileText },
  request_approved:    { label: 'Approved',        color: 'var(--izou-success)', bg: 'var(--izou-success-light)', icon: FileText },
  request_rejected:    { label: 'Rejected',        color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)', icon: X },
  checked_out:         { label: 'Checked Out',     color: 'var(--izou-secondary)', bg: 'var(--izou-secondary-light)', icon: ArrowRight },
  returned:            { label: 'Returned',        color: 'var(--izou-secondary-mid)', bg: 'var(--izou-secondary-light)', icon: ArrowRight },
  overdue_flagged:     { label: 'Overdue',         color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)', icon: AlertCircle },
  disposal_flagged:    { label: 'Disposal Flagged',  color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)', icon: Clock },
  disposal_approved:   { label: 'Disposal Approved', color: 'var(--izou-warning)', bg: 'var(--izou-warning-light)', icon: FileText },
  disposed:            { label: 'Disposed',          color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)', icon: X },
  reconciliation_discrepancy: { label: 'Reconciliation Discrepancy', color: 'var(--izou-danger)', bg: 'var(--izou-danger-light)', icon: AlertCircle },
};

function getEventConfig(eventType: ArchiveEventType | null | undefined) {
  if (!eventType) return { label: 'Unknown', color: 'var(--izou-muted)', bg: 'var(--izou-bg)', icon: Clock };
  return EVENT_CONFIG[eventType] ?? { label: eventType.replace(/_/g, ' '), color: 'var(--izou-muted)', bg: 'var(--izou-bg)', icon: Clock };
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
    <div className="mt-8 rounded-2xl overflow-hidden" style={{ border: '1px solid var(--izou-border)' }}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4" style={{ backgroundColor: 'var(--izou-secondary-light)', borderBottom: '1px solid var(--izou-border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--izou-secondary-light)' }}>
            <History size={16} style={{ color: 'var(--izou-secondary)' }} />
          </div>
          <div>
            <h2 className="text-sm font-bold" style={{ color: 'var(--izou-secondary)' }}>Movement Timeline Log</h2>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>
              All collateral movements for this slot · {filtered.length} event{filtered.length !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors"
            style={{
              borderColor: showFilters ? 'var(--izou-secondary)' : 'var(--izou-border)',
              backgroundColor: showFilters ? 'var(--izou-secondary-light)' : 'white',
              color: 'var(--izou-secondary)',
            }}>
            <Filter size={12} /> Filter
          </button>
          <button
            onClick={load}
            className="p-1.5 rounded-lg border transition-colors hover:bg-blue-50"
            style={{ borderColor: 'var(--izou-border)' }}>
            <RefreshCw size={14} style={{ color: 'var(--izou-secondary)' }} />
          </button>
          <button
            onClick={exportCSV}
            disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--izou-secondary)' }}>
            <Download size={12} /> Export CSV
          </button>
        </div>
      </div>

      {/* Filter bar */}
      {showFilters && uniqueEventTypes.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap px-5 py-3" style={{ backgroundColor: 'var(--izou-bg)', borderBottom: '1px solid var(--izou-border)' }}>
          <button
            onClick={() => setFilterType('all')}
            className="px-2.5 py-1 rounded-full text-xs font-medium transition-all"
            style={filterType === 'all' ? { backgroundColor: 'var(--izou-secondary)', color: '#fff' } : { backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)' }}>
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
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-secondary-light)' }} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-10">
            <History size={32} className="mx-auto mb-2" style={{ color: 'var(--izou-secondary-light)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>No movement events recorded</p>
            <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>
              Events will appear here as collaterals are filed, moved, or removed
            </p>
          </div>
        ) : (
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[18px] top-0 bottom-0 w-px" style={{ backgroundColor: 'var(--izou-secondary-light)' }} />

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
                      style={{ backgroundColor: idx % 2 === 0 ? 'var(--izou-bg)' : 'white', border: '1px solid var(--izou-border)' }}>
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 flex-wrap">
                          <StatusBadge label={cfg.label} bg={cfg.bg} text={cfg.color} />
                          {entry.collateral && (
                            <span className="text-xs font-medium" style={{ color: 'var(--izou-secondary)' }}>
                              {entry.collateral.collateral_type} — {entry.collateral.description}
                            </span>
                          )}
                        </div>
                        <span className="flex items-center gap-1 text-xs shrink-0" style={{ color: 'var(--izou-muted)' }}>
                          <Clock size={11} /> {formatDate(entry.createdAt)}
                        </span>
                      </div>

                      <p className="text-xs mt-1.5" style={{ color: 'var(--izou-text)' }}>{entry.description}</p>

                      <div className="flex items-center gap-3 mt-2 flex-wrap">
                        {/* Source → Destination */}
                        {(entry.sourceLocationId || entry.destinationLocationId) && (
                          <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--izou-muted)' }}>
                            <MapPin size={11} />
                            {entry.sourceLocationId ? (
                              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--izou-warning-light)', color: 'var(--izou-warning)' }}>
                                {entry.location?.code ?? 'Source'}
                              </span>
                            ) : null}
                            {entry.sourceLocationId && entry.destinationLocationId && (
                              <ArrowRight size={10} style={{ color: 'var(--izou-muted)' }} />
                            )}
                            {entry.destinationLocationId && entry.destinationLocationId !== entry.sourceLocationId ? (
                              <span className="font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--izou-success-light)', color: 'var(--izou-success)' }}>
                                Dest
                              </span>
                            ) : null}
                          </div>
                        )}

                        {/* Actor */}
                        {(entry.performedByProfile?.full_name ?? entry.actorName) && (
                          <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--izou-muted)' }}>
                            <User size={11} />
                            {entry.performedByProfile?.full_name ?? entry.actorName}
                          </div>
                        )}

                        {/* Reason */}
                        {entry.reason && (
                          <span className="text-xs italic" style={{ color: 'var(--izou-muted)' }}>
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
