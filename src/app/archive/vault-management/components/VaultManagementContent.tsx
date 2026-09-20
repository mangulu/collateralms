'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight, ChevronDown, Trash2, RefreshCw, AlertCircle, X, FolderOpen, Building2, DoorOpen, BookOpen, Grid3X3, MapPin, CheckCircle2 } from 'lucide-react';
import {
  archiveLocationService, archivePlacementService,
  ArchiveLocation, LocationType,
} from '@/lib/supabase/archiveService';
import { archiveReconciliationService } from '@/lib/supabase/archiveReconciliationService';
import { useAuth } from '@/contexts/AuthContext';
import LocationDetailDrawer from './LocationDetailDrawer';
import StatCard from '@/components/ui/StatCard';
import StatusBadge from '@/components/ui/StatusBadge';

// ─── Hierarchy: vault → room → cabinet → slot ───────────────────────────────────
// Strict 4-level hierarchy: Vault → Room → Cabinet → Slot
const LOCATION_TYPE_ORDER: LocationType[] = ['vault', 'room', 'cabinet', 'slot'];

const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  vault: 'Vault',
  room: 'Room',
  cabinet: 'Cabinet',
  slot: 'Slot',
};

const LOCATION_TYPE_COLORS: Record<LocationType, { bg: string; text: string; border: string }> = {
  vault:   { bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary)', border: 'var(--izou-secondary-light)' },
  room:    { bg: 'var(--izou-success-light)', text: 'var(--izou-success)', border: 'var(--izou-success-light)' },
  cabinet: { bg: 'var(--izou-warning-light)', text: 'var(--izou-warning)', border: 'var(--izou-warning-light)' },
  slot:    { bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary-mid)', border: 'var(--izou-secondary-light)' },
};

// Level icons for visual hierarchy
const LEVEL_ICONS: Record<LocationType, React.ReactNode> = {
  vault:   <Building2 size={20} />,
  room:    <DoorOpen size={20} />,
  cabinet: <BookOpen size={20} />,
  slot:    <Grid3X3 size={20} />,
};

const LEVEL_DESCRIPTIONS: Record<LocationType, string> = {
  vault:   'Physical vault building',
  room:    'Room inside vault',
  cabinet: 'Cabinet in room',
  slot:    'Filing slot in cabinet',
};

// ─── Add Location Modal ───────────────────────────────────────────────────────

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
  const [capacity, setCapacity] = useState(10);
  // Room-specific: max cabinets
  const [maxCabinets, setMaxCabinets] = useState(10);
  // Cabinet-specific: rows, columns, max slot capacity
  const [rows, setRows] = useState(3);
  const [columns, setColumns] = useState(4);
  const [maxSlotCapacity, setMaxSlotCapacity] = useState(5);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isRoom = nextType === 'room';
  const isCabinet = nextType === 'cabinet';
  const isSlot = nextType === 'slot';

  const totalSlots = rows * columns;

  const handleSave = async () => {
    if (!name.trim() || !code.trim()) { setError('Name and code are required.'); return; }
    setSaving(true);
    try {
      if (isCabinet) {
        // Create the cabinet
        const cabinet = await archiveLocationService.create({
          name: name.trim(),
          code: code.trim(),
          locationType: 'cabinet',
          parentId,
          description: description.trim() || undefined,
          capacity: totalSlots,
          createdBy: userId,
        });
        // Auto-generate slots
        for (let r = 1; r <= rows; r++) {
          for (let c = 1; c <= columns; c++) {
            const slotLabel = `${code.trim()}-R${r}C${c}`;
            await archiveLocationService.create({
              name: `Row ${r}, Col ${c}`,
              code: slotLabel,
              locationType: 'slot',
              parentId: cabinet.id,
              description: `Auto-generated slot at Row ${r}, Column ${c}`,
              capacity: maxSlotCapacity,
              createdBy: userId,
            });
          }
        }
      } else {
        const cap = isRoom ? maxCabinets : isSlot ? capacity : capacity;
        await archiveLocationService.create({
          name: name.trim(),
          code: code.trim(),
          locationType: nextType,
          parentId,
          description: description.trim() || undefined,
          capacity: cap,
          createdBy: userId,
        });
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  const colors = LOCATION_TYPE_COLORS[nextType];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        {/* Header with icon */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
            style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}>
            {LEVEL_ICONS[nextType]}
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--izou-secondary)' }}>
              Add {LOCATION_TYPE_LABELS[nextType]}
            </h3>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{LEVEL_DESCRIPTIONS[nextType]}</p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Name *</label>
            <input value={name} onChange={(e) => setName(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: 'var(--izou-border)' }}
              placeholder={`e.g. ${LOCATION_TYPE_LABELS[nextType]} A`} />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Code *</label>
            <input value={code} onChange={(e) => setCode(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: 'var(--izou-border)' }} placeholder="e.g. VLT-001" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Description</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: 'var(--izou-border)' }} />
          </div>

          {/* Room: max cabinets */}
          {isRoom && (
            <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--izou-success-light)', border: '1px solid var(--izou-success-light)' }}>
              <label className="block text-xs font-semibold mb-1" style={{ color: 'var(--izou-success)' }}>
                Room Capacity (Max Cabinets)
              </label>
              <input type="number" value={maxCabinets} onChange={(e) => setMaxCabinets(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                style={{ borderColor: 'var(--izou-success-light)' }} min={1} />
              <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Maximum number of cabinets this room can hold</p>
            </div>
          )}

          {/* Cabinet: rows, columns, slot capacity */}
          {isCabinet && (
            <div className="p-3 rounded-xl space-y-3" style={{ backgroundColor: 'var(--izou-warning-light)', border: '1px solid var(--izou-warning-light)' }}>
              <p className="text-xs font-semibold" style={{ color: 'var(--izou-warning)' }}>
                📐 Cabinet Layout — Slots are auto-generated from rows × columns
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Rows</label>
                  <input type="number" value={rows} onChange={(e) => setRows(Math.max(1, Number(e.target.value)))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    style={{ borderColor: 'var(--izou-warning-light)' }} min={1} max={20} />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Columns</label>
                  <input type="number" value={columns} onChange={(e) => setColumns(Math.max(1, Number(e.target.value)))}
                    className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    style={{ borderColor: 'var(--izou-warning-light)' }} min={1} max={20} />
                </div>
              </div>
              <div className="flex items-center justify-between p-2 rounded-lg" style={{ backgroundColor: 'var(--izou-warning-light)' }}>
                <span className="text-xs font-medium" style={{ color: 'var(--izou-warning)' }}>Total Slots to Create:</span>
                <span className="text-sm font-bold" style={{ color: 'var(--izou-warning)' }}>{totalSlots}</span>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Max Files per Slot</label>
                <input type="number" value={maxSlotCapacity} onChange={(e) => setMaxSlotCapacity(Math.max(1, Number(e.target.value)))}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  style={{ borderColor: 'var(--izou-warning-light)' }} min={1} />
                <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Maximum collateral files/folders each slot can hold</p>
              </div>
            </div>
          )}

          {/* Vault or Slot: simple capacity */}
          {!isRoom && !isCabinet && (
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>
                {isSlot ? 'Max Files per Slot' : 'Capacity'}
              </label>
              <input type="number" value={capacity} onChange={(e) => setCapacity(Number(e.target.value))}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: 'var(--izou-border)' }} min={1} />
            </div>
          )}
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: 'var(--izou-border)', color: 'var(--izou-text)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white transition-opacity"
            style={{ backgroundColor: 'var(--izou-secondary)', opacity: saving ? 0.6 : 1 }}>
            {saving ? (isCabinet ? 'Creating Slots…' : 'Saving…') : (isCabinet ? `Create Cabinet + ${totalSlots} Slots` : 'Save')}
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
  onSelectDetail: (node: ArchiveLocation) => void;
  lastReconciledAt?: string | null;
}

function LocationNode({ node, depth, onAddChild, onDelete, onSelectDetail, lastReconciledAt }: LocationNodeProps) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(depth < 2);
  const colors = LOCATION_TYPE_COLORS[node.locationType];
  const hasChildren = (node.children?.length ?? 0) > 0;
  // vault → add room; room → add cabinet; cabinet → no add (slots auto-generated)
  const canAdd = node.locationType === 'vault' || node.locationType === 'room';
  const isSlot = node.locationType === 'slot';
  const isDetailable = node.locationType === 'room' || node.locationType === 'cabinet';
  const occupancyPct = node.capacity > 0 ? Math.round((node.currentOccupancy / node.capacity) * 100) : 0;

  const handleRowClick = () => {
    if (isSlot) {
      router.push(`/archive/vault-slot/${node.id}`);
    } else if (isDetailable) {
      onSelectDetail(node);
    }
  };

  return (
    <div style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
      <div
        className={`flex items-center gap-2 p-3 rounded-xl mb-1.5 group transition-all ${isSlot || isDetailable ? 'cursor-pointer' : ''}`}
        style={{
          backgroundColor: colors.bg,
          border: `1px solid ${colors.border}`,
        }}
        onClick={handleRowClick}
      >
        {/* Expand toggle */}
        <button onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          className="shrink-0 w-5 h-5 flex items-center justify-center">
          {hasChildren
            ? (expanded
              ? <ChevronDown size={14} style={{ color: colors.text }} />
              : <ChevronRight size={14} style={{ color: colors.text }} />)
            : <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: colors.text, opacity: 0.4 }} />}
        </button>

        {/* Level icon */}
        <div className="shrink-0 w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'white', border: `1px solid ${colors.border}`, color: colors.text }}
          title={LEVEL_DESCRIPTIONS[node.locationType]}>
          {LEVEL_ICONS[node.locationType]}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold" style={{ color: colors.text }}>{node.name}</span>
            <StatusBadge label={LOCATION_TYPE_LABELS[node.locationType]} bg={colors.border} text={colors.text} />
            <span className="text-xs font-mono" style={{ color: 'var(--izou-muted)' }}>{node.code}</span>
            {isSlot && (
              <StatusBadge label={`${node.currentOccupancy} item${node.currentOccupancy !== 1 ? 's' : ''}`} bg="var(--izou-secondary-light)" text="var(--izou-secondary)" />
            )}
          </div>
          {node.description && (
            <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--izou-muted)' }}>{node.description}</p>
          )}
          {node.locationType === 'vault' && (
            <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>
              {lastReconciledAt
                ? `Last reconciled ${new Date(lastReconciledAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`
                : 'Never reconciled'}
            </p>
          )}
          {isSlot && (
            <p className="text-xs mt-0.5" style={{ color: colors.text, opacity: 0.7 }}>
              Click to view contents, move &amp; remove files
            </p>
          )}
          {isDetailable && (
            <p className="text-xs mt-0.5" style={{ color: colors.text, opacity: 0.7 }}>
              Click to view details &amp; contents
            </p>
          )}
        </div>

        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-medium" style={{ color: colors.text }}>{node.currentOccupancy}/{node.capacity}</p>
            <div className="w-16 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: colors.border }}>
              <div className="h-full rounded-full transition-all"
                style={{ width: `${occupancyPct}%`, backgroundColor: colors.text }} />
            </div>
          </div>
          {canAdd && (
            <button
              onClick={(e) => { e.stopPropagation(); onAddChild(node.id, node.locationType); }}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
              style={{ backgroundColor: colors.border }}
              title={`Add ${node.locationType === 'vault' ? 'Room' : 'Cabinet'}`}>
              <Plus size={12} style={{ color: colors.text }} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(node.id); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-red-100"
            title="Delete">
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
      </div>

      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <LocationNode key={child.id} node={child} depth={depth + 1}
              onAddChild={onAddChild} onDelete={onDelete} onSelectDetail={onSelectDetail} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Hierarchy Legend ─────────────────────────────────────────────────────────

function HierarchyLegend() {
  const levels = [
    { type: 'vault' as LocationType, label: 'Vault', desc: 'Top-level physical building/safe' },
    { type: 'room' as LocationType, label: 'Room', desc: 'Room inside the vault' },
    { type: 'cabinet' as LocationType, label: 'Cabinet', desc: 'Cabinet with rows & columns' },
    { type: 'slot' as LocationType, label: 'Slot', desc: 'Filing slot (row × column intersection)' },
  ];
  return (
    <div className="flex items-center gap-1 flex-wrap mb-4">
      {levels.map((l, i) => {
        const colors = LOCATION_TYPE_COLORS[l.type];
        return (
          <React.Fragment key={l.type}>
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-medium"
              style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}`, color: colors.text }}
              title={l.desc}>
              {React.cloneElement(LEVEL_ICONS[l.type] as React.ReactElement<{ size?: number }>, { size: 13 })}
              <span>{l.label}</span>
            </div>
            {i < levels.length - 1 && (
              <ChevronRight size={14} style={{ color: 'var(--izou-muted)' }} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────

export default function VaultManagementContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [tree, setTree] = useState<ArchiveLocation[]>([]);
  const [lastReconciledByVault, setLastReconciledByVault] = useState<Record<string, string | null>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModal, setAddModal] = useState<{ parentId: string | null; parentType: LocationType | null } | null>(null);
  const [drawerStack, setDrawerStack] = useState<ArchiveLocation[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await archiveLocationService.getTreeWithCounts();
      setTree(data);
      const entries = await Promise.all(
        data.map(async (vault) => {
          const session = await archiveReconciliationService.getLastCompletedForLocation(vault.id).catch(() => null);
          return [vault.id, session?.completedAt ?? null] as const;
        })
      );
      setLastReconciledByVault(Object.fromEntries(entries));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Real-time sync for vault locations and placements
  useEffect(() => {
    const locChannel = archiveLocationService.subscribeToChanges(() => { load(); });
    const placeChannel = archivePlacementService.subscribeToChanges(() => { load(); });
    return () => {
      locChannel.unsubscribe();
      placeChannel.unsubscribe();
    };
  }, [load]);

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this location and all its children?')) return;
    try { await archiveLocationService.delete(id); load(); }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Delete failed'); }
  };

  const handleCloseDrawer = () => setDrawerStack([]);
  const handleDrillInto = (child: ArchiveLocation) => setDrawerStack((prev) => [...prev, child]);
  const handleBreadcrumbClick = (index: number) => setDrawerStack((prev) => prev.slice(0, index + 1));
  const handleSlotClickInDrawer = (slot: ArchiveLocation) => {
    setDrawerStack([]);
    router.push(`/archive/vault-slot/${slot.id}`);
  };

  const totalVaults = tree.length;
  const totalLocations = (function count(nodes: ArchiveLocation[]): number {
    return nodes.reduce((acc, n) => acc + 1 + count(n.children ?? []), 0);
  })(tree);
  const activeLocations = (function countActive(nodes: ArchiveLocation[]): number {
    return nodes.reduce((acc, n) => acc + (n.isActive ? 1 : 0) + countActive(n.children ?? []), 0);
  })(tree);
  const totalSlots = (function countSlots(nodes: ArchiveLocation[]): number {
    return nodes.reduce((acc, n) => acc + (n.locationType === 'slot' ? 1 : 0) + countSlots(n.children ?? []), 0);
  })(tree);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--izou-primary)', fontFamily: 'DM Sans, sans-serif' }}>
            Vault Management
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--izou-muted)' }}>
            Hierarchical vault structure: Vault → Room → Cabinet → Slot
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border transition-colors hover:bg-blue-50"
            style={{ borderColor: 'var(--izou-border)' }}>
            <RefreshCw size={16} style={{ color: 'var(--izou-secondary)' }} />
          </button>
          <button onClick={() => setAddModal({ parentId: null, parentType: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--izou-secondary)' }}>
            <Plus size={16} /> Add Vault
          </button>
        </div>
      </div>

      {/* Hierarchy Legend */}
      <HierarchyLegend />

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <StatCard label="Vaults" value={totalVaults} icon={<Building2 size={16} />} color="var(--izou-secondary)" />
        <StatCard label="Total Locations" value={totalLocations} icon={<MapPin size={16} />} color="var(--izou-success)" />
        <StatCard label="Active" value={activeLocations} icon={<CheckCircle2 size={16} />} color="var(--izou-secondary-mid)" />
        <StatCard label="Filing Slots" value={totalSlots} icon={<Grid3X3 size={16} />} color="var(--izou-highlight)" />
      </div>

      {/* Slot hint */}
      <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl text-xs"
        style={{ backgroundColor: 'var(--izou-secondary-light)', border: '1px solid var(--izou-secondary-light)', color: 'var(--izou-secondary-mid)' }}>
        <FolderOpen size={13} />
        <span>Click on any <strong>Slot</strong> to open its detail page — view contents, move files to another slot, or remove them.</span>
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
            <div key={i} className="h-14 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-secondary-light)' }} />
          ))}
        </div>
      ) : tree.length === 0 ? (
        <div className="text-center py-16">
          <Building2 size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-secondary-light)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>No vaults defined yet</p>
          <p className="text-xs mt-1 mb-4" style={{ color: 'var(--izou-muted)' }}>
            Start by adding your first vault, then add rooms, cabinets, and slots
          </p>
          <button onClick={() => setAddModal({ parentId: null, parentType: null })}
            className="px-4 py-2 rounded-xl text-sm font-medium text-white" style={{ backgroundColor: 'var(--izou-secondary)' }}>
            Add First Vault
          </button>
        </div>
      ) : (
        <div>
          {tree.map((node) => (
            <LocationNode key={node.id} node={node} depth={0}
              onAddChild={(pid, pt) => setAddModal({ parentId: pid, parentType: pt })}
              onDelete={handleDelete}
              onSelectDetail={(loc) => setDrawerStack([loc])}
              lastReconciledAt={lastReconciledByVault[node.id] ?? null} />
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

      {drawerStack.length > 0 && (
        <LocationDetailDrawer
          stack={drawerStack}
          onClose={handleCloseDrawer}
          onDrillInto={handleDrillInto}
          onBreadcrumbClick={handleBreadcrumbClick}
          onSlotClick={handleSlotClickInDrawer}
        />
      )}
    </div>
  );
}
