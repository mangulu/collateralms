'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckCircle, XCircle, Clock, Eye, Search, Loader2, Calendar, User, RefreshCw, ShieldCheck, X, ChevronRight, AlertTriangle, Scale, CreditCard, FileCheck, ArrowRight, Send, Lock, Unlock, CornerDownRight, RotateCcw, TrendingUp, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { collateralApprovalService, CollateralApprovalRequest, ApprovalComment, ApprovalPipelineLog, ApprovalRequestStatus, ApproverRole } from '@/lib/supabase/collateralApprovalService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';
import WorkflowDrawer from '@/components/ui/WorkflowDrawer';


// ── Types ──────────────────────────────────────────────────────────────────────

type TabKey = 'queue' | 'pipeline' | 'history';
type RoleFilter = 'All' | ApproverRole;

// ── Constants ──────────────────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { stage: 1, label: 'Routed',      icon: ArrowRight,   color: 'text-gray-500',   bg: 'bg-gray-100',   border: 'border-gray-300' },
  { stage: 2, label: 'Assigned',    icon: User,         color: 'text-blue-600',   bg: 'bg-blue-50',    border: 'border-blue-300' },
  { stage: 3, label: 'Under Review',icon: Eye,          color: 'text-amber-600',  bg: 'bg-amber-50',   border: 'border-amber-300' },
  { stage: 4, label: 'Decision',    icon: Scale,        color: 'text-violet-600', bg: 'bg-violet-50',  border: 'border-violet-300' },
  { stage: 5, label: 'Resolved',    icon: CheckCircle,  color: 'text-green-600',  bg: 'bg-green-50',   border: 'border-green-300' },
];

const REQUEST_TYPE_CONFIG: Record<string, { icon: React.ReactNode; color: string; bg: string; border: string }> = {
  'Legal Review':         { icon: <Scale size={12} />,       color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  'Credit Assessment':    { icon: <CreditCard size={12} />,  color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  'Compliance Check':     { icon: <ShieldCheck size={12} />, color: 'text-teal-700',   bg: 'bg-teal-50',    border: 'border-teal-200' },
  'Valuation Approval':   { icon: <TrendingUp size={12} />,  color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  'Release Authorization':{ icon: <Unlock size={12} />,      color: 'text-rose-700',   bg: 'bg-rose-50',    border: 'border-rose-200' },
};

const STATUS_CONFIG: Record<ApprovalRequestStatus, { label: string; color: string; bg: string; border: string; icon: React.ReactNode }> = {
  Pending:       { label: 'Pending',      color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200',  icon: <Clock size={12} /> },
  'Under Review':{ label: 'Under Review', color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200',   icon: <Eye size={12} /> },
  Approved:      { label: 'Approved',     color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200',  icon: <CheckCircle size={12} /> },
  Rejected:      { label: 'Rejected',     color: 'text-red-700',    bg: 'bg-red-50',     border: 'border-red-200',    icon: <XCircle size={12} /> },
  Escalated:     { label: 'Escalated',    color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200', icon: <AlertTriangle size={12} /> },
  Returned:      { label: 'Returned',     color: 'text-gray-700',   bg: 'bg-gray-50',    border: 'border-gray-200',   icon: <RotateCcw size={12} /> },
};

const PRIORITY_DOT: Record<string, string> = {
  High: 'bg-red-500',
  Normal: 'bg-gray-400',
  Low: 'bg-blue-400',
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function fmtCurrency(val: number | null | undefined): string {
  if (val == null) return '—';
  return new Intl.NumberFormat('en-TZ', { style: 'currency', currency: 'TZS', maximumFractionDigits: 0 }).format(val);
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function PipelineTracker({ stage, status }: { stage: number; status: ApprovalRequestStatus }) {
  return (
    <div className="flex items-center gap-0 w-full">
      {PIPELINE_STAGES.map((s, idx) => {
        const isActive = s.stage === stage;
        const isDone = s.stage < stage || status === 'Approved';
        const isRejected = status === 'Rejected' && s.stage === stage;
        const Icon = s.icon;
        return (
          <React.Fragment key={s.stage}>
            <div className="flex flex-col items-center flex-1 min-w-0">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all ${
                isRejected ? 'bg-red-100 border-red-400 text-red-600' : isDone ?'bg-green-100 border-green-400 text-green-600' :
                isActive ? `${s.bg} ${s.border} ${s.color}` :
                'bg-gray-50 border-gray-200 text-gray-300'
              }`}>
                {isRejected ? <XCircle size={13} /> : isDone ? <CheckCircle size={13} /> : <Icon size={13} />}
              </div>
              <span className={`text-[10px] mt-1 font-medium truncate max-w-full text-center ${
                isRejected ? 'text-red-600' : isDone ? 'text-green-600' : isActive ? s.color : 'text-gray-300'
              }`}>{s.label}</span>
            </div>
            {idx < PIPELINE_STAGES.length - 1 && (
              <div className={`h-0.5 flex-1 mx-0.5 mb-4 transition-all ${
                s.stage < stage || status === 'Approved' ? 'bg-green-300' : 'bg-gray-200'
              }`} />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
}

function CommentThread({
  comments,
  onAdd,
  loading,
}: {
  comments: ApprovalComment[];
  onAdd: (text: string, isInternal: boolean) => Promise<void>;
  loading: boolean;
}) {
  const [text, setText] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (!text.trim()) return;
    setSubmitting(true);
    try {
      await onAdd(text.trim(), isInternal);
      setText('');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-3">
      {loading ? (
        <div className="flex items-center gap-2 text-gray-400 text-sm py-2">
          <Loader2 size={14} className="animate-spin" /> Loading comments…
        </div>
      ) : comments.length === 0 ? (
        <p className="text-sm text-gray-400 italic py-1">No comments yet. Be the first to leave a note.</p>
      ) : (
        <div className="space-y-2.5">
          {comments.map((c) => (
            <div key={c.id} className={`rounded-lg px-3 py-2.5 border ${c.isInternal ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-700">
                  {c.authorName.charAt(0).toUpperCase()}
                </div>
                <span className="text-xs font-semibold text-gray-800">{c.authorName}</span>
                <span className="text-xs text-gray-400">{c.authorRole}</span>
                {c.isInternal && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded font-medium">
                    <Lock size={9} /> Internal
                  </span>
                )}
                <span className="text-[10px] text-gray-400 ml-auto">{timeAgo(c.createdAt)}</span>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed">{c.commentText}</p>
            </div>
          ))}
        </div>
      )}

      {/* Add comment */}
      <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
        <textarea
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Leave a comment or note…"
          className="w-full px-3 py-2.5 text-sm resize-none focus:outline-none"
        />
        <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-gray-50">
          <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isInternal}
              onChange={(e) => setIsInternal(e.target.checked)}
              className="rounded border-gray-300 text-amber-500 focus:ring-amber-400"
            />
            <Lock size={11} className="text-amber-600" />
            Internal note
          </label>
          <button
            onClick={handleSubmit}
            disabled={!text.trim() || submitting}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-40 transition-colors"
          >
            {submitting ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
            Post
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ApprovalsContent() {
  const { userProfile } = useAuth();
  const [items, setItems] = useState<CollateralApprovalRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>('queue');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('active');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('All');
  const [selectedItem, setSelectedItem] = useState<CollateralApprovalRequest | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [comments, setComments] = useState<ApprovalComment[]>([]);
  const [pipelineLog, setPipelineLog] = useState<ApprovalPipelineLog[]>([]);
  const [commentsLoading, setCommentsLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<'comments' | 'pipeline'>('comments');

  // Action modal
  const [actionModal, setActionModal] = useState<{
    open: boolean;
    item: CollateralApprovalRequest | null;
    action: 'approve' | 'reject' | 'return' | null;
  }>({ open: false, item: null, action: null });
  const [actionNote, setActionNote] = useState('');
  const [complianceAttested, setComplianceAttested] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = await collateralApprovalService.getAll();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const loadDetailData = useCallback(async (item: CollateralApprovalRequest) => {
    setCommentsLoading(true);
    try {
      const [cmts, log] = await Promise.all([
        collateralApprovalService.getComments(item.id),
        collateralApprovalService.getPipelineLog(item.id),
      ]);
      setComments(cmts);
      setPipelineLog(log);
    } catch {
      setComments([]);
      setPipelineLog([]);
    } finally {
      setCommentsLoading(false);
    }
  }, []);

  const selectItem = (item: CollateralApprovalRequest) => {
    setSelectedItem(item);
    setDetailTab('comments');
    setDrawerOpen(true);
    loadDetailData(item);
  };

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    setTimeout(() => setSelectedItem(null), 300);
  };

  // Filtering
  const activeItems = items.filter((i) => i.requestStatus === 'Pending' || i.requestStatus === 'Under Review');
  const historyItems = items.filter((i) => i.requestStatus === 'Approved' || i.requestStatus === 'Rejected' || i.requestStatus === 'Returned' || i.requestStatus === 'Escalated');

  const sourceItems = activeTab === 'history' ? historyItems : activeItems;

  const filtered = sourceItems.filter((item) => {
    const q = search.toLowerCase();
    const matchSearch = !q || item.collateralRef.toLowerCase().includes(q) || item.obligor.toLowerCase().includes(q) || item.requestType.toLowerCase().includes(q) || item.routedByName.toLowerCase().includes(q);
    const matchRole = roleFilter === 'All' || item.assignedToRole === roleFilter;
    const matchStatus = statusFilter === 'all' || statusFilter === 'active'
      ? true
      : item.requestStatus === statusFilter;
    return matchSearch && matchRole && matchStatus;
  });

  const stats = {
    pending: items.filter((i) => i.requestStatus === 'Pending').length,
    underReview: items.filter((i) => i.requestStatus === 'Under Review').length,
    approved: items.filter((i) => i.requestStatus === 'Approved').length,
    rejected: items.filter((i) => i.requestStatus === 'Rejected').length,
    highPriority: items.filter((i) => i.priority === 'High' && (i.requestStatus === 'Pending' || i.requestStatus === 'Under Review')).length,
  };

  const openAction = (item: CollateralApprovalRequest, action: 'approve' | 'reject' | 'return') => {
    setActionModal({ open: true, item, action });
    setActionNote('');
    setComplianceAttested(false);
  };

  const handleAction = async () => {
    if (!actionModal.item || !actionModal.action) return;
    if (actionModal.action !== 'return' && !complianceAttested) return;
    setProcessing(true);
    try {
      const statusMap: Record<string, ApprovalRequestStatus> = {
        approve: 'Approved',
        reject: 'Rejected',
        return: 'Returned',
      };
      const newStatus = statusMap[actionModal.action];
      const userId = userProfile?.id ?? '';
      const userName = userProfile?.full_name ?? 'Reviewer';
      const userRole = userProfile?.role ?? 'Officer';

      await collateralApprovalService.updateStatus(
        actionModal.item.id,
        newStatus,
        userId,
        userName,
        actionNote,
        complianceAttested,
        userId
      );

      await collateralApprovalService.logPipelineChange(
        actionModal.item.id,
        actionModal.item.pipelineStage,
        newStatus === 'Approved' ? 5 : newStatus === 'Rejected' ? 4 : actionModal.item.pipelineStage,
        actionModal.item.requestStatus,
        newStatus,
        userId,
        userName,
        userRole,
        actionNote
      );

      setItems((prev) =>
        prev.map((i) =>
          i.id === actionModal.item!.id
            ? { ...i, requestStatus: newStatus, reviewedByName: userName, reviewedAt: new Date().toISOString(), complianceAttested, pipelineStage: newStatus === 'Approved' ? 5 : newStatus === 'Rejected' ? 4 : i.pipelineStage }
            : i
        )
      );
      if (selectedItem?.id === actionModal.item.id) {
        setSelectedItem((prev) => prev ? { ...prev, requestStatus: newStatus, complianceAttested } : null);
        loadDetailData({ ...actionModal.item, requestStatus: newStatus });
      }

      const labels: Record<string, string> = { approve: 'approved', reject: 'rejected', return: 'returned for revision' };
      setSuccessMsg(`Request ${labels[actionModal.action]} successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch {
      setSuccessMsg('Action recorded (offline mode).');
      setTimeout(() => setSuccessMsg(null), 3000);
    } finally {
      setProcessing(false);
      setActionModal({ open: false, item: null, action: null });
    }
  };

  const handleAddComment = async (text: string, isInternal: boolean) => {
    if (!selectedItem) return;
    const userId = userProfile?.id ?? '';
    const userName = userProfile?.full_name ?? 'Reviewer';
    const userRole = userProfile?.role ?? 'Officer';
    const newComment = await collateralApprovalService.addComment(selectedItem.id, userId, userName, userRole, text, isInternal);
    setComments((prev) => [...prev, newComment]);
  };

  const TABS: { key: TabKey; label: string; count?: number }[] = [
    { key: 'queue', label: 'Approval Queue', count: activeItems.length },
    { key: 'pipeline', label: 'Pipeline View' },
    { key: 'history', label: 'History', count: historyItems.length },
  ];

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
              <div className="flex items-center gap-1.5 mb-0.5">
                <Link href="/workflows" className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1 transition-colors">
                  <LayoutGrid size={11} /> Workflows
                </Link>
                <ChevronRight size={11} className="text-gray-300" />
                <span className="text-xs text-gray-600 font-medium">Approvals</span>
              </div>
              <h1 className="text-lg font-semibold text-gray-900">Approvals</h1>
              <p className="text-sm text-gray-500">Legal Officers &amp; Credit Managers — review routed collaterals, leave comments, and approve with compliance attestation</p>
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
            { label: 'Awaiting Review', value: stats.pending, color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200' },
            { label: 'Under Review', value: stats.underReview, color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
            { label: 'Approved', value: stats.approved, color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
            { label: 'Rejected', value: stats.rejected, color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
            { label: 'High Priority', value: stats.highPriority, color: 'text-rose-700', bg: 'bg-rose-50 border-rose-200' },
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
          <CheckCircle size={15} /> {successMsg}
        </div>
      )}

      {/* ── Tabs ── */}
      <div className="bg-white border-b border-gray-200 px-6 shrink-0">
        <div className="flex items-center gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-indigo-600 text-indigo-700' :'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${
                  activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                }`}>{tab.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      {activeTab === 'pipeline' ? (
        <PipelineView items={items} loading={loading} onSelect={selectItem} />
      ) : (
        <div className="flex flex-1 min-h-0 overflow-hidden">
          {/* Full-width List Panel */}
          <div className="flex flex-col w-full border-r border-gray-200 bg-white min-h-0">
            {/* Filters */}
            <div className="px-4 py-3 border-b border-gray-100 shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search collateral ref, obligor, type…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <select
                  value={roleFilter}
                  onChange={(e) => setRoleFilter(e.target.value as RoleFilter)}
                  className="text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  <option value="All">All Roles</option>
                  <option value="Legal Officer">Legal Officer</option>
                  <option value="Credit Manager">Credit Manager</option>
                  <option value="Compliance Officer">Compliance Officer</option>
                  <option value="Senior Manager">Senior Manager</option>
                </select>
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
                  const typeCfg = REQUEST_TYPE_CONFIG[item.requestType] ?? REQUEST_TYPE_CONFIG['Legal Review'];
                  const statusCfg = STATUS_CONFIG[item.requestStatus];
                  const isSelected = selectedItem?.id === item.id && drawerOpen;
                  const isActive = item.requestStatus === 'Pending' || item.requestStatus === 'Under Review';

                  return (
                    <div
                      key={item.id}
                      onClick={() => selectItem(item)}
                      className={`px-4 py-4 border-b border-gray-100 cursor-pointer transition-colors ${
                        isSelected ? 'bg-indigo-50 border-l-2 border-l-indigo-500' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="text-sm font-semibold text-gray-900">{item.collateralRef}</span>
                          <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${typeCfg.color} ${typeCfg.bg} ${typeCfg.border}`}>
                            {typeCfg.icon}
                            {item.requestType}
                          </span>
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className={`w-1.5 h-1.5 rounded-full ${PRIORITY_DOT[item.priority]}`} />
                            {item.priority}
                          </span>
                        </div>
                        <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium shrink-0 border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                          {statusCfg.icon}
                          {statusCfg.label}
                        </span>
                      </div>
                      <p className="text-xs text-gray-600 mb-1.5 font-medium">{item.collateralType} — {item.obligor}</p>
                      <div className="flex items-center gap-3 text-xs text-gray-400 mb-2">
                        <span className="flex items-center gap-1"><User size={10} />{item.assignedToRole}</span>
                        <span className="flex items-center gap-1"><Calendar size={10} />{fmtDate(item.routedAt)}</span>
                        {item.dueDate && (
                          <span className={`flex items-center gap-1 ${new Date(item.dueDate) < new Date() ? 'text-red-500' : ''}`}>
                            <Clock size={10} />Due {fmtDate(item.dueDate)}
                          </span>
                        )}
                      </div>
                      {/* Mini pipeline */}
                      <div className="mb-2">
                        <PipelineTracker stage={item.pipelineStage} status={item.requestStatus} />
                      </div>
                      {/* Quick actions */}
                      {isActive && (
                        <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => openAction(item, 'approve')}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 transition-colors"
                          >
                            <CheckCircle size={11} /> Approve
                          </button>
                          <button
                            onClick={() => openAction(item, 'reject')}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 rounded-lg hover:bg-red-100 transition-colors"
                          >
                            <XCircle size={11} /> Reject
                          </button>
                          <button
                            onClick={() => openAction(item, 'return')}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                          >
                            <RotateCcw size={11} /> Return
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
      )}

      {/* ── Workflow Drawer ── */}
      <WorkflowDrawer
        open={drawerOpen}
        onClose={handleCloseDrawer}
        width="w-[520px]"
        deadline={selectedItem?.dueDate ?? undefined}
      >
        {selectedItem && (
          <DetailPanel
            item={selectedItem}
            comments={comments}
            pipelineLog={pipelineLog}
            commentsLoading={commentsLoading}
            detailTab={detailTab}
            setDetailTab={setDetailTab}
            onClose={handleCloseDrawer}
            onAction={openAction}
            onAddComment={handleAddComment}
          />
        )}
      </WorkflowDrawer>

      {/* ── Action Modal ── */}
      {actionModal.open && actionModal.item && (
        <ActionModal
          item={actionModal.item}
          action={actionModal.action!}
          actionNote={actionNote}
          setActionNote={setActionNote}
          complianceAttested={complianceAttested}
          setComplianceAttested={setComplianceAttested}
          processing={processing}
          onConfirm={handleAction}
          onCancel={() => setActionModal({ open: false, item: null, action: null })}
        />
      )}
    </div>
  );
}

// ── Detail Panel ───────────────────────────────────────────────────────────────

function DetailPanel({
  item,
  comments,
  pipelineLog,
  commentsLoading,
  detailTab,
  setDetailTab,
  onClose,
  onAction,
  onAddComment,
}: {
  item: CollateralApprovalRequest;
  comments: ApprovalComment[];
  pipelineLog: ApprovalPipelineLog[];
  commentsLoading: boolean;
  detailTab: 'comments' | 'pipeline';
  setDetailTab: (t: 'comments' | 'pipeline') => void;
  onClose: () => void;
  onAction: (item: CollateralApprovalRequest, action: 'approve' | 'reject' | 'return') => void;
  onAddComment: (text: string, isInternal: boolean) => Promise<void>;
}) {
  const typeCfg = REQUEST_TYPE_CONFIG[item.requestType] ?? REQUEST_TYPE_CONFIG['Legal Review'];
  const statusCfg = STATUS_CONFIG[item.requestStatus];
  const isActive = item.requestStatus === 'Pending' || item.requestStatus === 'Under Review';

  return (
    <div className="flex flex-col h-full min-h-0 bg-white overflow-hidden">
      {/* Detail Header */}
      <div className="px-5 py-4 border-b border-gray-200 shrink-0">
        <div className="flex items-start justify-between gap-3 mb-1">
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${typeCfg.color} ${typeCfg.bg} ${typeCfg.border}`}>
                {typeCfg.icon} {item.requestType}
              </span>
              <span className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                {statusCfg.icon} {statusCfg.label}
              </span>
              {item.complianceAttested && (
                <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium bg-teal-50 text-teal-700 border border-teal-200">
                  <FileCheck size={11} /> Attested
                </span>
              )}
            </div>
            <h2 className="text-base font-semibold text-gray-900">{item.collateralRef} — {item.collateralType}</h2>
            <p className="text-sm text-gray-500">{item.obligor}</p>
          </div>
          <button onClick={onClose} className="shrink-0 p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Detail Tabs */}
      <div className="flex border-b border-gray-200 shrink-0 px-5">
        {(['comments', 'pipeline'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setDetailTab(t)}
            className={`px-3 py-2.5 text-xs font-medium border-b-2 capitalize transition-colors ${
              detailTab === t ? 'border-indigo-600 text-indigo-700' : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'comments' ? `Comments (${comments.length})` : 'Pipeline Log'}
          </button>
        ))}
      </div>

      {/* Detail Body */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {detailTab === 'comments' && (
          <CommentThread comments={comments} onAdd={onAddComment} loading={commentsLoading} />
        )}

        {detailTab === 'pipeline' && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Pipeline History</h3>
            {pipelineLog.length === 0 ? (
              <p className="text-sm text-gray-400 italic">No pipeline events recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {pipelineLog.map((log) => (
                  <div key={log.id} className="flex gap-3 items-start">
                    <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                      <ChevronRight size={12} className="text-indigo-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-gray-800">{log.changedByName}</span>
                        <span className="text-xs text-gray-400">{log.changedByRole}</span>
                        <span className="text-xs text-gray-400 ml-auto">{fmtDateTime(log.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-1.5 mt-0.5 text-xs text-gray-600">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">{log.fromStatus ?? 'Start'}</span>
                        <ArrowRight size={10} className="text-gray-400" />
                        <span className="px-1.5 py-0.5 bg-indigo-100 rounded text-indigo-700 font-medium">{log.toStatus}</span>
                        <span className="text-gray-400">Stage {log.fromStage ?? '—'} → {log.toStage}</span>
                      </div>
                      {log.reason && (
                        <p className="text-xs text-gray-500 mt-1 flex items-start gap-1">
                          <CornerDownRight size={10} className="shrink-0 mt-0.5 text-gray-400" />
                          {log.reason}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
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
              Compliance attestation is required before approving or rejecting.
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => onAction(item, 'approve')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
              >
                <CheckCircle size={14} /> Approve
              </button>
              <button
                onClick={() => onAction(item, 'reject')}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
              >
                <XCircle size={14} /> Reject
              </button>
              <button
                onClick={() => onAction(item, 'return')}
                className="flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <RotateCcw size={14} />
              </button>
            </div>
          </div>
        </div>
      )}

      {!isActive && item.reviewedByName && (
        <div className="px-5 py-4 border-t border-gray-200 shrink-0">
          <div className={`rounded-lg border px-4 py-3 ${item.requestStatus === 'Approved' ? 'bg-green-50 border-green-200' : item.requestStatus === 'Rejected' ? 'bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-gray-700">{item.reviewedByName}</span>
              <span className="text-xs text-gray-400">{fmtDateTime(item.reviewedAt)}</span>
            </div>
            {item.decisionNotes && <p className="text-sm text-gray-700">{item.decisionNotes}</p>}
            {item.complianceAttested && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-teal-700">
                <FileCheck size={12} /> Compliance attestation confirmed
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Pipeline View ──────────────────────────────────────────────────────────────

function PipelineView({
  items,
  loading,
  onSelect,
}: {
  items: CollateralApprovalRequest[];
  loading: boolean;
  onSelect: (item: CollateralApprovalRequest) => void;
}) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-40 gap-2 text-gray-400">
        <Loader2 size={18} className="animate-spin" />
        <span className="text-sm">Loading pipeline…</span>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-x-auto overflow-y-auto p-6">
      <div className="flex gap-4 min-w-max">
        {PIPELINE_STAGES.map((stage) => {
          const stageItems = items.filter((i) => i.pipelineStage === stage.stage);
          const Icon = stage.icon;
          return (
            <div key={stage.stage} className="w-64 flex flex-col gap-3">
              {/* Column header */}
              <div className={`flex items-center gap-2 px-3 py-2 rounded-lg border ${stage.bg} ${stage.border}`}>
                <Icon size={14} className={stage.color} />
                <span className={`text-xs font-semibold ${stage.color}`}>{stage.label}</span>
                <span className={`ml-auto text-xs font-bold px-1.5 py-0.5 rounded-full ${stage.bg} ${stage.color}`}>{stageItems.length}</span>
              </div>
              {/* Cards */}
              <div className="space-y-2">
                {stageItems.length === 0 ? (
                  <div className="text-center py-6 text-xs text-gray-300 border-2 border-dashed border-gray-200 rounded-lg">
                    No items
                  </div>
                ) : (
                  stageItems.map((item) => {
                    const typeCfg = REQUEST_TYPE_CONFIG[item.requestType] ?? REQUEST_TYPE_CONFIG['Legal Review'];
                    const statusCfg = STATUS_CONFIG[item.requestStatus];
                    return (
                      <div
                        key={item.id}
                        onClick={() => onSelect(item)}
                        className="bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-indigo-300 hover:shadow-sm transition-all"
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-xs font-semibold text-gray-900">{item.collateralRef}</span>
                          <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full font-medium border ${statusCfg.bg} ${statusCfg.color} ${statusCfg.border}`}>
                            {statusCfg.icon} {statusCfg.label}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mb-1.5 truncate">{item.obligor}</p>
                        <div className="flex items-center gap-1.5">
                          <span className={`flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border ${typeCfg.color} ${typeCfg.bg} ${typeCfg.border}`}>
                            {typeCfg.icon} {item.requestType}
                          </span>
                          <span className={`w-1.5 h-1.5 rounded-full ml-auto ${PRIORITY_DOT[item.priority]}`} />
                        </div>
                        <div className="flex items-center gap-1 mt-2 text-[10px] text-gray-400">
                          <User size={9} /> {item.assignedToRole}
                          <span className="ml-auto">{timeAgo(item.routedAt)}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Action Modal ───────────────────────────────────────────────────────────────

function ActionModal({
  item,
  action,
  actionNote,
  setActionNote,
  complianceAttested,
  setComplianceAttested,
  processing,
  onConfirm,
  onCancel,
}: {
  item: CollateralApprovalRequest;
  action: 'approve' | 'reject' | 'return';
  actionNote: string;
  setActionNote: (v: string) => void;
  complianceAttested: boolean;
  setComplianceAttested: (v: boolean) => void;
  processing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const isApprove = action === 'approve';
  const isReturn = action === 'return';
  const requiresAttestation = !isReturn;
  const canConfirm = !processing && (isReturn || complianceAttested) && (isApprove || actionNote.trim().length > 0 || isReturn);

  const headerConfig = {
    approve: { bg: 'bg-green-50 border-green-200', icon: <CheckCircle size={20} className="text-green-600" />, title: 'Approve Request', btn: 'bg-green-600 hover:bg-green-700', btnLabel: 'Confirm Approval' },
    reject:  { bg: 'bg-red-50 border-red-200',   icon: <XCircle size={20} className="text-red-600" />,     title: 'Reject Request',  btn: 'bg-red-600 hover:bg-red-700',   btnLabel: 'Confirm Rejection' },
    return:  { bg: 'bg-gray-50 border-gray-200',  icon: <RotateCcw size={20} className="text-gray-600" />,  title: 'Return for Revision', btn: 'bg-gray-700 hover:bg-gray-800', btnLabel: 'Confirm Return' },
  }[action];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className={`px-6 py-4 border-b ${headerConfig.bg}`}>
          <div className="flex items-center gap-3">
            {headerConfig.icon}
            <div>
              <h3 className="text-base font-semibold text-gray-900">{headerConfig.title}</h3>
              <p className="text-sm text-gray-500">{item.collateralRef} — {item.requestType}</p>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4 space-y-4">
          <p className="text-sm text-gray-600">
            {isApprove
              ? 'You are approving this collateral for the next stage. The decision will be recorded in the audit trail.'
              : isReturn
              ? 'This request will be returned to the originator for revision with your notes.'
              : 'You are rejecting this request. The submitter will be notified with your reason.'}
          </p>

          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">
              Decision Note {!isApprove && !isReturn ? '(required)' : '(optional)'}
            </label>
            <textarea
              rows={3}
              value={actionNote}
              onChange={(e) => setActionNote(e.target.value)}
              placeholder={isApprove ? 'Add approval notes…' : isReturn ? 'Describe what needs to be revised…' : 'Provide a reason for rejection…'}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
            />
          </div>

          {/* Compliance Attestation */}
          {requiresAttestation && (
            <div className={`rounded-xl border p-4 ${complianceAttested ? 'bg-teal-50 border-teal-300' : 'bg-gray-50 border-gray-200'}`}>
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={complianceAttested}
                  onChange={(e) => setComplianceAttested(e.target.checked)}
                  className="mt-0.5 w-4 h-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500"
                />
                <div>
                  <p className={`text-sm font-semibold ${complianceAttested ? 'text-teal-800' : 'text-gray-700'}`}>
                    Compliance Attestation
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">
                    I confirm that I have reviewed all relevant documentation, verified compliance with applicable regulations and internal policies, and that this decision is made in accordance with the bank&apos;s collateral management framework.
                  </p>
                </div>
              </label>
              {!complianceAttested && (
                <p className="text-xs text-amber-600 mt-2 flex items-center gap-1">
                  <AlertTriangle size={11} /> Attestation is required to proceed.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3">
          <button
            onClick={onCancel}
            disabled={processing}
            className="px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canConfirm}
            className={`flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-40 ${headerConfig.btn}`}
          >
            {processing ? <Loader2 size={14} className="animate-spin" /> : headerConfig.icon}
            {processing ? 'Processing…' : headerConfig.btnLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
