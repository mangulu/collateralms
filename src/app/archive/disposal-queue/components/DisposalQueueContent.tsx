'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Trash2, RefreshCw, AlertCircle, Search, Clock, Package, ShieldAlert } from 'lucide-react';
import { archivePlacementService, archiveAuditService, ArchivePlacement } from '@/lib/supabase/archiveService';
import { useAuth } from '@/contexts/AuthContext';
import StatCard from '@/components/ui/StatCard';

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)));
}

// ─── Approve Disposal Modal ─────────────────────────────────────────────────

interface DisposalModalProps {
  placement: ArchivePlacement;
  userId: string;
  onClose: () => void;
  onDone: () => void;
}

function DisposalModal({ placement, userId, onClose, onDone }: DisposalModalProps) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleApprove = async () => {
    if (!reason.trim()) { setError('A disposal reason is required.'); return; }
    setSaving(true);
    setError('');
    try {
      await archivePlacementService.approveDisposal(placement.id, userId, reason.trim());
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to approve disposal');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--izou-secondary)' }}>Approve Disposal</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--izou-muted)' }}>
          {placement.collateral?.collateral_type} — {placement.collateral?.obligor}
        </p>
        <div className="flex items-start gap-2 mb-4 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--izou-warning-light)', border: '1px solid var(--izou-warning-light)', color: 'var(--izou-warning)' }}>
          <ShieldAlert size={14} className="shrink-0 mt-0.5" />
          <span>This permanently marks the physical document as destroyed. The filing record and its audit trail are kept for compliance history.</span>
        </div>
        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Disposal Reason *</label>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: 'var(--izou-border)' }} placeholder="e.g. Retention period elapsed per policy, collateral fully released…" />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--izou-border)', color: 'var(--izou-text)' }}>Cancel</button>
          <button onClick={handleApprove} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--izou-danger)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Disposing…' : 'Approve Disposal'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DisposalQueueContent() {
  const { user, profile } = useAuth();
  const [queue, setQueue] = useState<ArchivePlacement[]>([]);
  const [disposedThisMonth, setDisposedThisMonth] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [disposeTarget, setDisposeTarget] = useState<ArchivePlacement | null>(null);

  const canDispose = profile?.role === 'legal_officer' || profile?.role === 'system_admin';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await archivePlacementService.flagDisposalEligible();
      const eligible = await archivePlacementService.getDisposalQueue();
      setQueue(eligible);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load disposal queue');
    } finally { setLoading(false); }
    // "Disposed this month" is a secondary KPI — don't let it block the primary queue.
    try {
      const auditEntries = await archiveAuditService.getAll(500);
      const now = new Date();
      setDisposedThisMonth(auditEntries.filter((e) => {
        const d = new Date(e.createdAt);
        return e.eventType === 'disposed' && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
      }).length);
    } catch {
      setDisposedThisMonth(0);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = queue.filter((p) => {
    const q = search.toLowerCase();
    return !q
      || p.collateral?.obligor?.toLowerCase().includes(q)
      || p.collateral?.collateral_type?.toLowerCase().includes(q)
      || p.location?.name?.toLowerCase().includes(q)
      || p.physicalRef?.toLowerCase().includes(q);
  });

  const oldestEligibleDays = queue.length > 0
    ? Math.max(...queue.map((p) => daysSince(p.retentionEligibleAt ?? new Date().toISOString())))
    : 0;

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--izou-primary)', fontFamily: 'DM Sans, sans-serif' }}>
            Disposal Queue
          </h1>
        </div>
        <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: 'var(--izou-border)' }}>
          <RefreshCw size={16} style={{ color: 'var(--izou-secondary)' }} />
        </button>
      </div>

      {!canDispose && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)', color: 'var(--izou-secondary)' }}>
          <ShieldAlert size={14} />
          <span>Only a Legal Officer or System Admin can approve disposal. You can still view the queue below.</span>
        </div>
      )}

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <StatCard label="Eligible Now" value={queue.length} color="var(--izou-warning)" labelColor="var(--izou-warning)" bg="var(--izou-warning-light)" border="var(--izou-warning-light)" />
        <StatCard label="Disposed This Month" value={disposedThisMonth} color="var(--izou-danger)" labelColor="var(--izou-danger)" bg="var(--izou-danger-light)" border="var(--izou-danger-light)" />
        <StatCard label="Oldest Eligible" value={`${oldestEligibleDays}d`} color="var(--izou-secondary)" />
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--izou-muted)' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ borderColor: 'var(--izou-border)', backgroundColor: 'var(--izou-bg)' }}
          placeholder="Search by collateral, obligor, slot, physical ref…" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Queue list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-secondary-light)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-secondary-light)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>Nothing eligible for disposal</p>
          <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>
            {queue.length === 0 ? 'Documents appear here once their retention period elapses after collateral release.' : 'Try adjusting your search.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl"
              style={{ backgroundColor: 'var(--izou-warning-light)', border: '1px solid var(--izou-warning-light)' }}>
              <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-warning-light)' }}>
                <Clock size={18} style={{ color: 'var(--izou-warning)' }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold" style={{ color: 'var(--izou-secondary)' }}>
                  {p.collateral?.collateral_type ?? 'Unknown'} — {p.collateral?.obligor ?? '—'}
                </p>
                <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                  <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--izou-muted)' }}>
                    <Package size={11} /> {p.location?.name ?? '—'} ({p.location?.code ?? '—'})
                  </span>
                  {p.physicalRef && (
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: 'var(--izou-warning-light)', color: 'var(--izou-warning)' }}>
                      {p.physicalRef}
                    </span>
                  )}
                  <span className="text-xs font-medium" style={{ color: 'var(--izou-warning)' }}>
                    Eligible since {formatDate(p.retentionEligibleAt ?? p.placedAt)} ({daysSince(p.retentionEligibleAt ?? p.placedAt)}d)
                  </span>
                </div>
              </div>
              {canDispose && (
                <button onClick={() => setDisposeTarget(p)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white shrink-0"
                  style={{ backgroundColor: 'var(--izou-danger)' }}>
                  <Trash2 size={12} /> Approve Disposal
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {disposeTarget && (
        <DisposalModal
          placement={disposeTarget}
          userId={user?.id ?? ''}
          onClose={() => setDisposeTarget(null)}
          onDone={() => { setDisposeTarget(null); load(); }}
        />
      )}
    </div>
  );
}
