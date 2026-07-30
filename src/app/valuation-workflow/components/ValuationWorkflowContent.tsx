'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { CalendarClock, CheckCircle2, Clock, AlertTriangle, Plus, RefreshCw, ChevronDown, ChevronUp, Eye } from 'lucide-react';
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

const STATUS_COLORS: Record<ValuationStatus, string> = {
  Scheduled: 'bg-blue-100 text-blue-700',
  'In Progress': 'bg-amber-100 text-amber-700',
  Completed: 'bg-purple-100 text-purple-700',
  Approved: 'bg-green-100 text-green-700',
  Rejected: 'bg-red-100 text-red-700',
  Overdue: 'bg-red-200 text-red-800',
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

export default function ValuationWorkflowContent() {
  const { userProfile } = useAuth();
  const searchParams = useSearchParams();
  const [valuations, setValuations] = useState<CollateralValuation[]>([]);
  const [stats, setStats] = useState({ total: 0, scheduled: 0, overdue: 0, pendingApproval: 0, approved: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ValuationStatus | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Lookup data
  const [collateralOptions, setCollateralOptions] = useState<CollateralOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // Modals
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [showRecordModal, setShowRecordModal] = useState<CollateralValuation | null>(null);
  const [showRejectModal, setShowRejectModal] = useState<CollateralValuation | null>(null);
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

  // Record form
  const [recordForm, setRecordForm] = useState({
    completedDate: new Date().toISOString().split('T')[0],
    valuationAmount: '',
    reportReference: '',
    notes: '',
  });

  const [rejectReason, setRejectReason] = useState('');

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

  // Handle contextual pre-fill from URL params
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
      await createValuation({
        ...scheduleForm,
        createdBy: userProfile?.id,
      });
      setShowScheduleModal(false);
      setScheduleForm({ collateralId: '', valuationType: 'Full Valuation', scheduledDate: '', valuerName: '', valuerFirm: '', valuationMethod: 'Market Value', notes: '' });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecord = async () => {
    if (!showRecordModal || !recordForm.valuationAmount) return;
    setActionLoading(true);
    try {
      await recordValuationResult(showRecordModal.id, {
        completedDate: recordForm.completedDate,
        valuationAmount: parseFloat(recordForm.valuationAmount),
        reportReference: recordForm.reportReference,
        notes: recordForm.notes,
      });
      setShowRecordModal(null);
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
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!showRejectModal || !rejectReason) return;
    setActionLoading(true);
    try {
      await rejectValuation(showRejectModal.id, rejectReason);
      setShowRejectModal(null);
      setRejectReason('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = filterStatus === 'All' ? valuations : valuations.filter((v) => v.valuationStatus === filterStatus);

  const collateralSelectOptions: SelectOption[] = collateralOptions.map((c) => ({
    value: c.id,
    label: c.collateralId,
    sublabel: `${c.description} · ${c.type}`,
    badge: c.facilityId,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Valuation Workflow</h1>
          <p className="text-sm text-gray-500 mt-0.5">Schedule, record, and approve collateral revaluations</p>
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

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: CalendarClock, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Scheduled', value: stats.scheduled, icon: Clock, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Overdue', value: stats.overdue, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Pending Approval', value: stats.pendingApproval, icon: Eye, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Approved', value: stats.approved, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 flex items-center gap-3`}>
            <k.icon size={20} className={k.color} />
            <div>
              <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Scheduled', 'Overdue', 'In Progress', 'Completed', 'Approved', 'Rejected'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s
                ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
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
          <div className="p-12 text-center text-gray-400">
            <RefreshCw size={24} className="animate-spin mx-auto mb-2" />
            Loading valuations…
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <CalendarClock size={32} className="mx-auto mb-2 opacity-40" />
            <p>No valuations found</p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Collateral', 'Type', 'Scheduled', 'Valuer', 'Amount', 'Status', 'Aging', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v) => {
                const isOverdue = v.valuationStatus === 'Overdue';
                const aging = agingDays(v.scheduledDate);
                return (
                  <React.Fragment key={v.id}>
                    <tr className={`hover:bg-gray-50 ${isOverdue ? 'bg-red-50/40' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 truncate max-w-[160px]">{v.collateralDescription ?? '—'}</div>
                        <div className="text-xs text-gray-400">{v.collateralType}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{v.valuationType}</td>
                      <td className="px-4 py-3 text-gray-700">{formatDate(v.scheduledDate)}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{v.valuerName ?? '—'}</div>
                        <div className="text-xs text-gray-400">{v.valuerFirm}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{formatCurrency(v.valuationAmount)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[v.valuationStatus]}`}>
                          {v.valuationStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {isOverdue ? (
                          <span className="flex items-center gap-1 text-red-600 text-xs font-medium">
                            <AlertTriangle size={12} /> {aging}d overdue
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">{formatDate(v.scheduledDate)}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          {(v.valuationStatus === 'Scheduled' || v.valuationStatus === 'Overdue' || v.valuationStatus === 'In Progress') && (
                            <button
                              onClick={() => { setShowRecordModal(v); setRecordForm({ completedDate: new Date().toISOString().split('T')[0], valuationAmount: '', reportReference: '', notes: '' }); }}
                              className="px-2 py-1 text-xs rounded bg-purple-100 text-purple-700 hover:bg-purple-200"
                            >
                              Record
                            </button>
                          )}
                          {v.valuationStatus === 'Completed' && (
                            <>
                              <button
                                onClick={() => handleApprove(v)}
                                disabled={actionLoading}
                                className="px-2 py-1 text-xs rounded bg-green-100 text-green-700 hover:bg-green-200"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => { setShowRejectModal(v); setRejectReason(''); }}
                                className="px-2 py-1 text-xs rounded bg-red-100 text-red-700 hover:bg-red-200"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            onClick={() => setExpandedId(expandedId === v.id ? null : v.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            {expandedId === v.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === v.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-gray-500">Method:</span> <span className="font-medium">{v.valuationMethod}</span></div>
                            <div><span className="text-gray-500">Completed:</span> <span className="font-medium">{formatDate(v.completedDate)}</span></div>
                            <div><span className="text-gray-500">Report Ref:</span> <span className="font-medium">{v.reportReference ?? '—'}</span></div>
                            <div><span className="text-gray-500">Approved At:</span> <span className="font-medium">{formatDate(v.approvedAt)}</span></div>
                            {v.notes && <div className="col-span-4"><span className="text-gray-500">Notes:</span> <span>{v.notes}</span></div>}
                            {v.rejectionReason && <div className="col-span-4 text-red-600"><span className="font-medium">Rejection Reason:</span> {v.rejectionReason}</div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

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
                  <select
                    value={scheduleForm.valuationType}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, valuationType: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {VALUATION_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled Date *</label>
                  <input
                    type="date"
                    value={scheduleForm.scheduledDate}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuer Name</label>
                  <input
                    type="text"
                    value={scheduleForm.valuerName}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, valuerName: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valuer Firm</label>
                  <input
                    type="text"
                    value={scheduleForm.valuerFirm}
                    onChange={(e) => setScheduleForm((f) => ({ ...f, valuerFirm: e.target.value }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Valuation Method</label>
                <select
                  value={scheduleForm.valuationMethod}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, valuationMethod: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {VALUATION_METHODS.map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={scheduleForm.notes}
                  onChange={(e) => setScheduleForm((f) => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowScheduleModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleSchedule}
                disabled={actionLoading || !scheduleForm.collateralId || !scheduleForm.scheduledDate}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#003c5a' }}
              >
                {actionLoading ? 'Scheduling…' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Record Result Modal */}
      {showRecordModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Record Valuation Result</h2>
              <p className="text-sm text-gray-500 mt-0.5">{showRecordModal.collateralDescription}</p>
            </div>
            <div className="p-6 space-y-4">
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
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowRecordModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleRecord}
                disabled={actionLoading || !recordForm.valuationAmount}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#003c5a' }}
              >
                {actionLoading ? 'Saving…' : 'Save Result'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Reject Valuation</h2>
            </div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rejection Reason *</label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={3}
                placeholder="Provide reason for rejection…"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400"
              />
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowRejectModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleReject}
                disabled={actionLoading || !rejectReason}
                className="px-4 py-2 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {actionLoading ? 'Rejecting…' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
