'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Zap,
  Calendar,
  AlertTriangle,
  Clock,
  CheckCircle2,
  PenLine,
  RefreshCw,
  X,
  FileText,
  Stamp,
  AlertCircle,
  BadgeCheck,
  ShieldCheck,
  ClipboardCheck,
} from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { legalSignOffService, LegalSignOff } from '@/lib/supabase/legalSignOffService';
import { auditLogService } from '@/lib/supabase/auditLogService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Sign-Off Modal (self-contained for the panel) ────────────────────────────

interface SignOffModalProps {
  collateral: CollateralRecord;
  userId: string;
  userName: string;
  userRole: string;
  onClose: () => void;
  onSigned: () => void;
}

function SignOffModal({ collateral, userId, userName, userRole, onClose, onSigned }: SignOffModalProps) {
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const signedAt = new Date();

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
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <Stamp size={18} className="text-emerald-600" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Complete Legal Review</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                Sign off on <span className="font-medium text-foreground font-mono">{collateral.collateralId}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Collateral summary */}
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Obligor</span>
              <span className="text-xs font-medium text-foreground">{collateral.obligor}</span>
            </div>
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
              <span className="text-xs text-muted-foreground">Sign-Off Timestamp</span>
              <span className="text-xs font-mono text-foreground">{signedAt.toLocaleString()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Signing Officer</span>
              <span className="text-xs font-medium text-foreground">{userName}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">
              Sign-Off Notes <span className="text-muted-foreground font-normal">(optional)</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add any observations, conditions, or remarks regarding this perfection sign-off…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Declaration checkbox */}
          <label className="flex items-start gap-3 cursor-pointer group">
            <div className="relative mt-0.5 shrink-0">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => { setConfirmed(e.target.checked); if (e.target.checked) setError(''); }}
                className="sr-only"
              />
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
            disabled={submitting || !confirmed}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <RefreshCw size={14} className="animate-spin" /> : <PenLine size={14} />}
            {submitting ? 'Signing…' : 'Complete Review'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Quick Actions Panel ──────────────────────────────────────────────────────

interface QuickActionsPanelProps {
  collateral: CollateralRecord;
  onSignOffComplete?: () => void;
}

export default function QuickActionsPanel({ collateral, onSignOffComplete }: QuickActionsPanelProps) {
  const { user, userProfile, userRole } = useAuth();
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

  // ── Deadline info ──
  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;
  const isBRELA = collateral.registry === 'BRELA';

  const deadlineLabel = collateral.daysToDeadline === null
    ? 'No deadline set'
    : isOverdue
      ? `${Math.abs(collateral.daysToDeadline)}d overdue`
      : collateral.daysToDeadline === 0
        ? 'Due today'
        : `${collateral.daysToDeadline}d remaining`;

  const deadlineColor = isOverdue
    ? 'text-red-600'
    : isApproaching
      ? 'text-amber-600' :'text-emerald-600';

  const deadlineBg = isOverdue
    ? 'bg-red-50 border-red-200'
    : isApproaching
      ? 'bg-amber-50 border-amber-200' :'bg-emerald-50 border-emerald-200';

  const deadlineIcon = isOverdue
    ? <AlertTriangle size={14} className="text-red-500 shrink-0" />
    : isApproaching
      ? <Clock size={14} className="text-amber-500 shrink-0" />
      : <Calendar size={14} className="text-emerald-500 shrink-0" />;

  // ── Legal review status ──
  const activeSignOffs = signOffs.filter((s) => s.status === 'signed');
  const hasPendingReview = collateral.status === 'Perfected' && activeSignOffs.length === 0;
  const hasCompletedReview = activeSignOffs.length > 0;
  const canCompleteReview = !!user && collateral.status === 'Perfected' && !hasCompletedReview;

  const legalStatusLabel = loadingSignOffs
    ? 'Loading…'
    : hasCompletedReview
      ? `Signed off (${activeSignOffs.length})`
      : collateral.status === 'Perfected' ?'Pending sign-off' :'Not yet perfected';

  const legalStatusColor = hasCompletedReview
    ? 'text-emerald-600'
    : hasPendingReview
      ? 'text-amber-600' :'text-muted-foreground';

  const legalStatusBg = hasCompletedReview
    ? 'bg-emerald-50 border-emerald-200'
    : hasPendingReview
      ? 'bg-amber-50 border-amber-200' :'bg-muted/40 border-border';

  return (
    <>
      {/* Sticky panel */}
      <div className="sticky top-4 z-30">
        <div className="bg-white rounded-xl border border-border shadow-lg overflow-hidden">
          {/* Panel header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
            <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
              <Zap size={13} className="text-primary" />
            </div>
            <h3 className="text-xs font-700 text-foreground uppercase tracking-wider">Quick Actions</h3>
          </div>

          <div className="p-4 space-y-3">
            {/* ── BRELA Deadline ── */}
            <div className={`rounded-lg border p-3 ${isBRELA ? deadlineBg : 'bg-muted/30 border-border'}`}>
              <div className="flex items-center gap-2 mb-1.5">
                {isBRELA ? deadlineIcon : <Calendar size={14} className="text-muted-foreground shrink-0" />}
                <span className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide">
                  {isBRELA ? 'BRELA Deadline' : 'Registry Deadline'}
                </span>
              </div>
              <div className="pl-5">
                {collateral.perfectionDeadline ? (
                  <>
                    <p className="text-sm font-600 text-foreground">{collateral.perfectionDeadline}</p>
                    <p className={`text-xs font-500 mt-0.5 ${isBRELA ? deadlineColor : 'text-muted-foreground'}`}>
                      {isBRELA ? deadlineLabel : `${collateral.registry} · ${deadlineLabel}`}
                    </p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No deadline configured</p>
                )}
              </div>
            </div>

            {/* ── Legal Review Status ── */}
            <div className={`rounded-lg border p-3 ${legalStatusBg}`}>
              <div className="flex items-center gap-2 mb-1.5">
                {hasCompletedReview
                  ? <BadgeCheck size={14} className="text-emerald-500 shrink-0" />
                  : hasPendingReview
                    ? <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                    : <ShieldCheck size={14} className="text-muted-foreground shrink-0" />
                }
                <span className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide">Legal Review</span>
              </div>
              <div className="pl-5">
                <p className={`text-sm font-600 ${legalStatusColor}`}>{legalStatusLabel}</p>
                {hasCompletedReview && activeSignOffs[0] && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {activeSignOffs[0].signedByName} · {new Date(activeSignOffs[0].signedAt).toLocaleDateString()}
                  </p>
                )}
                {hasPendingReview && (
                  <p className="text-xs text-amber-600 mt-0.5">Awaiting legal officer sign-off</p>
                )}
                {!hasPendingReview && !hasCompletedReview && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Available once collateral is perfected
                  </p>
                )}
              </div>
            </div>

            {/* ── Complete Review Button ── */}
            {canCompleteReview ? (
              <button
                onClick={() => setShowSignOffModal(true)}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-600 hover:bg-emerald-700 active:scale-95 transition-all shadow-sm"
              >
                <ClipboardCheck size={15} />
                Complete Review
              </button>
            ) : hasCompletedReview ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-sm font-500 text-emerald-700">Review Completed</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-muted/40 border border-border rounded-lg cursor-not-allowed">
                <FileText size={14} className="text-muted-foreground" />
                <span className="text-sm font-500 text-muted-foreground">
                  {!user ? 'Sign in to review' : 'Perfection required'}
                </span>
              </div>
            )}

            {/* Hint text */}
            {canCompleteReview && (
              <p className="text-[10px] text-muted-foreground text-center leading-relaxed">
                Digitally sign off on this perfected collateral record. Action is audit-logged and legally binding.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Sign-Off Modal */}
      {showSignOffModal && user && (
        <SignOffModal
          collateral={collateral}
          userId={user.id}
          userName={userProfile?.full_name || user.email || 'Unknown Officer'}
          userRole={userRole || 'Legal Officer'}
          onClose={() => setShowSignOffModal(false)}
          onSigned={() => {
            loadSignOffs();
            toast.success('Legal review completed and sign-off recorded');
            onSignOffComplete?.();
          }}
        />
      )}
    </>
  );
}
