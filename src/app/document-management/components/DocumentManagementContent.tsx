'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Upload, Search, FileText, Trash2, Download, ChevronDown, X, RefreshCw, FolderOpen, Clock, AlertCircle, GitBranch, Link2, Plus, Tag,  } from 'lucide-react';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import DocumentVersionHistoryModal from '@/components/DocumentVersionHistoryModal';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DocumentWithCollateral extends CollateralDocument {
  collateralObligor?: string;
  collateralType?: string;
  collateralIdLabel?: string;
}

interface UploadModalState {
  open: boolean;
  collateralRecordId: string;
  collateralId: string;
  collateralLabel: string;
}

const DOCUMENT_TYPES: DocumentType[] = [
  'Title Deed',
  'Charge Certificate',
  'Valuation Report',
  'BRELA Confirmation',
  'Insurance Certificate',
  'Board Resolution',
  'Other',
];

const DOC_TYPE_META: Record<DocumentType, { color: string; bg: string }> = {
  'Title Deed':           { color: 'text-blue-700',   bg: 'bg-blue-50' },
  'Charge Certificate':   { color: 'text-purple-700', bg: 'bg-purple-50' },
  'Valuation Report':     { color: 'text-amber-700',  bg: 'bg-amber-50' },
  'BRELA Confirmation':   { color: 'text-emerald-700',bg: 'bg-emerald-50' },
  'Insurance Certificate':{ color: 'text-cyan-700',   bg: 'bg-cyan-50' },
  'Board Resolution':     { color: 'text-rose-700',   bg: 'bg-rose-50' },
  'Other':                { color: 'text-slate-600',  bg: 'bg-slate-100' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getFileIcon(mimeType: string): string {
  if (mimeType?.includes('pdf')) return '📄';
  if (mimeType?.includes('image')) return '🖼️';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return '📝';
  return '📎';
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  state: UploadModalState;
  onClose: () => void;
  onUploaded: () => void;
  userId: string;
  userName: string;
}

function UploadModal({ state, onClose, onUploaded, userId, userName }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('Other');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    if (!allowed.includes(file.type)) {
      setError('Unsupported file type. Allowed: PDF, JPEG, PNG, WEBP, DOC, DOCX');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError('File exceeds 10 MB limit.');
      return;
    }
    setError('');
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile) { setError('Please select a file.'); return; }
    setUploading(true);
    setError('');
    const result = await documentService.upload(
      selectedFile,
      state.collateralRecordId,
      state.collateralId,
      docType,
      notes,
      userId,
      userName,
    );
    setUploading(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    onUploaded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-600 text-foreground">Upload Document</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Linked to: <span className="font-500 text-foreground">{state.collateralLabel}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Drop zone */}
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                <span className="text-2xl">{getFileIcon(selectedFile.type)}</span>
                <div className="text-left">
                  <p className="text-sm font-500 text-foreground truncate max-w-[260px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{documentService.formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }}
                  className="ml-auto p-1 rounded hover:bg-muted"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-500 text-foreground">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG, WEBP, DOC, DOCX · Max 10 MB</p>
              </>
            )}
          </div>

          {/* Document type */}
          <div>
            <label className="block text-xs font-500 text-foreground mb-1.5">Document Type</label>
            <div className="relative">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              >
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-500 text-foreground mb-1.5">Notes <span className="text-muted-foreground font-400">(optional)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add context or version notes…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 px-4 py-2 text-sm font-500 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Version History Modal ────────────────────────────────────────────────────

interface VersionHistoryModalProps {
  docs: DocumentWithCollateral[];
  fileName: string;
  onClose: () => void;
  onDownload: (doc: CollateralDocument) => void;
}

function VersionHistoryModal({ docs, fileName, onClose, onDownload }: VersionHistoryModalProps) {
  const sorted = [...docs].sort((a, b) => b.version - a.version);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-600 text-foreground">Version History</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[320px]">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-4 space-y-3 max-h-[400px] overflow-y-auto">
          {sorted.map((doc, idx) => (
            <div key={doc.id} className={`flex items-start gap-3 p-3 rounded-lg border ${idx === 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}>
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 shrink-0 ${idx === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                v{doc.version}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-500 text-foreground">{formatDate(doc.createdAt)}</span>
                  {idx === 0 && <span className="text-[10px] font-600 bg-primary/10 text-primary px-1.5 py-0.5 rounded-full">Latest</span>}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  By <span className="font-500 text-foreground">{doc.uploadedByName || 'Unknown'}</span>
                  {' · '}{documentService.formatFileSize(doc.fileSize)}
                </p>
                {doc.notes && <p className="text-xs text-muted-foreground mt-1 italic">"{doc.notes}"</p>}
              </div>
              {doc.signedUrl && (
                <button
                  onClick={() => onDownload(doc)}
                  className="p-1.5 rounded-md hover:bg-muted transition-colors shrink-0"
                  title="Download this version"
                >
                  <Download size={14} className="text-muted-foreground" />
                </button>
              )}
            </div>
          ))}
        </div>
        <div className="px-6 py-4 border-t border-border flex justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function DocumentManagementContent() {
  const { user, userProfile } = useAuth();
  const { hasPermission } = usePermissions();
  const canDelete = hasPermission(PERMISSIONS.COLLATERAL_DELETE) || hasPermission(PERMISSIONS.COLLATERAL_EDIT);

  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [allDocs, setAllDocs] = useState<DocumentWithCollateral[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('');
  const [filterCollateral, setFilterCollateral] = useState<string>('');

  // Modals
  const [uploadModal, setUploadModal] = useState<UploadModalState>({
    open: false, collateralRecordId: '', collateralId: '', collateralLabel: '',
  });
  const [versionModal, setVersionModal] = useState<{ open: boolean; fileName: string; docs: DocumentWithCollateral[] }>({
    open: false, fileName: '', docs: [],
  });
  const [linkPickerOpen, setLinkPickerOpen] = useState(false);
  const [selectedCollateralForUpload, setSelectedCollateralForUpload] = useState<CollateralRecord | null>(null);

  // ── Load data ──────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const cols = await collateralService.getAll();
      setCollaterals(cols);

      // Fetch documents for all collaterals in parallel (batched)
      const docArrays = await Promise.all(
        cols.map((c) => documentService.getByCollateralId(c.id))
      );

      const enriched: DocumentWithCollateral[] = docArrays.flatMap((docs, idx) =>
        docs.map((d) => ({
          ...d,
          collateralObligor: cols[idx]?.obligor,
          collateralType: cols[idx]?.type,
          collateralIdLabel: cols[idx]?.collateralId,
        }))
      );

      // Sort by newest first
      enriched.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setAllDocs(enriched);
    } catch {
      // silently handle
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Derived data ───────────────────────────────────────────────────────────

  const filtered = allDocs.filter((d) => {
    const matchSearch =
      !search ||
      d.fileName.toLowerCase().includes(search.toLowerCase()) ||
      d.collateralObligor?.toLowerCase().includes(search.toLowerCase()) ||
      d.collateralIdLabel?.toLowerCase().includes(search.toLowerCase()) ||
      d.documentType.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || d.documentType === filterType;
    const matchCollateral = !filterCollateral || d.collateralRecordId === filterCollateral;
    return matchSearch && matchType && matchCollateral;
  });

  // Group by base file name for version grouping
  const versionGroups = filtered.reduce<Record<string, DocumentWithCollateral[]>>((acc, doc) => {
    const key = `${doc.collateralRecordId}::${doc.fileName}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  // Show only latest version per group in the table
  const latestDocs = Object.values(versionGroups).map((group) =>
    group.reduce((latest, d) => (d.version > latest.version ? d : latest))
  );

  // Stats
  const totalDocs = allDocs.length;
  const uniqueCollaterals = new Set(allDocs.map((d) => d.collateralRecordId)).size;
  const versioned = allDocs.filter((d) => d.version > 1).length;
  const brela = allDocs.filter((d) => d.documentType === 'BRELA Confirmation').length;

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleDownload = (doc: CollateralDocument) => {
    if (doc.signedUrl) window.open(doc.signedUrl, '_blank');
  };

  const handleDelete = async (doc: DocumentWithCollateral) => {
    if (!confirm(`Delete "${doc.fileName}" (v${doc.version})? This cannot be undone.`)) return;
    await documentService.delete(doc);
    loadData(true);
  };

  const openVersionHistory = (fileName: string, docs: DocumentWithCollateral[]) => {
    setVersionModal({ open: true, fileName, docs });
  };

  const openUploadForCollateral = (col: CollateralRecord) => {
    setUploadModal({
      open: true,
      collateralRecordId: col.id,
      collateralId: col.collateralId,
      collateralLabel: `${col.collateralId} — ${col.obligor}`,
    });
    setLinkPickerOpen(false);
    setSelectedCollateralForUpload(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Purpose banner */}
      <div className="px-6 pt-4 bg-white shrink-0">
        <div className="flex items-start gap-3 p-3 rounded-xl mb-0"
          style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}>
          <span className="text-base shrink-0">⚙️</span>
          <div>
            <p className="text-xs font-semibold" style={{ color: '#15803D' }}>Document Management — Upload &amp; Manage</p>
            <p className="text-xs mt-0.5" style={{ color: '#166534' }}>
              Use this page to <strong>upload, classify, version-control, and link</strong> supporting documents to collateral records.
              To <strong>browse and download</strong> the full document archive, go to{' '}
              <a href="/archive/documents-library" className="underline font-medium">Documents Library</a>.
            </p>
          </div>
        </div>
      </div>
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-foreground">Document Management</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Upload, link, and version-control collateral supporting documents
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
              title="Refresh"
            >
              <RefreshCw size={15} className={`text-muted-foreground ${refreshing ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setLinkPickerOpen(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-500 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus size={15} />
              Upload Document
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div className="grid grid-cols-4 gap-3 mt-5">
          {[
            { label: 'Total Documents', value: totalDocs, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Linked Collaterals', value: uniqueCollaterals, icon: Link2, color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Versioned Files', value: versioned, icon: GitBranch, color: 'text-purple-600', bg: 'bg-purple-50' },
            { label: 'BRELA Receipts', value: brela, icon: Tag, color: 'text-amber-600', bg: 'bg-amber-50' },
          ].map((kpi) => (
            <div key={kpi.label} className="flex items-center gap-3 bg-white border border-border rounded-xl px-4 py-3">
              <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <kpi.icon size={17} className={kpi.color} />
              </div>
              <div>
                <p className="text-lg font-700 text-foreground leading-tight">{loading ? '—' : kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters bar */}
      <div className="px-6 py-3 border-b border-border bg-white shrink-0 flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search documents, obligors…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
        </div>

        <div className="relative">
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
            className="appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-7"
          >
            <option value="">All Types</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        <div className="relative">
          <select
            value={filterCollateral}
            onChange={(e) => setFilterCollateral(e.target.value)}
            className="appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-7 max-w-[200px]"
          >
            <option value="">All Collaterals</option>
            {collaterals.map((c) => (
              <option key={c.id} value={c.id}>{c.collateralId} — {c.obligor}</option>
            ))}
          </select>
          <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {(search || filterType || filterCollateral) && (
          <button
            onClick={() => { setSearch(''); setFilterType(''); setFilterCollateral(''); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={13} /> Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${latestDocs.length} document${latestDocs.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto px-6 py-4">
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted/40 rounded-lg animate-pulse" />
            ))}
          </div>
        ) : latestDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-600 text-foreground mb-1">No documents found</h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search || filterType || filterCollateral
                ? 'Try adjusting your filters.' :'Upload your first document to get started.'}
            </p>
            {!search && !filterType && !filterCollateral && (
              <button
                onClick={() => setLinkPickerOpen(true)}
                className="mt-4 flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-500 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Upload size={14} /> Upload Document
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Document</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Linked Collateral</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Version</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Uploaded</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Size</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {latestDocs.map((doc) => {
                  const meta = DOC_TYPE_META[doc.documentType] ?? DOC_TYPE_META['Other'];
                  const groupKey = `${doc.collateralRecordId}::${doc.fileName}`;
                  const versions = versionGroups[groupKey] ?? [doc];
                  const hasVersions = versions.length > 1;

                  return (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                      {/* Document name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <span className="text-lg leading-none">{getFileIcon(doc.mimeType)}</span>
                          <div className="min-w-0">
                            <p className="font-500 text-foreground truncate max-w-[200px]">{doc.fileName}</p>
                            {doc.notes && (
                              <p className="text-xs text-muted-foreground truncate max-w-[200px] italic">{doc.notes}</p>
                            )}
                          </div>
                        </div>
                      </td>

                      {/* Type badge */}
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs font-500 px-2 py-0.5 rounded-full ${meta.bg} ${meta.color}`}>
                          {doc.documentType}
                        </span>
                      </td>

                      {/* Linked collateral */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Link2 size={12} className="text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs font-500 text-foreground">{doc.collateralIdLabel || '—'}</p>
                            <p className="text-xs text-muted-foreground">{doc.collateralObligor || '—'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Version */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-600 text-foreground">v{doc.version}</span>
                          {hasVersions && (
                            <button
                              onClick={() => openVersionHistory(doc.fileName, versions)}
                              className="flex items-center gap-1 text-xs text-primary hover:underline"
                            >
                              <GitBranch size={11} />
                              {versions.length} versions
                            </button>
                          )}
                        </div>
                      </td>

                      {/* Uploaded */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} className="text-muted-foreground shrink-0" />
                          <div>
                            <p className="text-xs text-foreground">{formatDate(doc.createdAt)}</p>
                            <p className="text-xs text-muted-foreground">{doc.uploadedByName || 'Unknown'}</p>
                          </div>
                        </div>
                      </td>

                      {/* Size */}
                      <td className="px-4 py-3">
                        <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                      </td>

                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          {doc.signedUrl && (
                            <button
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors"
                              title="Download"
                            >
                              <Download size={14} className="text-muted-foreground" />
                            </button>
                          )}
                          <button
                            onClick={() => openUploadForCollateral(
                              collaterals.find((c) => c.id === doc.collateralRecordId) ?? collaterals[0]
                            )}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Upload new version"
                          >
                            <Upload size={14} className="text-muted-foreground" />
                          </button>
                          {canDelete && (
                            <button
                              onClick={() => handleDelete(doc)}
                              className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} className="text-red-500" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Link Picker — choose collateral before upload */}
      {linkPickerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
            <div className="flex items-center justify-between px-6 py-4 border-b border-border">
              <div>
                <h2 className="text-base font-600 text-foreground">Link to Collateral</h2>
                <p className="text-xs text-muted-foreground mt-0.5">Select the collateral record this document belongs to</p>
              </div>
              <button onClick={() => setLinkPickerOpen(false)} className="p-1.5 rounded-md hover:bg-muted transition-colors">
                <X size={16} className="text-muted-foreground" />
              </button>
            </div>
            <div className="px-6 py-4 max-h-[360px] overflow-y-auto space-y-2">
              {collaterals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">No collateral records found.</p>
              ) : (
                collaterals.map((col) => (
                  <button
                    key={col.id}
                    onClick={() => openUploadForCollateral(col)}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-lg border border-border hover:border-primary/40 hover:bg-primary/5 transition-colors text-left"
                  >
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <FolderOpen size={15} className="text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-500 text-foreground">{col.collateralId}</p>
                      <p className="text-xs text-muted-foreground truncate">{col.obligor} · {col.type}</p>
                    </div>
                    <span className={`ml-auto text-xs font-500 px-2 py-0.5 rounded-full shrink-0 ${
                      col.status === 'Perfected' ? 'bg-emerald-50 text-emerald-700' :
                      col.status === 'Overdue'? 'bg-red-50 text-red-700' : 'bg-muted text-muted-foreground'
                    }`}>
                      {col.status}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Upload Modal */}
      {uploadModal.open && (
        <UploadModal
          state={uploadModal}
          onClose={() => setUploadModal((s) => ({ ...s, open: false }))}
          onUploaded={() => loadData(true)}
          userId={user?.id ?? ''}
          userName={userProfile?.full_name ?? user?.email ?? 'Unknown'}
        />
      )}

      {/* Version History Modal */}
      {versionModal.open && (
        <DocumentVersionHistoryModal
          docs={versionModal.docs}
          fileName={versionModal.fileName}
          collateralRecordId={versionModal.docs[0]?.collateralRecordId ?? ''}
          currentVersion={Math.max(...versionModal.docs.map((d) => d.version))}
          onClose={() => setVersionModal((s) => ({ ...s, open: false }))}
          onDownload={handleDownload}
          onRollbackComplete={() => loadData(true)}
          userId={user?.id ?? ''}
          userName={userProfile?.full_name ?? user?.email ?? 'Unknown'}
          canRollback={canDelete}
        />
      )}
    </div>
  );
}
