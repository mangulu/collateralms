'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, RotateCcw, Clock, Eye, Search, Filter, ChevronDown, ChevronRight, MessageSquare, AlertCircle, Loader2, Building2, Calendar, User, Tag, RefreshCw, CheckSquare, X, Send } from 'lucide-react';
import { perfectionService, PerfectionRequest, PerfectionRequestStatus } from '@/lib/supabase/perfectionService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType = 'approve' | 'reject' | 'request_modification';

interface ActionModalState {
  open: boolean;
  request: PerfectionRequest | null;
  action: ActionType | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<PerfectionRequestStatus, { label: string; textColor: string; bgColor: string; borderColor: string }> = {
  Draft:         { label: 'Draft',        textColor: 'text-gray-600',   bgColor: 'bg-gray-100',   borderColor: 'border-gray-200' },
  Submitted:     { label: 'Submitted',    textColor: 'text-blue-700',   bgColor: 'bg-blue-50',    borderColor: 'border-blue-200' },
  'Under Review':{ label: 'Under Review', textColor: 'text-amber-700',  bgColor: 'bg-amber-50',   borderColor: 'border-amber-200' },
  Approved:      { label: 'Approved',     textColor: 'text-green-700',  bgColor: 'bg-green-50',   borderColor: 'border-green-200' },
  Perfected:     { label: 'Perfected',    textColor: 'text-emerald-700',bgColor: 'bg-emerald-50', borderColor: 'border-emerald-200' },
  Rejected:      { label: 'Rejected',     textColor: 'text-red-700',    bgColor: 'bg-red-50',     borderColor: 'border-red-200' },
  Returned:      { label: 'Returned',     textColor: 'text-orange-700', bgColor: 'bg-orange-50',  borderColor: 'border-orange-200' },
};

const PRIORITY_CONFIG: Record<string, { textColor: string; bgColor: string; dot: string }> = {
  High:   { textColor: 'text-red-700',   bgColor: 'bg-red-50 border border-red-200',   dot: 'bg-red-500' },
  Normal: { textColor: 'text-gray-600',  bgColor: 'bg-gray-50 border border-gray-200', dot: 'bg-gray-400' },
  Low:    { textColor: 'text-blue-600',  bgColor: 'bg-blue-50 border border-blue-200', dot: 'bg-blue-400' },
};

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function daysUntil(iso: string): number | null {
  if (!iso) return null;
  const diff = new Date(iso).getTime() - Date.now();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ─── Collateral Detail Panel ──────────────────────────────────────────────────

function CollateralDetailPanel({ collateralId }: { collateralId: string }) {
  const [record, setRecord] = useState<CollateralRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    collateralService.getAll().then((all) => {
      if (cancelled) return;
      const found = all.find(
        (c) => c.collateralId === collateralId || c.id === collateralId
      ) ?? null;
      setRecord(found);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [collateralId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-gray-500">
        <Loader2 size={14} className="animate-spin" />
        Loading collateral details…
      </div>
    );
  }

  if (!record) {
    return (
      <div className="py-4 text-sm text-gray-400 italic">
        Collateral record not found for ID: {collateralId}
      </div>
    );
  }

  const rows: { label: string; value: string | number | null | undefined }[] = [
    { label: 'Collateral ID',   value: record.collateralId },
    { label: 'Type',            value: record.type },
    { label: 'Obligor',         value: record.obligor },
    { label: 'Obligor ID',      value: record.obligorId },
    { label: 'Facility ID',     value: record.facilityId },
    { label: 'Value (TSh)',     value: record.valueTSh },
    { label: 'Registry',        value: record.registry },
    { label: 'Status',          value: record.status },
    { label: 'Reg. Date',       value: formatDate(record.registrationDate) },
    { label: 'Perfection Deadline', value: formatDate(record.perfectionDeadline) },
    { label: 'Assigned Officer',value: record.assignedOfficer || '—' },
    { label: 'LTV Ratio',       value: record.ltvRatio != null ? `${(record.ltvRatio * 100).toFixed(1)}%` : '—' },
    { label: 'Valuation (TSh)', value: record.valuationAmount != null ? record.valuationAmount.toLocaleString() : '—' },
    { label: 'Available Equity',value: record.availableEquity != null ? record.availableEquity.toLocaleString() : '—' },
  ];

  return (
    <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {rows.map(({ label, value }) => (
        <div key={label} className="flex flex-col">
          <span className="text-xs text-gray-500 font-medium uppercase tracking-wide">{label}</span>
          <span className="text-gray-800 font-medium mt-0.5">{value ?? '—'}</span>
        </div>
      ))}
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

  if (!state.open || !state.request || !state.action) return null;

  const config = {
    approve: {
      title: 'Approve Request',
      description: 'Approve this perfection request. The collateral will be marked as Approved/Perfected.',
      placeholder: 'Add approval notes (optional)…',
      buttonLabel: 'Approve',
      buttonStyle: 'bg-green-600 hover:bg-green-700 text-white',
      icon: <CheckCircle size={20} className="text-green-600" />,
      required: false,
    },
    reject: {
      title: 'Reject Request',
      description: 'Reject this perfection request. Please provide a reason for rejection.',
      placeholder: 'Reason for rejection (required)…',
      buttonLabel: 'Reject',
      buttonStyle: 'bg-red-600 hover:bg-red-700 text-white',
      icon: <XCircle size={20} className="text-red-600" />,
      required: true,
    },
    request_modification: {
      title: 'Request Modification',
      description: 'Return this request to the submitter for revision. Describe what needs to be changed.',
      placeholder: 'Describe the required modifications (required)…',
      buttonLabel: 'Send Back',
      buttonStyle: 'bg-orange-500 hover:bg-orange-600 text-white',
      icon: <RotateCcw size={20} className="text-orange-500" />,
      required: true,
    },
  }[state.action];

  const canSubmit = !config.required || notes.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h3 className="text-base font-semibold text-gray-900">{config.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                {state.request.collateralId} · {state.request.obligor}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
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

        {/* Footer */}
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

// ─── Request Row ──────────────────────────────────────────────────────────────

interface RequestRowProps {
  request: PerfectionRequest;
  expanded: boolean;
  onToggle: () => void;
  onAction: (action: ActionType) => void;
  canAct: boolean;
}

function RequestRow({ request, expanded, onToggle, onAction, canAct }: RequestRowProps) {
  const statusCfg = STATUS_CONFIG[request.requestStatus] ?? STATUS_CONFIG['Submitted'];
  const priorityCfg = PRIORITY_CONFIG[request.priority] ?? PRIORITY_CONFIG['Normal'];
  const days = daysUntil(request.perfectionDeadline);
  const isOverdue = days !== null && days < 0;
  const isUrgent = days !== null && days >= 0 && days <= 7;

  return (
    <div className={`border rounded-xl overflow-hidden transition-all duration-200 ${expanded ? 'border-blue-300 shadow-md' : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'}`}>
      {/* Row Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 px-5 py-4 text-left bg-white hover:bg-gray-50/60 transition-colors"
      >
        {/* Expand icon */}
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        </div>

        {/* Priority dot */}
        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${priorityCfg.dot}`} title={`${request.priority} priority`} />

        {/* Main info */}
        <div className="flex-1 min-w-0 grid grid-cols-4 gap-4 items-center">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">{request.collateralId}</p>
            <p className="text-xs text-gray-500 truncate mt-0.5">{request.obligor}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Type</p>
            <p className="text-sm text-gray-700 font-medium truncate">{request.collateralType}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Submitted by</p>
            <p className="text-sm text-gray-700 font-medium truncate">{request.submittedByName || '—'}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-gray-500">Deadline</p>
            <p className={`text-sm font-semibold ${isOverdue ? 'text-red-600' : isUrgent ? 'text-amber-600' : 'text-gray-700'}`}>
              {formatDate(request.perfectionDeadline)}
              {isOverdue && <span className="ml-1 text-xs font-normal">(overdue)</span>}
              {isUrgent && !isOverdue && <span className="ml-1 text-xs font-normal">({days}d left)</span>}
            </p>
          </div>
        </div>

        {/* Status badge */}
        <span className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.textColor} ${statusCfg.bgColor} ${statusCfg.borderColor}`}>
          {statusCfg.label}
        </span>
      </button>

      {/* Expanded Detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50/40">
          <div className="px-6 py-5 space-y-5">
            {/* Meta row */}
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="flex items-center gap-1.5 text-gray-600">
                <Calendar size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">Submitted:</span>
                <span className="font-medium">{formatDateTime(request.submittedAt)}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <Tag size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">Registry:</span>
                <span className="font-medium">{request.registry}</span>
              </div>
              <div className="flex items-center gap-1.5 text-gray-600">
                <User size={13} className="text-gray-400" />
                <span className="text-xs text-gray-500">Reviewed by:</span>
                <span className="font-medium">{request.reviewedByName || 'Not yet reviewed'}</span>
              </div>
              {request.decisionNotes && (
                <div className="flex items-start gap-1.5 text-gray-600 w-full">
                  <MessageSquare size={13} className="text-gray-400 mt-0.5 shrink-0" />
                  <span className="text-xs text-gray-500 shrink-0">Decision notes:</span>
                  <span className="font-medium text-gray-700">{request.decisionNotes}</span>
                </div>
              )}
            </div>

            {/* Collateral Details */}
            <div>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                <Building2 size={12} />
                Collateral Details
              </h4>
              <div className="bg-white rounded-xl border border-gray-200 p-4">
                <CollateralDetailPanel collateralId={request.collateralId} />
              </div>
            </div>

            {/* Action Buttons */}
            {canAct && (
              <div className="flex items-center gap-3 pt-1">
                <button
                  onClick={() => onAction('approve')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors"
                >
                  <CheckCircle size={15} />
                  Approve
                </button>
                <button
                  onClick={() => onAction('request_modification')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors"
                >
                  <RotateCcw size={15} />
                  Request Modification
                </button>
                <button
                  onClick={() => onAction('reject')}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-red-600 hover:bg-red-700 text-white rounded-lg transition-colors"
                >
                  <XCircle size={15} />
                  Reject
                </button>
              </div>
            )}

            {!canAct && (
              <div className="flex items-center gap-2 text-xs text-gray-500 bg-gray-100 rounded-lg px-3 py-2">
                <AlertCircle size={13} />
                Actions are available to Legal Officers and System Admins for Submitted or Under Review requests.
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

const PENDING_STATUSES: PerfectionRequestStatus[] = ['Submitted', 'Under Review'];

export default function ApprovalInboxContent() {
  const { userProfile } = useAuth();
  const userRole = userProfile?.role ?? '';

  const [requests, setRequests] = useState<PerfectionRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | PerfectionRequestStatus>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | string>('all');

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState>({ open: false, request: null, action: null });
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const canActOnRequest = useCallback((req: PerfectionRequest): boolean => {
    if (!['legal_officer', 'system_admin'].includes(userRole)) return false;
    return PENDING_STATUSES.includes(req.requestStatus);
  }, [userRole]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const all = await perfectionService.getAll();
      // Show all pending requests (Submitted + Under Review)
      const pending = all.filter((r) => PENDING_STATUSES.includes(r.requestStatus));
      setRequests(pending);
    } catch (e: any) {
      setError(e?.message ?? 'Failed to load approval requests.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const handleAction = useCallback(async (action: ActionType, notes: string) => {
    if (!actionModal.request || !userProfile) return;
    setSubmitting(true);
    const req = actionModal.request;
    const userId = userProfile.id ?? '';
    const userName = userProfile.full_name ?? userProfile.email ?? 'Reviewer';
    const role = userRole;

    try {
      if (action === 'approve') {
        await perfectionService.approve(req.id, userId, userName, notes, role);
        setToast({ message: `Request ${req.collateralId} approved successfully.`, type: 'success' });
      } else if (action === 'reject') {
        await perfectionService.reject(req.id, userId, userName, notes, role);
        setToast({ message: `Request ${req.collateralId} rejected.`, type: 'success' });
      } else if (action === 'request_modification') {
        await perfectionService.returnForRevision(req.id, userId, userName, notes, role);
        setToast({ message: `Request ${req.collateralId} returned for modification.`, type: 'success' });
      }
      setActionModal({ open: false, request: null, action: null });
      setExpandedId(null);
      await load(true);
    } catch (e: any) {
      setToast({ message: e?.message ?? 'Action failed. Please try again.', type: 'error' });
    } finally {
      setSubmitting(false);
    }
  }, [actionModal.request, userProfile, userRole, load]);

  // Filtered list
  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      r.collateralId.toLowerCase().includes(q) ||
      r.obligor.toLowerCase().includes(q) ||
      r.submittedByName.toLowerCase().includes(q) ||
      r.collateralType.toLowerCase().includes(q);
    const matchesStatus = statusFilter === 'all' || r.requestStatus === statusFilter;
    const matchesPriority = priorityFilter === 'all' || r.priority === priorityFilter;
    return matchesSearch && matchesStatus && matchesPriority;
  });

  // Stats
  const submitted = requests.filter((r) => r.requestStatus === 'Submitted').length;
  const underReview = requests.filter((r) => r.requestStatus === 'Under Review').length;
  const highPriority = requests.filter((r) => r.priority === 'High').length;
  const overdue = requests.filter((r) => {
    const d = daysUntil(r.perfectionDeadline);
    return d !== null && d < 0;
  }).length;

  const isReviewer = ['legal_officer', 'system_admin'].includes(userRole);

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg text-sm font-medium transition-all ${
          toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
        }`}>
          {toast.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="px-6 pt-6 pb-4 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Approval Inbox</h1>
            <p className="text-sm text-gray-500 mt-0.5">
              Review pending loan perfection requests, compare collateral details, and take action.
            </p>
          </div>
          <button
            onClick={() => load(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Awaiting Review', value: submitted, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: <Clock size={16} className="text-blue-500" /> },
            { label: 'Under Review', value: underReview, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: <Eye size={16} className="text-amber-500" /> },
            { label: 'High Priority', value: highPriority, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: <AlertCircle size={16} className="text-red-500" /> },
            { label: 'Overdue', value: overdue, color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: <XCircle size={16} className="text-rose-500" /> },
          ].map(({ label, value, color, bg, border, icon }) => (
            <div key={label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${bg} ${border}`}>
              {icon}
              <div>
                <p className={`text-xl font-bold ${color}`}>{value}</p>
                <p className="text-xs text-gray-500">{label}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          {/* Search */}
          <div className="relative flex-1 min-w-48">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by collateral ID, obligor, officer…"
              className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all bg-gray-50"
            />
          </div>

          {/* Status filter */}
          <div className="flex items-center gap-1.5">
            <Filter size={13} className="text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-700"
            >
              <option value="all">All Statuses</option>
              <option value="Submitted">Submitted</option>
              <option value="Under Review">Under Review</option>
            </select>
          </div>

          {/* Priority filter */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            className="text-sm border border-gray-200 rounded-lg px-2.5 py-2 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500/30 text-gray-700"
          >
            <option value="all">All Priorities</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
            <option value="Low">Low</option>
          </select>

          <span className="text-xs text-gray-400 ml-auto">
            {filtered.length} of {requests.length} requests
          </span>
        </div>
      </div>

      {/* Role notice for non-reviewers */}
      {!isReviewer && (
        <div className="mx-6 mt-4 flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertCircle size={16} className="shrink-0 mt-0.5 text-amber-500" />
          <span>
            You are viewing the approval inbox in <strong>read-only</strong> mode. Approve, reject, and modification actions are available to <strong>Legal Officers</strong> and <strong>System Admins</strong>.
          </span>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <Loader2 size={28} className="animate-spin" />
            <p className="text-sm">Loading pending requests…</p>
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <AlertCircle size={28} className="text-red-400" />
            <p className="text-sm text-red-600">{error}</p>
            <button onClick={() => load()} className="text-sm text-blue-600 hover:underline">Retry</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <CheckSquare size={32} className="text-green-400" />
            <p className="text-base font-medium text-gray-600">
              {requests.length === 0 ? 'No pending requests' : 'No requests match your filters'}
            </p>
            <p className="text-sm text-gray-400">
              {requests.length === 0
                ? 'All loan perfection requests have been processed.' :'Try adjusting your search or filter criteria.'}
            </p>
          </div>
        ) : (
          filtered.map((req) => (
            <RequestRow
              key={req.id}
              request={req}
              expanded={expandedId === req.id}
              onToggle={() => setExpandedId(expandedId === req.id ? null : req.id)}
              onAction={(action) => setActionModal({ open: true, request: req, action })}
              canAct={canActOnRequest(req)}
            />
          ))
        )}
      </div>

      {/* Action Modal */}
      <ActionModal
        state={actionModal}
        onClose={() => setActionModal({ open: false, request: null, action: null })}
        onSubmit={handleAction}
        submitting={submitting}
      />
    </div>
  );
}
