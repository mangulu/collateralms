'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, AlertCircle, CheckCircle2, XCircle, Clock,
  Package, X, ShieldAlert,
} from 'lucide-react';
import {
  archiveReconciliationService, ReconciliationItem, ReconciliationSession,
} from '@/lib/supabase/archiveReconciliationService';
import { useAuth } from '@/contexts/AuthContext';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Report Discrepancy Modal ─────────────────────────────────────────────────

interface DiscrepancyModalProps {
  item: ReconciliationItem;
  userId: string;
  onClose: () => void;
  onDone: () => void;
}

function DiscrepancyModal({ item, userId, onClose, onDone }: DiscrepancyModalProps) {
  const [missingIds, setMissingIds] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const toggle = (collateralId: string) => {
    setMissingIds((prev) => {
      const next = new Set(prev);
      if (next.has(collateralId)) next.delete(collateralId); else next.add(collateralId);
      return next;
    });
  };

  const handleSubmit = async () => {
    if (missingIds.size === 0 && !notes.trim()) {
      setError('Check which items are missing, or describe the discrepancy in the notes.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await archiveReconciliationService.reportDiscrepancy(item.id, userId, [...missingIds], notes.trim());
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to report discrepancy');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1E3A8A' }}>Report Discrepancy</h3>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{item.location?.name} · {item.location?.code}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} style={{ color: '#6B7280' }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-sm"><AlertCircle size={14} /> {error}</div>
          )}
          {item.expectedPlacements.length > 0 && (
            <div>
              <label className="block text-xs font-medium mb-2" style={{ color: '#374151' }}>Check any item(s) not physically found</label>
              <div className="border rounded-xl overflow-hidden" style={{ borderColor: '#E5E7EB' }}>
                {item.expectedPlacements.map((p) => (
                  <label key={p.id} className="flex items-center gap-3 px-3 py-2.5 border-b last:border-b-0 cursor-pointer hover:bg-gray-50" style={{ borderColor: '#F3F4F6' }}>
                    <input type="checkbox" checked={missingIds.has(p.collateralId)} onChange={() => toggle(p.collateralId)} className="w-4 h-4 accent-red-600" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1E3A8A' }}>{p.collateral?.description ?? p.collateral?.collateral_type ?? 'Unnamed'}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>{p.collateral?.obligor} {p.physicalRef ? `· ${p.physicalRef}` : ''}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
              placeholder="Describe what was found instead, or any other detail…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ borderColor: '#D1D5DB' }} />
          </div>
          {missingIds.size > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ backgroundColor: '#FFF1F2', border: '1px solid #FECDD3', color: '#9F1239' }}>
              <ShieldAlert size={14} className="shrink-0 mt-0.5" />
              <span>{missingIds.size} item{missingIds.size !== 1 ? 's' : ''} will be marked "Missing" in Custody and logged to the audit trail.</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 p-5 border-t" style={{ borderColor: '#E5E7EB' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#D1D5DB', color: '#374151' }}>Cancel</button>
          <button onClick={handleSubmit} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: '#DC2626', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Report Discrepancy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Item Card ─────────────────────────────────────────────────────────────

const RESULT_CONFIG = {
  pending: { label: 'Pending', bg: '#F3F4F6', text: '#6B7280', icon: Clock },
  confirmed: { label: 'Confirmed', bg: '#F0FDF4', text: '#15803D', icon: CheckCircle2 },
  discrepancy: { label: 'Discrepancy', bg: '#FFF1F2', text: '#BE123C', icon: XCircle },
};

function ItemCard({ item, canReview, onConfirm, onReportDiscrepancy, confirming }: {
  item: ReconciliationItem;
  canReview: boolean;
  onConfirm: () => void;
  onReportDiscrepancy: () => void;
  confirming: boolean;
}) {
  const rc = RESULT_CONFIG[item.result];
  const ResultIcon = rc.icon;

  return (
    <div className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFF', border: `1px solid ${item.result === 'discrepancy' ? '#FECDD3' : '#DBEAFE'}` }}>
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>{item.location?.name ?? 'Unknown slot'}</p>
            <span className="text-xs font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>{item.location?.code}</span>
            <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: rc.bg, color: rc.text }}>
              <ResultIcon size={11} /> {rc.label}
            </span>
          </div>
          <p className="text-xs mt-1" style={{ color: '#6B7280' }}>
            Expected {item.expectedCount} item{item.expectedCount !== 1 ? 's' : ''}
          </p>
          {item.expectedPlacements.length > 0 && (
            <ul className="mt-1.5 space-y-0.5">
              {item.expectedPlacements.map((p) => (
                <li key={p.id} className="text-xs flex items-center gap-1.5" style={{ color: '#374151' }}>
                  <Package size={10} style={{ color: '#9CA3AF' }} />
                  {p.collateral?.description ?? p.collateral?.collateral_type} — {p.collateral?.obligor}
                </li>
              ))}
            </ul>
          )}
          {item.discrepancyNotes && (
            <p className="text-xs mt-1.5 italic" style={{ color: '#BE123C' }}>"{item.discrepancyNotes}"</p>
          )}
        </div>
        {canReview && item.result === 'pending' && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={onConfirm} disabled={confirming}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-60"
              style={{ backgroundColor: '#15803D' }}>
              <CheckCircle2 size={12} /> All Present
            </button>
            <button onClick={onReportDiscrepancy}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#DC2626' }}>
              <XCircle size={12} /> Report Discrepancy
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReconciliationWalkthroughContent() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const router = useRouter();
  const { user, profile } = useAuth();

  const [session, setSession] = useState<ReconciliationSession | null>(null);
  const [items, setItems] = useState<ReconciliationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [discrepancyTarget, setDiscrepancyTarget] = useState<ReconciliationItem | null>(null);
  const [completing, setCompleting] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  const isReviewer = profile?.role === 'credit_officer' || profile?.role === 'legal_officer' || profile?.role === 'system_admin';

  const load = useCallback(async () => {
    if (!sessionId) return;
    setLoading(true);
    setError('');
    try {
      const [sess, sessionItems] = await Promise.all([
        archiveReconciliationService.getSession(sessionId),
        archiveReconciliationService.getSessionItems(sessionId),
      ]);
      setSession(sess);
      setItems(sessionItems);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation session');
    } finally { setLoading(false); }
  }, [sessionId]);

  useEffect(() => { load(); }, [load]);

  const handleConfirm = async (itemId: string) => {
    setConfirmingId(itemId);
    try {
      await archiveReconciliationService.confirmItem(itemId, user?.id ?? '');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to confirm slot');
    } finally { setConfirmingId(null); }
  };

  const handleComplete = async () => {
    if (!sessionId) return;
    setCompleting(true);
    setError('');
    try {
      await archiveReconciliationService.completeSession(sessionId, user?.id ?? '');
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to complete session');
    } finally { setCompleting(false); }
  };

  const handleCancel = async () => {
    if (!sessionId) return;
    try {
      await archiveReconciliationService.cancelSession(sessionId);
      setShowCancelConfirm(false);
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to cancel session');
    }
  };

  const reviewedCount = items.filter((it) => it.result !== 'pending').length;
  const pct = items.length > 0 ? Math.round((reviewedCount / items.length) * 100) : 0;
  const allReviewed = items.length > 0 && reviewedCount === items.length;
  const isActive = session?.status === 'in_progress';

  if (loading) {
    return <div className="p-6 space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}</div>;
  }

  if (!session) {
    return (
      <div className="p-6 text-center py-16">
        <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>Session not found</p>
        <button onClick={() => router.push('/archive/reconciliation')} className="mt-3 text-sm underline" style={{ color: '#2563EB' }}>Back to Reconciliation</button>
      </div>
    );
  }

  return (
    <div className="p-6">
      <button onClick={() => router.push('/archive/reconciliation')}
        className="flex items-center gap-1.5 text-sm font-medium mb-5 hover:underline" style={{ color: '#2563EB' }}>
        <ArrowLeft size={15} /> Back to Reconciliation
      </button>

      <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>
            Reconciling {session.location?.name ?? 'Vault'}
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
            Started by {session.startedByProfile?.full_name ?? '—'} · {formatDateTime(session.startedAt)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}><RefreshCw size={16} style={{ color: '#2563EB' }} /></button>
          {isActive && (
            <>
              {!showCancelConfirm ? (
                <button onClick={() => setShowCancelConfirm(true)}
                  className="px-3 py-2 rounded-xl text-sm font-medium border" style={{ borderColor: '#FECACA', color: '#DC2626' }}>
                  Cancel Session
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#DC2626' }}>Abandon this walk?</span>
                  <button onClick={() => setShowCancelConfirm(false)} className="px-2.5 py-1.5 rounded-lg text-xs font-medium border" style={{ borderColor: '#D1D5DB', color: '#374151' }}>No</button>
                  <button onClick={handleCancel} className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-white" style={{ backgroundColor: '#DC2626' }}>Yes, cancel</button>
                </div>
              )}
              <button onClick={handleComplete} disabled={!allReviewed || completing}
                title={!allReviewed ? 'Every slot must be reviewed first' : undefined}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ backgroundColor: '#15803D' }}>
                {completing ? 'Completing…' : 'Complete Session'}
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold" style={{ color: '#374151' }}>Progress</span>
          <span className="text-xs font-bold" style={{ color: '#1D4ED8' }}>{reviewedCount}/{items.length} slots reviewed ({pct}%)</span>
        </div>
        <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E5E7EB' }}>
          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: '#2563EB' }} />
        </div>
      </div>

      {!isReviewer && isActive && (
        <div className="flex items-center gap-2 mb-4 p-3 rounded-xl text-xs" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE', color: '#1D4ED8' }}>
          <ShieldAlert size={14} />
          <span>Only a Credit Officer, Legal Officer, or System Admin can review slots. You can still view this session's progress.</span>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm"><AlertCircle size={16} /> {error}</div>
      )}

      <div className="space-y-3">
        {items.map((item) => (
          <ItemCard
            key={item.id}
            item={item}
            canReview={isReviewer && isActive}
            confirming={confirmingId === item.id}
            onConfirm={() => handleConfirm(item.id)}
            onReportDiscrepancy={() => setDiscrepancyTarget(item)}
          />
        ))}
      </div>

      {discrepancyTarget && (
        <DiscrepancyModal
          item={discrepancyTarget}
          userId={user?.id ?? ''}
          onClose={() => setDiscrepancyTarget(null)}
          onDone={() => { setDiscrepancyTarget(null); load(); }}
        />
      )}
    </div>
  );
}
