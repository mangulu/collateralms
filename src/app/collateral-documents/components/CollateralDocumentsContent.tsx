'use client';
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Upload, Search, FileText, Trash2, Download, ChevronDown, X, RefreshCw, Clock, AlertCircle, GitBranch, Link2, Filter, FolderOpen, File, FileImage, FileType2, Package, MapPin } from 'lucide-react';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import Icon from '@/components/ui/AppIcon';
import SecurityPocketPanel from './SecurityPocketPanel';


// ─── Constants ────────────────────────────────────────────────────────────────

const DOCUMENT_TYPES: DocumentType[] = [
  'Title Deed',
  'Charge Certificate',
  'Valuation Report',
  'BRELA Confirmation',
  'Insurance Certificate',
  'Board Resolution',
  'Other',
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={18} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={18} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={18} className="text-indigo-500" />;
  return <FileText size={18} className="text-slate-500" />;
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  collateralRecord: CollateralRecord;
  onClose: () => void;
  onUploaded: () => void;
  userId: string;
  userName: string;
}

function UploadModal({ collateralRecord, onClose, onUploaded, userId, userName }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('Other');
  const [notes, setNotes] = useState('');
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
    const result = await documentService.upload(
      selectedFile,
      collateralRecord.id,
      collateralRecord.collateralId,
      docType,
      notes,
      userId,
      userName,
    );
    setUploading(false);
    if (!result) {
      setError('Upload failed. Please try again.');
      return;
    }
    onUploaded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Upload Document</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Linked to:{' '}
              <span className="font-medium text-foreground">
                {collateralRecord.collateralId} — {collateralRecord.obligor}
              </span>
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
                <p className="text-sm font-medium text-foreground">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG, WEBP, DOC, DOCX · Max 10 MB</p>
              </>
            )}
          </div>

          {/* Document type */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
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
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Upload Version Modal ─────────────────────────────────────────────────────

interface UploadVersionModalProps {
  collateralRecord: CollateralRecord;
  existingDoc: CollateralDocument;
  onClose: () => void;
  onUploaded: () => void;
  userId: string;
  userName: string;
}

function UploadVersionModal({ collateralRecord, existingDoc, onClose, onUploaded, userId, userName }: UploadVersionModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
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
    const result = await documentService.upload(
      selectedFile,
      collateralRecord.id,
      collateralRecord.collateralId,
      existingDoc.documentType,
      notes,
      userId,
      userName,
    );
    setUploading(false);
    if (!result) {
      setError('Upload failed. Please try again.');
      return;
    }
    onUploaded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-semibold text-foreground">Upload Newer Version</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Replacing: <span className="font-medium text-foreground">{existingDoc.fileName}</span>{' '}
              <span className="text-primary">v{existingDoc.version} → v{existingDoc.version + 1}</span>
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
                <p className="text-sm font-medium text-foreground">Drop new version here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG, WEBP, DOC, DOCX · Max 10 MB</p>
              </>
            )}
          </div>

          {/* Document type (read-only) */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
            <div className="w-full border border-border rounded-lg px-3 py-2 text-sm text-muted-foreground bg-muted/30">
              {existingDoc.documentType}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Version Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Describe what changed in this version…"
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
            {uploading ? 'Uploading…' : 'Upload New Version'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Version History Modal ────────────────────────────────────────────────────

interface VersionHistoryModalProps {
  docs: CollateralDocument[];
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
            <h2 className="text-base font-semibold text-foreground">Version History</h2>
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[320px]">{fileName}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-4 max-h-[400px] overflow-y-auto space-y-3">
          {sorted.map((doc, idx) => (
            <div
              key={doc.id}
              className={`flex items-start gap-3 p-3 rounded-lg border ${idx === 0 ? 'border-primary/30 bg-primary/5' : 'border-border bg-muted/30'}`}
            >
              <div className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold ${idx === 0 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                v{doc.version}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-foreground">{formatDateTime(doc.createdAt)}</span>
                  {idx === 0 && (
                    <span className="text-[10px] font-medium bg-primary/10 text-primary px-1.5 py-0.5 rounded">Latest</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Uploaded by <span className="font-medium text-foreground">{doc.uploadedByName || 'Unknown'}</span>
                </p>
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
  doc: CollateralDocument;
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

// ─── Document Row ─────────────────────────────────────────────────────────────

interface DocumentRowProps {
  doc: CollateralDocument;
  collateralRecord?: CollateralRecord;
  versionCount: number;
  onUploadVersion: () => void;
  onViewVersions: () => void;
  onDownload: () => void;
  onDelete: () => void;
  canDelete: boolean;
}

function DocumentRow({
  doc, collateralRecord, versionCount, onUploadVersion, onViewVersions, onDownload, onDelete, canDelete,
}: DocumentRowProps) {
  const meta = DOC_TYPE_META[doc.documentType] ?? DOC_TYPE_META['Other'];
  return (
    <tr className="hover:bg-muted/30 transition-colors group">
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
        {collateralRecord ? (
          <div>
            <p className="text-xs font-medium text-foreground">{collateralRecord.collateralId}</p>
            <p className="text-xs text-muted-foreground truncate max-w-[140px]">{collateralRecord.obligor}</p>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">{doc.collateralId}</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            v{doc.version}
          </span>
          {versionCount > 1 && (
            <button
              onClick={onViewVersions}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors"
              title="View all versions"
            >
              <GitBranch size={12} />
              <span>{versionCount}</span>
            </button>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <div>
          <p className="text-xs font-medium text-foreground">{doc.uploadedByName || 'Unknown'}</p>
          <p className="text-xs text-muted-foreground">{formatDate(doc.createdAt)}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        {doc.notes ? (
          <p className="text-xs text-muted-foreground truncate max-w-[160px]" title={doc.notes}>{doc.notes}</p>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-1">
          <button
            onClick={onDownload}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Download"
          >
            <Download size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={onViewVersions}
            className="p-1.5 rounded-md hover:bg-muted transition-colors"
            title="Version history"
          >
            <Clock size={14} className="text-muted-foreground" />
          </button>
          <button
            onClick={onUploadVersion}
            className="p-1.5 rounded-md hover:bg-primary/10 transition-colors"
            title="Upload newer version"
          >
            <Upload size={14} className="text-primary" />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
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
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface DocumentWithRecord extends CollateralDocument {
  collateralRecord?: CollateralRecord;
}

export default function CollateralDocumentsContent() {
  const { user, userProfile } = useAuth();
  const { hasPermission } = usePermissions();

  // Data state
  const [documents, setDocuments] = useState<DocumentWithRecord[]>([]);
  const [collateralRecords, setCollateralRecords] = useState<CollateralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state
  const [search, setSearch] = useState('');
  const [filterDocType, setFilterDocType] = useState<string>('All');
  const [filterCollateral, setFilterCollateral] = useState<string>('All');
  const [showFilters, setShowFilters] = useState(false);

  // Modal state
  const [uploadModal, setUploadModal] = useState<CollateralRecord | null>(null);
  const [uploadVersionModal, setUploadVersionModal] = useState<{ record: CollateralRecord; doc: CollateralDocument } | null>(null);
  const [versionModal, setVersionModal] = useState<{ docs: CollateralDocument[]; fileName: string } | null>(null);
  const [deleteModal, setDeleteModal] = useState<CollateralDocument | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [activeView, setActiveView] = useState<'documents' | 'pockets'>('documents');
  const [selectedPocketCollateral, setSelectedPocketCollateral] = useState<CollateralRecord | null>(null);

  const userId = user?.id ?? '';
  const userName = userProfile?.full_name ?? user?.email ?? 'Unknown';
  const canDelete = hasPermission(PERMISSIONS.COLLATERAL_VIEW);

  // ─── Fetch ────────────────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const records = await collateralService.getAll();
      setCollateralRecords(records);

      // Fetch documents for all collateral records in parallel
      const docArrays = await Promise.all(
        records.map((r) => documentService.getByCollateralId(r.id))
      );

      const allDocs: DocumentWithRecord[] = docArrays.flatMap((docs, idx) =>
        docs.map((doc) => ({ ...doc, collateralRecord: records[idx] }))
      );

      // Sort by createdAt desc
      allDocs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setDocuments(allDocs);
    } catch (err: any) {
      setError('Failed to load documents. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Derived data ─────────────────────────────────────────────────────────

  // Group docs by fileName + collateralRecordId to compute version counts
  const versionMap = React.useMemo(() => {
    const map: Record<string, CollateralDocument[]> = {};
    documents.forEach((doc) => {
      const key = `${doc.collateralRecordId}::${doc.fileName}`;
      if (!map[key]) map[key] = [];
      map[key].push(doc);
    });
    return map;
  }, [documents]);

  // Latest version per file (highest version number)
  const latestDocs = React.useMemo(() => {
    const seen = new Set<string>();
    const result: DocumentWithRecord[] = [];
    // Already sorted desc by createdAt; pick first occurrence per key
    documents.forEach((doc) => {
      const key = `${doc.collateralRecordId}::${doc.fileName}`;
      if (!seen.has(key)) {
        seen.add(key);
        result.push(doc);
      }
    });
    return result;
  }, [documents]);

  // Filtered docs
  const filteredDocs = React.useMemo(() => {
    return latestDocs.filter((doc) => {
      const matchSearch =
        !search ||
        doc.fileName.toLowerCase().includes(search.toLowerCase()) ||
        doc.collateralId.toLowerCase().includes(search.toLowerCase()) ||
        doc.collateralRecord?.obligor?.toLowerCase().includes(search.toLowerCase()) ||
        doc.documentType.toLowerCase().includes(search.toLowerCase());

      const matchDocType = filterDocType === 'All' || doc.documentType === filterDocType;
      const matchCollateral = filterCollateral === 'All' || doc.collateralRecordId === filterCollateral;

      return matchSearch && matchDocType && matchCollateral;
    });
  }, [latestDocs, search, filterDocType, filterCollateral]);

  // KPI counts
  const totalDocs = documents.length;
  const uniqueFiles = latestDocs.length;
  const versioned = latestDocs.filter((d) => {
    const key = `${d.collateralRecordId}::${d.fileName}`;
    return (versionMap[key]?.length ?? 0) > 1;
  }).length;
  const linkedCollaterals = new Set(documents.map((d) => d.collateralRecordId)).size;
  const brelaReceipts = documents.filter((d) => d.documentType === 'BRELA Confirmation').length;

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleDownload = (doc: CollateralDocument) => {
    if (doc.signedUrl) {
      window.open(doc.signedUrl, '_blank');
    }
  };

  const handleViewVersions = (doc: CollateralDocument) => {
    const key = `${doc.collateralRecordId}::${doc.fileName}`;
    const allVersions = versionMap[key] ?? [doc];
    setVersionModal({ docs: allVersions, fileName: doc.fileName });
  };

  const handleDelete = async () => {
    if (!deleteModal) return;
    setDeleting(true);
    const ok = await documentService.delete(deleteModal);
    setDeleting(false);
    if (ok) {
      setDeleteModal(null);
      fetchData();
    }
  };

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white shrink-0">
        <div>
          <h1 className="text-lg font-semibold text-foreground">Collateral Documents</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Upload, version, and manage loan &amp; property documents linked to collateral records
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-muted rounded-lg p-0.5 border border-border">
            <button
              onClick={() => setActiveView('documents')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'documents' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <FileText size={13} /> Documents
            </button>
            <button
              onClick={() => setActiveView('pockets')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                activeView === 'pockets' ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Package size={13} /> Security Pockets
            </button>
          </div>
          <button
            onClick={fetchData}
            className="p-2 rounded-lg hover:bg-muted transition-colors"
            title="Refresh"
          >
            <RefreshCw size={16} className={`text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
          </button>
          {collateralRecords.length > 0 && activeView === 'documents' && (
            <div className="relative">
              <select
                className="appearance-none border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                value=""
                onChange={(e) => {
                  const rec = collateralRecords.find((r) => r.id === e.target.value);
                  if (rec) setUploadModal(rec);
                }}
              >
                <option value="" disabled>Upload to collateral…</option>
                {collateralRecords.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.collateralId} — {r.obligor}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          )}
          {activeView === 'documents' && (
            <button
              onClick={() => {
                if (collateralRecords.length > 0) setUploadModal(collateralRecords[0]);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Upload size={14} />
              Upload Document
            </button>
          )}
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-5 gap-px bg-border border-b border-border shrink-0">
        {[
          { label: 'Total Versions', value: totalDocs, icon: FileText, color: 'text-primary' },
          { label: 'Unique Files', value: uniqueFiles, icon: FolderOpen, color: 'text-amber-600' },
          { label: 'Versioned Files', value: versioned, icon: GitBranch, color: 'text-purple-600' },
          { label: 'Linked Collaterals', value: linkedCollaterals, icon: Link2, color: 'text-emerald-600' },
          { label: 'BRELA Receipts', value: brelaReceipts, icon: FileType2, color: 'text-cyan-600' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-white px-5 py-3 flex items-center gap-3">
            <div className={`w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0`}>
              <Icon size={16} className={color} />
            </div>
            <div>
              <p className="text-xl font-semibold text-foreground leading-none">{loading ? '—' : value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className={`flex items-center gap-3 px-6 py-3 border-b border-border bg-white shrink-0 flex-wrap ${activeView === 'pockets' ? 'hidden' : ''}`}>
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search files, collateral, obligor…"
            className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X size={13} className="text-muted-foreground" />
            </button>
          )}
        </div>

        {/* Doc type filter */}
        <div className="relative">
          <select
            value={filterDocType}
            onChange={(e) => setFilterDocType(e.target.value)}
            className="appearance-none border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="All">All Types</option>
            {DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {/* Collateral filter */}
        <div className="relative">
          <select
            value={filterCollateral}
            onChange={(e) => setFilterCollateral(e.target.value)}
            className="appearance-none border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 max-w-[220px]"
          >
            <option value="All">All Collaterals</option>
            {collateralRecords.map((r) => (
              <option key={r.id} value={r.id}>{r.collateralId} — {r.obligor}</option>
            ))}
          </select>
          <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>

        {(search || filterDocType !== 'All' || filterCollateral !== 'All') && (
          <button
            onClick={() => { setSearch(''); setFilterDocType('All'); setFilterCollateral('All'); }}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={12} /> Clear filters
          </button>
        )}

        <span className="ml-auto text-xs text-muted-foreground">
          {loading ? 'Loading…' : `${filteredDocs.length} file${filteredDocs.length !== 1 ? 's' : ''}`}
        </span>
      </div>

      {/* Table */}
      <div className={`flex-1 overflow-auto ${activeView === 'pockets' ? 'hidden' : ''}`}>
        {/* Error state */}
        {error && !loading && (
          <div className="m-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-lg px-4 py-3">
            <AlertCircle size={16} className="text-red-600 mt-0.5 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-red-700">Failed to load documents</p>
              <p className="text-xs text-red-600 mt-0.5">{error}</p>
            </div>
            <button
              onClick={fetchData}
              className="flex items-center gap-1.5 text-xs font-medium text-red-700 hover:text-red-800 transition-colors"
            >
              <RefreshCw size={12} /> Retry
            </button>
          </div>
        )}

        {/* Loading skeleton */}
        {loading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-12 bg-muted/50 rounded-lg animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!loading && !error && filteredDocs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center px-4">
            <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FolderOpen size={24} className="text-muted-foreground" />
            </div>
            <h3 className="text-base font-semibold text-foreground mb-1">
              {search || filterDocType !== 'All' || filterCollateral !== 'All' ?'No documents match your filters' :'No documents uploaded yet'}
            </h3>
            <p className="text-sm text-muted-foreground max-w-xs">
              {search || filterDocType !== 'All' || filterCollateral !== 'All' ?'Try adjusting your search or filter criteria.' :'Upload your first document using the button above.'}
            </p>
          </div>
        )}

        {/* Table */}
        {!loading && !error && filteredDocs.length > 0 && (
          <table className="w-full text-left">
            <thead className="sticky top-0 bg-muted/60 backdrop-blur-sm z-10">
              <tr>
                {['File', 'Type', 'Collateral', 'Version', 'Uploaded', 'Notes', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {filteredDocs.map((doc) => {
                const key = `${doc.collateralRecordId}::${doc.fileName}`;
                const versions = versionMap[key] ?? [doc];
                return (
                  <DocumentRow
                    key={doc.id}
                    doc={doc}
                    collateralRecord={doc.collateralRecord}
                    versionCount={versions.length}
                    onUploadVersion={() => {
                      const rec = collateralRecords.find((r) => r.id === doc.collateralRecordId);
                      if (rec) setUploadVersionModal({ record: rec, doc });
                    }}
                    onViewVersions={() => handleViewVersions(doc)}
                    onDownload={() => handleDownload(doc)}
                    onDelete={() => setDeleteModal(doc)}
                    canDelete={canDelete}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Security Pockets View */}
      {activeView === 'pockets' && (
        <div className="flex-1 overflow-auto p-6">
          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-48 bg-muted/50 rounded-xl animate-pulse" />
              ))}
            </div>
          ) : collateralRecords.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-14 h-14 rounded-full bg-muted flex items-center justify-center mb-4">
                <Package size={24} className="text-muted-foreground" />
              </div>
              <h3 className="text-base font-semibold text-foreground mb-1">No Collateral Records</h3>
              <p className="text-sm text-muted-foreground max-w-xs">
                Add collateral records first to create security pockets.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Collateral selector */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <MapPin size={15} className="text-primary" />
                  <span className="text-sm font-semibold text-foreground">Select Collateral</span>
                </div>
                <div className="relative flex-1 max-w-sm">
                  <select
                    value={selectedPocketCollateral?.id ?? ''}
                    onChange={(e) => {
                      const rec = collateralRecords.find((r) => r.id === e.target.value);
                      setSelectedPocketCollateral(rec ?? null);
                    }}
                    className="w-full appearance-none border border-border rounded-lg pl-3 pr-8 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                  >
                    <option value="">— Choose a collateral record —</option>
                    {collateralRecords.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.collateralId} — {r.obligor}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
                {!selectedPocketCollateral && (
                  <p className="text-xs text-muted-foreground">or browse all pockets below</p>
                )}
              </div>

              {/* Single collateral pocket */}
              {selectedPocketCollateral ? (
                <div className="max-w-2xl">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <p className="text-sm font-semibold text-foreground">
                      {selectedPocketCollateral.collateralId}
                    </p>
                    <span className="text-xs text-muted-foreground">·</span>
                    <p className="text-xs text-muted-foreground">{selectedPocketCollateral.obligor}</p>
                  </div>
                  <SecurityPocketPanel
                    collateralRecord={selectedPocketCollateral}
                    userId={userId}
                    userName={userName}
                  />
                </div>
              ) : (
                /* All collaterals grid */
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {collateralRecords.map((record) => (
                    <div key={record.id}>
                      <div className="flex items-center gap-2 mb-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <p className="text-xs font-semibold text-foreground">{record.collateralId}</p>
                        <span className="text-xs text-muted-foreground truncate max-w-[160px]">{record.obligor}</span>
                        <button
                          onClick={() => setSelectedPocketCollateral(record)}
                          className="ml-auto text-xs text-primary hover:underline"
                        >
                          Focus
                        </button>
                      </div>
                      <SecurityPocketPanel
                        collateralRecord={record}
                        userId={userId}
                        userName={userName}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Modals */}
      {uploadModal && (
        <UploadModal
          collateralRecord={uploadModal}
          onClose={() => setUploadModal(null)}
          onUploaded={fetchData}
          userId={userId}
          userName={userName}
        />
      )}

      {uploadVersionModal && (
        <UploadVersionModal
          collateralRecord={uploadVersionModal.record}
          existingDoc={uploadVersionModal.doc}
          onClose={() => setUploadVersionModal(null)}
          onUploaded={fetchData}
          userId={userId}
          userName={userName}
        />
      )}

      {versionModal && (
        <VersionHistoryModal
          docs={versionModal.docs}
          fileName={versionModal.fileName}
          onClose={() => setVersionModal(null)}
          onDownload={handleDownload}
        />
      )}

      {deleteModal && (
        <DeleteConfirmModal
          doc={deleteModal}
          onConfirm={handleDelete}
          onCancel={() => setDeleteModal(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
