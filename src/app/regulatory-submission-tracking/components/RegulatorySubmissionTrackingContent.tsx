'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { FileText, CheckCircle2, Clock, AlertTriangle, Send, Plus, RefreshCw, Filter, Building2, Calendar, Hash, ChevronDown, ChevronUp,  } from 'lucide-react';
import {
  regulatorySubmissionService,
  type RegulatorySubmission,
  type SubmissionStatus,
} from '@/lib/supabase/regulatorySubmissionService';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_CONFIG: Record<SubmissionStatus, { color: string; icon: React.ReactNode; label: string }> = {
  'Pending Generation': { color: 'bg-gray-100 text-gray-600', icon: <Clock size={11} />, label: 'Pending Generation' },
  'Generated':          { color: 'bg-blue-100 text-blue-700', icon: <FileText size={11} />, label: 'Generated' },
  'Submitted':          { color: 'bg-amber-100 text-amber-700', icon: <Send size={11} />, label: 'Submitted' },
  'Acknowledged':       { color: 'bg-green-100 text-green-700', icon: <CheckCircle2 size={11} />, label: 'Acknowledged' },
  'Overdue':            { color: 'bg-red-100 text-red-700', icon: <AlertTriangle size={11} />, label: 'Overdue' },
};

const REGULATORY_BODIES = ['BOT', 'BRELA', 'Internal', 'Other'];
const REPORT_TYPES = ['Quarterly Coverage', 'Monthly Return', 'Registration Compliance', 'Portfolio Risk', 'Other'];

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function daysUntilDue(dueDate: string | null): number | null {
  if (!dueDate) return null;
  return Math.ceil((new Date(dueDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function RegulatorySubmissionTrackingContent() {
  const { userProfile } = useAuth();
  const [submissions, setSubmissions] = useState<RegulatorySubmission[]>([]);
  const [stats, setStats] = useState({ total: 0, pendingGeneration: 0, generated: 0, submitted: 0, acknowledged: 0, overdue: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<SubmissionStatus | 'All'>('All');
  const [filterBody, setFilterBody] = useState<string>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showRefModal, setShowRefModal] = useState<{ id: string; action: 'submit' | 'acknowledge' } | null>(null);
  const [refInput, setRefInput] = useState('');
  const [createForm, setCreateForm] = useState({
    reportName: '', reportType: 'Quarterly Coverage', regulatoryBody: 'BOT',
    reportingPeriod: '', dueDate: '', notes: '',
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [subs, s] = await Promise.all([
        regulatorySubmissionService.list({
          status: filterStatus !== 'All' ? filterStatus : undefined,
          regulatoryBody: filterBody !== 'All' ? filterBody : undefined,
        }),
        regulatorySubmissionService.getStats(),
      ]);
      setSubmissions(subs);
      setStats(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterBody]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!userProfile?.id || !createForm.reportName || !createForm.reportingPeriod) return;
    setActionLoading('create');
    try {
      await regulatorySubmissionService.create({ ...createForm, createdBy: userProfile.id });
      setShowCreateModal(false);
      setCreateForm({ reportName: '', reportType: 'Quarterly Coverage', regulatoryBody: 'BOT', reportingPeriod: '', dueDate: '', notes: '' });
      setSuccessMsg('Submission record created.');
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleMarkGenerated(id: string) {
    if (!userProfile?.id) return;
    setActionLoading(id);
    try {
      let updated = await regulatorySubmissionService.markGenerated(id, userProfile.id);
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setSuccessMsg('Marked as Generated.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleRefAction() {
    if (!showRefModal || !userProfile?.id) return;
    setActionLoading(showRefModal.id);
    try {
      let updated: RegulatorySubmission;
      if (showRefModal.action === 'submit') {
        updated = await regulatorySubmissionService.markSubmitted(showRefModal.id, userProfile.id, refInput || undefined);
        setSuccessMsg('Marked as Submitted.');
      } else {
        updated = await regulatorySubmissionService.markAcknowledged(showRefModal.id, userProfile.id, refInput || undefined);
        setSuccessMsg('Marked as Acknowledged.');
      }
      setSubmissions((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
      setShowRefModal(null);
      setRefInput('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = submissions;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Regulatory Submission Tracking</h1>
          <p className="text-sm text-gray-500 mt-1">
            Track when regulatory reports are generated, submitted, and acknowledged
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <RefreshCw size={14} />
          </button>
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus size={14} />
            New Submission
          </button>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={14} />{error}
          <button className="ml-auto" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 size={14} />{successMsg}
          <button className="ml-auto" onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-900' },
          { label: 'Pending', value: stats.pendingGeneration, color: 'text-gray-600' },
          { label: 'Generated', value: stats.generated, color: 'text-blue-600' },
          { label: 'Submitted', value: stats.submitted, color: 'text-amber-600' },
          { label: 'Acknowledged', value: stats.acknowledged, color: 'text-green-600' },
          { label: 'Overdue', value: stats.overdue, color: 'text-red-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <span className="text-sm text-gray-500">Filter:</span>
        </div>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as any)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Statuses</option>
          {Object.keys(STATUS_CONFIG).map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={filterBody}
          onChange={(e) => setFilterBody(e.target.value)}
          className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="All">All Bodies</option>
          {REGULATORY_BODIES.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="h-20 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <FileText size={40} className="mx-auto mb-3 opacity-30" />
          <p className="text-sm">No submissions found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((sub) => {
            const sc = STATUS_CONFIG[sub.submissionStatus];
            const days = daysUntilDue(sub.dueDate);
            const isExpanded = expandedId === sub.id;
            return (
              <div key={sub.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-900 text-sm truncate">{sub.reportName}</h3>
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                          {sc.icon}{sc.label}
                        </span>
                        {days !== null && days < 0 && sub.submissionStatus !== 'Acknowledged' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
                            <AlertTriangle size={10} />
                            {Math.abs(days)}d overdue
                          </span>
                        )}
                        {days !== null && days >= 0 && days <= 7 && sub.submissionStatus !== 'Acknowledged' && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-700">
                            <Clock size={10} />
                            Due in {days}d
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 flex-wrap">
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Building2 size={11} />{sub.regulatoryBody}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Calendar size={11} />{sub.reportingPeriod}
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Hash size={11} />{sub.reportType}
                        </span>
                        {sub.dueDate && (
                          <span className="text-xs text-gray-500">Due: {formatDate(sub.dueDate)}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sub.submissionStatus === 'Pending Generation' && (
                        <button
                          onClick={() => handleMarkGenerated(sub.id)}
                          disabled={actionLoading === sub.id}
                          className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          Mark Generated
                        </button>
                      )}
                      {sub.submissionStatus === 'Generated' && (
                        <button
                          onClick={() => { setShowRefModal({ id: sub.id, action: 'submit' }); setRefInput(''); }}
                          className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
                        >
                          Mark Submitted
                        </button>
                      )}
                      {sub.submissionStatus === 'Submitted' && (
                        <button
                          onClick={() => { setShowRefModal({ id: sub.id, action: 'acknowledge' }); setRefInput(''); }}
                          className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          Mark Acknowledged
                        </button>
                      )}
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : sub.id)}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    </div>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                      <div>
                        <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Generated</p>
                        <p className="text-gray-700">{formatDateTime(sub.generatedAt)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Submitted</p>
                        <p className="text-gray-700">{formatDateTime(sub.submittedAt)}</p>
                        {sub.submissionRef && <p className="text-gray-500 mt-0.5">Ref: {sub.submissionRef}</p>}
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Acknowledged</p>
                        <p className="text-gray-700">{formatDateTime(sub.acknowledgedAt)}</p>
                        {sub.acknowledgementRef && <p className="text-gray-500 mt-0.5">Ref: {sub.acknowledgementRef}</p>}
                      </div>
                      <div>
                        <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Notes</p>
                        <p className="text-gray-700">{sub.notes || '—'}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">New Regulatory Submission</h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Report Name *</label>
                <input
                  type="text"
                  value={createForm.reportName}
                  onChange={(e) => setCreateForm({ ...createForm, reportName: e.target.value })}
                  placeholder="e.g. BOT Collateral Coverage Report Q3 2026"
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Regulatory Body *</label>
                  <select
                    value={createForm.regulatoryBody}
                    onChange={(e) => setCreateForm({ ...createForm, regulatoryBody: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REGULATORY_BODIES.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Report Type *</label>
                  <select
                    value={createForm.reportType}
                    onChange={(e) => setCreateForm({ ...createForm, reportType: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    {REPORT_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Reporting Period *</label>
                  <input
                    type="text"
                    value={createForm.reportingPeriod}
                    onChange={(e) => setCreateForm({ ...createForm, reportingPeriod: e.target.value })}
                    placeholder="e.g. Q3 2026"
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    value={createForm.dueDate}
                    onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={createForm.notes}
                  onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                  rows={2}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={actionLoading === 'create' || !createForm.reportName || !createForm.reportingPeriod}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'create' ? 'Creating…' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Ref Modal */}
      {showRefModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {showRefModal.action === 'submit' ? 'Mark as Submitted' : 'Mark as Acknowledged'}
              </h2>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {showRefModal.action === 'submit' ? 'Submission Reference (optional)' : 'Acknowledgement Reference (optional)'}
              </label>
              <input
                type="text"
                value={refInput}
                onChange={(e) => setRefInput(e.target.value)}
                placeholder="Enter reference number"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowRefModal(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleRefAction}
                disabled={!!actionLoading}
                className={`px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50 transition-colors ${
                  showRefModal.action === 'submit' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {actionLoading ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
