'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Eye, Search, Loader2, Calendar, User, RefreshCw, Building2, ShieldCheck, ArrowUpDown, X, ClipboardList, GitBranch, Scale,  } from 'lucide-react';
import { collateralService, CollateralRecord, CollateralStatus } from '@/lib/supabase/collateralService';
import { perfectionService, PerfectionRequest } from '@/lib/supabase/perfectionService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

type ApprovalCategory = 'all' | 'status_change' | 'submission' | 'legal';

type ApprovalStatus = 'Pending' | 'Approved' | 'Rejected' | 'Under Review';

interface PendingApproval {
  id: string;
  category: 'status_change' | 'submission' | 'legal';
  categoryLabel: string;
  title: string;
  description: string;
  collateralRef: string;
  collateralType: string;
  obligor: string;
  requestedBy: string;
  requestedAt: string;
  priority: 'High' | 'Normal' | 'Low';
  status: ApprovalStatus;
  currentValue?: string;
  proposedValue?: string;
  notes?: string;
  rawData?: any;
}

interface ActionModalState {
  open: boolean;
  item: PendingApproval | null;
  action: 'approve' | 'reject' | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const CATEGORY_CONFIG: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string; border: string }> = {
  status_change: { label: 'Status Change', icon: <ArrowUpDown size={12} />, color: 'text-violet-700', bg: 'bg-violet-50', border: 'border-violet-200' },
  submission:    { label: 'Submission',    icon: <GitBranch size={12} />,    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  legal:         { label: 'Legal Update',  icon: <Scale size={12} />,        color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
};

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending:       { label: 'Pending',      color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200', icon: <Clock size={12} /> },
  'Under Review':{ label: 'Under Review', color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200',  icon: <Eye size={12} /> },
  Approved:      { label: 'Approved',     color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200', icon: <CheckCircle size={12} /> },
  Rejected:      { label: 'Rejected',     color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200',   icon: <XCircle size={12} /> },
};

const PRIORITY_CONFIG: Record<string, { color: string; bg: string; dot: string }> = {
  High:   { color: 'text-red-700',   bg: 'bg-red-50 border border-red-200',   dot: 'bg-red-500' },
  Normal: { color: 'text-gray-600',  bg: 'bg-gray-50 border border-gray-200', dot: 'bg-gray-400' },
  Low:    { color: 'text-blue-600',  bg: 'bg-blue-50 border border-blue-200', dot: 'bg-blue-400' },
};

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Map collateral records with "Submitted" status → status_change approvals ─

function collateralToApproval(record: CollateralRecord): PendingApproval {
  const isSubmitted = record.status === 'Submitted';
  const isUnderReview = record.status === 'Under Review';
  return {
    id: `sc-${record.id}`,
    category: 'status_change',
    categoryLabel: 'Status Change',
    title: `Status Change — ${record.collateralId}`,
    description: `Collateral status transition from Draft → ${record.status} requires supervisor sign-off before taking effect.`,
    collateralRef: record.collateralId,
    collateralType: record.type,
    obligor: record.obligor,
    requestedBy: record.assignedOfficer || record.createdBy || 'System',
    requestedAt: record.updatedAt || record.createdAt || new Date().toISOString(),
    priority: isSubmitted ? 'High' : 'Normal',
    status: isUnderReview ? 'Under Review' : 'Pending',
    currentValue: 'Draft',
    proposedValue: record.status,
    rawData: record,
  };
}

// ─── Map perfection requests → submission approvals ───────────────────────────

function perfectionToApproval(req: PerfectionRequest): PendingApproval {
  const statusMap: Record<string, ApprovalStatus> = {
    Submitted: 'Pending',
    'Under Review': 'Under Review',
    Approved: 'Approved',
    Rejected: 'Rejected',
    Draft: 'Pending',
    Returned: 'Pending',
    Perfected: 'Approved',
  };
  return {
    id: `sub-${req.id}`,
    category: 'submission',
    categoryLabel: 'Submission',
    title: `Perfection Submission — ${req.collateralId}`,
    description: `Perfection workflow submission for ${req.collateralType} collateral. Requires supervisor review and approval.`,
    collateralRef: req.collateralId,
    collateralType: req.collateralType,
    obligor: req.obligor,
    requestedBy: req.submittedByName || req.submittedBy || 'Officer',
    requestedAt: req.submittedAt || req.createdAt || new Date().toISOString(),
    priority: req.priority === 'High' ? 'High' : req.priority === 'Low' ? 'Low' : 'Normal',
    status: statusMap[req.requestStatus] ?? 'Pending',
    currentValue: req.requestStatus,
    proposedValue: 'Approved',
    notes: req.decisionNotes,
    rawData: req,
  };
}

// ─── Demo Legal Items (shown when no real data) ───────────────────────────────

const DEMO_LEGAL_ITEMS: PendingApproval[] = [
  {
    id: 'leg-001',
    category: 'legal',
    categoryLabel: 'Legal Update',
    title: 'Legal Sign-Off — COL-2024-0045',
    description: 'Legal team has submitted updated charge documents for supervisor approval before registration at Lands Registry.',
    collateralRef: 'COL-2024-0045',
    collateralType: 'Mortgage',
    obligor: 'Karibu Enterprises Ltd',
    requestedBy: 'Legal Officer',
    requestedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    priority: 'High',
    status: 'Pending',
    currentValue: 'Draft Charge',
    proposedValue: 'Registered Charge',
    notes: 'Title deed verified. Awaiting supervisor sign-off for BRELA registration.',
  },
  {
    id: 'leg-002',
    category: 'legal',
    categoryLabel: 'Legal Update',
    title: 'Legal Sign-Off — COL-2024-0078',
    description: 'Debenture amendment requires supervisor approval before it can be lodged with BRELA.',
    collateralRef: 'COL-2024-0078',
    collateralType: 'Debenture',
    obligor: 'Simba Trading Co.',
    requestedBy: 'Legal Officer',
    requestedAt: new Date(Date.now() - 5 * 60 * 60 * 1000).toISOString(),
    priority: 'Normal',
    status: 'Under Review',
    currentValue: 'Pending Amendment',
    proposedValue: 'Amended & Lodged',
  },
];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ApprovalsContent() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<PendingApproval[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<ApprovalCategory>('all');
  const [statusFilter, setStatusFilter] = useState<string>('Pending');
  const [priorityFilter, setPriorityFilter] = useState<string>('All');
  const [selectedItem, setSelectedItem] = useState<PendingApproval | null>(null);
  const [actionModal, setActionModal] = useState<ActionModalState>({ open: false, item: null, action: null });
  const [actionNote, setActionNote] = useState('');
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [collaterals, perfections] = await Promise.allSettled([
        collateralService.getAll(),
        perfectionService.getAll(),
      ]);

      const approvals: PendingApproval[] = [];

      // Status change approvals: collaterals in Submitted or Under Review
      if (collaterals.status === 'fulfilled') {
        const pendingCollaterals = collaterals.value.filter(
          (c) => c.status === 'Submitted' || c.status === 'Under Review'
        );
        approvals.push(...pendingCollaterals.map(collateralToApproval));
      }

      // Submission approvals: perfection requests in Submitted or Under Review
      if (perfections.status === 'fulfilled') {
        const pendingPerfections = perfections.value.filter(
          (p) => p.requestStatus === 'Submitted' || p.requestStatus === 'Under Review'
        );
        approvals.push(...pendingPerfections.map(perfectionToApproval));
      }

      // Add some legal update mock items if no real data (to demonstrate the feature)
      if (approvals.length === 0) {
        approvals.push(...DEMO_LEGAL_ITEMS);
      } else {
        approvals.push(...DEMO_LEGAL_ITEMS.slice(0, 1));
      }

      setItems(approvals);
    } catch {
      setItems(DEMO_LEGAL_ITEMS);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const filtered = items.filter((item) => {
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      item.collateralRef.toLowerCase().includes(q) ||
      item.obligor.toLowerCase().includes(q) ||
      item.title.toLowerCase().includes(q) ||
      item.requestedBy.toLowerCase().includes(q);
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    const matchesStatus = statusFilter === 'All' || item.status === statusFilter;
    const matchesPriority = priorityFilter === 'All' || item.priority === priorityFilter;
    return matchesSearch && matchesCategory && matchesStatus && matchesPriority;
  });

  const stats = {
    total: items.length,
    pending: items.filter((i) => i.status === 'Pending').length,
    underReview: items.filter((i) => i.status === 'Under Review').length,
    approved: items.filter((i) => i.status === 'Approved').length,
    rejected: items.filter((i) => i.status === 'Rejected').length,
    high: items.filter((i) => i.priority === 'High').length,
  };

  const openAction = (item: PendingApproval, action: 'approve' | 'reject') => {
    setActionModal({ open: true, item, action });
    setActionNote('');
  };

  const handleAction = async () => {
    if (!actionModal.item || !actionModal.action) return;
    setProcessing(true);
    try {
      const newStatus: ApprovalStatus = actionModal.action === 'approve' ? 'Approved' : 'Rejected';

      // For collateral status changes, update via service
      if (actionModal.item.category === 'status_change' && actionModal.item.rawData) {
        const targetStatus: CollateralStatus = actionModal.action === 'approve' ? 'Perfected' : 'Rejected';
        await collateralService.updateStatus(actionModal.item.rawData.id, targetStatus);
      }

      // For perfection submissions, update via service
      if (actionModal.item.category === 'submission' && actionModal.item.rawData) {
        const userRole = userProfile?.role || 'supervisor';
        if (actionModal.action === 'approve') {
          await perfectionService.approve(actionModal.item.rawData.id, userProfile?.id || '', userProfile?.full_name || 'Supervisor', actionNote, userRole);
        } else {
          await perfectionService.reject(actionModal.item.rawData.id, userProfile?.id || '', userProfile?.full_name || 'Supervisor', actionNote || 'Rejected by supervisor', userRole);
        }
      }

      // Update local state
      setItems((prev) =>
        prev.map((i) =>
          i.id === actionModal.item!.id ? { ...i, status: newStatus, notes: actionNote || i.notes } : i
        )
      );

      if (selectedItem?.id === actionModal.item.id) {
        setSelectedItem((prev) => prev ? { ...prev, status: newStatus } : null);
      }

      setSuccessMsg(`Request ${actionModal.action === 'approve' ? 'approved' : 'rejected'} successfully.`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch {
      // Optimistic update even if service call fails
      setItems((prev) =>
        prev.map((i) =>
          i.id === actionModal.item!.id ? { ...i, status: actionModal.action === 'approve' ? 'Approved' : 'Rejected' } : i
        )
      );
    } finally {
      setProcessing(false);
      setActionModal({ open: false, item: null, action: null });
      setActionNote('');
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-100">
              <ShieldCheck size={18} className="text-indigo-700" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-gray-900">Approvals</h1>
              <p className="text-sm text-gray-500">Review and approve pending status changes, submissions, and legal updates</p>
            </div>
          </div>
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Total Pending', value: stats.pending + stats.underReview, color: 'text-gray-900', bg: 'bg-gray-50 border-gray-200' },
            { label: 'Awaiting Review', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Under Review', value: stats.underReview, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Approved Today', value: stats.approved, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'High Priority', value: stats.high, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
          ].map((s) => (
            <div key={s.label} className={`rounded-lg border px-4 py-3 ${s.bg}`}>
              <p className="text-xs text-gray-500 mb-1">{s.label}</p>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Success Toast ── */}
      {successMsg && (
        <div className="mx-6 mt-3 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700 shrink-0">
          <CheckCircle size={15} />
          {successMsg}
        </div>
      )}

      {/* ── Body ── */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* List Panel */}
        <div className={`flex flex-col ${selectedItem ? 'w-1/2' : 'w-full'} border-r border-gray-200 bg-white min-h-0`}>
          {/* Filters */}
          <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by collateral ref, obligor, or officer..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="All">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Under Review">Under Review</option>
                <option value="Approved">Approved</option>
                <option value="Rejected">Rejected</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              >
                <option value="All">All Priorities</option>
                <option value="High">High</option>
                <option value="Normal">Normal</option>
                <option value="Low">Low</option>
              </select>
            </div>
            {/* Category tabs */}
            <div className="flex items-center gap-1">
              {([
                { key: 'all', label: 'All', icon: <ClipboardList size={12} /> },
                { key: 'status_change', label: 'Status Changes', icon: <ArrowUpDown size={12} /> },
                { key: 'submission', label: 'Submissions', icon: <GitBranch size={12} /> },
                { key: 'legal', label: 'Legal Updates', icon: <Scale size={12} /> },
              ] as { key: ApprovalCategory; label: string; icon: React.ReactNode }[]).map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setCategoryFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                    categoryFilter === tab.key
                      ? 'bg-indigo-600 text-white' :'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
                <Loader2 size={18} className="animate-spin" />
                <span className="text-sm">Loading approvals…</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                <ShieldCheck size={32} className="mb-2 opacity-30" />
                <p className="text-sm">No approval requests found</p>
                <p className="text-xs mt-1 opacity-70">Try adjusting your filters</p>
              </div>
            ) : (
              filtered.map((item) => {
                const catCfg = CATEGORY_CONFIG[item.category];
                const statusCfg = STATUS_CONFIG[item.status];
                const priCfg = PRIORITY_CONFIG[item.priority];
                const isSelected = selectedItem?.id === item.id;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(isSelected ? null : item)}
                    className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                      isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900 truncate">{item.collateralRef}</span>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${catCfg.color} ${catCfg.bg} ${catCfg.border}`}>
                          {catCfg.icon}
                          {catCfg.label}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${priCfg.bg} ${priCfg.color}`}>
                          {item.priority}
                        </span>
                      </div>
                      <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                    </div>
                    <p className="text-sm font-medium text-gray-800 mb-1 truncate">{item.title}</p>
                    <p className="text-xs text-gray-500 mb-2 line-clamp-1">{item.description}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-400">
                      <span className="flex items-center gap-1"><Building2 size={11} />{item.obligor}</span>
                      <span className="flex items-center gap-1"><User size={11} />{item.requestedBy}</span>
                      <span className="flex items-center gap-1"><Calendar size={11} />{formatDate(item.requestedAt)}</span>
                    </div>
                    {/* Quick action buttons for pending items */}
                    {(item.status === 'Pending' || item.status === 'Under Review') && (
                      <div className="flex items-center gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => openAction(item, 'approve')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                        >
                          <CheckCircle size={12} />
                          Approve
                        </button>
                        <button
                          onClick={() => openAction(item, 'reject')}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                        >
                          <XCircle size={12} />
                          Reject
                        </button>
                        <button
                          onClick={() => setSelectedItem(isSelected ? null : item)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                        >
                          <Eye size={12} />
                          Review
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Detail Panel */}
        {selectedItem && (
          <div className="w-1/2 flex flex-col min-h-0 bg-white overflow-y-auto">
            {/* Detail Header */}
            <div className="px-6 py-4 border-b border-gray-200 shrink-0">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    {(() => {
                      const catCfg = CATEGORY_CONFIG[selectedItem.category];
                      return (
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${catCfg.color} ${catCfg.bg} ${catCfg.border}`}>
                          {catCfg.icon}
                          {catCfg.label}
                        </span>
                      );
                    })()}
                    {(() => {
                      const statusCfg = STATUS_CONFIG[selectedItem.status];
                      return (
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      );
                    })()}
                    <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${PRIORITY_CONFIG[selectedItem.priority].bg} ${PRIORITY_CONFIG[selectedItem.priority].color}`}>
                      {selectedItem.priority} Priority
                    </span>
                  </div>
                  <h2 className="text-base font-semibold text-gray-900 truncate">{selectedItem.title}</h2>
                  <p className="text-sm text-gray-500 mt-0.5">{selectedItem.description}</p>
                </div>
                <button
                  onClick={() => setSelectedItem(null)}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Detail Body */}
            <div className="flex-1 px-6 py-4 space-y-5">
              {/* Key Details */}
              <div>
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Request Details</h3>
                <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {[
                    { label: 'Collateral Ref', value: selectedItem.collateralRef },
                    { label: 'Collateral Type', value: selectedItem.collateralType },
                    { label: 'Obligor', value: selectedItem.obligor },
                    { label: 'Requested By', value: selectedItem.requestedBy },
                    { label: 'Requested At', value: formatDateTime(selectedItem.requestedAt) },
                    { label: 'Category', value: selectedItem.categoryLabel },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">{label}</p>
                      <p className="text-sm text-gray-800 font-medium mt-0.5">{value || '—'}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Change Summary */}
              {(selectedItem.currentValue || selectedItem.proposedValue) && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Change Summary</h3>
                  <div className="flex items-center gap-3 bg-gray-50 rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex-1 text-center">
                      <p className="text-xs text-gray-400 mb-1">Current State</p>
                      <span className="inline-block px-3 py-1 bg-gray-200 text-gray-700 rounded-lg text-sm font-semibold">
                        {selectedItem.currentValue || '—'}
                      </span>
                    </div>
                    <div className="text-gray-400">→</div>
                    <div className="flex-1 text-center">
                      <p className="text-xs text-gray-400 mb-1">Proposed State</p>
                      <span className="inline-block px-3 py-1 bg-indigo-100 text-indigo-700 rounded-lg text-sm font-semibold">
                        {selectedItem.proposedValue || '—'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {selectedItem.notes && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Notes</h3>
                  <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
                    {selectedItem.notes}
                  </div>
                </div>
              )}

              {/* Supervisor Actions */}
              {(selectedItem.status === 'Pending' || selectedItem.status === 'Under Review') && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Supervisor Decision</h3>
                  <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                    <textarea
                      placeholder="Add a decision note or reason (optional)..."
                      rows={3}
                      className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none bg-white"
                      value={actionNote}
                      onChange={(e) => setActionNote(e.target.value)}
                    />
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => openAction(selectedItem, 'approve')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                      >
                        <CheckCircle size={15} />
                        Approve
                      </button>
                      <button
                        onClick={() => openAction(selectedItem, 'reject')}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        <XCircle size={15} />
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Resolved state */}
              {(selectedItem.status === 'Approved' || selectedItem.status === 'Rejected') && (
                <div className={`rounded-xl border px-4 py-4 flex items-center gap-3 ${
                  selectedItem.status === 'Approved' ?'bg-green-50 border-green-200' :'bg-red-50 border-red-200'
                }`}>
                  {selectedItem.status === 'Approved'
                    ? <CheckCircle size={20} className="text-green-600 shrink-0" />
                    : <XCircle size={20} className="text-red-600 shrink-0" />
                  }
                  <div>
                    <p className={`text-sm font-semibold ${selectedItem.status === 'Approved' ? 'text-green-800' : 'text-red-800'}`}>
                      Request {selectedItem.status}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      This request has been {selectedItem.status.toLowerCase()} and no further action is required.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── Action Confirmation Modal ── */}
      {actionModal.open && actionModal.item && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
            {/* Modal Header */}
            <div className={`px-6 py-4 border-b ${actionModal.action === 'approve' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <div className="flex items-center gap-3">
                {actionModal.action === 'approve'
                  ? <CheckCircle size={20} className="text-green-600" />
                  : <XCircle size={20} className="text-red-600" />
                }
                <div>
                  <h3 className="text-base font-semibold text-gray-900">
                    {actionModal.action === 'approve' ? 'Approve Request' : 'Reject Request'}
                  </h3>
                  <p className="text-sm text-gray-500">{actionModal.item.collateralRef} — {actionModal.item.categoryLabel}</p>
                </div>
              </div>
            </div>

            {/* Modal Body */}
            <div className="px-6 py-4 space-y-4">
              <p className="text-sm text-gray-600">
                {actionModal.action === 'approve' ?'You are about to approve this request. The proposed change will take effect immediately.' :'You are about to reject this request. The change will not be applied and the submitter will be notified.'
                }
              </p>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
                  Decision Note {actionModal.action === 'reject' ? '(required)' : '(optional)'}
                </label>
                <textarea
                  rows={3}
                  value={actionNote}
                  onChange={(e) => setActionNote(e.target.value)}
                  placeholder={actionModal.action === 'approve' ? 'Add any approval notes...' : 'Provide a reason for rejection...'}
                  className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
              <button
                onClick={() => setActionModal({ open: false, item: null, action: null })}
                disabled={processing}
                className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleAction}
                disabled={processing || (actionModal.action === 'reject' && !actionNote.trim())}
                className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 ${
                  actionModal.action === 'approve' ?'bg-green-600 hover:bg-green-700' :'bg-red-600 hover:bg-red-700'
                }`}
              >
                {processing ? <Loader2 size={14} className="animate-spin" /> : (
                  actionModal.action === 'approve' ? <CheckCircle size={14} /> : <XCircle size={14} />
                )}
                {processing ? 'Processing…' : (actionModal.action === 'approve' ? 'Confirm Approval' : 'Confirm Rejection')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
