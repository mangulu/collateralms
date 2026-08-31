'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { FileText, CheckCircle2, Clock, AlertTriangle, Send, BookOpen, Plus, RefreshCw, Loader2, ChevronRight, Edit2, Calendar, Shield, X, Save, Info, ArrowRight, Building2,  } from 'lucide-react';
import { creditPolicyReviewService, CreditPolicyReview, CprStage, CprApprovalStage, CprBotStatus, CprPriority, APPROVAL_STAGES, BOT_STATUS_CONFIG, PRIORITY_CONFIG, STAGE_CONFIG,  } from '@/lib/supabase/creditPolicyReviewService';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';
import Icon from '@/components/ui/AppIcon';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function isOverdue(dueDate: string | null, stage: CprApprovalStage): boolean {
  if (!dueDate || stage === 'Approved') return false;
  return new Date(dueDate) < new Date();
}

// ─── Badges ───────────────────────────────────────────────────────────────────

function BotStatusBadge({ status }: { status: CprBotStatus }) {
  const cfg = BOT_STATUS_CONFIG[status];
  const Icon = status === 'Acknowledged' ? CheckCircle2 : status === 'Submitted' ? Send : Clock;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      <Icon className="w-3 h-3" />
      {cfg.label}
    </span>
  );
}

function StageBadge({ stage }: { stage: CprApprovalStage }) {
  const cfg = STAGE_CONFIG[stage];
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      {stage}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: CprPriority }) {
  const cfg = PRIORITY_CONFIG[priority];
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${cfg.bg} ${cfg.color} border ${cfg.border}`}>
      {priority}
    </span>
  );
}

// ─── Stage Progress Bar ───────────────────────────────────────────────────────

function StageProgressBar({ currentStage }: { currentStage: CprApprovalStage }) {
  const currentIdx = APPROVAL_STAGES.indexOf(currentStage);
  return (
    <div className="flex items-center gap-0.5 w-full">
      {APPROVAL_STAGES.map((stage, idx) => {
        const done = idx < currentIdx;
        const active = idx === currentIdx;
        const cfg = STAGE_CONFIG[stage];
        return (
          <React.Fragment key={stage}>
            <div
              title={stage}
              className={`h-2 flex-1 rounded-sm transition-all ${
                done ? 'bg-green-400' : active ? cfg.bg.replace('bg-', 'bg-') + ' border ' + cfg.border : 'bg-slate-100'
              } ${active ? 'ring-1 ring-offset-0 ' + cfg.border : ''}`}
            />
            {idx < APPROVAL_STAGES.length - 1 && (
              <div className="w-px h-2 bg-slate-200" />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

// ─── Stage Timeline ───────────────────────────────────────────────────────────

function StageTimeline({ stages, onAdvance, canAdvance }: {
  stages: CprStage[];
  onAdvance: (stage: CprStage) => void;
  canAdvance: boolean;
}) {
  if (!stages.length) return (
    <div className="text-sm text-slate-400 italic py-4 text-center">No stage records found.</div>
  );

  return (
    <div className="space-y-2">
      {stages.map((s, idx) => {
        const isActive = s.status === 'In Progress';
        const isDone = s.status === 'Approved';
        const isPending = s.status === 'Pending';
        return (
          <div key={s.id} className={`flex items-start gap-3 p-3 rounded-lg border transition-all ${
            isActive ? 'bg-amber-50 border-amber-200' : isDone ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
          }`}>
            <div className={`mt-0.5 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold ${
              isDone ? 'bg-green-500 text-white' : isActive ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-500'
            }`}>
              {isDone ? <CheckCircle2 className="w-3.5 h-3.5" /> : idx + 1}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <span className={`text-sm font-semibold ${isDone ? 'text-green-800' : isActive ? 'text-amber-800' : 'text-slate-500'}`}>
                  {s.stage}
                </span>
                <div className="flex items-center gap-2">
                  {s.approvedAt && (
                    <span className="text-xs text-slate-400">{fmtDate(s.approvedAt)}</span>
                  )}
                  {isActive && canAdvance && (
                    <button
                      onClick={() => onAdvance(s)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold rounded transition-colors"
                    >
                      Advance <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              {s.comments && (
                <p className="text-xs text-slate-500 mt-0.5 truncate">{s.comments}</p>
              )}
              {s.approverName && (
                <p className="text-xs text-slate-400 mt-0.5">by {s.approverName}</p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Review Detail Drawer ─────────────────────────────────────────────────────

interface ReviewDetailProps {
  review: CreditPolicyReview;
  onClose: () => void;
  onRefresh: () => void;
  userId: string;
}

function ReviewDetailDrawer({ review, onClose, onRefresh, userId }: ReviewDetailProps) {
  const [stages, setStages] = useState<CprStage[]>([]);
  const [loadingStages, setLoadingStages] = useState(true);
  const [advanceStage, setAdvanceStage] = useState<CprStage | null>(null);
  const [advanceComment, setAdvanceComment] = useState('');
  const [advanceSaving, setAdvanceSaving] = useState(false);
  const [showBotModal, setShowBotModal] = useState(false);
  const [botStatus, setBotStatus] = useState<CprBotStatus>(review.botStatus);
  const [botSubDate, setBotSubDate] = useState(review.botSubmissionDate ?? '');
  const [botAckDate, setBotAckDate] = useState(review.botAcknowledgementDate ?? '');
  const [botRef, setBotRef] = useState(review.botReferenceNumber ?? '');
  const [botSaving, setBotSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    creditPolicyReviewService.getStages(review.id).then(s => {
      setStages(s);
      setLoadingStages(false);
    });
  }, [review.id]);

  async function handleAdvance() {
    if (!advanceStage) return;
    setAdvanceSaving(true);
    setError(null);
    try {
      await creditPolicyReviewService.advanceStage({
        reviewId: review.id,
        stageId: advanceStage.id,
        comments: advanceComment.trim() || undefined,
        approverId: userId,
      });
      setAdvanceStage(null);
      setAdvanceComment('');
      onRefresh();
      const updated = await creditPolicyReviewService.getStages(review.id);
      setStages(updated);
    } catch (e: any) {
      setError(e.message ?? 'Failed to advance stage.');
    } finally {
      setAdvanceSaving(false);
    }
  }

  async function handleBotSave() {
    setBotSaving(true);
    setError(null);
    try {
      await creditPolicyReviewService.updateBotStatus({
        reviewId: review.id,
        botStatus,
        botSubmissionDate: botSubDate || undefined,
        botAcknowledgementDate: botAckDate || undefined,
        botReferenceNumber: botRef || undefined,
      });
      setShowBotModal(false);
      onRefresh();
    } catch (e: any) {
      setError(e.message ?? 'Failed to update BOT status.');
    } finally {
      setBotSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-xl bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-200 bg-slate-50">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <PriorityBadge priority={review.priority} />
              <span className="text-xs text-slate-400 font-mono">{review.policyReference}</span>
            </div>
            <h2 className="text-base font-bold text-slate-800 leading-snug">{review.policyTitle}</h2>
            <p className="text-xs text-slate-500 mt-0.5">{review.reviewYear} · {review.reviewCycle} Review</p>
          </div>
          <button onClick={onClose} className="ml-3 p-1.5 rounded hover:bg-slate-200 text-slate-500 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Status Strip */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1.5 font-medium">Approval Stage</p>
              <StageBadge stage={review.currentStage} />
              <div className="mt-2">
                <StageProgressBar currentStage={review.currentStage} />
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 border border-slate-200">
              <p className="text-xs text-slate-500 mb-1.5 font-medium">BOT Submission</p>
              <BotStatusBadge status={review.botStatus} />
              {review.botReferenceNumber && (
                <p className="text-xs text-slate-500 mt-1.5 font-mono">{review.botReferenceNumber}</p>
              )}
              <button
                onClick={() => setShowBotModal(true)}
                className="mt-2 text-xs text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
              >
                <Edit2 className="w-3 h-3" /> Update
              </button>
            </div>
          </div>

          {/* Key Dates */}
          <div className="grid grid-cols-3 gap-2">
            {[
              { label: 'Due Date', value: review.dueDate, warn: isOverdue(review.dueDate, review.currentStage) },
              { label: 'BOT Submitted', value: review.botSubmissionDate, warn: false },
              { label: 'BOT Acknowledged', value: review.botAcknowledgementDate, warn: false },
            ].map(item => (
              <div key={item.label} className={`rounded-lg p-2.5 border ${item.warn ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-200'}`}>
                <p className={`text-xs font-medium mb-0.5 ${item.warn ? 'text-red-600' : 'text-slate-500'}`}>{item.label}</p>
                <p className={`text-sm font-semibold ${item.warn ? 'text-red-700' : 'text-slate-700'}`}>{fmtDate(item.value)}</p>
              </div>
            ))}
          </div>

          {/* Description */}
          {review.description && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-700 mb-1 flex items-center gap-1"><Info className="w-3 h-3" /> Description</p>
              <p className="text-sm text-blue-800 leading-relaxed">{review.description}</p>
            </div>
          )}

          {/* Notes */}
          {review.notes && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-amber-700 mb-1">Notes</p>
              <p className="text-sm text-amber-800 leading-relaxed">{review.notes}</p>
            </div>
          )}

          {/* Stage Timeline */}
          <div>
            <h3 className="text-sm font-bold text-slate-700 mb-3 flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" /> Approval Stage Workflow
            </h3>
            {loadingStages ? (
              <div className="flex items-center gap-2 text-slate-400 text-sm py-4">
                <Loader2 className="w-4 h-4 animate-spin" /> Loading stages…
              </div>
            ) : (
              <StageTimeline
                stages={stages}
                onAdvance={s => setAdvanceStage(s)}
                canAdvance={review.currentStage !== 'Approved'}
              />
            )}
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
            </div>
          )}
        </div>
      </div>

      {/* Advance Stage Modal */}
      {advanceStage && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setAdvanceStage(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-800 mb-1">Advance Stage</h3>
            <p className="text-sm text-slate-500 mb-4">
              Approve <span className="font-semibold text-slate-700">"{advanceStage.stage}"</span> and move to the next stage.
            </p>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Comments (optional)</label>
            <textarea
              value={advanceComment}
              onChange={e => setAdvanceComment(e.target.value)}
              rows={3}
              placeholder="Add approval comments or notes…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={() => setAdvanceStage(null)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleAdvance}
                disabled={advanceSaving}
                className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {advanceSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Approve & Advance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* BOT Status Modal */}
      {showBotModal && (
        <div className="fixed inset-0 z-60 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowBotModal(false)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
            <h3 className="text-base font-bold text-slate-800 mb-4 flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" /> Update BOT Submission Status
            </h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">BOT Status</label>
                <div className="flex gap-2">
                  {(['Pending', 'Submitted', 'Acknowledged'] as CprBotStatus[]).map(s => (
                    <button
                      key={s}
                      onClick={() => setBotStatus(s)}
                      className={`flex-1 py-2 rounded-lg text-xs font-semibold border transition-all ${
                        botStatus === s
                          ? `${BOT_STATUS_CONFIG[s].bg} ${BOT_STATUS_CONFIG[s].color} ${BOT_STATUS_CONFIG[s].border} ring-2 ring-offset-1 ${BOT_STATUS_CONFIG[s].border}`
                          : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Submission Date</label>
                <input type="date" value={botSubDate} onChange={e => setBotSubDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Acknowledgement Date</label>
                <input type="date" value={botAckDate} onChange={e => setBotAckDate(e.target.value)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">BOT Reference Number</label>
                <input type="text" value={botRef} onChange={e => setBotRef(e.target.value)}
                  placeholder="e.g. BOT/CRM/2026/0042"
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>
            </div>
            {error && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">{error}</div>
            )}
            <div className="flex gap-2 mt-5">
              <button onClick={() => setShowBotModal(false)} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleBotSave}
                disabled={botSaving}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {botSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Create Review Modal ──────────────────────────────────────────────────────

interface CreateModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}

function CreateReviewModal({ open, onClose, onSaved, userId }: CreateModalProps) {
  const [title, setTitle] = useState('');
  const [reference, setReference] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [priority, setPriority] = useState<CprPriority>('High');
  const [dueDate, setDueDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!title.trim()) { setError('Policy title is required.'); return; }
    if (!reference.trim()) { setError('Policy reference is required.'); return; }
    const yr = parseInt(year);
    if (isNaN(yr) || yr < 2000 || yr > 2100) { setError('Invalid review year.'); return; }
    setSaving(true);
    setError(null);
    try {
      await creditPolicyReviewService.createReview({
        policyTitle: title.trim(),
        policyReference: reference.trim(),
        reviewYear: yr,
        priority,
        dueDate: dueDate || undefined,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        initiatedBy: userId,
        assignedTo: userId,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message ?? 'Failed to create review.');
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <Modal isOpen={open} onClose={onClose} title="Initiate Credit Policy Review">
      <div className="space-y-4 p-1">
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Policy Title *</label>
            <input type="text" value={title} onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Credit Risk Management Policy"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Policy Reference *</label>
            <input type="text" value={reference} onChange={e => setReference(e.target.value)}
              placeholder="e.g. CRMP-2026-001"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Review Year *</label>
            <input type="number" value={year} onChange={e => setYear(e.target.value)}
              min={2020} max={2100}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Priority</label>
            <select value={priority} onChange={e => setPriority(e.target.value as CprPriority)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
              {(['Low', 'Medium', 'High', 'Critical'] as CprPriority[]).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Due Date</label>
            <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Description</label>
            <textarea value={description} onChange={e => setDescription(e.target.value)} rows={2}
              placeholder="Brief description of the policy scope and review objectives…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              placeholder="Additional notes or context…"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 resize-none" />
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {error}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Initiate Review
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Review Card ──────────────────────────────────────────────────────────────

function ReviewCard({ review, onClick }: { review: CreditPolicyReview; onClick: () => void }) {
  const overdue = isOverdue(review.dueDate, review.currentStage);
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border cursor-pointer hover:shadow-md transition-all group ${
        overdue ? 'border-red-200 hover:border-red-300' : 'border-slate-200 hover:border-blue-300'
      }`}
    >
      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 flex-wrap">
            <PriorityBadge priority={review.priority} />
            <span className="text-xs text-slate-400 font-mono">{review.policyReference}</span>
            {overdue && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
                <AlertTriangle className="w-3 h-3" /> Overdue
              </span>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-400 flex-shrink-0 mt-0.5 transition-colors" />
        </div>
        <h3 className="text-sm font-bold text-slate-800 mb-1 leading-snug">{review.policyTitle}</h3>
        <p className="text-xs text-slate-500 mb-3">{review.reviewYear} · {review.reviewCycle} Review</p>

        {/* Progress bar */}
        <div className="mb-3">
          <StageProgressBar currentStage={review.currentStage} />
        </div>

        <div className="flex items-center justify-between gap-2">
          <StageBadge stage={review.currentStage} />
          <BotStatusBadge status={review.botStatus} />
        </div>

        {review.dueDate && (
          <div className={`mt-2 flex items-center gap-1 text-xs ${overdue ? 'text-red-600' : 'text-slate-400'}`}>
            <Calendar className="w-3 h-3" />
            Due {fmtDate(review.dueDate)}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KpiStrip({ stats }: { stats: Awaited<ReturnType<typeof creditPolicyReviewService.getStats>> }) {
  const kpis = [
    { label: 'Total Reviews', value: stats.total, icon: FileText, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
    { label: 'Pending BOT', value: stats.byBotStatus['Pending'] ?? 0, icon: Clock, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
    { label: 'Submitted to BOT', value: stats.byBotStatus['Submitted'] ?? 0, icon: Send, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
    { label: 'BOT Acknowledged', value: stats.byBotStatus['Acknowledged'] ?? 0, icon: CheckCircle2, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
    { label: 'Overdue', value: stats.overdueCount, icon: AlertTriangle, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-6">
      {kpis.map(k => (
        <div key={k.label} className={`rounded-xl border p-4 ${k.bg} ${k.border}`}>
          <div className="flex items-center gap-2 mb-1">
            <k.icon className={`w-4 h-4 ${k.color}`} />
            <span className={`text-xs font-medium ${k.color}`}>{k.label}</span>
          </div>
          <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreditPolicyReviewContent() {
  const { user } = useAuth();
  const [reviews, setReviews] = useState<CreditPolicyReview[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof creditPolicyReviewService.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedReview, setSelectedReview] = useState<CreditPolicyReview | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [filterStage, setFilterStage] = useState<CprApprovalStage | ''>('');
  const [filterBot, setFilterBot] = useState<CprBotStatus | ''>('');
  const [filterYear, setFilterYear] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [data, s] = await Promise.all([
        creditPolicyReviewService.listReviews({
          stage: filterStage || undefined,
          botStatus: filterBot || undefined,
          year: filterYear ? parseInt(filterYear) : undefined,
        }),
        creditPolicyReviewService.getStats(),
      ]);
      setReviews(data);
      setStats(s);
    } finally {
      setLoading(false);
    }
  }, [filterStage, filterBot, filterYear]);

  useEffect(() => { load(); }, [load]);

  const filtered = reviews.filter(r =>
    !searchTerm ||
    r.policyTitle.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.policyReference.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const years = Array.from(new Set(reviews.map(r => r.reviewYear))).sort((a, b) => b - a);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <BookOpen className="w-5 h-5 text-blue-600" />
            <h1 className="text-xl font-bold text-slate-800">Credit Policy Review Workflow</h1>
          </div>
          <p className="text-sm text-slate-500">Board-level annual credit policy reviews with approval stages and BOT submission tracking</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors shadow-sm"
          >
            <Plus className="w-4 h-4" /> Initiate Review
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {stats && <KpiStrip stats={stats} />}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <input
          type="text"
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          placeholder="Search policies…"
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 w-52"
        />
        <select value={filterStage} onChange={e => setFilterStage(e.target.value as any)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">All Stages</option>
          {APPROVAL_STAGES.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
        <select value={filterBot} onChange={e => setFilterBot(e.target.value as any)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">All BOT Statuses</option>
          {(['Pending', 'Submitted', 'Acknowledged'] as CprBotStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select value={filterYear} onChange={e => setFilterYear(e.target.value)}
          className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white">
          <option value="">All Years</option>
          {years.map(y => <option key={y} value={String(y)}>{y}</option>)}
        </select>
        {(filterStage || filterBot || filterYear || searchTerm) && (
          <button
            onClick={() => { setFilterStage(''); setFilterBot(''); setFilterYear(''); setSearchTerm(''); }}
            className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-slate-400">
          <Loader2 className="w-6 h-6 animate-spin mr-2" /> Loading reviews…
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-slate-400">
          <BookOpen className="w-10 h-10 mb-3 opacity-30" />
          <p className="text-sm font-medium">No policy reviews found</p>
          <p className="text-xs mt-1">Initiate a new review to get started</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(r => (
            <ReviewCard key={r.id} review={r} onClick={() => setSelectedReview(r)} />
          ))}
        </div>
      )}

      {/* Detail Drawer */}
      {selectedReview && (
        <ReviewDetailDrawer
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onRefresh={() => {
            load();
            // Refresh selected review
            creditPolicyReviewService.getReview(selectedReview.id).then(r => {
              if (r) setSelectedReview(r);
            });
          }}
          userId={user?.id ?? ''}
        />
      )}

      {/* Create Modal */}
      <CreateReviewModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onSaved={() => { setShowCreate(false); load(); }}
        userId={user?.id ?? ''}
      />
    </div>
  );
}
