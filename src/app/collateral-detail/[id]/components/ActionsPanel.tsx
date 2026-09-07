'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Calendar, AlertTriangle, Clock, CheckCircle2, PenLine, RefreshCw, X, Stamp, AlertCircle, BadgeCheck, ShieldCheck, ClipboardCheck, Workflow, Unlock, FolderOpen, Send, CalendarClock, ArrowLeftRight, Loader2, ChevronDown, ChevronUp,  } from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { legalSignOffService, LegalSignOff } from '@/lib/supabase/legalSignOffService';
import { auditLogService } from '@/lib/supabase/auditLogService';
import { perfectionService } from '@/lib/supabase/perfectionService';
import { archiveRequestService } from '@/lib/supabase/archiveService';
import { createValuation } from '@/lib/supabase/valuationService';
import { type CovenantType } from '@/lib/supabase/covenantService';
import { createSubstitution } from '@/lib/supabase/substitutionService';

import { type LoanOption } from '@/lib/supabase/workflowLookupsService';
import { workflowInstanceService, workflowTemplateService } from '@/lib/supabase/workflowEngineService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

// ─── Workflow engine helper ───────────────────────────────────────────────────

async function startWorkflowEngineInstance(
  workflowType: 'valuation' | 'substitution' | 'perfection' | 'release',
  collateral: CollateralRecord,
  userId: string,
  referenceLabel: string
): Promise<void> {
  try {
    const templates = await workflowTemplateService.getAll();
    const template = templates.find(
      (t) => t.workflowType === workflowType && t.isActive && t.isVisible !== false
    );
    if (!template) return;
    await workflowInstanceService.start({
      templateId: template.id,
      referenceType: workflowType,
      referenceId: collateral.id,
      referenceLabel,
      startedBy: userId,
      metadata: {
        collateralId: collateral.collateralId,
        obligor: collateral.obligor,
        collateralType: collateral.type,
      },
    });
  } catch {
    // non-blocking
  }
}

// ─── Sign-Off Modal ───────────────────────────────────────────────────────────

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
              <span className="text-xs text-muted-foreground">Value</span>
              <span className="text-xs font-mono font-semibold text-foreground">TSh {collateral.valueTSh}</span>
            </div>
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
              I, <strong className="text-foreground">{userName}</strong>, confirm that I have reviewed this collateral record and hereby digitally sign off on its perfection status.
            </p>
          </label>
          {error && (
            <div className="flex items-center gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
              <AlertCircle size={14} /> {error}
            </div>
          )}
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
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

// ─── Confirm Modal (Perfection / Release / Record Request) ────────────────────

type ProcessType = 'perfection' | 'release' | 'record-request' | null;

interface ConfirmModalProps {
  processType: ProcessType;
  collateral: CollateralRecord;
  onConfirm: (notes: string) => void;
  onClose: () => void;
  submitting: boolean;
}

function ConfirmModal({ processType, collateral, onConfirm, onClose, submitting }: ConfirmModalProps) {
  const [notes, setNotes] = useState('');
  if (!processType) return null;

  const config = {
    perfection: {
      title: 'Start Perfection Process',
      icon: Workflow, iconBg: 'bg-blue-100', iconColor: 'text-blue-600', btnBg: 'bg-blue-600 hover:bg-blue-700',
      description: `Submit ${collateral.collateralId} to the Perfection Workflow for review and registry registration at ${collateral.registry}.`,
      notesLabel: 'Submission notes (optional)', confirmLabel: 'Submit for Perfection',
    },
    release: {
      title: 'Initiate Release Process',
      icon: Unlock, iconBg: 'bg-amber-100', iconColor: 'text-amber-600', btnBg: 'bg-amber-600 hover:bg-amber-700',
      description: `Initiate a release/discharge process for ${collateral.collateralId}.`,
      notesLabel: 'Release reason / notes', confirmLabel: 'Initiate Release',
    },
    'record-request': {
      title: 'Raise Record Request',
      icon: FolderOpen, iconBg: 'bg-purple-100', iconColor: 'text-purple-600', btnBg: 'bg-purple-600 hover:bg-purple-700',
      description: `Request physical file retrieval for ${collateral.collateralId} from the archive vault.`,
      notesLabel: 'Purpose / reason for retrieval', confirmLabel: 'Raise Request',
    },
  };

  const cfg = config[processType];
  const CfgIcon = cfg.icon;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
              <CfgIcon size={18} className={cfg.iconColor} />
            </div>
            <h2 className="text-base font-semibold text-foreground">{cfg.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Collateral ID</span>
              <span className="text-xs font-semibold font-mono text-foreground">{collateral.collateralId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Obligor</span>
              <span className="text-xs text-foreground">{collateral.obligor}</span>
            </div>
          </div>
          <p className="text-sm text-muted-foreground leading-relaxed">{cfg.description}</p>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">{cfg.notesLabel}</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context or instructions…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button
            onClick={() => onConfirm(notes)}
            disabled={submitting}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${cfg.btnBg}`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Processing…' : cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Valuation Dialog ─────────────────────────────────────────────────────────

const VALUATION_TYPES = ['Full Valuation', 'Desk Review', 'Drive-By Inspection', 'Insurance Valuation', 'Forced Sale Valuation'];
const VALUATION_METHODS = ['Market Value', 'Income Approach', 'Cost Approach', 'Forced Sale Value', 'Replacement Cost'];

function ValuationDialog({ collateral, userId, onClose, onSuccess }: { collateral: CollateralRecord; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ valuationType: 'Full Valuation', scheduledDate: '', valuerName: '', valuerFirm: '', valuationMethod: 'Market Value', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.scheduledDate) { toast.error('Please select a scheduled date'); return; }
    setSubmitting(true);
    try {
      await createValuation({ collateralId: collateral.id, valuationType: form.valuationType, scheduledDate: form.scheduledDate, valuerName: form.valuerName || undefined, valuerFirm: form.valuerFirm || undefined, valuationMethod: form.valuationMethod, notes: form.notes || undefined, createdBy: userId });
      await startWorkflowEngineInstance('valuation', collateral, userId, `${form.valuationType} — ${collateral.collateralId}`);
      toast.success('Valuation scheduled successfully');
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to schedule valuation');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center"><CalendarClock size={18} className="text-indigo-600" /></div>
            <h2 className="text-base font-semibold text-foreground">Schedule Valuation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors"><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Valuation Type <span className="text-red-500">*</span></label>
              <select value={form.valuationType} onChange={(e) => setForm({ ...form, valuationType: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                {VALUATION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Method</label>
              <select value={form.valuationMethod} onChange={(e) => setForm({ ...form, valuationMethod: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30">
                {VALUATION_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Scheduled Date <span className="text-red-500">*</span></label>
            <input type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Valuer Name</label>
              <input type="text" value={form.valuerName} onChange={(e) => setForm({ ...form, valuerName: e.target.value })} placeholder="e.g. John Doe" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">Valuer Firm</label>
              <input type="text" value={form.valuerFirm} onChange={(e) => setForm({ ...form, valuerFirm: e.target.value })} placeholder="e.g. ABC Valuers Ltd" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Add any instructions…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Scheduling…' : 'Schedule Valuation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Substitution Dialog ──────────────────────────────────────────────────────

function SubstitutionDialog({ collateral, userId, onClose, onSuccess }: { collateral: CollateralRecord; userId: string; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ incomingCollateralId: '', reason: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.reason.trim()) { toast.error('Reason is required'); return; }
    setSubmitting(true);
    try {
      await createSubstitution({ facilityId: collateral.facilityId, outgoingCollateralId: collateral.id, incomingCollateralId: form.incomingCollateralId || undefined, reason: form.reason.trim(), notes: form.notes || undefined, requestedBy: userId });
      await startWorkflowEngineInstance('substitution', collateral, userId, `Substitution — ${collateral.collateralId}`);
      toast.success('Substitution request submitted successfully');
      onSuccess(); onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit substitution');
    } finally { setSubmitting(false); }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center"><ArrowLeftRight size={18} className="text-orange-600" /></div>
            <h2 className="text-base font-semibold text-foreground">New Substitution</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors"><X size={16} className="text-muted-foreground" /></button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Incoming Collateral ID (optional)</label>
            <input type="text" value={form.incomingCollateralId} onChange={(e) => setForm({ ...form, incomingCollateralId: e.target.value })} placeholder="e.g. COL-2024-0099" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Reason <span className="text-red-500">*</span></label>
            <textarea value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} rows={3} placeholder="Reason for substitution…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Notes (optional)</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Additional notes…" className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
          </div>
        </div>
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm font-medium text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ActionsPanel ────────────────────────────────────────────────────────

interface ActionsPanelProps {
  collateral: CollateralRecord;
  onActionComplete?: () => void;
}

export default function ActionsPanel({ collateral, onActionComplete }: ActionsPanelProps) {
  const { user, userProfile, userRole } = useAuth();
  const [signOffs, setSignOffs] = useState<LegalSignOff[]>([]);
  const [loadingSignOffs, setLoadingSignOffs] = useState(true);
  const [showSignOffModal, setShowSignOffModal] = useState(false);
  const [activeProcess, setActiveProcess] = useState<ProcessType>(null);
  const [activeWorkflow, setActiveWorkflow] = useState<'valuation' | 'substitution' | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [workflowsExpanded, setWorkflowsExpanded] = useState(true);
  const [lifecycleExpanded, setLifecycleExpanded] = useState(true);

  const loadSignOffs = useCallback(async () => {
    setLoadingSignOffs(true);
    try {
      const data = await legalSignOffService.getByCollateral(collateral.id);
      setSignOffs(data);
    } catch { /* silent */ }
    finally { setLoadingSignOffs(false); }
  }, [collateral.id]);

  useEffect(() => { loadSignOffs(); }, [loadSignOffs]);

  // ── Deadline info ──
  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;
  const hasRegistry = collateral.registry && collateral.registry !== 'N/A';

  const deadlineLabel = collateral.daysToDeadline === null ? 'No deadline set'
    : isOverdue ? `${Math.abs(collateral.daysToDeadline)}d overdue`
    : collateral.daysToDeadline === 0 ? 'Due today'
    : `${collateral.daysToDeadline}d remaining`;

  const deadlineColor = isOverdue ? 'text-red-600' : isApproaching ? 'text-amber-600' : 'text-emerald-600';
  const deadlineBg = isOverdue ? 'bg-red-50 border-red-200' : isApproaching ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200';
  const deadlineIcon = isOverdue ? <AlertTriangle size={14} className="text-red-500 shrink-0" />
    : isApproaching ? <Clock size={14} className="text-amber-500 shrink-0" />
    : <Calendar size={14} className="text-emerald-500 shrink-0" />;

  // ── Legal review ──
  const activeSignOffs = signOffs.filter((s) => s.status === 'signed');
  const hasCompletedReview = activeSignOffs.length > 0;
  const canCompleteReview = !!user && collateral.status === 'Perfected' && !hasCompletedReview;

  const legalStatusLabel = loadingSignOffs ? 'Loading…'
    : hasCompletedReview ? `Signed off (${activeSignOffs.length})`
    : collateral.status === 'Perfected' ? 'Pending sign-off' :'Not yet perfected';

  const legalStatusColor = hasCompletedReview ? 'text-emerald-600' : collateral.status === 'Perfected' ? 'text-amber-600' : 'text-muted-foreground';
  const legalStatusBg = hasCompletedReview ? 'bg-emerald-50 border-emerald-200' : collateral.status === 'Perfected' ? 'bg-amber-50 border-amber-200' : 'bg-muted/40 border-border';

  // ── Workflow gates ──
  const s = collateral.status;
  const canPerfect = s !== 'Perfected' && s !== 'Submitted' && s !== 'Under Review';
  const canRelease = s === 'Perfected' || s === 'Monitoring';
  const canValuate = s !== 'Released' && s !== 'Rejected';
  const canSubstitute = s !== 'Released' && s !== 'Rejected';

  // ── Process handlers ──
  const handleConfirmProcess = async (notes: string) => {
    if (!activeProcess || !user) return;
    setSubmitting(true);
    try {
      if (activeProcess === 'perfection') {
        await perfectionService.create({ collateralRecordId: collateral.id, collateralId: collateral.collateralId, submittedBy: user.id, submittedByName: userProfile?.full_name || user.email || '', notes: notes || undefined });
        await startWorkflowEngineInstance('perfection', collateral, user.id, `Perfection — ${collateral.collateralId}`);
        toast.success('Perfection process started');
      } else if (activeProcess === 'release') {
        await startWorkflowEngineInstance('release', collateral, user.id, `Release — ${collateral.collateralId}`);
        toast.success('Release process initiated');
      } else if (activeProcess === 'record-request') {
        await archiveRequestService.create({ collateralRecordId: collateral.id, collateralId: collateral.collateralId, requestedBy: user.id, requestedByName: userProfile?.full_name || user.email || '', purpose: notes || 'Record retrieval', notes: notes || undefined });
        toast.success('Record request raised');
      }
      setActiveProcess(null);
      onActionComplete?.();
    } catch (err: any) {
      toast.error(err?.message ?? 'Action failed. Please try again.');
    } finally { setSubmitting(false); }
  };

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        {/* Panel header */}
        <div className="flex items-center gap-2 px-4 py-3 bg-gradient-to-r from-primary/5 to-primary/10 border-b border-border">
          <div className="w-6 h-6 rounded-md bg-primary/15 flex items-center justify-center">
            <Zap size={13} className="text-primary" />
          </div>
          <h3 className="text-xs font-bold text-foreground uppercase tracking-wider">Actions</h3>
        </div>

        <div className="p-4 space-y-4">
          {/* ── Section: Deadline & Legal Review ── */}
          <div className="space-y-2">
            <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider px-0.5">Status</p>

            {/* Deadline */}
            <div className={`rounded-lg border p-3 ${hasRegistry ? deadlineBg : 'bg-muted/30 border-border'}`}>
              <div className="flex items-center gap-2 mb-1">
                {hasRegistry ? deadlineIcon : <Calendar size={14} className="text-muted-foreground shrink-0" />}
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                  {hasRegistry ? `${collateral.registry} Deadline` : 'Registry Deadline'}
                </span>
              </div>
              <div className="pl-5">
                {collateral.perfectionDeadline ? (
                  <>
                    <p className="text-sm font-semibold text-foreground">{collateral.perfectionDeadline}</p>
                    <p className={`text-xs font-medium mt-0.5 ${hasRegistry ? deadlineColor : 'text-muted-foreground'}`}>{deadlineLabel}</p>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">No deadline configured</p>
                )}
              </div>
            </div>

            {/* Legal Review */}
            <div className={`rounded-lg border p-3 ${legalStatusBg}`}>
              <div className="flex items-center gap-2 mb-1">
                {hasCompletedReview ? <BadgeCheck size={14} className="text-emerald-500 shrink-0" />
                  : collateral.status === 'Perfected' ? <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                  : <ShieldCheck size={14} className="text-muted-foreground shrink-0" />}
                <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Legal Review</span>
              </div>
              <div className="pl-5">
                <p className={`text-sm font-semibold ${legalStatusColor}`}>{legalStatusLabel}</p>
                {hasCompletedReview && activeSignOffs[0] && (
                  <p className="text-xs text-muted-foreground mt-0.5">{activeSignOffs[0].signedByName} · {new Date(activeSignOffs[0].signedAt).toLocaleDateString()}</p>
                )}
              </div>
            </div>

            {/* Complete Review Button */}
            {canCompleteReview ? (
              <button onClick={() => setShowSignOffModal(true)} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 active:scale-95 transition-all shadow-sm">
                <ClipboardCheck size={15} /> Complete Review
              </button>
            ) : hasCompletedReview ? (
              <div className="flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                <CheckCircle2 size={14} className="text-emerald-600" />
                <span className="text-sm font-medium text-emerald-700">Review Completed</span>
              </div>
            ) : null}
          </div>

          {/* ── Section: Workflow Launchers ── */}
          <div>
            <button
              onClick={() => setWorkflowsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-0.5 mb-2"
            >
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Workflows</p>
              {workflowsExpanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
            </button>
            {workflowsExpanded && (
              <div className="space-y-1.5">
                {/* Start Perfection */}
                <button
                  onClick={() => canPerfect ? setActiveProcess('perfection') : undefined}
                  disabled={!canPerfect}
                  title={!canPerfect ? (s === 'Perfected' ? 'Already perfected' : 'Perfection already in progress') : 'Start Perfection Process'}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${canPerfect ? 'bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200' : 'bg-muted/40 text-muted-foreground border border-border cursor-not-allowed opacity-60'}`}
                >
                  <Workflow size={14} className="shrink-0" />
                  <span>Start Perfection</span>
                </button>

                {/* Schedule Valuation */}
                <button
                  onClick={() => canValuate ? setActiveWorkflow('valuation') : undefined}
                  disabled={!canValuate}
                  title={!canValuate ? 'Not available for this status' : 'Schedule Valuation'}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${canValuate ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200' : 'bg-muted/40 text-muted-foreground border border-border cursor-not-allowed opacity-60'}`}
                >
                  <CalendarClock size={14} className="shrink-0" />
                  <span>Schedule Valuation</span>
                </button>

                {/* New Substitution */}
                <button
                  onClick={() => canSubstitute ? setActiveWorkflow('substitution') : undefined}
                  disabled={!canSubstitute}
                  title={!canSubstitute ? 'Not available for this status' : 'New Substitution'}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${canSubstitute ? 'bg-orange-50 hover:bg-orange-100 text-orange-700 border border-orange-200' : 'bg-muted/40 text-muted-foreground border border-border cursor-not-allowed opacity-60'}`}
                >
                  <ArrowLeftRight size={14} className="shrink-0" />
                  <span>New Substitution</span>
                </button>
              </div>
            )}
          </div>

          {/* ── Section: Lifecycle Actions ── */}
          <div>
            <button
              onClick={() => setLifecycleExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-0.5 mb-2"
            >
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Lifecycle</p>
              {lifecycleExpanded ? <ChevronUp size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
            </button>
            {lifecycleExpanded && (
              <div className="space-y-1.5">
                {/* Initiate Release */}
                <button
                  onClick={() => canRelease ? setActiveProcess('release') : undefined}
                  disabled={!canRelease}
                  title={!canRelease ? `Must be Perfected or Monitoring (current: ${s})` : 'Initiate Release'}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${canRelease ? 'bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200' : 'bg-muted/40 text-muted-foreground border border-border cursor-not-allowed opacity-60'}`}
                >
                  <Unlock size={14} className="shrink-0" />
                  <span>Initiate Release</span>
                </button>

                {/* Raise Record Request */}
                <button
                  onClick={() => setActiveProcess('record-request')}
                  className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 transition-colors text-left"
                >
                  <FolderOpen size={14} className="shrink-0" />
                  <span>Raise Record Request</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
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
            onActionComplete?.();
          }}
        />
      )}

      {activeProcess && (
        <ConfirmModal
          processType={activeProcess}
          collateral={collateral}
          onConfirm={handleConfirmProcess}
          onClose={() => setActiveProcess(null)}
          submitting={submitting}
        />
      )}

      {activeWorkflow === 'valuation' && user && (
        <ValuationDialog
          collateral={collateral}
          userId={user.id}
          onClose={() => setActiveWorkflow(null)}
          onSuccess={() => { setActiveWorkflow(null); onActionComplete?.(); }}
        />
      )}

      {activeWorkflow === 'substitution' && user && (
        <SubstitutionDialog
          collateral={collateral}
          userId={user.id}
          onClose={() => setActiveWorkflow(null)}
          onSuccess={() => { setActiveWorkflow(null); onActionComplete?.(); }}
        />
      )}
    </>
  );
}
