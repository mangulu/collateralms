'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ClipboardList,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Filter,
  Search,
  ChevronDown,
  Shield,
  FileText,
  CalendarClock,
  User,
  Building2,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { collateralService, type AuditLog, type CollateralRecord } from '@/lib/supabase/collateralService';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceSummary {
  totalCollateral: number;
  compliant: number;
  nonCompliant: number;
  pendingReview: number;
  overdueDeadlines: number;
  perfectionRate: string;
}

interface DeadlineRecord {
  id: string;
  collateralId: string;
  obligor: string;
  type: string;
  registry: string;
  perfectionDeadline: string;
  daysToDeadline: number | null;
  status: string;
  assignedOfficer: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function deadlineUrgency(days: number | null): 'overdue' | 'critical' | 'warning' | 'ok' {
  if (days === null) return 'ok';
  if (days < 0) return 'overdue';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'ok';
}

const actionColorMap: Record<string, string> = {
  CREATE: 'bg-green-100 text-green-700',
  UPDATE: 'bg-blue-100 text-blue-700',
  DELETE: 'bg-red-100 text-red-700',
  STATUS_CHANGE: 'bg-purple-100 text-purple-700',
  DOCUMENT_UPLOAD: 'bg-amber-100 text-amber-700',
  DOCUMENT_DELETE: 'bg-orange-100 text-orange-700',
  REVIEW: 'bg-cyan-100 text-cyan-700',
};

const statusBadge: Record<string, string> = {
  Perfected: 'bg-green-100 text-green-700 border-green-200',
  Overdue: 'bg-red-100 text-red-700 border-red-200',
  'Under Review': 'bg-blue-100 text-blue-700 border-blue-200',
  Submitted: 'bg-purple-100 text-purple-700 border-purple-200',
  Monitoring: 'bg-amber-100 text-amber-700 border-amber-200',
  Draft: 'bg-gray-100 text-gray-600 border-gray-200',
  Released: 'bg-teal-100 text-teal-700 border-teal-200',
  Rejected: 'bg-rose-100 text-rose-700 border-rose-200',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SummaryCard({
  label, value, sub, icon: Icon, variant = 'default',
}: {
  label: string; value: string | number; sub: string;
  icon: React.ElementType; variant?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const bg = { default: 'bg-white border-border', success: 'bg-green-50 border-green-200', danger: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200' };
  const iconBg = { default: 'bg-primary/10 text-primary', success: 'bg-green-100 text-green-600', danger: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600' };
  const valColor = { default: 'text-foreground', success: 'text-green-700', danger: 'text-red-700', warning: 'text-amber-700' };
  return (
    <div className={`rounded-xl p-5 shadow-card border ${bg[variant]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight pr-2">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-3xl font-bold tabular-nums mb-1 font-mono ${valColor[variant]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function SectionHeader({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-base font-semibold text-foreground">{title}</h2>
      <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceAuditContent() {
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [auditSearch, setAuditSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('All');
  const [deadlineFilter, setDeadlineFilter] = useState('All');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const [logsResult, collateralsResult] = await Promise.all([
        supabase.from('audit_logs').select('*').order('created_at', { ascending: false }).limit(200),
        collateralService.getAll(),
      ]);

      const logs: AuditLog[] = (logsResult.data ?? []).map((row: any) => ({
        id: row.id,
        collateralRecordId: row.collateral_record_id,
        collateralId: row.collateral_id,
        action: row.action,
        message: row.message,
        detail: row.detail ?? '',
        performedBy: row.performed_by,
        performedByName: row.performed_by_name ?? '',
        createdAt: row.created_at,
      }));

      setAuditLogs(logs);
      setCollaterals(collateralsResult);

      const total = collateralsResult.length;
      const perfected = collateralsResult.filter((c) => c.status === 'Perfected').length;
      const overdue = collateralsResult.filter((c) => c.status === 'Overdue').length;
      const pending = collateralsResult.filter((c) => c.status === 'Under Review' || c.status === 'Submitted').length;
      const nonCompliant = collateralsResult.filter((c) => c.status === 'Rejected' || c.status === 'Overdue').length;

      setSummary({
        totalCollateral: total,
        compliant: perfected,
        nonCompliant,
        pendingReview: pending,
        overdueDeadlines: overdue,
        perfectionRate: total > 0 ? ((perfected / total) * 100).toFixed(1) : '0.0',
      });
      setLastRefreshed(new Date());
    } catch (err) {
      console.error('Failed to load compliance data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered audit logs
  const uniqueActions = ['All', ...Array.from(new Set(auditLogs.map((l) => l.action)))];
  const filteredLogs = auditLogs.filter((log) => {
    const matchesSearch =
      !auditSearch ||
      log.message.toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.collateralId ?? '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.performedByName.toLowerCase().includes(auditSearch.toLowerCase());
    const matchesAction = actionFilter === 'All' || log.action === actionFilter;
    return matchesSearch && matchesAction;
  });

  // Deadline records
  const deadlineRecords: DeadlineRecord[] = collaterals
    .filter((c) => c.requiresPerfection && c.perfectionDeadline)
    .map((c) => ({
      id: c.id,
      collateralId: c.collateralId,
      obligor: c.obligor,
      type: c.type,
      registry: c.registry,
      perfectionDeadline: c.perfectionDeadline,
      daysToDeadline: c.daysToDeadline,
      status: c.status,
      assignedOfficer: c.assignedOfficer,
    }));

  const filteredDeadlines = deadlineRecords.filter((d) => {
    if (deadlineFilter === 'All') return true;
    if (deadlineFilter === 'Overdue') return (d.daysToDeadline ?? 0) < 0 || d.status === 'Overdue';
    if (deadlineFilter === 'Critical') return d.daysToDeadline !== null && d.daysToDeadline >= 0 && d.daysToDeadline <= 3;
    if (deadlineFilter === 'This Week') return d.daysToDeadline !== null && d.daysToDeadline >= 0 && d.daysToDeadline <= 7;
    return true;
  });

  // Compliance by collateral (group audit logs per collateral)
  const complianceByCollateral = collaterals.slice(0, 12).map((c) => {
    const logs = auditLogs.filter((l) => l.collateralId === c.collateralId);
    const isCompliant = c.status === 'Perfected';
    const isNonCompliant = c.status === 'Overdue' || c.status === 'Rejected';
    return { ...c, logCount: logs.length, isCompliant, isNonCompliant };
  });

  const handleExport = () => {
    setExportingPDF(true);
    setTimeout(() => {
      const rows = [
        ['Collateral ID', 'Obligor', 'Type', 'Status', 'Registry', 'Perfection Deadline', 'Days to Deadline', 'Assigned Officer'],
        ...deadlineRecords.map((d) => [
          d.collateralId, d.obligor, d.type, d.status, d.registry,
          formatDate(d.perfectionDeadline),
          d.daysToDeadline !== null ? String(d.daysToDeadline) : 'N/A',
          d.assignedOfficer,
        ]),
      ];
      const csv = rows.map((r) => r.map((v) => `"${v}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `compliance-audit-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      setExportingPDF(false);
    }, 600);
  };

  if (isLoading) {
    return (
      <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
        <div className="h-8 w-64 bg-muted animate-pulse rounded mb-2" />
        <div className="h-4 w-96 bg-muted animate-pulse rounded mb-8" />
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={`sk-${i}`} className="h-28 bg-muted animate-pulse rounded-xl" />
          ))}
        </div>
        <div className="h-64 bg-muted animate-pulse rounded-xl mb-6" />
        <div className="h-64 bg-muted animate-pulse rounded-xl" />
      </div>
    );
  }

  return (
    <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-7">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <ClipboardList size={18} className="text-primary" />
            </div>
            <h1 className="text-xl font-bold text-foreground">Compliance & Audit Trail</h1>
          </div>
          <p className="text-sm text-muted-foreground ml-10.5">
            Legal officer review · Regulatory submission records · BRELA / Registry deadline enforcement
          </p>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground ml-10.5 mt-1">
              Last refreshed: {formatDateTime(lastRefreshed.toISOString())}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={handleExport}
            disabled={exportingPDF}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            <Download size={14} />
            {exportingPDF ? 'Exporting…' : 'Export CSV'}
          </button>
        </div>
      </div>

      {/* ── Summary KPIs ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
        <SummaryCard label="Total Collateral Items" value={summary?.totalCollateral ?? 0} sub="Active items in registry" icon={Building2} variant="default" />
        <SummaryCard label="Compliant (Perfected)" value={summary?.compliant ?? 0} sub={`${summary?.perfectionRate ?? '0.0'}% perfection rate`} icon={CheckCircle2} variant="success" />
        <SummaryCard label="Non-Compliant" value={summary?.nonCompliant ?? 0} sub="Overdue or rejected items" icon={XCircle} variant="danger" />
        <SummaryCard label="Pending Legal Review" value={summary?.pendingReview ?? 0} sub="Submitted or under review" icon={Clock} variant="warning" />
        <SummaryCard label="Overdue Deadlines" value={summary?.overdueDeadlines ?? 0} sub="Past BRELA/registry deadline" icon={AlertTriangle} variant="danger" />
        <SummaryCard label="Audit Log Entries" value={auditLogs.length} sub="Total recorded actions" icon={FileText} variant="default" />
      </div>

      {/* ── Compliance Status by Collateral ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-6">
        <SectionHeader
          title="Compliance Status by Collateral"
          sub="Per-item compliance overview for legal officer review and regulatory submission"
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collateral ID</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Obligor</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registry</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance</th>
                <th className="text-right py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Audit Events</th>
              </tr>
            </thead>
            <tbody>
              {complianceByCollateral.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">No collateral records found.</td>
                </tr>
              ) : (
                complianceByCollateral.map((c) => (
                  <tr key={c.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                    <td className="py-3 px-3 font-mono text-xs text-primary font-medium">{c.collateralId}</td>
                    <td className="py-3 px-3 text-foreground font-medium max-w-[160px] truncate">{c.obligor}</td>
                    <td className="py-3 px-3 text-muted-foreground">{c.type}</td>
                    <td className="py-3 px-3 text-muted-foreground">{c.registry}</td>
                    <td className="py-3 px-3">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge[c.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                        {c.status}
                      </span>
                    </td>
                    <td className="py-3 px-3">
                      {c.isCompliant ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700">
                          <CheckCircle2 size={13} /> Compliant
                        </span>
                      ) : c.isNonCompliant ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-red-600">
                          <XCircle size={13} /> Non-Compliant
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-600">
                          <Clock size={13} /> In Progress
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold">
                        {c.logCount}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Regulatory Deadline Enforcement ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <SectionHeader
            title="Regulatory Deadline Enforcement"
            sub="BRELA, Lands Registry, TRA, DSE, and TASAC perfection deadlines"
          />
          <div className="flex items-center gap-2 shrink-0">
            <CalendarClock size={14} className="text-muted-foreground" />
            <select
              value={deadlineFilter}
              onChange={(e) => setDeadlineFilter(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1.5 bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
            >
              {['All', 'Overdue', 'Critical', 'This Week'].map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collateral ID</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Obligor</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type / Registry</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfection Deadline</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Remaining</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Assigned Officer</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeadlines.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-muted-foreground text-sm">No deadline records match the selected filter.</td>
                </tr>
              ) : (
                filteredDeadlines.map((d) => {
                  const urgency = deadlineUrgency(d.daysToDeadline);
                  const daysLabel =
                    d.daysToDeadline === null ? '—'
                    : d.daysToDeadline < 0 ? `${Math.abs(d.daysToDeadline)}d overdue`
                    : d.daysToDeadline === 0 ? 'Due today'
                    : `${d.daysToDeadline}d left`;
                  const daysColor = {
                    overdue: 'text-red-600 font-semibold',
                    critical: 'text-red-500 font-semibold',
                    warning: 'text-amber-600 font-medium',
                    ok: 'text-muted-foreground',
                  }[urgency];
                  const rowBg = urgency === 'overdue' ? 'bg-red-50/40' : urgency === 'critical' ? 'bg-orange-50/30' : '';
                  return (
                    <tr key={d.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${rowBg}`}>
                      <td className="py-3 px-3 font-mono text-xs text-primary font-medium">{d.collateralId}</td>
                      <td className="py-3 px-3 text-foreground font-medium max-w-[140px] truncate">{d.obligor}</td>
                      <td className="py-3 px-3">
                        <span className="text-foreground">{d.type}</span>
                        <span className="text-muted-foreground text-xs ml-1">· {d.registry}</span>
                      </td>
                      <td className="py-3 px-3 text-muted-foreground font-mono text-xs">{formatDate(d.perfectionDeadline)}</td>
                      <td className={`py-3 px-3 font-mono text-xs ${daysColor}`}>{daysLabel}</td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${statusBadge[d.status] ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                          {d.status}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <User size={11} />
                          {d.assignedOfficer || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Audit Trail Log ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
          <SectionHeader
            title="Audit Trail Log"
            sub="Full chronological record of all system actions for regulatory submission"
          />
          <div className="flex items-center gap-2 shrink-0">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder="Search logs…"
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-7 pr-3 py-1.5 text-xs border border-border rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-primary/40 w-44"
              />
            </div>
            <div className="relative">
              <Filter size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <select
                value={actionFilter}
                onChange={(e) => setActionFilter(e.target.value)}
                className="pl-7 pr-6 py-1.5 text-xs border border-border rounded-md bg-white text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 appearance-none"
              >
                {uniqueActions.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
              <ChevronDown size={11} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>
        </div>

        {filteredLogs.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-sm">
            <ClipboardList size={32} className="mx-auto mb-2 opacity-30" />
            No audit log entries match your search.
          </div>
        ) : (
          <div className="space-y-0 divide-y divide-border/50">
            {filteredLogs.map((log) => (
              <div key={log.id} className="py-3 flex items-start gap-3 hover:bg-muted/20 px-2 -mx-2 rounded transition-colors">
                <div className="shrink-0 mt-0.5">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${actionColorMap[log.action] ?? 'bg-gray-100 text-gray-600'}`}>
                    {log.action}
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium leading-snug">{log.message}</p>
                  {log.detail && (
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{log.detail}</p>
                  )}
                  <div className="flex items-center gap-3 mt-1 flex-wrap">
                    {log.collateralId && (
                      <span className="inline-flex items-center gap-1 text-xs text-primary font-mono">
                        <Shield size={10} />
                        {log.collateralId}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                      <User size={10} />
                      {log.performedByName || 'System'}
                    </span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-muted-foreground font-mono whitespace-nowrap">{formatDateTime(log.createdAt)}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {filteredLogs.length > 0 && (
          <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-semibold text-foreground">{filteredLogs.length}</span> of <span className="font-semibold text-foreground">{auditLogs.length}</span> entries
            </p>
            <p className="text-xs text-muted-foreground">For regulatory submission — export CSV above</p>
          </div>
        )}
      </div>
    </div>
  );
}
