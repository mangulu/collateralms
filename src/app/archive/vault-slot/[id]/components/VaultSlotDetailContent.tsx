'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  ArrowLeft, RefreshCw, FileText, Trash2, MoveRight, AlertCircle,
  Package, Search, ChevronRight, FolderOpen, Building2, DoorOpen, BookOpen, Grid3X3, X, Check,
  CheckSquare, Square, CheckCheck, Loader2,
} from 'lucide-react';
import {
  archiveLocationService,
  archivePlacementService,
  ArchiveLocation,
  ArchivePlacement,
  LocationType,
} from '@/lib/supabase/archiveService';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/lib/supabase/client';
import SlotTimelineLog from './SlotTimelineLog';

// ─── Types & Helpers ──────────────────────────────────────────────────────────

const LOCATION_TYPE_COLORS: Record<LocationType, { bg: string; text: string; border: string }> = {
  vault:   { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  room:    { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  cabinet: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  shelf:   { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  slot:    { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
};

const LEVEL_EMOJIS: Record<LocationType, string> = {
  vault: '🏛️', room: '🚪', cabinet: '📚', shelf: '📚', slot: '📂',
};

const LEVEL_ICONS: Record<LocationType, React.ReactNode> = {
  vault:   <Building2 size={14} />,
  room:    <DoorOpen size={14} />,
  cabinet: <BookOpen size={14} />,
  shelf:   <BookOpen size={14} />,
  slot:    <Grid3X3 size={14} />,
};

function buildBreadcrumb(slotId: string, allLocations: ArchiveLocation[]): ArchiveLocation[] {
  const map = new Map(allLocations.map((l) => [l.id, l]));
  const path: ArchiveLocation[] = [];
  let current = map.get(slotId);
  while (current) {
    path.unshift(current);
    current = current.parentId ? map.get(current.parentId) : undefined;
  }
  return path;
}

// ─── Move to Slot Modal (single) ──────────────────────────────────────────────

interface MoveToSlotModalProps {
  placement: ArchivePlacement;
  currentSlotId: string;
  allLocations: ArchiveLocation[];
  onClose: () => void;
  onMoved: () => void;
  userId: string;
}

function MoveToSlotModal({ placement, currentSlotId, allLocations, onClose, onMoved, userId }: MoveToSlotModalProps) {
  const [search, setSearch] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [moving, setMoving] = useState(false);
  const [error, setError] = useState('');

  const slots = allLocations.filter(
    (l) => l.locationType === 'slot' && l.id !== currentSlotId,
  );

  const filtered = slots.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q)
    );
  });

  const handleMove = async () => {
    if (!selectedSlotId) { setError('Please select a destination slot.'); return; }
    setMoving(true);
    setError('');
    try {
      await archivePlacementService.upsert({
        collateralId: placement.collateralId,
        locationId: selectedSlotId,
        physicalRef: placement.physicalRef ?? undefined,
        notes: placement.notes ?? undefined,
        placedBy: userId,
      });
      onMoved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Move failed');
    } finally { setMoving(false); }
  };

  const selectedSlot = allLocations.find((l) => l.id === selectedSlotId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <MoveRight size={18} style={{ color: '#0369A1' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1E3A8A' }}>Move to Another Slot</h3>
              <p className="text-xs mt-0.5 truncate max-w-[220px]" style={{ color: '#6B7280' }}>
                {placement.collateral?.description ?? 'Collateral'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search slots by name or code…"
              className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
          <div className="border rounded-xl overflow-hidden max-h-64 overflow-y-auto" style={{ borderColor: '#E5E7EB' }}>
            {filtered.length === 0 ? (
              <p className="text-xs text-center py-8" style={{ color: '#9CA3AF' }}>
                {search ? 'No matching slots found' : 'No other slots available'}
              </p>
            ) : (
              filtered.map((slot) => {
                const isSelected = selectedSlotId === slot.id;
                const isFull = slot.currentOccupancy >= slot.capacity;
                return (
                  <button
                    key={slot.id}
                    onClick={() => !isFull && setSelectedSlotId(slot.id)}
                    disabled={isFull}
                    className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-b-0 transition-colors"
                    style={{
                      borderColor: '#F3F4F6',
                      backgroundColor: isSelected ? '#EFF6FF' : isFull ? '#F9FAFB' : 'white',
                      opacity: isFull ? 0.5 : 1,
                      cursor: isFull ? 'not-allowed' : 'pointer',
                    }}
                  >
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                      style={{ backgroundColor: isSelected ? '#DBEAFE' : '#F0F9FF', border: '1px solid #BAE6FD' }}>
                      📂
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: '#1E3A8A' }}>{slot.name}</p>
                      <p className="text-xs" style={{ color: '#6B7280' }}>
                        {slot.code} · {slot.currentOccupancy}/{slot.capacity} items
                        {isFull && <span className="ml-1 text-red-500 font-medium">· Full</span>}
                      </p>
                    </div>
                    {isSelected && <Check size={14} style={{ color: '#2563EB' }} className="shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
          {selectedSlot && (
            <div className="p-3 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <p className="text-xs font-semibold mb-1" style={{ color: '#1D4ED8' }}>Moving to:</p>
              <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>{selectedSlot.name}</p>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                {selectedSlot.code} · {selectedSlot.currentOccupancy}/{selectedSlot.capacity} items
              </p>
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t" style={{ borderColor: '#E5E7EB' }}>
          <button onClick={onClose}
            className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleMove}
            disabled={moving || !selectedSlotId}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: '#2563EB', opacity: moving || !selectedSlotId ? 0.5 : 1 }}>
            {moving ? 'Moving…' : 'Move Here'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Bulk Move Modal ──────────────────────────────────────────────────────────

interface BulkMoveModalProps {
  selectedPlacements: ArchivePlacement[];
  currentSlotId: string;
  allLocations: ArchiveLocation[];
  onClose: () => void;
  onDone: () => void;
  userId: string;
}

function BulkMoveModal({ selectedPlacements, currentSlotId, allLocations, onClose, onDone, userId }: BulkMoveModalProps) {
  const [search, setSearch] = useState('');
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [error, setError] = useState('');

  const slots = allLocations.filter(
    (l) => l.locationType === 'slot' && l.id !== currentSlotId,
  );

  const filtered = slots.filter((s) => {
    const q = search.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      s.code.toLowerCase().includes(q) ||
      (s.description ?? '').toLowerCase().includes(q)
    );
  });

  const handleBulkMove = async () => {
    if (!selectedSlotId) { setError('Please select a destination slot.'); return; }
    setError('');
    setProgress({ done: 0, total: selectedPlacements.length });
    let done = 0;
    for (const p of selectedPlacements) {
      try {
        await archivePlacementService.upsert({
          collateralId: p.collateralId,
          locationId: selectedSlotId,
          physicalRef: p.physicalRef ?? undefined,
          notes: p.notes ?? undefined,
          placedBy: userId,
        });
      } catch {
        // continue on individual failure
      }
      done++;
      setProgress({ done, total: selectedPlacements.length });
    }
    onDone();
  };

  const selectedSlot = allLocations.find((l) => l.id === selectedSlotId);
  const isMoving = progress !== null && progress.done < progress.total;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={!isMoving ? onClose : undefined}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <MoveRight size={18} style={{ color: '#0369A1' }} />
            </div>
            <div>
              <h3 className="text-base font-bold" style={{ color: '#1E3A8A' }}>Bulk Move to Another Slot</h3>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                {selectedPlacements.length} collateral{selectedPlacements.length !== 1 ? 's' : ''} selected
              </p>
            </div>
          </div>
          {!isMoving && (
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={16} style={{ color: '#6B7280' }} />
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}

          {/* Progress */}
          {progress && (
            <div className="p-3 rounded-xl" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD' }}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold" style={{ color: '#0369A1' }}>
                  {progress.done < progress.total ? 'Moving…' : 'Done!'}
                </span>
                <span className="text-xs" style={{ color: '#6B7280' }}>{progress.done}/{progress.total}</span>
              </div>
              <div className="w-full h-2 rounded-full" style={{ backgroundColor: '#E5E7EB' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%`, backgroundColor: '#2563EB' }}
                />
              </div>
            </div>
          )}

          {!progress && (
            <>
              {/* Selected items preview */}
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: '#1D4ED8' }}>Selected collaterals:</p>
                <div className="space-y-1 max-h-28 overflow-y-auto">
                  {selectedPlacements.map((p) => (
                    <div key={p.id} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: '#2563EB' }} />
                      <span className="text-xs truncate" style={{ color: '#374151' }}>
                        {p.collateral?.description ?? 'Unnamed'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search destination slots…"
                  className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                  style={{ borderColor: '#D1D5DB' }}
                />
              </div>

              <div className="border rounded-xl overflow-hidden max-h-52 overflow-y-auto" style={{ borderColor: '#E5E7EB' }}>
                {filtered.length === 0 ? (
                  <p className="text-xs text-center py-8" style={{ color: '#9CA3AF' }}>
                    {search ? 'No matching slots found' : 'No other slots available'}
                  </p>
                ) : (
                  filtered.map((slot) => {
                    const isSelected = selectedSlotId === slot.id;
                    const isFull = slot.currentOccupancy >= slot.capacity;
                    return (
                      <button
                        key={slot.id}
                        onClick={() => !isFull && setSelectedSlotId(slot.id)}
                        disabled={isFull}
                        className="w-full flex items-center gap-3 px-3 py-2.5 text-left border-b last:border-b-0 transition-colors"
                        style={{
                          borderColor: '#F3F4F6',
                          backgroundColor: isSelected ? '#EFF6FF' : isFull ? '#F9FAFB' : 'white',
                          opacity: isFull ? 0.5 : 1,
                          cursor: isFull ? 'not-allowed' : 'pointer',
                        }}
                      >
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center text-sm shrink-0"
                          style={{ backgroundColor: isSelected ? '#DBEAFE' : '#F0F9FF', border: '1px solid #BAE6FD' }}>
                          📂
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate" style={{ color: '#1E3A8A' }}>{slot.name}</p>
                          <p className="text-xs" style={{ color: '#6B7280' }}>
                            {slot.code} · {slot.currentOccupancy}/{slot.capacity} items
                            {isFull && <span className="ml-1 text-red-500 font-medium">· Full</span>}
                          </p>
                        </div>
                        {isSelected && <Check size={14} style={{ color: '#2563EB' }} className="shrink-0" />}
                      </button>
                    );
                  })
                )}
              </div>

              {selectedSlot && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                  <p className="text-xs font-semibold mb-1" style={{ color: '#1D4ED8' }}>Moving all to:</p>
                  <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>{selectedSlot.name}</p>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    {selectedSlot.code} · {selectedSlot.currentOccupancy}/{selectedSlot.capacity} items
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t" style={{ borderColor: '#E5E7EB' }}>
          {!isMoving && (
            <button onClick={onClose}
              className="flex-1 py-2 rounded-lg text-sm font-medium border"
              style={{ borderColor: '#D1D5DB', color: '#374151' }}>
              Cancel
            </button>
          )}
          <button
            onClick={handleBulkMove}
            disabled={isMoving || !selectedSlotId || !!progress}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity flex items-center justify-center gap-2"
            style={{ backgroundColor: '#2563EB', opacity: (isMoving || !selectedSlotId || !!progress) ? 0.5 : 1 }}>
            {isMoving ? <><Loader2 size={14} className="animate-spin" /> Moving…</> : 'Move All'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Collateral Detail Drawer ─────────────────────────────────────────────────

interface CollateralDetailDrawerProps {
  placement: ArchivePlacement;
  onClose: () => void;
}

function CollateralDetailDrawer({ placement, onClose }: CollateralDetailDrawerProps) {
  const router = useRouter();
  const c = placement.collateral;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white shadow-2xl h-full flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10"
          style={{ borderColor: '#E5E7EB' }}>
          <h3 className="text-base font-bold" style={{ color: '#1E3A8A' }}>Collateral Detail</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
              <FileText size={22} style={{ color: '#2563EB' }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-snug" style={{ color: '#1E3A8A' }}>
                {c?.description ?? 'Unnamed Collateral'}
              </p>
              <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{c?.collateral_type ?? '—'}</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Obligor', value: c?.obligor ?? '—' },
              { label: 'Physical Ref', value: placement.physicalRef ?? '—', mono: true },
              { label: 'Filed On', value: new Date(placement.placedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) },
              { label: 'Filed By', value: placement.placedByProfile?.full_name ?? '—' },
              { label: 'Notes', value: placement.notes ?? '—' },
            ].map(({ label, value, mono }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-xs font-medium" style={{ color: '#9CA3AF' }}>{label}</span>
                <span className={`text-sm ${mono ? 'font-mono' : 'font-medium'}`} style={{ color: '#1E3A8A' }}>
                  {value}
                </span>
              </div>
            ))}
          </div>

          {c?.id && (
            <button
              onClick={() => router.push(`/collateral-detail/${c.id}`)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium border transition-colors hover:bg-blue-50"
              style={{ borderColor: '#BFDBFE', color: '#2563EB' }}>
              <FolderOpen size={15} />
              View Full Collateral Record
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function VaultSlotDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [slot, setSlot] = useState<ArchiveLocation | null>(null);
  const [allLocations, setAllLocations] = useState<ArchiveLocation[]>([]);
  const [placements, setPlacements] = useState<ArchivePlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  // Single-item actions
  const [moveTarget, setMoveTarget] = useState<ArchivePlacement | null>(null);
  const [detailTarget, setDetailTarget] = useState<ArchivePlacement | null>(null);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkMove, setShowBulkMove] = useState(false);
  const [bulkRemoving, setBulkRemoving] = useState(false);
  const [bulkReceiving, setBulkReceiving] = useState(false);
  const [confirmBulkRemove, setConfirmBulkRemove] = useState(false);
  const [bulkActionResult, setBulkActionResult] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const [allLocs, slotPlacements] = await Promise.all([
        archiveLocationService.getAll(),
        archivePlacementService.getByLocation(id),
      ]);
      setAllLocations(allLocs);
      const found = allLocs.find((l) => l.id === id) ?? null;
      setSlot(found);
      setPlacements(slotPlacements);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load slot data');
    } finally { setLoading(false); }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  // Real-time sync for placements in this slot
  useEffect(() => {
    const channel = archivePlacementService.subscribeToChanges(() => { load(); });
    return () => { channel.unsubscribe(); };
  }, [load]);

  // Clear selection when placements reload
  useEffect(() => { setSelectedIds(new Set()); }, [placements]);

  const handleRemove = async (placement: ArchivePlacement) => {
    setRemovingId(placement.id);
    try {
      await archivePlacementService.remove(placement.collateralId);
      setConfirmRemoveId(null);
      await load();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Remove failed');
    } finally { setRemovingId(null); }
  };

  const breadcrumb = slot ? buildBreadcrumb(slot.id, allLocations) : [];

  const filtered = placements.filter((p) => {
    const q = search.toLowerCase();
    return (
      (p.collateral?.description ?? '').toLowerCase().includes(q) ||
      (p.collateral?.obligor ?? '').toLowerCase().includes(q) ||
      (p.collateral?.collateral_type ?? '').toLowerCase().includes(q) ||
      (p.physicalRef ?? '').toLowerCase().includes(q)
    );
  });

  const occupancyPct = slot && slot.capacity > 0
    ? Math.round((slot.currentOccupancy / slot.capacity) * 100)
    : 0;

  const occupancyColor = occupancyPct >= 90 ? '#DC2626' : occupancyPct >= 70 ? '#D97706' : '#16A34A';

  // ── Selection helpers ──────────────────────────────────────────────────────
  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someSelected = selectedIds.size > 0;

  const toggleSelectAll = () => {
    if (allFilteredSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((p) => p.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const selectedPlacements = filtered.filter((p) => selectedIds.has(p.id));

  // ── Bulk Remove ────────────────────────────────────────────────────────────
  const handleBulkRemove = async () => {
    setBulkRemoving(true);
    setBulkActionResult(null);
    let removed = 0;
    for (const p of selectedPlacements) {
      try {
        await archivePlacementService.remove(p.collateralId);
        removed++;
      } catch { /* continue */ }
    }
    setBulkRemoving(false);
    setConfirmBulkRemove(false);
    setBulkActionResult({ type: 'success', message: `${removed} collateral${removed !== 1 ? 's' : ''} removed from slot.` });
    await load();
  };

  // ── Bulk Mark as Received ──────────────────────────────────────────────────
  const handleBulkMarkReceived = async () => {
    setBulkReceiving(true);
    setBulkActionResult(null);
    let updated = 0;
    for (const p of selectedPlacements) {
      try {
        await supabase
          .from('archive_custody')
          .upsert(
            { collateral_id: p.collateralId, current_status: 'returned', last_returned_at: new Date().toISOString() },
            { onConflict: 'collateral_id' }
          );
        updated++;
      } catch { /* continue */ }
    }
    setBulkReceiving(false);
    setBulkActionResult({ type: 'success', message: `${updated} collateral${updated !== 1 ? 's' : ''} marked as received.` });
    setSelectedIds(new Set());
  };

  return (
    <div className="p-6">
      {/* Back button */}
      <button
        onClick={() => router.push('/archive/vault-management')}
        className="flex items-center gap-1.5 text-sm font-medium mb-5 hover:underline"
        style={{ color: '#2563EB' }}>
        <ArrowLeft size={15} /> Back to Vault Management
      </button>

      {/* Breadcrumb */}
      {breadcrumb.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mb-4">
          {breadcrumb.map((loc, i) => {
            const colors = LOCATION_TYPE_COLORS[loc.locationType];
            const isLast = i === breadcrumb.length - 1;
            return (
              <React.Fragment key={loc.id}>
                <div
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${!isLast ? 'cursor-pointer hover:opacity-80' : ''}`}
                  style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
                  onClick={!isLast ? () => router.push('/archive/vault-management') : undefined}
                >
                  <span>{LEVEL_EMOJIS[loc.locationType]}</span>
                  <span>{loc.name}</span>
                  <span className="opacity-60 font-mono text-[10px]">{loc.code}</span>
                </div>
                {!isLast && <ChevronRight size={13} style={{ color: '#9CA3AF' }} />}
              </React.Fragment>
            );
          })}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center text-3xl shrink-0"
            style={{ backgroundColor: '#F0F9FF', border: '2px solid #BAE6FD' }}>
            📂
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>
              {slot?.name ?? 'Vault Slot'}
            </h1>
            <p className="text-sm mt-0.5" style={{ color: '#6B7280' }}>
              {slot?.code} {slot?.description ? `· ${slot.description}` : ''}
            </p>
          </div>
        </div>
        <button onClick={load}
          className="p-2 rounded-lg border transition-colors hover:bg-blue-50 shrink-0"
          style={{ borderColor: '#BFDBFE' }}>
          <RefreshCw size={16} style={{ color: '#2563EB' }} />
        </button>
      </div>

      {/* Slot stats */}
      {slot && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          {[
            { label: 'Total Capacity', value: slot.capacity, icon: '📦', color: '#1D4ED8' },
            { label: 'Current Items', value: slot.currentOccupancy, icon: '📄', color: '#15803D' },
            { label: 'Available Space', value: Math.max(0, slot.capacity - slot.currentOccupancy), icon: '🔓', color: '#0369A1' },
            { label: 'Occupancy', value: `${occupancyPct}%`, icon: '📊', color: occupancyColor },
          ].map((stat) => (
            <div key={stat.label} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-base">{stat.icon}</span>
                <span className="text-xs font-medium" style={{ color: '#6B7280' }}>{stat.label}</span>
              </div>
              <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Occupancy bar */}
      {slot && (
        <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold" style={{ color: '#374151' }}>Slot Occupancy</span>
            <span className="text-xs font-bold" style={{ color: occupancyColor }}>{occupancyPct}%</span>
          </div>
          <div className="w-full h-2.5 rounded-full" style={{ backgroundColor: '#E5E7EB' }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.min(occupancyPct, 100)}%`, backgroundColor: occupancyColor }}
            />
          </div>
          <p className="text-xs mt-1.5" style={{ color: '#9CA3AF' }}>
            {slot.currentOccupancy} of {slot.capacity} items filed in this slot
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Bulk action result banner */}
      {bulkActionResult && (
        <div
          className="flex items-center justify-between gap-2 p-3 rounded-xl mb-4 text-sm"
          style={{
            backgroundColor: bulkActionResult.type === 'success' ? '#F0FDF4' : '#FEF2F2',
            border: `1px solid ${bulkActionResult.type === 'success' ? '#BBF7D0' : '#FECACA'}`,
            color: bulkActionResult.type === 'success' ? '#15803D' : '#DC2626',
          }}>
          <div className="flex items-center gap-2">
            <CheckCheck size={15} />
            {bulkActionResult.message}
          </div>
          <button onClick={() => setBulkActionResult(null)} className="p-0.5 rounded hover:opacity-70">
            <X size={13} />
          </button>
        </div>
      )}

      {/* Search + count + select-all toolbar */}
      {!loading && placements.length > 0 && (
        <div className="space-y-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by description, obligor, type, ref…"
                className="w-full border rounded-xl pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: '#D1D5DB' }}
              />
            </div>
            <span className="text-xs font-medium px-2.5 py-1.5 rounded-lg shrink-0"
              style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}>
              {filtered.length} item{filtered.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Select-all row */}
          {filtered.length > 0 && (
            <div className="flex items-center gap-3 px-1">
              <button
                onClick={toggleSelectAll}
                className="flex items-center gap-2 text-xs font-medium transition-colors hover:opacity-80"
                style={{ color: allFilteredSelected ? '#2563EB' : '#6B7280' }}>
                {allFilteredSelected
                  ? <CheckSquare size={16} style={{ color: '#2563EB' }} />
                  : <Square size={16} style={{ color: '#9CA3AF' }} />}
                {allFilteredSelected ? 'Deselect all' : `Select all (${filtered.length})`}
              </button>
              {someSelected && (
                <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                  {selectedIds.size} selected
                </span>
              )}
            </div>
          )}
        </div>
      )}

      {/* Bulk action toolbar */}
      {someSelected && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl mb-4"
          style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
          <span className="text-xs font-semibold mr-1" style={{ color: '#1D4ED8' }}>
            {selectedIds.size} selected:
          </span>

          {/* Bulk Move */}
          <button
            onClick={() => setShowBulkMove(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#2563EB' }}>
            <MoveRight size={13} /> Move to Slot
          </button>

          {/* Bulk Mark as Received */}
          <button
            onClick={handleBulkMarkReceived}
            disabled={bulkReceiving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-60"
            style={{ backgroundColor: '#15803D' }}>
            {bulkReceiving
              ? <><Loader2 size={13} className="animate-spin" /> Marking…</>
              : <><CheckCheck size={13} /> Mark as Received</>}
          </button>

          {/* Bulk Remove */}
          {!confirmBulkRemove ? (
            <button
              onClick={() => setConfirmBulkRemove(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#DC2626' }}>
              <Trash2 size={13} /> Remove
            </button>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium" style={{ color: '#DC2626' }}>
                Remove {selectedIds.size} item{selectedIds.size !== 1 ? 's' : ''}?
              </span>
              <button
                onClick={() => setConfirmBulkRemove(false)}
                className="px-2.5 py-1 rounded-lg text-xs font-medium border"
                style={{ borderColor: '#D1D5DB', color: '#374151' }}>
                Cancel
              </button>
              <button
                onClick={handleBulkRemove}
                disabled={bulkRemoving}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-white disabled:opacity-60"
                style={{ backgroundColor: '#DC2626' }}>
                {bulkRemoving ? <><Loader2 size={12} className="animate-spin" /> Removing…</> : 'Confirm Remove'}
              </button>
            </div>
          )}

          {/* Clear selection */}
          <button
            onClick={() => { setSelectedIds(new Set()); setConfirmBulkRemove(false); }}
            className="ml-auto flex items-center gap-1 text-xs font-medium hover:opacity-70"
            style={{ color: '#6B7280' }}>
            <X size={13} /> Clear
          </button>
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />
          ))}
        </div>
      ) : placements.length === 0 ? (
        <div className="text-center py-16">
          <Package size={40} className="mx-auto mb-3" style={{ color: '#BAE6FD' }} />
          <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>This slot is empty</p>
          <p className="text-xs mt-1 mb-4" style={{ color: '#6B7280' }}>
            File collaterals into this slot from the Collateral Filing screen
          </p>
          <button
            onClick={() => router.push('/archive/collateral-placement')}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: '#2563EB' }}>
            Go to Collateral Filing
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-10">
          <Search size={32} className="mx-auto mb-2" style={{ color: '#BAE6FD' }} />
          <p className="text-sm" style={{ color: '#6B7280' }}>No items match your search</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const isSelected = selectedIds.has(p.id);
            return (
              <div
                key={p.id}
                className="rounded-xl overflow-hidden transition-all"
                style={{
                  border: `1px solid ${isSelected ? '#93C5FD' : '#DBEAFE'}`,
                  backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFF',
                }}
              >
                {/* Main row */}
                <div className="flex items-start gap-3 p-4">
                  {/* Checkbox */}
                  <button
                    onClick={() => toggleOne(p.id)}
                    className="mt-1 shrink-0 transition-colors"
                    title={isSelected ? 'Deselect' : 'Select'}
                  >
                    {isSelected
                      ? <CheckSquare size={18} style={{ color: '#2563EB' }} />
                      : <Square size={18} style={{ color: '#CBD5E1' }} />}
                  </button>

                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
                    onClick={() => setDetailTarget(p)}
                    title="View detail"
                  >
                    <FileText size={18} style={{ color: '#2563EB' }} />
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <button
                      className="text-sm font-bold text-left hover:underline leading-snug"
                      style={{ color: '#1E3A8A' }}
                      onClick={() => setDetailTarget(p)}
                    >
                      {p.collateral?.description ?? 'Unnamed Collateral'}
                    </button>
                    <div className="flex items-center gap-2 flex-wrap mt-1">
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                        {p.collateral?.collateral_type ?? '—'}
                      </span>
                      <span className="text-xs" style={{ color: '#6B7280' }}>
                        {p.collateral?.obligor ?? '—'}
                      </span>
                      {p.physicalRef && (
                        <span className="text-xs font-mono px-2 py-0.5 rounded"
                          style={{ backgroundColor: '#F3F4F6', color: '#6B7280' }}>
                          {p.physicalRef}
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-1" style={{ color: '#9CA3AF' }}>
                      Filed {new Date(p.placedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      {p.placedByProfile?.full_name ? ` · ${p.placedByProfile.full_name}` : ''}
                    </p>
                    {p.notes && (
                      <p className="text-xs mt-1 italic" style={{ color: '#9CA3AF' }}>{p.notes}</p>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => setDetailTarget(p)}
                      className="p-2 rounded-lg transition-colors hover:bg-blue-100"
                      title="View detail"
                      style={{ color: '#2563EB' }}>
                      <FolderOpen size={15} />
                    </button>
                    <button
                      onClick={() => setMoveTarget(p)}
                      className="p-2 rounded-lg transition-colors hover:bg-amber-100"
                      title="Move to another slot"
                      style={{ color: '#D97706' }}>
                      <MoveRight size={15} />
                    </button>
                    <button
                      onClick={() => setConfirmRemoveId(p.id)}
                      className="p-2 rounded-lg transition-colors hover:bg-red-100"
                      title="Remove from slot"
                      style={{ color: '#DC2626' }}>
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>

                {/* Inline remove confirmation */}
                {confirmRemoveId === p.id && (
                  <div className="flex items-center justify-between px-4 py-3 border-t"
                    style={{ borderColor: '#FEE2E2', backgroundColor: '#FFF5F5' }}>
                    <p className="text-xs font-medium" style={{ color: '#DC2626' }}>
                      Remove this collateral from the slot?
                    </p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setConfirmRemoveId(null)}
                        className="px-3 py-1 rounded-lg text-xs font-medium border"
                        style={{ borderColor: '#D1D5DB', color: '#374151' }}>
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRemove(p)}
                        disabled={removingId === p.id}
                        className="px-3 py-1 rounded-lg text-xs font-medium text-white"
                        style={{ backgroundColor: '#DC2626', opacity: removingId === p.id ? 0.6 : 1 }}>
                        {removingId === p.id ? 'Removing…' : 'Remove'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Single Move Modal */}
      {moveTarget && (
        <MoveToSlotModal
          placement={moveTarget}
          currentSlotId={id}
          allLocations={allLocations}
          userId={user?.id ?? ''}
          onClose={() => setMoveTarget(null)}
          onMoved={() => { setMoveTarget(null); load(); }}
        />
      )}

      {/* Bulk Move Modal */}
      {showBulkMove && (
        <BulkMoveModal
          selectedPlacements={selectedPlacements}
          currentSlotId={id}
          allLocations={allLocations}
          userId={user?.id ?? ''}
          onClose={() => setShowBulkMove(false)}
          onDone={() => {
            setShowBulkMove(false);
            setBulkActionResult({ type: 'success', message: `${selectedPlacements.length} collateral${selectedPlacements.length !== 1 ? 's' : ''} moved successfully.` });
            load();
          }}
        />
      )}

      {/* Detail Drawer */}
      {detailTarget && (
        <CollateralDetailDrawer
          placement={detailTarget}
          onClose={() => setDetailTarget(null)}
        />
      )}

      {/* Timeline Log — bottom of slot detail */}
      {slot && (
        <SlotTimelineLog slotId={slot.id} slotCode={slot.code} />
      )}
    </div>
  );
}
