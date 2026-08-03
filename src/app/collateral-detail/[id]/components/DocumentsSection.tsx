'use client';
import React, { useState, useEffect, useCallback } from 'react';

import { Files, Plus, Upload, Trash2, Download, FileText, FileType2, FileImage, File, RefreshCw, X, ChevronDown, AlertCircle, Eye,  } from 'lucide-react';
import { toast } from 'sonner';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { useAuth } from '@/contexts/AuthContext';

function SectionHeader({ title, icon: IconComponent }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        {IconComponent && React.createElement(IconComponent, { size: 14, className: 'text-primary' })}
      </div>
      <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

const DOC_TYPE_OPTIONS: DocumentType[] = [
  'Title Deed',
  'Charge Certificate',
  'Valuation Report',
  'BRELA Confirmation',
  'Insurance Certificate',
  'Board Resolution',
  'Other',
];

function getFileIconDetail(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={18} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={18} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={18} className="text-indigo-500" />;
  return <FileText size={18} className="text-slate-500" />;
}

// ─── File Preview Panel (for upload modal) ────────────────────────────────────

function FilePreviewPanel({ file }: { file: File }) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  if (!previewUrl) return null;

  const isImage = file.type.startsWith('image/');
  const isPdf = file.type === 'application/pdf';

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/20">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <Eye size={12} className="text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Preview</span>
      </div>
      {isImage ? (
        <div className="flex items-center justify-center p-3 max-h-52 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview" className="max-h-44 max-w-full object-contain rounded" />
        </div>
      ) : isPdf ? (
        <iframe
          src={previewUrl}
          title="PDF Preview"
          className="w-full h-52 border-0"
        />
      ) : (
        <div className="flex items-center justify-center py-6 text-xs text-muted-foreground">
          <FileText size={20} className="mr-2 text-muted-foreground/50" />
          Preview not available for this file type
        </div>
      )}
    </div>
  );
}

// ─── In-App Document Viewer Modal ─────────────────────────────────────────────

interface DocumentViewerModalProps {
  doc: CollateralDocument;
  collateralId: string;
  onClose: () => void;
}

function DocumentViewerModal({ doc, collateralId, onClose }: DocumentViewerModalProps) {
  const displayName = `${doc.documentType} - ${collateralId}`;
  const isImage = doc.mimeType?.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';
  const isWord = doc.mimeType?.includes('word') || doc.mimeType?.includes('document');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="shrink-0">{getFileIconDetail(doc.mimeType ?? '')}</div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{displayName}</p>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs text-muted-foreground">v{doc.version}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</span>
                {doc.uploadedByName && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">by {doc.uploadedByName}</span>
                  </>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 ml-3">
            {doc.signedUrl && (
              <a
                href={doc.signedUrl}
                download={doc.fileName}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-foreground bg-muted hover:bg-muted/80 rounded-lg transition-colors"
              >
                <Download size={13} /> Download
              </a>
            )}
            <button
              onClick={onClose}
              className="p-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <X size={16} className="text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Document notes */}
        {doc.notes && (
          <div className="px-5 py-2 bg-amber-50 border-b border-amber-100 shrink-0">
            <p className="text-xs text-amber-700 italic">{doc.notes}</p>
          </div>
        )}

        {/* Viewer body */}
        <div className="flex-1 overflow-hidden bg-muted/30 flex items-center justify-center">
          {!doc.signedUrl ? (
            <div className="text-center py-12">
              <FileText size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground">Document URL not available</p>
            </div>
          ) : isPdf ? (
            <iframe
              src={doc.signedUrl}
              title={displayName}
              className="w-full h-full border-0"
              style={{ minHeight: '500px' }}
            />
          ) : isImage ? (
            <div className="flex items-center justify-center w-full h-full p-6 overflow-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={doc.signedUrl}
                alt={displayName}
                className="max-w-full max-h-full object-contain rounded shadow-sm"
                style={{ maxHeight: '60vh' }}
              />
            </div>
          ) : isWord ? (
            <div className="text-center py-12 px-6">
              <File size={40} className="mx-auto text-indigo-400 mb-3" />
              <p className="text-sm font-medium text-foreground mb-1">{displayName}</p>
              <p className="text-xs text-muted-foreground mb-4">Word documents cannot be previewed inline.</p>
              <a
                href={doc.signedUrl}
                download={doc.fileName}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Download size={14} /> Download to view
              </a>
            </div>
          ) : (
            <div className="text-center py-12 px-6">
              <FileText size={40} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Preview not available for this file type.</p>
              {doc.signedUrl && (
                <a
                  href={doc.signedUrl}
                  download={doc.fileName}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                >
                  <Download size={14} /> Download
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Upload Document Modal ────────────────────────────────────────────────────

interface UploadDocumentModalProps {
  collateral: CollateralRecord;
  userId: string;
  userName: string;
  onClose: () => void;
  onUploaded: () => void;
  initialDocType?: DocumentType;
}

function UploadDocumentModal({ collateral, userId, userName, onClose, onUploaded, initialDocType }: UploadDocumentModalProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>(initialDocType ?? 'Other');
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (file: File) => {
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
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
      selectedFile, collateral.id, collateral.collateralId, docType, notes, userId, userName,
    );
    setUploading(false);
    if (result.error) { setError(result.error); return; }
    onUploaded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-base font-semibold text-foreground">Upload Document</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Linked to: <span className="font-medium text-foreground">{collateral.collateralId} — {collateral.obligor}</span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto flex-1">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
          >
            <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-3">
                {getFileIconDetail(selectedFile.type)}
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground truncate max-w-[260px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{documentService.formatFileSize(selectedFile.size)}</p>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setError(''); }} className="ml-auto p-1 rounded hover:bg-muted">
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

          {/* Preview panel — shown once a file is selected */}
          {selectedFile && <FilePreviewPanel file={selectedFile} />}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
            <div className="relative">
              <select value={docType} onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8">
                {DOC_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Notes <span className="text-muted-foreground font-normal">(optional)</span></label>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2}
              placeholder="Add context or version notes…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={uploading || !selectedFile}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {uploading ? <RefreshCw size={14} className="animate-spin" /> : <Upload size={14} />}
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function DocumentsSection({ collateral }: { collateral: CollateralRecord }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CollateralDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<DocumentType | undefined>(undefined);
  const [viewingDoc, setViewingDoc] = useState<CollateralDocument | null>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const data = await documentService.getByCollateralId(collateral.id);
    setDocs(data);
    setLoading(false);
  }, [collateral.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDelete = async (doc: CollateralDocument) => {
    const ok = await documentService.delete(doc);
    if (ok) { toast.success('Document removed'); loadDocs(); }
    else toast.error('Failed to remove document');
  };

  const openUploadFor = (docType?: DocumentType) => {
    setUploadDocType(docType);
    setShowUploadModal(true);
  };

  const docsByType = docs.reduce<Record<string, CollateralDocument[]>>((acc, doc) => {
    const key = doc.documentType ?? 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Related Documents" icon={Files} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
          {user && (
            <button onClick={() => openUploadFor(undefined)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
              <Plus size={13} /> Upload
            </button>
          )}
        </div>
      </div>
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : (
        <div className="space-y-3">
          {DOC_TYPE_OPTIONS.map((docType) => {
            const typeDocs = docsByType[docType] ?? [];
            const hasDocuments = typeDocs.length > 0;
            return (
              <div key={docType} className="rounded-lg border border-border/60 overflow-hidden">
                <button type="button" onClick={() => user && openUploadFor(docType)} disabled={!user}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${hasDocuments ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/10 hover:bg-primary/5'} ${!user ? 'cursor-default' : 'cursor-pointer'}`}>
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${hasDocuments ? 'bg-primary/10' : 'bg-muted/60'}`}>
                      <FileText size={13} className={hasDocuments ? 'text-primary' : 'text-muted-foreground/50'} />
                    </div>
                    <div>
                      <span className="text-sm font-500 text-foreground">{docType}</span>
                      {hasDocuments && <span className="ml-2 text-xs text-muted-foreground">{typeDocs.length} file{typeDocs.length !== 1 ? 's' : ''}</span>}
                    </div>
                  </div>
                  {user && !hasDocuments && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Upload size={12} /><span>Upload</span>
                    </span>
                  )}
                </button>
                {hasDocuments && (
                  <div className="divide-y divide-border/40">
                    {typeDocs.map((doc) => {
                      // Display name: Category - CollateralID
                      const displayName = `${doc.documentType} - ${doc.collateralId}`;
                      return (
                        <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-muted/20 transition-colors group">
                          <div className="w-6 h-6 rounded flex items-center justify-center shrink-0">{getFileIconDetail(doc.mimeType ?? '')}</div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-500 text-foreground truncate">{displayName}</p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <span className="text-xs text-muted-foreground">v{doc.version}</span>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                              <span className="text-muted-foreground/40">·</span>
                              <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</span>
                            </div>
                            {doc.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{doc.notes}</p>}
                          </div>
                          <div className="flex items-center gap-1">
                            {doc.signedUrl ? (
                              <>
                                <button
                                  onClick={() => setViewingDoc(doc)}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary bg-primary/5 hover:bg-primary/15 transition-colors"
                                >
                                  <Eye size={12} /> View
                                </button>
                                <a href={doc.signedUrl} download={doc.fileName}
                                  className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground bg-muted/40 hover:bg-muted hover:text-foreground transition-colors">
                                  <Download size={12} /> Download
                                </a>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground/50 italic px-2">No URL</span>
                            )}
                            <button onClick={() => handleDelete(doc)}
                              className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100">
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
                {!hasDocuments && user && (
                  <div onClick={() => openUploadFor(docType)}
                    className="flex items-center gap-2 px-3 py-2 bg-white cursor-pointer hover:bg-primary/5 transition-colors border-t border-border/40">
                    <div className="w-5 h-5 rounded border border-dashed border-muted-foreground/30 flex items-center justify-center shrink-0">
                      <Plus size={10} className="text-muted-foreground/40" />
                    </div>
                    <span className="text-xs text-muted-foreground/60 italic">No document — click to upload</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
      {showUploadModal && user && (
        <UploadDocumentModal
          collateral={collateral}
          userId={user.id}
          userName={user.email ?? 'Unknown'}
          initialDocType={uploadDocType}
          onClose={() => { setShowUploadModal(false); setUploadDocType(undefined); }}
          onUploaded={() => { loadDocs(); toast.success('Document uploaded successfully'); }}
        />
      )}
      {viewingDoc && (
        <DocumentViewerModal
          doc={viewingDoc}
          collateralId={collateral.collateralId}
          onClose={() => setViewingDoc(null)}
        />
      )}
    </div>
  );
}
