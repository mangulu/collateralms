'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  FileText, CheckCircle2, AlertCircle, Clock, ChevronDown, ChevronUp,
  Upload, X, RefreshCw, FileType2, FileImage, File, Eye,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { collateralTypeRequiredDocsService, CollateralTypeRequiredDoc } from '@/lib/supabase/collateralTypeRequiredDocsService';
import { documentService, DocumentType } from '@/lib/supabase/documentService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UploadedDoc {
  docType: string;
  fileName: string;
  status: string;
}

interface MandatoryDocumentsCardProps {
  collateral: CollateralRecord;
  onDocumentUploaded?: () => void;
}

// ─── Allowed MIME types ───────────────────────────────────────────────────────

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function getFileIconDetail(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={16} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={16} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={16} className="text-indigo-500" />;
  return <FileText size={16} className="text-slate-500" />;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const VALID_DOC_TYPES: DocumentType[] = [
  'Title Deed',
  'Charge Certificate',
  'Valuation Report',
  'BRELA Confirmation',
  'Insurance Certificate',
  'Board Resolution',
  'Deed',
  'Appraisal',
  'Insurance Policy',
  'Other',
  // Motor Vehicle
  'Vehicle Registration Certificate (Original)',
  'Logbook (Original)',
  'TRA Encumbrance Search Certificate',
  'Comprehensive Insurance Policy',
  'Hire Purchase / Charge Agreement',
  // Mortgage
  'Title Deed (Original)',
  'Valuation Report (Certified)',
  'Land Rent Clearance Certificate',
  'Mortgage Deed / Charge Instrument',
  'Lands Registry Search Certificate',
  'Survey Plan / Plot Map',
  'Building Permit (if applicable)',
  // Debenture
  'Debenture Deed (Executed)',
  'Certificate of Incorporation',
  'Board Resolution (Authorising Charge)',
  'BRELA Registration Certificate',
  'Memorandum & Articles of Association',
  'Audited Financial Statements (Latest)',
  'Asset Schedule / Inventory List',
  // Shares (DSE)
  'Share Certificate(s) (Original)',
  'DSE Pledge Confirmation Letter',
  'CDS Account Statement',
  'Board Resolution (Authorising Pledge)',
  'Share Transfer Form (Blank, Signed)',
  'DSE Registry Search',
  // FDR
  'Fixed Deposit Receipt (Original)',
  'Bank Lien Letter / Pledge Confirmation',
  'Account Statement',
  'Deed of Assignment',
  // Guarantee
  'Guarantee Deed (Executed)',
  'Guarantor Financial Statements',
  'Board Resolution (if Corporate Guarantor)',
  'Certificate of Incorporation (if Corporate)',
  'Guarantor ID / KYC Documents',
  // Ship/Vessel
  'Ship Registration Certificate (TASAC)',
  'Mortgage of Ship Deed',
  'TASAC Encumbrance Search',
  'Hull & Machinery Insurance Policy',
  'Valuation / Survey Report',
  'Classification Society Certificate',
  'Crew & Manning Certificate',
];

// Map a free-text required-doc name to the closest DocumentType enum value.
// Priority: 1) exact match (case-insensitive), 2) keyword heuristics, 3) 'Other'
function resolveDocType(name: string): DocumentType {
  const trimmed = name.trim();
  const lower = trimmed.toLowerCase();

  // 1. Exact match against known DocumentType values (case-insensitive)
  const exactMatch = VALID_DOC_TYPES.find((t) => t.toLowerCase() === lower);
  if (exactMatch) return exactMatch;

  // 2. Keyword heuristics
  if (lower.includes('title') || lower.includes('deed')) return 'Title Deed';
  if (lower.includes('charge')) return 'Charge Certificate';
  if (lower.includes('valuation') || lower.includes('appraisal')) return 'Valuation Report';
  if (lower.includes('brela')) return 'BRELA Confirmation';
  if (lower.includes('insurance')) return 'Insurance Certificate';
  if (lower.includes('board') || lower.includes('resolution')) return 'Board Resolution';

  return 'Other';
}

/**
 * Check whether a stored document_type value matches a required document name.
 * Uses three strategies:
 *   1. Direct case-insensitive match between stored type and required name
 *   2. Stored type matches the resolved DocumentType of the required name
 *   3. Required name matches the resolved DocumentType of the stored type
 */
function docTypeMatchesRequired(storedDocType: string, requiredDocName: string): boolean {
  const storedLower = storedDocType.toLowerCase().trim();
  const requiredLower = requiredDocName.toLowerCase().trim();

  // Strategy 1: direct name match
  if (storedLower === requiredLower) return true;

  // Strategy 2: stored type equals resolved type of required name
  const resolvedRequired = resolveDocType(requiredDocName).toLowerCase().trim();
  if (storedLower === resolvedRequired) return true;

  // Strategy 3: resolved type of stored value equals resolved type of required name
  const resolvedStored = resolveDocType(storedDocType).toLowerCase().trim();
  if (resolvedStored === resolvedRequired) return true;

  return false;
}

// ─── File Preview Panel ───────────────────────────────────────────────────────

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
        <div className="flex items-center justify-center p-3 max-h-48 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={previewUrl} alt="Preview" className="max-h-40 max-w-full object-contain rounded" />
        </div>
      ) : isPdf ? (
        <iframe
          src={previewUrl}
          title="PDF Preview"
          className="w-full h-48 border-0"
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

// ─── Inline Upload Modal ──────────────────────────────────────────────────────

interface InlineUploadModalProps {
  collateral: CollateralRecord;
  userId: string;
  userName: string;
  docTypeName: string;
  onClose: () => void;
  onUploaded: () => void;
}

function InlineUploadModal({ collateral, userId, userName, docTypeName, onClose, onUploaded }: InlineUploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [notes, setNotes] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const docType = resolveDocType(docTypeName);

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
    toast.success(`${docTypeName} uploaded successfully`);
    onUploaded();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Upload: {docTypeName}</h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              {collateral.collateralId} — {collateral.obligor}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={15} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4 space-y-3 overflow-y-auto flex-1">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/40'}`}
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
                {getFileIconDetail(selectedFile.type)}
                <div className="text-left">
                  <p className="text-sm font-medium text-foreground truncate max-w-[220px]">{selectedFile.name}</p>
                  <p className="text-xs text-muted-foreground">{documentService.formatFileSize(selectedFile.size)}</p>
                </div>
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setError(''); }}
                  className="ml-auto p-1 rounded hover:bg-muted"
                >
                  <X size={13} className="text-muted-foreground" />
                </button>
              </div>
            ) : (
              <>
                <Upload size={22} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm font-medium text-foreground">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, JPEG, PNG, WEBP, DOC, DOCX · Max 10 MB</p>
              </>
            )}
          </div>

          {/* Preview panel — shown once a file is selected */}
          {selectedFile && <FilePreviewPanel file={selectedFile} />}

          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Document Type</label>
            <div className="px-3 py-2 border border-border rounded-lg bg-muted/30 text-sm text-foreground">
              {docType}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
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
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={uploading || !selectedFile}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? <RefreshCw size={13} className="animate-spin" /> : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Upload'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function MandatoryDocumentsCard({ collateral, onDocumentUploaded }: MandatoryDocumentsCardProps) {
  const { user } = useAuth();
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([]);
  const [requiredDocs, setRequiredDocs] = useState<CollateralTypeRequiredDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!collateral.id || !collateral.type) return;
    setLoading(true);
    const supabase = createClient();

    try {
      const [reqDocs, supabaseResult] = await Promise.all([
        collateralTypeRequiredDocsService.getByType(collateral.type),
        supabase
          .from('collateral_documents')
          .select('document_type, file_name, status')
          .eq('collateral_record_id', collateral.id),
      ]);

      setRequiredDocs(reqDocs);
      const data = supabaseResult.data;
      if (data) {
        setUploadedDocs(
          data.map((d: any) => ({
            docType: d.document_type ?? '',
            fileName: d.file_name ?? '',
            status: d.status ?? 'uploaded',
          }))
        );
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [collateral.id, collateral.type]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleUploaded = useCallback(() => {
    loadData();
    onDocumentUploaded?.();
  }, [loadData, onDocumentUploaded]);

  // Only show mandatory docs in the checklist
  const mandatoryList = requiredDocs.filter((d) => d.isMandatory);

  if (!loading && mandatoryList.length === 0) return null;

  // Match uploaded docs to mandatory list using multi-strategy matching
  const docStatus = mandatoryList.map((req) => {
    const match = uploadedDocs.find((u) => docTypeMatchesRequired(u.docType, req.documentName));
    return { required: req.documentName, uploaded: !!match, fileName: match?.fileName };
  });

  const uploadedCount = docStatus.filter((d) => d.uploaded).length;
  const totalCount = docStatus.length;
  const completionPct = totalCount > 0 ? Math.round((uploadedCount / totalCount) * 100) : 0;
  const allComplete = totalCount > 0 && uploadedCount === totalCount;

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        {/* Header */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText size={14} className="text-primary" />
            </div>
            <div className="text-left">
              <h3 className="text-sm font-700 text-foreground">Document Checklist</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Required for {collateral.type} · {loading ? '…' : `${uploadedCount}/${totalCount} uploaded`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {!loading && (
              <span
                className={`text-xs font-700 px-2.5 py-1 rounded-full ${
                  allComplete
                    ? 'bg-green-100 text-green-700'
                    : uploadedCount > 0
                    ? 'bg-amber-100 text-amber-700' :'bg-red-100 text-red-700'
                }`}
              >
                {completionPct}%
              </span>
            )}
            {expanded ? (
              <ChevronUp size={15} className="text-muted-foreground" />
            ) : (
              <ChevronDown size={15} className="text-muted-foreground" />
            )}
          </div>
        </button>

        {expanded && (
          <div className="px-5 pb-5">
            {/* Progress bar */}
            {!loading && totalCount > 0 && (
              <div className="w-full h-1.5 bg-muted rounded-full mb-4 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    allComplete ? 'bg-green-500' : uploadedCount > 0 ? 'bg-amber-500' : 'bg-red-400'
                  }`}
                  style={{ width: `${completionPct}%` }}
                />
              </div>
            )}

            {loading ? (
              <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground">
                <Clock size={14} className="animate-spin" />
                Checking uploaded documents…
              </div>
            ) : mandatoryList.length === 0 ? (
              <p className="text-xs text-muted-foreground py-2">
                No required documents configured for <strong>{collateral.type}</strong>. Admins can configure them in Settings → Collateral Types.
              </p>
            ) : (
              <ul className="space-y-2">
                {docStatus.map(({ required, uploaded, fileName }) => (
                  <li key={required}>
                    {uploaded ? (
                      /* Uploaded — static green row */
                      <div className="flex items-start gap-3 p-2.5 rounded-lg border bg-green-50 border-green-200">
                        <div className="shrink-0 mt-0.5">
                          <CheckCircle2 size={15} className="text-green-600" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-600 text-green-800">{required}</p>
                          {fileName && (
                            <p className="text-[10px] text-green-600 mt-0.5 truncate">{fileName}</p>
                          )}
                        </div>
                      </div>
                    ) : user ? (
                      /* Missing + user logged in — clickable upload row */
                      <button
                        type="button"
                        onClick={() => setUploadingFor(required)}
                        className="w-full flex items-start gap-3 p-2.5 rounded-lg border bg-red-50/60 border-red-200/70 hover:bg-red-100/60 hover:border-red-300 transition-colors group text-left"
                      >
                        <div className="shrink-0 mt-0.5">
                          <AlertCircle size={15} className="text-red-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-600 text-red-700">{required}</p>
                          <p className="text-[10px] text-red-500 mt-0.5">Not yet uploaded</p>
                        </div>
                        <span className="flex items-center gap-1 text-[10px] font-600 text-primary bg-primary/10 group-hover:bg-primary/20 px-2 py-1 rounded-md shrink-0 transition-colors">
                          <Upload size={10} /> Upload
                        </span>
                      </button>
                    ) : (
                      /* Missing + not logged in — static red row */
                      <div className="flex items-start gap-3 p-2.5 rounded-lg border bg-red-50/60 border-red-200/70">
                        <div className="shrink-0 mt-0.5">
                          <AlertCircle size={15} className="text-red-500" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-600 text-red-700">{required}</p>
                          <p className="text-[10px] text-red-500 mt-0.5">Not yet uploaded</p>
                        </div>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}

            {!allComplete && !loading && mandatoryList.length > 0 && user && (
              <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed">
                Click any missing document above to upload it directly, or use the <strong>Upload</strong> button in the Documents section below.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Inline upload modal for a specific missing doc */}
      {uploadingFor && user && (
        <InlineUploadModal
          collateral={collateral}
          userId={user.id}
          userName={user.email ?? 'Unknown'}
          docTypeName={uploadingFor}
          onClose={() => setUploadingFor(null)}
          onUploaded={handleUploaded}
        />
      )}
    </>
  );
}
