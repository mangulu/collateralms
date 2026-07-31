'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, Plus, RefreshCw, Eye, X, Loader2, ChevronRight, LayoutGrid } from 'lucide-react';
import {
  listValuations,
  createValuation,
  recordValuationResult,
  approveValuation,
  rejectValuation,
  getValuationStats,
  type CollateralValuation,
  type ValuationStatus,
} from '@/lib/supabase/valuationService';
import { useAuth } from '@/contexts/AuthContext';
import { triggerOverdueActionSms } from '@/lib/supabase/smsNotificationRulesService';
import { workflowLookupsService, type CollateralOption } from '@/lib/supabase/workflowLookupsService';
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import Icon from '@/components/ui/AppIcon';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';


const STATUS_COLORS: Record<ValuationStatus, { text: string; bg: string; border: string }> = {
  Scheduled:    { text: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  'In Progress':{ text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  Completed:    { text: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  Approved:     { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  Rejected:     { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  Overdue:      { text: 'text-red-800',    bg: 'bg-red-100',   border: 'border-red-300' },
};

const VALUATION_TYPES = ['Full Valuation', 'Desk Review', 'Drive-By Inspection', 'Insurance Valuation', 'Forced Sale Valuation'];
const VALUATION_METHODS = ['Market Value', 'Income Approach', 'Cost Approach', 'Forced Sale Value', 'Replacement Cost'];

function formatCurrency(val: number | null): string {
  if (val == null) return '—';
  return 'TZS ' + val.toLocaleString();
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function agingDays(scheduledDate: string): number {
  return Math.ceil((new Date().getTime() - new Date(scheduledDate).getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Action Dialog ─────────────────────────────────────────────────────────────

type ValuationActionType = 'record' | 'approve' | 'reject';

interface ValuationActionDialogProps {
  open: boolean;
  valuation: CollateralValuation | null;
  action: ValuationActionType | null;
  onClose: () => void;
  onRecord: (form: { completedDate: string; valuationAmount: string; reportReference: string; notes: string }) => Promise<void>;
  onApprove: (v: CollateralValuation) => Promise<void>;
  onReject: (reason: string) => Promise<void>;
  loading: boolean;
}

function ValuationActionDialog({ open, valuation, action, onClose, onRecord, onApprove, onReject, loading }: ValuationActionDialogProps) {
  const [recordForm, setRecordForm] = useState({ completedDate: new Date().toISOString().split('T')[0], valuationAmount: '', reportReference: '', notes: '' });
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    if (open) {
      setRecordForm({ completedDate: new Date().toISOString().split('T')[0], valuationAmount: '', reportReference: '', notes: '' });
      setRejectReason('');
    }
  }, [open]);

  if (!open || !valuation || !action) return null;

  const titles: Record<ValuationActionType, string> = {
    record: 'Record Valuation Result',
    approve: 'Approve Valuation',
    reject: 'Reject Valuation',
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h3 className="text-base font-semibold text-gray-900">{titles[action]}</h3>
            <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{valuation.collateralDescription ?? valuation.collateralId}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {action === 'record' && (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Completed Date *</label>
                  <input
                    type="date"
                    value={recordForm.completedDate}
                    onChange={(e) => setRecordForm((f) => ({ ...f, completedDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Amount (TZS) *</label>
                  <input
                    type="number"
                    value={recordForm.valuationAmount}
                    onChange={(e) => setRecordForm((f) => ({ ...f, valuationAmount: e.target.value }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Report Reference</label>
                <input
                  type="text"
                  value={recordForm.reportReference}
                  onChange={(e) => setRecordForm((f) => ({ ...f, reportReference: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={recordForm.notes}
                  onChange={(e) => setRecordForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => onRecord(recordForm)}
                disabled={loading || !recordForm.valuationAmount}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#003c5a' }}
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Saving…' : 'Save Result'}
              </button>
            </div>
          </>
        )}

        {action === 'approve' && (
          <>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">Collateral</span>
                  <span className="font-medium text-gray-800">{valuation.collateralDescription ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valuation Amount</span>
                  <span className="font-medium text-gray-800">{formatCurrency(valuation.valuationAmount)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Valuer</span>
                  <span className="font-medium text-gray-800">{valuation.valuerName ?? '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Report Ref</span>
                  <span className="font-medium text-gray-800">{valuation.reportReference ?? '—'}</span>
                </div>
              </div>
              <p className="text-sm text-gray-600">Approve this valuation result. It will be recorded in the collateral registry.</p>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => onApprove(valuation)}
                disabled={loading}
                className="px-4 py-2 text-sm text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Approving…' : 'Approve Valuation'}
              </button>
            </div>
          </>
        )}

        {action === 'reject' && (
          <>
            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-600">Reject this valuation result. Please provide a clear reason.</p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  rows={3}
                  placeholder="Provide reason for rejection…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
                />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={() => onReject(rejectReason)}
                disabled={loading || !rejectReason.trim()}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2"
              >
                {loading && <Loader2 size={14} className="animate-spin" />}
                {loading ? 'Rejecting…' : 'Reject Valuation'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Detail Panel ─────────────────────────────────────────────────────────────

function ValuationDetailPanel({
  valuation,
  onClose,
  onOpenAction,
}: {
  valuation: CollateralValuation;
  onClose: () => void;
  onOpenAction: (action: ValuationActionType) => void;
}) {
  const sc = STATUS_COLORS[valuation.valuationStatus] ?? STATUS_COLORS['Scheduled'];
  const isOverdue = valuation.valuationStatus === 'Overdue';
  const canRecord = ['Scheduled', 'Overdue', 'In Progress'].includes(valuation.valuationStatus);
  const canApproveReject = valuation.valuationStatus === 'Completed';

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${sc.bg} ${sc.text} ${sc.border}`}>
                {valuation.valuationStatus}
              </span>
              {isOverdue && (
                <span className="flex items-center gap-1 text-xs font-medium text-red-600">
                  <AlertTriangle size={11} /> {agingDays(valuation.scheduledDate)}d overdue
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900 truncate">{valuation.collateralDescription ?? '—'}</h2>
            <p className="text-sm text-gray-500">{valuation.collateralType} · {valuation.valuationType}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Valuation Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Scheduled Date', value: formatDate(valuation.scheduledDate) },
              { label: 'Valuation Method', value: valuation.valuationMethod },
              { label: 'Valuer Name', value: valuation.valuerName ?? '—' },
              { label: 'Valuer Firm', value: valuation.valuerFirm ?? '—' },
              { label: 'Completed Date', value: formatDate(valuation.completedDate) },
              { label: 'Report Reference', value: valuation.reportReference ?? '—' },
              { label: 'Valuation Amount', value: formatCurrency(valuation.valuationAmount) },
              { label: 'Approved At', value: formatDate(valuation.approvedAt) },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {valuation.notes && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">{valuation.notes}</div>
          </div>
        )}

        {valuation.rejectionReason && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Rejection Reason</h3>
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">{valuation.rejectionReason}</div>
          </div>
        )}
      </div>

      {/* Action Zone */}
      {(canRecord || canApproveReject) && (
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Take Action</h3>
          <div className="flex items-center gap-2">
            {canRecord && (
              <button
                onClick={() => onOpenAction('record')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#7c3aed' }}
              >
                Record Result
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
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function ValuationWorkflowContent() {
  const { userProfile } = useAuth();
  const searchParams = useSearchParams();
  const [valuations, setValuations] = useState<CollateralValuation[]>([]);
  const [stats, setStats] = useState({ total: 0, scheduled: 0, overdue: 0, pendingApproval: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ValuationStatus | 'All'>('All');
  const [search, setSearch] = useState('');
  const [selectedValuation, setSelectedValuation] = useState<CollateralValuation | null>(null);
  const [valuationDrawerOpen, setValuationDrawerOpen] = useState(false);

  // Lookup data
  const [collateralOptions, setCollateralOptions] = useState<CollateralOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [actionDialog, setActionDialog] = useState<{ open: boolean; valuation: CollateralValuation | null; action: ValuationActionType | null }>({ open: false, valuation: null, action: null });
  const [actionLoading, setActionLoading] = useState(false);

  // Schedule form
  const [scheduleForm, setScheduleForm] = useState({
    collateralId: '',
    valuationType: 'Full Valuation',
    scheduledDate: '',
    valuerName: '',
    valuerFirm: '',
    valuationMethod: 'Market Value',
    notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        listValuations(filterStatus !== 'All' ? { status: filterStatus } : undefined),
        getValuationStats(),
      ]);
      setValuations(data);
      setStats(s);
      const overdueItems = data.filter((v) => v.valuationStatus === 'Overdue');
      overdueItems.forEach((v) => {
        triggerOverdueActionSms({
          actionType: 'Valuation',
          collateralId: v.collateralId,
          collateralDescription: v.collateralDescription,
          scheduledDate: v.scheduledDate,
          daysOverdue: agingDays(v.scheduledDate),
        });
      });
    } catch (e: any) {
      setError(e.message ?? 'Failed to load valuations');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const loadLookups = useCallback(async () => {
    if (collateralOptions.length > 0) return;
    setLookupsLoading(true);
    try {
      const cols = await workflowLookupsService.getCollateralOptions();
      setCollateralOptions(cols);
    } catch { /* silent */ } finally {
      setLookupsLoading(false);
    }
  }, [collateralOptions.length]);

  useEffect(() => {
    const collateralId = searchParams.get('collateralId');
    if (collateralId) {
      setScheduleForm((f) => ({ ...f, collateralId }));
      setShowScheduleModal(true);
      loadLookups();
    }
  }, [searchParams, loadLookups]);

  const openScheduleModal = () => {
    setShowScheduleModal(true);
    loadLookups();
  };

  const handleSchedule = async () => {
    if (!scheduleForm.collateralId || !scheduleForm.scheduledDate) return;
    setActionLoading(true);
    try {
      await createValuation({ ...scheduleForm, createdBy: userProfile?.id });
      setShowScheduleModal(false);
      setScheduleForm({ collateralId: '', valuationType: 'Full Valuation', scheduledDate: '', valuerName: '', valuerFirm: '', valuationMethod: 'Market Value', notes: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecord = async (form: { completedDate: string; valuationAmount: string; reportReference: string; notes: string }) => {
    if (!actionDialog.valuation || !form.valuationAmount) return;
    setActionLoading(true);
    try {
      await recordValuationResult(actionDialog.valuation.id, {
        completedDate: form.completedDate,
        valuationAmount: parseFloat(form.valuationAmount),
        reportReference: form.reportReference,
        notes: form.notes,
      });
      setActionDialog({ open: false, valuation: null, action: null });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleApprove = async (v: CollateralValuation) => {
    if (!userProfile?.id) return;
    setActionLoading(true);
    try {
      await approveValuation(v.id, userProfile.id);
      setActionDialog({ open: false, valuation: null, action: null });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async (reason: string) => {
    if (!actionDialog.valuation || !reason) return;
    setActionLoading(true);
    try {
      await rejectValuation(actionDialog.valuation.id, reason);
      setActionDialog({ open: false, valuation: null, action: null });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const collateralSelectOptions: SelectOption[] = collateralOptions.map((c) => ({
    value: c.id,
    label: c.collateralId,
    sublabel: `${c.description} · ${c.type}`,
    badge: c.facilityId,
  }));

  const filtered = (filterStatus === 'All' ? valuations : valuations.filter((v) => v.valuationStatus === filterStatus))
    .filter((v) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      return (
        (v.collateralDescription ?? '').toLowerCase().includes(s) ||
        v.collateralId.toLowerCase().includes(s) ||
        v.valuationType.toLowerCase().includes(s) ||
        (v.valuerName ?? '').toLowerCase().includes(s)
      );
    });

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center shrink-0">
              <CalendarClock size={18} className="text-white" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href="/workflows" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <LayoutGrid size={11} /> Workflows
                </Link>
                <ChevronRight size={11} className="text-gray-300" />
                <span className="text-xs text-gray-600 font-medium">Valuation Workflow</span>
              </div>
              <h1 className="text-lg font-bold text-gray-900">Valuation Workflow</h1>
              <p className="text-xs text-gray-500">Schedule, record, and approve collateral revaluations</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
              <RefreshCw size={16} />
            </button>
            <button
              onClick={openScheduleModal}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
              style={{ backgroundColor: '#003c5a' }}
            >
              <Plus size={16} /> Schedule Valuation
            </button>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          {[
            { key: 'All' as const,       label: 'Total',           value: stats.total,           icon: CalendarClock, color: 'text-gray-600',   bg: 'bg-gray-50',   border: 'border-gray-200' },
            { key: 'Scheduled' as const, label: 'Scheduled',       value: stats.scheduled,       icon: Clock,         color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
            { key: 'Overdue' as const,   label: 'Overdue',         value: stats.overdue,         icon: AlertTriangle, color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
            { key: 'Completed' as const, label: 'Pending Approval',value: stats.pendingApproval, icon: Eye,           color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
            { key: 'Approved' as const,  label: 'Approved',        value: stats.approved,        icon: CheckCircle2,  color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200' },
          ].map(({ key, label, value, icon: Icon, color, bg, border }) => (
            <button
              key={key}
              onClick={() => setFilterStatus(key)}
              className={`flex flex-col gap-1 p-3 rounded-xl border transition-all text-left ${bg} ${border} ${filterStatus === key ? 'ring-2 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}
            >
              <div className="flex items-center justify-between">
                <Icon size={15} className={color} />
                <span className={`text-lg font-bold ${color}`}>{value}</span>
              </div>
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
        {/* List Panel */}
        <div className="flex flex-col w-full bg-white min-h-0">
          {/* Search + filter */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-2">
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by collateral, type, valuer…"
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
              />
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {(['All', 'Scheduled', 'Overdue', 'In Progress', 'Completed', 'Approved', 'Rejected'] as const).map((s) => (
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
                <p className="text-sm text-gray-500">Loading valuations…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3">
                <CalendarClock size={32} className="text-gray-300" />
                <p className="text-sm text-gray-500">No valuations found</p>
              </div>
            ) : (
              filtered.map((v) => {
                const sc = STATUS_COLORS[v.valuationStatus] ?? STATUS_COLORS['Scheduled'];
                const isSelected = selectedValuation?.id === v.id && valuationDrawerOpen;
                const isOverdue = v.valuationStatus === 'Overdue';
                const canRecord = ['Scheduled', 'Overdue', 'In Progress'].includes(v.valuationStatus);
                const canApproveReject = v.valuationStatus === 'Completed';

                return (
                  <div
                    key={v.id}
                    onClick={() => { setSelectedValuation(v); setValuationDrawerOpen(true); }}
                    className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : isOverdue ? 'bg-red-50/40 hover:bg-red-50/60' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-semibold text-gray-900 truncate">{v.collateralDescription ?? '—'}</p>
                      <span className={`inline-flex items-center text-xs font-semibold px-2 py-0.5 rounded-full border shrink-0 ${sc.bg} ${sc.text} ${sc.border}`}>
                        {v.valuationStatus}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-2">
                      <span>{v.valuationType}</span>
                      <span className="text-gray-300">·</span>
                      <span>{v.collateralType}</span>
                      {v.valuerName && <><span className="text-gray-300">·</span><span>{v.valuerName}</span></>}
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400">
                      <span>Scheduled: {formatDate(v.scheduledDate)}</span>
                      {v.valuationAmount != null && <span className="ml-auto font-medium text-gray-700">{formatCurrency(v.valuationAmount)}</span>}
                      {isOverdue && <span className="flex items-center gap-1 text-red-600 font-medium"><AlertTriangle size={11} />{agingDays(v.scheduledDate)}d overdue</span>}
                    </div>
                    {/* Quick action buttons */}
                    {(canRecord || canApproveReject) && (
                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        {canRecord && (
                          <button
                            onClick={() => { setSelectedValuation(v); setActionDialog({ open: true, valuation: v, action: 'record' }); }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                          >
                            Record
                          </button>
                        )}
                        {canApproveReject && (
                          <>
                            <button
                              onClick={() => { setSelectedValuation(v); setActionDialog({ open: true, valuation: v, action: 'approve' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setSelectedValuation(v); setActionDialog({ open: true, valuation: v, action: 'reject' }); }}
                              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                            >
                              Reject
                            </button>
                          </>
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

      {/* Valuation Drawer */}
      <WorkflowDrawer open={valuationDrawerOpen} onClose={() => { setValuationDrawerOpen(false); setTimeout(() => setSelectedValuation(null), 300); }} width="w-[520px]">
        {selectedValuation && (
          <ValuationDetailPanel
            valuation={selectedValuation}
            onClose={() => { setValuationDrawerOpen(false); setTimeout(() => setSelectedValuation(null), 300); }}
            onOpenAction={(action) => setActionDialog({ open: true, valuation: selectedValuation, action })}
          />
        )}
      </WorkflowDrawer>

      {/* Schedule Modal */}
      {showScheduleModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Schedule Valuation</h2>
            </div>
            <div className="p-6 space-y-4">
              <SearchableSelect
                label="Collateral *"
                required
                options={collateralSelectOptions}
                value={scheduleForm.collateralId}
                onChange={(v) => setScheduleForm((f) => ({ ...f, collateralId: v }))}
                placeholder="Select collateral…"
                loading={lookupsLoading}
              />
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Type</label>
                  <select value={scheduleForm.valuationType} onChange={(e) => setScheduleForm((f) => ({ ...f, valuationType: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {VALUATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                  <input type="date" value={scheduleForm.scheduledDate} onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuer Name</label>
                  <input type="text" value={scheduleForm.valuerName} onChange={(e) => setScheduleForm((f) => ({ ...f, valuerName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuer Firm</label>
                  <input type="text" value={scheduleForm.valuerFirm} onChange={(e) => setScheduleForm((f) => ({ ...f, valuerFirm: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Method</label>
                <select value={scheduleForm.valuationMethod} onChange={(e) => setScheduleForm((f) => ({ ...f, valuationMethod: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {VALUATION_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={scheduleForm.notes} onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSchedule}
                disabled={actionLoading || !scheduleForm.collateralId || !scheduleForm.scheduledDate}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 flex items-center gap-2"
                style={{ backgroundColor: '#003c5a' }}
              >
                {actionLoading && <Loader2 size={14} className="animate-spin" />}
                {actionLoading ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Dialog */}
      <ValuationActionDialog
        open={actionDialog.open}
        valuation={actionDialog.valuation}
        action={actionDialog.action}
        onClose={() => setActionDialog({ open: false, valuation: null, action: null })}
        onRecord={handleRecord}
        onApprove={handleApprove}
        onReject={handleReject}
        loading={actionLoading}
      />
    </div>
  );
}
