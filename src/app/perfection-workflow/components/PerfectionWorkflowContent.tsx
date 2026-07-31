'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronRight, MessageSquare, Send, RotateCcw, Eye, Plus, Search, X, History, Award, ArrowRight, UserCheck, Zap, CheckSquare, Square, Layers, Upload, FileText, Trash2, Download, FileType2, FileImage, File } from 'lucide-react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { perfectionService, PerfectionRequest, PerfectionComment, PerfectionRequestStatus, PerfectionStatusHistory } from '@/lib/supabase/perfectionService';
import { documentService, CollateralDocument, DocumentType } from '@/lib/supabase/documentService';
import { useAuth } from '@/contexts/AuthContext';
import { smsAlertService } from '@/lib/supabase/smsAlertService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { collateralLookupsService } from '@/lib/supabase/collateralLookupsService';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';

const STATUS_CONFIG: Record<PerfectionRequestStatus, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  Draft: { label: 'Draft', color: 'text-gray-600', bg: 'bg-gray-100', icon: <Clock size={12} /> },
  Submitted: { label: 'Submitted', color: 'text-blue-700', bg: 'bg-blue-100', icon: <Send size={12} /> },
  'Under Review': { label: 'Under Review', color: 'text-amber-700', bg: 'bg-amber-100', icon: <Eye size={12} /> },
  Approved: { label: 'Approved', color: 'text-green-700', bg: 'bg-green-100', icon: <CheckCircle size={12} /> },
  Perfected: { label: 'Perfected', color: 'text-emerald-700', bg: 'bg-emerald-100', icon: <Award size={12} /> },
  Rejected: { label: 'Rejected', color: 'text-red-700', bg: 'bg-red-100', icon: <XCircle size={12} /> },
  Returned: { label: 'Returned', color: 'text-orange-700', bg: 'bg-orange-100', icon: <RotateCcw size={12} /> },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string }> = {
  High: { color: 'text-red-700', bg: 'bg-red-50 border border-red-200' },
  Normal: { color: 'text-gray-600', bg: 'bg-gray-50 border border-gray-200' },
  Low: { color: 'text-blue-600', bg: 'bg-blue-50 border border-blue-200' },
};

const ACTION_LABELS: Record<string, string> = {
  submitted: 'Submitted',
  reviewed: 'Review Started',
  approved: 'Approved / Perfected',
  rejected: 'Rejected',
  returned: 'Returned for Revision',
  commented: 'Comment Added',
  reopened: 'Reopened',
};

const ACTION_COLORS: Record<string, string> = {
  submitted: 'bg-blue-500',
  reviewed: 'bg-amber-500',
  approved: 'bg-emerald-500',
  rejected: 'bg-red-500',
  returned: 'bg-orange-500',
  commented: 'bg-gray-400',
  reopened: 'bg-purple-500',
};

const STAGE_STATUS_COLORS: Record<string, string> = {
  Draft: 'bg-gray-400',
  Submitted: 'bg-blue-500',
  'Under Review': 'bg-amber-500',
  Perfected: 'bg-emerald-500',
  Approved: 'bg-green-500',
  Rejected: 'bg-red-500',
  Returned: 'bg-orange-500',
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Role Guidance Banner ──────────────────────────────────────────────────────
function RoleGuidanceBanner({ userRole }: { userRole: string }) {
  if (!userRole) return null;

  const config: Record<string, { icon: React.ReactNode; title: string; steps: string[]; color: string; bg: string; border: string }> = {
    credit_officer: {
      icon: <Send size={16} />,
      title: 'You are a Credit Officer',
      steps: [
        'Create a new perfection request using "New Request"',
        'Open a Draft or Returned request and click "Submit to Legal Officer"',
        'Monitor progress — you\'ll see updates as Legal reviews your request',
      ],
      color: 'text-blue-800',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    legal_officer: {
      icon: <UserCheck size={16} />,
      title: 'You are a Legal Officer',
      steps: [
        'Open any "Submitted" request and click "Start Review" to begin',
        'Once reviewing, open the "Under Review" request and choose: Perfect, Return, or Reject',
        'Add notes when perfecting or rejecting — they are required',
      ],
      color: 'text-amber-800',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
    system_admin: {
      icon: <Zap size={16} />,
      title: 'You are a System Admin',
      steps: [
        'You can perform all Credit Officer and Legal Officer actions',
        'Create, submit, review, perfect, return, or reject any request',
      ],
      color: 'text-purple-800',
      bg: 'bg-purple-50',
      border: 'border-purple-200',
    },
  };

  const cfg = config[userRole];
  if (!cfg) return null;

  return (
    <div className={`mx-6 mt-4 mb-1 rounded-xl border ${cfg.border} ${cfg.bg} px-4 py-3`}>
      <div className={`flex items-center gap-2 font-semibold text-sm mb-2 ${cfg.color}`}>
        {cfg.icon}
        {cfg.title} — How this workflow works for you:
      </div>
      <ol className="space-y-1">
        {cfg.steps.map((step, i) => (
          <li key={i} className={`flex items-start gap-2 text-xs ${cfg.color}`}>
            <span className={`shrink-0 w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold mt-0.5 ${cfg.color} border ${cfg.border} bg-white`}>
              {i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Workflow Stage Bar ────────────────────────────────────────────────────────
const WORKFLOW_STAGES: PerfectionRequestStatus[] = ['Submitted', 'Under Review', 'Perfected'];

const STAGE_DESCRIPTIONS: Record<PerfectionRequestStatus, string> = {
  Submitted: 'Waiting for Legal Officer to start review',
  'Under Review': 'Legal Officer is reviewing this request',
  Perfected: 'Collateral has been successfully perfected',
  Draft: 'Not yet submitted',
  Approved: 'Approved',
  Rejected: 'Request was rejected',
  Returned: 'Returned to Credit Officer for revision',
};

function WorkflowStageBar({ status, userRole }: { status: PerfectionRequestStatus; userRole: string }) {
  const isRejected = status === 'Rejected' || status === 'Returned';
  const currentIdx = WORKFLOW_STAGES.indexOf(status);
  const effectiveIdx = status === 'Approved' ? 2 : currentIdx;

  const nextActionHint: Partial<Record<PerfectionRequestStatus, Record<string, string>>> = {
    Draft: {
      credit_officer: '👉 Your turn: Open this request and click "Submit to Legal Officer"',
      system_admin: '👉 Submit this request to move it forward',
    },
    Submitted: {
      legal_officer: '👉 Your turn: Click "Start Review" to begin reviewing',
      system_admin: '👉 Click "Start Review" to begin reviewing',
      credit_officer: '⏳ Waiting for Legal Officer to start review',
    },
    'Under Review': {
      legal_officer: '👉 Your turn: Choose Perfect, Return, or Reject',
      system_admin: '👉 Choose Perfect, Return, or Reject to complete review',
      credit_officer: '⏳ Legal Officer is reviewing — no action needed',
    },
    Returned: {
      credit_officer: '👉 Your turn: Review the feedback and resubmit',
      system_admin: '👉 Review the feedback and resubmit',
    },
  };

  const hint = nextActionHint[status]?.[userRole];

  return (
    <div>
      <div className="flex items-center gap-1">
        {WORKFLOW_STAGES.map((step, i) => {
          const isDone = !isRejected && effectiveIdx > i;
          const isCurrent = !isRejected && effectiveIdx === i;
          return (
            <React.Fragment key={step}>
              <div className="flex flex-col items-center gap-1 flex-1">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-primary text-white ring-4 ring-primary/20' : 'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-xs text-center leading-tight ${isCurrent ? 'text-foreground font-semibold' : isDone ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {step}
                </span>
                {isCurrent && (
                  <span className="text-[10px] text-primary font-medium">← Current</span>
                )}
              </div>
              {i < WORKFLOW_STAGES.length - 1 && (
                <div className={`h-px flex-1 mb-7 ${isDone ? 'bg-emerald-400' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {isRejected && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-md ${
          status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
        }`}>
          {status === 'Rejected' ? '✗ Rejected — this request is closed' : '↩ Returned for Revision — Credit Officer must resubmit'}
        </div>
      )}
      {hint && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-md font-medium ${
          hint.startsWith('👉') ? 'bg-primary/5 text-primary border border-primary/20' : 'bg-muted text-muted-foreground border border-border'
        }`}>
          {hint}
        </div>
      )}
    </div>
  );
}

// ─── Status History Panel ──────────────────────────────────────────────────────
function StatusHistoryPanel({ history }: { history: PerfectionStatusHistory[] }) {
  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-8">No status history yet.</p>;
  }
  return (
    <div className="space-y-2">
      {history.map((h) => {
        const dotColor = STAGE_STATUS_COLORS[h.toStatus] ?? 'bg-gray-400';
        return (
          <div key={h.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${dotColor}`} />
              <div className="w-px flex-1 bg-border mt-1" />
            </div>
            <div className="pb-4 flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-semibold text-foreground">{h.changedByName || 'System'}</span>
                {h.changedByRole && (
                  <span className="text-xs text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">{h.changedByRole.replace('_', ' ')}</span>
                )}
                <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(h.createdAt)}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {h.fromStatus && (
                  <>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${STAGE_STATUS_COLORS[h.fromStatus] ?? 'bg-gray-400'} text-white`}>
                      {h.fromStatus}
                    </span>
                    <span className="text-sm text-muted-foreground">→</span>
                  </>
                )}
                <span className={`text-xs font-medium px-2 py-0.5 rounded ${dotColor} text-white`}>
                  {h.toStatus}
                </span>
              </div>
              {h.reason && (
                <p className="text-sm text-foreground/70 mt-1.5 italic bg-muted/40 px-3 py-2 rounded-md">{h.reason}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Batch Action Panel ────────────────────────────────────────────────────────
type BatchAction = 'submit' | 'review' | 'perfected' | 'reject' | 'return';

interface BatchActionPanelProps {
  selectedIds: Set<string>;
  selectedRequests: PerfectionRequest[];
  userRole: string;
  userId: string;
  userName: string;
  onClearSelection: () => void;
  onBatchComplete: () => void;
}

function BatchActionPanel({ selectedIds, selectedRequests, userRole, userId, userName, onClearSelection, onBatchComplete }: BatchActionPanelProps) {
  const [batchAction, setBatchAction] = useState<BatchAction | ''>('');
  const [batchComment, setBatchComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [results, setResults] = useState<{ id: string; success: boolean; error?: string }[]>([]);
  const [showResults, setShowResults] = useState(false);

  const isAdmin = userRole === 'system_admin';
  const isCreditOfficer = userRole === 'credit_officer' || isAdmin;
  const isLegalOfficer = userRole === 'legal_officer' || isAdmin;

  // Determine which actions are available based on selected items' statuses
  const selectedStatuses = new Set(selectedRequests.map(r => r.requestStatus));

  const availableActions: { value: BatchAction; label: string; color: string; icon: React.ReactNode; requiresComment: boolean }[] = [];

  if (isCreditOfficer && (selectedStatuses.has('Draft') || selectedStatuses.has('Returned'))) {
    availableActions.push({ value: 'submit', label: 'Submit to Legal Officer', color: 'bg-blue-600 hover:bg-blue-700', icon: <Send size={14} />, requiresComment: false });
  }
  if (isLegalOfficer && selectedStatuses.has('Submitted')) {
    availableActions.push({ value: 'review', label: 'Start Review', color: 'bg-amber-600 hover:bg-amber-700', icon: <Eye size={14} />, requiresComment: false });
  }
  if (isLegalOfficer && selectedStatuses.has('Under Review')) {
    availableActions.push({ value: 'perfected', label: 'Mark as Perfected', color: 'bg-emerald-600 hover:bg-emerald-700', icon: <Award size={14} />, requiresComment: true });
    availableActions.push({ value: 'return', label: 'Return for Revision', color: 'bg-orange-500 hover:bg-orange-600', icon: <RotateCcw size={14} />, requiresComment: true });
    availableActions.push({ value: 'reject', label: 'Reject', color: 'bg-red-600 hover:bg-red-700', icon: <XCircle size={14} />, requiresComment: true });
  }

  const selectedActionConfig = availableActions.find(a => a.value === batchAction);

  // Filter requests that are eligible for the chosen action
  function getEligibleRequests(action: BatchAction): PerfectionRequest[] {
    return selectedRequests.filter(r => {
      if (action === 'submit') return r.requestStatus === 'Draft' || r.requestStatus === 'Returned';
      if (action === 'review') return r.requestStatus === 'Submitted';
      if (action === 'perfected' || action === 'return' || action === 'reject') return r.requestStatus === 'Under Review';
      return false;
    });
  }

  async function handleBatchProcess() {
    if (!batchAction) { toast.error('Please select an action'); return; }
    if (selectedActionConfig?.requiresComment && !batchComment.trim()) {
      toast.error('A shared comment/reason is required for this action');
      return;
    }

    const eligible = getEligibleRequests(batchAction);
    if (eligible.length === 0) {
      toast.error('None of the selected records are eligible for this action');
      return;
    }

    setProcessing(true);
    setResults([]);

    const settled = await Promise.allSettled(
      eligible.map(async (req) => {
        try {
          if (batchAction === 'submit') {
            await perfectionService.submit(req.id, userId, userName, batchComment || 'Batch submitted.', userRole);
          } else if (batchAction === 'review') {
            await perfectionService.startReview(req.id, userId, userName, batchComment || 'Batch review started.', userRole);
          } else if (batchAction === 'perfected') {
            await perfectionService.perfected(req.id, userId, userName, batchComment, userRole);
          } else if (batchAction === 'reject') {
            await perfectionService.reject(req.id, userId, userName, batchComment, userRole);
          } else if (batchAction === 'return') {
            await perfectionService.returnForRevision(req.id, userId, userName, batchComment, userRole);
          }
          return { id: req.id, success: true };
        } catch (err: any) {
          return { id: req.id, success: false, error: err.message || 'Failed' };
        }
      })
    );

    const resultList = settled.map((s, i) =>
      s.status === 'fulfilled' ? s.value : { id: eligible[i].id, success: false, error: 'Unexpected error' }
    );

    setResults(resultList);
    setShowResults(true);
    setProcessing(false);

    const successCount = resultList.filter(r => r.success).length;
    const failCount = resultList.filter(r => !r.success).length;

    if (successCount > 0) toast.success(`${successCount} record${successCount > 1 ? 's' : ''} updated successfully`);
    if (failCount > 0) toast.error(`${failCount} record${failCount > 1 ? 's' : ''} failed`);

    onBatchComplete();
    if (failCount === 0) {
      setTimeout(() => {
        onClearSelection();
        setBatchAction('');
        setBatchComment('');
        setShowResults(false);
        setResults([]);
      }, 1500);
    }
  }

  const eligibleCount = batchAction ? getEligibleRequests(batchAction).length : selectedIds.size;

  return (
    <div className="border-t-2 border-primary bg-primary/5 px-4 py-3 shrink-0">
      <div className="flex items-start gap-3 flex-wrap">
        {/* Selection summary */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 bg-primary text-white text-xs font-bold px-2.5 py-1.5 rounded-lg">
            <Layers size={13} />
            {selectedIds.size} selected
          </div>
          <button
            onClick={onClearSelection}
            className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-1.5 border border-border rounded-md hover:bg-white transition-colors bg-white"
          >
            <X size={11} /> Clear
          </button>
        </div>

        {/* Action selector */}
        {availableActions.length > 0 ? (
          <div className="flex items-start gap-2 flex-1 flex-wrap">
            <select
              value={batchAction}
              onChange={(e) => { setBatchAction(e.target.value as BatchAction | ''); setShowResults(false); }}
              className="text-sm border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white min-w-[200px]"
            >
              <option value="">— Choose batch action —</option>
              {availableActions.map(a => (
                <option key={a.value} value={a.value}>{a.label}</option>
              ))}
            </select>

            {batchAction && (
              <div className="flex items-start gap-2 flex-1 flex-wrap">
                <textarea
                  value={batchComment}
                  onChange={(e) => setBatchComment(e.target.value)}
                  placeholder={
                    selectedActionConfig?.requiresComment
                      ? 'Shared comment/reason (required for all selected records)...'
                      : 'Shared comment (optional)...'
                  }
                  rows={1}
                  className="flex-1 min-w-[200px] text-sm border border-border rounded-md px-3 py-1.5 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
                />
                <button
                  onClick={handleBatchProcess}
                  disabled={processing || (selectedActionConfig?.requiresComment && !batchComment.trim())}
                  className={`flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-md text-white disabled:opacity-50 transition-colors shrink-0 ${selectedActionConfig?.color ?? 'bg-primary hover:bg-primary/90'}`}
                >
                  {processing ? (
                    <><Loader2 size={13} className="animate-spin" /> Processing {eligibleCount}...</>
                  ) : (
                    <>{selectedActionConfig?.icon} Apply to {eligibleCount} record{eligibleCount !== 1 ? 's' : ''}</>
                  )}
                </button>
              </div>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground py-1.5">No batch actions available for the selected records and your role.</p>
        )}
      </div>

      {/* Results summary */}
      {showResults && results.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {results.map(r => {
            const req = selectedRequests.find(req => req.id === r.id);
            return (
              <span
                key={r.id}
                className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                  r.success ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}
              >
                {r.success ? <CheckCircle2 size={10} /> : <XCircle size={10} />}
                {req?.collateralId ?? r.id.slice(0, 8)}
                {!r.success && r.error ? ` — ${r.error}` : ''}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Detail Modal ──────────────────────────────────────────────────────────────
interface DetailModalProps {
  request: PerfectionRequest;
  comments: PerfectionComment[];
  history: PerfectionStatusHistory[];
  userRole: string;
  userId: string;
  userName: string;
  isRoleResolved: boolean;
  onClose: () => void;
  onRefresh: () => void;
}

function DetailModal({ request, comments, history, userRole, userId, userName, onClose, onRefresh, isRoleResolved }: DetailModalProps) {
  const [actionLoading, setActionLoading] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [decisionNotes, setDecisionNotes] = useState('');
  const [activeAction, setActiveAction] = useState<'perfected' | 'reject' | 'return' | 'review' | 'comment' | null>(null);
  const [activeTab, setActiveTab] = useState<'activity' | 'history' | 'documents'>('activity');
  const [showSmsModal, setShowSmsModal] = useState(false);

  // ── Document upload state ──────────────────────────────────────────────────
  const [documents, setDocuments] = useState<CollateralDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<{ file: File; docType: string; notes: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
  const MAX_FILE_SIZE = 10 * 1024 * 1024;

  const PERFECTION_DOC_TYPES = [
    'Title Deed', 'Charge Certificate', 'Valuation Report', 'BRELA Confirmation',
    'Insurance Certificate', 'Board Resolution', 'Other',
  ];

  // Load documents when documents tab is opened and collateralRecordId is available
  useEffect(() => {
    if (activeTab === 'documents' && request.collateralRecordId) {
      setDocsLoading(true);
      documentService.getByCollateralId(request.collateralRecordId).then((docs) => {
        setDocuments(docs);
        setDocsLoading(false);
      }).catch(() => setDocsLoading(false));
    }
  }, [activeTab, request.collateralRecordId]);

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return `${file.name}: Unsupported type. Use PDF, JPG, PNG, or DOCX.`;
    if (file.size > MAX_FILE_SIZE) return `${file.name}: Exceeds 10MB limit.`;
    return null;
  };

  const addPendingFiles = (files: FileList | File[]) => {
    setUploadError(null);
    const errs: string[] = [];
    const valid: { file: File; docType: string; notes: string }[] = [];
    Array.from(files).forEach((f) => {
      const err = validateFile(f);
      if (err) errs.push(err);
      else valid.push({ file: f, docType: 'Other', notes: '' });
    });
    if (errs.length) setUploadError(errs.join(' '));
    if (valid.length) setPendingFiles((prev) => [...prev, ...valid]);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    addPendingFiles(e.dataTransfer.files);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addPendingFiles(e.target.files);
    e.target.value = '';
  };

  const handleUploadPending = async () => {
    if (!pendingFiles.length || !userId) return;
    if (!request.collateralRecordId) {
      setUploadError('This perfection request is not linked to a collateral record. Open the collateral record directly to upload documents.');
      return;
    }
    setUploading(true);
    setUploadError(null);
    const results = await Promise.all(
      pendingFiles.map((pf) =>
        documentService.upload(
          pf.file,
          request.collateralRecordId!,
          request.collateralId,
          pf.docType as DocumentType,
          pf.notes,
          userId,
          userName
        )
      )
    );
    const uploaded = results.filter((r) => 'doc' in r && r.doc).map((r) => (r as any).doc as CollateralDocument);
    const errors = results.filter((r) => 'error' in r && r.error).map((r) => (r as any).error as string);
    if (uploaded.length) {
      setDocuments((prev) => [...uploaded, ...prev]);
      toast.success(`${uploaded.length} document${uploaded.length > 1 ? 's' : ''} uploaded`);
    }
    if (errors.length) {
      setUploadError(errors.join(' '));
    }
    setPendingFiles([]);
    setUploading(false);
  };

  const handleDeleteDocument = async (doc: CollateralDocument) => {
    const ok = await documentService.delete(doc);
    if (ok) {
      setDocuments((prev) => prev.filter((d) => d.id !== doc.id));
      toast.success('Document removed');
    } else {
      toast.error('Failed to remove document');
    }
  };

  const getFileIcon = (mimeType: string) => {
    if (mimeType?.includes('pdf')) return <FileType2 size={15} className="text-red-500" />;
    if (mimeType?.includes('image')) return <FileImage size={15} className="text-blue-500" />;
    if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={15} className="text-indigo-500" />;
    return <FileText size={15} className="text-slate-500" />;
  };

  // ── End document upload state ──────────────────────────────────────────────

  const statusCfg = STATUS_CONFIG[request.requestStatus] ?? STATUS_CONFIG.Draft;
  const priorityCfg = PRIORITY_CONFIG[request.priority] ?? PRIORITY_CONFIG.Normal;

  const isAdmin = userRole === 'system_admin';
  const canSubmit = (userRole === 'credit_officer' || isAdmin) && (request.requestStatus === 'Draft' || request.requestStatus === 'Returned');
  const canReview = (userRole === 'legal_officer' || isAdmin) && request.requestStatus === 'Submitted';
  const canDecide = (userRole === 'legal_officer' || isAdmin) && request.requestStatus === 'Under Review';
  const canComment = ['credit_officer', 'legal_officer', 'system_admin'].includes(userRole);

  async function handleAction(type: 'submit' | 'review' | 'perfected' | 'reject' | 'return' | 'comment') {
    setActionLoading(true);
    try {
      if (type === 'submit') {
        await perfectionService.submit(request.id, userId, userName, commentText, userRole);
        toast.success('Request submitted to Legal Officer');
      } else if (type === 'review') {
        await perfectionService.startReview(request.id, userId, userName, commentText || 'Review started.', userRole);
        toast.success('Review started');
      } else if (type === 'perfected') {
        if (!decisionNotes.trim()) { toast.error('Please provide perfection notes'); setActionLoading(false); return; }
        await perfectionService.perfected(request.id, userId, userName, decisionNotes, userRole);
        toast.success('Collateral marked as Perfected');
      } else if (type === 'reject') {
        if (!decisionNotes.trim()) { toast.error('Please provide rejection reason'); setActionLoading(false); return; }
        await perfectionService.reject(request.id, userId, userName, decisionNotes, userRole);
        toast.success('Request rejected');
      } else if (type === 'return') {
        if (!decisionNotes.trim()) { toast.error('Please provide revision instructions'); setActionLoading(false); return; }
        await perfectionService.returnForRevision(request.id, userId, userName, decisionNotes, userRole);
        toast.success('Returned for revision');
      } else if (type === 'comment') {
        if (!commentText.trim()) { toast.error('Comment cannot be empty'); setActionLoading(false); return; }
        await perfectionService.addComment(request.id, userId, userName, commentText, userRole);
        toast.success('Comment added');
      }
      setCommentText('');
      setDecisionNotes('');
      setActiveAction(null);
      onRefresh();
      if (type !== 'comment') {
        onClose();
      }
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  const hasActions = canSubmit || canReview || canDecide || (canComment && !canSubmit && !canReview && !canDecide);
  const showSmsButton = request.requestStatus === 'Submitted' || request.requestStatus === 'Under Review';

  const actionHeaderLabel = canSubmit
    ? { icon: <Send size={14} />, text: 'Submit this request to Legal Officer', color: 'text-blue-700 bg-blue-50 border-blue-200' }
    : canReview
    ? { icon: <Eye size={14} />, text: 'Start your review of this request', color: 'text-amber-700 bg-amber-50 border-amber-200' }
    : canDecide
    ? { icon: <Award size={14} />, text: 'Make your decision on this request', color: 'text-emerald-700 bg-emerald-50 border-emerald-200' }
    : null;

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden bg-white">

        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-border bg-white shrink-0">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
              <Award size={20} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span className="text-sm font-mono text-muted-foreground">{request.collateralId}</span>
                <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${statusCfg.bg} ${statusCfg.color}`}>
                  {statusCfg.icon}{statusCfg.label}
                </span>
                <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${priorityCfg.bg} ${priorityCfg.color}`}>
                  {request.priority} Priority
                </span>
              </div>
              <h2 className="text-lg font-semibold text-foreground">{request.obligor}</h2>
              <p className="text-sm text-muted-foreground">{request.collateralType} · {request.registry}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors shrink-0">
            <X size={18} />
          </button>
        </div>

        {/* Modal Body — two columns */}
        <div className="flex flex-1 min-h-0 overflow-hidden">

          {/* Left Column — Details & Workflow */}
          <div className="w-80 shrink-0 border-r border-border flex flex-col overflow-y-auto bg-muted/20">

            {/* Workflow Stage */}
            <div className="px-5 py-5 border-b border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Workflow Progress</p>
              <WorkflowStageBar status={request.requestStatus} userRole={userRole} />
              {request.decisionNotes && (request.requestStatus === 'Rejected' || request.requestStatus === 'Returned' || request.requestStatus === 'Perfected') && (
                <div className={`mt-3 text-xs px-3 py-2 rounded-md ${
                  request.requestStatus === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' :
                  request.requestStatus === 'Returned'? 'bg-orange-50 text-orange-700 border border-orange-200' : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                }`}>
                  <span className="font-semibold">Reason: </span>{request.decisionNotes}
                </div>
              )}
            </div>

            {/* Metadata */}
            <div className="px-5 py-5 space-y-4">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Request Details</p>
              <div className="grid grid-cols-1 gap-3">
                <div className="bg-white rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">Submitted By</p>
                  <p className="text-sm font-medium text-foreground">{request.submittedByName || '—'}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">Submitted At</p>
                  <p className="text-sm font-medium text-foreground">{formatDate(request.submittedAt)}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">Reviewed By</p>
                  <p className="text-sm font-medium text-foreground">{request.reviewedByName || '—'}</p>
                </div>
                <div className="bg-white rounded-lg px-3 py-2.5 border border-border">
                  <p className="text-xs text-muted-foreground mb-0.5">Perfection Deadline</p>
                  <p className="text-sm font-medium text-foreground">{request.perfectionDeadline || '—'}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column — Tabs + Actions */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

            {/* Tabs */}
            <div className="flex border-b border-border shrink-0 bg-white">
              <button
                onClick={() => setActiveTab('activity')}
                className={`flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'activity' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <MessageSquare size={15} /> Activity
                {comments.length > 0 && (
                  <span className="ml-1 bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">{comments.length}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('documents')}
                className={`flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'documents' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Upload size={15} /> Documents
                {(documents.length > 0 || pendingFiles.length > 0) && (
                  <span className="ml-1 bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">{documents.length + pendingFiles.length}</span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('history')}
                className={`flex items-center justify-center gap-2 px-6 py-3.5 text-sm font-medium transition-colors border-b-2 ${
                  activeTab === 'history' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <History size={15} /> Status History
                {history.length > 0 && (
                  <span className="ml-1 bg-primary/10 text-primary text-xs font-bold px-1.5 py-0.5 rounded-full">{history.length}</span>
                )}
              </button>
            </div>

            {/* Tab Content — scrollable */}
            <div className="flex-1 overflow-y-auto px-6 py-5">
              {activeTab === 'activity' ? (
                <>
                  {comments.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <MessageSquare size={36} className="text-muted-foreground/40 mb-3" />
                      <p className="text-sm font-medium text-foreground">No activity yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Actions and comments will appear here</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {comments.map((c) => (
                        <div key={c.id} className="flex gap-3">
                          <div className="flex flex-col items-center">
                            <div className={`w-3 h-3 rounded-full mt-1.5 shrink-0 ${ACTION_COLORS[c.action] ?? 'bg-gray-400'}`} />
                            <div className="w-px flex-1 bg-border mt-1" />
                          </div>
                          <div className="pb-4 flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <span className="text-sm font-semibold text-foreground">{c.performedByName}</span>
                              <span className="text-xs text-muted-foreground capitalize bg-muted px-1.5 py-0.5 rounded">{c.performedByRole?.replace('_', ' ')}</span>
                              <span className="text-xs text-muted-foreground ml-auto">{formatDateTime(c.createdAt)}</span>
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded ${ACTION_COLORS[c.action] ?? 'bg-gray-400'} text-white`}>
                              {ACTION_LABELS[c.action] ?? c.action}
                            </span>
                            {c.comment && <p className="text-sm text-foreground/80 mt-2 bg-muted/40 px-3 py-2 rounded-md">{c.comment}</p>}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              ) : activeTab === 'documents' ? (
                <div className="space-y-5">
                  {/* Upload zone */}
                  {!request.collateralRecordId ? (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2">
                      <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-sm text-amber-800">
                        This request is not linked to a collateral record. Documents must be uploaded from the{' '}
                        <a href={`/collateral-management`} className="underline font-medium hover:text-amber-900">Collateral Registry</a>{' '}
                        by editing the collateral record directly.
                      </p>
                    </div>
                  ) : (
                    <>
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-2 flex items-center gap-2">
                          <Upload size={14} className="text-primary" />
                          Upload Perfection Documents
                        </h4>
                        <p className="text-xs text-muted-foreground mb-3">
                          Attach receipts, deed scans, BRELA confirmations, and other perfection proofs.
                        </p>
                        <div
                          onDrop={handleDrop}
                          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                          onDragLeave={() => setDragOver(false)}
                          onClick={() => fileInputRef.current?.click()}
                          className={`border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors ${
                            dragOver ? 'border-primary bg-primary/5' : 'border-border bg-muted/30 hover:bg-muted/50 hover:border-primary/40'
                          }`}
                        >
                          <Upload size={20} className="mx-auto mb-2 text-muted-foreground" />
                          <p className="text-sm font-medium text-muted-foreground mb-0.5">Drag & drop files here, or click to browse</p>
                          <p className="text-xs text-muted-foreground">PDF, JPG, PNG, DOCX — max 10MB each</p>
                          <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                            className="hidden"
                            onChange={handleFileInput}
                          />
                        </div>

                        {uploadError && (
                          <div className="mt-2 p-2.5 bg-destructive/10 border border-destructive/20 rounded-md flex items-start gap-2">
                            <AlertCircle size={13} className="text-destructive mt-0.5 shrink-0" />
                            <p className="text-xs text-destructive">{uploadError}</p>
                          </div>
                        )}

                        {/* Pending files queue */}
                        {pendingFiles.length > 0 && (
                          <div className="mt-3 space-y-2">
                            <p className="text-xs font-semibold text-foreground">Ready to upload ({pendingFiles.length} file{pendingFiles.length > 1 ? 's' : ''}):</p>
                            {pendingFiles.map((pf, idx) => (
                              <div key={`pf-${idx}`} className="flex items-start gap-2 p-2.5 bg-white border border-border rounded-lg">
                                <span className="mt-0.5">{getFileIcon(pf.file.type)}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium text-foreground truncate">{pf.file.name}</p>
                                  <p className="text-xs text-muted-foreground">{documentService.formatFileSize(pf.file.size)}</p>
                                  <div className="mt-1.5 flex gap-2">
                                    <select
                                      value={pf.docType}
                                      onChange={(e) => setPendingFiles((prev) => prev.map((p, i) => i === idx ? { ...p, docType: e.target.value } : p))}
                                      className="flex-1 px-2 py-1 text-xs border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                                    >
                                      {PERFECTION_DOC_TYPES.map((dt) => <option key={dt} value={dt}>{dt}</option>)}
                                    </select>
                                    <input
                                      type="text"
                                      placeholder="Notes (optional)"
                                      value={pf.notes}
                                      onChange={(e) => setPendingFiles((prev) => prev.map((p, i) => i === idx ? { ...p, notes: e.target.value } : p))}
                                      className="flex-1 px-2 py-1 text-xs border border-border rounded bg-white focus:outline-none focus:ring-1 focus:ring-primary/30"
                                    />
                                  </div>
                                </div>
                                <button type="button" onClick={() => setPendingFiles((prev) => prev.filter((_, i) => i !== idx))} className="text-muted-foreground hover:text-destructive transition-colors mt-0.5">
                                  <X size={13} />
                                </button>
                              </div>
                            ))}
                            <button
                              type="button"
                              onClick={handleUploadPending}
                              disabled={uploading}
                              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-white text-sm font-semibold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                            >
                              {uploading ? <><Loader2 size={14} className="animate-spin" /> Uploading...</> : <><Upload size={14} /> Upload {pendingFiles.length} File{pendingFiles.length > 1 ? 's' : ''}</>}
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Uploaded documents list */}
                      <div>
                        <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
                          <FileText size={14} className="text-primary" />
                          Uploaded Documents
                          {documents.length > 0 && <span className="ml-auto text-xs font-normal text-muted-foreground">{documents.length} file{documents.length !== 1 ? 's' : ''}</span>}
                        </h4>
                        {docsLoading ? (
                          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
                            <Loader2 size={15} className="animate-spin" />
                            <span className="text-sm">Loading documents...</span>
                          </div>
                        ) : documents.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground border border-dashed border-border rounded-lg">
                            <FileText size={24} className="mx-auto mb-2 opacity-40" />
                            <p className="text-sm">No documents uploaded yet</p>
                            <p className="text-xs mt-1">Upload title deeds, receipts, and perfection proofs above</p>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {documents.map((doc) => (
                              <div key={doc.id} className="flex items-start gap-3 p-3 bg-white border border-border rounded-lg hover:border-primary/30 transition-colors group">
                                <span className="mt-0.5">{getFileIcon(doc.mimeType)}</span>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <p className="text-sm font-medium text-foreground truncate max-w-[180px]">{doc.fileName}</p>
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-primary/10 text-primary">
                                      {doc.documentType}
                                    </span>
                                    <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono">v{doc.version}</span>
                                  </div>
                                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                    <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">{doc.uploadedByName}</span>
                                    <span className="text-xs text-muted-foreground">·</span>
                                    <span className="text-xs text-muted-foreground">
                                      {new Date(doc.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                    </span>
                                  </div>
                                  {doc.notes && <p className="text-xs text-muted-foreground mt-0.5 italic">{doc.notes}</p>}
                                </div>
                                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                  {doc.signedUrl && (
                                    <a
                                      href={doc.signedUrl}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-primary transition-colors"
                                      title="Download"
                                    >
                                      <Download size={13} />
                                    </a>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteDocument(doc)}
                                    className="p-1.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
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
                    </>
                  )}
                </div>
              ) : (
                <StatusHistoryPanel history={history} />
              )}
            </div>

            {/* Action Footer */}
            {!isRoleResolved && (request.requestStatus === 'Submitted' || request.requestStatus === 'Under Review' || request.requestStatus === 'Draft' || request.requestStatus === 'Returned') && (
              <div className="border-t border-border px-6 py-4 bg-white shrink-0 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 size={14} className="animate-spin" /> Loading actions...
              </div>
            )}
            {(hasActions || showSmsButton) && isRoleResolved && (
              <div className="border-t-2 border-primary/20 bg-white shrink-0">
                {actionHeaderLabel && (
                  <div className={`flex items-center gap-2 px-6 py-2.5 text-xs font-semibold border-b ${actionHeaderLabel.color}`}>
                    {actionHeaderLabel.icon}
                    <span>Your action required:</span>
                    <span className="font-normal">{actionHeaderLabel.text}</span>
                  </div>
                )}

                <div className="px-6 py-4 space-y-3">
                  {canSubmit && (
                    <div className="space-y-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a note for the Legal Officer (optional)..."
                        rows={2}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        onClick={() => handleAction('submit')}
                        disabled={actionLoading}
                        className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-semibold py-3 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors shadow-sm"
                      >
                        <Send size={15} /> {actionLoading ? 'Submitting...' : 'Submit to Legal Officer'}
                        {!actionLoading && <ArrowRight size={14} className="ml-auto" />}
                      </button>
                    </div>
                  )}

                  {canReview && (
                    <button
                      onClick={() => handleAction('review')}
                      disabled={actionLoading}
                      className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white text-sm font-semibold py-3 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors shadow-sm"
                    >
                      <Eye size={15} /> {actionLoading ? 'Starting...' : 'Start Review'}
                      {!actionLoading && <ArrowRight size={14} className="ml-auto" />}
                    </button>
                  )}

                  {canDecide && (
                    <div className="space-y-3">
                      {activeAction && (
                        <div className="space-y-2">
                          <label className="block text-sm font-semibold text-foreground">
                            {activeAction === 'perfected' ? '✅ Perfection Notes (required)' :
                             activeAction === 'reject' ? '❌ Rejection Reason (required)' : '↩ Revision Instructions (required)'}
                          </label>
                          <textarea
                            value={decisionNotes}
                            onChange={(e) => setDecisionNotes(e.target.value)}
                            placeholder={
                              activeAction === 'perfected' ? 'Describe how the collateral was perfected...' :
                              activeAction === 'reject' ? 'Provide reason for rejection (required)...' :
                              'Provide revision instructions (required)...'
                            }
                            rows={3}
                            className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleAction(activeAction)}
                              disabled={actionLoading}
                              className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-semibold py-3 rounded-lg disabled:opacity-50 transition-colors text-white shadow-sm ${
                                activeAction === 'perfected' ? 'bg-emerald-600 hover:bg-emerald-700' :
                                activeAction === 'reject' ? 'bg-red-600 hover:bg-red-700' : 'bg-orange-600 hover:bg-orange-700'
                              }`}
                            >
                              {actionLoading ? 'Processing...' :
                                activeAction === 'perfected' ? <><Award size={14} /> Confirm Perfected</> :
                                activeAction === 'reject' ? <><XCircle size={14} /> Confirm Rejection</> :
                                <><RotateCcw size={14} /> Confirm Return</>
                              }
                            </button>
                            <button onClick={() => { setActiveAction(null); setDecisionNotes(''); }} className="px-4 py-3 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                      {!activeAction && (
                        <div className="space-y-2">
                          <p className="text-xs text-muted-foreground font-medium">Choose your decision:</p>
                          <div className="flex gap-2">
                            <button onClick={() => setActiveAction('perfected')} className="flex-1 flex flex-col items-center gap-1 bg-emerald-600 text-white text-xs font-semibold py-3 rounded-lg hover:bg-emerald-700 transition-colors shadow-sm">
                              <Award size={16} />
                              <span>Mark Perfected</span>
                            </button>
                            <button onClick={() => setActiveAction('return')} className="flex-1 flex flex-col items-center gap-1 bg-orange-500 text-white text-xs font-semibold py-3 rounded-lg hover:bg-orange-600 transition-colors shadow-sm">
                              <RotateCcw size={16} />
                              <span>Return for Revision</span>
                            </button>
                            <button onClick={() => setActiveAction('reject')} className="flex-1 flex flex-col items-center gap-1 bg-red-600 text-white text-xs font-semibold py-3 rounded-lg hover:bg-red-700 transition-colors shadow-sm">
                              <XCircle size={16} />
                              <span>Reject</span>
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {canComment && !canSubmit && !canReview && !canDecide && (
                    <div className="space-y-2">
                      <textarea
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                        placeholder="Add a comment..."
                        rows={2}
                        className="w-full text-sm border border-border rounded-lg px-3 py-2 resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
                      />
                      <button
                        onClick={() => handleAction('comment')}
                        disabled={actionLoading || !commentText.trim()}
                        className="w-full flex items-center justify-center gap-2 bg-muted text-foreground text-sm font-medium py-2.5 rounded-lg hover:bg-muted/80 disabled:opacity-50 transition-colors border border-border"
                      >
                        <MessageSquare size={14} /> {actionLoading ? 'Adding...' : 'Add Comment'}
                      </button>
                    </div>
                  )}

                  {showSmsButton && (
                    <button
                      onClick={() => setShowSmsModal(true)}
                      className="w-full flex items-center justify-center gap-2 bg-violet-50 text-violet-700 border border-violet-200 text-sm font-medium py-2.5 rounded-lg hover:bg-violet-100 transition-colors"
                    >
                      <MessageSquare size={14} /> Send Approval Request SMS
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      {showSmsModal && <SmsApprovalModal request={request} onClose={() => setShowSmsModal(false)} />}
    </div>
  );
}

// ─── SMS Approval Modal ───────────────────────────────────────────────────────

interface SmsApprovalModalProps {
  request: PerfectionRequest;
  onClose: () => void;
}

function SmsApprovalModal({ request, onClose }: SmsApprovalModalProps) {
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://collateral8511.builtwithrocket.new';
  const message = smsAlertService.buildApprovalMessage(
    request.id.slice(0, 8).toUpperCase(),
    request.collateralId,
    appUrl
  );

  const handleSend = async () => {
    if (!phone.trim()) { setError('Phone number is required'); return; }
    setSending(true);
    setError(null);
    const result = await smsAlertService.sendAlert({
      to: phone.trim(),
      recipientName: recipientName.trim() || undefined,
      alertType: 'APPROVAL_REQUEST',
      collateralId: request.collateralId,
      actionUrl: `${appUrl}/perfection-workflow`,
      message,
    });
    setSending(false);
    if (result.success) {
      setSent(true);
      setTimeout(onClose, 1500);
    } else {
      setError(result.error || 'Failed to send SMS');
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <MessageSquare size={16} className="text-emerald-600" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Send Approval Request SMS</h3>
              <p className="text-xs text-muted-foreground">{request.collateralId} · {request.obligor}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Recipient Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. Legal Officer"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Phone Number *</label>
            <input
              type="tel"
              placeholder="+255712345678"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Message Preview</label>
            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg leading-relaxed">
              {message}
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0" /> {error}
            </div>
          )}
          {sent && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <CheckCircle2 size={13} className="shrink-0" /> SMS sent successfully!
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={handleSend}
            disabled={sending || sent}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : sent ? <CheckCircle2 size={14} /> : <MessageSquare size={14} />}
            {sending ? 'Sending...' : sent ? 'Sent!' : 'Send SMS Alert'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-muted-foreground bg-white border border-border hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Request Modal ─────────────────────────────────────────────────────────
interface NewRequestModalProps {
  onClose: () => void;
  onCreated: () => void;
  userId: string;
  userName: string;
}

function NewRequestModal({ onClose, onCreated, userId, userName }: NewRequestModalProps) {
  const [form, setForm] = useState({
    collateralId: '',
    obligor: '',
    collateralType: '',
    registry: '',
    perfectionDeadline: '',
    priority: 'Normal',
  });
  const [loading, setLoading] = useState(false);

  // Live collateral records for picker
  const [collateralRecords, setCollateralRecords] = useState<CollateralRecord[]>([]);
  const [collateralLoading, setCollateralLoading] = useState(true);
  const [selectedRecordId, setSelectedRecordId] = useState<string>('');
  const [collateralSearch, setCollateralSearch] = useState('');

  // Live lookup options
  const [collateralTypes, setCollateralTypes] = useState<string[]>([]);
  const [registries, setRegistries] = useState<string[]>([]);

  useEffect(() => {
    // Load collateral records that require perfection
    setCollateralLoading(true);
    Promise.all([
      collateralService.getAll(),
      collateralLookupsService.getCollateralTypeNames(),
      collateralLookupsService.getRegistryNames(),
    ]).then(([records, typeNames, registryNames]) => {
      // Filter to records that require perfection and are not yet perfected
      const eligible = records.filter(
        (r) => r.requiresPerfection && r.status !== 'Perfected' && r.status !== 'Released'
      );
      setCollateralRecords(eligible);
      setCollateralTypes(typeNames.length > 0 ? typeNames : ['Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel']);
      setRegistries(registryNames.length > 0 ? registryNames : ['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A']);
    }).catch(() => {
      setCollateralTypes(['Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel']);
      setRegistries(['BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A']);
    }).finally(() => setCollateralLoading(false));
  }, []);

  // Auto-populate form when a collateral record is selected
  function handleRecordSelect(recordId: string) {
    setSelectedRecordId(recordId);
    if (!recordId) {
      setForm(f => ({ ...f, collateralId: '', obligor: '', collateralType: '', registry: '', perfectionDeadline: '' }));
      return;
    }
    const record = collateralRecords.find(r => r.id === recordId);
    if (record) {
      setForm(f => ({
        ...f,
        collateralId: record.collateralId,
        obligor: record.obligor,
        collateralType: record.type,
        registry: record.registry,
        perfectionDeadline: record.perfectionDeadline || '',
      }));
    }
  }

  const filteredRecords = collateralRecords.filter(r =>
    !collateralSearch ||
    r.collateralId.toLowerCase().includes(collateralSearch.toLowerCase()) ||
    r.obligor.toLowerCase().includes(collateralSearch.toLowerCase())
  );

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.collateralId.trim() || !form.obligor.trim()) {
      toast.error('Collateral ID and Obligor are required');
      return;
    }
    setLoading(true);
    try {
      await perfectionService.create(
        {
          collateralRecordId: selectedRecordId || undefined,
          collateralId: form.collateralId,
          obligor: form.obligor,
          collateralType: form.collateralType || collateralTypes[0] || 'Mortgage',
          registry: form.registry || registries[0] || 'Lands Registry',
          perfectionDeadline: form.perfectionDeadline,
          priority: form.priority,
        },
        userId,
        userName
      );
      toast.success('Perfection request created');
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Failed to create request');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <h2 className="text-base font-semibold text-foreground">New Perfection Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Collateral Record Picker */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">
              Link to Collateral Record
              <span className="ml-1 text-muted-foreground font-normal">(auto-fills fields below)</span>
            </label>
            {collateralLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                <Loader2 size={13} className="animate-spin" /> Loading collateral records...
              </div>
            ) : collateralRecords.length === 0 ? (
              <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                <AlertCircle size={13} className="shrink-0" />
                No eligible collateral records found. Fill in the fields manually below.
              </div>
            ) : (
              <div className="space-y-2">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    placeholder="Search by ID or obligor..."
                    value={collateralSearch}
                    onChange={(e) => setCollateralSearch(e.target.value)}
                    className="w-full text-sm pl-8 pr-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                </div>
                <div className="border border-border rounded-md overflow-hidden max-h-40 overflow-y-auto">
                  <button
                    type="button"
                    onClick={() => handleRecordSelect('')}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors border-b border-border ${
                      !selectedRecordId ? 'bg-primary/5 text-primary font-medium' : 'hover:bg-muted/50 text-muted-foreground'
                    }`}
                  >
                    — Enter manually —
                  </button>
                  {filteredRecords.map(r => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => handleRecordSelect(r.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors border-b border-border last:border-b-0 ${
                        selectedRecordId === r.id ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <span className="font-medium text-foreground font-mono text-xs">{r.collateralId}</span>
                          <span className="mx-1.5 text-muted-foreground">·</span>
                          <span className="text-foreground">{r.obligor}</span>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{r.type}</span>
                      </div>
                      {r.perfectionDeadline && (
                        <p className="text-xs text-amber-600 mt-0.5">Deadline: {r.perfectionDeadline}</p>
                      )}
                    </button>
                  ))}
                  {filteredRecords.length === 0 && collateralSearch && (
                    <p className="px-3 py-3 text-xs text-muted-foreground text-center">No records match your search</p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Collateral ID + Priority */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Collateral ID *</label>
              <input
                value={form.collateralId}
                onChange={(e) => setForm(f => ({ ...f, collateralId: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="col-0000"
                readOnly={!!selectedRecordId}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option>High</option><option>Normal</option><option>Low</option>
              </select>
            </div>
          </div>

          {/* Obligor */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Obligor *</label>
            <input
              value={form.obligor}
              onChange={(e) => setForm(f => ({ ...f, obligor: e.target.value }))}
              className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Company / Individual name"
              readOnly={!!selectedRecordId}
            />
          </div>

          {/* Collateral Type + Registry */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Collateral Type</label>
              <select
                value={form.collateralType}
                onChange={(e) => setForm(f => ({ ...f, collateralType: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={!!selectedRecordId}
              >
                {!form.collateralType && <option value="">— Select —</option>}
                {collateralTypes.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Registry</label>
              <select
                value={form.registry}
                onChange={(e) => setForm(f => ({ ...f, registry: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                disabled={!!selectedRecordId}
              >
                {!form.registry && <option value="">— Select —</option>}
                {registries.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          </div>

          {/* Perfection Deadline */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Perfection Deadline</label>
            <input
              type="date"
              value={form.perfectionDeadline}
              onChange={(e) => setForm(f => ({ ...f, perfectionDeadline: e.target.value }))}
              className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose} className="flex-1 py-2 text-sm border border-border rounded-md hover:bg-muted transition-colors">Cancel</button>
            <button type="submit" disabled={loading} className="flex-1 py-2 text-sm bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {loading ? 'Creating...' : 'Create Request'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Content ──────────────────────────────────────────────────────────────
export default function PerfectionWorkflowContent() {
  const { user, userRole: authUserRole, userProfile: authUserProfile } = useAuth();
  const [requests, setRequests] = useState<PerfectionRequest[]>([]);
  const [comments, setComments] = useState<PerfectionComment[]>([]);
  const [statusHistory, setStatusHistory] = useState<PerfectionStatusHistory[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<PerfectionRequest | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Batch selection state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchMode, setBatchMode] = useState(false);

  const fetchRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await perfectionService.getAll();
      setRequests(data);
    } catch (err: any) {
      toast.error('Failed to load perfection requests');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchComments = useCallback(async (requestId: string) => {
    try {
      const [commentsData, historyData] = await Promise.all([
        perfectionService.getComments(requestId),
        perfectionService.getStatusHistory(requestId),
      ]);
      setComments(commentsData);
      setStatusHistory(historyData);
    } catch {
      setComments([]);
      setStatusHistory([]);
    }
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [fetchRequests]);

  async function handleSelectRequest(req: PerfectionRequest) {
    if (batchMode) return; // don't open modal in batch mode
    setSelectedRequest(req);
    await fetchComments(req.id);
  }

  async function handleRefresh() {
    await fetchRequests();
    if (selectedRequest) {
      const updated = await perfectionService.getById(selectedRequest.id);
      if (updated) {
        setSelectedRequest(updated);
        await fetchComments(updated.id);
      }
    }
  }

  const userRole = authUserRole ?? '';
  const userId = user?.id ?? '';
  const userName = authUserProfile?.full_name ?? user?.email ?? 'Unknown';

  const filtered = requests.filter((r) => {
    const matchStatus = !statusFilter || r.requestStatus === statusFilter;
    const matchSearch = !searchQuery ||
      r.obligor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.collateralId.toLowerCase().includes(searchQuery.toLowerCase());
    return matchStatus && matchSearch;
  });

  // KPI counts
  const kpis = {
    total: requests.length,
    submitted: requests.filter(r => r.requestStatus === 'Submitted').length,
    underReview: requests.filter(r => r.requestStatus === 'Under Review').length,
    perfected: requests.filter(r => r.requestStatus === 'Perfected' || r.requestStatus === 'Approved').length,
    rejected: requests.filter(r => r.requestStatus === 'Rejected').length,
  };

  function getActionRequired(req: PerfectionRequest): { label: string; color: string } | null {
    if (!userRole) return null;
    const isAdmin = userRole === 'system_admin';
    if ((userRole === 'credit_officer' || isAdmin) && (req.requestStatus === 'Draft' || req.requestStatus === 'Returned')) {
      return { label: req.requestStatus === 'Returned' ? 'Needs Resubmission' : 'Ready to Submit', color: 'bg-blue-100 text-blue-700' };
    }
    if ((userRole === 'legal_officer' || isAdmin) && req.requestStatus === 'Submitted') {
      return { label: 'Needs Review', color: 'bg-amber-100 text-amber-700' };
    }
    if ((userRole === 'legal_officer' || isAdmin) && req.requestStatus === 'Under Review') {
      return { label: 'Awaiting Decision', color: 'bg-orange-100 text-orange-700' };
    }
    return null;
  }

  // Batch selection helpers
  const allFilteredIds = filtered.map(r => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every(id => selectedIds.has(id));
  const someSelected = allFilteredIds.some(id => selectedIds.has(id));

  function toggleSelectAll() {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allFilteredIds));
    }
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

  function enterBatchMode() {
    setBatchMode(true);
    setSelectedIds(new Set());
  }

  const selectedRequests = filtered.filter(r => selectedIds.has(r.id));

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-6 py-5 border-b border-border bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-foreground">Perfection Approval Workflow</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Manage collateral perfection requests between Credit and Legal Officers
            </p>
          </div>
          <div className="flex items-center gap-2">
            {!batchMode ? (
              <button
                onClick={enterBatchMode}
                className="flex items-center gap-2 bg-white border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-muted transition-colors"
              >
                <Layers size={15} /> Batch Actions
              </button>
            ) : (
              <button
                onClick={clearSelection}
                className="flex items-center gap-2 bg-muted border border-border text-foreground text-sm font-medium px-4 py-2 rounded-lg hover:bg-muted/80 transition-colors"
              >
                <X size={15} /> Exit Batch Mode
              </button>
            )}
            {(userRole === 'credit_officer' || userRole === 'system_admin') && (
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Plus size={15} /> New Request
              </button>
            )}
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { label: 'Total', value: kpis.total, color: 'text-foreground', bg: 'bg-muted/50', filter: '' },
            { label: 'Submitted', value: kpis.submitted, color: 'text-blue-700', bg: 'bg-blue-50', filter: 'Submitted' },
            { label: 'Under Review', value: kpis.underReview, color: 'text-amber-700', bg: 'bg-amber-50', filter: 'Under Review' },
            { label: 'Perfected', value: kpis.perfected, color: 'text-emerald-700', bg: 'bg-emerald-50', filter: 'Perfected' },
            { label: 'Rejected', value: kpis.rejected, color: 'text-red-700', bg: 'bg-red-50', filter: 'Rejected' },
          ].map((k) => (
            <button
              key={k.label}
              onClick={() => setStatusFilter(k.filter)}
              className={`rounded-lg p-3 text-left transition-all border ${
                statusFilter === k.filter
                  ? 'border-primary/40 ring-1 ring-primary/20' : 'border-border hover:border-primary/20'
              } ${k.bg}`}
            >
              <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Role Guidance Banner */}
      {userRole && !batchMode && <RoleGuidanceBanner userRole={userRole} />}

      {/* Batch mode hint */}
      {batchMode && (
        <div className="mx-6 mt-4 mb-1 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 flex items-center gap-3">
          <Layers size={16} className="text-primary shrink-0" />
          <p className="text-sm text-primary font-medium">
            Batch mode active — check the boxes next to records, then use the action bar at the bottom to apply a status change to all selected records at once.
          </p>
        </div>
      )}

      {/* Body — full-width list */}
      <div className="flex flex-col flex-1 min-h-0 bg-white mt-3">
        {/* Search & Filter */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
          {/* Select-all checkbox (batch mode only) */}
          {batchMode && (
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground shrink-0 px-1"
              title={allSelected ? 'Deselect all' : 'Select all'}
            >
              {allSelected ? (
                <CheckSquare size={16} className="text-primary" />
              ) : someSelected ? (
                <CheckSquare size={16} className="text-primary/50" />
              ) : (
                <Square size={16} />
              )}
              <span className="text-xs">{allSelected ? 'Deselect all' : 'Select all'}</span>
            </button>
          )}
          <div className="relative flex-1 max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by obligor or ID..."
              className="w-full text-sm pl-8 pr-3 py-2 border border-border rounded-md focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="text-sm border border-border rounded-md px-2 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="">All Status</option>
            {Object.keys(STATUS_CONFIG).map(s => <option key={s} value={s}>{s}</option>)}
          </select>
          {statusFilter && (
            <button onClick={() => setStatusFilter('')} className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 px-2 py-2 border border-border rounded-md hover:bg-muted transition-colors">
              <X size={12} /> Clear
            </button>
          )}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="h-20 bg-muted/50 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center px-6">
              <AlertCircle size={36} className="text-muted-foreground mb-3" />
              <p className="text-sm font-medium text-foreground">No requests found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {statusFilter || searchQuery ? 'Try adjusting your filters' : 'Create a new perfection request to get started'}
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {filtered.map((req) => {
                const cfg = STATUS_CONFIG[req.requestStatus] ?? STATUS_CONFIG.Draft;
                const priorityCfg = PRIORITY_CONFIG[req.priority] ?? PRIORITY_CONFIG.Normal;
                const actionRequired = getActionRequired(req);
                const isChecked = selectedIds.has(req.id);
                return (
                  <div
                    key={req.id}
                    onClick={() => batchMode ? toggleSelectOne(req.id, { stopPropagation: () => {} } as React.MouseEvent) : handleSelectRequest(req)}
                    className={`w-full text-left px-5 py-4 transition-colors group flex items-start gap-3 cursor-pointer ${
                      isChecked ? 'bg-primary/5 border-l-4 border-l-primary' : actionRequired && !batchMode ? 'border-l-4 border-l-primary hover:bg-muted/30' : 'hover:bg-muted/30'
                    }`}
                  >
                    {/* Checkbox (batch mode) */}
                    {batchMode && (
                      <button
                        onClick={(e) => toggleSelectOne(req.id, e)}
                        className="mt-1 shrink-0 text-muted-foreground hover:text-primary transition-colors"
                      >
                        {isChecked ? (
                          <CheckSquare size={18} className="text-primary" />
                        ) : (
                          <Square size={18} />
                        )}
                      </button>
                    )}

                    <div className="flex items-start justify-between gap-4 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{req.collateralId}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon}{cfg.label}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityCfg.bg} ${priorityCfg.color}`}>
                            {req.priority}
                          </span>
                          {actionRequired && !batchMode && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${actionRequired.color}`}>
                              <Zap size={10} /> {actionRequired.label}
                            </span>
                          )}
                        </div>
                        <p className="text-sm font-semibold text-foreground">{req.obligor}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{req.collateralType} · {req.registry}</p>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end gap-1">
                        <p className="text-xs text-muted-foreground">By {req.submittedByName || '—'}</p>
                        {req.perfectionDeadline && (
                          <p className="text-xs text-muted-foreground">Due {req.perfectionDeadline}</p>
                        )}
                        {!batchMode && (actionRequired ? (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium mt-1">
                            Open to act <ArrowRight size={12} />
                          </span>
                        ) : (
                          <ChevronRight size={14} className="text-muted-foreground mt-1 group-hover:text-primary transition-colors" />
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Batch Action Panel — shown when items are selected */}
        {batchMode && selectedIds.size > 0 && (
          <BatchActionPanel
            selectedIds={selectedIds}
            selectedRequests={selectedRequests}
            userRole={userRole}
            userId={userId}
            userName={userName}
            onClearSelection={clearSelection}
            onBatchComplete={fetchRequests}
          />
        )}
      </div>

      {/* Detail Drawer */}
      <WorkflowDrawer
        open={!!selectedRequest && !batchMode}
        onClose={() => setSelectedRequest(null)}
        width="w-[720px]"
      >
        {selectedRequest && !batchMode && (
          <DetailModal
            request={selectedRequest}
            comments={comments}
            history={statusHistory}
            userRole={userRole}
            userId={userId}
            userName={userName}
            onClose={() => setSelectedRequest(null)}
            onRefresh={handleRefresh}
            isRoleResolved={!!userRole}
          />
        )}
      </WorkflowDrawer>

      {showNewModal && (
        <NewRequestModal
          onClose={() => setShowNewModal(false)}
          onCreated={fetchRequests}
          userId={userId}
          userName={userName}
        />
      )}
    </div>
  );
}
