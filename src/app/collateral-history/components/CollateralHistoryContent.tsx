'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Search, RefreshCw, ChevronDown, Clock, CheckCircle2, XCircle, AlertTriangle, FileText, Link2, History, Shield, Activity, User, Calendar, ArrowRight, RotateCcw, Loader2, Filter, Tag, Building2, BookOpen, GitBranch, ChevronUp,  } from 'lucide-react';
import { collateralService, CollateralRecord, CollateralStatus } from '@/lib/supabase/collateralService';
import { auditLogService, AuditLogEntry } from '@/lib/supabase/auditLogService';
import { perfectionService, PerfectionRequest, PerfectionStatusHistory, PerfectionComment } from '@/lib/supabase/perfectionService';
import { collateralLinkService, CollateralLoanLink } from '@/lib/supabase/collateralLinkService';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

const STATUS_COLORS: Record<CollateralStatus, { bg: string; text: string; border: string }> = {
  Draft:         { bg: 'bg-gray-100',    text: 'text-gray-600',    border: 'border-gray-200' },
  Submitted:     { bg: 'bg-blue-50',     text: 'text-blue-700',    border: 'border-blue-200' },
  'Under Review':{ bg: 'bg-amber-50',    text: 'text-amber-700',   border: 'border-amber-200' },
  Perfected:     { bg: 'bg-emerald-50',  text: 'text-emerald-700', border: 'border-emerald-200' },
  Monitoring:    { bg: 'bg-purple-50',   text: 'text-purple-700',  border: 'border-purple-200' },
  Released:      { bg: 'bg-slate-50',    text: 'text-slate-600',   border: 'border-slate-200' },
  Overdue:       { bg: 'bg-red-50',      text: 'text-red-700',     border: 'border-red-200' },
  Rejected:      { bg: 'bg-rose-50',     text: 'text-rose-700',    border: 'border-rose-200' },
};

const ACTION_ICON: Record<string, React.ReactNode> = {
  created:        <CheckCircle2 size={13} className="text-emerald-500" />,
  updated:        <RefreshCw size={13} className="text-blue-500" />,
  status_changed: <ArrowRight size={13} className="text-amber-500" />,
  perfected:      <Shield size={13} className="text-emerald-600" />,
  submitted:      <FileText size={13} className="text-blue-500" />,
  released:       <RotateCcw size={13} className="text-slate-500" />,
  overdue:        <AlertTriangle size={13} className="text-red-500" />,
  rejected:       <XCircle size={13} className="text-red-500" />,
  document_uploaded: <FileText size={13} className="text-indigo-500" />,
  loan_linked:    <Link2 size={13} className="text-violet-500" />,
  loan_released:  <Link2 size={13} className="text-slate-400" />,
};

function getActionIcon(action: string): React.ReactNode {
  return ACTION_ICON[action] ?? <Activity size={13} className="text-gray-400" />;
}

const PERF_STATUS_CONFIG: Record<string, { dot: string; label: string; text: string }> = {
  Draft:         { dot: 'bg-gray-400',    label: 'Draft',        text: 'text-gray-600' },
  Submitted:     { dot: 'bg-blue-500',    label: 'Submitted',    text: 'text-blue-700' },
  'Under Review':{ dot: 'bg-amber-500',   label: 'Under Review', text: 'text-amber-700' },
  Approved:      { dot: 'bg-green-500',   label: 'Approved',     text: 'text-green-700' },
  Perfected:     { dot: 'bg-emerald-500', label: 'Perfected',    text: 'text-emerald-700' },
  Rejected:      { dot: 'bg-red-500',     label: 'Rejected',     text: 'text-red-700' },
  Returned:      { dot: 'bg-orange-500',  label: 'Returned',     text: 'text-orange-700' },
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ icon, title, count }: { icon: React.ReactNode; title: string; count?: number }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="p-1.5 rounded-lg bg-gray-100 text-gray-600">{icon}</div>
      <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
      {count !== undefined && (
        <span className="ml-auto text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{count}</span>
      )}
    </div>
  );
}

function EmptyRow({ message }: { message: string }) {
  return (
    <div className="py-8 text-center text-sm text-gray-400">{message}</div>
  );
}

// ─── Approval Timeline Panel ──────────────────────────────────────────────────

function ApprovalTimeline({ request }: { request: PerfectionRequest }) {
  const [history, setHistory] = useState<PerfectionStatusHistory[]>([]);
  const [comments, setComments] = useState<PerfectionComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all([
      perfectionService.getStatusHistory(request.id),
      perfectionService.getComments(request.id),
    ]).then(([h, c]) => {
      if (cancelled) return;
      setHistory(h);
      setComments(c);
      setLoading(false);
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [request.id]);

  const cfg = PERF_STATUS_CONFIG[request.requestStatus] ?? PERF_STATUS_CONFIG['Draft'];

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden">
      {/* Header row */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 hover:bg-gray-100 transition-colors text-left"
      >
        <GitBranch size={14} className="text-gray-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-medium text-gray-800 truncate">{request.collateralId}</span>
            <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${cfg.text} bg-white border border-gray-200`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </span>
            {request.priority === 'High' && (
              <span className="text-xs px-1.5 py-0.5 rounded bg-red-50 text-red-600 border border-red-200 font-medium">High Priority</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-gray-500">
            <span>{request.obligor}</span>
            <span>·</span>
            <span>{request.collateralType}</span>
            <span>·</span>
            <span>Deadline: {formatDate(request.perfectionDeadline)}</span>
          </div>
        </div>
        <div className="shrink-0 text-gray-400">
          {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        </div>
      </button>

      {expanded && (
        <div className="px-4 py-4 bg-white">
          {loading ? (
            <div className="flex items-center gap-2 py-3 text-sm text-gray-400">
              <Loader2 size={13} className="animate-spin" /> Loading timeline…
            </div>
          ) : (
            <div className="space-y-4">
              {/* Status history */}
              {history.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Status History</p>
                  <div className="relative pl-5">
                    <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-200" />
                    {history.map((h, i) => (
                      <div key={h.id} className="relative mb-3 last:mb-0">
                        <div className="absolute -left-3.5 top-1 w-2.5 h-2.5 rounded-full border-2 border-white bg-blue-400 shadow-sm" />
                        <div className="bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            {h.fromStatus && (
                              <>
                                <span className="text-xs text-gray-500">{h.fromStatus}</span>
                                <ArrowRight size={11} className="text-gray-400" />
                              </>
                            )}
                            <span className="text-xs font-medium text-gray-800">{h.toStatus}</span>
                          </div>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                            <User size={10} />
                            <span>{h.changedByName}</span>
                            {h.changedByRole && <span className="text-gray-300">·</span>}
                            {h.changedByRole && <span>{h.changedByRole}</span>}
                            <span className="ml-auto">{formatDateTime(h.createdAt)}</span>
                          </div>
                          {h.reason && <p className="mt-1 text-xs text-gray-500 italic">{h.reason}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Comments */}
              {comments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Comments & Actions</p>
                  <div className="space-y-2">
                    {comments.map((c) => (
                      <div key={c.id} className="flex gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 mt-0.5">
                          <span className="text-xs font-semibold text-indigo-600">
                            {c.performedByName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1 bg-gray-50 rounded-lg px-3 py-2">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-gray-700">{c.performedByName}</span>
                            <span className="text-xs px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500 capitalize">{c.action}</span>
                            <span className="ml-auto text-xs text-gray-400">{formatDateTime(c.createdAt)}</span>
                          </div>
                          <p className="mt-1 text-xs text-gray-600">{c.comment}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {history.length === 0 && comments.length === 0 && (
                <p className="text-sm text-gray-400 text-center py-2">No timeline events yet.</p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollateralHistoryContent() {
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [loadingCollaterals, setLoadingCollaterals] = useState(true);

  // Per-collateral data
  const [selectedCollateral, setSelectedCollateral] = useState<CollateralRecord | null>(null);
  const [auditEntries, setAuditEntries] = useState<AuditLogEntry[]>([]);
  const [perfectionRequests, setPerfectionRequests] = useState<PerfectionRequest[]>([]);
  const [loanLinks, setLoanLinks] = useState<CollateralLoanLink[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [auditFilter, setAuditFilter] = useState('All');
  const [showDropdown, setShowDropdown] = useState(false);

  // Load collateral list
  useEffect(() => {
    setLoadingCollaterals(true);
    collateralService.getAll().then((all) => {
      setCollaterals(all);
      setLoadingCollaterals(false);
    }).catch(() => setLoadingCollaterals(false));
  }, []);

  // Load detail when selection changes
  const loadDetail = useCallback(async (collateral: CollateralRecord) => {
    setLoadingDetail(true);
    setSelectedCollateral(collateral);
    try {
      const [allAudit, allPerfection, links] = await Promise.all([
        auditLogService.getAll({ collateralId: collateral.collateralId }, 200),
        perfectionService.getAll(),
        collateralLinkService.getLinksByCollateral(collateral.id),
      ]);
      setAuditEntries(allAudit);
      setPerfectionRequests(
        allPerfection.filter(
          (p) => p.collateralId === collateral.collateralId || p.collateralRecordId === collateral.id
        )
      );
      setLoanLinks(links);
    } catch {
      // silently fail
    } finally {
      setLoadingDetail(false);
    }
  }, []);

  const handleSelect = useCallback((c: CollateralRecord) => {
    setSelectedId(c.id);
    setShowDropdown(false);
    setSearchQuery(c.collateralId + ' — ' + c.obligor);
    loadDetail(c);
  }, [loadDetail]);

  const filteredCollaterals = collaterals.filter((c) => {
    const q = searchQuery.toLowerCase();
    return (
      c.collateralId.toLowerCase().includes(q) ||
      c.obligor.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  const filteredAudit = auditFilter === 'All'
    ? auditEntries
    : auditEntries.filter((e) => e.action === auditFilter);

  const distinctActions = Array.from(new Set(auditEntries.map((e) => e.action)));

  const statusCfg = selectedCollateral ? STATUS_COLORS[selectedCollateral.status] : null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Page header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-gray-900">Collateral History</h1>
              <p className="text-sm text-gray-500 mt-0.5">
                Full history, linked loan requests, approval timeline, and audit events for any collateral.
              </p>
            </div>
            {selectedCollateral && (
              <button
                onClick={() => loadDetail(selectedCollateral)}
                className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                <RefreshCw size={13} />
                Refresh
              </button>
            )}
          </div>

          {/* Collateral selector */}
          <div className="mt-4 relative max-w-xl">
            <div className="relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search collateral by ID, obligor, or description…"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                  if (!e.target.value) {
                    setSelectedId('');
                    setSelectedCollateral(null);
                  }
                }}
                onFocus={() => setShowDropdown(true)}
                className="w-full pl-9 pr-4 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white"
              />
              {loadingCollaterals && (
                <Loader2 size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 animate-spin" />
              )}
            </div>

            {showDropdown && searchQuery && filteredCollaterals.length > 0 && (
              <div className="absolute z-20 top-full mt-1 w-full bg-white border border-gray-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
                {filteredCollaterals.slice(0, 20).map((c) => {
                  const sc = STATUS_COLORS[c.status];
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleSelect(c)}
                      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 text-left border-b border-gray-100 last:border-0 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-800">{c.collateralId}</span>
                          <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${sc.bg} ${sc.text} border ${sc.border}`}>
                            {c.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 truncate mt-0.5">{c.obligor} · {c.type}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Empty state */}
        {!selectedCollateral && !loadingDetail && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
              <History size={24} className="text-gray-400" />
            </div>
            <p className="text-base font-medium text-gray-700">Select a collateral to view its history</p>
            <p className="text-sm text-gray-400 mt-1">Search by collateral ID, obligor name, or description above.</p>
          </div>
        )}

        {loadingDetail && (
          <div className="flex items-center justify-center py-24 gap-3 text-gray-500">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Loading collateral history…</span>
          </div>
        )}

        {selectedCollateral && !loadingDetail && (
          <div className="space-y-6">
            {/* Collateral overview card */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
                    <Shield size={18} className="text-blue-600" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-base font-semibold text-gray-900">{selectedCollateral.collateralId}</h2>
                      {statusCfg && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusCfg.bg} ${statusCfg.text} border ${statusCfg.border}`}>
                          {selectedCollateral.status}
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mt-0.5">{selectedCollateral.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6 flex-wrap text-sm">
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Audit Events</p>
                    <p className="text-lg font-semibold text-gray-800">{auditEntries.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Loan Requests</p>
                    <p className="text-lg font-semibold text-gray-800">{perfectionRequests.length}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-xs text-gray-400 mb-0.5">Linked Loans</p>
                    <p className="text-lg font-semibold text-gray-800">{loanLinks.length}</p>
                  </div>
                </div>
              </div>

              {/* Key details grid */}
              <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-gray-100">
                {[
                  { label: 'Obligor', value: selectedCollateral.obligor, icon: <Building2 size={13} /> },
                  { label: 'Type', value: selectedCollateral.type, icon: <Tag size={13} /> },
                  { label: 'Registry', value: selectedCollateral.registry, icon: <BookOpen size={13} /> },
                  { label: 'Perfection Deadline', value: formatDate(selectedCollateral.perfectionDeadline), icon: <Calendar size={13} /> },
                ].map((item) => (
                  <div key={item.label}>
                    <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-1">
                      {item.icon}
                      {item.label}
                    </div>
                    <p className="text-sm font-medium text-gray-700">{item.value || '—'}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Two-column layout: Linked Loans + Approval Timeline */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Linked Loan Requests */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <SectionHeader
                  icon={<Link2 size={15} />}
                  title="Linked Loan Requests"
                  count={loanLinks.length}
                />
                {loanLinks.length === 0 ? (
                  <EmptyRow message="No loan accounts linked to this collateral." />
                ) : (
                  <div className="space-y-2">
                    {loanLinks.map((link) => {
                      const isActive = link.status === 'ACTIVE';
                      return (
                        <div
                          key={link.id}
                          className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100"
                        >
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800">{link.loanAccountId}</span>
                              <span className={`text-xs px-1.5 py-0.5 rounded-full font-medium ${isActive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'}`}>
                                {link.status}
                              </span>
                              <span className="text-xs text-gray-400">Rank #{link.chargeRank}</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">{link.beneficiaryName}</p>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                              <span>TZS {link.allocatedAmount.toLocaleString()}</span>
                              <span>·</span>
                              <span>From {formatDate(link.startDate)}</span>
                              {link.endDate && <><span>·</span><span>To {formatDate(link.endDate)}</span></>}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Approval Timeline */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5">
                <SectionHeader
                  icon={<GitBranch size={15} />}
                  title="Approval Timeline"
                  count={perfectionRequests.length}
                />
                {perfectionRequests.length === 0 ? (
                  <EmptyRow message="No perfection requests found for this collateral." />
                ) : (
                  <div className="space-y-2">
                    {perfectionRequests.map((req) => (
                      <ApprovalTimeline key={req.id} request={req} />
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Audit Events */}
            <div className="bg-white rounded-2xl border border-gray-200 p-5">
              <div className="flex items-center gap-2 mb-4">
                <div className="p-1.5 rounded-lg bg-gray-100 text-gray-600">
                  <Activity size={15} />
                </div>
                <h3 className="text-sm font-semibold text-gray-800">Audit Events</h3>
                <span className="ml-auto text-xs font-medium bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{filteredAudit.length}</span>

                {/* Action filter */}
                <div className="relative ml-2">
                  <select
                    value={auditFilter}
                    onChange={(e) => setAuditFilter(e.target.value)}
                    className="text-xs border border-gray-200 rounded-lg px-2 py-1.5 bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 appearance-none pr-6 cursor-pointer"
                  >
                    <option value="All">All actions</option>
                    {distinctActions.map((a) => (
                      <option key={a} value={a}>{a.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                  <Filter size={10} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                </div>
              </div>

              {filteredAudit.length === 0 ? (
                <EmptyRow message="No audit events found for this collateral." />
              ) : (
                <div className="relative pl-5">
                  <div className="absolute left-1.5 top-0 bottom-0 w-px bg-gray-100" />
                  {filteredAudit.map((entry) => (
                    <div key={entry.id} className="relative mb-3 last:mb-0 group">
                      <div className="absolute -left-3.5 top-1.5 w-2.5 h-2.5 rounded-full border-2 border-white bg-gray-200 group-hover:bg-blue-300 transition-colors shadow-sm flex items-center justify-center" />
                      <div className="ml-2 p-3 rounded-xl bg-gray-50 border border-gray-100 hover:border-gray-200 transition-colors">
                        <div className="flex items-start gap-2">
                          <div className="mt-0.5 shrink-0">{getActionIcon(entry.action)}</div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-sm font-medium text-gray-800 leading-tight">{entry.message}</span>
                              <span className="text-xs px-1.5 py-0.5 rounded bg-white border border-gray-200 text-gray-500 capitalize shrink-0">
                                {entry.action.replace(/_/g, ' ')}
                              </span>
                            </div>
                            {entry.detail && (
                              <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{entry.detail}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400 flex-wrap">
                              <span className="flex items-center gap-1">
                                <User size={10} />
                                {entry.performedByName}
                              </span>
                              {entry.eventCategory && (
                                <span className="flex items-center gap-1">
                                  <Tag size={10} />
                                  {entry.eventCategory.replace(/_/g, ' ')}
                                </span>
                              )}
                              <span className="ml-auto flex items-center gap-1">
                                <Clock size={10} />
                                {timeAgo(entry.createdAt)}
                                <span className="text-gray-300 ml-1">{formatDateTime(entry.createdAt)}</span>
                              </span>
                            </div>
                            {/* Field changes */}
                            {entry.fieldChanges && entry.fieldChanges.length > 0 && (
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {entry.fieldChanges.map((fc, i) => (
                                  <span key={i} className="text-xs bg-white border border-gray-200 rounded px-2 py-0.5 text-gray-600">
                                    <span className="font-medium">{fc.label}</span>:&nbsp;
                                    <span className="line-through text-gray-400">{fc.old_value}</span>
                                    &nbsp;→&nbsp;
                                    <span className="text-gray-700">{fc.new_value}</span>
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Click-outside handler for dropdown */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-10"
          onClick={() => setShowDropdown(false)}
        />
      )}
    </div>
  );
}
