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

const perfectionTimeline = [
  { step: 'Security Document Executed', done: true },
  { step: 'Collateral Registered in CMS', done: true },
  { step: 'Legal Review & Approval', done: true },
  { step: 'Registry Submission Filed', done: false },
  { step: 'Registry Confirmation Received', done: false },
  { step: 'Perfection Confirmed', done: false },
];

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

// ─── Documents Section ────────────────────────────────────────────────────────

function DocumentsSection({ collateral }: { collateral: CollateralRecord }) {
  const { user } = useAuth();
  const [docs, setDocs] = useState<CollateralDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [docType, setDocType] = useState<DocumentType>('Title Deed');
  const [notes, setNotes] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const data = await documentService.getByCollateralId(collateral.id);
    setDocs(data);
    setLoading(false);
  }, [collateral.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setUploading(true);
    try {
      const result = await documentService.upload(
        file,
        collateral.id,
        collateral.collateralId,
        docType,
        notes,
        user.id,
        user.email ?? 'Unknown'
      );
      if (result) {
        toast.success('Document uploaded successfully');
        setNotes('');
        loadDocs();
      } else {
        toast.error('Upload failed');
      }
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (doc: CollateralDocument) => {
    const ok = await documentService.delete(doc);
    if (ok) {
      toast.success('Document removed');
      loadDocs();
    } else {
      toast.error('Failed to remove document');
    }
  };

  const docTypeOptions: DocumentType[] = [
    'Title Deed', 'Charge Certificate', 'Valuation Report', 'BRELA Confirmation',
    'Insurance Certificate', 'Board Resolution', 'Other',
  ];

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Related Documents" icon={Files} />
        <span className="text-xs text-muted-foreground">{docs.length} file{docs.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Upload row */}
      <div className="flex flex-wrap items-center gap-2 mb-4 p-3 bg-muted/30 rounded-lg border border-border/60">
        <select
          value={docType}
          onChange={(e) => setDocType(e.target.value as DocumentType)}
          className="text-xs border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {docTypeOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <input
          type="text"
          placeholder="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="flex-1 min-w-[120px] text-xs border border-border rounded-md px-2 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-md text-xs font-600 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-60"
        >
          <Upload size={12} />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleUpload} />
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
          <p className="text-xs text-muted-foreground/70 mt-0.5">Upload title deeds, charge certificates, and other supporting documents above.</p>
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
        <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
          {entries.map((entry) => (
            <div key={entry.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-muted/20">
              <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded shrink-0 mt-0.5 ${actionColors[entry.action] ?? 'bg-gray-100 text-gray-600'}`}>
                {entry.action.replace(/_/g, ' ').toUpperCase()}
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

// ─── Fraud Alerts Section ─────────────────────────────────────────────────────

function FraudAlertsSection({ collateral }: { collateral: CollateralRecord }) {
  const [alerts, setAlerts] = useState<FraudAlertRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchFraudAlerts()
      .then((data) => {
        const filtered = data.filter(
          (a) => a.collateral_id === collateral.id || a.collateral_id === collateral.collateralId
        );
        setAlerts(filtered);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [collateral.id, collateral.collateralId]);

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Fraud Alerts" icon={ShieldAlert} />
        <Link href="/fraud-prevention" className="text-xs text-primary hover:underline flex items-center gap-1">
          View All <ChevronRight size={11} />
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-6">
          <svg className="animate-spin w-5 h-5 text-primary" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
        </div>
      ) : alerts.length === 0 ? (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-green-50 border border-green-200">
          <CheckCircle2 size={16} className="text-green-600 shrink-0" />
          <p className="text-sm text-green-700 font-500">No fraud alerts detected for this collateral</p>
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
                <span className="text-xs text-red-600">Risk Score: <strong>{alert.risk_score}</strong></span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-red-600">Confidence: <strong>{alert.confidence}%</strong></span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground">{new Date(alert.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Perfection Workflow Section ──────────────────────────────────────────────

function WorkflowSection({ collateral }: { collateral: CollateralRecord }) {
  const [requests, setRequests] = useState<PerfectionRequest[]>([]);
  const [loading, setLoading] = useState(true);

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
      .finally(() => setLoading(false));
  }, [collateral.id, collateral.collateralId]);

  const statusColors: Record<string, string> = {
    Draft: 'bg-gray-100 text-gray-600',
    Submitted: 'bg-blue-100 text-blue-700',
    'Under Review': 'bg-amber-100 text-amber-700',
    Approved: 'bg-green-100 text-green-700',
    Perfected: 'bg-emerald-100 text-emerald-700',
    Rejected: 'bg-red-100 text-red-700',
    Returned: 'bg-orange-100 text-orange-700',
  };

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center justify-between mb-4">
        <SectionHeader title="Perfection Workflow" icon={Activity} />
        <Link href="/perfection-workflow" className="text-xs text-primary hover:underline flex items-center gap-1">
          View All <ChevronRight size={11} />
        </Link>
      </div>

      {/* Static timeline */}
      <div className="space-y-2 mb-5">
        {perfectionTimeline.map((step, idx) => (
          <div key={`step-${idx}`} className="flex items-center gap-2.5">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
              {step.done ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-700">{idx + 1}</span>}
            </div>
            <p className={`text-xs ${step.done ? 'text-foreground font-500' : 'text-muted-foreground'}`}>{step.step}</p>
          </div>
        ))}
      </div>

      {/* Live requests */}
      {loading ? (
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
              <span className={`text-[10px] font-600 px-2 py-0.5 rounded ${statusColors[req.requestStatus] ?? 'bg-gray-100 text-gray-600'}`}>
                {req.requestStatus}
              </span>
            </div>
          ))}
        </div>
      ) : null}
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
  const [activeTab, setActiveTab] = useState<'overview' | 'utilization'>('overview');

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
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
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
        <div className="flex items-center gap-2 shrink-0">
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
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-5">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-500">
            This collateral is overdue for perfection — {collateral.daysToDeadline !== null && Math.abs(collateral.daysToDeadline)} days past the submission deadline. Immediate action required.
          </p>
        </div>
      )}
      {isApproaching && !isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-5">
          <Clock size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-500">
            Perfection deadline approaching — {collateral.daysToDeadline} days remaining to submit to {collateral.registry}.
          </p>
        </div>
      )}

      {/* ── Tab Navigation ── */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {[
          { key: 'overview', label: 'Overview', icon: Shield },
          { key: 'utilization', label: 'Utilization & Charges', icon: PieChart },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as 'overview' | 'utilization')}
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

      {/* ── Tab: Overview ── */}
      {activeTab === 'overview' && (
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

            {/* Documents */}
            <DocumentsSection collateral={collateral} />

            {/* Audit Trail */}
            <AuditTrailSection collateral={collateral} />
          </div>

          {/* Right column — intelligence panels */}
          <div className="space-y-6">
            {/* Fraud Alerts */}
            <FraudAlertsSection collateral={collateral} />

            {/* Workflow */}
            <WorkflowSection collateral={collateral} />

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

      {/* ── Tab: Utilization & Charges ── */}
      {activeTab === 'utilization' && (
        <CollateralUtilizationTab collateral={collateral} />
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
