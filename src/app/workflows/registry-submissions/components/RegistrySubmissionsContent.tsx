'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { FileText, RefreshCw, Loader2, AlertTriangle, CheckCircle2, Clock, ArrowRight, XCircle, Filter, Search, Building2, Calendar, SquareCheck, Square, AlertCircle, ExternalLink, X, Send,  } from 'lucide-react';
import {
  registrySubmissionTrackerService,
  RegistrySubmission,
  RegistrySubmissionStatus,
  PerfectionRegistryName,
  REGISTRY_NAMES,
  REGISTRY_STATUS_FLOW,
} from '@/lib/supabase/registrySubmissionTrackerService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';


// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RegistrySubmissionStatus, {
  label: string; color: string; bg: string; border: string; icon: React.ElementType;
}> = {
  Pending:      { label: 'Pending',      color: 'text-gray-600',  bg: 'bg-gray-100',  border: 'border-gray-300',  icon: Clock },
  Submitted:    { label: 'Submitted',    color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-300',  icon: ArrowRight },
  Acknowledged: { label: 'Acknowledged', color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-300', icon: CheckCircle2 },
  Registered:   { label: 'Registered',   color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-300', icon: CheckCircle2 },
  Rejected:     { label: 'Rejected',     color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-300',   icon: XCircle },
};

// Overdue threshold in days (submitted but no acknowledgement)
const OVERDUE_THRESHOLD_DAYS = 7;

function isOverdue(submission: RegistrySubmission): boolean {
  if (submission.submissionStatus !== 'Submitted') return false;
  if (!submission.submittedAt) return false;
  const daysSince = (Date.now() - new Date(submission.submittedAt).getTime()) / (1000 * 60 * 60 * 24);
  return daysSince > OVERDUE_THRESHOLD_DAYS;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: RegistrySubmissionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Bulk Status Update Modal ─────────────────────────────────────────────────

function BulkUpdateModal({
  selectedIds,
  onClose,
  onDone,
}: {
  selectedIds: string[];
  onClose: () => void;
  onDone: () => void;
}) {
  const { user } = useAuth();
  const [targetStatus, setTargetStatus] = useState<RegistrySubmissionStatus>('Submitted');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const userName = (user as any)?.user_metadata?.full_name ?? user?.email ?? 'Unknown';

  const handleConfirm = async () => {
    setSaving(true);
    setError('');
    try {
      await registrySubmissionTrackerService.bulkUpdateStatus({
        ids: selectedIds,
        newStatus: targetStatus,
        userId: user?.id,
        userName,
        notes: notes || undefined,
      });
      onDone();
    } catch (err: any) {
      setError(err.message ?? 'Bulk update failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-base font-700 text-foreground">Bulk Status Update</h3>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-4">
          Updating <span className="font-700 text-foreground">{selectedIds.length}</span> submission{selectedIds.length !== 1 ? 's' : ''} to a new status.
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">New Status</label>
            <select
              value={targetStatus}
              onChange={(e) => setTargetStatus(e.target.value as RegistrySubmissionStatus)}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              {REGISTRY_STATUS_FLOW.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Reason for bulk update…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>
        {error && <p className="text-xs text-red-600 mt-3">{error}</p>}
        <div className="flex items-center gap-2 justify-end mt-5 pt-4 border-t border-border">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {saving ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            {saving ? 'Updating…' : 'Apply Update'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Submission Row ───────────────────────────────────────────────────────────

function SubmissionRow({
  submission,
  selected,
  onToggle,
}: {
  submission: RegistrySubmission;
  selected: boolean;
  onToggle: () => void;
}) {
  const overdue = isOverdue(submission);

  return (
    <tr className={`border-b border-border hover:bg-muted/30 transition-colors ${overdue ? 'bg-amber-50/40' : ''}`}>
      <td className="px-4 py-3">
        <button onClick={onToggle} className="text-muted-foreground hover:text-primary transition-colors">
          {selected ? <SquareCheck size={16} className="text-primary" /> : <Square size={16} />}
        </button>
      </td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-600 text-foreground">{submission.registryName}</span>
          {overdue && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 text-[10px] font-600 border border-amber-300">
              <AlertCircle size={9} /> Overdue
            </span>
          )}
        </div>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs font-mono text-muted-foreground">{submission.collateralRecordId.slice(0, 8)}…</span>
      </td>
      <td className="px-4 py-3">
        <StatusBadge status={submission.submissionStatus} />
      </td>
      <td className="px-4 py-3">
        {submission.submissionRef || submission.registrationRef ? (
          <span className="text-xs font-mono text-primary">
            {submission.registrationRef ?? submission.submissionRef}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground italic">—</span>
        )}
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">
          {submission.submittedAt
            ? new Date(submission.submittedAt).toLocaleDateString()
            : new Date(submission.createdAt).toLocaleDateString()}
        </span>
      </td>
      <td className="px-4 py-3">
        <span className="text-xs text-muted-foreground">{submission.createdByName ?? '—'}</span>
      </td>
      <td className="px-4 py-3">
        <Link
          href={`/collateral-detail/${submission.collateralRecordId}?tab=registry`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline font-500"
        >
          View <ExternalLink size={11} />
        </Link>
      </td>
    </tr>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function RegistrySubmissionsContent() {
  const { user } = useAuth();
  const [submissions, setSubmissions] = useState<RegistrySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  // Filters
  const [filterRegistry, setFilterRegistry] = useState<PerfectionRegistryName | ''>('');
  const [filterStatus, setFilterStatus] = useState<RegistrySubmissionStatus | ''>('');
  const [filterFromDate, setFilterFromDate] = useState('');
  const [filterToDate, setFilterToDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  // Selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showBulkModal, setShowBulkModal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await registrySubmissionTrackerService.listAll({
        registryName: filterRegistry || undefined,
        status: filterStatus || undefined,
        fromDate: filterFromDate || undefined,
        toDate: filterToDate || undefined,
      });
      setSubmissions(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err.message ?? 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  }, [filterRegistry, filterStatus, filterFromDate, filterToDate]);

  useEffect(() => { load(); }, [load]);

  // Client-side search filter
  const filtered = submissions.filter((s) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      s.registryName.toLowerCase().includes(q) ||
      s.collateralRecordId.toLowerCase().includes(q) ||
      (s.submissionRef ?? '').toLowerCase().includes(q) ||
      (s.registrationRef ?? '').toLowerCase().includes(q) ||
      (s.createdByName ?? '').toLowerCase().includes(q)
    );
  });

  const overdueCount = filtered.filter(isOverdue).length;

  // KPI counts
  const kpis = {
    total: filtered.length,
    pending: filtered.filter((s) => s.submissionStatus === 'Pending').length,
    submitted: filtered.filter((s) => s.submissionStatus === 'Submitted').length,
    acknowledged: filtered.filter((s) => s.submissionStatus === 'Acknowledged').length,
    registered: filtered.filter((s) => s.submissionStatus === 'Registered').length,
    rejected: filtered.filter((s) => s.submissionStatus === 'Rejected').length,
  };

  const allSelected = filtered.length > 0 && filtered.every((s) => selectedIds.has(s.id));
  const someSelected = selectedIds.size > 0;

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map((s) => s.id)));
    }
  };

  const toggleOne = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearFilters = () => {
    setFilterRegistry('');
    setFilterStatus('');
    setFilterFromDate('');
    setFilterToDate('');
    setSearchQuery('');
  };

  const hasFilters = filterRegistry || filterStatus || filterFromDate || filterToDate || searchQuery;

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-xl font-800 text-foreground">Registry Submissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cross-collateral tracking of perfection submissions across all registries
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            Last updated: {lastRefreshed.toLocaleTimeString()}
          </span>
          <button
            onClick={load}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Overdue Alert Strip */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-300 rounded-xl">
          <AlertCircle size={18} className="text-amber-600 shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-700 text-amber-800">
              {overdueCount} Overdue Submission{overdueCount !== 1 ? 's' : ''}
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Submissions in "Submitted" status for more than {OVERDUE_THRESHOLD_DAYS} days without acknowledgement.
              Follow up with the respective registry.
            </p>
          </div>
          <button
            onClick={() => { setFilterStatus('Submitted'); }}
            className="shrink-0 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-xs font-600 hover:bg-amber-700 transition-colors"
          >
            Filter Overdue
          </button>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Total', value: kpis.total, color: 'text-foreground', bg: 'bg-muted/30', border: 'border-border' },
          { label: 'Pending', value: kpis.pending, color: 'text-gray-700', bg: 'bg-gray-50', border: 'border-gray-200' },
          { label: 'Submitted', value: kpis.submitted, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
          { label: 'Acknowledged', value: kpis.acknowledged, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
          { label: 'Registered', value: kpis.registered, color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200' },
          { label: 'Rejected', value: kpis.rejected, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
        ].map((kpi) => (
          <button
            key={kpi.label}
            onClick={() => setFilterStatus(kpi.label === 'Total' ? '' : kpi.label as RegistrySubmissionStatus)}
            className={`p-3 rounded-xl border ${kpi.bg} ${kpi.border} text-left hover:shadow-sm transition-all`}
          >
            <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-2xl font-800 ${kpi.color}`}>{kpi.value}</p>
          </button>
        ))}
      </div>

      {/* Filters Row */}
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Filter size={14} className="text-muted-foreground" />
          <span className="text-xs font-600 text-foreground uppercase tracking-wide">Filters</span>
          {hasFilters && (
            <button onClick={clearFilters} className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
              <X size={12} /> Clear all
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="relative lg:col-span-2">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by registry, ref, officer…"
              className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          {/* Registry */}
          <div className="relative">
            <Building2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={filterRegistry}
              onChange={(e) => setFilterRegistry(e.target.value as PerfectionRegistryName | '')}
              className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none bg-white"
            >
              <option value="">All Registries</option>
              {REGISTRY_NAMES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          {/* Status */}
          <div className="relative">
            <CheckCircle2 size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as RegistrySubmissionStatus | '')}
              className="w-full pl-8 pr-3 py-2 border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 appearance-none bg-white"
            >
              <option value="">All Statuses</option>
              {REGISTRY_STATUS_FLOW.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          {/* Date Range */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Calendar size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="date"
                value={filterFromDate}
                onChange={(e) => setFilterFromDate(e.target.value)}
                className="w-full pl-8 pr-2 py-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <span className="text-xs text-muted-foreground shrink-0">to</span>
            <div className="relative flex-1">
              <input
                type="date"
                value={filterToDate}
                onChange={(e) => setFilterToDate(e.target.value)}
                className="w-full px-2 py-2 border border-border rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {someSelected && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-xl">
          <span className="text-sm font-600 text-primary">{selectedIds.size} selected</span>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-600 hover:bg-primary/90 transition-colors"
          >
            <Send size={12} /> Bulk Update Status
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Clear selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-2">
              <Loader2 size={22} className="animate-spin text-primary" />
              <p className="text-xs text-muted-foreground">Loading submissions…</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-6">
            <AlertTriangle size={16} className="text-red-600 shrink-0" />
            <p className="text-sm text-red-700">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <FileText size={20} className="text-primary" />
            </div>
            <div className="text-center">
              <p className="text-sm font-600 text-foreground">No submissions found</p>
              <p className="text-xs text-muted-foreground mt-1">
                {hasFilters ? 'Try adjusting your filters.' : 'Registry submissions will appear here once created from collateral records.'}
              </p>
            </div>
            {hasFilters && (
              <button onClick={clearFilters} className="text-xs text-primary hover:underline">Clear filters</button>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-3 text-left w-10">
                    <button onClick={toggleAll} className="text-muted-foreground hover:text-primary transition-colors">
                      {allSelected ? <SquareCheck size={16} className="text-primary" /> : <Square size={16} />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">Registry</th>
                  <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">Collateral ID</th>
                  <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">Reference</th>
                  <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">Date</th>
                  <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">Officer</th>
                  <th className="px-4 py-3 text-left text-xs font-600 text-muted-foreground uppercase tracking-wide">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((submission) => (
                  <SubmissionRow
                    key={submission.id}
                    submission={submission}
                    selected={selectedIds.has(submission.id)}
                    onToggle={() => toggleOne(submission.id)}
                  />
                ))}
              </tbody>
            </table>
            <div className="px-4 py-3 border-t border-border bg-muted/20">
              <p className="text-xs text-muted-foreground">
                Showing {filtered.length} of {submissions.length} submission{submissions.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Bulk Update Modal */}
      {showBulkModal && (
        <BulkUpdateModal
          selectedIds={Array.from(selectedIds)}
          onClose={() => setShowBulkModal(false)}
          onDone={() => {
            setShowBulkModal(false);
            setSelectedIds(new Set());
            load();
          }}
        />
      )}
    </div>
  );
}
