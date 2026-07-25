'use client';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import Link from 'next/link';
import { ArrowLeft, Pencil, ExternalLink, Shield, FileText, AlertTriangle, CheckCircle2, Clock, Files, History, RefreshCw, Download, Upload, Trash2, ChevronRight, Activity, TrendingUp, Plus, X, AlertCircle, ChevronDown, FileImage, FileType2, File, Stamp, BadgeCheck, Send, ArrowUpCircle, CheckSquare, RotateCcw, Ban, ClipboardList, MessageSquare, Layers, PieChart,  } from 'lucide-react';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import {
  CollateralRecord,
  CollateralStatus,
  auditService,
  collateralService,
} from '@/lib/supabase/collateralService';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { auditLogService, AuditLogEntry } from '@/lib/supabase/auditLogService';
import { perfectionService, PerfectionRequest, PerfectionComment } from '@/lib/supabase/perfectionService';
import { legalSignOffService, LegalSignOff } from '@/lib/supabase/legalSignOffService';
import AddEditCollateralModal from '@/app/collateral-management/components/AddEditCollateralModal';
import ValuationHistoryTimeline from '@/app/collateral-management/components/ValuationHistoryTimeline';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';



// ─── Types ────────────────────────────────────────────────────────────────────

interface CollateralRecordContentProps {
  collateral: CollateralRecord | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusBadgeMap: Record<
  CollateralStatus,
  | 'perfected' |'pending' |'overdue' |'draft' |'released' |'monitoring' |'rejected' |'under-review' |'submitted'
> = {
  Draft: 'draft',
  Submitted: 'submitted',
  'Under Review': 'under-review',
  Perfected: 'perfected',
  Monitoring: 'monitoring',
  Released: 'released',
  Overdue: 'overdue',
  Rejected: 'rejected',
};

const DOC_TYPE_OPTIONS: DocumentType[] = [
  'Title Deed',
  'Charge Certificate',
  'Valuation Report',
  'BRELA Confirmation',
  'Insurance Certificate',
  'Board Resolution',
  'Other',
];

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={16} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={16} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document'))
    return <File size={16} className="text-indigo-500" />;
  return <FileText size={16} className="text-slate-500" />;
}

function SectionHeader({ title, icon: Icon }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon size={14} className="text-primary" />
      </div>
      <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function Spinner({ size = 5 }: { size?: number }) {
  return (
    <svg
      className={`animate-spin w-${size} h-${size} text-primary`}
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
    </svg>
  );
}

// ─── Upload Document Modal ────────────────────────────────────────────────────

interface UploadDocumentModalProps {
  collateral: CollateralRecord;
  userId: string;
  userName: string;
  initialDocType?: DocumentType;
  onClose: () => void;
  onUploaded: () => void;
}

function UploadDocumentModal({
  collateral,
  userId,
  userName,
  initialDocType,
  onClose,
  onUploaded,
}: UploadDocumentModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
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

  const handleSubmit = async () => {
    if (!selectedFile) { setError('Please select a file.'); return; }
    setUploading(true);
    setError('');
    const result = await documentService.upload(
      selectedFile,
      collateral.id,
      collateral.collateralId,
      docType,
      notes,
      userId,
      userName,
    );
    setUploading(false);
    if (result.error) { setError(result.error); return; }
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
                {collateral.collateralId} — {collateral.obligor}
              </span>
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files?.[0]; if (f) handleFile(f); }}
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
                  onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setError(''); }}
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

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
            <div className="relative">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              >
                {DOC_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

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
            {uploading ? 'Uploading…' : 'Upload Document'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Status Change Modal ──────────────────────────────────────────────────────

interface StatusChangeModalProps {
  collateral: CollateralRecord;
  targetStatus: CollateralStatus;
  userId: string;
  userName: string;
  onClose: () => void;
  onChanged: () => void;
}

const STATUS_CHANGE_CONFIG: Record<
  CollateralStatus,
  { color: string; bg: string; icon: React.ElementType; description: string }
> = {
  Draft: { color: 'text-gray-700', bg: 'bg-gray-100', icon: File, description: 'Move this record back to draft state.' },
  Submitted: { color: 'text-blue-700', bg: 'bg-blue-100', icon: Send, description: 'Submit this collateral for review.' },
  'Under Review': { color: 'text-amber-700', bg: 'bg-amber-100', icon: ClipboardList, description: 'Mark this collateral as under active review.' },
  Perfected: { color: 'text-emerald-700', bg: 'bg-emerald-100', icon: CheckSquare, description: 'Mark this collateral as fully perfected.' },
  Monitoring: { color: 'text-purple-700', bg: 'bg-purple-100', icon: Activity, description: 'Place this collateral under monitoring.' },
  Released: { color: 'text-slate-700', bg: 'bg-slate-100', icon: RotateCcw, description: 'Release this collateral from the facility.' },
  Overdue: { color: 'text-red-700', bg: 'bg-red-100', icon: AlertTriangle, description: 'Flag this collateral as overdue.' },
  Rejected: { color: 'text-red-700', bg: 'bg-red-100', icon: Ban, description: 'Reject this collateral record.' },
};

function StatusChangeModal({ collateral, targetStatus, userId, userName, onClose, onChanged }: StatusChangeModalProps) {
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const config = STATUS_CHANGE_CONFIG[targetStatus];
  const Icon = config.icon;

  const handleSubmit = async () => {
    if (!reason.trim()) { setError('Please provide a reason for this status change.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const updated = await collateralService.update(collateral.id, { status: targetStatus });
      if (!updated) { setError('Status update failed. Please try again.'); setSubmitting(false); return; }
      await auditService.log({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        action: 'status_changed',
        message: `Status changed from ${collateral.status} to ${targetStatus}`,
        detail: reason.trim(),
        performedBy: userId,
        performedByName: userName,
      });
      toast.success(`Status updated to ${targetStatus}`);
      onChanged();
      onClose();
    } catch {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center`}>
              <Icon size={18} className={config.color} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Change Status</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                {collateral.collateralId} → <span className={`font-semibold ${config.color}`}>{targetStatus}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className={`flex items-start gap-3 p-3 rounded-lg border ${config.bg} border-current/20`}>
            <Icon size={15} className={`${config.color} shrink-0 mt-0.5`} />
            <p className={`text-xs ${config.color}`}>{config.description}</p>
          </div>

          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Current Status</span>
              <Badge variant={statusBadgeMap[collateral.status]} label={collateral.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">New Status</span>
              <Badge variant={statusBadgeMap[targetStatus]} label={targetStatus} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Changed By</span>
              <span className="text-xs font-medium text-foreground">{userName}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Reason for Change <span className="text-red-500">*</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => { setReason(e.target.value); if (e.target.value.trim()) setError(''); }}
              rows={3}
              placeholder="Provide a reason for this status change…"
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
            disabled={submitting}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
              targetStatus === 'Rejected' || targetStatus === 'Released' ?'bg-red-600 hover:bg-red-700'
                : targetStatus === 'Perfected' ?'bg-emerald-600 hover:bg-emerald-700' :'bg-primary hover:bg-primary/90'
            }`}
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Icon size={14} />}
            {submitting ? 'Updating…' : `Set to ${targetStatus}`}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Perfection Submission Modal ──────────────────────────────────────────────

interface PerfectionSubmitModalProps {
  collateral: CollateralRecord;
  userId: string;
  userName: string;
  userRole: string;
  onClose: () => void;
  onSubmitted: () => void;
}

function PerfectionSubmitModal({ collateral, userId, userName, userRole, onClose, onSubmitted }: PerfectionSubmitModalProps) {
  const [priority, setPriority] = useState('Normal');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const req = await perfectionService.create(
        {
          collateralRecordId: collateral.id,
          collateralId: collateral.collateralId,
          obligor: collateral.obligor,
          collateralType: collateral.type,
          registry: collateral.registry,
          perfectionDeadline: collateral.perfectionDeadline,
          priority,
        },
        userId,
        userName,
      );
      if (!req) { setError('Failed to create perfection request.'); setSubmitting(false); return; }
      await perfectionService.submit(req.id, userId, userName, comment || 'Perfection request submitted for review.', userRole);
      await auditService.log({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        action: 'submitted',
        message: `Perfection request submitted for ${collateral.collateralId}`,
        detail: `Priority: ${priority}${comment ? ` — ${comment}` : ''}`,
        performedBy: userId,
        performedByName: userName,
      });
      toast.success('Perfection request submitted successfully');
      onSubmitted();
      onClose();
    } catch {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <ArrowUpCircle size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Submit for Perfection</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-medium text-foreground">{collateral.collateralId}</span> — {collateral.obligor}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Collateral Type</span>
              <span className="text-xs font-medium text-foreground">{collateral.type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Registry</span>
              <span className="text-xs font-medium text-foreground">{collateral.registry}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Value</span>
              <span className="text-xs font-mono font-semibold text-foreground">TSh {collateral.valueTSh}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Perfection Deadline</span>
              <span className="text-xs font-medium text-foreground">{collateral.perfectionDeadline || '—'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Priority</label>
            <div className="relative">
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              >
                {['Low', 'Normal', 'High', 'Urgent'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Submission Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              rows={3}
              placeholder="Add any notes for the reviewing officer…"
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
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit for Perfection'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Documents Section ────────────────────────────────────────────────────────

function DocumentsSection({ collateral }: { collateral: CollateralRecord }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CollateralDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadDocType, setUploadDocType] = useState<DocumentType | undefined>(undefined);

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

  const docsByType = docs.reduce<Record<string, CollateralDocument[]>>((acc, doc) => {
    const key = doc.documentType ?? 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Document Uploads" icon={Files} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
          {user && (
            <button
              onClick={() => { setUploadDocType(undefined); setShowUploadModal(true); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={13} /> Upload
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : (
        <div className="space-y-2">
          {DOC_TYPE_OPTIONS.map((docType) => {
            const typeDocs = docsByType[docType] ?? [];
            const hasDocuments = typeDocs.length > 0;
            return (
              <div key={docType} className="rounded-lg border border-border/60 overflow-hidden">
                <button
                  type="button"
                  onClick={() => user && (setUploadDocType(docType), setShowUploadModal(true))}
                  disabled={!user}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-left transition-colors ${
                    hasDocuments ? 'bg-muted/30 hover:bg-muted/50' : 'bg-muted/10 hover:bg-primary/5'
                  } ${!user ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${hasDocuments ? 'bg-primary/10' : 'bg-muted/60'}`}>
                      <FileText size={13} className={hasDocuments ? 'text-primary' : 'text-muted-foreground/50'} />
                    </div>
                    <div>
                      <span className="text-sm font-500 text-foreground">{docType}</span>
                      {hasDocuments && (
                        <span className="ml-2 text-xs text-muted-foreground">{typeDocs.length} file{typeDocs.length !== 1 ? 's' : ''}</span>
                      )}
                    </div>
                  </div>
                  {user && (
                    <span className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors">
                      <Upload size={12} />
                      <span>{hasDocuments ? 'Add' : 'Upload'}</span>
                    </span>
                  )}
                </button>

                {hasDocuments && (
                  <div className="divide-y divide-border/40">
                    {typeDocs.map((doc) => (
                      <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-muted/20 transition-colors group">
                        <div className="w-6 h-6 rounded flex items-center justify-center shrink-0">
                          {getFileIcon(doc.mimeType ?? '')}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-500 text-foreground truncate">{doc.fileName}</p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">v{doc.version}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground">{doc.uploadedByName}</span>
                          </div>
                          {doc.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{doc.notes}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          {doc.signedUrl ? (
                            <>
                              <a href={doc.signedUrl} target="_blank" rel="noopener noreferrer"
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary bg-primary/5 hover:bg-primary/15 transition-colors">
                                <ExternalLink size={12} /> View
                              </a>
                              <a href={doc.signedUrl} download={doc.fileName}
                                className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground bg-muted/40 hover:bg-muted hover:text-foreground transition-colors">
                                <Download size={12} /> Download
                              </a>
                            </>
                          ) : (
                            <span className="text-xs text-muted-foreground/50 italic px-2">No URL</span>
                          )}
                          {user && (
                            <button
                              onClick={() => handleDelete(doc)}
                              className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors opacity-0 group-hover:opacity-100"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {!hasDocuments && user && (
                  <div
                    onClick={() => { setUploadDocType(docType); setShowUploadModal(true); }}
                    className="flex items-center gap-2 px-3 py-2 bg-white cursor-pointer hover:bg-primary/5 transition-colors border-t border-border/40"
                  >
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
    </div>
  );
}

// ─── Linked Approvals Section ─────────────────────────────────────────────────

interface LinkedApprovalsProps {
  collateral: CollateralRecord;
  onRefresh: () => void;
}

function LinkedApprovalsSection({ collateral, onRefresh }: LinkedApprovalsProps) {
  const { user, userProfile, userRole } = useAuth();
  const [requests, setRequests] = useState<PerfectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, PerfectionComment[]>>({});
  const [loadingComments, setLoadingComments] = useState<Record<string, boolean>>({});

  const loadRequests = useCallback(async () => {
    setLoading(true);
    try {
      const all = await perfectionService.getAll();
      const filtered = all.filter(
        (r) => r.collateralId === collateral.collateralId || r.collateralRecordId === collateral.id
      );
      setRequests(filtered);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [collateral.id, collateral.collateralId]);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  const loadComments = async (requestId: string) => {
    if (comments[requestId]) return;
    setLoadingComments((prev) => ({ ...prev, [requestId]: true }));
    try {
      const data = await perfectionService.getComments(requestId);
      setComments((prev) => ({ ...prev, [requestId]: data }));
    } catch {
      // silent
    } finally {
      setLoadingComments((prev) => ({ ...prev, [requestId]: false }));
    }
  };

  const toggleExpand = (id: string) => {
    if (expandedId === id) {
      setExpandedId(null);
    } else {
      setExpandedId(id);
      loadComments(id);
    }
  };

  const workflowStatusColors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600',
    Submitted: 'bg-blue-100 text-blue-700',
    'Under Review': 'bg-amber-100 text-amber-700',
    Approved: 'bg-green-100 text-green-700',
    Perfected: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Returned: 'bg-orange-100 text-orange-700',
  };

  const priorityColors: Record<string, string> = {
    Low: 'text-slate-500',
    Normal: 'text-blue-600',
    High: 'text-amber-600',
    Urgent: 'text-red-600',
  };

  const actionColors: Record<string, string> = {
    submitted: 'bg-blue-100 text-blue-700',
    reviewed: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    returned: 'bg-orange-100 text-orange-700',
    commented: 'bg-gray-100 text-gray-600',
    reopened: 'bg-purple-100 text-purple-700',
  };

  const canSubmit = !!user && collateral.requiresPerfection &&
    !['Perfected', 'Released'].includes(collateral.status);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Linked Approvals" icon={ClipboardList} />
        <div className="flex items-center gap-2">
          {requests.length > 0 && (
            <span className="text-xs text-muted-foreground">{requests.length} request{requests.length !== 1 ? 's' : ''}</span>
          )}
          {canSubmit && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <ArrowUpCircle size={13} /> Submit for Perfection
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : requests.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-12 h-12 rounded-full bg-muted/60 flex items-center justify-center mb-3">
            <ClipboardList size={22} className="text-muted-foreground/40" />
          </div>
          <p className="text-sm font-medium text-foreground">No approval requests</p>
          <p className="text-xs text-muted-foreground mt-1">
            {canSubmit
              ? 'Submit this collateral for perfection to create an approval request.'
              : 'No perfection requests have been linked to this collateral.'}
          </p>
          {canSubmit && (
            <button
              onClick={() => setShowSubmitModal(true)}
              className="mt-3 flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <ArrowUpCircle size={13} /> Submit for Perfection
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="rounded-lg border border-border/60 overflow-hidden">
              <button
                type="button"
                onClick={() => toggleExpand(req.id)}
                className="w-full flex items-center justify-between px-4 py-3 bg-muted/20 hover:bg-muted/40 transition-colors text-left"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <ClipboardList size={14} className="text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-600 text-foreground font-mono">{req.collateralId}</span>
                      <span className={`text-[10px] font-600 px-2 py-0.5 rounded ${workflowStatusColors[req.requestStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                        {req.requestStatus}
                      </span>
                      <span className={`text-[10px] font-600 ${priorityColors[req.priority] ?? 'text-muted-foreground'}`}>
                        {req.priority}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Submitted by {req.submittedByName} · {req.submittedAt ? new Date(req.submittedAt).toLocaleDateString() : new Date(req.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <ChevronDown
                  size={15}
                  className={`text-muted-foreground transition-transform shrink-0 ${expandedId === req.id ? 'rotate-180' : ''}`}
                />
              </button>

              {expandedId === req.id && (
                <div className="px-4 py-4 bg-white border-t border-border/40 space-y-4">
                  {/* Request details */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Registry</p>
                      <p className="font-medium text-foreground mt-0.5">{req.registry}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Deadline</p>
                      <p className="font-medium text-foreground mt-0.5">{req.perfectionDeadline || '—'}</p>
                    </div>
                    {req.reviewedByName && (
                      <div>
                        <p className="text-muted-foreground">Reviewed By</p>
                        <p className="font-medium text-foreground mt-0.5">{req.reviewedByName}</p>
                      </div>
                    )}
                    {req.reviewedAt && (
                      <div>
                        <p className="text-muted-foreground">Reviewed At</p>
                        <p className="font-medium text-foreground mt-0.5">{new Date(req.reviewedAt).toLocaleDateString()}</p>
                      </div>
                    )}
                    {req.decisionNotes && (
                      <div className="col-span-2">
                        <p className="text-muted-foreground">Decision Notes</p>
                        <p className="font-medium text-foreground mt-0.5 italic">{req.decisionNotes}</p>
                      </div>
                    )}
                  </div>

                  {/* Comments / Activity */}
                  <div>
                    <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <MessageSquare size={11} /> Activity Log
                    </p>
                    {loadingComments[req.id] ? (
                      <div className="flex items-center justify-center py-4"><Spinner size={4} /></div>
                    ) : (comments[req.id] ?? []).length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No activity recorded.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                        {(comments[req.id] ?? []).map((c) => (
                          <div key={c.id} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-muted/30 border border-border/40">
                            <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${actionColors[c.action] ?? 'bg-gray-100 text-gray-600'}`}>
                              {c.action.toUpperCase()}
                            </span>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs text-foreground">{c.comment}</p>
                              <p className="text-[10px] text-muted-foreground mt-0.5">
                                {c.performedByName} · {c.performedByRole} · {new Date(c.createdAt).toLocaleString()}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-end">
                    <Link
                      href="/approval-inbox"
                      className="flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      View in Approval Inbox <ChevronRight size={11} />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {showSubmitModal && user && (
        <PerfectionSubmitModal
          collateral={collateral}
          userId={user.id}
          userName={userProfile?.full_name || user.email || 'Unknown Officer'}
          userRole={userRole || 'Credit Officer'}
          onClose={() => setShowSubmitModal(false)}
          onSubmitted={() => { loadRequests(); onRefresh(); }}
        />
      )}
    </div>
  );
}

// ─── Valuation History Section ────────────────────────────────────────────────

function ValuationHistorySection({ collateral }: { collateral: CollateralRecord }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <SectionHeader title="Valuation History" icon={TrendingUp} />
      <ValuationHistoryTimeline
        collateralRecordId={collateral.id}
        collateralId={collateral.collateralId}
        currentValue={collateral.valuationAmount}
      />
    </div>
  );
}

// ─── Action Buttons Panel ─────────────────────────────────────────────────────

interface ActionButtonsPanelProps {
  collateral: CollateralRecord;
  onRefresh: () => void;
}

function ActionButtonsPanel({ collateral, onRefresh }: ActionButtonsPanelProps) {
  const { user, userProfile, userRole } = useAuth();
  const [statusModal, setStatusModal] = useState<CollateralStatus | null>(null);
  const [showPerfectionModal, setShowPerfectionModal] = useState(false);
  const [signOffs, setSignOffs] = useState<LegalSignOff[]>([]);
  const [loadingSignOffs, setLoadingSignOffs] = useState(true);
  const [showSignOffModal, setShowSignOffModal] = useState(false);

  const loadSignOffs = useCallback(async () => {
    setLoadingSignOffs(true);
    try {
      const data = await legalSignOffService.getByCollateral(collateral.id);
      setSignOffs(data);
    } catch {
      // silent
    } finally {
      setLoadingSignOffs(false);
    }
  }, [collateral.id]);

  useEffect(() => { loadSignOffs(); }, [loadSignOffs]);

  if (!user) return null;

  const activeSignOffs = signOffs.filter((s) => s.status === 'signed');
  const canSignOff = collateral.status === 'Perfected' && activeSignOffs.length === 0;

  // Determine available status transitions
  const statusTransitions: { status: CollateralStatus; label: string; icon: React.ElementType; variant: string }[] = [];

  if (collateral.status === 'Draft') {
    statusTransitions.push({ status: 'Submitted', label: 'Submit for Review', icon: Send, variant: 'blue' });
  }
  if (collateral.status === 'Submitted') {
    statusTransitions.push({ status: 'Under Review', label: 'Start Review', icon: ClipboardList, variant: 'amber' });
    statusTransitions.push({ status: 'Rejected', label: 'Reject', icon: Ban, variant: 'red' });
  }
  if (collateral.status === 'Under Review') {
    statusTransitions.push({ status: 'Perfected', label: 'Mark Perfected', icon: CheckSquare, variant: 'emerald' });
    statusTransitions.push({ status: 'Rejected', label: 'Reject', icon: Ban, variant: 'red' });
    statusTransitions.push({ status: 'Draft', label: 'Return to Draft', icon: RotateCcw, variant: 'gray' });
  }
  if (collateral.status === 'Perfected') {
    statusTransitions.push({ status: 'Monitoring', label: 'Place Under Monitoring', icon: Activity, variant: 'purple' });
    statusTransitions.push({ status: 'Released', label: 'Release Collateral', icon: RotateCcw, variant: 'red' });
  }
  if (collateral.status === 'Monitoring') {
    statusTransitions.push({ status: 'Released', label: 'Release Collateral', icon: RotateCcw, variant: 'red' });
  }
  if (collateral.status === 'Overdue') {
    statusTransitions.push({ status: 'Submitted', label: 'Re-Submit', icon: Send, variant: 'blue' });
  }
  if (collateral.status === 'Rejected') {
    statusTransitions.push({ status: 'Draft', label: 'Reopen as Draft', icon: RotateCcw, variant: 'gray' });
  }

  const variantClasses: Record<string, string> = {
    blue: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    amber: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100',
    red: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    purple: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100',
    gray: 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <SectionHeader title="Actions" icon={Activity} />

      <div className="space-y-3">
        {/* Status Change Actions */}
        {statusTransitions.length > 0 && (
          <div>
            <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-2">Status Changes</p>
            <div className="flex flex-col gap-2">
              {statusTransitions.map((t) => {
                const Icon = t.icon;
                return (
                  <button
                    key={t.status}
                    onClick={() => setStatusModal(t.status)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg border text-sm font-500 transition-colors ${variantClasses[t.variant]}`}
                  >
                    <Icon size={15} />
                    {t.label}
                    <ChevronRight size={13} className="ml-auto opacity-60" />
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Perfection Submission */}
        {collateral.requiresPerfection && !['Perfected', 'Released'].includes(collateral.status) && (
          <div>
            <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-2">Perfection</p>
            <button
              onClick={() => setShowPerfectionModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-primary/30 bg-primary/5 text-primary text-sm font-500 hover:bg-primary/10 transition-colors"
            >
              <ArrowUpCircle size={15} />
              Submit for Perfection
              <ChevronRight size={13} className="ml-auto opacity-60" />
            </button>
          </div>
        )}

        {/* Legal Sign-Off */}
        {canSignOff && (
          <div>
            <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-2">Legal</p>
            <button
              onClick={() => setShowSignOffModal(true)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm font-500 hover:bg-emerald-100 transition-colors"
            >
              <Stamp size={15} />
              Complete Legal Sign-Off
              <ChevronRight size={13} className="ml-auto opacity-60" />
            </button>
          </div>
        )}

        {activeSignOffs.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-emerald-50 border border-emerald-200">
            <BadgeCheck size={15} className="text-emerald-600 shrink-0" />
            <p className="text-xs text-emerald-700 font-500">
              {activeSignOffs.length} legal sign-off{activeSignOffs.length !== 1 ? 's' : ''} recorded
            </p>
          </div>
        )}

        {statusTransitions.length === 0 && !collateral.requiresPerfection && !canSignOff && (
          <div className="flex items-center gap-2 px-3 py-3 rounded-lg bg-muted/30 border border-border/60">
            <CheckCircle2 size={15} className="text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">No actions available for current status.</p>
          </div>
        )}
      </div>

      {/* Status Change Modal */}
      {statusModal && user && (
        <StatusChangeModal
          collateral={collateral}
          targetStatus={statusModal}
          userId={user.id}
          userName={userProfile?.full_name || user.email || 'Unknown Officer'}
          onClose={() => setStatusModal(null)}
          onChanged={() => { setStatusModal(null); onRefresh(); }}
        />
      )}

      {/* Perfection Submit Modal */}
      {showPerfectionModal && user && (
        <PerfectionSubmitModal
          collateral={collateral}
          userId={user.id}
          userName={userProfile?.full_name || user.email || 'Unknown Officer'}
          userRole={userRole || 'Credit Officer'}
          onClose={() => setShowPerfectionModal(false)}
          onSubmitted={() => { setShowPerfectionModal(false); onRefresh(); }}
        />
      )}

      {/* Legal Sign-Off Modal */}
      {showSignOffModal && user && (
        <LegalSignOffModal
          collateral={collateral}
          userId={user.id}
          userName={userProfile?.full_name || user.email || 'Unknown Officer'}
          userRole={userRole || 'Legal Officer'}
          onClose={() => setShowSignOffModal(false)}
          onSigned={() => { loadSignOffs(); onRefresh(); toast.success('Legal sign-off recorded'); }}
        />
      )}
    </div>
  );
}

// ─── Legal Sign-Off Modal (inline) ───────────────────────────────────────────

interface LegalSignOffModalProps {
  collateral: CollateralRecord;
  userId: string;
  userName: string;
  userRole: string;
  onClose: () => void;
  onSigned: () => void;
}

function LegalSignOffModal({ collateral, userId, userName, userRole, onClose, onSigned }: LegalSignOffModalProps) {
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    if (!confirmed) { setError('Please confirm the sign-off declaration before proceeding.'); return; }
    setSubmitting(true);
    setError('');
    try {
      const signOff = await legalSignOffService.create({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        signedBy: userId,
        signedByName: userName,
        signedByRole: userRole || 'Legal Officer',
        notes: notes.trim() || undefined,
      });
      if (!signOff) { setError('Sign-off failed. Please try again.'); setSubmitting(false); return; }
      await auditLogService.logLegalSignOff({
        collateralRecordId: collateral.id,
        collateralId: collateral.collateralId,
        performedBy: userId,
        performedByName: userName,
        notes: notes.trim(),
      });
      onSigned();
      onClose();
    } catch {
      setError('An error occurred. Please try again.');
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Stamp size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Legal Sign-Off</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-medium text-foreground">{collateral.collateralId}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            {[
              ['Obligor', collateral.obligor],
              ['Collateral Type', collateral.type],
              ['Registry', collateral.registry],
              ['Value', `TSh ${collateral.valueTSh}`],
              ['Signing Officer', userName],
            ].map(([label, value]) => (
              <div key={label} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-foreground">{value}</span>
              </div>
            ))}
          </div>

          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Sign-Off Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any observations or remarks…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input type="checkbox" checked={confirmed} onChange={(e) => { setConfirmed(e.target.checked); if (e.target.checked) setError(''); }} className="sr-only" />
              <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${confirmed ? 'bg-emerald-600 border-emerald-600' : 'border-border group-hover:border-emerald-400'}`}>
                {confirmed && <CheckCircle2 size={10} className="text-white" />}
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              I, <strong className="text-foreground">{userName}</strong>, confirm that I have reviewed this collateral record and hereby digitally sign off on its perfection status. This action is legally binding and will be permanently recorded in the audit trail.
            </p>
          </label>

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
            disabled={submitting || !confirmed}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <Stamp size={14} />}
            {submitting ? 'Signing…' : 'Sign Off'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Audit Trail Section ──────────────────────────────────────────────────────

function AuditTrailSection({ collateral }: { collateral: CollateralRecord }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditLogService
      .getAll({ search: collateral.collateralId }, 30)
      .then((data) => {
        const filtered = data.filter(
          (e) => e.collateralId === collateral.collateralId || e.collateralRecordId === collateral.id
        );
        setEntries(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collateral.id, collateral.collateralId]);

  const actionColors: Record<string, string> = {
    created: 'bg-green-100 text-green-700',
    updated: 'bg-blue-100 text-blue-700',
    status_changed: 'bg-purple-100 text-purple-700',
    deleted: 'bg-red-100 text-red-700',
    submitted: 'bg-amber-100 text-amber-700',
    approved: 'bg-green-100 text-green-700',
    rejected: 'bg-red-100 text-red-700',
    legal_sign_off: 'bg-emerald-100 text-emerald-700',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Audit Trail" icon={History} />
        <Link href="/audit-trail" className="text-xs text-primary hover:underline flex items-center gap-1">
          View All <ChevronRight size={11} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8"><Spinner /></div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <History size={28} className="text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No audit entries found</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
              <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${actionColors[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {(entry.action ?? '').replace(/_/g, ' ').toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-500 text-foreground">{entry.message}</p>
                {entry.detail && <p className="text-xs text-muted-foreground mt-0.5">{entry.detail}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[10px] text-muted-foreground">{entry.performedByName}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-[10px] text-muted-foreground">{new Date(entry.createdAt).toLocaleString()}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KPIStrip({ collateral }: { collateral: CollateralRecord }) {
  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;

  const deadlineLabel = collateral.daysToDeadline === null
    ? 'N/A'
    : isOverdue
      ? `${Math.abs(collateral.daysToDeadline)}d overdue`
      : `${collateral.daysToDeadline}d left`;

  const deadlineColor = isOverdue ? 'text-red-600' : isApproaching ? 'text-amber-600' : 'text-green-600';

  const kpis = [
    { label: 'Collateral Value', value: collateral.valueTSh ? `TSh ${collateral.valueTSh}` : '—', icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/5' },
    { label: 'LTV Ratio', value: collateral.ltvRatio != null ? `${(collateral.ltvRatio * 100).toFixed(1)}%` : '—', icon: PieChart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Available Equity', value: collateral.availableEquity != null ? `TSh ${(collateral.availableEquity / 1_000_000).toFixed(1)}M` : '—', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Days to Deadline', value: deadlineLabel, icon: Clock, color: deadlineColor, bg: isOverdue ? 'bg-red-50' : isApproaching ? 'bg-amber-50' : 'bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={`flex items-center gap-3 p-4 rounded-xl border border-border ${kpi.bg}`}>
          <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
            <kpi.icon size={16} className={kpi.color} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-sm font-700 truncate ${kpi.color}`}>{kpi.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollateralRecordContent({
  collateral,
  isLoading,
  error,
  onBack,
  onRefresh,
}: CollateralRecordContentProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'documents' | 'approvals' | 'valuation' | 'audit'>('overview');

  const handleSave = async (data: Partial<CollateralRecord>) => {
    if (!collateral) return;
    setSaving(true);
    try {
      const updated = await collateralService.update(collateral.id, data);
      if (updated) {
        await auditService.log({
          collateralRecordId: collateral.id,
          collateralId: collateral.collateralId,
          action: 'updated',
          message: `Collateral ${collateral.collateralId} updated`,
          detail: `${collateral.obligor} · ${collateral.type}`,
          performedBy: user?.id,
          performedByName: user?.email ?? '',
        });
        toast.success('Collateral record updated');
        setEditOpen(false);
        onRefresh();
      }
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <Spinner size={8} />
            <p className="text-sm text-muted-foreground">Loading collateral record…</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !collateral) {
    return (
      <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={15} /> Back to Collateral Registry
        </button>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-600 text-foreground">Record Not Found</p>
            <p className="text-sm text-muted-foreground mt-1">{error ?? 'The requested collateral record could not be found.'}</p>
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded-md text-sm font-500 hover:bg-primary/90 transition-colors">
            Return to Registry
          </button>
        </div>
      </div>
    );
  }

  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;

  const tabs = [
    { key: 'overview', label: 'Overview', icon: Shield },
    { key: 'documents', label: 'Documents', icon: Files },
    { key: 'approvals', label: 'Linked Approvals', icon: ClipboardList },
    { key: 'valuation', label: 'Valuation History', icon: TrendingUp },
    { key: 'audit', label: 'Audit Trail', icon: History },
  ] as const;

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft size={14} /> Collateral Registry
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-700 text-foreground font-mono">{collateral.collateralId}</h1>
            <Badge variant={statusBadgeMap[collateral.status]} label={collateral.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {collateral.obligor} · {collateral.type} · {collateral.registry}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link
            href={`/collateral-detail/${collateral.id}`}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <ExternalLink size={13} /> Full Detail View
          </Link>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} /> Refresh
          </button>
          {user && (
            <button
              onClick={() => setEditOpen(true)}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95"
            >
              <Pencil size={13} /> Edit Record
            </button>
          )}
        </div>
      </div>

      {/* Status Banners */}
      {isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-500">
            This collateral is overdue for perfection — {collateral.daysToDeadline !== null && Math.abs(collateral.daysToDeadline)} days past the submission deadline.
          </p>
        </div>
      )}
      {isApproaching && !isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <Clock size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-500">
            Perfection deadline approaching — {collateral.daysToDeadline} days remaining to submit to {collateral.registry}.
          </p>
        </div>
      )}

      {/* KPI Strip */}
      <KPIStrip collateral={collateral} />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-500 border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Overview */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            {/* Core Info */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SectionHeader title="Collateral Information" icon={Shield} />
                  <div className="space-y-3">
                    {[
                      { label: 'Collateral ID', value: <span className="font-mono font-600 text-primary">{collateral.collateralId}</span> },
                      { label: 'Obligor', value: <div><p className="font-500">{collateral.obligor}</p><p className="text-xs text-muted-foreground font-mono">{collateral.obligorId}</p></div> },
                      { label: 'Collateral Type', value: collateral.type },
                      { label: 'Asset Description', value: <p className="text-xs leading-relaxed">{collateral.description}</p> },
                      { label: 'Collateral Value', value: <span className="font-mono font-600">TSh {collateral.valueTSh}</span> },
                      { label: 'Facility ID', value: <span className="font-mono text-xs">{collateral.facilityId}</span> },
                      { label: 'Assigned Officer', value: collateral.assignedOfficer },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start gap-3 py-2 border-b border-border/60 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-500 text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                          <div className="text-sm text-foreground">{value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div>
                  <SectionHeader title="Perfection & Registry" icon={CheckCircle2} />
                  <div className="space-y-3">
                    {[
                      { label: 'Status', value: <Badge variant={statusBadgeMap[collateral.status]} label={collateral.status} /> },
                      { label: 'Registry', value: collateral.registry },
                      { label: 'Execution Date', value: collateral.registrationDate || '—' },
                      { label: 'Perfection Deadline', value: collateral.perfectionDeadline || '—' },
                      { label: 'Requires Perfection', value: collateral.requiresPerfection ? 'Yes' : 'No' },
                      { label: 'Created', value: collateral.createdAt ? new Date(collateral.createdAt).toLocaleDateString() : '—' },
                      { label: 'Last Updated', value: collateral.updatedAt ? new Date(collateral.updatedAt).toLocaleDateString() : '—' },
                    ].map(({ label, value }) => (
                      <div key={label} className="flex items-start gap-3 py-2 border-b border-border/60 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-500 text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
                          <div className="text-sm text-foreground">{value}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right column — Actions */}
          <div className="space-y-6">
            <ActionButtonsPanel collateral={collateral} onRefresh={onRefresh} />

            {/* Quick Links */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <SectionHeader title="Quick Links" icon={ExternalLink} />
              <div className="space-y-1">
                {[
                  { label: 'Full Detail View', href: `/collateral-detail/${collateral.id}`, icon: Shield },
                  { label: 'Approval Inbox', href: '/approval-inbox', icon: ClipboardList },
                  { label: 'Perfection Workflow', href: '/perfection-workflow', icon: Activity },
                  { label: 'Collateral Documents', href: '/collateral-documents', icon: Files },
                  { label: 'Audit Trail', href: '/audit-trail', icon: History },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <link.icon size={13} className="text-primary" />
                    </div>
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{link.label}</span>
                    <ChevronRight size={13} className="ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <DocumentsSection collateral={collateral} />
      )}

      {/* Tab: Linked Approvals */}
      {activeTab === 'approvals' && (
        <LinkedApprovalsSection collateral={collateral} onRefresh={onRefresh} />
      )}

      {/* Tab: Valuation History */}
      {activeTab === 'valuation' && (
        <ValuationHistorySection collateral={collateral} />
      )}

      {/* Tab: Audit Trail */}
      {activeTab === 'audit' && (
        <AuditTrailSection collateral={collateral} />
      )}

      {/* Edit Modal */}
      <AddEditCollateralModal
        open={editOpen}
        editItem={collateral}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
