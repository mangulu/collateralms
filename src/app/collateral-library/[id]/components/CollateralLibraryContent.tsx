'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Upload, Search, FileText, Trash2, Download, X, RefreshCw, AlertCircle, GitBranch, Filter, FileImage, FileType2, File, Clock, ChevronDown, Tag, History, Plus, CheckCircle2, Circle,  } from 'lucide-react';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { createClient } from '@/lib/supabase/client';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';

// ─── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES: DocumentType[] = [
  'Title Deed', 'Charge Certificate', 'Valuation Report',
  'BRELA Confirmation', 'Insurance Certificate', 'Board Resolution', 'Other',
];

const WORKFLOW_STAGES = [
  { value: '', label: 'Not Linked' },
  { value: 'security_document_executed', label: 'Security Document Executed' },
  { value: 'collateral_registered', label: 'Collateral Registered in CMS' },
  { value: 'legal_review', label: 'Legal Review & Approval' },
  { value: 'registry_submission', label: 'Registry Submission Filed' },
  { value: 'registry_confirmation', label: 'Registry Confirmation Received' },
  { value: 'perfection_confirmed', label: 'Perfection Confirmed' },
];

const DOC_TYPE_META: Record<DocumentType, { color: string; bg: string; border: string }> = {
  'Title Deed':            { color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200' },
  'Charge Certificate':    { color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200' },
  'Valuation Report':      { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200' },
  'BRELA Confirmation':    { color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  'Insurance Certificate': { color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200' },
  'Board Resolution':      { color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200' },
  'Other':                 { color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-200' },
};

const STAGE_META: Record<string, { color: string; bg: string }> = {
  security_document_executed: { color: 'text-blue-700',    bg: 'bg-blue-50' },
  collateral_registered:      { color: 'text-indigo-700',  bg: 'bg-indigo-50' },
  legal_review:               { color: 'text-violet-700',  bg: 'bg-violet-50' },
  registry_submission:        { color: 'text-amber-700',   bg: 'bg-amber-50' },
  registry_confirmation:      { color: 'text-teal-700',    bg: 'bg-teal-50' },
  perfection_confirmed:       { color: 'text-emerald-700', bg: 'bg-emerald-50' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={16} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={16} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={16} className="text-indigo-500" />;
  return <FileText size={16} className="text-slate-500" />;
}

function getStageLabel(value: string): string {
  return WORKFLOW_STAGES.find((s) => s.value === value)?.label ?? 'Not Linked';
}

// ─── Extended Document type with workflow_stage ───────────────────────────────

interface LibraryDocument extends CollateralDocument {
  workflowStage?: string;
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  collateral: CollateralRecord;
  existingDoc?: LibraryDocument | null;
  onClose: () => void;
  onUploaded: () => void;
  userId: string;
  userName: string;
}

function UploadModal({ collateral, existingDoc, onClose, onUploaded, userId, userName }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>(existingDoc?.documentType ?? 'Other');
  const [notes, setNotes] = useState('');
  const [workflowStage, setWorkflowStage] = useState(existingDoc?.workflowStage ?? '');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const ALLOWED_TYPES = [
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  const handleFile = (file: File) => {
    if (!ALLOWED_TYPES.includes(file.type)) {
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
    try {
      const result = await documentService.upload(
        selectedFile,
        collateral.id,
        collateral.collateralId,
        existingDoc ? existingDoc.documentType : docType,
        notes,
        userId,
        userName,
      );
      if (!result) { setError('Upload failed. Please try again.'); setUploading(false); return; }

      // Update workflow_stage if set
      if (workflowStage !== undefined) {
        const supabase = createClient();
        await supabase
          .from('collateral_documents')
          .update({ workflow_stage: workflowStage || null })
          .eq('id', result.id);
      }
      onUploaded();
      onClose();
    } catch {
      setError('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const isNewVersion = !!existingDoc;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">
              {isNewVersion ? 'Upload New Version' : 'Upload Document'}
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isNewVersion
                ? <>Replacing: <span className="font-medium text-foreground">{existingDoc!.fileName}</span> <span className="text-primary">v{existingDoc!.version} → v{existingDoc!.version + 1}</span></>
                : <>Linked to: <span className="font-medium text-foreground">{collateral.collateralId} — {collateral.obligor}</span></>
              }
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
                {getFileIcon(selectedFile.type)}
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground truncate max-w-[260px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{documentService.formatFileSize(selectedFile.size)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); }} className="ml-auto p-1 rounded hover:bg-muted">
                  <X size={14} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">
                  {isNewVersion ? 'Drop new version here or click to browse' : 'Drop file here or click to browse'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG, WEBP, DOC, DOCX · Max 10 MB</p>
              </>
            )}
          </div>

          {/* Document type */}
          {isNewVersion ? (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
              <div className="w-full border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground bg-muted/30">
                {existingDoc!.documentType}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
              <div className="relative">
                <select
                  value={docType}
                  onChange={(e) => setDocType(e.target.value as DocumentType)}
                  className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
                >
                  {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
                <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
            </div>
          )}

          {/* Workflow stage */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Link to Workflow Stage <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <div className="relative">
              <select
                value={workflowStage}
                onChange={(e) => setWorkflowStage(e.target.value)}
                className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              >
                {WORKFLOW_STAGES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              {isNewVersion ? 'Version Notes' : 'Notes'} <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder={isNewVersion ? 'Describe what changed in this version…' : 'Add context or version notes…'}
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : isNewVersion ? 'Upload New Version' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Version History Modal ────────────────────────────────────────────────────

interface VersionHistoryModalProps {
  docs: LibraryDocument[];
  fileName: string;
  onClose: () => void;
  onDownload: (doc: LibraryDocument) => void;
}

function VersionHistoryModal({ docs, fileName, onClose, onDownload }: VersionHistoryModalProps) {
  const sorted = [...docs].sort((a, b) => b.version - a.version);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Version History</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[320px]">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-4 max-h-[420px] overflow-y-auto space-y-3">
          {sorted.map((doc, idx) => (
            <div
              key={doc.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${idx === 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${idx === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                v{doc.version}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium text-foreground">{formatDateTime(doc.createdAt)}</span>
                  {idx === 0 && (
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">Latest</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uploaded by <span className="font-medium text-foreground">{doc.uploadedByName || 'Unknown'}</span>
                </p>
                {doc.workflowStage && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Stage: <span className="font-medium text-foreground">{getStageLabel(doc.workflowStage)}</span>
                  </p>
                )}
                {doc.notes && (
                  <p className="text-xs text-muted-foreground mt-1 italic">"{doc.notes}"</p>
                )}
                <p className="text-xs text-muted-foreground mt-0.5">{documentService.formatFileSize(doc.fileSize)}</p>
              </div>
              <button
                onClick={() => onDownload(doc)}
                className="flex-shrink-0 p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Download this version"
              >
                <Download size={14} className="text-muted-foreground" />
              </button>
            </div>
          ))}
        </div>
        <div className="flex justify-end px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm Modal ─────────────────────────────────────────────────────

interface DeleteConfirmProps {
  doc: LibraryDocument;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}

function DeleteConfirmModal({ doc, onConfirm, onCancel, deleting }: DeleteConfirmProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="px-6 py-5">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center mb-3">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <h3 className="text-base font-semibold text-foreground mb-1">Delete Document</h3>
          <p className="text-sm text-muted-foreground">
            Are you sure you want to delete <span className="font-medium text-foreground">{doc.fileName}</span> (v{doc.version})? This action cannot be undone.
          </p>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onCancel} disabled={deleting} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors disabled:opacity-50">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {deleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Workflow Stage Overview ──────────────────────────────────────────────────

interface StageOverviewProps {
  docs: LibraryDocument[];
}

function StageOverview({ docs }: StageOverviewProps) {
  const stagesWithDocs = WORKFLOW_STAGES.filter((s) => s.value !== '');
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-5 mb-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <GitBranch size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-semibold text-foreground uppercase tracking-wider">Perfection Workflow Coverage</h2>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {stagesWithDocs.map((stage) => {
          const count = docs.filter((d) => d.workflowStage === stage.value).length;
          const meta = STAGE_META[stage.value] ?? { color: 'text-slate-600', bg: 'bg-slate-50' };
          return (
            <div
              key={stage.value}
              className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${count > 0 ? 'border-border' : 'border-dashed border-border/60'} ${count > 0 ? meta.bg : 'bg-muted/20'}`}
            >
              {count > 0
                ? <CheckCircle2 size={14} className={meta.color} />
                : <Circle size={14} className="text-muted-foreground/40" />
              }
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${count > 0 ? meta.color : 'text-muted-foreground'}`}>
                  {stage.label}
                </p>
                <p className="text-[10px] text-muted-foreground">{count} doc{count !== 1 ? 's' : ''}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

interface CollateralLibraryContentProps {
  collateral: CollateralRecord | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
}

export default function CollateralLibraryContent({ collateral, isLoading, error, onBack }: CollateralLibraryContentProps) {
  const { user } = useAuth();
  const { hasPermission } = usePermissions();
  const canEdit = hasPermission(PERMISSIONS.COLLATERAL_EDIT);

  const [docs, setDocs] = useState<LibraryDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<DocumentType | ''>('');
  const [filterStage, setFilterStage] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [versionTarget, setVersionTarget] = useState<LibraryDocument | null>(null);
  const [versionHistoryDoc, setVersionHistoryDoc] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LibraryDocument | null>(null);
  const [deleting, setDeleting] = useState(false);

  const loadDocs = useCallback(async () => {
    if (!collateral) return;
    setDocsLoading(true);
    try {
      const supabase = createClient();
      const { data } = await supabase
        .from('collateral_documents')
        .select('*')
        .eq('collateral_record_id', collateral.id)
        .order('created_at', { ascending: false });

      const rawDocs = data ?? [];

      // Generate signed URLs
      const withUrls: LibraryDocument[] = await Promise.all(
        rawDocs.map(async (row: any) => {
          let signedUrl: string | undefined;
          try {
            const { data: urlData } = await supabase.storage
              .from('collateral-documents')
              .createSignedUrl(row.file_path, 3600);
            signedUrl = urlData?.signedUrl;
          } catch { /* ignore */ }
          return {
            id: row.id,
            collateralRecordId: row.collateral_record_id,
            collateralId: row.collateral_id,
            fileName: row.file_name,
            filePath: row.file_path,
            fileSize: row.file_size,
            mimeType: row.mime_type,
            documentType: row.document_type as DocumentType,
            version: row.version,
            notes: row.notes ?? '',
            uploadedBy: row.uploaded_by,
            uploadedByName: row.uploaded_by_name ?? '',
            createdAt: row.created_at,
            workflowStage: row.workflow_stage ?? '',
            signedUrl,
          };
        })
      );
      setDocs(withUrls);
    } catch {
      setDocs([]);
    } finally {
      setDocsLoading(false);
    }
  }, [collateral]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDownload = (doc: LibraryDocument) => {
    if (doc.signedUrl) window.open(doc.signedUrl, '_blank');
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const ok = await documentService.delete(deleteTarget);
    setDeleting(false);
    if (ok) { setDeleteTarget(null); loadDocs(); }
  };

  // Group docs by file name for version tracking
  const docGroups = docs.reduce<Record<string, LibraryDocument[]>>((acc, doc) => {
    const key = `${doc.documentType}::${doc.fileName.replace(/_v\d+_/, '_')}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  // Latest version per group
  const latestDocs = Object.values(docGroups).map((group) =>
    group.reduce((latest, doc) => (doc.version > latest.version ? doc : latest))
  );

  // Filter
  const filtered = latestDocs.filter((doc) => {
    const matchSearch = !search || doc.fileName.toLowerCase().includes(search.toLowerCase()) || doc.documentType.toLowerCase().includes(search.toLowerCase());
    const matchType = !filterType || doc.documentType === filterType;
    const matchStage = !filterStage || doc.workflowStage === filterStage;
    return matchSearch && matchType && matchStage;
  });

  const userName = user?.email ?? 'Unknown';
  const userId = user?.id ?? '';

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <div className="h-8 bg-muted rounded-lg animate-pulse w-64" />
        <div className="h-32 bg-muted rounded-xl animate-pulse" />
        <div className="h-64 bg-muted rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !collateral) {
    return (
      <div className="p-6">
        <button onClick={onBack} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors">
          <ArrowLeft size={16} /> Back to Collateral Registry
        </button>
        <div className="flex flex-col items-center justify-center min-h-[40vh] text-center">
          <AlertCircle size={32} className="text-red-400 mb-3" />
          <p className="text-sm text-foreground font-medium">{error ?? 'Collateral not found'}</p>
        </div>
      </div>
    );
  }

  const versionHistoryDocs = versionHistoryDoc
    ? Object.values(docGroups).find((g) => g.some((d) => d.id === versionHistoryDoc)) ?? []
    : [];

  return (
    <div className="p-5 space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft size={14} /> Back to Collateral Registry
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText size={18} className="text-primary" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-foreground">Document Library</h1>
              <p className="text-sm text-muted-foreground">
                {collateral.collateralId} · {collateral.obligor} · {collateral.type}
              </p>
            </div>
          </div>
        </div>
        {canEdit && (
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus size={15} /> Upload Document
          </button>
        )}
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Documents', value: docs.length, icon: FileText, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Document Types', value: new Set(docs.map((d) => d.documentType)).size, icon: Tag, color: 'text-violet-600', bg: 'bg-violet-50' },
          { label: 'Workflow Linked', value: docs.filter((d) => d.workflowStage).length, icon: GitBranch, color: 'text-emerald-600', bg: 'bg-emerald-50' },
          { label: 'Latest Upload', value: docs.length > 0 ? formatDateTime(docs[0].createdAt).split(',')[0] : '—', icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-border shadow-sm p-4 flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className="text-base font-semibold text-foreground">{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Workflow stage coverage */}
      <StageOverview docs={docs} />

      {/* Filters */}
      <div className="bg-white rounded-xl border border-border shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[180px]">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search documents…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="relative">
            <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as DocumentType | '')}
              className="pl-7 pr-7 py-2 text-sm border border-border rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Types</option>
              {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <GitBranch size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <select
              value={filterStage}
              onChange={(e) => setFilterStage(e.target.value)}
              className="pl-7 pr-7 py-2 text-sm border border-border rounded-lg bg-white appearance-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">All Stages</option>
              {WORKFLOW_STAGES.filter((s) => s.value).map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          {(search || filterType || filterStage) && (
            <button
              onClick={() => { setSearch(''); setFilterType(''); setFilterStage(''); }}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={13} /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Document table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {docsLoading ? (
          <div className="p-8 text-center">
            <RefreshCw size={20} className="animate-spin text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">Loading documents…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto mb-3">
              <FileText size={20} className="text-muted-foreground" />
            </div>
            <p className="text-sm font-medium text-foreground mb-1">
              {docs.length === 0 ? 'No documents uploaded yet' : 'No documents match your filters'}
            </p>
            <p className="text-xs text-muted-foreground">
              {docs.length === 0 && canEdit ? 'Click "Upload Document" to add the first document.' : 'Try adjusting your search or filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Document</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Workflow Stage</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Version</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Uploaded</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wide">Notes</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((doc) => {
                  const meta = DOC_TYPE_META[doc.documentType] ?? DOC_TYPE_META['Other'];
                  const stageMeta = doc.workflowStage ? (STAGE_META[doc.workflowStage] ?? { color: 'text-slate-600', bg: 'bg-slate-50' }) : null;
                  const groupKey = `${doc.documentType}::${doc.fileName.replace(/_v\d+_/, '_')}`;
                  const versionCount = docGroups[groupKey]?.length ?? 1;
                  return (
                    <tr key={doc.id} className="hover:bg-muted/20 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          {getFileIcon(doc.mimeType)}
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-foreground truncate max-w-[200px]">{doc.fileName}</p>
                            <p className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${meta.bg} ${meta.color} ${meta.border}`}>
                          {doc.documentType}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {doc.workflowStage && stageMeta ? (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${stageMeta.bg} ${stageMeta.color}`}>
                            <GitBranch size={10} />
                            {getStageLabel(doc.workflowStage)}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
                            v{doc.version}
                          </span>
                          {versionCount > 1 && (
                            <button
                              onClick={() => setVersionHistoryDoc(doc.id)}
                              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
                              title="View all versions"
                            >
                              <History size={12} />
                              <span>{versionCount}</span>
                            </button>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="text-xs font-medium text-foreground">{doc.uploadedByName || 'Unknown'}</p>
                          <p className="text-xs text-muted-foreground flex items-center gap-1">
                            <Clock size={10} /> {formatDateTime(doc.createdAt)}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {doc.notes ? (
                          <p className="text-xs text-muted-foreground truncate max-w-[140px]" title={doc.notes}>{doc.notes}</p>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleDownload(doc)}
                            className="p-1.5 rounded-md hover:bg-muted transition-colors"
                            title="Download"
                          >
                            <Download size={14} className="text-muted-foreground" />
                          </button>
                          {versionCount > 1 && (
                            <button
                              onClick={() => setVersionHistoryDoc(doc.id)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors"
                              title="Version history"
                            >
                              <History size={14} className="text-muted-foreground" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => setVersionTarget(doc)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors"
                              title="Upload new version"
                            >
                              <Upload size={14} className="text-muted-foreground" />
                            </button>
                          )}
                          {canEdit && (
                            <button
                              onClick={() => setDeleteTarget(doc)}
                              className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                              title="Delete"
                            >
                              <Trash2 size={14} className="text-red-400" />
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

      {/* Modals */}
      {showUpload && (
        <UploadModal
          collateral={collateral}
          onClose={() => setShowUpload(false)}
          onUploaded={loadDocs}
          userId={userId}
          userName={userName}
        />
      )}
      {versionTarget && (
        <UploadModal
          collateral={collateral}
          existingDoc={versionTarget}
          onClose={() => setVersionTarget(null)}
          onUploaded={loadDocs}
          userId={userId}
          userName={userName}
        />
      )}
      {versionHistoryDoc && (
        <VersionHistoryModal
          docs={versionHistoryDocs}
          fileName={versionHistoryDocs[0]?.fileName ?? ''}
          onClose={() => setVersionHistoryDoc(null)}
          onDownload={handleDownload}
        />
      )}
      {deleteTarget && (
        <DeleteConfirmModal
          doc={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
