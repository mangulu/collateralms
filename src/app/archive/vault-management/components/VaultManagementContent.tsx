'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Building2, Plus, ChevronRight, ChevronDown, Trash2, RefreshCw, AlertCircle, CheckCircle, Package, Layers, Archive,  } from 'lucide-react';
import { archiveLocationService, ArchiveLocation, LocationType } from '@/lib/supabase/archiveService';
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

interface LocationNodeProps {
  node: ArchiveLocation;
  depth: number;
  onAddChild: (parentId: string, parentType: LocationType) => void;
  onDelete: (id: string) => void;
}

function LocationNode({ node, depth, onAddChild, onDelete }: LocationNodeProps) {
  const [expanded, setExpanded] = useState(depth < 2);
  const colors = LOCATION_TYPE_COLORS[node.locationType];
  const hasChildren = (node.children?.length ?? 0) > 0;
  const canAddChild = node.locationType !== 'slot';
  const occupancyPct = node.capacity > 0 ? Math.round((node.currentOccupancy / node.capacity) * 100) : 0;

  return (
    <div style={{ marginLeft: depth > 0 ? '20px' : '0' }}>
      <div
        className="flex items-center gap-2 p-3 rounded-xl mb-1.5 group transition-all"
        style={{ backgroundColor: colors.bg, border: `1px solid ${colors.border}` }}
      >
        <button onClick={() => setExpanded(!expanded)} className="shrink-0 w-5 h-5 flex items-center justify-center">
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
          </div>
          {node.description && <p className="text-xs mt-0.5 truncate" style={{ color: '#6B7280' }}>{node.description}</p>}
        </div>
        <div className="hidden sm:flex items-center gap-3 shrink-0">
          <div className="text-right">
            <p className="text-xs font-medium" style={{ color: colors.text }}>{node.currentOccupancy}/{node.capacity}</p>
            <div className="w-16 h-1.5 rounded-full mt-0.5" style={{ backgroundColor: colors.border }}>
              <div className="h-full rounded-full transition-all" style={{ width: `${occupancyPct}%`, backgroundColor: colors.text }} />
            </div>
          </div>
          {canAddChild && (
            <button onClick={() => onAddChild(node.id, node.locationType)}
              className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all"
              style={{ backgroundColor: colors.border }} title="Add child location">
              <Plus size={12} style={{ color: colors.text }} />
            </button>
          )}
          <button onClick={() => onDelete(node.id)}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg transition-all hover:bg-red-100"
            title="Delete">
            <Trash2 size={12} className="text-red-400" />
          </button>
        </div>
      </div>
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <LocationNode key={child.id} node={child} depth={depth + 1} onAddChild={onAddChild} onDelete={onDelete} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function VaultManagementContent() {
  const { user } = useAuth();
  const [tree, setTree] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [addModal, setAddModal] = useState<{ parentId: string | null; parentType: LocationType | null } | null>(null);

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
            <LocationNode key={node.id} node={node} depth={0} onAddChild={(pid, pt) => setAddModal({ parentId: pid, parentType: pt })} onDelete={handleDelete} />
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
    </div>
  );
}
