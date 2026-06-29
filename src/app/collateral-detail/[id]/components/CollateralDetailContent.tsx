'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Pencil,
  ExternalLink,
  Shield,
  FileText,
  Calendar,
  User,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  MapPin,
  Files,
  History,
  ShieldAlert,
  RefreshCw,
  Download,
  Upload,
  Trash2,
  ChevronRight,
  Activity,
  PieChart,
  BookOpen,
  TrendingUp,
  Layers,
  Plus,
  X,
  AlertCircle,
  ChevronDown,
  FileImage,
  FileType2,
  File,
} from 'lucide-react';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import { CollateralRecord, CollateralStatus, auditService } from '@/lib/supabase/collateralService';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { auditLogService, AuditLogEntry } from '@/lib/supabase/auditLogService';
import { fetchFraudAlerts, FraudAlertRow } from '@/lib/supabase/fraudAlertService';
import { perfectionService, PerfectionRequest } from '@/lib/supabase/perfectionService';
import AddEditCollateralModal from '@/app/collateral-management/components/AddEditCollateralModal';
import { collateralService } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import CollateralUtilizationTab from './CollateralUtilizationTab';



// ─── Types ────────────────────────────────────────────────────────────────────

interface CollateralDetailContentProps {
  collateral: CollateralRecord | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const statusBadgeMap: Record<CollateralStatus, 'perfected' | 'pending' | 'overdue' | 'draft' | 'released' | 'monitoring' | 'rejected' | 'under-review' | 'submitted'> = {
  Draft: 'draft',
  Submitted: 'submitted',
  'Under Review': 'under-review',
  Perfected: 'perfected',
  Monitoring: 'monitoring',
  Released: 'released',
  Overdue: 'overdue',
  Rejected: 'rejected',
};

const registryLinks: Record<string, string> = {
  BRELA: 'https://ors.brela.go.tz',
  'Lands Registry': 'https://ardhi.go.tz',
  TRA: 'https://www.tra.go.tz',
  DSE: 'https://www.dse.co.tz',
  TASAC: 'https://www.tasac.go.tz',
};

const fraudAlertTypeLabels: Record<string, string> = {
  DUPLICATE_TITLE: 'Duplicate Title',
  IDENTITY_MISMATCH: 'Identity Mismatch',
  VALUATION_ANOMALY: 'Valuation Anomaly',
  EARLY_WARNING: 'Early Warning',
  DOCUMENT_FORGERY: 'Document Forgery',
};

const fraudStatusColors: Record<string, string> = {
  PENDING_REVIEW: 'bg-amber-100 text-amber-700',
  FALSE_POSITIVE: 'bg-gray-100 text-gray-600',
  ESCALATED: 'bg-red-100 text-red-700',
  RESOLVED: 'bg-green-100 text-green-700',
};

// ─── Dynamic Perfection Timeline ──────────────────────────────────────────────

function getPerfectionTimeline(status: CollateralStatus) {
  const steps = [
    { step: 'Security Document Executed', statuses: ['Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected'] },
    { step: 'Collateral Registered in CMS', statuses: ['Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected'] },
    { step: 'Legal Review & Approval', statuses: ['Under Review', 'Perfected', 'Monitoring', 'Released'] },
    { step: 'Registry Submission Filed', statuses: ['Perfected', 'Monitoring', 'Released'] },
    { step: 'Registry Confirmation Received', statuses: ['Perfected', 'Monitoring', 'Released'] },
    { step: 'Perfection Confirmed', statuses: ['Perfected', 'Released'] },
  ];
  return steps.map(s => ({ step: s.step, done: s.statuses.includes(status) }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon: IconComponent }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        {IconComponent && React.createElement(IconComponent, { size: 14, className: "text-primary" })}
      </div>
      <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function DetailRow({ label, value, icon: RowIcon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-0">
      {RowIcon && (
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          {React.createElement(RowIcon, { size: 13, className: "text-muted-foreground" })}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-500 text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
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

  const deadlineColor = isOverdue
    ? 'text-red-600'
    : isApproaching
      ? 'text-amber-600' :'text-green-600';

  const kpis = [
    {
      label: 'Collateral Value',
      value: collateral.valueTSh ? `TSh ${collateral.valueTSh}` : '—',
      icon: TrendingUp,
      color: 'text-primary',
      bg: 'bg-primary/5',
    },
    {
      label: 'Utilization',
      value: (collateral as any).utilization_pct != null ? `${Number((collateral as any).utilization_pct).toFixed(1)}%` : '—',
      icon: PieChart,
      color: 'text-blue-600',
      bg: 'bg-blue-50',
    },
    {
      label: 'Active Charges',
      value: (collateral as any).active_charges != null ? String((collateral as any).active_charges) : '—',
      icon: Layers,
      color: 'text-purple-600',
      bg: 'bg-purple-50',
    },
    {
      label: 'Days to Deadline',
      value: deadlineLabel,
      icon: Clock,
      color: deadlineColor,
      bg: isOverdue ? 'bg-red-50' : isApproaching ? 'bg-amber-50' : 'bg-green-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={`flex items-center gap-3 p-4 rounded-xl border border-border ${kpi.bg}`}>
          <div className={`w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm`}>
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

// ─── Map Section ──────────────────────────────────────────────────────────────

function GeoSection({ collateral }: { collateral: CollateralRecord }) {
  const hasGoogleMaps = typeof process !== 'undefined' && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY && process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY !== 'your-google-maps-api-key-here';

  const addressQuery = encodeURIComponent(
    `${collateral.description}, Tanzania`
  );

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <SectionHeader title="Geolocation" icon={MapPin} />
      <div className="rounded-lg overflow-hidden border border-border bg-muted/30">
        {hasGoogleMaps ? (
          <iframe
            title="Collateral Location"
            width="100%"
            height="280"
            style={{ border: 0 }}
            loading="lazy"
            allowFullScreen
            src={`https://www.google.com/maps/embed/v1/search?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${addressQuery}`}
          />
        ) : (
          <div className="h-64 flex flex-col items-center justify-center gap-3 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <MapPin size={22} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-600 text-foreground">Geomapping Available</p>
              <p className="text-xs text-muted-foreground mt-1">
                Configure <span className="font-mono text-xs bg-muted px-1 rounded">NEXT_PUBLIC_GOOGLE_MAPS_API_KEY</span> to enable interactive maps.
              </p>
            </div>
            <Link
              href="/geomapping"
              className="flex items-center gap-1.5 text-xs text-primary hover:underline font-500"
            >
              View in Geomapping Module <ChevronRight size={12} />
            </Link>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
        <MapPin size={12} />
        <span>Asset location derived from collateral description and registry data</span>
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

function UploadDocumentModal({ collateral, userId, userName, onClose, onUploaded }: UploadDocumentModalProps) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<DocumentType>('Other');
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
      selectedFile,
      collateral.id,
      collateral.collateralId,
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
        {/* Header */}
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
                {getFileIconDetail(selectedFile.type)}
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

          {/* Document type */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Document Type</label>
            <div className="relative">
              <select
                value={docType}
                onChange={(e) => setDocType(e.target.value as DocumentType)}
                className="w-full appearance-none border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 pr-8"
              >
                {DOC_TYPE_OPTIONS.map((t) => (
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

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors"
          >
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

// ─── Documents Section ────────────────────────────────────────────────────────

function DocumentsSection({ collateral }: { collateral: CollateralRecord }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CollateralDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const data = await documentService.getByCollateralId(collateral.id);
    setDocs(data);
    setLoading(false);
  }, [collateral.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleDelete = async (doc: CollateralDocument) => {
    const ok = await documentService.delete(doc);
    if (ok) {
      toast.success('Document removed');
      loadDocs();
    } else {
      toast.error('Failed to remove document');
    }
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Related Documents" icon={Files} />
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
          {user && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={13} />
              Upload
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
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Files size={28} className="text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
          <p className="text-xs text-muted-foreground/70 mt-0.5">Upload title deeds, charge certificates, and other supporting documents.</p>
          {user && (
            <button
              onClick={() => setShowUploadModal(true)}
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors"
            >
              <Upload size={13} />
              Upload First Document
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/60 bg-muted/20 hover:bg-muted/40 transition-colors group">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <FileText size={14} className="text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-500 text-foreground truncate">{doc.fileName}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground">{doc.documentType}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">v{doc.version}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</span>
                </div>
                {doc.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{doc.notes}</p>}
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {doc.signedUrl && (
                  <a
                    href={doc.signedUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                    title="Download"
                  >
                    <Download size={13} />
                  </a>
                )}
                <button
                  onClick={() => handleDelete(doc)}
                  className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                  title="Delete"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showUploadModal && user && (
        <UploadDocumentModal
          collateral={collateral}
          userId={user.id}
          userName={user.email ?? 'Unknown'}
          onClose={() => setShowUploadModal(false)}
          onUploaded={() => { loadDocs(); toast.success('Document uploaded successfully'); }}
        />
      )}
    </div>
  );
}

// ─── Audit Trail Section ──────────────────────────────────────────────────────

function AuditTrailSection({ collateral }: { collateral: CollateralRecord }) {
  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    auditLogService
      .getAll({ search: collateral.collateralId }, 50)
      .then((data) => {
        const filtered = data.filter(
          (e) =>
            e.collateralId === collateral.collateralId ||
            e.collateralRecordId === collateral.id
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
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Security & Compliance Trail" icon={History} />
        <Link href="/audit-trail" className="text-xs text-primary hover:underline flex items-center gap-1">
          View All <ChevronRight size={11} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <History size={28} className="text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">No audit entries found for this collateral</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
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
                  {entry.ipAddress && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-[10px] font-mono text-muted-foreground">{entry.ipAddress}</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Risk & Compliance Sidebar Card (merged Fraud + Workflow) ─────────────────

function RiskComplianceSidebarCard({ collateral }: { collateral: CollateralRecord }) {
  const [activePanel, setActivePanel] = useState<'fraud' | 'workflow'>('fraud');

  // Fraud state
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [fraudLoading, setFraudLoading] = useState(true);

  // Workflow state
  const [requests, setRequests] = useState<PerfectionRequest[]>([]);
  const [workflowLoading, setWorkflowLoading] = useState(true);

  useEffect(() => {
    fetchFraudAlerts()
      .then((data) => {
        const filtered = data.filter(
          (a) => a.collateral_id === collateral.id || a.collateral_id === collateral.collateralId
        );
        setAlerts(filtered);
      })
      .catch(() => {})
      .finally(() => setFraudLoading(false));
  }, [collateral.id, collateral.collateralId]);

  useEffect(() => {
    perfectionService
      .getAll()
      .then((data) => {
        const filtered = data.filter(
          (r) => r.collateralId === collateral.collateralId || r.collateralRecordId === collateral.id
        );
        setRequests(filtered);
      })
      .catch(() => {})
      .finally(() => setWorkflowLoading(false));
  }, [collateral.id, collateral.collateralId]);

  const timeline = getPerfectionTimeline(collateral.status);

  const workflowStatusColors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600',
    Submitted: 'bg-blue-100 text-blue-700',
    'Under Review': 'bg-amber-100 text-amber-700',
    Approved: 'bg-green-100 text-green-700',
    Perfected: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Returned: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
      {/* Card header */}
      <div className="flex items-center gap-2 px-5 pt-5 pb-3">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Risk &amp; Compliance</h2>
      </div>

      {/* Tab switcher */}
      <div className="flex border-b border-border mx-5">
        <button
          onClick={() => setActivePanel('fraud')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-600 border-b-2 transition-colors -mb-px ${
            activePanel === 'fraud' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldAlert size={12} />
          Fraud
          {alerts.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px] font-700">{alerts.length}</span>
          )}
        </button>
        <button
          onClick={() => setActivePanel('workflow')}
          className={`flex items-center gap-1.5 px-3 py-2 text-xs font-600 border-b-2 transition-colors -mb-px ${
            activePanel === 'workflow' ?'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <Activity size={12} />
          Workflow
        </button>
      </div>

      <div className="p-5">
        {/* ── Fraud Panel ── */}
        {activePanel === 'fraud' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">AI-detected fraud signals</p>
              <Link href="/fraud-prevention" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ChevronRight size={11} />
              </Link>
            </div>
            {fraudLoading ? (
              <div className="flex items-center justify-center py-6">
                <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
                <CheckCircle2 size={16} className="text-green-600 shrink-0" />
                <p className="text-sm text-green-700 font-500">No fraud alerts detected</p>
              </div>
            ) : (
              <div className="space-y-2">
                {alerts.map((alert) => (
                  <div key={alert.id} className="p-3 rounded-lg border border-red-200 bg-red-50">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-600 text-red-700">{fraudAlertTypeLabels[alert.alert_type] ?? alert.alert_type}</span>
                      <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded ${fraudStatusColors[alert.status] ?? 'bg-gray-100 text-gray-600'}`}>
                        {alert.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-red-600">Risk: <strong>{alert.risk_score}</strong></span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-red-600">Conf: <strong>{alert.confidence}%</strong></span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Workflow Panel ── */}
        {activePanel === 'workflow' && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-muted-foreground">Perfection progress</p>
              <Link href="/perfection-workflow" className="text-xs text-primary hover:underline flex items-center gap-1">
                View All <ChevronRight size={11} />
              </Link>
            </div>

            {/* Dynamic timeline */}
            <div className="space-y-2 mb-5">
              {timeline.map((step, idx) => (
                <div key={`step-${idx}`} className="flex items-center gap-2.5">
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    {step.done ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-700">{idx + 1}</span>}
                  </div>
                  <p className={`text-xs ${step.done ? 'text-foreground font-500' : 'text-muted-foreground'}`}>{step.step}</p>
                </div>
              ))}
            </div>

            {/* Live requests */}
            {workflowLoading ? (
              <div className="flex items-center justify-center py-4">
                <svg className="animate-spin w-4 h-4 text-primary" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              </div>
            ) : requests.length > 0 ? (
              <div className="space-y-2 border-t border-border pt-4">
                <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-2">Perfection Requests</p>
                {requests.map((req) => (
                  <div key={req.id} className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/20">
                    <div>
                      <p className="text-xs font-500 text-foreground">{req.collateralId}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {req.submittedByName} · {new Date(req.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <span className={`text-[10px] font-600 px-2 py-0.5 rounded ${workflowStatusColors[req.requestStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                      {req.requestStatus}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollateralDetailContent({
  collateral,
  isLoading,
  error,
  onBack,
  onRefresh,
}: CollateralDetailContentProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'charges' | 'documents'>('profile');

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

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-muted-foreground">Loading collateral record…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
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
  const registryUrl = registryLinks[collateral.registry];

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
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
            href={`/collateral-library/${collateral.id}`}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <BookOpen size={13} />
            View in Library
          </Link>
          <button
            onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} />
            Refresh
          </button>
          <button
            onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Pencil size={13} />
            Edit Record
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-500">
            This collateral is overdue for perfection — {collateral.daysToDeadline !== null && Math.abs(collateral.daysToDeadline)} days past the submission deadline. Immediate action required.
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

      {/* ── KPI Strip ── */}
      <KPIStrip collateral={collateral} />

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {[
          { key: 'profile', label: 'Profile', icon: Shield },
          { key: 'charges', label: 'Charges & Loans', icon: PieChart },
          { key: 'documents', label: 'Documents & History', icon: Files },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'profile' | 'charges' | 'documents')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-500 border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Tab: Profile ── */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Left column — core details */}
          <div className="xl:col-span-2 space-y-6">
            {/* Core Info Card */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Collateral Information */}
                <div>
                  <SectionHeader title="Collateral Information" icon={Shield} />
                  <div className="bg-muted/30 rounded-lg px-3 py-1">
                    <DetailRow label="Collateral ID" value={<span className="font-mono font-600 text-primary">{collateral.collateralId}</span>} icon={Shield} />
                    <DetailRow
                      label="Obligor"
                      value={
                        <div>
                          <p className="font-500">{collateral.obligor}</p>
                          <p className="text-xs text-muted-foreground font-mono">{collateral.obligorId}</p>
                        </div>
                      }
                      icon={Building2}
                    />
                    <DetailRow label="Collateral Type" value={collateral.type} icon={FileText} />
                    <DetailRow label="Asset Description" value={<p className="text-xs leading-relaxed">{collateral.description}</p>} icon={FileText} />
                    <DetailRow
                      label="Collateral Value"
                      value={<span className="font-mono font-600 text-base">TSh {collateral.valueTSh}</span>}
                      icon={Building2}
                    />
                    <DetailRow label="Facility ID" value={<span className="font-mono text-xs">{collateral.facilityId}</span>} icon={FileText} />
                    <DetailRow label="Assigned Officer" value={collateral.assignedOfficer} icon={User} />
                  </div>
                </div>

                {/* Perfection & Registry */}
                <div>
                  <SectionHeader title="Perfection & Registry" icon={CheckCircle2} />
                  <div className="bg-muted/30 rounded-lg px-3 py-1">
                    <DetailRow
                      label="Perfection Status"
                      value={<Badge variant={statusBadgeMap[collateral.status]} label={collateral.status} />}
                      icon={Shield}
                    />
                    <DetailRow
                      label="Target Registry"
                      value={
                        collateral.registry !== 'N/A' && registryUrl ? (
                          <a href={registryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-500">
                            {collateral.registry} <ExternalLink size={11} />
                          </a>
                        ) : (
                          <span className="text-muted-foreground">{collateral.registry}</span>
                        )
                      }
                      icon={Building2}
                    />
                    <DetailRow label="Execution Date" value={collateral.registrationDate || '—'} icon={Calendar} />
                    <DetailRow
                      label="Perfection Deadline"
                      value={
                        collateral.perfectionDeadline ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={isOverdue ? 'text-red-600 font-500' : isApproaching ? 'text-amber-600 font-500' : 'text-foreground'}>
                              {collateral.perfectionDeadline}
                            </span>
                            {collateral.daysToDeadline !== null && (
                              <span className={`text-xs px-1.5 py-0.5 rounded font-500 ${isOverdue ? 'bg-red-100 text-red-700' : isApproaching ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                {isOverdue ? `${Math.abs(collateral.daysToDeadline)}d overdue` : `${collateral.daysToDeadline}d remaining`}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground text-xs">Not required</span>
                        )
                      }
                      icon={Clock}
                    />
                    <DetailRow
                      label="Requires Perfection"
                      value={
                        collateral.requiresPerfection ? (
                          <span className="flex items-center gap-1 text-foreground"><CheckCircle2 size={13} className="text-green-600" /> Yes</span>
                        ) : (
                          <span className="text-muted-foreground">No (Guarantee / FDR)</span>
                        )
                      }
                      icon={Shield}
                    />
                    <DetailRow label="Created" value={collateral.createdAt ? new Date(collateral.createdAt).toLocaleString() : '—'} icon={Calendar} />
                    <DetailRow label="Last Updated" value={collateral.updatedAt ? new Date(collateral.updatedAt).toLocaleString() : '—'} icon={Calendar} />
                  </div>
                </div>
              </div>
            </div>

            {/* Geomapping */}
            <GeoSection collateral={collateral} />
          </div>

          {/* Right column — Risk & Compliance + Quick Links */}
          <div className="space-y-6">
            {/* Merged Risk & Compliance card */}
            <RiskComplianceSidebarCard collateral={collateral} />

            {/* Quick Links */}
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <SectionHeader title="Quick Links" icon={ExternalLink} />
              <div className="space-y-2">
                {[
                  { label: 'Collateral Documents', href: '/collateral-documents', icon: Files },
                  { label: 'Perfection Workflow', href: '/perfection-workflow', icon: Activity },
                  { label: 'Fraud Prevention', href: '/fraud-prevention', icon: ShieldAlert },
                  { label: 'Security & Compliance Trail', href: '/audit-trail', icon: History },
                  { label: 'Geomapping', href: '/geomapping', icon: MapPin },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                  >
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      {link.icon && <link.icon size={13} className="text-primary" />}
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

      {/* ── Tab: Charges & Loans ── */}
      {activeTab === 'charges' && (
        <CollateralUtilizationTab collateral={collateral} />
      )}

      {/* ── Tab: Documents & History ── */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <DocumentsSection collateral={collateral} />
          <AuditTrailSection collateral={collateral} />
        </div>
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
