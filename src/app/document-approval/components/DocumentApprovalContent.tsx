'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Eye, Search, Filter, RefreshCw, Clock, FileText, ChevronDown, ChevronRight, X, Loader2, AlertCircle, ShieldCheck, Download, History, FileCheck, FileMinus, FileSearch,  } from 'lucide-react';
import {
  documentApprovalService,
  DocumentApprovalRecord,
  DocumentApprovalStatus,
  ApprovalStats,
  DocumentApprovalAuditEntry,
} from '@/lib/supabase/documentApprovalService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType = 'approve' | 'reject' | 'under_review';

interface ActionModalState {
  open: boolean;
  doc: DocumentApprovalRecord | null;
  action: ActionType | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocumentApprovalStatus, { label: string; textColor: string; bgColor: string; borderColor: string; dot: string }> = {
  pending:      { label: 'Pending',      textColor: 'text-amber-700',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-200',  dot: 'bg-amber-500' },
  under_review: { label: 'Under Review', textColor: 'text-blue-700',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200',   dot: 'bg-blue-500' },
  approved:     { label: 'Approved',     textColor: 'text-green-700',  bgColor: 'bg-green-50',   borderColor: 'border-green-200',  dot: 'bg-green-500' },
  rejected:     { label: 'Rejected',     textColor: 'text-red-700',    bgColor: 'bg-red-50',     borderColor: 'border-red-200',    dot: 'bg-red-500' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Stats Bar ────────────────────────────────────────────────────────────────

function StatsBar({ stats, activeFilter, onFilter }: {
  stats: ApprovalStats;
  activeFilter: DocumentApprovalStatus | 'all';
  onFilter: (f: DocumentApprovalStatus | 'all') => void;
}) {
  const cards = [
    { key: 'all' as const,         label: 'All Documents',  value: stats.total,       icon: FileText,    color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200' },
    { key: 'pending' as const,     label: 'Pending Review', value: stats.pending,     icon: Clock,       color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    { key: 'under_review' as const,label: 'Under Review',   value: stats.underReview, icon: FileSearch,  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
    { key: 'approved' as const,    label: 'Approved',       value: stats.approved,    icon: FileCheck,   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
    { key: 'rejected' as const,    label: 'Rejected',       value: stats.rejected,    icon: FileMinus,   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
      {cards.map(({ key, label, value, icon: Icon, color, bg, border }) => {
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onFilter(key)}
            className={`flex flex-col gap-1 p-3 rounded-xl border transition-all text-left ${bg} ${border} ${isActive ? 'ring-2 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}
          >
            <div className="flex items-center justify-between">
              <Icon size={16} className={color} />
              <span className={`text-xl font-bold ${color}`}>{value}</span>
            </div>
            <span className={`text-xs font-medium ${color}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Audit Trail Panel ────────────────────────────────────────────────────────

function AuditTrailPanel({ documentId, onClose }: { documentId: string; onClose: () => void }) {
  const [entries, setEntries] = useState<DocumentApprovalAuditEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    documentApprovalService.getDocumentAuditTrail(documentId).then((data) => {
      if (!cancelled) { setEntries(data); setLoading(false); }
    });
    return () => { cancelled = true; };
  }, [documentId]);

  const actionConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    approved:     { label: 'Approved',     color: 'text-green-700 bg-green-50 border-green-200', icon: <CheckCircle size={14} className="text-green-600" /> },
    rejected:     { label: 'Rejected',     color: 'text-red-700 bg-red-50 border-red-200',       icon: <XCircle size={14} className="text-red-600" /> },
    under_review: { label: 'Under Review', color: 'text-blue-700 bg-blue-50 border-blue-200',    icon: <Eye size={14} className="text-blue-600" /> },
    pending:      { label: 'Pending',      color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <Clock size={14} className="text-amber-600" /> },
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <History size={18} className="text-blue-600" />
            <h3 className="text-base font-semibold text-gray-900">Approval Audit Trail</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500">
              <Loader2 size={16} className="animate-spin" /> Loading audit trail…
            </div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center text-sm text-gray-400">No audit entries found for this document.</div>
          ) : (
            <div className="space-y-3">
              {entries.map((entry) => {
                const cfg = actionConfig[entry.action] ?? actionConfig['pending'];
                return (
                  <div key={entry.id} className="flex gap-3">
                    <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                        <span className="text-xs text-gray-500">{formatDateTime(entry.createdAt)}</span>
                      </div>
                      <p className="text-sm font-medium text-gray-800 mt-0.5">{entry.performedByName}</p>
                      {entry.performedByRole && (
                        <p className="text-xs text-gray-500">{entry.performedByRole}</p>
                      )}
                      {entry.notes && (
                        <p className="text-xs text-gray-600 mt-1 italic">"{entry.notes}"</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action Modal ─────────────────────────────────────────────────────────────

interface ActionModalProps {
  state: ActionModalState;
  onClose: () => void;
  onSubmit: (action: ActionType, notes: string) => Promise<void>;
  submitting: boolean;
}

function ActionModal({ state, onClose, onSubmit, submitting }: ActionModalProps) {
  const [notes, setNotes] = useState('');

  useEffect(() => {
    if (state.open) setNotes('');
  }, [state.open]);

  if (!state.open || !state.doc || !state.action) return null;

  const config = {
    approve: {
      title: 'Approve Document',
      description: 'Approve this document. It will be marked as approved and enter the collateral registry.',
      placeholder: 'Add approval notes (optional)…',
      buttonLabel: 'Approve Document',
      buttonStyle: 'bg-green-600 hover:bg-green-700 text-white',
      icon: <CheckCircle size={20} className="text-green-600" />,
      required: false,
    },
    reject: {
      title: 'Reject Document',
      description: 'Reject this document. Please provide a clear reason so the submitter can take corrective action.',
      placeholder: 'Reason for rejection (required)…',
      buttonLabel: 'Reject Document',
      buttonStyle: 'bg-red-600 hover:bg-red-700 text-white',
      icon: <XCircle size={20} className="text-red-600" />,
      required: true,
    },
    under_review: {
      title: 'Mark Under Review',
      description: 'Flag this document as currently under review. You can approve or reject it later.',
      placeholder: 'Review notes (optional)…',
      buttonLabel: 'Mark Under Review',
      buttonStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
      icon: <Eye size={20} className="text-blue-600" />,
      required: false,
    },
  }[state.action];

  const canSubmit = !config.required || notes.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h3 className="text-base font-semibold text-gray-900">{config.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{state.doc.fileName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Collateral ID</span>
              <span className="font-medium text-gray-800">{state.doc.collateralId || '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Document Type</span>
              <span className="font-medium text-gray-800">{state.doc.documentType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Uploaded By</span>
              <span className="font-medium text-gray-800">{state.doc.uploadedByName || '—'}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600">{config.description}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Notes {config.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(state.action!, notes)}
            disabled={!canSubmit || submitting}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${config.buttonStyle}`}
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {config.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Document Row ─────────────────────────────────────────────────────────────

interface DocumentRowProps {
  doc: DocumentApprovalRecord;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: ActionType) => void;
  onViewAudit: () => void;
  canAct: boolean;
}

function DocumentRow({ doc, expanded, onToggle, onAction, onViewAudit, canAct }: DocumentRowProps) {
  const statusCfg = STATUS_CONFIG[doc.approvalStatus] ?? STATUS_CONFIG['pending'];

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${expanded ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
      {/* Row Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-white hover:bg-gray-50 transition-colors"
      >
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>
        <div className="shrink-0 w-8 h-8 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
          <FileText size={15} className="text-blue-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-gray-900 truncate">{doc.fileName}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-xs text-gray-500">{doc.documentType}</span>
            {doc.collateralId && (
              <>
                <span className="text-gray-300">·</span>
                <span className="text-xs text-gray-500">{doc.collateralId}</span>
              </>
            )}
            <span className="text-gray-300">·</span>
            <span className="text-xs text-gray-400">{formatFileSize(doc.fileSize)}</span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.bgColor} ${statusCfg.textColor} ${statusCfg.borderColor}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
            {statusCfg.label}
          </span>
          <span className="text-xs text-gray-400 hidden sm:block">{formatDate(doc.uploadedAt)}</span>
        </div>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4 space-y-4">
          {/* Meta grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Uploaded By</p>
              <p className="text-gray-800 font-medium mt-0.5">{doc.uploadedByName || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Upload Date</p>
              <p className="text-gray-800 font-medium mt-0.5">{formatDateTime(doc.uploadedAt)}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Version</p>
              <p className="text-gray-800 font-medium mt-0.5">v{doc.version}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">File Size</p>
              <p className="text-gray-800 font-medium mt-0.5">{formatFileSize(doc.fileSize)}</p>
            </div>
            {doc.notes && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Upload Notes</p>
                <p className="text-gray-700 mt-0.5 text-sm">{doc.notes}</p>
              </div>
            )}
            {doc.approvalNotes && (
              <div className="col-span-2 sm:col-span-4">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Review Notes</p>
                <p className="text-gray-700 mt-0.5 text-sm italic">"{doc.approvalNotes}"</p>
              </div>
            )}
            {doc.approvedByName && (
              <div className="col-span-2">
                <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">
                  {doc.approvalStatus === 'approved' ? 'Approved By' : 'Reviewed By'}
                </p>
                <p className="text-gray-800 font-medium mt-0.5">{doc.approvedByName} · {formatDateTime(doc.approvedAt)}</p>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 flex-wrap pt-1">
            {doc.signedUrl && (
              <>
                <a
                  href={doc.signedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  <Eye size={13} /> View Document
                </a>
                <a
                  href={doc.signedUrl}
                  download={doc.fileName}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <Download size={13} /> Download
                </a>
              </>
            )}
            <button
              onClick={onViewAudit}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <History size={13} /> Audit Trail
            </button>

            {canAct && doc.approvalStatus !== 'approved' && (
              <button
                onClick={() => onAction('approve')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
              >
                <CheckCircle size={13} /> Approve
              </button>
            )}
            {canAct && doc.approvalStatus !== 'rejected' && (
              <button
                onClick={() => onAction('reject')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
              >
                <XCircle size={13} /> Reject
              </button>
            )}
            {canAct && doc.approvalStatus === 'pending' && (
              <button
                onClick={() => onAction('under_review')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <Eye size={13} /> Mark Under Review
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function DocumentApprovalContent() {
  const { user, userProfile } = useAuth();
  const [docs, setDocs] = useState<DocumentApprovalRecord[]>([]);
  const [stats, setStats] = useState<ApprovalStats>({ pending: 0, underReview: 0, approved: 0, rejected: 0, total: 0 });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<DocumentApprovalStatus | 'all'>('pending');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState>({ open: false, doc: null, action: null });
  const [submitting, setSubmitting] = useState(false);
  const [auditDocId, setAuditDocId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success\' | \'error' } | null>(null);

  const isLegalOfficer = userProfile?.role === 'legal_officer' || userProfile?.role === 'system_admin';

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [docsData, statsData] = await Promise.all([
        documentApprovalService.getAllDocuments(statusFilter),
        documentApprovalService.getApprovalStats(),
      ]);
      setDocs(docsData);
      setStats(statsData);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFilterChange = (f: DocumentApprovalStatus | 'all') => {
    setStatusFilter(f);
    setExpandedId(null);
  };

  const filteredDocs = docs.filter((doc) => {
    if (!search.trim()) return true;
    const s = search.toLowerCase();
    return (
      doc.fileName.toLowerCase().includes(s) ||
      doc.documentType.toLowerCase().includes(s) ||
      doc.collateralId.toLowerCase().includes(s) ||
      doc.uploadedByName.toLowerCase().includes(s)
    );
  });

  const handleAction = async (action: ActionType, notes: string) => {
    if (!actionModal.doc || !user) return;
    setSubmitting(true);
    const doc = actionModal.doc;
    const userName = userProfile?.full_name || user.email || 'Legal Officer';
    const userRole = userProfile?.role?.replace(/_/g, ' ') || 'Legal Officer';

    let success = false;
    if (action === 'approve') {
      success = await documentApprovalService.approveDocument(
        doc.documentId, doc.collateralId, doc.collateralRecordId,
        doc.documentType, doc.fileName, notes, user.id, userName, userRole
      );
    } else if (action === 'reject') {
      success = await documentApprovalService.rejectDocument(
        doc.documentId, doc.collateralId, doc.collateralRecordId,
        doc.documentType, doc.fileName, notes, user.id, userName, userRole
      );
    } else if (action === 'under_review') {
      success = await documentApprovalService.markUnderReview(
        doc.documentId, doc.collateralId, doc.collateralRecordId,
        doc.documentType, doc.fileName, notes, user.id, userName, userRole
      );
    }

    setSubmitting(false);
    setActionModal({ open: false, doc: null, action: null });

    if (success) {
      const labels: Record<ActionType, string> = {
        approve: 'Document approved successfully',
        reject: 'Document rejected',
        under_review: 'Document marked as under review',
      };
      showToast(labels[action], 'success');
      await loadData(true);
    } else {
      showToast('Action failed. Please try again.', 'error');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-gray-900">Document Approval</h1>
              <p className="text-xs text-gray-500">Legal Officer review queue — approve or reject collateral documents before registry entry</p>
            </div>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {!isLegalOfficer && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <AlertCircle size={15} />
            <span>You are viewing in read-only mode. Only Legal Officers can approve or reject documents.</span>
          </div>
        )}
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {/* Stats */}
        <StatsBar stats={stats} activeFilter={statusFilter} onFilter={handleFilterChange} />

        {/* Search & Filter Bar */}
        <div className="flex items-center gap-3 mb-4">
          <div className="relative flex-1 max-w-sm">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by file name, type, collateral ID…"
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
          <span className="text-sm text-gray-500 shrink-0">
            {filteredDocs.length} document{filteredDocs.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Document List */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <p className="text-sm text-gray-500">Loading documents…</p>
          </div>
        ) : filteredDocs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
              <FileText size={24} className="text-gray-400" />
            </div>
            <p className="text-base font-semibold text-gray-700">No documents found</p>
            <p className="text-sm text-gray-400">
              {search ? 'Try adjusting your search.' : 'No documents match the selected filter.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredDocs.map((doc) => (
              <DocumentRow
                key={doc.id}
                doc={doc}
                expanded={expandedId === doc.id}
                onToggle={() => setExpandedId(expandedId === doc.id ? null : doc.id)}
                onAction={(action) => setActionModal({ open: true, doc, action })}
                onViewAudit={() => setAuditDocId(doc.documentId)}
                canAct={isLegalOfficer}
              />
            ))}
          </div>
        )}
      </div>

      {/* Action Modal */}
      <ActionModal
        state={actionModal}
        onClose={() => setActionModal({ open: false, doc: null, action: null })}
        onSubmit={handleAction}
        submitting={submitting}
      />

      {/* Audit Trail Modal */}
      {auditDocId && (
        <AuditTrailPanel documentId={auditDocId} onClose={() => setAuditDocId(null)} />
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
