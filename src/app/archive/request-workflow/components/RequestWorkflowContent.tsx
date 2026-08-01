'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Search, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock, RotateCcw, X, Info } from 'lucide-react';
import {
  archiveRequestService, archiveAuditService, ArchiveRequest, RequestStatus,
} from '@/lib/supabase/archiveService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';


const STATUS_CONFIG: Record<RequestStatus, { label: string; bg: string; text: string; border: string }> = {
  pending:     { label: 'Pending',     bg: '#FFFBEB', text: '#B45309', border: '#FDE68A' },
  approved:    { label: 'Approved',    bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0' },
  rejected:    { label: 'Rejected',    bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3' },
  checked_out: { label: 'Checked Out', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
  returned:    { label: 'Returned',    bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD' },
};

interface RaiseRequestModalProps {
  collaterals: CollateralRecord[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function RaiseRequestModal({ collaterals, userId, onClose, onSaved }: RaiseRequestModalProps) {
  const [collateralId, setCollateralId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [expectedReturnDate, setExpectedReturnDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSave = async () => {
    if (!collateralId || !purpose.trim()) { setError('Collateral and purpose are required.'); return; }
    setSaving(true);
    try {
      const req = await archiveRequestService.create({ collateralId, requestedBy: userId, purpose, expectedReturnDate: expectedReturnDate || undefined });
      await archiveAuditService.log({
        eventType: 'request_raised', collateralId, requestId: req.id, performedBy: userId,
        description: `Loan request raised: ${purpose}`,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold mb-4" style={{ color: '#1E3A8A' }}>Raise File Request</h3>
        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Collateral *</label>
            <select value={collateralId} onChange={(e) => setCollateralId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }}>
              <option value="">Select collateral…</option>
              {collaterals.map((c) => (
                <option key={c.id} value={c.id}>{c.type} — {c.obligor}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Purpose *</label>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }} placeholder="Reason for requesting the physical file…" />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>Expected Return Date</label>
            <input type="date" value={expectedReturnDate} onChange={(e) => setExpectedReturnDate(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: '#D1D5DB' }} />
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#D1D5DB', color: '#374151' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: '#2563EB', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Submitting…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface ActionModalProps {
  request: ArchiveRequest;
  action: 'approve' | 'reject' | 'return';
  userId: string;
  onClose: () => void;
  onDone: () => void;
}

function ActionModal({ request, action, userId, onClose, onDone }: ActionModalProps) {
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const titles = { approve: 'Approve Request', reject: 'Reject Request', return: 'Mark as Returned' };
  const buttonLabels = { approve: 'Approve', reject: 'Reject', return: 'Mark Returned' };
  const buttonColors = { approve: '#15803D', reject: '#BE123C', return: '#0369A1' };

  const handleAction = async () => {
    if (action === 'reject' && !notes.trim()) { setError('Rejection reason is required.'); return; }
    setSaving(true);
    try {
      if (action === 'approve') {
        await archiveRequestService.approve(request.id, userId, notes);
        await archiveAuditService.log({ eventType: 'request_approved', collateralId: request.collateralId, requestId: request.id, performedBy: userId, description: 'Request approved and file checked out' });
      } else if (action === 'reject') {
        await archiveRequestService.reject(request.id, notes);
        await archiveAuditService.log({ eventType: 'request_rejected', collateralId: request.collateralId, requestId: request.id, performedBy: userId, description: `Request rejected: ${notes}` });
      } else {
        await archiveRequestService.markReturned(request.id, notes);
        await archiveAuditService.log({ eventType: 'returned', collateralId: request.collateralId, requestId: request.id, performedBy: userId, description: 'Physical file returned to vault' });
      }
      onDone();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Action failed');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold mb-2" style={{ color: '#1E3A8A' }}>{titles[action]}</h3>
        <p className="text-sm mb-4" style={{ color: '#6B7280' }}>
          {request.collateral?.collateral_type} — {request.collateral?.obligor}
        </p>
        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: '#374151' }}>
            {action === 'reject' ? 'Rejection Reason *' : 'Notes (optional)'}
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: '#D1D5DB' }} />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: '#D1D5DB', color: '#374151' }}>Cancel</button>
          <button onClick={handleAction} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: buttonColors[action], opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Processing…' : buttonLabels[action]}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Request Detail Panel (used inside drawer) ─────────────────────────────────

function RequestDetailPanel({
  request,
  onClose,
  onAction,
}: {
  request: ArchiveRequest;
  onClose: () => void;
  onAction: (action: 'approve' | 'reject' | 'return') => void;
}) {
  const sc = STATUS_CONFIG[request.requestStatus];
  const isOverdue = request.expectedReturnDate && request.requestStatus === 'approved' && new Date(request.expectedReturnDate) < new Date();

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full border" style={{ backgroundColor: sc.bg, color: sc.text, borderColor: sc.border }}>
                {sc.label}
              </span>
              {isOverdue && (
                <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Overdue</span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900">
              {request.collateral?.collateral_type ?? 'Unknown'} — {request.collateral?.obligor ?? '—'}
            </h2>
            <p className="text-sm text-gray-500 mt-0.5">
              By: {request.requestedByProfile?.full_name ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
        {/* Purpose */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Purpose</h3>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
            <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
            <p className="text-sm text-gray-800">{request.purpose}</p>
          </div>
        </div>

        {/* Details */}
        <div>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Request Details</h3>
          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {[
              { label: 'Collateral Type', value: request.collateral?.collateral_type ?? '—' },
              { label: 'Obligor', value: request.collateral?.obligor ?? '—' },
              { label: 'Requested By', value: request.requestedByProfile?.full_name ?? '—' },
              { label: 'Expected Return', value: request.expectedReturnDate ?? '—' },
              { label: 'Status', value: sc.label },
            ].map(({ label, value }) => (
              <div key={label}>
                <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wide">{label}</p>
                <p className="text-sm text-gray-800 font-medium mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Final status */}
        {(request.requestStatus === 'approved' || request.requestStatus === 'rejected' || request.requestStatus === 'returned') && (
          <div className={`flex items-center gap-2 px-4 py-3 rounded-lg text-sm font-medium ${
            request.requestStatus === 'approved' || request.requestStatus === 'returned'
              ? 'bg-green-50 border border-green-200 text-green-700' :'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {request.requestStatus === 'rejected' ? <XCircle size={16} /> : <CheckCircle size={16} />}
            {sc.label}
          </div>
        )}
      </div>

      {/* Action Zone */}
      {(request.requestStatus === 'pending' || request.requestStatus === 'approved') && (
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Take Action</h3>
          <div className="flex items-center gap-2">
            {request.requestStatus === 'pending' && (
              <>
                <button
                  onClick={() => onAction('approve')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                >
                  <CheckCircle size={14} /> Approve
                </button>
                <button
                  onClick={() => onAction('reject')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                >
                  <XCircle size={14} /> Reject
                </button>
              </>
            )}
            {request.requestStatus === 'approved' && (
              <button
                onClick={() => onAction('return')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors"
                style={{ backgroundColor: '#0369A1' }}
              >
                <RotateCcw size={14} /> Mark Returned
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function RequestWorkflowContent() {
  const { user } = useAuth();
  const [requests, setRequests] = useState<ArchiveRequest[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [actionModal, setActionModal] = useState<{ request: ArchiveRequest; action: 'approve' | 'reject' | 'return' } | null>(null);
  const [selectedRequest, setSelectedRequest] = useState<ArchiveRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c] = await Promise.all([archiveRequestService.getAll(), collateralService.getAll()]);
      setRequests(r);
      setCollaterals(c);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q || r.collateral?.obligor?.toLowerCase().includes(q) || r.purpose.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.requestStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = requests.reduce((acc, r) => {
    acc[r.requestStatus] = (acc[r.requestStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const handleSelectRequest = (req: ArchiveRequest) => {
    setSelectedRequest(req);
    setDrawerOpen(true);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedRequest(null), 300);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>Request Workflow</h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>Raise, approve, and track physical file loan requests</p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}>
            <RefreshCw size={16} style={{ color: '#2563EB' }} />
          </button>
          <button onClick={() => setShowRaiseModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: '#2563EB' }}>
            <Plus size={16} /> Raise Request
          </button>
        </div>
      </div>

      {/* Status pills */}
      <div className="flex gap-2 flex-wrap mb-5">
        {(['all', 'pending', 'approved', 'checked_out', 'returned', 'rejected'] as const).map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
            style={statusFilter === s
              ? { backgroundColor: '#2563EB', color: '#fff' }
              : { backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
            {s === 'all' ? 'All' : STATUS_CONFIG[s].label}
            {s !== 'all' && counts[s] ? ` (${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
          placeholder="Search by owner, purpose…" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
          <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No requests found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
            const sc = STATUS_CONFIG[req.requestStatus];
            const isOverdue = req.expectedReturnDate && req.requestStatus === 'approved' && new Date(req.expectedReturnDate) < new Date();
            const isSelected = selectedRequest?.id === req.id && drawerOpen;
            return (
              <div
                key={req.id}
                onClick={() => handleSelectRequest(req)}
                className="p-4 rounded-xl cursor-pointer transition-all hover:shadow-sm"
                style={{
                  backgroundColor: isSelected ? '#EFF6FF' : '#F8FAFF',
                  border: isSelected ? '2px solid #2563EB' : '1px solid #DBEAFE',
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: sc.bg }}>
                    <ClipboardList size={16} style={{ color: sc.text }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>
                        {req.collateral?.collateral_type ?? 'Unknown'} — {req.collateral?.obligor ?? '—'}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {sc.label}
                      </span>
                      {isOverdue && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 text-red-700">Overdue</span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#6B7280' }}>{req.purpose}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="text-xs" style={{ color: '#9CA3AF' }}>
                        By: {req.requestedByProfile?.full_name ?? '—'}
                      </span>
                      {req.expectedReturnDate && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#BE123C' : '#6B7280' }}>
                          <Clock size={11} /> Return: {req.expectedReturnDate}
                        </span>
                      )}
                    </div>
                  </div>
                  {/* Quick action buttons */}
                  <div className="flex gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                    {req.requestStatus === 'pending' && (
                      <>
                        <button onClick={() => setActionModal({ request: req, action: 'approve' })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: '#F0FDF4', color: '#15803D' }}>
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button onClick={() => setActionModal({ request: req, action: 'reject' })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                          style={{ backgroundColor: '#FFF1F2', color: '#BE123C' }}>
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                    {req.requestStatus === 'approved' && (
                      <button onClick={() => setActionModal({ request: req, action: 'return' })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium"
                        style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}>
                        <RotateCcw size={12} /> Return
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Request Detail Drawer */}
      <WorkflowDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        width="w-[480px]"
        deadline={selectedRequest?.expectedReturnDate ?? undefined}
        overdueHours={
          selectedRequest?.expectedReturnDate &&
          selectedRequest.requestStatus === 'approved' &&
          new Date(selectedRequest.expectedReturnDate) < new Date()
            ? Math.max(0, (Date.now() - new Date(selectedRequest.expectedReturnDate).getTime()) / (1000 * 60 * 60))
            : undefined
        }
      >
        {selectedRequest && (
          <RequestDetailPanel
            request={selectedRequest}
            onClose={handleCloseDrawer}
            onAction={(action) => setActionModal({ request: selectedRequest, action })}
          />
        )}
      </WorkflowDrawer>

      {showRaiseModal && (
        <RaiseRequestModal
          collaterals={collaterals}
          userId={user?.id ?? ''}
          onClose={() => setShowRaiseModal(false)}
          onSaved={() => { setShowRaiseModal(false); load(); }}
        />
      )}
      {actionModal && (
        <ActionModal
          request={actionModal.request}
          action={actionModal.action}
          userId={user?.id ?? ''}
          onClose={() => setActionModal(null)}
          onDone={() => { setActionModal(null); load(); }}
        />
      )}
    </div>
  );
}
