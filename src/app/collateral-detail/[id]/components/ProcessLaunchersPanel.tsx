'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Workflow,
  Unlock,
  FolderOpen,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  Send,
  CalendarClock,
  Scale,
  ArrowLeftRight,
  Shield,
} from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { perfectionService } from '@/lib/supabase/perfectionService';
import { archiveRequestService } from '@/lib/supabase/archiveService';
import { createValuation } from '@/lib/supabase/valuationService';
import { createCovenant, type CovenantType } from '@/lib/supabase/covenantService';
import { createSubstitution } from '@/lib/supabase/substitutionService';
import { createInsurancePolicy } from '@/lib/supabase/insuranceService';
import { workflowLookupsService, type LoanOption } from '@/lib/supabase/workflowLookupsService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';



// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessLaunchersProps {
  collateral: CollateralRecord;
  onProcessStarted?: () => void;
}

type ProcessType = 'perfection' | 'release' | 'record-request' | null;
type WorkflowDialogType = 'valuation' | 'covenant' | 'substitution' | 'policy' | null;

// ─── Confirm Modal (existing processes) ──────────────────────────────────────

interface ConfirmModalProps {
  processType: ProcessType;
  collateral: CollateralRecord;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
}

function ConfirmModal({ processType, collateral, onConfirm, onClose, submitting }: ConfirmModalProps) {
  const [notes, setNotes] = useState('');

  const config = {
    perfection: {
      title: 'Start Perfection Process',
      icon: Workflow,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
      description: `Submit ${collateral.collateralId} to the Perfection Workflow for review and registry registration at ${collateral.registry}.`,
      notesLabel: 'Submission notes (optional)',
      confirmLabel: 'Submit for Perfection',
    },
    release: {
      title: 'Initiate Release Process',
      icon: Unlock,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      btnBg: 'bg-amber-600 hover:bg-amber-700',
      description: `Initiate a release/discharge process for ${collateral.collateralId}. This will route to the Batch Release module for approval.`,
      notesLabel: 'Release reason / notes',
      confirmLabel: 'Initiate Release',
    },
    'record-request': {
      title: 'Raise Record Request',
      icon: FolderOpen,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      btnBg: 'bg-purple-600 hover:bg-purple-700',
      description: `Request physical file retrieval for ${collateral.collateralId} from the archive vault.`,
      notesLabel: 'Purpose / reason for retrieval',
      confirmLabel: 'Raise Request',
    },
  };

  if (!processType) return null;
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
            <h2 className="text-base font-700 text-foreground">{cfg.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Collateral ID</span>
              <span className="text-xs font-700 font-mono text-foreground">{collateral.collateralId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Obligor</span>
              <span className="text-xs font-500 text-foreground">{collateral.obligor}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-xs font-500 text-foreground">{collateral.type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Registry</span>
              <span className="text-xs font-500 text-foreground">{collateral.registry}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{cfg.description}</p>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">{cfg.notesLabel}</label>
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
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm()}
            disabled={submitting}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${cfg.btnBg}`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Processing…' : cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Schedule Valuation Dialog ────────────────────────────────────────────────

const VALUATION_TYPES = ['Full Valuation', 'Desk Review', 'Drive-By Inspection', 'Insurance Valuation', 'Forced Sale Valuation'];
const VALUATION_METHODS = ['Market Value', 'Income Approach', 'Cost Approach', 'Forced Sale Value', 'Replacement Cost'];

interface ValuationDialogProps {
  collateral: CollateralRecord;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function ValuationDialog({ collateral, userId, onClose, onSuccess }: ValuationDialogProps) {
  const [form, setForm] = useState({
    valuationType: 'Full Valuation',
    scheduledDate: '',
    valuerName: '',
    valuerFirm: '',
    valuationMethod: 'Market Value',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.scheduledDate) { toast.error('Please select a scheduled date'); return; }
    setSubmitting(true);
    try {
      await createValuation({
        collateralId: collateral.id,
        valuationType: form.valuationType,
        scheduledDate: form.scheduledDate,
        valuerName: form.valuerName || undefined,
        valuerFirm: form.valuerFirm || undefined,
        valuationMethod: form.valuationMethod,
        notes: form.notes || undefined,
        createdBy: userId,
      });
      toast.success('Valuation scheduled successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to schedule valuation');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center">
              <CalendarClock size={18} className="text-indigo-600" />
            </div>
            <h2 className="text-base font-700 text-foreground">Schedule Valuation</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          {/* Collateral summary */}
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Collateral ID</span>
              <span className="text-xs font-700 font-mono text-foreground">{collateral.collateralId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Obligor</span>
              <span className="text-xs font-500 text-foreground">{collateral.obligor}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-xs font-500 text-foreground">{collateral.type}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Valuation Type <span className="text-red-500">*</span></label>
              <select
                value={form.valuationType}
                onChange={(e) => setForm({ ...form, valuationType: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {VALUATION_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Valuation Method</label>
              <select
                value={form.valuationMethod}
                onChange={(e) => setForm({ ...form, valuationMethod: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {VALUATION_METHODS.map((m) => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Scheduled Date <span className="text-red-500">*</span></label>
            <input
              type="date"
              value={form.scheduledDate}
              onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Valuer Name</label>
              <input
                type="text"
                value={form.valuerName}
                onChange={(e) => setForm({ ...form, valuerName: e.target.value })}
                placeholder="e.g. John Doe"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Valuer Firm</label>
              <input
                type="text"
                value={form.valuerFirm}
                onChange={(e) => setForm({ ...form, valuerFirm: e.target.value })}
                placeholder="e.g. ABC Valuers Ltd"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Add any instructions or context…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Scheduling…' : 'Schedule Valuation'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Covenant Dialog ──────────────────────────────────────────────────────

const COVENANT_TYPES: CovenantType[] = ['Financial Ratio', 'Insurance Requirement', 'Reporting Obligation', 'Operational', 'Legal', 'Other'];

interface CovenantDialogProps {
  collateral: CollateralRecord;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function CovenantDialog({ collateral, userId, onClose, onSuccess }: CovenantDialogProps) {
  const [loanOptions, setLoanOptions] = useState<LoanOption[]>([]);
  const [form, setForm] = useState({
    loanId: '',
    covenantName: '',
    covenantType: 'Financial Ratio' as CovenantType,
    description: '',
    thresholdValue: '',
    thresholdUnit: '',
    nextReviewDate: '',
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    workflowLookupsService.getLoanOptions().then(setLoanOptions).catch(() => {});
  }, []);

  const handleSubmit = async () => {
    if (!form.covenantName.trim()) { toast.error('Covenant name is required'); return; }
    if (!form.loanId) { toast.error('Please select a loan'); return; }
    setSubmitting(true);
    try {
      await createCovenant({
        loanId: form.loanId,
        facilityId: collateral.facilityId || undefined,
        covenantName: form.covenantName.trim(),
        covenantType: form.covenantType,
        description: form.description || undefined,
        thresholdValue: form.thresholdValue ? parseFloat(form.thresholdValue) : undefined,
        thresholdUnit: form.thresholdUnit || undefined,
        nextReviewDate: form.nextReviewDate || undefined,
        autoFlag: true,
        createdBy: userId,
      });
      toast.success('Covenant added successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to add covenant');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-teal-100 flex items-center justify-center">
              <Scale size={18} className="text-teal-600" />
            </div>
            <h2 className="text-base font-700 text-foreground">Add Covenant</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Collateral ID</span>
              <span className="text-xs font-700 font-mono text-foreground">{collateral.collateralId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Facility</span>
              <span className="text-xs font-500 text-foreground">{collateral.facilityId || '—'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Loan <span className="text-red-500">*</span></label>
            <select
              value={form.loanId}
              onChange={(e) => setForm({ ...form, loanId: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="">Select loan…</option>
              {loanOptions.map((l) => (
                <option key={l.id} value={l.id}>{l.loanNumber}{l.obligorName ? ` — ${l.obligorName}` : ''}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Covenant Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.covenantName}
              onChange={(e) => setForm({ ...form, covenantName: e.target.value })}
              placeholder="e.g. Minimum DSCR Ratio"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Covenant Type</label>
            <select
              value={form.covenantType}
              onChange={(e) => setForm({ ...form, covenantType: e.target.value as CovenantType })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {COVENANT_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Threshold Value</label>
              <input
                type="number"
                value={form.thresholdValue}
                onChange={(e) => setForm({ ...form, thresholdValue: e.target.value })}
                placeholder="e.g. 1.25"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Unit</label>
              <input
                type="text"
                value={form.thresholdUnit}
                onChange={(e) => setForm({ ...form, thresholdUnit: e.target.value })}
                placeholder="e.g. ratio, %, TZS"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Next Review Date</label>
            <input
              type="date"
              value={form.nextReviewDate}
              onChange={(e) => setForm({ ...form, nextReviewDate: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Description (optional)</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={2}
              placeholder="Describe the covenant requirement…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Adding…' : 'Add Covenant'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── New Substitution Dialog ──────────────────────────────────────────────────

interface SubstitutionDialogProps {
  collateral: CollateralRecord;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function SubstitutionDialog({ collateral, userId, onClose, onSuccess }: SubstitutionDialogProps) {
  const [form, setForm] = useState({
    incomingCollateralId: '',
    reason: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.reason.trim()) { toast.error('Reason is required'); return; }
    setSubmitting(true);
    try {
      await createSubstitution({
        facilityId: collateral.facilityId,
        outgoingCollateralId: collateral.id,
        incomingCollateralId: form.incomingCollateralId || undefined,
        reason: form.reason.trim(),
        notes: form.notes || undefined,
        requestedBy: userId,
      });
      toast.success('Substitution request submitted successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to submit substitution');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-orange-100 flex items-center justify-center">
              <ArrowLeftRight size={18} className="text-orange-600" />
            </div>
            <h2 className="text-base font-700 text-foreground">New Substitution</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Outgoing Collateral</span>
              <span className="text-xs font-700 font-mono text-foreground">{collateral.collateralId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Obligor</span>
              <span className="text-xs font-500 text-foreground">{collateral.obligor}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Facility</span>
              <span className="text-xs font-500 text-foreground">{collateral.facilityId || '—'}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Incoming Collateral ID (optional)</label>
            <input
              type="text"
              value={form.incomingCollateralId}
              onChange={(e) => setForm({ ...form, incomingCollateralId: e.target.value })}
              placeholder="Enter incoming collateral ID if known…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <p className="text-[10px] text-muted-foreground mt-1">Leave blank to specify later in the Substitution module</p>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Reason <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              placeholder="e.g. Collateral value deterioration"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Add additional context or instructions…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-white bg-orange-600 hover:bg-orange-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Add Policy Dialog ────────────────────────────────────────────────────────

const COVERAGE_TYPES = [
  'Comprehensive Fire & Perils', 'Motor Vehicle Comprehensive', 'Marine Cargo',
  'Public Liability', 'Professional Indemnity', 'All Risks', 'Life Insurance', 'Other',
];

interface PolicyDialogProps {
  collateral: CollateralRecord;
  userId: string;
  onClose: () => void;
  onSuccess: () => void;
}

function PolicyDialog({ collateral, userId, onClose, onSuccess }: PolicyDialogProps) {
  const [form, setForm] = useState({
    policyNumber: '',
    insurerName: '',
    coverageType: 'Comprehensive Fire & Perils',
    coverageAmount: '',
    currency: 'TZS',
    premiumAmount: '',
    premiumFrequency: 'Annual',
    policyStartDate: '',
    policyEndDate: '',
    renewalDate: '',
    beneficiary: '',
    notes: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!form.policyNumber.trim()) { toast.error('Policy number is required'); return; }
    if (!form.insurerName.trim()) { toast.error('Insurer name is required'); return; }
    if (!form.coverageAmount || isNaN(parseFloat(form.coverageAmount))) { toast.error('Valid coverage amount is required'); return; }
    if (!form.policyStartDate || !form.policyEndDate) { toast.error('Policy start and end dates are required'); return; }
    setSubmitting(true);
    try {
      await createInsurancePolicy({
        collateralId: collateral.id,
        policyNumber: form.policyNumber.trim(),
        insurerName: form.insurerName.trim(),
        coverageType: form.coverageType,
        coverageAmount: parseFloat(form.coverageAmount),
        currency: form.currency,
        premiumAmount: form.premiumAmount ? parseFloat(form.premiumAmount) : undefined,
        premiumFrequency: form.premiumFrequency,
        policyStartDate: form.policyStartDate,
        policyEndDate: form.policyEndDate,
        renewalDate: form.renewalDate || undefined,
        beneficiary: form.beneficiary || undefined,
        notes: form.notes || undefined,
        createdBy: userId,
      });
      toast.success('Insurance policy added successfully');
      onSuccess();
      onClose();
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to add policy');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-green-100 flex items-center justify-center">
              <Shield size={18} className="text-green-600" />
            </div>
            <h2 className="text-base font-700 text-foreground">Add Insurance Policy</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4 overflow-y-auto">
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Collateral ID</span>
              <span className="text-xs font-700 font-mono text-foreground">{collateral.collateralId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Obligor</span>
              <span className="text-xs font-500 text-foreground">{collateral.obligor}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Policy Number <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.policyNumber}
                onChange={(e) => setForm({ ...form, policyNumber: e.target.value })}
                placeholder="e.g. POL-2024-001"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Insurer Name <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={form.insurerName}
                onChange={(e) => setForm({ ...form, insurerName: e.target.value })}
                placeholder="e.g. Jubilee Insurance"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Coverage Type</label>
            <select
              value={form.coverageType}
              onChange={(e) => setForm({ ...form, coverageType: e.target.value })}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {COVERAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Coverage Amount <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={form.coverageAmount}
                onChange={(e) => setForm({ ...form, coverageAmount: e.target.value })}
                placeholder="0"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={(e) => setForm({ ...form, currency: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option>TZS</option>
                <option>USD</option>
                <option>EUR</option>
                <option>GBP</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Premium Amount</label>
              <input
                type="number"
                value={form.premiumAmount}
                onChange={(e) => setForm({ ...form, premiumAmount: e.target.value })}
                placeholder="0"
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Premium Frequency</label>
              <select
                value={form.premiumFrequency}
                onChange={(e) => setForm({ ...form, premiumFrequency: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option>Annual</option>
                <option>Semi-Annual</option>
                <option>Quarterly</option>
                <option>Monthly</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">Start Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.policyStartDate}
                onChange={(e) => setForm({ ...form, policyStartDate: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1.5">End Date <span className="text-red-500">*</span></label>
              <input
                type="date"
                value={form.policyEndDate}
                onChange={(e) => setForm({ ...form, policyEndDate: e.target.value })}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Beneficiary</label>
            <input
              type="text"
              value={form.beneficiary}
              onChange={(e) => setForm({ ...form, beneficiary: e.target.value })}
              placeholder="e.g. Bank Name"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Notes (optional)</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              placeholder="Additional notes…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors">Cancel</button>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Adding…' : 'Add Policy'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProcessLaunchersPanel({ collateral, onProcessStarted }: ProcessLaunchersProps) {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [activeModal, setActiveModal] = useState<ProcessType>(null);
  const [activeWorkflowDialog, setActiveWorkflowDialog] = useState<WorkflowDialogType>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!activeModal || !user) return;
    setSubmitting(true);

    try {
      if (activeModal === 'perfection') {
        await perfectionService.create(
          {
            collateralRecordId: collateral.id,
            collateralId: collateral.collateralId,
            obligor: collateral.obligor,
            collateralType: collateral.type,
            registry: collateral.registry,
            perfectionDeadline: collateral.perfectionDeadline ?? '',
            priority: 'Normal',
          },
          user.id,
          userProfile?.full_name ?? user.email ?? 'Unknown'
        );
        toast.success('Perfection request submitted — redirecting to workflow');
        setActiveModal(null);
        onProcessStarted?.();
        router.push('/perfection-workflow');
      } else if (activeModal === 'release') {
        toast.success('Redirecting to Release module');
        setActiveModal(null);
        router.push(`/batch-release?collateral=${encodeURIComponent(collateral.collateralId)}`);
      } else if (activeModal === 'record-request') {
        await archiveRequestService.create({
          collateralId: collateral.id,
          requestedBy: user.id,
          purpose: 'Record retrieval from collateral profile',
          expectedReturnDate: undefined,
        });
        toast.success('Record request raised — check Archive › Request Workflow');
        setActiveModal(null);
        onProcessStarted?.();
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to start process. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Determine process availability
  const canPerfect =
    collateral.requiresPerfection &&
    !['Perfected', 'Released'].includes(collateral.status);

  const canRelease = ['Perfected', 'Monitoring'].includes(collateral.status);

  const processes = [
    {
      key: 'perfection' as ProcessType,
      label: 'Start Perfection',
      sublabel: canPerfect ? `Submit to ${collateral.registry}` : 'Not applicable',
      icon: Workflow,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      hoverBg: 'hover:bg-blue-50/80',
      available: canPerfect,
      statusIcon: canPerfect
        ? <Clock size={11} className="text-amber-500" />
        : <CheckCircle2 size={11} className="text-green-500" />,
      statusText: canPerfect ? 'Pending' : collateral.status,
      onClick: () => setActiveModal('perfection'),
    },
    {
      key: 'release' as ProcessType,
      label: 'Initiate Release',
      sublabel: canRelease ? 'Discharge & release collateral' : 'Requires Perfected status',
      icon: Unlock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-200',
      hoverBg: 'hover:bg-amber-50/80',
      available: canRelease,
      statusIcon: canRelease
        ? <AlertTriangle size={11} className="text-amber-500" />
        : <Clock size={11} className="text-muted-foreground" />,
      statusText: canRelease ? 'Ready' : 'Locked',
      onClick: () => setActiveModal('release'),
    },
    {
      key: 'record-request' as ProcessType,
      label: 'Record Request',
      sublabel: 'Request physical file from archive',
      icon: FolderOpen,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      hoverBg: 'hover:bg-purple-50/80',
      available: true,
      statusIcon: <CheckCircle2 size={11} className="text-green-500" />,
      statusText: 'Available',
      onClick: () => setActiveModal('record-request'),
    },
  ];

  // Workflow launchers — now open dialogs instead of navigating
  const workflowLaunchers = [
    {
      label: 'Schedule Valuation',
      icon: CalendarClock,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderColor: 'border-indigo-200',
      hoverBg: 'hover:bg-indigo-50/80',
      dialogKey: 'valuation' as WorkflowDialogType,
    },
    {
      label: 'Add Covenant',
      icon: Scale,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      borderColor: 'border-teal-200',
      hoverBg: 'hover:bg-teal-50/80',
      dialogKey: 'covenant' as WorkflowDialogType,
    },
    {
      label: 'New Substitution',
      icon: ArrowLeftRight,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      hoverBg: 'hover:bg-orange-50/80',
      dialogKey: 'substitution' as WorkflowDialogType,
    },
    {
      label: 'Add Policy',
      icon: Shield,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      hoverBg: 'hover:bg-green-50/80',
      dialogKey: 'policy' as WorkflowDialogType,
    },
  ];

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Workflow size={14} className="text-primary" />
          </div>
          <h3 className="text-xs font-700 text-foreground uppercase tracking-wider">Processes</h3>
        </div>

        <div className="p-4 space-y-2.5">
          {processes.map((proc) => {
            const ProcIcon = proc.icon;
            return (
              <button
                key={proc.key}
                onClick={() => proc.available && proc.onClick()}
                disabled={!proc.available}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                  proc.available
                    ? `${proc.borderColor} ${proc.hoverBg} cursor-pointer`
                    : 'border-border bg-muted/20 cursor-not-allowed opacity-60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg ${proc.available ? proc.iconBg : 'bg-muted'} flex items-center justify-center shrink-0`}
                >
                  <ProcIcon size={15} className={proc.available ? proc.iconColor : 'text-muted-foreground'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">{proc.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{proc.sublabel}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {proc.statusIcon}
                  <span className="text-[10px] font-500 text-muted-foreground">{proc.statusText}</span>
                  {proc.available && <ChevronRight size={12} className="text-muted-foreground ml-0.5" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Workflow Launchers Section */}
        <div className="border-t border-border">
          <div className="px-5 py-3 bg-gray-50/60">
            <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider">Initiate Workflows</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {workflowLaunchers.map((wf) => {
              const WfIcon = wf.icon;
              return (
                <button
                  key={wf.label}
                  onClick={() => setActiveWorkflowDialog(wf.dialogKey)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${wf.borderColor} ${wf.hoverBg}`}
                >
                  <div className={`w-7 h-7 rounded-md ${wf.iconBg} flex items-center justify-center shrink-0`}>
                    <WfIcon size={13} className={wf.iconColor} />
                  </div>
                  <span className="text-xs font-600 text-foreground leading-tight">{wf.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm Modal (existing processes) */}
      {activeModal && (
        <ConfirmModal
          processType={activeModal}
          collateral={collateral}
          onConfirm={handleConfirm}
          onClose={() => setActiveModal(null)}
          submitting={submitting}
        />
      )}

      {/* Workflow Dialogs */}
      {activeWorkflowDialog === 'valuation' && user && (
        <ValuationDialog
          collateral={collateral}
          userId={user.id}
          onClose={() => setActiveWorkflowDialog(null)}
          onSuccess={() => onProcessStarted?.()}
        />
      )}
      {activeWorkflowDialog === 'covenant' && user && (
        <CovenantDialog
          collateral={collateral}
          userId={user.id}
          onClose={() => setActiveWorkflowDialog(null)}
          onSuccess={() => onProcessStarted?.()}
        />
      )}
      {activeWorkflowDialog === 'substitution' && user && (
        <SubstitutionDialog
          collateral={collateral}
          userId={user.id}
          onClose={() => setActiveWorkflowDialog(null)}
          onSuccess={() => onProcessStarted?.()}
        />
      )}
      {activeWorkflowDialog === 'policy' && user && (
        <PolicyDialog
          collateral={collateral}
          userId={user.id}
          onClose={() => setActiveWorkflowDialog(null)}
          onSuccess={() => onProcessStarted?.()}
        />
      )}
    </>
  );
}
