'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, ChevronRight, ChevronDown, Trash2, RefreshCw, AlertCircle, CheckCircle, Package, Layers, Archive, FileText, X, Search, FolderOpen } from 'lucide-react';
import { archiveLocationService, archivePlacementService, ArchiveLocation, ArchivePlacement, LocationType } from '@/lib/supabase/archiveService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';

const LOCATION_TYPE_ORDER: LocationType[] = ['vault', 'room', 'cabinet', 'shelf', 'slot'];
const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  vault: 'Vault', room: 'Room', cabinet: 'Cabinet', shelf: 'Shelf', slot: 'Filing Slot',
};
const LOCATION_TYPE_COLORS: Record<LocationType, { bg: string; text: string; border: string }> = {
  vault:   { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  room:    { bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  cabinet: { bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA' },
  shelf:   { bg: '#FDF4FF', text: '#7E22CE', border: '#E9D5FF' },
  slot:    { bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
};

interface AddLocationModalProps {
  parentId: string | null;
  parentType: LocationType | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}

function AddLocationModal({ parentId, parentType, onClose, onSaved, userId }: AddLocationModalProps) {
  const nextType = parentType
    ? LOCATION_TYPE_ORDER[LOCATION_TYPE_ORDER.indexOf(parentType) + 1] ?? 'slot' :'vault';
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [description, setDescription] = useState('');
  const [capacity, setCapacity] = useState(100);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) { setError('Name and code are required.'); return; }
    setSaving(true);
    try {
      await archiveLocationService.create({
        name: name.trim(), code: code.trim(), locationType: nextType,
        parentId, description: description.trim() || undefined, capacity, createdBy: userId,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold mb-4" style={{ color: '#1E3A8A' }}>
          Add {LOCATION_TYPE_LABELS[nextType]}
        </h3>
        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }} placeholder={`e.g. ${LOCATION_TYPE_LABELS[nextType]} 1`} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Code *</label>
            <input value={code} onChange={(e) => setCode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }} placeholder="e.g. VLT-001" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Capacity</label>
            <input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }} min={1} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#D1D5DB', color: '#374151' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: '#2563EB', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Slot Contents Panel ──────────────────────────────────────────────────────

interface SlotContentsPanelProps {
  slot: ArchiveLocation;
  userId: string;
  onClose: () => void;
  onRefreshTree: () => void;
}

function SlotContentsPanel({ slot, userId, onClose, onRefreshTree }: SlotContentsPanelProps) {
  const [placements, setPlacements] = useState<ArchivePlacement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  const loadPlacements = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await archivePlacementService.getByLocation(slot.id);
      setPlacements(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load contents');
    } finally {
      setLoading(false);
    }
  }, [slot.id]);

  useEffect(() => { loadPlacements(); }, [loadPlacements]);

  const colors = LOCATION_TYPE_COLORS['slot'];

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center bg-black/40" onClick={onClose}>
      <div
        className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-2xl max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}>
              <FolderOpen size={18} style={{ color: colors.text }} />
            </div>
            <div>
              <h2 className="text-base font-bold" style={{ color: '#1E3A8A' }}>{slot.name}</h2>
              <p className="text-xs" style={{ color: '#6B7280' }}>
                {slot.code} · {slot.currentOccupancy}/{slot.capacity} items
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-white"
              style={{ backgroundColor: '#2563EB' }}
            >
              <Plus size={13} /> Add Collateral
            </button>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X size={16} style={{ color: '#6B7280' }} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
              <AlertCircle size={14} /> {error}
            </div>
          )}
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />
              ))}
            </div>
          ) : placements.length === 0 ? (
            <div className="text-center py-12">
              <Package size={36} className="mx-auto mb-3" style={{ color: '#BAE6FD' }} />
              <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No collaterals in this slot</p>
              <p className="text-xs mt-1 mb-4" style={{ color: '#6B7280' }}>Add a collateral to start filling this slot</p>
              <button
                onClick={() => setShowAddModal(true)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-white"
                style={{ backgroundColor: '#2563EB' }}
              >
                Add First Collateral
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              {placements.map((p) => (
                <div
                  key={p.id}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ backgroundColor: '#EFF6FF' }}>
                    <FileText size={15} style={{ color: '#2563EB' }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: '#1E3A8A' }}>
                      {p.collateral?.description ?? 'Unnamed Collateral'}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                      {p.collateral?.collateral_type ?? '—'} · {p.collateral?.obligor ?? '—'}
                    </p>
                    {p.physicalRef && (
                      <p className="text-xs mt-0.5 font-mono" style={{ color: '#9CA3AF' }}>Ref: {p.physicalRef}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs" style={{ color: '#9CA3AF' }}>
                      {new Date(p.placedAt).toLocaleDateString()}
                    </p>
                    {p.placedByProfile?.full_name && (
                      <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>{p.placedByProfile.full_name}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showAddModal && (
        <AddCollateralToSlotModal
          slot={slot}
          userId={userId}
          existingCollateralIds={placements.map((p) => p.collateralId)}
          onClose={() => setShowAddModal(false)}
          onSaved={() => {
            setShowAddModal(false);
            loadPlacements();
            onRefreshTree();
          }}
        />
      )}
    </div>
  );
}

// ─── Add Collateral to Slot Modal ─────────────────────────────────────────────

interface AddCollateralToSlotModalProps {
  slot: ArchiveLocation;
  userId: string;
  existingCollateralIds: string[];
  onClose: () => void;
  onSaved: () => void;
}

function AddCollateralToSlotModal({ slot, userId, existingCollateralIds, onClose, onSaved }: AddCollateralToSlotModalProps) {
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [loadingCollaterals, setLoadingCollaterals] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [physicalRef, setPhysicalRef] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    collateralService.getAll()
      .then((data) => setCollaterals(data))
      .catch(() => setCollaterals([]))
      .finally(() => setLoadingCollaterals(false));
  }, []);

  const filtered = collaterals.filter((c) => {
    if (existingCollateralIds.includes(c.id)) return false;
    const q = search.toLowerCase();
    return (
      c.description?.toLowerCase().includes(q) ||
      c.obligor?.toLowerCase().includes(q) ||
      c.type?.toLowerCase().includes(q) ||
      c.collateralId?.toLowerCase().includes(q)
    );
  });

  const handleSave = async () => {
    if (!selectedId) { setError('Please select a collateral.'); return; }
    setSaving(true);
    setError('');
    try {
      await archivePlacementService.upsert({
        collateralId: selectedId,
        locationId: slot.id,
        physicalRef: physicalRef.trim() || undefined,
        notes: notes.trim() || undefined,
        placedBy: userId,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add collateral');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b" style={{ borderColor: '#E5E7EB' }}>
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1E3A8A' }}>Add Collateral to Slot</h3>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{slot.name} · {slot.code}</p>
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

          {/* Search & Select Collateral */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>Select Collateral *</label>
            <div className="relative mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by description, obligor, type…"
                className="w-full border rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: '#D1D5DB' }}
              />
            </div>
            {loadingCollaterals ? (
              <div className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />
            ) : (
              <div className="border rounded-xl overflow-hidden max-h-48 overflow-y-auto" style={{ borderColor: '#E5E7EB' }}>
                {filtered.length === 0 ? (
                  <p className="text-xs text-center py-6" style={{ color: '#9CA3AF' }}>
                    {search ? 'No matching collaterals found' : 'All collaterals already placed in this slot'}
                  </p>
                ) : (
                  filtered.map((c) => (
                    <button
                      key={c.id}
                      onClick={() => setSelectedId(c.id)}
                      className="w-full flex items-start gap-3 px-3 py-2.5 text-left transition-colors border-b last:border-b-0"
                      style={{
                        borderColor: '#F3F4F6',
                        backgroundColor: selectedId === c.id ? '#EFF6FF' : 'white',
                      }}
                    >
                      <div
                        className="w-2 h-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: selectedId === c.id ? '#2563EB' : '#D1D5DB' }}
                      />
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate" style={{ color: '#1E3A8A' }}>{c.description}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
                          {c.type} · {c.obligor} · {c.collateralId}
                        </p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Physical Ref */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Physical Reference</label>
            <input
              value={physicalRef}
              onChange={(e) => setPhysicalRef(e.target.value)}
              placeholder="e.g. BOX-001, FILE-A3"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Any additional placement notes…"
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-2 p-5 border-t" style={{ borderColor: '#E5E7EB' }}>
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#D1D5DB', color: '#374151' }}>
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !selectedId}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: '#2563EB', opacity: saving || !selectedId ? 0.5 : 1 }}
          >
            {saving ? 'Saving…' : 'Add to Slot'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Location Node ─────────────────────────────────────────────────────────────

interface LocationNodeProps {
  node: ArchiveLocation;
  depth: number;
  onAddChild: (parentId: string, parentType: LocationType) => void;
  onDelete: (id: string) => void;
  onSelectSlot: (slot: ArchiveLocation) => void;
  selectedSlotId: string | null;
}

function LocationNode({ node, depth, onAddChild, onDelete, onSelectSlot, selectedSlotId }: LocationNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const colors = LOCATION_TYPE_COLORS[node.locationType];
  const hasChildren = (node.children?.length ?? 0) > 0;
  const canAddChild = node.locationType !== 'slot';
  const isSlot = node.locationType === 'slot';
  const isSelected = selectedSlotId === node.id;
  const occupancyPct = node.capacity > 0 ? Math.round((node.currentOccupancy / node.capacity) * 100) : 0;

  return (
    <div style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
      <div
        className={`flex items-center gap-2 p-3 rounded-xl mb-1.5 group transition-all ${isSlot ? 'cursor-pointer' : ''}`}
        style={{
          backgroundColor: isSelected ? colors.border : colors.bg,
          border: `1px solid ${isSelected ? colors.text : colors.border}`,
          boxShadow: isSelected ? `0 0 0 2px ${colors.border}` : undefined,
        }}
        onClick={isSlot ? () => onSelectSlot(node) : undefined}
      >
        <button
          onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0 w-5 h-5 flex items-center justify-center"
        >
          {hasChildren
            ? (expanded ? <ChevronDown size={14} style={{ color: colors.text }} /> : <ChevronRight size={14} style={{ color: colors.text }} />)
            : <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.4 }} />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: colors.text }}>{node.name}</span>
            <span className="text-xs px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: colors.border, color: colors.text }}>
              {LOCATION_TYPE_LABELS[node.locationType]}
            </span>
            <span className="text-xs font-mono" style={{ color: '#6B7280' }}>{node.code}</span>
            {isSlot && (
              <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                {node.currentOccupancy} item{node.currentOccupancy !== 1 ? 's' : ''}
              </span>
            )}
          </div>
          {node.description && <p className="text-xs mt-0.5 truncate" style={{ color: '#6B7280' }}>{node.description}</p>}
          {isSlot && (
            <p className="text-xs mt-0.5" style={{ color: colors.text, opacity: 0.7 }}>
              Click to view contents &amp; add collaterals
            </p>
          )}
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-medium" style={{ color: colors.text }}>{node.currentOccupancy}/{node.capacity}</p>
            <div className="w-16 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: colors.border }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${occupancyPct}%`, backgroundColor: colors.text }} />
            </div>
          </div>
          {canAddChild && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id, node.locationType); }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
              style={{ backgroundColor: colors.border }} title="Add child location"
            >
              <Plus size={12} style={{ color: colors.text }} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-red-100"
            title="Delete"
          >
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <LocationNode
              key={child.id}
              node={child}
              depth={depth + 1}
              onAddChild={onAddChild}
              onDelete={onDelete}
              onSelectSlot={onSelectSlot}
              selectedSlotId={selectedSlotId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function VaultManagementContent() {
  const { user } = useAuth();
  const [tree, setTree] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModal, setAddModal] = useState<{ parentId: string | null; parentType: LocationType | null } | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<ArchiveLocation | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await archiveLocationService.getTree();
      setTree(data);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location and all its children?')) return;
    try { await archiveLocationService.delete(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const totalVaults = tree.length;
  const totalLocations = (function count(nodes: ArchiveLocation[]): number {
    return nodes.reduce((acc, n) => acc + 1 + count(n.children ?? []), 0);
  })(tree);

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>Vault Management</h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>Define hierarchical vault locations for physical collateral storage</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border transition-colors hover:bg-blue-50" style={{ borderColor: '#BFDBFE' }}>
            <RefreshCw size={16} style={{ color: '#2563EB' }} />
          </button>
          <button onClick={() => setAddModal({ parentId: null, parentType: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: '#2563EB' }}>
            <Plus size={16} /> Add Vault
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Vaults', value: totalVaults, icon: Building2, color: '#1D4ED8' },
          { label: 'Total Locations', value: totalLocations, icon: Layers, color: '#15803D' },
          { label: 'Active', value: totalLocations, icon: CheckCircle, color: '#0369A1' },
          { label: 'Filing Slots', value: (function countSlots(nodes: ArchiveLocation[]): number {
            return nodes.reduce((acc, n) => acc + (n.locationType === 'slot' ? 1 : 0) + countSlots(n.children ?? []), 0);
          })(tree), icon: Package, color: '#7E22CE' },
        ].map((stat) => (
          <div key={stat.label} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
            <div className="flex items-center gap-2 mb-1">
              <stat.icon size={16} style={{ color: stat.color }} />
              <span className="text-xs font-medium" style={{ color: '#6B7280' }}>{stat.label}</span>
            </div>
            <p className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Slot hint */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs" style={{ backgroundColor: '#F0F9FF', border: '1px solid #BAE6FD', color: '#0369A1' }}>
        <FolderOpen size={13} />
        <span>Click on any <strong>Filing Slot</strong> to view its contents and add collaterals directly.</span>
      </div>

      {/* Tree */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16">
          <Archive size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
          <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No vaults defined yet</p>
          <p className="text-xs mt-1 mb-4" style={{ color: '#3B82F6' }}>Start by adding your first vault</p>
          <button onClick={() => setAddModal({ parentId: null, parentType: null })}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: '#2563EB' }}>
            Add First Vault
          </button>
        </div>
      ) : (
        <div>
          {tree.map((node) => (
            <LocationNode
              key={node.id}
              node={node}
              depth={0}
              onAddChild={(pid, pt) => setAddModal({ parentId: pid, parentType: pt })}
              onDelete={handleDelete}
              onSelectSlot={setSelectedSlot}
              selectedSlotId={selectedSlot?.id ?? null}
            />
          ))}
        </div>
      )}

      {addModal && (
        <AddLocationModal
          parentId={addModal.parentId}
          parentType={addModal.parentType}
          userId={user?.id ?? ''}
          onClose={() => setAddModal(null)}
          onSaved={() => { setAddModal(null); load(); }}
        />
      )}

      {selectedSlot && (
        <SlotContentsPanel
          slot={selectedSlot}
          userId={user?.id ?? ''}
          onClose={() => setSelectedSlot(null)}
          onRefreshTree={load}
        />
      )}
    </div>
  );
}
