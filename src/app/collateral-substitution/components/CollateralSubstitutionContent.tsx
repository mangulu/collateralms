'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Plus, RefreshCw, ChevronDown, ChevronUp, History } from 'lucide-react';
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

const STATUS_COLORS: Record<SubstitutionStatus, string> = {
  Pending: 'bg-amber-100 text-amber-700',
  'Under Review': 'bg-blue-100 text-blue-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Completed: 'bg-gray-100 text-gray-700',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function CollateralSubstitutionContent() {
  const { userProfile } = useAuth();
  const [substitutions, setSubstitutions] = useState<CollateralSubstitution[]>([]);
  const [stats, setStats] = useState({ total: 0, pending: 0, underReview: 0, approved: 0, rejected: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<SubstitutionStatus | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [auditTrail, setAuditTrail] = useState<Record<string, SubstitutionAuditEntry[]>>({});
  const [showAuditId, setShowAuditId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Create modal
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    facilityId: '',
    loanId: '',
    outgoingCollateralId: '',
    incomingCollateralId: '',
    reason: '',
    notes: '',
  });

  // Action modals
  const [showActionModal, setShowActionModal] = useState<{ sub: CollateralSubstitution; action: 'review' | 'approve' | 'reject' | 'complete' } | null>(null);
  const [actionNotes, setActionNotes] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');

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

  const handleAction = async () => {
    if (!showActionModal || !userProfile) return;
    const { sub, action } = showActionModal;
    const statusMap: Record<string, SubstitutionStatus> = {
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
        actionNotes,
        action === 'reject' ? actionNotes : undefined,
        action === 'approve' ? effectiveDate : undefined
      );
      setShowActionModal(null);
      setActionNotes('');
      setEffectiveDate('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = filterStatus === 'All' ? substitutions : substitutions.filter((s) => s.substitutionStatus === filterStatus);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Collateral Substitution</h1>
          <p className="text-sm text-gray-500 mt-0.5">Swap collateral against active facilities with approval chain and audit trail</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500">
            <RefreshCw size={16} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#003c5a' }}
          >
            <Plus size={16} /> New Substitution
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Pending', value: stats.pending, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Under Review', value: stats.underReview, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Approved', value: stats.approved, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Rejected', value: stats.rejected, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
            style={filterStatus === s ? { backgroundColor: '#003c5a' } : {}}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400"><RefreshCw size={24} className="animate-spin mx-auto mb-2" />Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400"><ArrowLeftRight size={32} className="mx-auto mb-2 opacity-40" /><p>No substitution requests found</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Facility', 'Outgoing Collateral', 'Incoming Collateral', 'Reason', 'Requested', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((sub) => (
                <React.Fragment key={sub.id}>
                  <tr className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{sub.facilityId}</div>
                      <div className="text-xs text-gray-400">{sub.requestedByName}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 truncate max-w-[140px]">{sub.outgoingDescription ?? '—'}</div>
                      <div className="text-xs text-gray-400">{sub.outgoingType}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-gray-700 truncate max-w-[140px]">{sub.incomingDescription ?? '—'}</div>
                      <div className="text-xs text-gray-400">{sub.incomingType}</div>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                      <p className="text-gray-700 text-xs line-clamp-2">{sub.reason}</p>
                    </td>
                    <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(sub.requestedAt)}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[sub.substitutionStatus]}`}>
                        {sub.substitutionStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 flex-wrap">
                        {sub.substitutionStatus === 'Pending' && (
                          <button
                            onClick={() => { setShowActionModal({ sub, action: 'review' }); setActionNotes(''); }}
                            className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                          >
                            Review
                          </button>
                        )}
                        {sub.substitutionStatus === 'Under Review' && (
                          <>
                            <button
                              onClick={() => { setShowActionModal({ sub, action: 'approve' }); setActionNotes(''); setEffectiveDate(''); }}
                              className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => { setShowActionModal({ sub, action: 'reject' }); setActionNotes(''); }}
                              className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                            >
                              Reject
                            </button>
                          </>
                        )}
                        {sub.substitutionStatus === 'Approved' && (
                          <button
                            onClick={() => { setShowActionModal({ sub, action: 'complete' }); setActionNotes(''); }}
                            className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
                          >
                            Complete
                          </button>
                        )}
                        <button
                          onClick={() => loadAuditTrail(sub.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                          title="View audit trail"
                        >
                          <History size={14} />
                        </button>
                        <button
                          onClick={() => setExpandedId(expandedId === sub.id ? null : sub.id)}
                          className="p-1 text-gray-400 hover:text-gray-600"
                        >
                          {expandedId === sub.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === sub.id && (
                    <tr>
                      <td colSpan={7} className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                          <div><span className="text-gray-500">Reviewed By:</span> <span className="font-medium">{sub.reviewedBy ?? '—'}</span></div>
                          <div><span className="text-gray-500">Reviewed At:</span> <span className="font-medium">{formatDate(sub.reviewedAt)}</span></div>
                          <div><span className="text-gray-500">Approved By:</span> <span className="font-medium">{sub.approvedByName ?? '—'}</span></div>
                          <div><span className="text-gray-500">Effective Date:</span> <span className="font-medium">{formatDate(sub.effectiveDate)}</span></div>
                          {sub.notes && <div className="col-span-4"><span className="text-gray-500">Notes:</span> {sub.notes}</div>}
                          {sub.rejectionReason && <div className="col-span-4 text-red-600"><span className="font-medium">Rejection Reason:</span> {sub.rejectionReason}</div>}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Audit Trail Modal */}
      {showAuditId && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">Substitution Audit Trail</h2>
              <button onClick={() => setShowAuditId(null)} className="text-gray-400 hover:text-gray-600">✕</button>
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facility ID *</label>
                  <input type="text" value={createForm.facilityId} onChange={(e) => setCreateForm((f) => ({ ...f, facilityId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan ID (UUID)</label>
                  <input type="text" value={createForm.loanId} onChange={(e) => setCreateForm((f) => ({ ...f, loanId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Outgoing Collateral ID</label>
                  <input type="text" value={createForm.outgoingCollateralId} onChange={(e) => setCreateForm((f) => ({ ...f, outgoingCollateralId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Incoming Collateral ID</label>
                  <input type="text" value={createForm.incomingCollateralId} onChange={(e) => setCreateForm((f) => ({ ...f, incomingCollateralId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
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
              <button onClick={handleCreate} disabled={actionLoading || !createForm.facilityId || !createForm.reason} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: '#003c5a' }}>
                {actionLoading ? 'Submitting…' : 'Submit Request'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Action Modal */}
      {showActionModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900 capitalize">{showActionModal.action} Substitution</h2>
            </div>
            <div className="p-6 space-y-4">
              {showActionModal.action === 'approve' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
                  <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              )}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {showActionModal.action === 'reject' ? 'Rejection Reason *' : 'Notes'}
                </label>
                <textarea
                  value={actionNotes}
                  onChange={(e) => setActionNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowActionModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleAction}
                disabled={actionLoading || (showActionModal.action === 'reject' && !actionNotes)}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 ${showActionModal.action === 'reject' ? 'bg-red-600 hover:bg-red-700' : ''}`}
                style={showActionModal.action !== 'reject' ? { backgroundColor: '#003c5a' } : {}}
              >
                {actionLoading ? 'Processing…' : `Confirm ${showActionModal.action}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
