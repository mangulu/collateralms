'use client';
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Upload, FileText, Trash2, Download, Eye, Clock, AlertTriangle,
  CheckCircle2, X, RefreshCw, Shield, FileType2, FileImage, File,
  ChevronDown, ChevronUp, History, Plus, Calendar, Building2, Hash,
  AlertCircle, Loader2,
} from 'lucide-react';
import {
  pledgeDocumentService,
  PledgeDocument,
  PledgeDocumentAccessLog,
  PledgeDocumentType,
  PLEDGE_DOCUMENT_TYPES,
  DOC_TYPE_META,
  getExpiryStatus,
  getDaysUntilExpiry,
} from '@/lib/supabase/pledgeDocumentService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null): string {
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

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={16} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={16} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={16} className="text-indigo-500" />;
  return <FileText size={16} className="text-slate-500" />;
}

// ─── Expiry Badge ─────────────────────────────────────────────────────────────

function ExpiryBadge({ expiryDate }: { expiryDate: string | null }) {
  const status = getExpiryStatus(expiryDate);
  const days = getDaysUntilExpiry(expiryDate);

  if (status === 'no_expiry') {
    return <span className="inline-flex items-center gap-1 text-xs text-slate-400">No expiry</span>;
  }

  const configs = {
    expired:       { cls: 'bg-red-100 text-red-700 border-red-200',     icon: <AlertTriangle size={11} />, label: `Expired ${Math.abs(days!)}d ago` },
    expiring_soon: { cls: 'bg-amber-100 text-amber-700 border-amber-200', icon: <Clock size={11} />,         label: `Expires in ${days}d` },
    valid:         { cls: 'bg-green-100 text-green-700 border-green-200', icon: <CheckCircle2 size={11} />,   label: formatDate(expiryDate) },
  };

  const cfg = configs[status];
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-500 border ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

// ─── Upload Modal ─────────────────────────────────────────────────────────────

interface UploadModalProps {
  obligorId: string;
  userId: string;
  userName: string;
  onClose: () => void;
  onUploaded: () => void;
}

const ALLOWED_MIME = [
  'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
  'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function UploadModal({ obligorId, userId, userName, onClose, onUploaded }: UploadModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [docType, setDocType] = useState<PledgeDocumentType>('Other');
  const [notes, setNotes] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [issuedDate, setIssuedDate] = useState('');
  const [issuer, setIssuer] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    if (!ALLOWED_MIME.includes(f.type)) {
      setError('Only PDF, Word, and image files are allowed.');
      return;
    }
    if (f.size > 10 * 1024 * 1024) {
      setError('File size must be under 10 MB.');
      return;
    }
    setError('');
    setSelectedFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const handleSubmit = async () => {
    if (!selectedFile) { setError('Please select a file.'); return; }
    setUploading(true);
    setError('');
    const result = await pledgeDocumentService.upload(selectedFile, obligorId, docType, {
      notes, expiryDate, issuedDate, issuer, referenceNumber, userId, userName,
    });
    setUploading(false);
    if ('error' in result && result.error) {
      setError(result.error);
    } else {
      onUploaded();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Upload size={15} className="text-primary" />
            </div>
            <h2 className="text-sm font-700 text-foreground">Upload Pledge Document</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-colors ${
              dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'
            }`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            {selectedFile ? (
              <div className="flex items-center justify-center gap-2 text-sm text-foreground">
                {getFileIcon(selectedFile.type)}
                <span className="font-500">{selectedFile.name}</span>
                <span className="text-muted-foreground">({formatBytes(selectedFile.size)})</span>
              </div>
            ) : (
              <div className="space-y-1">
                <Upload size={24} className="mx-auto text-muted-foreground" />
                <p className="text-sm font-500 text-foreground">Drop file here or click to browse</p>
                <p className="text-xs text-muted-foreground">PDF, Word, JPEG, PNG — max 10 MB</p>
              </div>
            )}
          </div>

          {/* Document Type */}
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Document Type <span className="text-red-500">*</span></label>
            <select
              value={docType}
              onChange={(e) => setDocType(e.target.value as PledgeDocumentType)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {PLEDGE_DOCUMENT_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Issued Date</label>
              <input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Expiry Date</label>
              <input
                type="date"
                value={expiryDate}
                onChange={(e) => setExpiryDate(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Issuer + Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Issuer / Authority</label>
              <input
                type="text"
                value={issuer}
                onChange={(e) => setIssuer(e.target.value)}
                placeholder="e.g. BRELA, Insurer name"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Reference No.</label>
              <input
                type="text"
                value={referenceNumber}
                onChange={(e) => setReferenceNumber(e.target.value)}
                placeholder="Doc reference number"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Optional notes about this document…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-500 text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={uploading || !selectedFile}
              className="flex items-center gap-2 px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {uploading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
              {uploading ? 'Uploading…' : 'Upload Document'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Expiry Edit Modal ────────────────────────────────────────────────────────

interface ExpiryEditModalProps {
  doc: PledgeDocument;
  userId: string;
  userName: string;
  onClose: () => void;
  onUpdated: () => void;
}

function ExpiryEditModal({ doc, userId, userName, onClose, onUpdated }: ExpiryEditModalProps) {
  const [expiryDate, setExpiryDate] = useState(doc.expiryDate ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!expiryDate) { setError('Please select an expiry date.'); return; }
    setSaving(true);
    const result = await pledgeDocumentService.updateExpiry(doc.id, doc.obligorId, expiryDate, userId, userName);
    setSaving(false);
    if (result.error) { setError(result.error); } else { onUpdated(); onClose(); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-700 text-foreground">Update Expiry Date</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-xs text-muted-foreground">Document: <span className="font-500 text-foreground">{doc.fileName}</span></p>
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">New Expiry Date</label>
            <input
              type="date"
              value={expiryDate}
              onChange={(e) => setExpiryDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={14} />{error}
            </div>
          )}
          <div className="flex items-center justify-end gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">Cancel</button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Access Log Tab ───────────────────────────────────────────────────────────

const ACTION_META: Record<string, { color: string; label: string }> = {
  uploaded:       { color: 'bg-blue-100 text-blue-700',   label: 'Uploaded' },
  viewed:         { color: 'bg-slate-100 text-slate-600', label: 'Viewed' },
  downloaded:     { color: 'bg-teal-100 text-teal-700',   label: 'Downloaded' },
  deleted:        { color: 'bg-red-100 text-red-700',     label: 'Deleted' },
  expiry_updated: { color: 'bg-amber-100 text-amber-700', label: 'Expiry Updated' },
};

function AccessLogTab({ obligorId }: { obligorId: string }) {
  const [logs, setLogs] = useState<PledgeDocumentAccessLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    pledgeDocumentService.getAccessLog(obligorId).then((data) => {
      setLogs(data);
      setLoading(false);
    });
  }, [obligorId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
        <Loader2 size={16} className="animate-spin" />
        <span className="text-sm">Loading audit log…</span>
      </div>
    );
  }

  if (logs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
        <History size={28} className="opacity-30" />
        <p className="text-sm">No access events recorded yet.</p>
      </div>
    );
  }

  return (
    <div className="divide-y divide-border">
      {logs.map((log) => {
        const meta = ACTION_META[log.action] ?? { color: 'bg-slate-100 text-slate-600', label: log.action };
        return (
          <div key={log.id} className="flex items-start gap-3 py-3 px-1">
            <span className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded text-[11px] font-600 shrink-0 ${meta.color}`}>
              {meta.label}
            </span>
            <div className="flex-1 min-w-0">
              <p className="text-sm text-foreground font-500">{log.performedByName}</p>
              {log.notes && <p className="text-xs text-muted-foreground mt-0.5 truncate">{log.notes}</p>}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{formatDateTime(log.createdAt)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface PledgeDocumentsPanelProps {
  obligorId: string;
}

type ActiveTab = 'documents' | 'audit';

export default function PledgeDocumentsPanel({ obligorId }: PledgeDocumentsPanelProps) {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const userName = user?.user_metadata?.full_name ?? user?.email ?? 'Unknown';

  const [docs, setDocs] = useState<PledgeDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<ActiveTab>('documents');
  const [showUpload, setShowUpload] = useState(false);
  const [expiryEditDoc, setExpiryEditDoc] = useState<PledgeDocument | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<PledgeDocumentType | 'All'>('All');
  const [filterExpiry, setFilterExpiry] = useState<'all' | 'expired' | 'expiring_soon' | 'valid'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const data = await pledgeDocumentService.getByObligorId(obligorId);
    setDocs(data);
    setLoading(false);
  }, [obligorId]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (doc: PledgeDocument) => {
    if (!confirm(`Delete "${doc.fileName}"? This cannot be undone.`)) return;
    setDeletingId(doc.id);
    const result = await pledgeDocumentService.delete(doc, userId, userName);
    setDeletingId(null);
    if (result.error) { setError(result.error); } else { load(); }
  };

  const handleView = async (doc: PledgeDocument) => {
    if (doc.signedUrl) {
      await pledgeDocumentService.logAccess(doc.id, doc.obligorId, 'viewed', userId, userName, `Viewed ${doc.documentType}: ${doc.fileName}`);
      window.open(doc.signedUrl, '_blank');
    }
  };

  const handleDownload = async (doc: PledgeDocument) => {
    if (doc.signedUrl) {
      await pledgeDocumentService.logAccess(doc.id, doc.obligorId, 'downloaded', userId, userName, `Downloaded ${doc.documentType}: ${doc.fileName}`);
      const a = document.createElement('a');
      a.href = doc.signedUrl;
      a.download = doc.fileName;
      a.click();
    }
  };

  // Filtered docs
  const filteredDocs = docs.filter((d) => {
    if (filterType !== 'All' && d.documentType !== filterType) return false;
    if (filterExpiry !== 'all' && getExpiryStatus(d.expiryDate) !== filterExpiry) return false;
    return true;
  });

  // Summary counts
  const expiredCount = docs.filter((d) => getExpiryStatus(d.expiryDate) === 'expired').length;
  const expiringSoonCount = docs.filter((d) => getExpiryStatus(d.expiryDate) === 'expiring_soon').length;

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Shield size={15} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-700 text-foreground">Pledge Documents</h3>
            <p className="text-[11px] text-muted-foreground">{docs.length} document{docs.length !== 1 ? 's' : ''} on file</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            title="Refresh"
          >
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowUpload(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-600 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={13} />
            Upload
          </button>
        </div>
      </div>

      {/* Expiry alert strip */}
      {(expiredCount > 0 || expiringSoonCount > 0) && (
        <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-50 border-b border-amber-200">
          <AlertTriangle size={14} className="text-amber-600 shrink-0" />
          <p className="text-xs text-amber-700">
            {expiredCount > 0 && <span className="font-600">{expiredCount} expired</span>}
            {expiredCount > 0 && expiringSoonCount > 0 && <span> · </span>}
            {expiringSoonCount > 0 && <span className="font-600">{expiringSoonCount} expiring within 30 days</span>}
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-border px-5">
        {(['documents', 'audit'] as ActiveTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3 py-2.5 text-xs font-600 capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab === 'audit' ? 'Audit Log' : 'Documents'}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-5">
        {activeTab === 'audit' ? (
          <AccessLogTab obligorId={obligorId} />
        ) : (
          <>
            {/* Filters */}
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as PledgeDocumentType | 'All')}
                className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="All">All Types</option>
                {PLEDGE_DOCUMENT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <select
                value={filterExpiry}
                onChange={(e) => setFilterExpiry(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">All Expiry</option>
                <option value="expired">Expired</option>
                <option value="expiring_soon">Expiring Soon</option>
                <option value="valid">Valid</option>
              </select>
              {(filterType !== 'All' || filterExpiry !== 'all') && (
                <button
                  onClick={() => { setFilterType('All'); setFilterExpiry('all'); }}
                  className="flex items-center gap-1 px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors"
                >
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 p-3 mb-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertCircle size={14} />{error}
              </div>
            )}

            {/* Loading */}
            {loading ? (
              <div className="flex items-center justify-center py-10 gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-sm">Loading documents…</span>
              </div>
            ) : filteredDocs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-10 gap-2 text-muted-foreground">
                <FileText size={28} className="opacity-30" />
                <p className="text-sm font-500">No documents found</p>
                <p className="text-xs">Upload deeds, valuations, or insurance certificates</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredDocs.map((doc) => {
                  const meta = DOC_TYPE_META[doc.documentType];
                  const isExpanded = expandedId === doc.id;
                  const expiryStatus = getExpiryStatus(doc.expiryDate);

                  return (
                    <div
                      key={doc.id}
                      className={`border rounded-xl overflow-hidden transition-all ${
                        expiryStatus === 'expired' ? 'border-red-200 bg-red-50/30' :
                        expiryStatus === 'expiring_soon'? 'border-amber-200 bg-amber-50/20' : 'border-border bg-white'
                      }`}
                    >
                      {/* Row */}
                      <div className="flex items-center gap-3 px-4 py-3">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border`}>
                          {getFileIcon(doc.mimeType)}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-600 text-foreground truncate max-w-[200px]">{doc.fileName}</span>
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-600 border ${meta.bg} ${meta.color} ${meta.border}`}>
                              {meta.icon} {doc.documentType}
                            </span>
                          </div>
                          <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                            <ExpiryBadge expiryDate={doc.expiryDate} />
                            <span className="text-[11px] text-muted-foreground">{formatBytes(doc.fileSize)}</span>
                            <span className="text-[11px] text-muted-foreground">{formatDate(doc.createdAt)}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          {doc.signedUrl && (
                            <>
                              <button
                                onClick={() => handleView(doc)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="View"
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => handleDownload(doc)}
                                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                                title="Download"
                              >
                                <Download size={14} />
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpiryEditDoc(doc)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-amber-600"
                            title="Update expiry"
                          >
                            <Calendar size={14} />
                          </button>
                          <button
                            onClick={() => handleDelete(doc)}
                            disabled={deletingId === doc.id}
                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600 disabled:opacity-50"
                            title="Delete"
                          >
                            {deletingId === doc.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                          </button>
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                            className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                          >
                            {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </div>

                      {/* Expanded details */}
                      {isExpanded && (
                        <div className="px-4 pb-3 pt-0 border-t border-border/60 bg-muted/20">
                          <div className="grid grid-cols-2 gap-x-6 gap-y-2 mt-2">
                            {doc.issuer && (
                              <div className="flex items-center gap-1.5">
                                <Building2 size={11} className="text-muted-foreground shrink-0" />
                                <span className="text-[11px] text-muted-foreground">Issuer:</span>
                                <span className="text-[11px] text-foreground font-500">{doc.issuer}</span>
                              </div>
                            )}
                            {doc.referenceNumber && (
                              <div className="flex items-center gap-1.5">
                                <Hash size={11} className="text-muted-foreground shrink-0" />
                                <span className="text-[11px] text-muted-foreground">Ref:</span>
                                <span className="text-[11px] text-foreground font-500">{doc.referenceNumber}</span>
                              </div>
                            )}
                            {doc.issuedDate && (
                              <div className="flex items-center gap-1.5">
                                <Calendar size={11} className="text-muted-foreground shrink-0" />
                                <span className="text-[11px] text-muted-foreground">Issued:</span>
                                <span className="text-[11px] text-foreground font-500">{formatDate(doc.issuedDate)}</span>
                              </div>
                            )}
                            <div className="flex items-center gap-1.5">
                              <Clock size={11} className="text-muted-foreground shrink-0" />
                              <span className="text-[11px] text-muted-foreground">Uploaded by:</span>
                              <span className="text-[11px] text-foreground font-500">{doc.uploadedByName}</span>
                            </div>
                            {doc.notes && (
                              <div className="col-span-2 flex items-start gap-1.5 mt-1">
                                <FileText size={11} className="text-muted-foreground shrink-0 mt-0.5" />
                                <span className="text-[11px] text-muted-foreground">Notes:</span>
                                <span className="text-[11px] text-foreground">{doc.notes}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Modals */}
      {showUpload && (
        <UploadModal
          obligorId={obligorId}
          userId={userId}
          userName={userName}
          onClose={() => setShowUpload(false)}
          onUploaded={load}
        />
      )}
      {expiryEditDoc && (
        <ExpiryEditModal
          doc={expiryEditDoc}
          userId={userId}
          userName={userName}
          onClose={() => setExpiryEditDoc(null)}
          onUpdated={load}
        />
      )}
    </div>
  );
}
