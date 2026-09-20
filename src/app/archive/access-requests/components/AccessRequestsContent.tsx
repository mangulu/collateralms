'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { ClipboardList, Plus, Search, RefreshCw, AlertCircle, CheckCircle, XCircle, Clock, RotateCcw, X, Info, Download, Eye, ChevronDown, ChevronUp, ArrowRight, User, Calendar, Shield,  } from 'lucide-react';
import {
  archiveRequestService, archiveAuditService, archiveRequestStatusLogService,
  ArchiveRequest, RequestStatus, RequestStatusLogEntry,
  archivePlacementService,
} from '@/lib/supabase/archiveService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import StatusBadge from '@/components/ui/StatusBadge';


const STATUS_CONFIG: Record<RequestStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  pending:                  { label: 'Pending',               bg: 'var(--izou-warning-light)', text: 'var(--izou-warning)', border: 'var(--izou-warning-light)', icon: Clock },
  pending_second_approval:  { label: 'Awaiting 2nd Approval',  bg: 'var(--izou-highlight-light)', text: 'var(--izou-highlight)', border: 'var(--izou-highlight-light)', icon: Shield },
  approved:                 { label: 'Approved',               bg: 'var(--izou-success-light)', text: 'var(--izou-success)', border: 'var(--izou-success-light)', icon: CheckCircle },
  rejected:                 { label: 'Rejected',               bg: 'var(--izou-danger-light)', text: 'var(--izou-danger)', border: 'var(--izou-danger-light)', icon: XCircle },
  checked_out:              { label: 'Checked Out',            bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary)', border: 'var(--izou-secondary-light)', icon: ArrowRight },
  returned:                 { label: 'Returned',               bg: 'var(--izou-secondary-light)', text: 'var(--izou-secondary-mid)', border: 'var(--izou-secondary-light)', icon: RotateCcw },
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

// ─── Raise Request Modal ──────────────────────────────────────────────────────

interface RaiseRequestModalProps {
  collaterals: CollateralRecord[];
  userId: string;
  onClose: () => void;
  onSaved: () => void;
}

function RaiseRequestModal({ collaterals, userId, onClose, onSaved }: RaiseRequestModalProps) {
  const [collateralId, setCollateralId] = useState('');
  const [purpose, setPurpose] = useState('');
  const [numberOfDays, setNumberOfDays] = useState('');
  const [fromDate, setFromDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Auto-calculate expected return date
  const expectedReturnDate = (() => {
    const days = parseInt(numberOfDays, 10);
    if (!fromDate || isNaN(days) || days <= 0) return '';
    const d = new Date(fromDate);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  })();

  const formatDisplayDate = (iso: string) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const handleSave = async () => {
    if (!collateralId || !purpose.trim()) { setError('Collateral and purpose are required.'); return; }
    setSaving(true);
    setError('');
    try {
      // Check if the requested file is available in the vault
      const placements = await archivePlacementService.getAll();
      const isInVault = placements.some((p) => p.collateralId === collateralId && p.locationId);
      if (!isInVault) {
        setError('This file is not currently available in the vault. Please verify the collateral has been filed before raising a request.');
        setSaving(false);
        return;
      }

      const req = await archiveRequestService.create({
        collateralId,
        requestedBy: userId,
        purpose,
        expectedReturnDate: expectedReturnDate || undefined,
      });
      await archiveAuditService.log({
        eventType: 'request_raised', collateralId, requestId: req.id, performedBy: userId,
        description: `File request raised: ${purpose}`,
      });
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to save');
    } finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h3 className="text-base font-bold mb-4" style={{ color: 'var(--izou-secondary)' }}>Raise File Request</h3>
        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Collateral *</label>
            <select value={collateralId} onChange={(e) => setCollateralId(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: 'var(--izou-border)' }}>
              <option value="">Select collateral…</option>
              {collaterals.map((c) => (
                <option key={c.id} value={c.id}>{c.type} — {c.obligor}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Purpose *</label>
            <textarea value={purpose} onChange={(e) => setPurpose(e.target.value)} rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              style={{ borderColor: 'var(--izou-border)' }} placeholder="Reason for requesting the physical file…" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>From</label>
              <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: 'var(--izou-border)' }} />
            </div>
            <div>
              <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>Number of Days</label>
              <input type="number" min="1" value={numberOfDays} onChange={(e) => setNumberOfDays(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: 'var(--izou-border)' }} placeholder="e.g. 7" />
            </div>
          </div>
          <div className="rounded-lg px-3 py-2.5 flex items-center gap-2"
            style={{ backgroundColor: expectedReturnDate ? 'var(--izou-secondary-light)' : 'var(--izou-bg)', border: `1px solid ${expectedReturnDate ? 'var(--izou-border)' : 'var(--izou-border)'}` }}>
            <Calendar size={14} style={{ color: expectedReturnDate ? 'var(--izou-secondary)' : 'var(--izou-muted)' }} />
            <div>
              <p className="text-xs font-medium" style={{ color: 'var(--izou-text)' }}>Expected Return Date</p>
              <p className="text-sm font-semibold" style={{ color: expectedReturnDate ? 'var(--izou-secondary)' : 'var(--izou-muted)' }}>
                {expectedReturnDate ? formatDisplayDate(expectedReturnDate) : 'Enter From date and Number of Days'}
              </p>
            </div>
          </div>
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--izou-border)', color: 'var(--izou-text)' }}>Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="flex-1 py-2 rounded-lg text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--izou-secondary)', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Checking vault…' : 'Submit Request'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Action Modal ─────────────────────────────────────────────────────────────

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
  const buttonColors = { approve: 'var(--izou-success)', reject: 'var(--izou-danger)', return: 'var(--izou-secondary-mid)' };

  const handleAction = async () => {
    if (action === 'reject' && !notes.trim()) { setError('Rejection reason is required.'); return; }
    setSaving(true);
    try {
      if (action === 'approve') {
        const finalized = await archiveRequestService.approve(request.id, userId, notes);
        await archiveAuditService.log({
          eventType: 'request_approved', collateralId: request.collateralId, requestId: request.id, performedBy: userId,
          description: finalized ? 'Request approved and file checked out' : 'First approval given — awaiting a second, different approver',
        });
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
        <h3 className="text-base font-bold mb-2" style={{ color: 'var(--izou-secondary)' }}>{titles[action]}</h3>
        <p className="text-sm mb-4" style={{ color: 'var(--izou-muted)' }}>
          {request.collateral?.collateral_type} — {request.collateral?.obligor}
        </p>
        {error && (
          <div className="flex items-center gap-2 mb-3 p-2 rounded-lg bg-red-50 text-red-700 text-sm">
            <AlertCircle size={14} /> {error}
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1" style={{ color: 'var(--izou-text)' }}>
            {action === 'reject' ? 'Rejection Reason *' : 'Notes (optional)'}
          </label>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3}
            className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: 'var(--izou-border)' }} />
        </div>
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 py-2 rounded-lg text-sm font-medium border" style={{ borderColor: 'var(--izou-border)', color: 'var(--izou-text)' }}>Cancel</button>
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

// ─── Request Detail Drawer ────────────────────────────────────────────────────

interface RequestDetailDrawerProps {
  request: ArchiveRequest;
  statusLog: RequestStatusLogEntry[];
  onClose: () => void;
  onAction: (action: 'approve' | 'reject' | 'return') => void;
  isApprover: boolean;
  currentUserId: string;
}

function RequestDetailDrawer({ request, statusLog, onClose, onAction, isApprover, currentUserId }: RequestDetailDrawerProps) {
  const sc = STATUS_CONFIG[request.requestStatus];
  const reqLog = statusLog.filter((l) => l.requestId === request.id);
  const isOverdue = request.expectedReturnDate && request.requestStatus === 'approved' && new Date(request.expectedReturnDate) < new Date();
  const isSameApprover = request.requestStatus === 'pending_second_approval' && request.firstApprovedBy === currentUserId;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white shadow-2xl h-full flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10"
          style={{ borderColor: 'var(--izou-border)' }}>
          <h3 className="text-base font-bold" style={{ color: 'var(--izou-secondary)' }}>Request Detail</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} style={{ color: 'var(--izou-muted)' }} />
          </button>
        </div>

        <div className="p-5 space-y-5 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <StatusBadge label={sc.label} bg={sc.bg} text={sc.text} border={sc.border} large />
            {isOverdue && (
              <StatusBadge label="Overdue" bg="var(--izou-danger-light)" text="var(--izou-danger)" />
            )}
          </div>

          {request.requestStatus === 'pending_second_approval' && (
            <div className="flex items-start gap-2 p-3 rounded-xl text-xs" style={{ backgroundColor: 'var(--izou-highlight-light)', border: '1px solid var(--izou-highlight-light)', color: 'var(--izou-highlight)' }}>
              <Shield size={14} className="shrink-0 mt-0.5" />
              <span>
                This collateral is above the dual-custody threshold. <strong>{request.firstApprovedByProfile?.full_name ?? 'An officer'}</strong> gave
                the first approval on {formatDateTime(request.firstApprovedAt ?? request.createdAt)} — a different officer must approve to check it out.
              </span>
            </div>
          )}

          <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)' }}>
            <p className="text-xs font-medium mb-1" style={{ color: 'var(--izou-muted)' }}>Collateral</p>
            <p className="text-sm font-semibold" style={{ color: 'var(--izou-secondary)' }}>
              {request.collateral?.collateral_type} — {request.collateral?.description}
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>{request.collateral?.obligor}</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Purpose</h3>
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 flex gap-2">
              <Info size={14} className="shrink-0 mt-0.5 text-blue-500" />
              <p className="text-sm text-gray-800">{request.purpose}</p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { label: 'Requested By', value: request.requestedByProfile?.full_name ?? '—', icon: User },
              { label: 'Approved By', value: request.approvedByProfile?.full_name ?? '—', icon: Shield },
              { label: 'Raised On', value: formatDateTime(request.createdAt), icon: Calendar },
              { label: 'Expected Return', value: request.expectedReturnDate ? formatDate(request.expectedReturnDate) : '—', icon: Calendar },
              { label: 'Actual Return', value: request.actualReturnDate ? formatDate(request.actualReturnDate) : '—', icon: Calendar },
            ].map(({ label, value, icon }) => {
              const FieldIcon = icon as React.ElementType;
              return (
                <div key={label} className="flex items-start gap-2">
                  <FieldIcon size={13} className="mt-0.5 shrink-0" style={{ color: 'var(--izou-muted)' }} />
                  <div>
                    <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{label}</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>{value}</p>
                  </div>
                </div>
              );
            })}
            {request.rejectionReason && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--izou-danger-light)', border: '1px solid var(--izou-danger-light)' }}>
                <p className="text-xs font-medium mb-1" style={{ color: 'var(--izou-danger)' }}>Rejection Reason</p>
                <p className="text-sm" style={{ color: 'var(--izou-danger)' }}>{request.rejectionReason}</p>
              </div>
            )}
          </div>

          {reqLog.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: 'var(--izou-text)' }}>Status History</p>
              <div className="space-y-2">
                {reqLog.map((log) => {
                  const newSc = STATUS_CONFIG[log.newStatus as RequestStatus];
                  return (
                    <div key={log.id} className="flex items-center gap-2 p-2.5 rounded-lg"
                      style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)' }}>
                      <StatusBadge label={newSc.label} bg={newSc.bg} text={newSc.text} />
                      <span className="text-xs ml-auto" style={{ color: 'var(--izou-muted)' }}>
                        {formatDateTime(log.createdAt)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {(isApprover && (request.requestStatus === 'pending' || request.requestStatus === 'pending_second_approval')) || request.requestStatus === 'approved' ? (
          <div className="px-5 py-4 border-t" style={{ borderColor: 'var(--izou-border)' }}>
            <div className="flex items-center gap-2">
              {isApprover && (request.requestStatus === 'pending' || request.requestStatus === 'pending_second_approval') && (
                <>
                  <button onClick={() => onAction('approve')} disabled={isSameApprover}
                    title={isSameApprover ? 'A different officer must give the second approval' : undefined}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-green-600">
                    <CheckCircle size={14} /> Approve
                  </button>
                  <button onClick={() => onAction('reject')}
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors">
                    <XCircle size={14} /> Reject
                  </button>
                </>
              )}
              {request.requestStatus === 'approved' && (
                <button onClick={() => onAction('return')}
                  className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white rounded-lg transition-colors"
                  style={{ backgroundColor: 'var(--izou-secondary-mid)' }}>
                  <RotateCcw size={14} /> Mark Returned
                </button>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ActiveTab = 'approvals' | 'my-requests';

export default function AccessRequestsContent() {
  const { user, profile } = useAuth();
  const [activeTab, setActiveTab] = useState<ActiveTab>('approvals');
  const [requests, setRequests] = useState<ArchiveRequest[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [statusLog, setStatusLog] = useState<RequestStatusLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<RequestStatus | 'all'>('all');
  const [showRaiseModal, setShowRaiseModal] = useState(false);
  const [actionModal, setActionModal] = useState<{ request: ArchiveRequest; action: 'approve' | 'reject' | 'return' } | null>(null);
  const [detailRequest, setDetailRequest] = useState<ArchiveRequest | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const isApprover = profile?.role === 'admin' || profile?.role === 'manager' || profile?.role === 'credit_officer';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [r, c, sl] = await Promise.all([
        archiveRequestService.getAll(),
        collateralService.getAll(),
        archiveRequestStatusLogService.getAll(),
      ]);
      setRequests(r);
      setCollaterals(c);
      setStatusLog(sl);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const channel = archiveRequestService.subscribeToChanges(() => { load(); });
    return () => { channel.unsubscribe(); };
  }, [load]);

  // Tab-based filtering
  const tabFiltered = requests.filter((r) => {
    if (activeTab === 'my-requests') return r.requestedBy === user?.id;
    // approvals tab: all requests (approvers see all; others see their own)
    if (!isApprover) return r.requestedBy === user?.id;
    return true;
  });

  const filtered = tabFiltered.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.collateral?.obligor?.toLowerCase().includes(q)
      || r.purpose.toLowerCase().includes(q)
      || r.collateral?.collateral_type?.toLowerCase().includes(q)
      || r.requestedByProfile?.full_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.requestStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = tabFiltered.reduce((acc, r) => {
    acc[r.requestStatus] = (acc[r.requestStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const pendingCount = requests.filter((r) => r.requestStatus === 'pending' || r.requestStatus === 'pending_second_approval').length;
  const myRequestsCount = requests.filter((r) => r.requestedBy === user?.id).length;

  const exportCSV = () => {
    const rows = [
      ['Collateral', 'Obligor', 'Purpose', 'Status', 'Requested By', 'Raised On', 'Expected Return'],
      ...filtered.map((r) => [
        r.collateral?.collateral_type ?? '—',
        r.collateral?.obligor ?? '—',
        r.purpose,
        STATUS_CONFIG[r.requestStatus].label,
        r.requestedByProfile?.full_name ?? '—',
        formatDate(r.createdAt),
        r.expectedReturnDate ? formatDate(r.expectedReturnDate) : '—',
      ]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `access-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--izou-primary)', fontFamily: 'DM Sans, sans-serif' }}>
            Access Requests
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--izou-muted)' }}>
            Raise, approve, and track physical file loan requests
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: 'var(--izou-border)' }}>
            <RefreshCw size={16} style={{ color: 'var(--izou-secondary)' }} />
          </button>
          <button onClick={exportCSV} disabled={filtered.length === 0}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
            style={{ borderColor: 'var(--izou-border)', color: 'var(--izou-secondary)' }}>
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowRaiseModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: 'var(--izou-secondary)' }}>
            <Plus size={16} /> Raise Request
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-xl" style={{ backgroundColor: 'var(--izou-bg)', width: 'fit-content' }}>
        {[
          { id: 'approvals' as ActiveTab, label: 'Pending Approvals', count: pendingCount },
          { id: 'my-requests' as ActiveTab, label: 'My Requests', count: myRequestsCount },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => { setActiveTab(tab.id); setStatusFilter('all'); setSearch(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
            style={activeTab === tab.id
              ? { backgroundColor: 'white', color: 'var(--izou-secondary)', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }
              : { color: 'var(--izou-muted)' }}>
            {tab.label}
            {tab.count > 0 && (
              <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold"
                style={activeTab === tab.id
                  ? { backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)' }
                  : { backgroundColor: 'var(--izou-border)', color: 'var(--izou-muted)' }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-5">
        {(['pending', 'pending_second_approval', 'approved', 'checked_out', 'returned', 'rejected'] as RequestStatus[]).map((s) => {
          const sc = STATUS_CONFIG[s];
          const StatusIcon = sc.icon;
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                backgroundColor: statusFilter === s ? sc.bg : 'var(--izou-bg)',
                border: `1px solid ${statusFilter === s ? sc.border : 'var(--izou-border)'}`,
              }}>
              <StatusIcon size={15} style={{ color: sc.text }} className="mb-1" />
              <p className="text-xl font-bold" style={{ color: sc.text }}>{counts[s] ?? 0}</p>
              <p className="text-xs font-medium" style={{ color: 'var(--izou-muted)' }}>{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--izou-muted)' }} />
        <input value={search} onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ borderColor: 'var(--izou-border)', backgroundColor: 'var(--izou-bg)' }}
          placeholder="Search by collateral, obligor, purpose…" />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Request list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: 'var(--izou-skeleton)' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={40} className="mx-auto mb-3" style={{ color: 'var(--izou-secondary-light)' }} />
          <p className="text-sm font-medium" style={{ color: 'var(--izou-secondary)' }}>
            {activeTab === 'approvals' ? 'No pending approvals' : 'No requests found'}
          </p>
          <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>
            {activeTab === 'my-requests' ? 'Raise a new request to get started' : 'All requests have been processed'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((req) => {
            const sc = STATUS_CONFIG[req.requestStatus];
            const isExpanded = expandedId === req.id;
            const reqLog = statusLog.filter((l) => l.requestId === req.id);
            const isOverdue = req.expectedReturnDate && new Date(req.expectedReturnDate) < new Date() && req.requestStatus === 'approved';

            return (
              <div key={req.id} className="rounded-xl overflow-hidden transition-all"
                style={{ border: `1px solid ${isOverdue ? 'var(--izou-danger-light)' : 'var(--izou-border)'}`, backgroundColor: isOverdue ? 'var(--izou-danger-light)' : 'var(--izou-bg)' }}>
                <div className="flex items-start gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}` }}>
                    {React.createElement(sc.icon, { size: 18, style: { color: sc.text } })}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: 'var(--izou-secondary)' }}>
                        {req.collateral?.collateral_type ?? 'Unknown'} — {req.collateral?.obligor ?? '—'}
                      </p>
                      <StatusBadge label={sc.label} bg={sc.bg} text={sc.text} border={sc.border} />
                      {isOverdue && (
                        <StatusBadge label="OVERDUE" bg="var(--izou-danger-light)" text="var(--izou-danger)" border="var(--izou-danger-light)" />
                      )}
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: 'var(--izou-muted)' }}>{req.purpose}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--izou-muted)' }}>
                        <User size={11} /> {req.requestedByProfile?.full_name ?? '—'}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: 'var(--izou-muted)' }}>
                        <Clock size={11} /> {formatDate(req.createdAt)}
                      </span>
                      {req.expectedReturnDate && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? 'var(--izou-danger)' : 'var(--izou-muted)' }}>
                          <Calendar size={11} /> Due {formatDate(req.expectedReturnDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setDetailRequest(req)}
                      className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      title="View detail" style={{ color: 'var(--izou-secondary)' }}>
                      <Eye size={15} />
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      style={{ color: 'var(--izou-muted)' }}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>
                    {isApprover && (req.requestStatus === 'pending' || req.requestStatus === 'pending_second_approval') && (
                      <>
                        <button onClick={() => setActionModal({ request: req, action: 'approve' })}
                          disabled={req.requestStatus === 'pending_second_approval' && req.firstApprovedBy === user?.id}
                          title={req.requestStatus === 'pending_second_approval' && req.firstApprovedBy === user?.id ? 'A different officer must give the second approval' : undefined}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
                          style={{ backgroundColor: 'var(--izou-success)' }}>
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button onClick={() => setActionModal({ request: req, action: 'reject' })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ backgroundColor: 'var(--izou-danger)' }}>
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                    {req.requestStatus === 'approved' && (
                      <button onClick={() => setActionModal({ request: req, action: 'return' })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ backgroundColor: 'var(--izou-secondary-mid)' }}>
                        <RotateCcw size={12} /> Return
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && reqLog.length > 0 && (
                  <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: 'var(--izou-border)' }}>
                    <p className="text-xs font-semibold mb-2 mt-3" style={{ color: 'var(--izou-text)' }}>Status History</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      {reqLog.map((log, i) => {
                        const newSc = STATUS_CONFIG[log.newStatus as RequestStatus];
                        return (
                          <React.Fragment key={log.id}>
                            {i > 0 && <ArrowRight size={10} style={{ color: 'var(--izou-muted)' }} />}
                            <div className="flex flex-col items-center">
                              <StatusBadge label={newSc.label} bg={newSc.bg} text={newSc.text} />
                              <span className="text-[10px] mt-0.5" style={{ color: 'var(--izou-muted)' }}>
                                {formatDate(log.createdAt)}
                              </span>
                            </div>
                          </React.Fragment>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Detail Drawer */}
      {detailRequest && (
        <RequestDetailDrawer
          request={detailRequest}
          statusLog={statusLog}
          onClose={() => setDetailRequest(null)}
          onAction={(action) => {
            setActionModal({ request: detailRequest, action });
            setDetailRequest(null);
          }}
          isApprover={isApprover}
          currentUserId={user?.id ?? ''}
        />
      )}

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
