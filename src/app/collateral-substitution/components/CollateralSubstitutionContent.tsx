'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Plus, RefreshCw, History, X, Loader2, ChevronRight, LayoutGrid, Search } from 'lucide-react';
import {
  listSubstitutions,
  createSubstitution,
  updateSubstitutionStatus,
  getSubstitutionAuditTrail,
  getSubstitutionStats,
  type CollateralSubstitution,
  type SubstitutionStatus,
  type SubstitutionAuditEntry,
} from '@/lib/supabase/substitutionService';
import { useAuth } from '@/contexts/AuthContext';
import { workflowLookupsService, type CollateralOption, type LoanOption, type FacilityOption } from '@/lib/supabase/workflowLookupsService';
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';

const STATUS_CONFIG: Record<SubstitutionStatus, { text: string; bg: string; border: string }> = {
  Pending:      { text: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200' },
  'Under Review':{ text: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200' },
  Approved:     { text: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200' },
  Rejected:     { text: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200' },
  Completed:    { text: 'text-gray-700',  bg: 'bg-gray-100',  border: 'border-gray-200' },
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Action Dialog ─────────────────────────────────────────────────────────────

type SubActionType = 'review' | 'approve' | 'reject' | 'complete';

interface SubActionDialogProps {
  open: boolean;
  sub: CollateralSubstitution | null;
  action: SubActionType | null;
  onClose: () => void;
  onSubmit: (notes: string, effectiveDate: string) => Promise<void>;
  loading: boolean;
}

function SubstitutionActionDialog({ open, sub, action, onClose, onSubmit, loading }: SubActionDialogProps) {
  const [notes, setNotes] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

  useEffect(() => {
    if (open) { setNotes(''); setEffectiveDate(''); }
  }, [open]);

  if (!open || !sub || !action) return null;

  const config: Record<SubActionType, { title: string; buttonLabel: string; buttonStyle: string; requiresNotes: boolean }> = {
    review:   { title: 'Start Review',          buttonLabel: 'Start Review',    buttonStyle: 'bg-blue-600 hover:bg-blue-700 text-white',  requiresNotes: false },
    approve:  { title: 'Approve Substitution',  buttonLabel: 'Approve',         buttonStyle: 'bg-green-600 hover:bg-green-700 text-white', requiresNotes: false },
    reject:   { title: 'Reject Substitution',   buttonLabel: 'Reject',          buttonStyle: 'bg-red-600 hover:bg-red-700 text-white',    requiresNotes: true },
    complete: { title: 'Complete Substitution', buttonLabel: 'Mark Complete',   buttonStyle: 'text-white',                                requiresNotes: false },
  };

  const cfg = config[action];
  const canSubmit = !cfg.requiresNotes || notes.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{cfg.title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">{sub.facilityId} · {sub.outgoingDescription ?? sub.outgoingCollateralId ?? '—'}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Facility</span>
              <span className="font-medium text-gray-800">{sub.facilityId}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Outgoing</span>
              <span className="font-medium text-gray-800 truncate max-w-[180px]">{sub.outgoingDescription ?? '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Incoming</span>
              <span className="font-medium text-gray-800 truncate max-w-[180px]">{sub.incomingDescription ?? '—'}</span>
            </div>
          </div>
          {action === 'approve' && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Effective Date</label>
              <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              {action === 'reject' ? 'Rejection Reason' : 'Notes'} {cfg.requiresNotes && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder={action === 'reject' ? 'Provide reason for rejection…' : 'Add notes (optional)…'}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50">Cancel</button>
          <button
            onClick={() => onSubmit(notes, effectiveDate)}
            disabled={!canSubmit || loading}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${cfg.buttonStyle}`}
            style={action === 'complete' ? { backgroundColor: '#003c5a' } : {}}
          >
            {loading && <Loader2 size={14} className="animate-spin" />}
            {cfg.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel (used inside drawer) ────────────────────────────────────────

function SubstitutionDetailPanel({
  sub,
  onClose,
  onOpenAction,
  onViewAudit,
}: {
  sub: CollateralSubstitution;
  onClose: () => void;
  onOpenAction: (action: SubActionType) => void;
  onViewAudit: (id: string) => void;
}) {
  const sc = STATUS_CONFIG[sub.substitutionStatus] ?? STATUS_CONFIG['Pending'];
  const canReview = sub.substitutionStatus === 'Pending';
  const canApproveReject = sub.substitutionStatus === 'Under Review';
  const canComplete = sub.substitutionStatus === 'Approved';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                {sub.substitutionStatus}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900 truncate">{sub.facilityId}</h2>
            <p className="text-sm text-gray-500">{sub.requestedByName ?? '—'} · {formatDate(sub.requestedAt)}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Collateral swap */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Collateral Swap</h3>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-[10px] text-red-500 font-semibold uppercase tracking-wide mb-1">Outgoing</p>
              <p className="text-sm font-medium text-gray-900">{sub.outgoingDescription ?? '—'}</p>
              {sub.outgoingType && <p className="text-xs text-gray-500 mt-0.5">{sub.outgoingType}</p>}
            </div>
            <ArrowLeftRight size={18} className="text-gray-400 shrink-0" />
            <div className="flex-1 bg-green-50 border border-green-200 rounded-lg p-3">
              <p className="text-[10px] text-green-600 font-semibold uppercase tracking-wide mb-1">Incoming</p>
              <p className="text-sm font-medium text-gray-900">{sub.incomingDescription ?? '—'}</p>
              {sub.incomingType && <p className="text-xs text-gray-500 mt-0.5">{sub.incomingType}</p>}
            </div>
          </div>
        </div>

        {/* Details grid */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Request Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Facility ID', value: sub.facilityId },
              { label: 'Requested By', value: sub.requestedByName ?? '—' },
              { label: 'Requested At', value: formatDate(sub.requestedAt) },
              { label: 'Reviewed By', value: sub.reviewedBy ?? '—' },
              { label: 'Reviewed At', value: formatDate(sub.reviewedAt) },
              { label: 'Approved By', value: sub.approvedByName ?? '—' },
              { label: 'Effective Date', value: formatDate(sub.effectiveDate) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {sub.reason && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Reason</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">{sub.reason}</div>
          </div>
        )}

        {sub.notes && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</h3>
            <div className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-sm text-gray-700">{sub.notes}</div>
          </div>
        )}

        {sub.rejectionReason && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Rejection Reason</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">{sub.rejectionReason}</div>
          </div>
        )}

        <button
          onClick={() => onViewAudit(sub.id)}
          className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800 transition-colors"
        >
          <History size={13} /> View Audit Trail
        </button>
      </div>

      {/* Action Zone */}
      {(canReview || canApproveReject || canComplete) && (
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Take Action</h3>
          <div className="flex items-center gap-2">
            {canReview && (
              <button
                onClick={() => onOpenAction('review')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
              >
                Start Review
              </button>
            )}
            {canApproveReject && (
              <>
                <button
                  onClick={() => onOpenAction('reject')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  Reject
                </button>
                <button
                  onClick={() => onOpenAction('approve')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  Approve
                </button>
              </>
            )}
            {canComplete && (
              <button
                onClick={() => onOpenAction('complete')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#003c5a' }}
              >
                Mark Complete
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function CollateralSubstitutionContent() {
  const { userProfile } = useAuth();
  const searchParams = useSearchParams();
  const [substitutions, setSubstitutions] = useState<CollateralSubstitution[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, underReview: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<SubstitutionStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [selectedSub, setSelectedSub] = useState<CollateralSubstitution | null>(null);
  const [subDrawerOpen, setSubDrawerOpen] = useState(false);
  const [auditTrail, setAuditTrail] = useState<Record<string, SubstitutionAuditEntry[]>>({});
  const [showAuditId, setShowAuditId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const [collateralOptions, setCollateralOptions] = useState<CollateralOption[]>([]);
  const [loanOptions, setLoanOptions] = useState<LoanOption[]>([]);
  const [facilityOptions, setFacilityOptions] = useState<FacilityOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ facilityId: '', loanId: '', outgoingCollateralId: '', incomingCollateralId: '', reason: '', notes: '' });

  const [actionDialog, setActionDialog] = useState<{ open: boolean; sub: CollateralSubstitution | null; action: SubActionType | null }>({ open: false, sub: null, action: null });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        listSubstitutions(filterStatus !== 'All' ? { status: filterStatus } : undefined),
        getSubstitutionStats(),
      ]);
      setSubstitutions(data);
      setStats(s);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load substitutions');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const loadLookups = useCallback(async () => {
    if (collateralOptions.length > 0) return;
    setLookupsLoading(true);
    try {
      const [cols, loans] = await Promise.all([
        workflowLookupsService.getCollateralOptions(),
        workflowLookupsService.getLoanOptions(),
      ]);
      setCollateralOptions(cols);
      setLoanOptions(loans);
      setFacilityOptions(workflowLookupsService.deriveFacilityOptions(cols));
    } catch { /* silent */ } finally {
      setLookupsLoading(false);
    }
  }, [collateralOptions.length]);

  useEffect(() => {
    const facilityId = searchParams.get('facilityId');
    const loanId = searchParams.get('loanId');
    const collateralId = searchParams.get('collateralId');
    if (facilityId || loanId || collateralId) {
      setCreateForm((f) => ({ ...f, facilityId: facilityId ?? f.facilityId, loanId: loanId ?? f.loanId, outgoingCollateralId: collateralId ?? f.outgoingCollateralId }));
      setShowCreateModal(true);
      loadLookups();
    }
  }, [searchParams, loadLookups]);

  const loadAuditTrail = async (id: string) => {
    if (auditTrail[id]) { setShowAuditId(id); return; }
    try {
      const trail = await getSubstitutionAuditTrail(id);
      setAuditTrail((prev) => ({ ...prev, [id]: trail }));
      setShowAuditId(id);
    } catch { /* silent */ }
  };

  const handleCreate = async () => {
    if (!createForm.facilityId || !createForm.reason) return;
    setActionLoading(true);
    try {
      await createSubstitution({
        facilityId: createForm.facilityId,
        loanId: createForm.loanId || undefined,
        outgoingCollateralId: createForm.outgoingCollateralId || undefined,
        incomingCollateralId: createForm.incomingCollateralId || undefined,
        reason: createForm.reason,
        notes: createForm.notes,
        requestedBy: userProfile?.id,
      });
      setShowCreateModal(false);
      setCreateForm({ facilityId: '', loanId: '', outgoingCollateralId: '', incomingCollateralId: '', reason: '', notes: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAction = async (notes: string, effectiveDate: string) => {
    if (!actionDialog.sub || !actionDialog.action || !userProfile) return;
    const { sub, action } = actionDialog;
    const statusMap: Record<SubActionType, SubstitutionStatus> = {
      review: 'Under Review',
      approve: 'Approved',
      reject: 'Rejected',
      complete: 'Completed',
    };
    const newStatus = statusMap[action];
    setActionLoading(true);
    try {
      await updateSubstitutionStatus(
        sub.id,
        newStatus,
        userProfile.id,
        userProfile.full_name ?? userProfile.email ?? 'User',
        sub.substitutionStatus,
        notes,
        action === 'reject' ? notes : undefined,
        action === 'approve' ? effectiveDate : undefined,
        userProfile.role ?? undefined,
      );
      setActionDialog({ open: false, sub: null, action: null });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = (filterStatus === 'All' ? substitutions : substitutions.filter((s) => s.substitutionStatus === filterStatus))
    .filter((s) => {
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        s.facilityId.toLowerCase().includes(q) ||
        (s.outgoingDescription ?? '').toLowerCase().includes(q) ||
        (s.incomingDescription ?? '').toLowerCase().includes(q) ||
        (s.requestedByName ?? '').toLowerCase().includes(q)
      );
    });

  const facilitySelectOptions: SelectOption[] = facilityOptions.map((f) => ({
    value: f.facilityId,
    label: f.facilityId,
    sublabel: collateralOptions.filter((c) => c.facilityId === f.facilityId).map((c) => c.description).slice(0, 2).join(', '),
  }));

  const loanSelectOptions: SelectOption[] = loanOptions.map((l) => ({
    value: l.id,
    label: l.loanNumber,
    sublabel: `${l.obligorName} · ${l.facilityType}`,
    badge: l.loanStatus,
  }));

  const collateralSelectOptions: SelectOption[] = collateralOptions.map((c) => ({
    value: c.id,
    label: c.collateralId,
    sublabel: `${c.description} · ${c.type}`,
    badge: c.facilityId,
  }));

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <ArrowLeftRight size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href="/workflows" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <LayoutGrid size={11} /> Workflows
                </Link>
                <ChevronRight size={11} className="text-gray-300" />
                <span className="text-xs text-gray-600 font-medium">Collateral Substitution</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">Collateral Substitution</h1>
              <p className="text-xs text-gray-500">Swap collateral against active facilities with approval chain and audit trail</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={() => { setShowCreateModal(true); loadLookups(); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#003c5a' }}
            >
              <Plus size={16} /> New Substitution
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { key: 'All' as const,          label: 'Total',       value: stats.total,       color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
            { key: 'Pending' as const,      label: 'Pending',     value: stats.pending,     color: 'text-amber-600',  bg: 'bg-amber-50',  border: 'border-amber-200' },
            { key: 'Under Review' as const, label: 'Under Review',value: stats.underReview, color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { key: 'Approved' as const,     label: 'Approved',    value: stats.approved,    color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
            { key: 'Rejected' as const,     label: 'Rejected',    value: stats.rejected,    color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
          ].map(({ key, label, value, color, bg, border }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`flex flex-col gap-1 p-3 rounded-xl border transition-all text-left ${bg} ${border} ${filterStatus === key ? 'ring-2 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}
            >
              <span className={`text-lg font-bold ${color}`}>{value}</span>
              <span className={`text-xs font-medium ${color}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mx-6 mt-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700 shrink-0">{error}</div>
      )}

      {/* Body — full-width list */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col w-full bg-white min-h-0">
          {/* Search + filter */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by facility, collateral, requester…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['All', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => setFilterStatus(s)}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
                    filterStatus === s ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                  }`}
                  style={filterStatus === s ? { backgroundColor: '#003c5a' } : {}}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <Loader2 size={28} className="animate-spin text-blue-500" />
                <p className="text-sm text-gray-500">Loading substitutions…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <ArrowLeftRight size={32} className="text-gray-300" />
                <p className="text-sm text-gray-500">No substitution requests found</p>
              </div>
            ) : (
              filtered.map((sub) => {
                const sc = STATUS_CONFIG[sub.substitutionStatus] ?? STATUS_CONFIG['Pending'];
                const isSelected = selectedSub?.id === sub.id && subDrawerOpen;
                const canReview = sub.substitutionStatus === 'Pending';
                const canApproveReject = sub.substitutionStatus === 'Under Review';
                const canComplete = sub.substitutionStatus === 'Approved';

                return (
                  <div
                    key={sub.id}
                    onClick={() => { setSelectedSub(sub); setSubDrawerOpen(true); }}
                    className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{sub.facilityId}</p>
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                        {sub.substitutionStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 mb-1">
                      <span className="truncate max-w-[120px] text-red-600">{sub.outgoingDescription ?? '—'}</span>
                      <ArrowLeftRight size={11} className="text-gray-400 shrink-0" />
                      <span className="truncate max-w-[120px] text-green-600">{sub.incomingDescription ?? '—'}</span>
                    </div>
                    <p className="text-xs text-gray-400 line-clamp-1 mb-2">{sub.reason}</p>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>{sub.requestedByName ?? '—'}</span>
                      <span className="ml-auto">{formatDate(sub.requestedAt)}</span>
                    </div>
                    {(canReview || canApproveReject || canComplete) && (
                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        {canReview && (
                          <button
                            onClick={() => { setSelectedSub(sub); setActionDialog({ open: true, sub, action: 'review' }); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors"
                          >
                            Review
                          </button>
                        )}
                        {canApproveReject && (
                          <>
                            <button
                              onClick={() => { setSelectedSub(sub); setActionDialog({ open: true, sub, action: 'approve' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setSelectedSub(sub); setActionDialog({ open: true, sub, action: 'reject' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {canComplete && (
                          <button
                            onClick={() => { setSelectedSub(sub); setActionDialog({ open: true, sub, action: 'complete' }); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-gray-700 bg-gray-100 border border-gray-200 rounded-lg hover:bg-gray-200 transition-colors"
                          >
                            Complete
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Substitution Drawer */}
      <WorkflowDrawer
        open={subDrawerOpen}
        onClose={() => { setSubDrawerOpen(false); setTimeout(() => setSelectedSub(null), 300); }}
        width="w-[520px]"
        overdueHours={
          selectedSub &&
          (selectedSub.substitutionStatus === 'Pending' || selectedSub.substitutionStatus === 'Under Review')
            ? Math.max(0, (Date.now() - new Date(selectedSub.requestedAt).getTime()) / (1000 * 60 * 60))
            : undefined
        }
      >
        {selectedSub && (
          <SubstitutionDetailPanel
            sub={selectedSub}
            onClose={() => { setSubDrawerOpen(false); setTimeout(() => setSelectedSub(null), 300); }}
            onOpenAction={(action) => setActionDialog({ open: true, sub: selectedSub, action })}
            onViewAudit={loadAuditTrail}
          />
        )}
      </WorkflowDrawer>

      {/* Audit Trail Modal */}
      {showAuditId && (
        <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Substitution Audit Trail</h2>
              <button onClick={() => setShowAuditId(null)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {(auditTrail[showAuditId] ?? []).length === 0 ? (
                <p className="text-gray-400 text-sm text-center">No audit entries yet</p>
              ) : (
                <div className="space-y-3">
                  {(auditTrail[showAuditId] ?? []).map((entry) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="w-2 h-2 rounded-full bg-blue-400 mt-1.5 shrink-0" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{entry.action}</div>
                        <div className="text-xs text-gray-500">{entry.performedByName} · {formatDate(entry.createdAt)}</div>
                        {entry.notes && <div className="text-xs text-gray-600 mt-0.5">{entry.notes}</div>}
                        {entry.oldStatus && entry.newStatus && (
                          <div className="text-xs text-gray-400 mt-0.5">{entry.oldStatus} → {entry.newStatus}</div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">New Substitution Request</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <SearchableSelect label="Facility *" required options={facilitySelectOptions} value={createForm.facilityId} onChange={(v) => setCreateForm((f) => ({ ...f, facilityId: v }))} placeholder="Select facility…" loading={lookupsLoading} />
                <SearchableSelect label="Loan" options={loanSelectOptions} value={createForm.loanId} onChange={(v) => setCreateForm((f) => ({ ...f, loanId: v }))} placeholder="Select loan…" loading={lookupsLoading} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <SearchableSelect label="Outgoing Collateral" options={collateralSelectOptions} value={createForm.outgoingCollateralId} onChange={(v) => setCreateForm((f) => ({ ...f, outgoingCollateralId: v }))} placeholder="Select collateral…" loading={lookupsLoading} />
                <SearchableSelect label="Incoming Collateral" options={collateralSelectOptions} value={createForm.incomingCollateralId} onChange={(v) => setCreateForm((f) => ({ ...f, incomingCollateralId: v }))} placeholder="Select collateral…" loading={lookupsLoading} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <textarea value={createForm.reason} onChange={(e) => setCreateForm((f) => ({ ...f, reason: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={actionLoading || !createForm.facilityId || !createForm.reason}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#003c5a' }}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                {actionLoading ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Dialog */}
      <SubstitutionActionDialog
        open={actionDialog.open}
        sub={actionDialog.sub}
        action={actionDialog.action}
        onClose={() => setActionDialog({ open: false, sub: null, action: null })}
        onSubmit={handleAction}
        loading={actionLoading}
      />
    </div>
  );
}
