'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, AlertCircle, ChevronRight, MessageSquare, Send, RotateCcw, Eye, Plus, Search, X, History, Award } from 'lucide-react';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { perfectionService, PerfectionRequest, PerfectionComment, PerfectionRequestStatus, PerfectionStatusHistory } from '@/lib/supabase/perfectionService';
import { useAuth } from '@/contexts/AuthContext';
import { smsAlertService } from '@/lib/supabase/smsAlertService';

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

// ─── Workflow Stage Bar ────────────────────────────────────────────────────────
const WORKFLOW_STAGES: PerfectionRequestStatus[] = ['Submitted', 'Under Review', 'Perfected'];

function WorkflowStageBar({ status }: { status: PerfectionRequestStatus }) {
  const isRejected = status === 'Rejected' || status === 'Returned';
  const currentIdx = WORKFLOW_STAGES.indexOf(status);
  const effectiveIdx = status === 'Approved' ? 2 : currentIdx;

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
                  isDone ? 'bg-emerald-500 text-white' : isCurrent ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                }`}>
                  {isDone ? '✓' : i + 1}
                </div>
                <span className={`text-xs text-center leading-tight ${isCurrent || isDone ? 'text-foreground font-medium' : 'text-muted-foreground'}`}>
                  {step}
                </span>
              </div>
              {i < WORKFLOW_STAGES.length - 1 && (
                <div className={`h-px flex-1 mb-5 ${isDone ? 'bg-emerald-400' : 'bg-border'}`} />
              )}
            </React.Fragment>
          );
        })}
      </div>
      {isRejected && (
        <div className={`mt-3 text-xs px-3 py-2 rounded-md ${
          status === 'Rejected' ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-orange-50 text-orange-700 border border-orange-200'
        }`}>
          {status === 'Rejected' ? '✗ Rejected' : '↩ Returned for Revision'}
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
  const [activeTab, setActiveTab] = useState<'activity' | 'history'>('activity');
  const [showSmsModal, setShowSmsModal] = useState(false);

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
    } catch (err: any) {
      toast.error(err.message || 'Action failed');
    } finally {
      setActionLoading(false);
    }
  }

  const hasActions = canSubmit || canReview || canDecide || (canComment && !canSubmit && !canReview && !canDecide);
  const showSmsButton = request.requestStatus === 'Submitted' || request.requestStatus === 'Under Review';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden border border-border">

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
              <WorkflowStageBar status={request.requestStatus} />
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
              <div className="border-t border-border px-6 py-4 bg-white shrink-0 space-y-3">

                {/* Credit Officer: Submit */}
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
                      className="w-full flex items-center justify-center gap-2 bg-primary text-white text-sm font-medium py-2.5 rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      <Send size={14} /> {actionLoading ? 'Submitting...' : 'Submit to Legal Officer'}
                    </button>
                  </div>
                )}

                {/* Legal Officer: Start Review */}
                {canReview && (
                  <button
                    onClick={() => handleAction('review')}
                    disabled={actionLoading}
                    className="w-full flex items-center justify-center gap-2 bg-amber-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                  >
                    <Eye size={14} /> {actionLoading ? 'Starting...' : 'Start Review'}
                  </button>
                )}

                {/* Legal Officer: Perfect / Reject / Return */}
                {canDecide && (
                  <div className="space-y-2">
                    {activeAction && (
                      <div className="space-y-2">
                        <label className="block text-sm font-medium text-foreground">
                          {activeAction === 'perfected' ? 'Perfection Notes *' :
                           activeAction === 'reject' ? 'Rejection Reason *' : 'Revision Instructions *'}
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
                            className={`flex-1 flex items-center justify-center gap-1.5 text-sm font-medium py-2.5 rounded-lg disabled:opacity-50 transition-colors text-white ${
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
                          <button onClick={() => { setActiveAction(null); setDecisionNotes(''); }} className="px-4 py-2.5 text-sm border border-border rounded-lg hover:bg-muted transition-colors">
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                    {!activeAction && (
                      <div className="flex gap-2">
                        <button onClick={() => setActiveAction('perfected')} className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-emerald-700 transition-colors">
                          <Award size={14} /> Perfect
                        </button>
                        <button onClick={() => setActiveAction('return')} className="flex-1 flex items-center justify-center gap-1.5 bg-orange-500 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-orange-600 transition-colors">
                          <RotateCcw size={14} /> Return
                        </button>
                        <button onClick={() => setActiveAction('reject')} className="flex-1 flex items-center justify-center gap-1.5 bg-red-600 text-white text-sm font-medium py-2.5 rounded-lg hover:bg-red-700 transition-colors">
                          <XCircle size={14} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Add Comment (all roles, when no primary action) */}
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

                {/* SMS Approval Request */}
                {showSmsButton && (
                  <button
                    onClick={() => setShowSmsModal(true)}
                    className="w-full flex items-center justify-center gap-2 bg-violet-50 text-violet-700 border border-violet-200 text-sm font-medium py-2.5 rounded-lg hover:bg-violet-100 transition-colors"
                  >
                    <MessageSquare size={14} /> Send Approval Request SMS
                  </button>
                )}
              </div>
            )}
          </div>
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
    collateralType: 'Mortgage',
    registry: 'Lands Registry',
    perfectionDeadline: '',
    priority: 'Normal',
  });
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.collateralId.trim() || !form.obligor.trim()) {
      toast.error('Collateral ID and Obligor are required');
      return;
    }
    setLoading(true);
    try {
      await perfectionService.create(form, userId, userName);
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
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">New Perfection Request</h2>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground"><X size={16} /></button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Collateral ID *</label>
              <input value={form.collateralId} onChange={(e) => setForm(f => ({ ...f, collateralId: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
                placeholder="col-0000" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Priority</label>
              <select value={form.priority} onChange={(e) => setForm(f => ({ ...f, priority: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30">
                <option>High</option><option>Normal</option><option>Low</option>
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Obligor *</label>
            <input value={form.obligor} onChange={(e) => setForm(f => ({ ...f, obligor: e.target.value }))}
              className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              placeholder="Company / Individual name" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Collateral Type</label>
              <select value={form.collateralType} onChange={(e) => setForm(f => ({ ...f, collateralType: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30">
                {['Mortgage','Debenture','Motor Vehicle','Shares (DSE)','FDR','Guarantee','Ship/Vessel'].map(t => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Registry</label>
              <select value={form.registry} onChange={(e) => setForm(f => ({ ...f, registry: e.target.value }))}
                className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30">
                {['BRELA','Lands Registry','TRA','DSE','TASAC','N/A'].map(r => <option key={r}>{r}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1">Perfection Deadline</label>
            <input type="date" value={form.perfectionDeadline} onChange={(e) => setForm(f => ({ ...f, perfectionDeadline: e.target.value }))}
              className="w-full text-sm border border-border rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30" />
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
          {(userRole === 'credit_officer' || userRole === 'system_admin') && (
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-primary text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
            >
              <Plus size={15} /> New Request
            </button>
          )}
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

      {/* Body — full-width list */}
      <div className="flex flex-col flex-1 min-h-0 bg-white">
        {/* Search & Filter */}
        <div className="px-4 py-3 border-b border-border flex items-center gap-2 shrink-0">
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
                return (
                  <button
                    key={req.id}
                    onClick={() => handleSelectRequest(req)}
                    className="w-full text-left px-5 py-4 hover:bg-muted/30 transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                          <span className="text-xs font-mono text-muted-foreground">{req.collateralId}</span>
                          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${cfg.bg} ${cfg.color}`}>
                            {cfg.icon}{cfg.label}
                          </span>
                          <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${priorityCfg.bg} ${priorityCfg.color}`}>
                            {req.priority}
                          </span>
                        </div>
                        <p className="text-sm font-semibold text-foreground">{req.obligor}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{req.collateralType} · {req.registry}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground">By {req.submittedByName || '—'}</p>
                        {req.perfectionDeadline && (
                          <p className="text-xs text-muted-foreground mt-0.5">Due {req.perfectionDeadline}</p>
                        )}
                        <ChevronRight size={14} className="text-muted-foreground mt-1 ml-auto group-hover:text-primary transition-colors" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      {selectedRequest && (
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
