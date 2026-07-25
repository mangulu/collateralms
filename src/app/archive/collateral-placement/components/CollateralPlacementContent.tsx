'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  FolderCheck, Plus, Search, RefreshCw, AlertCircle, Link2, Package, Edit2,
  Upload, FileText, X, Loader2, Paperclip, CheckCircle2, CheckSquare, Square,
  Layers, MoveRight,
} from 'lucide-react';
import {
  archivePlacementService, archiveLocationService, archiveAuditService,
  ArchivePlacement, ArchiveLocation,
} from '@/lib/supabase/archiveService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';

const ACCEPTED_TYPES = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// Auto-generate physical reference: PHY-YYYYMMDD-XXXX
function generatePhysicalRef(): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `PHY-${date}-${rand}`;
}

// ─── Bulk Move Modal ──────────────────────────────────────────────────────────
interface BulkMoveModalProps {
  selected: CollateralRecord[];
  locations: ArchiveLocation[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function BulkMoveModal({ selected, locations, userId, onClose, onSaved }: BulkMoveModalProps) {
  const slots = locations.filter((l) => l.locationType === 'slot');
  const [locationId, setLocationId] = useState('');
  const [saving, setSaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');

  const handleBulkFile = async () => {
    if (!locationId) { setError('Please select a vault slot.'); return; }
    setSaving(true);
    setError('');
    try {
      for (let i = 0; i < selected.length; i++) {
        const c = selected[i];
        const physicalRef = generatePhysicalRef();
        await archivePlacementService.upsert({
          collateralId: c.id,
          locationId,
          physicalRef,
          placedBy: userId,
        });
        await archiveAuditService.log({
          eventType: 'placement_assigned',
          collateralId: c.id,
          locationId,
          performedBy: userId,
          description: `Bulk filed — physical ref ${physicalRef}`,
        });
        setProgress(i + 1);
      }
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Bulk filing failed');
    } finally { setSaving(false); }
  };

  const selectedSlot = slots.find((s) => s.id === locationId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ backgroundColor: '#EFF6FF' }}>
            <Layers size={18} style={{ color: '#2563EB' }} />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1E3A8A' }}>Bulk File Collaterals</h3>
            <p className="text-xs" style={{ color: '#6B7280' }}>
              {selected.length} collateral{selected.length !== 1 ? 's' : ''} selected
            </p>
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}

        {/* Selected collaterals preview */}
        <div className="mb-4 rounded-xl border max-h-36 overflow-y-auto"
          style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}>
          {selected.map((c) => (
            <div key={c.id} className="flex items-center gap-2 px-3 py-2 border-b last:border-b-0"
              style={{ borderColor: '#DBEAFE' }}>
              <Package size={13} style={{ color: '#1D4ED8' }} />
              <span className="text-xs truncate" style={{ color: '#1E3A8A' }}>
                {c.type} — {c.obligor}
              </span>
            </div>
          ))}
        </div>

        {/* Slot selector */}
        <div className="mb-4">
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
            Target Vault Slot *
          </label>
          <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: '#D1D5DB' }}>
            <option value="">Select slot…</option>
            {slots.map((l) => (
              <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
            ))}
          </select>
        </div>

        {/* Physical ref note */}
        <div className="flex items-start gap-2 mb-5 p-3 rounded-xl text-xs"
          style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0', color: '#15803D' }}>
          <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
          <span>
            A unique physical reference (PHY-YYYYMMDD-XXXX) will be auto-generated for each
            collateral and saved automatically.
          </span>
        </div>

        {/* Progress bar while saving */}
        {saving && (
          <div className="mb-4">
            <div className="flex justify-between text-xs mb-1" style={{ color: '#6B7280' }}>
              <span>Filing…</span>
              <span>{progress} / {selected.length}</span>
            </div>
            <div className="w-full rounded-full h-2" style={{ backgroundColor: '#DBEAFE' }}>
              <div className="h-2 rounded-full transition-all"
                style={{ width: `${(progress / selected.length) * 100}%`, backgroundColor: '#2563EB' }} />
            </div>
          </div>
        )}

        {selectedSlot && (
          <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-lg text-xs"
            style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE', color: '#1D4ED8' }}>
            <MoveRight size={13} />
            <span>All selected collaterals → <strong>{selectedSlot.name}</strong> ({selectedSlot.code})</span>
          </div>
        )}

        <div className="flex gap-2">
          <button onClick={onClose} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#D1D5DB', color: '#374151', opacity: saving ? 0.5 : 1 }}>
            Cancel
          </button>
          <button onClick={handleBulkFile} disabled={saving || !locationId}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: '#2563EB', opacity: (saving || !locationId) ? 0.6 : 1 }}>
            {saving
              ? <><Loader2 size={14} className="animate-spin" /> Filing…</>
              : <><Layers size={14} /> File {selected.length} Collateral{selected.length !== 1 ? 's' : ''}</>
            }
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Single Assign Modal ──────────────────────────────────────────────────────
interface AssignModalProps {
  collaterals: CollateralRecord[];
  locations: ArchiveLocation[];
  existing?: ArchivePlacement;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function AssignModal({ collaterals, locations, existing, userId, onClose, onSaved }: AssignModalProps) {
  const [collateralId, setCollateralId] = useState(existing?.collateralId ?? '');
  const [locationId, setLocationId] = useState(existing?.locationId ?? '');
  const [physicalRef, setPhysicalRef] = useState(existing?.physicalRef ?? generatePhysicalRef());
  const [notes, setNotes] = useState(existing?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const existingDocUrl = existing?.electronicRecordUrl ?? null;
  const slots = locations.filter((l) => l.locationType === 'slot');

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Unsupported file type. Use PDF, JPG, PNG, or DOCX.';
    if (file.size > MAX_FILE_SIZE) return 'File exceeds 10 MB limit.';
    return null;
  };

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    setFileError('');
    setPendingFile(file);
  }, []);

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const err = validateFile(file);
    if (err) { setFileError(err); return; }
    setFileError('');
    setPendingFile(file);
    e.target.value = '';
  };

  const uploadFileToStorage = async (file: File, collId: string): Promise<string | null> => {
    const supabase = createClient();
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const safeCollId = collId.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `placements/${safeCollId}/${timestamp}_${safeFileName}`;
    const { error: uploadError } = await supabase.storage
      .from('collateral-documents')
      .upload(filePath, file, { upsert: false });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);
    const { data: urlData } = await supabase.storage
      .from('collateral-documents')
      .createSignedUrl(filePath, 60 * 60 * 24 * 365);
    return urlData?.signedUrl ?? null;
  };

  const handleSave = async () => {
    if (!collateralId || !locationId) { setError('Collateral and location are required.'); return; }
    setSaving(true);
    setUploading(!!pendingFile);
    try {
      let electronicRecordUrl: string | undefined = existing?.electronicRecordUrl ?? undefined;
      if (pendingFile) {
        const url = await uploadFileToStorage(pendingFile, collateralId);
        if (url) electronicRecordUrl = url;
      }
      await archivePlacementService.upsert({
        collateralId, locationId, physicalRef, electronicRecordUrl, notes, placedBy: userId,
      });
      await archiveAuditService.log({
        eventType: 'placement_assigned', collateralId, locationId, performedBy: userId,
        description: `Collateral filed at location${pendingFile ? ' with supporting document' : ''}`,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); setUploading(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <h3 className="text-base font-bold mb-4" style={{ color: '#1E3A8A' }}>
          {existing ? 'Update Filing' : 'File Collateral'}
        </h3>
        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Collateral *</label>
            <select value={collateralId} onChange={(e) => setCollateralId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }}>
              <option value="">Select collateral…</option>
              {collaterals.map((c) => (
                <option key={c.id} value={c.id}>{c.type} — {c.obligor}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Filing Slot *</label>
            <select value={locationId} onChange={(e) => setLocationId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }}>
              <option value="">Select slot…</option>
              {slots.map((l) => (
                <option key={l.id} value={l.id}>{l.name} ({l.code})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
              Physical Reference
              <span className="ml-1 text-xs font-normal px-1.5 py-0.5 rounded"
                style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>Auto-generated</span>
            </label>
            <div className="flex gap-2">
              <input value={physicalRef} onChange={(e) => setPhysicalRef(e.target.value)}
                className="flex-1 border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 font-mono"
                style={{ borderColor: '#D1D5DB' }} placeholder="PHY-YYYYMMDD-XXXX" />
              <button type="button" onClick={() => setPhysicalRef(generatePhysicalRef())}
                className="px-3 py-2 rounded-lg text-xs font-medium border"
                style={{ borderColor: '#BFDBFE', color: '#1D4ED8', backgroundColor: '#EFF6FF' }}
                title="Regenerate reference">
                ↺
              </button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Notes</label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }} />
          </div>

          {/* Supporting Document Upload */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#374151' }}>
              Supporting Document
              <span className="ml-1 font-normal text-gray-400">(deed, certificate, agreement…)</span>
            </label>
            {existingDocUrl && !pendingFile && (
              <div className="flex items-center gap-2 mb-2 p-2 rounded-lg text-xs"
                style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}>
                <Link2 size={12} style={{ color: '#2563EB' }} />
                <span style={{ color: '#1D4ED8' }} className="font-medium">Electronic record linked</span>
                <a href={existingDocUrl} target="_blank" rel="noopener noreferrer"
                  className="ml-auto underline" style={{ color: '#2563EB' }}>View</a>
              </div>
            )}
            {pendingFile ? (
              <div className="flex items-center gap-2 p-2.5 rounded-lg border"
                style={{ backgroundColor: '#F0FDF4', borderColor: '#BBF7D0' }}>
                <FileText size={14} style={{ color: '#15803D' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate" style={{ color: '#166534' }}>{pendingFile.name}</p>
                  <p className="text-xs" style={{ color: '#4ADE80' }}>{formatFileSize(pendingFile.size)}</p>
                </div>
                <button type="button" onClick={() => setPendingFile(null)}
                  className="p-1 rounded hover:bg-green-100 transition-colors">
                  <X size={13} style={{ color: '#15803D' }} />
                </button>
              </div>
            ) : (
              <div
                onDrop={handleFileDrop}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors"
                style={{
                  borderColor: dragOver ? '#2563EB' : '#D1D5DB',
                  backgroundColor: dragOver ? '#EFF6FF' : '#FAFAFA',
                }}>
                <Upload size={16} className="mx-auto mb-1.5" style={{ color: '#9CA3AF' }} />
                <p className="text-xs font-medium" style={{ color: '#6B7280' }}>
                  Drag & drop or <span style={{ color: '#2563EB' }}>click to browse</span>
                </p>
                <p className="text-xs mt-0.5" style={{ color: '#9CA3AF' }}>PDF, JPG, PNG, DOCX — max 10 MB</p>
                <input ref={fileInputRef} type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                  className="hidden" onChange={handleFileInput} />
              </div>
            )}
            {fileError && (
              <div className="flex items-center gap-1.5 mt-1.5 text-xs" style={{ color: '#DC2626' }}>
                <AlertCircle size={12} /> {fileError}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border"
            style={{ borderColor: '#D1D5DB', color: '#374151' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white flex items-center justify-center gap-2"
            style={{ backgroundColor: '#2563EB', opacity: saving ? 0.6 : 1 }}>
            {saving ? (
              <><Loader2 size={14} className="animate-spin" />{uploading ? 'Uploading…' : 'Saving…'}</>
            ) : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function CollateralFilingContent() {
  const { user } = useAuth();
  const [placements, setPlacements] = useState<ArchivePlacement[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [locations, setLocations] = useState<ArchiveLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editPlacement, setEditPlacement] = useState<ArchivePlacement | undefined>();
  const [showFiledOnly, setShowFiledOnly] = useState(false);

  // Multi-select state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setSelectedIds(new Set());
    try {
      const [pResult, cResult, lResult] = await Promise.allSettled([
        archivePlacementService.getAll(),
        collateralService.getAll(),
        archiveLocationService.getAll(),
      ]);
      if (pResult.status === 'fulfilled') setPlacements(pResult.value);
      if (cResult.status === 'fulfilled') setCollaterals(cResult.value);
      else setError('Failed to load collateral records');
      if (lResult.status === 'fulfilled') setLocations(lResult.value);
      else setError((prev) => prev || 'Failed to load locations');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useCollateralRealtime({
    onPlacementChange: () => {
      archivePlacementService.getAll().then((data) => setPlacements(data)).catch(() => {});
    },
    onCollateralChange: () => {
      collateralService.getAll().then((data) => setCollaterals(data)).catch(() => {});
    },
    onDocumentChange: () => {
      archivePlacementService.getAll().then((data) => setPlacements(data)).catch(() => {});
    },
  });

  // IDs of collaterals that are already filed
  const filedCollateralIds = new Set(placements.map((p) => p.collateralId));

  // Collaterals available for filing (not yet filed)
  const unfiledCollaterals = collaterals.filter((c) => !filedCollateralIds.has(c.id));

  const filtered = placements.filter((p) => {
    const q = search.toLowerCase();
    return (
      p.collateral?.description?.toLowerCase().includes(q) ||
      p.collateral?.obligor?.toLowerCase().includes(q) ||
      p.location?.name?.toLowerCase().includes(q) ||
      p.physicalRef?.toLowerCase().includes(q)
    );
  });

  // For the "unfiled collaterals" panel
  const filteredUnfiled = unfiledCollaterals.filter((c) => {
    const q = search.toLowerCase();
    return !q || c.description?.toLowerCase().includes(q) || c.obligor?.toLowerCase().includes(q);
  });

  // Selection helpers
  const allUnfiledSelected = filteredUnfiled.length > 0 && filteredUnfiled.every((c) => selectedIds.has(c.id));
  const someUnfiledSelected = filteredUnfiled.some((c) => selectedIds.has(c.id));

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (allUnfiledSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredUnfiled.map((c) => c.id)));
    }
  };

  const selectedCollaterals = unfiledCollaterals.filter((c) => selectedIds.has(c.id));

  // Clear selection when switching tabs
  const handleTabSwitch = (toAwaiting: boolean) => {
    setShowFiledOnly(toAwaiting);
    setSelectedIds(new Set());
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>
            Collateral Filing
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>
            Assign physical vault slots to collateral records
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}>
            <RefreshCw size={16} style={{ color: '#2563EB' }} />
          </button>
          <button onClick={() => { setEditPlacement(undefined); setShowModal(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: '#2563EB' }}>
            <Plus size={16} /> File Collateral
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Filed', value: placements.length, color: '#1D4ED8' },
          { label: 'Awaiting Filing', value: unfiledCollaterals.length, color: '#B45309' },
          { label: 'With Electronic Record', value: placements.filter((p) => p.electronicRecordUrl).length, color: '#15803D' },
          { label: 'With Physical Ref', value: placements.filter((p) => p.physicalRef).length, color: '#7E22CE' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl p-4" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#6B7280' }}>{s.label}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Toggle + Search */}
      <div className="flex gap-3 mb-4 flex-wrap items-center">
        <div className="relative flex-1 min-w-48">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
            placeholder="Search by collateral, owner, location…" />
        </div>
        <div className="flex rounded-xl overflow-hidden border" style={{ borderColor: '#DBEAFE' }}>
          <button onClick={() => handleTabSwitch(false)}
            className="px-3 py-2 text-xs font-medium transition-colors"
            style={{
              backgroundColor: !showFiledOnly ? '#2563EB' : '#F8FAFF',
              color: !showFiledOnly ? '#fff' : '#1D4ED8',
            }}>
            Filed ({placements.length})
          </button>
          <button onClick={() => handleTabSwitch(true)}
            className="px-3 py-2 text-xs font-medium transition-colors"
            style={{
              backgroundColor: showFiledOnly ? '#B45309' : '#F8FAFF',
              color: showFiledOnly ? '#fff' : '#B45309',
            }}>
            Awaiting ({unfiledCollaterals.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
        </div>
      ) : showFiledOnly ? (
        /* ── Awaiting Filing list with multi-select ── */
        filteredUnfiled.length === 0 ? (
          <div className="text-center py-16">
            <CheckCircle2 size={40} className="mx-auto mb-3" style={{ color: '#86EFAC' }} />
            <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>All collaterals have been filed!</p>
          </div>
        ) : (
          <div className="space-y-2">
            {/* Info banner */}
            <div className="flex items-center gap-2 mb-1 px-3 py-2 rounded-xl text-xs"
              style={{ backgroundColor: '#FFFBEB', border: '1px solid #FDE68A', color: '#B45309' }}>
              <AlertCircle size={13} />
              <span>These collaterals have not been assigned a physical vault location yet.</span>
            </div>

            {/* Bulk action toolbar */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl"
              style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <button
                  type="button"
                  onClick={toggleSelectAll}
                  className="flex items-center justify-center w-5 h-5 rounded transition-colors"
                  aria-label={allUnfiledSelected ? 'Deselect all' : 'Select all'}
                >
                  {allUnfiledSelected ? (
                    <CheckSquare size={18} style={{ color: '#2563EB' }} />
                  ) : someUnfiledSelected ? (
                    <CheckSquare size={18} style={{ color: '#93C5FD' }} />
                  ) : (
                    <Square size={18} style={{ color: '#9CA3AF' }} />
                  )}
                </button>
                <span className="text-xs font-medium" style={{ color: '#374151' }}>
                  {selectedIds.size > 0
                    ? `${selectedIds.size} of ${filteredUnfiled.length} selected`
                    : 'Select all'}
                </span>
              </label>

              {selectedIds.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-xs" style={{ color: '#6B7280' }}>
                    {selectedIds.size} collateral{selectedIds.size !== 1 ? 's' : ''} selected
                  </span>
                  <button
                    onClick={() => setShowBulkModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white"
                    style={{ backgroundColor: '#2563EB' }}>
                    <Layers size={13} /> Bulk File to Slot
                  </button>
                  <button
                    onClick={() => setSelectedIds(new Set())}
                    className="p-1.5 rounded-lg text-xs"
                    style={{ color: '#6B7280' }}
                    title="Clear selection">
                    <X size={13} />
                  </button>
                </div>
              )}
            </div>

            {/* Collateral rows */}
            {filteredUnfiled.map((c) => {
              const isSelected = selectedIds.has(c.id);
              return (
                <div key={c.id}
                  className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all"
                  style={{
                    backgroundColor: isSelected ? '#EFF6FF' : '#FFFBEB',
                    border: `1px solid ${isSelected ? '#93C5FD' : '#FDE68A'}`,
                  }}
                  onClick={() => toggleSelect(c.id)}>
                  {/* Checkbox */}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleSelect(c.id); }}
                    className="flex items-center justify-center w-5 h-5 shrink-0 rounded transition-colors"
                    aria-label={isSelected ? 'Deselect' : 'Select'}>
                    {isSelected
                      ? <CheckSquare size={18} style={{ color: '#2563EB' }} />
                      : <Square size={18} style={{ color: '#9CA3AF' }} />
                    }
                  </button>

                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: isSelected ? '#DBEAFE' : '#FEF3C7' }}>
                    <Package size={16} style={{ color: isSelected ? '#1D4ED8' : '#B45309' }} />
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate"
                      style={{ color: isSelected ? '#1E3A8A' : '#92400E' }}>
                      {c.type} — {c.obligor}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: isSelected ? '#3B82F6' : '#B45309' }}>
                      {c.description}
                    </p>
                  </div>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditPlacement(undefined);
                      setShowModal(true);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                    style={{ backgroundColor: '#2563EB', color: '#fff' }}>
                    <Plus size={12} /> File Now
                  </button>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Filed placements list ── */
        filtered.length === 0 ? (
          <div className="text-center py-16">
            <FolderCheck size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
            <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No filings found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map((p) => (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-xl group transition-all"
                style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ backgroundColor: '#DBEAFE' }}>
                  <Package size={18} style={{ color: '#1D4ED8' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: '#1E3A8A' }}>
                    {p.collateral?.collateral_type ?? 'Unknown'} — {p.collateral?.obligor ?? '—'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                      📂 {p.location?.name ?? '—'} ({p.location?.code ?? '—'})
                    </span>
                    {p.physicalRef && (
                      <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                        style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                        {p.physicalRef}
                      </span>
                    )}
                    {p.electronicRecordUrl && (
                      <a href={p.electronicRecordUrl} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs hover:underline" style={{ color: '#15803D' }}>
                        <Paperclip size={11} /> Document attached
                      </a>
                    )}
                  </div>
                </div>
                <button onClick={() => { setEditPlacement(p); setShowModal(true); }}
                  className="opacity-0 group-hover:opacity-100 p-2 rounded-lg transition-all hover:bg-blue-100">
                  <Edit2 size={14} style={{ color: '#2563EB' }} />
                </button>
              </div>
            ))}
          </div>
        )
      )}

      {/* Single file modal */}
      {showModal && (
        <AssignModal
          collaterals={showFiledOnly ? unfiledCollaterals : collaterals}
          locations={locations}
          existing={editPlacement}
          userId={user?.id ?? ''}
          onClose={() => setShowModal(false)}
          onSaved={() => { setShowModal(false); load(); }}
        />
      )}

      {/* Bulk move modal */}
      {showBulkModal && (
        <BulkMoveModal
          selected={selectedCollaterals}
          locations={locations}
          userId={user?.id ?? ''}
          onClose={() => setShowBulkModal(false)}
          onSaved={() => { setShowBulkModal(false); load(); }}
        />
      )}
    </div>
  );
}
