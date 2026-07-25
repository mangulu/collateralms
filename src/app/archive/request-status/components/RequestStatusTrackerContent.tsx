'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ClipboardList, Search, RefreshCw, AlertCircle, CheckCircle, XCircle,
  Clock, RotateCcw, Filter, Download, Eye, ChevronDown, ChevronUp,
  ArrowRight, User, Calendar, FileText, Shield,
} from 'lucide-react';
import {
  archiveRequestService, archiveAuditService, archiveRequestStatusLogService,
  ArchiveRequest, RequestStatus, RequestStatusLogEntry,
} from '@/lib/supabase/archiveService';
import { collateralService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


const STATUS_CONFIG: Record<RequestStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType }> = {
  pending:     { label: 'Pending',     bg: '#FFFBEB', text: '#B45309', border: '#FDE68A', icon: Clock },
  approved:    { label: 'Approved',    bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: CheckCircle },
  rejected:    { label: 'Rejected',    bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', icon: XCircle },
  checked_out: { label: 'Checked Out', bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: ArrowRight },
  returned:    { label: 'Returned',    bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', icon: RotateCcw },
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
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

// ─── Request Detail Drawer ────────────────────────────────────────────────────

interface RequestDetailDrawerProps {
  request: ArchiveRequest;
  statusLog: RequestStatusLogEntry[];
  onClose: () => void;
}

function RequestDetailDrawer({ request, statusLog, onClose }: RequestDetailDrawerProps) {
  const sc = STATUS_CONFIG[request.requestStatus];
  const reqLog = statusLog.filter((l) => l.requestId === request.id);

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div className="w-full max-w-sm bg-white shadow-2xl h-full flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10"
          style={{ borderColor: '#E5E7EB' }}>
          <h3 className="text-base font-bold" style={{ color: '#1E3A8A' }}>Request Detail</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <XCircle size={16} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Status badge */}
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
              {sc.icon} {sc.label}
            </span>
          </div>

          {/* Collateral info */}
          <div className="p-3 rounded-xl" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
            <p className="text-xs font-medium mb-1" style={{ color: '#9CA3AF' }}>Collateral</p>
            <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>
              {request.collateral?.collateral_type} — {request.collateral?.description}
            </p>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>{request.collateral?.obligor}</p>
          </div>

          {/* Details */}
          <div className="space-y-3">
            {[
              { label: 'Purpose', value: request.purpose, icon: FileText },
              { label: 'Requested By', value: request.requestedByProfile?.full_name ?? '—', icon: User },
              { label: 'Approved By', value: request.approvedByProfile?.full_name ?? '—', icon: Shield },
              { label: 'Raised On', value: formatDateTime(request.createdAt), icon: Calendar },
              { label: 'Expected Return', value: request.expectedReturnDate ? formatDate(request.expectedReturnDate) : '—', icon: Calendar },
              { label: 'Actual Return', value: request.actualReturnDate ? formatDate(request.actualReturnDate) : '—', icon: Calendar },
            ].map(({ label, value, icon: FieldIcon }) => (
              <div key={label} className="flex items-start gap-2">
                <FieldIcon size={13} className="mt-0.5 shrink-0" style={{ color: '#9CA3AF' }} />
                <div>
                  <p className="text-xs" style={{ color: '#9CA3AF' }}>{label}</p>
                  <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>{value}</p>
                </div>
              </div>
            ))}
            {request.rejectionReason && (
              <div className="p-3 rounded-xl" style={{ backgroundColor: '#FFF1F2', border: '1px solid #FECDD3' }}>
                <p className="text-xs font-medium mb-1" style={{ color: '#BE123C' }}>Rejection Reason</p>
                <p className="text-sm" style={{ color: '#BE123C' }}>{request.rejectionReason}</p>
              </div>
            )}
          </div>

          {/* Audit trail */}
          {reqLog.length > 0 && (
            <div>
              <p className="text-xs font-semibold mb-3" style={{ color: '#374151' }}>Status History</p>
              <div className="space-y-2">
                {reqLog.map((log) => {
                  const oldSc = log.oldStatus ? STATUS_CONFIG[log.oldStatus as RequestStatus] : null;
                  const newSc = STATUS_CONFIG[log.newStatus as RequestStatus];
                  return (
                    <div key={log.id} className="flex items-start gap-2 p-2.5 rounded-lg"
                      style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
                      <div className="flex items-center gap-1.5 flex-1 min-w-0 flex-wrap">
                        {oldSc && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full" style={{ backgroundColor: oldSc.bg, color: oldSc.text }}>
                            {oldSc.label}
                          </span>
                        )}
                        {oldSc && <ArrowRight size={10} style={{ color: '#9CA3AF' }} />}
                        <span className="text-xs px-1.5 py-0.5 rounded-full font-semibold" style={{ backgroundColor: newSc.bg, color: newSc.text }}>
                          {newSc.label}
                        </span>
                        <span className="text-xs ml-auto" style={{ color: '#9CA3AF' }}>
                          {formatDateTime(log.createdAt)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RequestStatusTrackerContent() {
  const { user, profile } = useAuth();
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
  const [showFilters, setShowFilters] = useState(false);

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

  // Real-time subscription
  useEffect(() => {
    const channel = archiveRequestService.subscribeToChanges(() => { load(); });
    return () => { channel.unsubscribe(); };
  }, [load]);

  const filtered = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchSearch = !q
      || r.collateral?.obligor?.toLowerCase().includes(q)
      || r.purpose.toLowerCase().includes(q)
      || r.collateral?.collateral_type?.toLowerCase().includes(q)
      || r.requestedByProfile?.full_name?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || r.requestStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = requests.reduce((acc, r) => {
    acc[r.requestStatus] = (acc[r.requestStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const exportCSV = () => {
    const rows = [
      ['ID', 'Collateral', 'Obligor', 'Purpose', 'Status', 'Requested By', 'Approved By', 'Raised On', 'Expected Return', 'Actual Return', 'Rejection Reason'],
      ...filtered.map((r) => [
        r.id.slice(0, 8).toUpperCase(),
        r.collateral?.collateral_type ?? '—',
        r.collateral?.obligor ?? '—',
        r.purpose,
        STATUS_CONFIG[r.requestStatus].label,
        r.requestedByProfile?.full_name ?? '—',
        r.approvedByProfile?.full_name ?? '—',
        formatDateTime(r.createdAt),
        r.expectedReturnDate ? formatDate(r.expectedReturnDate) : '—',
        r.actualReturnDate ? formatDate(r.actualReturnDate) : '—',
        r.rejectionReason ?? '—',
      ]),
    ];
    const csv = rows.map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `archive-requests-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>
            Archive Request Status
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>
            View, filter, approve, and track all archive file requests with full audit trails
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium border"
            style={{ borderColor: '#BFDBFE', color: '#1D4ED8', backgroundColor: showFilters ? '#EFF6FF' : 'white' }}>
            <Filter size={15} /> Filters
          </button>
          <button onClick={load} className="p-2 rounded-lg border" style={{ borderColor: '#BFDBFE' }}>
            <RefreshCw size={16} style={{ color: '#2563EB' }} />
          </button>
          <button onClick={exportCSV} disabled={filtered.length === 0}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border disabled:opacity-50"
            style={{ borderColor: '#BFDBFE', color: '#1D4ED8' }}>
            <Download size={15} /> Export
          </button>
          <button onClick={() => setShowRaiseModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium text-white"
            style={{ backgroundColor: '#2563EB' }}>
            <ClipboardList size={15} /> Raise Request
          </button>
        </div>
      </div>

      {/* KPI summary */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {(['pending', 'approved', 'checked_out', 'returned', 'rejected'] as RequestStatus[]).map((s) => {
          const sc = STATUS_CONFIG[s];
          const Icon = sc.icon;
          return (
            <button key={s} onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                backgroundColor: statusFilter === s ? sc.bg : '#F8FAFF',
                border: `1px solid ${statusFilter === s ? sc.border : '#DBEAFE'}`,
              }}>
              <Icon size={15} style={{ color: sc.text }} className="mb-1" />
              <p className="text-xl font-bold" style={{ color: sc.text }}>{counts[s] ?? 0}</p>
              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* Filters */}
      {showFilters && (
        <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
              <input value={search} onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 rounded-lg border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                style={{ borderColor: '#DBEAFE' }}
                placeholder="Search by collateral, obligor, purpose, officer…" />
            </div>
            <div className="flex gap-2 flex-wrap">
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
          </div>
        </div>
      )}

      {!showFilters && (
        <div className="relative mb-4">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
          <input value={search} onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
            style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
            placeholder="Search by owner, purpose, collateral type…" />
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Request list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
          <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No requests found</p>
          <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>Raise a new request or adjust your filters</p>
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
                style={{ border: `1px solid ${isOverdue ? '#FECDD3' : '#DBEAFE'}`, backgroundColor: isOverdue ? '#FFF5F5' : '#F8FAFF' }}>
                {/* Main row */}
                <div className="flex items-start gap-3 p-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}` }}>
                    {sc.icon} {sc.label}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold" style={{ color: '#1E3A8A' }}>
                        {req.collateral?.collateral_type ?? 'Unknown'} — {req.collateral?.obligor ?? '—'}
                      </p>
                      <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                        style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}>
                        {sc.label}
                      </span>
                      {isOverdue && (
                        <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
                          style={{ backgroundColor: '#FFF1F2', color: '#BE123C', border: '1px solid #FECDD3' }}>
                          OVERDUE
                        </span>
                      )}
                    </div>
                    <p className="text-xs mt-0.5 line-clamp-1" style={{ color: '#6B7280' }}>{req.purpose}</p>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                        <User size={11} /> {req.requestedByProfile?.full_name ?? '—'}
                      </span>
                      <span className="flex items-center gap-1 text-xs" style={{ color: '#9CA3AF' }}>
                        <Clock size={11} /> {formatDate(req.createdAt)}
                      </span>
                      {req.expectedReturnDate && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#BE123C' : '#9CA3AF' }}>
                          <Calendar size={11} /> Due {formatDate(req.expectedReturnDate)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button onClick={() => setDetailRequest(req)}
                      className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      title="View detail" style={{ color: '#2563EB' }}>
                      <Eye size={15} />
                    </button>
                    <button onClick={() => setExpandedId(isExpanded ? null : req.id)}
                      className="p-1.5 rounded-lg hover:bg-blue-100 transition-colors"
                      title="Audit trail" style={{ color: '#6B7280' }}>
                      {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                    </button>

                    {/* Role-based action buttons */}
                    {isApprover && req.requestStatus === 'pending' && (
                      <>
                        <button onClick={() => setActionModal({ request: req, action: 'approve' })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ backgroundColor: '#15803D' }}>
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button onClick={() => setActionModal({ request: req, action: 'reject' })}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                          style={{ backgroundColor: '#BE123C' }}>
                          <XCircle size={12} /> Reject
                        </button>
                      </>
                    )}
                    {req.requestStatus === 'approved' && (
                      <button onClick={() => setActionModal({ request: req, action: 'return' })}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-white"
                        style={{ backgroundColor: '#0369A1' }}>
                        <RotateCcw size={12} /> Return
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded audit trail */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-0 border-t" style={{ borderColor: '#DBEAFE' }}>
                    <p className="text-xs font-semibold mb-2 mt-3" style={{ color: '#374151' }}>
                      Status Audit Trail
                    </p>
                    {reqLog.length === 0 ? (
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>No status changes recorded yet</p>
                    ) : (
                      <div className="flex items-center gap-2 flex-wrap">
                        {reqLog.map((log, i) => {
                          const newSc = STATUS_CONFIG[log.newStatus as RequestStatus];
                          return (
                            <React.Fragment key={log.id}>
                              {i > 0 && <ArrowRight size={10} style={{ color: '#9CA3AF' }} />}
                              <div className="flex flex-col items-center">
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                  style={{ backgroundColor: newSc.bg, color: newSc.text }}>
                                  {newSc.label}
                                </span>
                                <span className="text-[10px] mt-0.5" style={{ color: '#9CA3AF' }}>
                                  {formatDate(log.createdAt)}
                                </span>
                              </div>
                            </React.Fragment>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
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
      {detailRequest && (
        <RequestDetailDrawer
          request={detailRequest}
          statusLog={statusLog}
          onClose={() => setDetailRequest(null)}
        />
      )}
    </div>
  );
}
