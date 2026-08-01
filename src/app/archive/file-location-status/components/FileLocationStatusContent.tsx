'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  MapPin, RefreshCw, AlertCircle, CheckCircle2, ArrowDownToLine,
  AlertTriangle, RotateCcw, Search, ChevronDown, ChevronUp,
  User, Calendar, Clock, Building2, X,
} from 'lucide-react';
import {
  archiveCustodyService, archiveRequestService, archivePlacementService,
  ArchiveCustody, ArchiveRequest, ArchivePlacement, CustodyStatus,
} from '@/lib/supabase/archiveService';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface FileLocationRow {
  custody: ArchiveCustody;
  placement: ArchivePlacement | null;
  activeRequests: ArchiveRequest[];
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CustodyStatus, { label: string; bg: string; text: string; border: string; icon: React.ElementType; dot: string }> = {
  in_vault:  { label: 'In Vault',       bg: '#F0FDF4', text: '#15803D', border: '#BBF7D0', icon: CheckCircle2,    dot: '#22C55E' },
  on_loan:   { label: 'Checked Out',    bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE', icon: ArrowDownToLine, dot: '#3B82F6' },
  overdue:   { label: 'Pending Return', bg: '#FFF7ED', text: '#C2410C', border: '#FED7AA', icon: AlertTriangle,   dot: '#F97316' },
  returned:  { label: 'Returned',       bg: '#F0F9FF', text: '#0369A1', border: '#BAE6FD', icon: RotateCcw,       dot: '#0EA5E9' },
  missing:   { label: 'Missing',        bg: '#FFF1F2', text: '#BE123C', border: '#FECDD3', icon: AlertCircle,     dot: '#F43F5E' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ─── Drill-down drawer ────────────────────────────────────────────────────────

interface DrillDownDrawerProps {
  row: FileLocationRow;
  onClose: () => void;
}

function DrillDownDrawer({ row, onClose }: DrillDownDrawerProps) {
  const { custody, placement, activeRequests } = row;
  const sc = STATUS_CONFIG[custody.currentStatus];
  const StatusIcon = sc.icon;

  return (
    <div className="fixed inset-0 z-40 flex justify-end" onClick={onClose}>
      <div
        className="w-full max-w-sm bg-white shadow-2xl h-full flex flex-col overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between p-5 border-b sticky top-0 bg-white z-10"
          style={{ borderColor: '#E5E7EB' }}
        >
          <div>
            <h3 className="text-base font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>
              File Location Detail
            </h3>
            <p className="text-xs mt-0.5" style={{ color: '#6B7280' }}>
              {custody.collateral?.collateral_type ?? 'Unknown'} — {custody.collateral?.obligor ?? '—'}
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} style={{ color: '#6B7280' }} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Current status */}
          <div
            className="rounded-xl p-4"
            style={{ backgroundColor: sc.bg, border: `1px solid ${sc.border}` }}
          >
            <div className="flex items-center gap-2 mb-1">
              <StatusIcon size={16} style={{ color: sc.text }} />
              <span className="text-sm font-semibold" style={{ color: sc.text }}>{sc.label}</span>
            </div>
            {custody.currentStatus === 'in_vault' && placement && (
              <p className="text-xs mt-1" style={{ color: '#374151' }}>
                <span className="font-medium">Location:</span>{' '}
                {placement.location?.name ?? '—'}{placement.location?.code ? ` (${placement.location.code})` : ''}
              </p>
            )}
            {(custody.currentStatus === 'on_loan' || custody.currentStatus === 'overdue') && (
              <div className="space-y-1 mt-1">
                {custody.checkedOutByProfile && (
                  <p className="text-xs" style={{ color: '#374151' }}>
                    <span className="font-medium">Checked out by:</span> {custody.checkedOutByProfile.full_name}
                  </p>
                )}
                {custody.lastCheckedOutAt && (
                  <p className="text-xs" style={{ color: '#374151' }}>
                    <span className="font-medium">Since:</span> {fmtDate(custody.lastCheckedOutAt)}
                  </p>
                )}
                {custody.overdueSince && (
                  <p className="text-xs font-semibold" style={{ color: '#BE123C' }}>
                    Overdue since {fmtDate(custody.overdueSince)}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Vault slot */}
          {placement && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
                Vault Slot
              </p>
              <div className="rounded-xl p-3 space-y-1" style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}>
                <div className="flex items-center gap-2">
                  <Building2 size={13} style={{ color: '#3B82F6' }} />
                  <span className="text-sm font-medium" style={{ color: '#1E3A8A' }}>
                    {placement.location?.name ?? '—'}
                  </span>
                  {placement.location?.code && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ backgroundColor: '#DBEAFE', color: '#1D4ED8' }}>
                      {placement.location.code}
                    </span>
                  )}
                </div>
                {placement.physicalRef && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>Ref: {placement.physicalRef}</p>
                )}
                {placement.notes && (
                  <p className="text-xs" style={{ color: '#6B7280' }}>{placement.notes}</p>
                )}
              </div>
            </div>
          )}

          {/* Active requests */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
              Active Requests ({activeRequests.length})
            </p>
            {activeRequests.length === 0 ? (
              <p className="text-xs" style={{ color: '#9CA3AF' }}>No active requests for this file.</p>
            ) : (
              <div className="space-y-2">
                {activeRequests.map((req) => {
                  const reqStatuses: Record<string, { bg: string; text: string; label: string }> = {
                    pending:     { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
                    approved:    { bg: '#F0FDF4', text: '#15803D', label: 'Approved' },
                    checked_out: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Checked Out' },
                  };
                  const rs = reqStatuses[req.requestStatus] ?? { bg: '#F3F4F6', text: '#374151', label: req.requestStatus };
                  return (
                    <div
                      key={req.id}
                      className="rounded-xl p-3 space-y-1.5"
                      style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5">
                          <User size={12} style={{ color: '#6B7280' }} />
                          <span className="text-xs font-medium" style={{ color: '#1E3A8A' }}>
                            {req.requestedByProfile?.full_name ?? 'Unknown'}
                          </span>
                        </div>
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium"
                          style={{ backgroundColor: rs.bg, color: rs.text }}
                        >
                          {rs.label}
                        </span>
                      </div>
                      <p className="text-xs" style={{ color: '#374151' }}>{req.purpose}</p>
                      {req.expectedReturnDate && (
                        <div className="flex items-center gap-1.5">
                          <Calendar size={11} style={{ color: '#9CA3AF' }} />
                          <span className="text-xs" style={{ color: '#6B7280' }}>
                            Due: {fmtDate(req.expectedReturnDate)}
                          </span>
                        </div>
                      )}
                      <p className="text-xs" style={{ color: '#9CA3AF' }}>
                        Raised {fmtDate(req.createdAt)}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function FileLocationStatusContent() {
  const [rows, setRows] = useState<FileLocationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CustodyStatus | 'all'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [drawerRow, setDrawerRow] = useState<FileLocationRow | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await archiveCustodyService.flagOverdue();
      const [custodyList, placements, requests] = await Promise.all([
        archiveCustodyService.getAll(),
        archivePlacementService.getAll(),
        archiveRequestService.getAll(),
      ]);

      const placementMap = new Map<string, ArchivePlacement>();
      placements.forEach((p) => placementMap.set(p.collateralId, p));

      const activeStatuses = new Set(['pending', 'approved', 'checked_out']);
      const requestsByCollateral = new Map<string, ArchiveRequest[]>();
      requests.forEach((r) => {
        if (!activeStatuses.has(r.requestStatus)) return;
        const list = requestsByCollateral.get(r.collateralId) ?? [];
        list.push(r);
        requestsByCollateral.set(r.collateralId, list);
      });

      const built: FileLocationRow[] = custodyList.map((c) => ({
        custody: c,
        placement: placementMap.get(c.collateralId) ?? null,
        activeRequests: requestsByCollateral.get(c.collateralId) ?? [],
      }));

      setRows(built);
      setLastRefreshed(new Date());
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    // Real-time subscriptions
    const sub1 = archiveCustodyService.subscribeToChanges(load);
    const sub2 = archiveRequestService.subscribeToChanges(load);
    const sub3 = archivePlacementService.subscribeToChanges(load);
    return () => {
      sub1.unsubscribe();
      sub2.unsubscribe();
      sub3.unsubscribe();
    };
  }, [load]);

  const filtered = rows.filter((row) => {
    const q = search.toLowerCase();
    const c = row.custody.collateral;
    const matchSearch =
      !q ||
      c?.obligor?.toLowerCase().includes(q) ||
      c?.collateral_type?.toLowerCase().includes(q) ||
      c?.description?.toLowerCase().includes(q) ||
      row.placement?.location?.name?.toLowerCase().includes(q) ||
      row.placement?.physicalRef?.toLowerCase().includes(q);
    const matchStatus = statusFilter === 'all' || row.custody.currentStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const counts = rows.reduce((acc, r) => {
    acc[r.custody.currentStatus] = (acc[r.custody.currentStatus] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold" style={{ color: '#1E3A8A', fontFamily: 'DM Sans, sans-serif' }}>
            File Location Status
          </h1>
          <p className="text-sm mt-0.5" style={{ color: '#3B82F6' }}>
            Real-time location status for every physical collateral file
          </p>
        </div>
        <div className="flex items-center gap-3">
          {lastRefreshed && (
            <span className="text-xs hidden sm:block" style={{ color: '#9CA3AF' }}>
              Updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <button
            onClick={load}
            className="p-2 rounded-lg border transition-colors hover:bg-blue-50"
            style={{ borderColor: '#BFDBFE' }}
          >
            <RefreshCw size={16} style={{ color: '#2563EB' }} />
          </button>
        </div>
      </div>

      {/* Status summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-5">
        {(Object.keys(STATUS_CONFIG) as CustodyStatus[]).map((s) => {
          const sc = STATUS_CONFIG[s];
          const Icon = sc.icon;
          const active = statusFilter === s;
          return (
            <button
              key={s}
              onClick={() => setStatusFilter(active ? 'all' : s)}
              className="rounded-xl p-3 text-left transition-all"
              style={{
                backgroundColor: active ? sc.bg : '#F8FAFF',
                border: `1px solid ${active ? sc.border : '#DBEAFE'}`,
              }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: sc.dot }}
                />
                <Icon size={13} style={{ color: sc.text }} />
              </div>
              <p className="text-lg font-bold" style={{ color: sc.text }}>{counts[s] ?? 0}</p>
              <p className="text-xs font-medium" style={{ color: '#6B7280' }}>{sc.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-4">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#9CA3AF' }} />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          style={{ borderColor: '#DBEAFE', backgroundColor: '#F8FAFF' }}
          placeholder="Search by collateral, obligor, location…"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl mb-4 bg-red-50 text-red-700 text-sm">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {/* Table */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 rounded-xl animate-pulse" style={{ backgroundColor: '#EFF6FF' }} />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16">
          <MapPin size={40} className="mx-auto mb-3" style={{ color: '#93C5FD' }} />
          <p className="text-sm font-medium" style={{ color: '#1E3A8A' }}>No files found</p>
          <p className="text-xs mt-1" style={{ color: '#3B82F6' }}>
            {rows.length === 0 ? 'No custody records exist yet.' : 'Try adjusting your search or filter.'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((row) => {
            const { custody, placement, activeRequests } = row;
            const sc = STATUS_CONFIG[custody.currentStatus];
            const StatusIcon = sc.icon;
            const isExpanded = expandedId === custody.id;
            const isOverdue = custody.currentStatus === 'overdue';
            const hasActiveReqs = activeRequests.length > 0;

            return (
              <div
                key={custody.id}
                className="rounded-xl overflow-hidden"
                style={{ border: `1px solid ${isOverdue ? '#FED7AA' : '#DBEAFE'}` }}
              >
                {/* Row */}
                <div
                  className="flex items-center gap-4 p-4"
                  style={{ backgroundColor: isOverdue ? '#FFFBEB' : '#F8FAFF' }}
                >
                  {/* Status icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                    style={{ backgroundColor: sc.bg }}
                  >
                    <StatusIcon size={18} style={{ color: sc.text }} />
                  </div>

                  {/* Main info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold truncate" style={{ color: '#1E3A8A' }}>
                        {custody.collateral?.collateral_type ?? 'Unknown'} — {custody.collateral?.obligor ?? '—'}
                      </p>
                      <span
                        className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                        style={{ backgroundColor: sc.bg, color: sc.text, border: `1px solid ${sc.border}` }}
                      >
                        {sc.label}
                      </span>
                      {hasActiveReqs && (
                        <span
                          className="text-xs px-2 py-0.5 rounded-full font-medium shrink-0"
                          style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' }}
                        >
                          {activeRequests.length} active request{activeRequests.length > 1 ? 's' : ''}
                        </span>
                      )}
                    </div>

                    {/* Sub-details */}
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {custody.currentStatus === 'in_vault' && placement?.location && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                          <Building2 size={11} />
                          {placement.location.name}
                          {placement.location.code ? ` (${placement.location.code})` : ''}
                        </span>
                      )}
                      {(custody.currentStatus === 'on_loan' || custody.currentStatus === 'overdue') && (
                        <>
                          {custody.checkedOutByProfile && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                              <User size={11} />
                              {custody.checkedOutByProfile.full_name}
                            </span>
                          )}
                          {/* Due date from active approved request */}
                          {activeRequests.find((r) => r.requestStatus === 'approved' && r.expectedReturnDate) && (
                            <span className="flex items-center gap-1 text-xs" style={{ color: isOverdue ? '#C2410C' : '#6B7280' }}>
                              <Calendar size={11} />
                              Due: {fmtDate(activeRequests.find((r) => r.requestStatus === 'approved')?.expectedReturnDate)}
                            </span>
                          )}
                          {custody.overdueSince && (
                            <span className="flex items-center gap-1 text-xs font-medium" style={{ color: '#BE123C' }}>
                              <Clock size={11} />
                              Overdue since {fmtDate(custody.overdueSince)}
                            </span>
                          )}
                        </>
                      )}
                      {custody.currentStatus === 'returned' && custody.lastReturnedAt && (
                        <span className="flex items-center gap-1 text-xs" style={{ color: '#6B7280' }}>
                          <RotateCcw size={11} />
                          Returned {fmtDate(custody.lastReturnedAt)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setDrawerRow(row)}
                      className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors hover:opacity-80"
                      style={{ backgroundColor: '#EFF6FF', color: '#1D4ED8' }}
                    >
                      View
                    </button>
                    {hasActiveReqs && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : custody.id)}
                        className="p-1.5 rounded-lg transition-colors hover:bg-blue-100"
                        style={{ color: '#3B82F6' }}
                      >
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                </div>

                {/* Expanded requests */}
                {isExpanded && hasActiveReqs && (
                  <div
                    className="border-t px-4 py-3 space-y-2"
                    style={{ borderColor: '#DBEAFE', backgroundColor: '#FFFFFF' }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-wide mb-2" style={{ color: '#9CA3AF' }}>
                      Active Requests
                    </p>
                    {activeRequests.map((req) => {
                      const reqStatuses: Record<string, { bg: string; text: string; label: string }> = {
                        pending:     { bg: '#FFFBEB', text: '#B45309', label: 'Pending' },
                        approved:    { bg: '#F0FDF4', text: '#15803D', label: 'Approved' },
                        checked_out: { bg: '#EFF6FF', text: '#1D4ED8', label: 'Checked Out' },
                      };
                      const rs = reqStatuses[req.requestStatus] ?? { bg: '#F3F4F6', text: '#374151', label: req.requestStatus };
                      return (
                        <div
                          key={req.id}
                          className="flex items-start justify-between gap-3 p-3 rounded-lg"
                          style={{ backgroundColor: '#F8FAFF', border: '1px solid #DBEAFE' }}
                        >
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-0.5">
                              <span className="text-xs font-medium" style={{ color: '#1E3A8A' }}>
                                {req.requestedByProfile?.full_name ?? 'Unknown'}
                              </span>
                              <span
                                className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ backgroundColor: rs.bg, color: rs.text }}
                              >
                                {rs.label}
                              </span>
                            </div>
                            <p className="text-xs truncate" style={{ color: '#6B7280' }}>{req.purpose}</p>
                          </div>
                          {req.expectedReturnDate && (
                            <div className="flex items-center gap-1 shrink-0">
                              <Calendar size={11} style={{ color: '#9CA3AF' }} />
                              <span className="text-xs" style={{ color: '#6B7280' }}>
                                {fmtDate(req.expectedReturnDate)}
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Drill-down drawer */}
      {drawerRow && (
        <DrillDownDrawer row={drawerRow} onClose={() => setDrawerRow(null)} />
      )}
    </div>
  );
}
