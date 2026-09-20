'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  ClipboardCheck, Plus, RefreshCw, AlertCircle, Search, X,
  CheckCircle2, XCircle, Clock, ChevronRight, Building2, DoorOpen, BookOpen,
} from 'lucide-react';
import {
  archiveReconciliationService, ReconciliationSession, ReconciliationSessionStatus,
} from '@/lib/supabase/archiveReconciliationService';
import { archiveLocationService, ArchiveLocation, LocationType } from '@/lib/supabase/archiveService';
import { useAuth } from '@/contexts/AuthContext';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const LEVEL_ICONS: Record<LocationType, React.ReactNode> = {
  vault: <Building2 size={13} />, room: <DoorOpen size={13} />, cabinet: <BookOpen size={13} />, slot: <BookOpen size={13} />,
};

// ─── Start Session Modal ──────────────────────────────────────────────────────

interface StartSessionModalProps {
  userId: string;
  onClose: () => void;
  onStarted: (sessionId: string) => void;
}

function StartSessionModal({ userId, onClose, onStarted }: StartSessionModalProps) {
  const [options, setOptions] = useState<{ location: ArchiveLocation; path: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    archiveLocationService.getTreeWithCounts().then((tree) => {
      const flat: { location: ArchiveLocation; path: string }[] = [];
      const walk = (nodes: ArchiveLocation[], parentPath: string) => {
        nodes.forEach((n) => {
          if (n.locationType !== 'slot') {
            const path = parentPath ? `${parentPath} › ${n.name}` : n.name;
            flat.push({ location: n, path });
            walk(n.children ?? [], path);
          }
        });
      };
      walk(tree, '');
      setOptions(flat);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const filtered = options.filter((o) => {
    const q = search.toLowerCase();
    return !q || o.location.name.toLowerCase().includes(q) || o.location.code.toLowerCase().includes(q) || o.path.toLowerCase().includes(q);
  });

  const handleStart = async () => {
    if (!selectedId) { setError('Select a vault, room, or cabinet to reconcile.'); return; }
    setStarting(true);
    setError('');
    try {
      const session = await archiveReconciliationService.startSession(selectedId, userId);
      onStarted(session.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start session');
      setStarting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: 'var(--izou-border)' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--izou-secondary)' }}>Start Reconciliation Session</h3>
            <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>Pick the vault, room, or cabinet you're about to walk</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X size={16} style={{ color: 'var(--izou-muted)' }} /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-sm"><AlertCircle size={14} /> {error}</div>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--izou-muted)' }} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search vaults, rooms, cabinets…"
              className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" style={{ borderColor: 'var(--izou-border)' }} />
          </div>
          <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto" style={{ borderColor: 'var(--izou-border)' }}>
            {loading ? (
              <div className="h-24 animate-pulse" style={{ backgroundColor: 'var(--izou-secondary-light)' }} />
            ) : filtered.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: 'var(--izou-muted)' }}>No matching locations</p>
            ) : (
              filtered.map(({ location, path }) => {
                const isSelected = selectedId === location.id;
                return (
                  <button key={location.id} onClick={() => setSelectedId(location.id)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-b-0 transition-colors"
                    style={{ borderColor: 'var(--izou-border)', backgroundColor: isSelected ? 'var(--izou-secondary-light)' : 'white' }}>
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: isSelected ? 'var(--izou-secondary-light)' : 'var(--izou-secondary-light)', border: '1px solid var(--izou-secondary-light)', color: 'var(--izou-secondary)' }}>
                      {LEVEL_ICONS[location.locationType]}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--izou-secondary)' }}>{path}</p>
                      <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{location.code} · {location.currentOccupancy} slot{location.currentOccupancy !== 1 ? 's' : ''} filed within</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
        <div className="flex gap-2 p-5 border-t" style={{ borderColor: 'var(--izou-border)' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--izou-border)', color: 'var(--izou-text)' }}>Cancel</button>
          <button onClick={handleStart} disabled={starting || !selectedId}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white" style={{ backgroundColor: 'var(--izou-secondary)', opacity: starting || !selectedId ? 0.5 : 1 }}>
            {starting ? 'Starting…' : 'Start Session'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Session Row ──────────────────────────────────────────────────────────────

function SessionRow({ session, onClick }: { session: ReconciliationSession; onClick: () => void }) {
  const pct = session.totalItems > 0 ? Math.round((session.reviewedItems / session.totalItems) * 100) : 0;
  const statusCfg: Record<ReconciliationSessionStatus, { label: string; bg: string; text: string; icon: React.ElementType }> = {
    in_progress: { label: 'In Progress', bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary)', icon: Clock },
    completed: { label: 'Completed', bg: 'var(--izou-success-light)', text: 'var(--izou-success)', icon: CheckCircle2 },
    cancelled: { label: 'Cancelled', bg: 'var(--izou-bg)', text: 'var(--izou-muted)', icon: XCircle },
  };
  const sc = statusCfg[session.status];
  const StatusIcon = sc.icon;

  return (
    <button onClick={onClick} className="w-full flex items-center gap-4 p-4 rounded-xl text-left transition-all hover:shadow-sm"
      style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)' }}>
      <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sc.bg }}>
        <StatusIcon size={18} style={{ color: sc.text }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold" style={{ color: 'var(--izou-secondary)' }}>{session.location?.name ?? 'Unknown location'}</p>
          <StatusBadge label={sc.label} bg={sc.bg} text={sc.text} />
        </div>
        <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>
          Started by {session.startedByProfile?.full_name ?? '—'} · {formatDateTime(session.startedAt)}
        </p>
        {session.totalItems > 0 && (
          <div className="flex items-center gap-2 mt-1.5">
            <div className="w-32 h-1.5 rounded-full" style={{ backgroundColor: 'var(--izou-border)' }}>
              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: session.status === 'completed' ? 'var(--izou-success)' : 'var(--izou-secondary)' }} />
            </div>
            <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>{session.reviewedItems}/{session.totalItems} slots reviewed</span>
          </div>
        )}
      </div>
      <ChevronRight size={16} style={{ color: 'var(--izou-muted)' }} className="shrink-0" />
    </button>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReconciliationSessionsContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [active, setActive] = useState<ReconciliationSession[]>([]);
  const [history, setHistory] = useState<ReconciliationSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showStartModal, setShowStartModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [activeSessions, allSessions] = await Promise.all([
        archiveReconciliationService.getActiveSessions(),
        archiveReconciliationService.getSessionHistory(),
      ]);
      setActive(activeSessions);
      setHistory(allSessions.filter((s) => s.status !== 'in_progress'));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load reconciliation sessions');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const completedThisMonth = history.filter((s) => {
    if (s.status !== 'completed' || !s.completedAt) return false;
    const d = new Date(s.completedAt);
    const now = new Date();
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  }).length;

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--izou-primary)', fontFamily: 'DM Sans, sans-serif' }}>Vault Reconciliation</h1>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: 'var(--izou-border)' }}><RefreshCw size={16} style={{ color: 'var(--izou-secondary)' }} /></button>
          <button onClick={() => setShowStartModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--izou-secondary)' }}>
            <Plus size={16} /> Start New Session
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
        <StatCard label="Active Sessions" value={active.length} color="var(--izou-secondary)" bg="var(--izou-secondary-light)" border="var(--izou-secondary-light)" />
        <StatCard label="Completed This Month" value={completedThisMonth} color="var(--izou-success)" bg="var(--izou-success-light)" border="var(--izou-success-light)" />
        <StatCard label="Total Sessions" value={active.length + history.length} color="var(--izou-secondary)" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm"><AlertCircle size={16} /> {error}</div>
      )}

      {loading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-secondary-light)' }} />)}</div>
      ) : (
        <div className="space-y-6">
          {active.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--izou-muted)' }}>Active Sessions</p>
              <div className="space-y-2">
                {active.map((s) => <SessionRow key={s.id} session={s} onClick={() => router.push(`/archive/reconciliation/${s.id}`)} />)}
              </div>
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: 'var(--izou-muted)' }}>History</p>
            {history.length === 0 ? (
              <div className="text-center py-16">
                <ClipboardCheck size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-secondary-light)' }} />
                <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>No reconciliation sessions yet</p>
                <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Start a session to begin verifying physical vault contents</p>
              </div>
            ) : (
              <div className="space-y-2">
                {history.map((s) => <SessionRow key={s.id} session={s} onClick={() => router.push(`/archive/reconciliation/${s.id}`)} />)}
              </div>
            )}
          </div>
        </div>
      )}

      {showStartModal && (
        <StartSessionModal
          userId={user?.id ?? ''}
          onClose={() => setShowStartModal(false)}
          onStarted={(sessionId) => router.push(`/archive/reconciliation/${sessionId}`)}
        />
      )}
    </div>
  );
}
