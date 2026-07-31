'use client';
import React, { useState, useEffect } from 'react';
import {
  Unlock, CheckCircle, XCircle, Clock, Search, Eye,
  AlertCircle, FileText, User, Calendar, DollarSign,
  X, Loader2, ChevronRight, LayoutGrid, ShieldCheck, Info,
} from 'lucide-react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  releaseRequestService,
  type ReleaseRequest,
  type ReleaseRequestStatus,
} from '@/lib/supabase/releaseRequestService';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';

interface ReleaseRequest {
  id: string;
  collateralRef: string;
  collateralType: string;
  clientName: string;
  loanRef: string;
  estimatedValue: number;
  requestedBy: string;
  requestedDate: string;
  releaseReason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Under Review';
  priority: 'High' | 'Normal' | 'Low';
  notes?: string;
}

const STATUS_CONFIG: Record<ReleaseRequest['status'], { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending:        { label: 'Pending',      color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-200',  icon: <Clock size={12} /> },
  'Under Review': { label: 'Under Review', color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-200',   icon: <Eye size={12} /> },
  Approved:       { label: 'Approved',     color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-200',  icon: <CheckCircle size={12} /> },
  Rejected:       { label: 'Rejected',     color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-200',    icon: <XCircle size={12} /> },
};

const PRIORITY_CONFIG: Record<ReleaseRequest['priority'], { color: string; bg: string }> = {
  High:   { color: 'text-red-700',   bg: 'bg-red-50 border border-red-200' },
  Normal: { color: 'text-gray-600',  bg: 'bg-gray-50 border border-gray-200' },
  Low:    { color: 'text-blue-600',  bg: 'bg-blue-50 border border-blue-200' },
};

function formatCurrency(amount: number): string {
  if (amount >= 1000000000) return `TZS ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `TZS ${(amount / 1000000).toFixed(1)}M`;
  return `TZS ${amount.toLocaleString()}`;
}

// ─── Action Dialog ─────────────────────────────────────────────────────────────

interface ActionDialogState {
  open: boolean;
  request: ReleaseRequest | null;
  action: 'Approved' | 'Rejected' | 'Under Review' | null;
}

interface ActionDialogProps {
  state: ActionDialogState;
  onClose: () => void;
  onSubmit: (action: 'Approved' | 'Rejected' | 'Under Review', note: string) => void;
  processing: boolean;
}

function ActionDialog({ state, onClose, onSubmit, processing }: ActionDialogProps) {
  const [note, setNote] = useState('');

  React.useEffect(() => {
    if (state.open) setNote('');
  }, [state.open]);

  if (!state.open || !state.request || !state.action) return null;

  const config = {
    Approved: {
      title: 'Approve Release',
      description: 'Approve this collateral release request. The collateral will be discharged from the facility.',
      placeholder: 'Add approval note (optional)…',
      buttonLabel: 'Approve Release',
      buttonStyle: 'bg-green-600 hover:bg-green-700 text-white',
      icon: <CheckCircle size={20} className="text-green-600" />,
      required: false,
    },
    Rejected: {
      title: 'Reject Release',
      description: 'Reject this release request. Please provide a clear reason for the submitter.',
      placeholder: 'Reason for rejection (required)…',
      buttonLabel: 'Reject Release',
      buttonStyle: 'bg-red-600 hover:bg-red-700 text-white',
      icon: <XCircle size={20} className="text-red-600" />,
      required: true,
    },
    'Under Review': {
      title: 'Mark Under Review',
      description: 'Flag this request as currently under review. You can approve or reject it later.',
      placeholder: 'Review notes (optional)…',
      buttonLabel: 'Mark Under Review',
      buttonStyle: 'bg-blue-600 hover:bg-blue-700 text-white',
      icon: <Eye size={20} className="text-blue-600" />,
      required: false,
    },
  }[state.action];

  const canSubmit = !config.required || note.trim().length > 0;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            {config.icon}
            <div>
              <h3 className="text-base font-semibold text-gray-900">{config.title}</h3>
              <p className="text-xs text-gray-500 mt-0.5 truncate max-w-xs">{state.request.collateralRef} · {state.request.clientName}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div className="bg-gray-50 rounded-xl p-3 space-y-1.5 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-500">Collateral Type</span>
              <span className="font-medium text-gray-800">{state.request.collateralType}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Loan Reference</span>
              <span className="font-medium text-gray-800">{state.request.loanRef}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Estimated Value</span>
              <span className="font-medium text-gray-800">{formatCurrency(state.request.estimatedValue)}</span>
            </div>
          </div>
          <p className="text-sm text-gray-600">{config.description}</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">
              Notes {config.required && <span className="text-red-500">*</span>}
            </label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={config.placeholder}
              rows={4}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 transition-all"
            />
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button
            onClick={onClose}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onSubmit(state.action!, note)}
            disabled={!canSubmit || processing}
            className={`px-5 py-2 text-sm font-semibold rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50 ${config.buttonStyle}`}
          >
            {processing && <Loader2 size={14} className="animate-spin" />}
            {config.buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Detail Panel (used inside drawer) ────────────────────────────────────────

function DetailPanel({
  request,
  onClose,
  onOpenAction,
}: {
  request: ReleaseRequest;
  onClose: () => void;
  onOpenAction: (action: 'Approved' | 'Rejected' | 'Under Review') => void;
}) {
  const statusCfg = STATUS_CONFIG[request.status];
  const priorityCfg = PRIORITY_CONFIG[request.priority];
  const isActive = request.status === 'Pending' || request.status === 'Under Review';

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Panel Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
                {request.priority}
              </span>
            </div>
            <h2 className="text-base font-semibold text-gray-900">{request.collateralRef}</h2>
            <p className="text-sm text-gray-500">{request.clientName}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Details grid */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Request Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Collateral Type', value: request.collateralType, icon: <FileText size={12} /> },
              { label: 'Loan Reference', value: request.loanRef, icon: <FileText size={12} /> },
              { label: 'Estimated Value', value: formatCurrency(request.estimatedValue), icon: <DollarSign size={12} /> },
              { label: 'Requested By', value: request.requestedBy, icon: <User size={12} /> },
              { label: 'Request Date', value: request.requestedDate, icon: <Calendar size={12} /> },
              { label: 'Priority', value: request.priority, icon: <AlertCircle size={12} /> },
            ].map((field) => (
              <div key={field.label}>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide flex items-center gap-1 mb-0.5">
                  {field.icon} {field.label}
                </p>
                <p className="text-sm font-medium text-gray-900">{field.value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Release Reason */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Release Reason</h3>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
            <p className="text-sm text-gray-800">{request.releaseReason}</p>
          </div>
        </div>

        {/* Existing Notes */}
        {request.notes && (
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Notes</h3>
            <div className="bg-amber-50 border border-amber-100 rounded-lg p-3">
              <p className="text-sm text-gray-800">{request.notes}</p>
            </div>
          </div>
        )}

        {/* Final status banner */}
        {(request.status === 'Approved' || request.status === 'Rejected') && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            request.status === 'Approved' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {request.status === 'Approved' ? <CheckCircle size={16} /> : <XCircle size={16} />}
            This request has been {request.status.toLowerCase()}.
          </div>
        )}
      </div>

      {/* Action Zone */}
      {isActive && (
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Take Action</h3>
          <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
            <p className="text-xs text-gray-500 flex items-center gap-1.5">
              <ShieldCheck size={12} className="text-teal-600" />
              Review the request details, then choose an action below.
            </p>
            <div className="flex items-center gap-2">
              {request.status !== 'Under Review' && (
                <button
                  onClick={() => onOpenAction('Under Review')}
                  className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium rounded-lg border border-blue-200 text-blue-700 bg-blue-50 hover:bg-blue-100 transition-colors"
                >
                  <Eye size={14} />
                </button>
              )}
              <button
                onClick={() => onOpenAction('Rejected')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <XCircle size={14} /> Reject
              </button>
              <button
                onClick={() => onOpenAction('Approved')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <CheckCircle size={14} /> Approve Release
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function ReleaseApprovalContent() {
  const { userProfile } = useAuth();
  const [requests, setRequests] = useState<ReleaseRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [selectedRequest, setSelectedRequest] = useState<ReleaseRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [actionDialog, setActionDialog] = useState<ActionDialogState>({ open: false, request: null, action: null });
  const [processing, setProcessing] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success\' | \'error' } | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const data = await releaseRequestService.getAll();
        if (!cancelled) setRequests(data);
      } catch (err: any) {
        if (!cancelled) setLoadError(err?.message ?? 'Failed to load release requests');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, []);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const filtered = requests.filter((r) => {
    const matchesSearch =
      r.collateralRef.toLowerCase().includes(search.toLowerCase()) ||
      r.clientName.toLowerCase().includes(search.toLowerCase()) ||
      r.loanRef.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'All' || r.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const stats = {
    pending:     requests.filter((r) => r.status === 'Pending').length,
    underReview: requests.filter((r) => r.status === 'Under Review').length,
    approved:    requests.filter((r) => r.status === 'Approved').length,
    rejected:    requests.filter((r) => r.status === 'Rejected').length,
  };

  const handleSelectRequest = (req: ReleaseRequest) => {
    setSelectedRequest(req);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedRequest(null), 300);
  };

  const handleAction = async (action: 'Approved' | 'Rejected' | 'Under Review', note: string) => {
    if (!actionDialog.request) return;
    setProcessing(true);
    const req = actionDialog.request;
    try {
      const updated = await releaseRequestService.updateStatus(
        req.id,
        action as ReleaseRequestStatus,
        note || undefined,
        userProfile?.id,
        userProfile?.full_name ?? undefined,
        userProfile?.role ?? undefined,
      );
      if (updated) {
        setRequests((prev) => prev.map((r) => r.id === updated.id ? updated : r));
        setSelectedRequest((prev) => prev?.id === updated.id ? updated : prev);
      } else {
        const optimistic = { ...req, status: action as ReleaseRequestStatus, notes: note || req.notes };
        setRequests((prev) => prev.map((r) => r.id === req.id ? optimistic : r));
        setSelectedRequest((prev) => prev?.id === req.id ? optimistic : prev);
      }
      setActionDialog({ open: false, request: null, action: null });
      const labels: Record<string, string> = {
        Approved: 'Release approved successfully',
        Rejected: 'Release request rejected',
        'Under Review': 'Request marked as under review',
      };
      showToast(labels[action], 'success');
    } catch (err: any) {
      showToast(err?.message ?? 'Action failed', 'error');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-blue-100">
              <Unlock size={18} className="text-blue-700" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href="/workflows" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <LayoutGrid size={11} /> Workflows
                </Link>
                <ChevronRight size={11} className="text-gray-300" />
                <span className="text-xs text-gray-600 font-medium">Release Approval</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Release Approval</h1>
              <p className="text-sm text-gray-500">Authorise or reject collateral release and discharge requests</p>
            </div>
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Pending',      value: stats.pending,     color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200',  key: 'Pending' },
            { label: 'Under Review', value: stats.underReview, color: 'text-blue-700',  bg: 'bg-blue-50 border-blue-200',    key: 'Under Review' },
            { label: 'Approved',     value: stats.approved,    color: 'text-green-700', bg: 'bg-green-50 border-green-200',  key: 'Approved' },
            { label: 'Rejected',     value: stats.rejected,    color: 'text-red-700',   bg: 'bg-red-50 border-red-200',      key: 'Rejected' },
          ].map((stat) => (
            <button
              key={stat.label}
              onClick={() => setStatusFilter(statusFilter === stat.key ? 'All' : stat.key)}
              className={`rounded-lg border px-4 py-3 text-left transition-all ${stat.bg} ${statusFilter === stat.key ? 'ring-2 ring-blue-400 shadow-md' : 'hover:shadow-sm'}`}
            >
              <p className="text-xs text-gray-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
            </button>
          ))}
        </div>
      </div>

      {/* Body — full-width list */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <div className="flex flex-col w-full bg-white min-h-0">
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-3 shrink-0">
            <div className="relative flex-1">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by collateral ref, client, or loan..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="All">All Statuses</option>
              <option value="Pending">Pending</option>
              <option value="Under Review">Under Review</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          </div>

          {/* Request List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Loader2 size={28} className="animate-spin mb-2 text-blue-400" />
                <p className="text-sm">Loading release requests…</p>
              </div>
            ) : loadError ? (
              <div className="flex flex-col items-center justify-center h-40 text-red-400 px-6 text-center">
                <AlertCircle size={28} className="mb-2" />
                <p className="text-sm">{loadError}</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <Unlock size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No release requests found</p>
              </div>
            ) : (
              filtered.map((req) => {
                const statusCfg = STATUS_CONFIG[req.status];
                const priorityCfg = PRIORITY_CONFIG[req.priority];
                const isSelected = selectedRequest?.id === req.id && drawerOpen;
                const isActive = req.status === 'Pending' || req.status === 'Under Review';

                return (
                  <div
                    key={req.id}
                    onClick={() => handleSelectRequest(req)}
                    className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 border-l-2 border-l-blue-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-semibold text-gray-900 truncate">{req.collateralRef}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priorityCfg.bg} ${priorityCfg.color}`}>
                          {req.priority}
                        </span>
                      </div>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-sm text-gray-700 font-medium mb-1">{req.clientName}</p>
                    <p className="text-xs text-gray-500 mb-2 line-clamp-1">{req.releaseReason}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><FileText size={11} />{req.collateralType}</span>
                      <span className="flex items-center gap-1"><DollarSign size={11} />{formatCurrency(req.estimatedValue)}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} />{req.requestedDate}</span>
                    </div>
                    {isActive && (
                      <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => { setSelectedRequest(req); setActionDialog({ open: true, request: req, action: 'Approved' }); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle size={11} /> Approve
                        </button>
                        <button
                          onClick={() => { setSelectedRequest(req); setActionDialog({ open: true, request: req, action: 'Rejected' }); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <XCircle size={11} /> Reject
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Drawer */}
      <WorkflowDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        width="w-[500px]"
        deadline={selectedRequest?.requestedDate ?? undefined}
        escalated={selectedRequest?.priority === 'High'}
        overdueHours={
          selectedRequest &&
          (selectedRequest.status === 'Pending' || selectedRequest.status === 'Under Review')
            ? Math.max(0, (Date.now() - new Date(selectedRequest.requestedDate).getTime()) / (1000 * 60 * 60))
            : undefined
        }
      >
        {selectedRequest && (
          <DetailPanel
            request={selectedRequest}
            onClose={handleCloseDrawer}
            onOpenAction={(action) => setActionDialog({ open: true, request: selectedRequest, action })}
          />
        )}
      </WorkflowDrawer>

      {/* Action Dialog */}
      <ActionDialog
        state={actionDialog}
        onClose={() => setActionDialog({ open: false, request: null, action: null })}
        onSubmit={handleAction}
        processing={processing}
      />

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
