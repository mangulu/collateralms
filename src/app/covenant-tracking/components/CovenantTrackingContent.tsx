'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Scale, AlertTriangle, CheckCircle2, ShieldOff, Plus, RefreshCw, ChevronDown, ChevronUp, TrendingDown } from 'lucide-react';
import {
  listCovenants,
  createCovenant,
  updateCovenantMeasurement,
  waiveCovenant,
  getCovenantStats,
  type LoanCovenant,
  type CovenantStatus,
  type CovenantType,
} from '@/lib/supabase/covenantService';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_COLORS: Record<CovenantStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Breached: 'bg-red-100 text-red-700',
  Waived: 'bg-amber-100 text-amber-700',
  Expired: 'bg-gray-100 text-gray-500',
};

const STATUS_ICONS: Record<CovenantStatus, React.ReactNode> = {
  Active: <CheckCircle2 size={12} />,
  Breached: <AlertTriangle size={12} />,
  Waived: <ShieldOff size={12} />,
  Expired: <Scale size={12} />,
};

const COVENANT_TYPES: CovenantType[] = [
  'Financial Ratio', 'Insurance Requirement', 'Reporting Obligation', 'Operational', 'Legal', 'Other',
];

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function daysUntil(d: string | null): number | null {
  if (!d) return null;
  return Math.ceil((new Date(d).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
}

export default function CovenantTrackingContent() {
  const { userProfile } = useAuth();
  const [covenants, setCovenants] = useState<LoanCovenant[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, breached: 0, waived: 0, expired: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<CovenantStatus | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showMeasureModal, setShowMeasureModal] = useState<LoanCovenant | null>(null);
  const [showWaiveModal, setShowWaiveModal] = useState<LoanCovenant | null>(null);

  const [createForm, setCreateForm] = useState({
    loanId: '',
    facilityId: '',
    covenantName: '',
    covenantType: 'Financial Ratio' as CovenantType,
    description: '',
    thresholdValue: '',
    thresholdUnit: '',
    nextReviewDate: '',
    autoFlag: true,
  });

  const [measureForm, setMeasureForm] = useState({
    currentValue: '',
    measurementDate: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const [waiverNotes, setWaiverNotes] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        listCovenants(filterStatus !== 'All' ? { status: filterStatus } : undefined),
        getCovenantStats(),
      ]);
      setCovenants(data);
      setStats(s);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load covenants');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    if (!createForm.loanId || !createForm.covenantName) return;
    setActionLoading(true);
    try {
      await createCovenant({
        loanId: createForm.loanId,
        facilityId: createForm.facilityId || undefined,
        covenantName: createForm.covenantName,
        covenantType: createForm.covenantType,
        description: createForm.description || undefined,
        thresholdValue: createForm.thresholdValue ? parseFloat(createForm.thresholdValue) : undefined,
        thresholdUnit: createForm.thresholdUnit || undefined,
        nextReviewDate: createForm.nextReviewDate || undefined,
        autoFlag: createForm.autoFlag,
        createdBy: userProfile?.id,
      });
      setShowCreateModal(false);
      setCreateForm({ loanId: '', facilityId: '', covenantName: '', covenantType: 'Financial Ratio', description: '', thresholdValue: '', thresholdUnit: '', nextReviewDate: '', autoFlag: true });
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleMeasure = async () => {
    if (!showMeasureModal || !measureForm.currentValue) return;
    setActionLoading(true);
    try {
      await updateCovenantMeasurement(showMeasureModal.id, {
        currentValue: parseFloat(measureForm.currentValue),
        measurementDate: measureForm.measurementDate,
        notes: measureForm.notes,
      });
      setShowMeasureModal(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleWaive = async () => {
    if (!showWaiveModal || !waiverNotes) return;
    setActionLoading(true);
    try {
      await waiveCovenant(showWaiveModal.id, waiverNotes);
      setShowWaiveModal(null);
      setWaiverNotes('');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const filtered = filterStatus === 'All' ? covenants : covenants.filter((c) => c.covenantStatus === filterStatus);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Covenant Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Monitor loan covenants and receive automatic breach alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#003c5a' }}
          >
            <Plus size={16} /> Add Covenant
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {/* Breach Banner */}
      {stats.breached > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
          <AlertTriangle size={20} className="text-red-600 shrink-0" />
          <div>
            <div className="font-semibold text-red-800">{stats.breached} Covenant{stats.breached > 1 ? 's' : ''} in Breach</div>
            <div className="text-sm text-red-600">Immediate attention required. Review breached covenants and initiate remediation.</div>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-600', bg: 'bg-gray-50' },
          { label: 'Active', value: stats.active, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Breached', value: stats.breached, color: 'text-red-600', bg: 'bg-red-50' },
          { label: 'Waived', value: stats.waived, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Expired', value: stats.expired, color: 'text-gray-500', bg: 'bg-gray-50' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4`}>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-xs text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Active', 'Breached', 'Waived', 'Expired'] as const).map((s) => (
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
          <div className="p-12 text-center text-gray-400"><Scale size={32} className="mx-auto mb-2 opacity-40" /><p>No covenants found</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Covenant', 'Facility / Loan', 'Type', 'Threshold', 'Current Value', 'Next Review', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const days = daysUntil(c.nextReviewDate);
                const isBreached = c.covenantStatus === 'Breached';
                const reviewSoon = days !== null && days <= 14 && days >= 0;
                return (
                  <React.Fragment key={c.id}>
                    <tr className={`hover:bg-gray-50 ${isBreached ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{c.covenantName}</div>
                        <div className="text-xs text-gray-400 truncate max-w-[160px]">{c.description}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700">{c.loanNumber ?? '—'}</div>
                        <div className="text-xs text-gray-400">{c.obligorName}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-600 text-xs">{c.covenantType}</td>
                      <td className="px-4 py-3">
                        {c.thresholdValue != null ? (
                          <span className="font-medium text-gray-900">{c.thresholdValue} {c.thresholdUnit ?? ''}</span>
                        ) : <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {c.currentValue != null ? (
                          <div className="flex items-center gap-1">
                            {isBreached && <TrendingDown size={12} className="text-red-500" />}
                            <span className={`font-medium ${isBreached ? 'text-red-600' : 'text-gray-900'}`}>
                              {c.currentValue} {c.thresholdUnit ?? ''}
                            </span>
                          </div>
                        ) : <span className="text-gray-400">Not measured</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className={`text-xs ${reviewSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}`}>
                          {formatDate(c.nextReviewDate)}
                          {reviewSoon && <span className="ml-1">({days}d)</span>}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium w-fit ${STATUS_COLORS[c.covenantStatus]}`}>
                          {STATUS_ICONS[c.covenantStatus]} {c.covenantStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => { setShowMeasureModal(c); setMeasureForm({ currentValue: '', measurementDate: new Date().toISOString().split('T')[0], notes: '' }); }}
                            className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                          >
                            Update
                          </button>
                          {(c.covenantStatus === 'Breached' || c.covenantStatus === 'Active') && (
                            <button
                              onClick={() => { setShowWaiveModal(c); setWaiverNotes(''); }}
                              className="px-2 py-1 text-xs rounded bg-amber-100 text-amber-700 hover:bg-amber-200"
                            >
                              Waive
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            {expandedId === c.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === c.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-gray-500">Measurement Date:</span> <span className="font-medium">{formatDate(c.measurementDate)}</span></div>
                            <div><span className="text-gray-500">Auto-Flag:</span> <span className="font-medium">{c.autoFlag ? 'Yes' : 'No'}</span></div>
                            <div><span className="text-gray-500">Breach Date:</span> <span className="font-medium text-red-600">{formatDate(c.breachDate)}</span></div>
                            <div><span className="text-gray-500">Waiver Date:</span> <span className="font-medium">{formatDate(c.waiverDate)}</span></div>
                            {c.breachNotes && <div className="col-span-4 text-red-600"><span className="font-medium">Breach Notes:</span> {c.breachNotes}</div>}
                            {c.waiverNotes && <div className="col-span-4 text-amber-700"><span className="font-medium">Waiver Notes:</span> {c.waiverNotes}</div>}
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold text-gray-900">Add Covenant</h2></div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Loan ID (UUID) *</label>
                  <input type="text" value={createForm.loanId} onChange={(e) => setCreateForm((f) => ({ ...f, loanId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Facility ID</label>
                  <input type="text" value={createForm.facilityId} onChange={(e) => setCreateForm((f) => ({ ...f, facilityId: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Covenant Name *</label>
                <input type="text" value={createForm.covenantName} onChange={(e) => setCreateForm((f) => ({ ...f, covenantName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select value={createForm.covenantType} onChange={(e) => setCreateForm((f) => ({ ...f, covenantType: e.target.value as CovenantType }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {COVENANT_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Next Review Date</label>
                  <input type="date" value={createForm.nextReviewDate} onChange={(e) => setCreateForm((f) => ({ ...f, nextReviewDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Threshold Value</label>
                  <input type="number" step="0.01" value={createForm.thresholdValue} onChange={(e) => setCreateForm((f) => ({ ...f, thresholdValue: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit (e.g. ratio, %)</label>
                  <input type="text" value={createForm.thresholdUnit} onChange={(e) => setCreateForm((f) => ({ ...f, thresholdUnit: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea value={createForm.description} onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={createForm.autoFlag} onChange={(e) => setCreateForm((f) => ({ ...f, autoFlag: e.target.checked }))} className="rounded" />
                Auto-flag breach when current value falls below threshold
              </label>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleCreate} disabled={actionLoading || !createForm.loanId || !createForm.covenantName} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: '#003c5a' }}>
                {actionLoading ? 'Adding…' : 'Add Covenant'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Measure Modal */}
      {showMeasureModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Update Measurement</h2>
              <p className="text-sm text-gray-500 mt-0.5">{showMeasureModal.covenantName}</p>
              {showMeasureModal.thresholdValue != null && (
                <p className="text-xs text-gray-400 mt-0.5">Threshold: {showMeasureModal.thresholdValue} {showMeasureModal.thresholdUnit ?? ''}</p>
              )}
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Current Value *</label>
                  <input type="number" step="0.0001" value={measureForm.currentValue} onChange={(e) => setMeasureForm((f) => ({ ...f, currentValue: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Measurement Date</label>
                  <input type="date" value={measureForm.measurementDate} onChange={(e) => setMeasureForm((f) => ({ ...f, measurementDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={measureForm.notes} onChange={(e) => setMeasureForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowMeasureModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleMeasure} disabled={actionLoading || !measureForm.currentValue} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: '#003c5a' }}>
                {actionLoading ? 'Saving…' : 'Save Measurement'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Waive Modal */}
      {showWaiveModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold text-gray-900">Waive Covenant</h2></div>
            <div className="p-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Waiver Notes *</label>
              <textarea value={waiverNotes} onChange={(e) => setWaiverNotes(e.target.value)} rows={3} placeholder="Provide justification for waiver…" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400" />
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowWaiveModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleWaive} disabled={actionLoading || !waiverNotes} className="px-4 py-2 text-sm text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                {actionLoading ? 'Waiving…' : 'Confirm Waiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
