'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Eye, Search, RefreshCw, Clock, FileText, X, Loader2, AlertCircle, ShieldCheck, Download, FileCheck, FileMinus, FileSearch, ChevronRight, LayoutGrid, Info, CheckSquare, Square, Layers, ChevronDown, ChevronUp, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import ActionHelpIcon from '@/components/ui/ActionHelpIcon';
import Link from 'next/link';
import {
  documentApprovalService,
  DocumentApprovalRecord,
  DocumentApprovalStatus,
  ApprovalStats,
  DocumentApprovalAuditEntry,
} from '@/lib/supabase/documentApprovalService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';


// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType = 'approve' | 'reject' | 'under_review';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<DocumentApprovalStatus, { label: string; textColor: string; bgColor: string; borderColor: string; dot: string; icon: React.ReactNode }> = {
  pending:      { label: 'Pending',      textColor: 'text-amber-700',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-200',  dot: 'bg-amber-500',  icon: <Clock size={12} /> },
  under_review: { label: 'Under Review', textColor: 'text-blue-700',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200',   dot: 'bg-blue-500',   icon: <Eye size={12} /> },
  approved:     { label: 'Approved',     textColor: 'text-green-700',  bgColor: 'bg-green-50',   borderColor: 'border-green-200',  dot: 'bg-green-500',  icon: <CheckCircle size={12} /> },
  rejected:     { label: 'Rejected',     textColor: 'text-red-700',    bgColor: 'bg-red-50',     borderColor: 'border-red-200',    dot: 'bg-red-500',    icon: <XCircle size={12} /> },
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
    { key: 'all' as const,          label: 'All',          value: stats.total,       icon: FileText,    color: 'text-gray-700',   bg: 'bg-gray-50',   border: 'border-gray-200' },
    { key: 'pending' as const,      label: 'Pending',      value: stats.pending,     icon: Clock,       color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
    { key: 'under_review' as const, label: 'Under Review', value: stats.underReview, icon: FileSearch,  color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
    { key: 'approved' as const,     label: 'Approved',     value: stats.approved,    icon: FileCheck,   color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
    { key: 'rejected' as const,     label: 'Rejected',     value: stats.rejected,    icon: FileMinus,   color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  ];

  return (
    <div className="grid grid-cols-5 gap-3 px-6 py-4 border-b border-gray-100">
      {cards.map(({ key, label, value, icon: Icon, color, bg, border }) => {
        const isActive = activeFilter === key;
        return (
          <button
            key={key}
            onClick={() => onFilter(key)}
            className={`flex flex-col gap-1 p-3 rounded-xl border transition-all text-left ${bg} ${border} ${isActive ? 'ring-2 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}
          >
            <div className="flex items-center justify-between">
              <Icon size={15} className={color} />
              <span className={`text-lg font-bold ${color}`}>{value}</span>
            </div>
            <span className={`text-xs font-medium ${color}`}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

// ─── Inline Document Viewer ───────────────────────────────────────────────────

function InlineDocViewer({ signedUrl, fileName, mimeType }: { signedUrl: string; fileName: string; mimeType?: string }) {
  const [collapsed, setCollapsed] = React.useState(false);
  const [fullscreen, setFullscreen] = React.useState(false);

  const isPdf = fileName.toLowerCase().endsWith('.pdf') || mimeType?.includes('pdf');
  const isImage = mimeType?.startsWith('image/') ||
    /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(fileName);

  return (
    <div className={`border-b border-gray-200 bg-gray-50 shrink-0 ${fullscreen ? 'fixed inset-0 z-[80] flex flex-col bg-white' : ''}`}>
      {/* Viewer toolbar */}
      <div className={`flex items-center justify-between px-4 py-2 border-b border-gray-200 bg-white ${fullscreen ? 'shrink-0' : ''}`}>
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={13} className="text-blue-600 shrink-0" />
          <span className="text-xs font-semibold text-gray-700 truncate max-w-[200px]">{fileName}</span>
          <span className="text-xs text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
            {isPdf ? 'PDF' : isImage ? 'Image' : 'Document'}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <a
            href={signedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-blue-600 transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={13} />
          </a>
          <a
            href={signedUrl}
            download={fileName}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title="Download"
          >
            <Download size={13} />
          </a>
          <button
            onClick={() => setFullscreen(f => !f)}
            className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {fullscreen ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
          </button>
          {!fullscreen && (
            <button
              onClick={() => setCollapsed(c => !c)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
              title={collapsed ? 'Show document' : 'Hide document'}
            >
              {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            </button>
          )}
          {fullscreen && (
            <button
              onClick={() => setFullscreen(false)}
              className="p-1.5 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors ml-1"
              title="Close"
            >
              <X size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Viewer body */}
      {(!collapsed || fullscreen) && (
        <div className={fullscreen ? 'flex-1 overflow-hidden' : 'h-[340px] overflow-hidden'}>
          {isPdf ? (
            <iframe
              src={`${signedUrl}#toolbar=0&navpanes=0&scrollbar=1`}
              className="w-full h-full border-0"
              title={fileName}
            />
          ) : isImage ? (
            <div className="w-full h-full flex items-center justify-center bg-gray-100 overflow-auto p-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={signedUrl}
                alt={fileName}
                className="max-w-full max-h-full object-contain rounded"
              />
            </div>
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center gap-3 bg-gray-50 p-6">
              <FileText size={36} className="text-gray-300" />
              <p className="text-sm text-gray-500 text-center">
                This file type cannot be previewed inline.
              </p>
              <a
                href={signedUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
              >
                <ExternalLink size={13} /> Open Document
              </a>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Detail Panel (used inside drawer) ────────────────────────────────────────

type DetailTab = 'details' | 'audit';

function DetailPanel({
  doc,
  canAct,
  onClose,
  onAction,
}: {
  doc: DocumentApprovalRecord;
  canAct: boolean;
  onClose: () => void;
  onAction: (action: ActionType) => void;
}) {
  const [detailTab, setDetailTab] = useState<DetailTab>('details');
  const [auditEntries, setAuditEntries] = useState<DocumentApprovalAuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);

  const statusCfg = STATUS_CONFIG[doc.approvalStatus] ?? STATUS_CONFIG['pending'];
  const isActive = doc.approvalStatus === 'pending' || doc.approvalStatus === 'under_review';

  useEffect(() => {
    setDetailTab('details');
    setAuditEntries([]);
  }, [doc.id]);

  const loadAudit = useCallback(async () => {
    if (auditEntries.length > 0) return;
    setAuditLoading(true);
    try {
      const data = await documentApprovalService.getDocumentAuditTrail(doc.documentId);
      setAuditEntries(data);
    } finally {
      setAuditLoading(false);
    }
  }, [doc.documentId, auditEntries.length]);

  useEffect(() => {
    if (detailTab === 'audit') loadAudit();
  }, [detailTab, loadAudit]);

  const auditActionConfig: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
    approved:     { label: 'Approved',     color: 'text-green-700 bg-green-50 border-green-200', icon: <CheckCircle size={14} className="text-green-600" /> },
    rejected:     { label: 'Rejected',     color: 'text-red-700 bg-red-50 border-red-200',       icon: <XCircle size={14} className="text-red-600" /> },
    under_review: { label: 'Under Review', color: 'text-blue-700 bg-blue-50 border-blue-200',    icon: <Eye size={14} className="text-blue-600" /> },
    pending:      { label: 'Pending',      color: 'text-amber-700 bg-amber-50 border-amber-200', icon: <Clock size={14} className="text-amber-600" /> },
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Panel Header — title + status badge only */}
      <div className="px-5 py-3.5 border-b border-gray-200 shrink-0">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <h2 className="text-base font-semibold text-gray-900 truncate">{doc.fileName}</h2>
            <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border shrink-0 ${statusCfg.bgColor} ${statusCfg.textColor} ${statusCfg.borderColor}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 min-h-0 overflow-hidden">

        {/* LEFT — 60% — Inline Document Viewer */}
        <div className="flex flex-col min-h-0 overflow-hidden border-r border-gray-200" style={{ width: '60%' }}>
          {/* Inline viewer fills the left pane */}
          {doc.signedUrl ? (
            <div className="flex-1 overflow-hidden">
              <InlineDocViewer signedUrl={doc.signedUrl} fileName={doc.fileName} />
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-gray-50 p-8">
              <FileText size={40} className="text-gray-200" />
              <p className="text-sm text-gray-400 text-center">No preview available for this document.</p>
            </div>
          )}
        </div>

        {/* RIGHT — 40% — Details + Action Zone */}
        <div className="flex flex-col min-h-0 overflow-hidden bg-gray-50" style={{ width: '40%' }}>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 shrink-0 bg-white">
            {(['details', 'audit'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setDetailTab(t)}
                className={`px-4 py-2.5 text-xs font-medium border-b-2 capitalize transition-colors ${
                  detailTab === t ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {t === 'audit' ? 'Audit Trail' : 'Details'}
              </button>
            ))}
          </div>

          {/* Scrollable details area */}
          <div className="flex-1 overflow-y-auto px-4 py-4">
            {detailTab === 'details' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Document Info</h3>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                    {[
                      { label: 'Uploaded By', value: doc.uploadedByName || '—' },
                      { label: 'Upload Date', value: formatDateTime(doc.uploadedAt) },
                      { label: 'File Size', value: formatFileSize(doc.fileSize) },
                      { label: 'Version', value: `v${doc.version}` },
                      { label: 'Collateral ID', value: doc.collateralId || '—' },
                      { label: 'Document Type', value: doc.documentType },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                        <p className="text-xs text-gray-800 font-medium mt-0.5">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {doc.notes && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Upload Notes</h3>
                    <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2.5 text-xs text-blue-800 flex gap-2">
                      <Info size={13} className="shrink-0 mt-0.5 text-blue-500" />
                      {doc.notes}
                    </div>
                  </div>
                )}

                {doc.approvalNotes && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Review Notes</h3>
                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800 italic">
                      &ldquo;{doc.approvalNotes}&rdquo;
                    </div>
                  </div>
                )}

                {doc.approvedByName && (
                  <div>
                    <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Decision</h3>
                    <div className={`rounded-lg border px-3 py-2.5 ${doc.approvalStatus === 'approved' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-semibold text-gray-700">{doc.approvedByName}</span>
                        <span className="text-xs text-gray-400">{formatDateTime(doc.approvedAt)}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {detailTab === 'audit' && (
              <div className="space-y-3">
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Approval Audit Trail</h3>
                {auditLoading ? (
                  <div className="flex items-center gap-2 py-8 justify-center text-sm text-gray-500">
                    <Loader2 size={16} className="animate-spin" /> Loading audit trail…
                  </div>
                ) : auditEntries.length === 0 ? (
                  <p className="text-sm text-gray-400 italic py-4">No audit entries found for this document.</p>
                ) : (
                  <div className="space-y-3">
                    {auditEntries.map((entry) => {
                      const cfg = auditActionConfig[entry.action] ?? auditActionConfig['pending'];
                      return (
                        <div key={entry.id} className="flex gap-3">
                          <div className="mt-0.5 shrink-0">{cfg.icon}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
                              <span className="text-xs text-gray-500">{formatDateTime(entry.createdAt)}</span>
                            </div>
                            <p className="text-sm font-medium text-gray-800 mt-0.5">{entry.performedByName}</p>
                            {entry.performedByRole && <p className="text-xs text-gray-500">{entry.performedByRole}</p>}
                            {entry.notes && <p className="text-xs text-gray-600 mt-1 italic">&ldquo;{entry.notes}&rdquo;</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pinned Action Footer */}
          {isActive && canAct && (
            <div className="px-4 py-4 border-t border-gray-200 bg-white shrink-0">
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Take Action</h3>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-3 space-y-3">
                <p className="text-xs text-gray-500 flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-teal-600" />
                  Review the document before approving or rejecting.
                </p>
                <div className="flex items-center gap-2">
                  {doc.approvalStatus !== 'approved' && (
                    <button
                      onClick={() => onAction('approve')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      <CheckCircle size={14} /> Approve
                      <ActionHelpIcon text="Mark this document as approved. It will be recorded in the audit trail and the collateral record will be updated." position="top" />
                    </button>
                  )}
                  {doc.approvalStatus !== 'rejected' && (
                    <button
                      onClick={() => onAction('reject')}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      <XCircle size={14} /> Reject
                      <ActionHelpIcon text="Reject this document. You will be asked to provide rejection notes. The submitter will be notified to resubmit." position="top" />
                    </button>
                  )}
                  {doc.approvalStatus === 'pending' && (
                    <button
                      onClick={() => onAction('under_review')}
                      className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Mark as Under Review"
                    >
                      <Eye size={14} />
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {!isActive && (
            <div className="px-4 py-4 border-t border-gray-200 bg-white shrink-0">
              <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
                doc.approvalStatus === 'approved' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
              }`}>
                {doc.approvalStatus === 'approved' ? <CheckCircle size={16} /> : <XCircle size={16} />}
                This document has been {doc.approvalStatus}.
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Action Modal ─────────────────────────────────────────────────────────────

interface ActionModalState {
  open: boolean;
  doc: DocumentApprovalRecord | null;
  action: ActionType | null;
}

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

  const canSubmit = !config.required || notes.trim().length >= 10;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
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
              className={`w-full border rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 transition-all ${
                config.required && notes.trim().length === 0
                  ? 'border-red-300 focus:ring-red-400/30 bg-red-50/30 focus:border-red-400'
                  : config.required && notes.trim().length < 10
                  ? 'border-amber-300 focus:ring-amber-400/30 focus:border-amber-400' :'border-gray-200 focus:ring-blue-500/30 focus:border-blue-400'
              }`}
            />
            {config.required && notes.trim().length === 0 && (
              <p className="flex items-center gap-1.5 text-xs text-red-600 font-medium mt-1.5">
                <AlertCircle size={12} />
                A rejection reason is required — the submitter needs to understand why this document was rejected.
              </p>
            )}
            {config.required && notes.trim().length > 0 && notes.trim().length < 10 && (
              <p className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mt-1.5">
                <AlertCircle size={12} />
                Please provide a more detailed reason (at least 10 characters).
              </p>
            )}
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

// ─── Batch Action Panel ────────────────────────────────────────────────────────

type BatchDocAction = 'approve' | 'reject' | 'under_review';

interface BatchDocPanelProps {
  selectedIds: Set<string>;
  selectedDocs: DocumentApprovalRecord[];
  userId: string;
  userName: string;
  userRole: string;
  canAct: boolean;
  onClearSelection: () => void;
  onBatchComplete: () => void;
}

function BatchDocPanel({ selectedIds, selectedDocs, userId, userName, userRole, canAct, onClearSelection, onBatchComplete }: BatchDocPanelProps) {
  const [batchAction, setBatchAction] = useState<BatchDocAction | ''>('');
  const [batchNote, setBatchNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ id: string; success: boolean; error?: string }[]>([]);
  const [showResults, setShowResults] = useState(false);

  // Only pending/under_review docs can be actioned
  const eligibleDocs = selectedDocs.filter(d => d.approvalStatus === 'pending' || d.approvalStatus === 'under_review');

  const availableActions: { value: BatchDocAction; label: string; color: string; icon: React.ReactNode; requiresNote: boolean }[] = [
    { value: 'approve',      label: 'Approve All',      color: 'bg-green-600 hover:bg-green-700', icon: <CheckCircle size={14} />,  requiresNote: false },
    { value: 'reject',       label: 'Reject All',       color: 'bg-red-600 hover:bg-red-700',    icon: <XCircle size={14} />,      requiresNote: true },
    { value: 'under_review', label: 'Mark Under Review', color: 'bg-blue-600 hover:bg-blue-700', icon: <Eye size={14} />,          requiresNote: false },
  ];

  const selectedActionConfig = availableActions.find(a => a.value === batchAction);

  async function handleBatchProcess() {
    if (!batchAction) return;
    if (selectedActionConfig?.requiresNote && !batchNote.trim()) return;
    if (eligibleDocs.length === 0) return;

    setProcessing(true);
    setResults([]);

    const settled = await Promise.allSettled(
      eligibleDocs.map(async (doc) => {
        try {
          let success = false;
          if (batchAction === 'approve') {
            success = await documentApprovalService.approveDocument(
              doc.documentId, doc.collateralId, doc.collateralRecordId,
              doc.documentType, doc.fileName, batchNote, userId, userName, userRole
            );
          } else if (batchAction === 'reject') {
            success = await documentApprovalService.rejectDocument(
              doc.documentId, doc.collateralId, doc.collateralRecordId,
              doc.documentType, doc.fileName, batchNote, userId, userName, userRole
            );
          } else if (batchAction === 'under_review') {
            success = await documentApprovalService.markUnderReview(
              doc.documentId, doc.collateralId, doc.collateralRecordId,
              doc.documentType, doc.fileName, batchNote, userId, userName, userRole
            );
          }
          return { id: doc.id, success: !!success };
        } catch (err: any) {
          return { id: doc.id, success: false, error: err.message || 'Failed' };
        }
      })
    );

    const resultList = settled.map((s, i) =>
      s.status === 'fulfilled' ? s.value : { id: eligibleDocs[i].id, success: false, error: 'Unexpected error' }
    );

    setResults(resultList);
    setShowResults(true);
    setProcessing(false);

    onBatchComplete();

    const failCount = resultList.filter(r => !r.success).length;
    if (failCount === 0) {
      setTimeout(() => {
        onClearSelection();
        setBatchAction('');
        setBatchNote('');
        setShowResults(false);
        setResults([]);
      }, 1500);
    }
  }

  return (
    <div className="border-t-2 border-blue-500 bg-blue-50 px-4 py-3 shrink-0">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-blue-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg">
            <Layers size={13} />
            {selectedIds.size} selected
          </div>
          <span className="text-xs text-gray-500">({eligibleDocs.length} eligible)</span>
          <button
            onClick={onClearSelection}
            className="text-xs text-gray-500 hover:text-gray-700 flex items-center gap-1 px-2 py-1.5 border border-gray-200 rounded-md hover:bg-white transition-colors bg-white"
          >
            <X size={11} /> Clear
          </button>
        </div>

        {!canAct ? (
          <p className="text-xs text-amber-700 py-1.5">Read-only mode — only Legal Officers can perform batch actions.</p>
        ) : eligibleDocs.length > 0 ? (
          <div className="flex items-start gap-2 flex-1 flex-wrap">
            <select
              value={batchAction}
              onChange={(e) => { setBatchAction(e.target.value as BatchDocAction | ''); setShowResults(false); }}
              className="text-sm border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white min-w-[200px]"
            >
              <option value="">— Choose batch action —</option>
              {availableActions.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>

            {batchAction && (
              <div className="flex items-start gap-2 flex-1 flex-wrap">
                <textarea
                  value={batchNote}
                  onChange={(e) => setBatchNote(e.target.value)}
                  placeholder={
                    selectedActionConfig?.requiresNote
                      ? 'Shared rejection reason (required for all selected records)...'
                      : 'Shared note (optional)...'
                  }
                  rows={1}
                  className="flex-1 min-w-[200px] text-sm border border-gray-200 rounded-md px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                />
                <button
                  onClick={handleBatchProcess}
                  disabled={processing || (selectedActionConfig?.requiresNote && !batchNote.trim()) || eligibleDocs.length === 0}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-md text-white disabled:opacity-50 transition-colors shrink-0 ${selectedActionConfig?.color ?? 'bg-blue-600 hover:bg-blue-700'}`}
                >
                  {processing ? (
                    <><Loader2 size={13} className="animate-spin" /> Processing {eligibleDocs.length}...</>
                  ) : (
                    <>{selectedActionConfig?.icon} Apply to {eligibleDocs.length} doc{eligibleDocs.length !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-gray-500 py-1.5">No eligible documents selected (only Pending/Under Review can be batch-actioned).</p>
        )}

        {showResults && results.length > 0 && (
          <div className="w-full mt-2 space-y-1">
            {results.map(r => (
              <div key={r.id} className={`flex items-center gap-2 text-xs px-2 py-1 rounded ${r.success ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
                {r.success ? <CheckCircle size={11} /> : <XCircle size={11} />}
                {r.id}: {r.success ? 'Updated' : r.error}
              </div>
            ))}
          </div>
        )}
      </div>
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
  const [selectedDoc, setSelectedDoc] = useState<DocumentApprovalRecord | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionModal, setActionModal] = useState<ActionModalState>({ open: false, doc: null, action: null });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [rejectConfirm, setRejectConfirm] = useState<{ open: boolean; doc: DocumentApprovalRecord | null }>({ open: false, doc: null });

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

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

  useEffect(() => { loadData(); }, [loadData]);

  const handleFilterChange = (f: DocumentApprovalStatus | 'all') => {
    setStatusFilter(f);
    setSelectedDoc(null);
    setDrawerOpen(false);
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

  // Batch helpers
  const allFilteredIds = filteredDocs.map(d => d.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(allFilteredIds));
  }

  function toggleSelectOne(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function clearSelection() {
    setSelectedIds(new Set());
    setBatchMode(false);
  }

  const selectedBatchDocs = filteredDocs.filter(d => selectedIds.has(d.id));

  const handleSelectDoc = (doc: DocumentApprovalRecord) => {
    if (batchMode) return;
    setSelectedDoc(doc);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedDoc(null), 300);
  };

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
      if (selectedDoc?.id === doc.id) {
        const statusMap: Record<ActionType, DocumentApprovalStatus> = {
          approve: 'approved',
          reject: 'rejected',
          under_review: 'under_review',
        };
        setSelectedDoc((prev) => prev ? { ...prev, approvalStatus: statusMap[action] } : null);
      }
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
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href="/workflows" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <LayoutGrid size={11} /> Workflows
                </Link>
                <ChevronRight size={11} className="text-gray-300" />
                <span className="text-xs text-gray-600 font-medium">Document Approval</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">Document Approval</h1>
              <p className="text-xs text-gray-500">Legal Officer review queue — approve or reject collateral documents before registry entry</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!batchMode ? (
              <button
                onClick={() => { setBatchMode(true); setSelectedIds(new Set()); }}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <Layers size={14} /> Batch Actions
              </button>
            ) : (
              <button
                onClick={clearSelection}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <X size={14} /> Exit Batch Mode
              </button>
            )}
            <button
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {!isLegalOfficer && (
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
            <AlertCircle size={15} />
            <span>You are viewing in read-only mode. Only Legal Officers can approve or reject documents.</span>
          </div>
        )}
      </div>

      {/* Stats Bar */}
      <div className="bg-white shrink-0">
        <StatsBar stats={stats} activeFilter={statusFilter} onFilter={handleFilterChange} />
      </div>

      {/* Body — full-width list */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col w-full bg-white min-h-0">
          {/* Batch mode hint */}
          {batchMode && (
            <div className="mx-4 mt-3 mb-1 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 flex items-center gap-3 shrink-0">
              <Layers size={15} className="text-blue-600 shrink-0" />
              <p className="text-sm text-blue-700 font-medium">
                Batch mode active — check boxes next to documents, then use the action bar below to approve, reject, or mark all as under review at once.
              </p>
            </div>
          )}
          {/* Search */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              {/* Select-all checkbox */}
              {batchMode && (
                <button
                  onClick={toggleSelectAll}
                  className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 shrink-0 px-1"
                  title={allSelected ? 'Deselect all' : 'Select all'}
                >
                  {allSelected ? (
                    <CheckSquare size={16} className="text-blue-600" />
                  ) : someSelected ? (
                    <CheckSquare size={16} className="text-blue-400" />
                  ) : (
                    <Square size={16} />
                  )}
                  <span className="text-xs">{allSelected ? 'Deselect all' : 'Select all'}</span>
                </button>
              )}
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search by file name, type, collateral ID…"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
                />
              </div>
              <span className="text-xs text-gray-400 shrink-0">{filteredDocs.length} doc{filteredDocs.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
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
              filteredDocs.map((doc) => {
                const statusCfg = STATUS_CONFIG[doc.approvalStatus] ?? STATUS_CONFIG['pending'];
                const isBatchSelected = selectedIds.has(doc.id);
                const isDrawerSelected = selectedDoc?.id === doc.id && drawerOpen;
                const isActive = doc.approvalStatus === 'pending' || doc.approvalStatus === 'under_review';

                return (
                  <div
                    key={doc.id}
                    onClick={() => batchMode ? toggleSelectOne(doc.id, { stopPropagation: () => {} } as React.MouseEvent) : handleSelectDoc(doc)}
                    className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      batchMode && isBatchSelected ? 'bg-blue-50 border-l-4 border-l-blue-500' : !batchMode && isDrawerSelected ?'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Checkbox (batch mode) */}
                      {batchMode && (
                        <button
                          onClick={(e) => toggleSelectOne(doc.id, e)}
                          className="mt-1 shrink-0 text-gray-400 hover:text-blue-600 transition-colors"
                        >
                          {isBatchSelected ? (
                            <CheckSquare size={18} className="text-blue-600" />
                          ) : (
                            <Square size={18} />
                          )}
                        </button>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="shrink-0 w-7 h-7 rounded-lg bg-blue-50 border border-blue-100 flex items-center justify-center">
                              <FileText size={13} className="text-blue-600" />
                            </div>
                            <p className="text-sm font-semibold text-gray-900 truncate">{doc.fileName}</p>
                          </div>
                          <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${statusCfg.bgColor} ${statusCfg.textColor} ${statusCfg.borderColor}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusCfg.dot}`} />
                            {statusCfg.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mb-1.5 flex-wrap">
                          <span className="font-medium">{doc.documentType}</span>
                          <span className="text-gray-300">·</span>
                          <span>{doc.collateralId}</span>
                          <span className="text-gray-300">·</span>
                          <span>v{doc.version}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-gray-400">
                          <span>By {doc.uploadedByName}</span>
                          <span>{formatDate(doc.uploadedAt)}</span>
                          <span className="ml-auto">{formatFileSize(doc.fileSize)}</span>
                        </div>
                        {/* Quick action buttons (only in non-batch mode) */}
                        {isActive && isLegalOfficer && !batchMode && (
                          <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => setActionModal({ open: true, doc, action: 'approve' })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              <CheckCircle size={11} /> Approve
                            </button>
                            <button
                              onClick={() => setRejectConfirm({ open: true, doc })}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              <XCircle size={11} /> Reject
                            </button>
                            {doc.approvalStatus === 'pending' && (
                              <button
                                onClick={() => setActionModal({ open: true, doc, action: 'under_review' })}
                                className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                              >
                                <Eye size={11} /> Review
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Batch Action Panel */}
          {batchMode && selectedIds.size > 0 && (
            <BatchDocPanel
              selectedIds={selectedIds}
              selectedDocs={selectedBatchDocs}
              userId={user?.id ?? ''}
              userName={userProfile?.full_name || user?.email || 'Legal Officer'}
              userRole={userProfile?.role?.replace(/_/g, ' ') || 'Legal Officer'}
              canAct={isLegalOfficer}
              onClearSelection={clearSelection}
              onBatchComplete={() => loadData(true)}
            />
          )}
        </div>
      </div>

      {/* Drawer */}
      <WorkflowDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        width="w-[1000px]"
        overdueHours={
          selectedDoc &&
          (selectedDoc.approvalStatus === 'pending' || selectedDoc.approvalStatus === 'under_review')
            ? Math.max(0, (Date.now() - new Date(selectedDoc.uploadedAt).getTime()) / (1000 * 60 * 60))
            : undefined
        }
      >
        {selectedDoc && (
          <DetailPanel
            doc={selectedDoc}
            canAct={isLegalOfficer}
            onClose={handleCloseDrawer}
            onAction={(action) => {
              if (action === 'reject') {
                setRejectConfirm({ open: true, doc: selectedDoc });
              } else {
                setActionModal({ open: true, doc: selectedDoc, action });
              }
            }}
          />
        )}
      </WorkflowDrawer>

      {/* Action Modal */}
      <ActionModal
        state={actionModal}
        onClose={() => setActionModal({ open: false, doc: null, action: null })}
        onSubmit={handleAction}
        submitting={submitting}
      />

      {/* Reject Confirmation Modal */}
      {rejectConfirm.open && rejectConfirm.doc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            <div className="px-6 py-4 border-b bg-red-50 border-red-200">
              <div className="flex items-center gap-3">
                <XCircle size={22} className="text-red-500" />
                <h3 className="text-base font-semibold text-gray-900">Reject this Document?</h3>
              </div>
            </div>
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 leading-relaxed">
                You are about to reject <span className="font-semibold">{rejectConfirm.doc.fileName}</span> ({rejectConfirm.doc.documentType}). The submitter will be notified and a reason is required on the next step.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setRejectConfirm({ open: false, doc: null })}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const doc = rejectConfirm.doc!;
                  setRejectConfirm({ open: false, doc: null });
                  setActionModal({ open: true, doc, action: 'reject' });
                }}
                className="px-5 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
              >
                Yes, Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[70] flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}
    </div>
  );
}
