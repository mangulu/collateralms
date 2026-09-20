'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ClipboardList,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  FileText,
  CalendarClock,
  User,
  Building2,
  MessageSquare,
  Loader2,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';
import { collateralService, type CollateralRecord } from '@/lib/supabase/collateralService';
import { auditLogService, type AuditLogEntry } from '@/lib/supabase/auditLogService';
import { smsAlertService } from '@/lib/supabase/smsAlertService';
import { buildDeadlineMessage, getAuthorityBadge } from '@/lib/perfectionAuthorities';
import RiskPriorityPanel from './RiskPriorityPanel';


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

// ─── SMS Deadline Modal ───────────────────────────────────────────────────────

interface SmsDeadlineModalProps {
  record: DeadlineRecord;
  onClose: () => void;
}

function SmsDeadlineModal({ record, onClose }: SmsDeadlineModalProps) {
  const [phone, setPhone] = useState('');
  const [recipientName, setRecipientName] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const appUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://collateral8511.builtwithrocket.new';
  const daysLeft = record.daysToDeadline ?? 0;
  const message = buildDeadlineMessage(record.collateralId, record.registry, daysLeft, appUrl);

  const handleSend = async () => {
    if (!phone.trim()) { setError('Phone number is required'); return; }
    setSending(true);
    setError(null);
    const result = await smsAlertService.sendAlert({
      to: phone.trim(),
      recipientName: recipientName.trim() || undefined,
      alertType: 'BRELA_DEADLINE',
      collateralId: record.collateralId,
      actionUrl: `${appUrl}/compliance-audit`,
      message,
    });
    setSending(false);
    if (result.success) {
      setSent(true);
      setTimeout(onClose, 1500);
    } else {
      setError(result.error || 'Failed to send SMS');
    }
  };

  const urgency = daysLeft < 0 ? 'OVERDUE' : daysLeft <= 3 ? 'CRITICAL' : 'WARNING';
  const urgencyColor = urgency === 'OVERDUE' ? 'text-red-700 bg-red-100' : urgency === 'CRITICAL' ? 'text-orange-700 bg-orange-100' : 'text-amber-700 bg-amber-100';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md border border-border">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <MessageSquare size={16} className="text-blue-600" />
            </div>
            <div>
              <h3 className="text-sm font-700 text-foreground">Send {record.registry} Deadline SMS</h3>
              <p className="text-xs text-muted-foreground">{record.collateralId} · {record.obligor}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <XCircle size={16} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-700 ${urgencyColor}`}>
              <AlertTriangle size={12} /> {urgency} — {daysLeft < 0 ? `${Math.abs(daysLeft)} days overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft} days remaining`}
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${getAuthorityBadge(record.registry)}`}>
              {record.registry}
            </span>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Recipient Name (optional)</label>
            <input
              type="text"
              placeholder="e.g. Legal Officer"
              value={recipientName}
              onChange={(e) => setRecipientName(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Phone Number *</label>
            <input
              type="tel"
              placeholder="+255712345678"
              value={phone}
              onChange={(e) => { setPhone(e.target.value); setError(null); }}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Message Preview</label>
            <div className="px-3 py-2 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg leading-relaxed">
              {message}
            </div>
          </div>
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertTriangle size={13} className="shrink-0" /> {error}
            </div>
          )}
          {sent && (
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg text-xs text-green-700">
              <CheckCircle2 size={13} className="shrink-0" /> SMS sent successfully!
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={handleSend}
            disabled={sending || sent}
            className="flex items-center gap-2 px-4 py-2 text-sm font-600 text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-60 rounded-lg transition-colors"
          >
            {sending ? <Loader2 size={14} className="animate-spin" /> : sent ? <CheckCircle2 size={14} /> : <MessageSquare size={14} />}
            {sending ? 'Sending...' : sent ? 'Sent!' : 'Send SMS Alert'}
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-muted-foreground bg-white border border-border hover:bg-muted rounded-lg transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ComplianceAuditContent() {
  const [tab, setTab] = useState<'overview' | 'risk'>('overview');
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [collaterals, setCollaterals] = useState<CollateralRecord[]>([]);
  const [summary, setSummary] = useState<ComplianceSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deadlineFilter, setDeadlineFilter] = useState('All');
  const [exportingPDF, setExportingPDF] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [smsDeadlineRecord, setSmsDeadlineRecord] = useState<DeadlineRecord | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [logs, collateralsResult] = await Promise.all([
        auditLogService.getAll(undefined, 200),
        collateralService.getAll(),
      ]);

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
  const COMPLIANCE_TABLE_LIMIT = 25;
  const complianceByCollateral = collaterals.slice(0, COMPLIANCE_TABLE_LIMIT).map((c) => {
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

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-4 sm:py-6 max-w-screen-2xl mx-auto">
      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-border mb-6">
        <button
          onClick={() => setTab('overview')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ClipboardList size={14} />
          Compliance Overview
        </button>
        <button
          onClick={() => setTab('risk')}
          className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
            tab === 'risk' ? 'border-amber-500 text-amber-600' : 'border-transparent text-muted-foreground hover:text-foreground'
          }`}
        >
          <ShieldAlert size={14} />
          Risk Priority View
        </button>
      </div>

      {tab === 'risk' ? (
        <RiskPriorityPanel />
      ) : isLoading ? (
        <>
          <div className="h-8 w-64 bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-96 bg-muted animate-pulse rounded mb-8" />
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-8">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={`sk-${i}`} className="h-28 bg-muted animate-pulse rounded-xl" />
            ))}
          </div>
          <div className="h-64 bg-muted animate-pulse rounded-xl mb-6" />
          <div className="h-64 bg-muted animate-pulse rounded-xl" />
        </>
      ) : (
        <>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-5 sm:mb-7">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <ClipboardList size={18} className="text-primary" />
            </div>
            <h1 className="text-lg sm:text-xl font-bold" style={{ color: 'var(--izou-primary)' }}>Compliance & Audit Trail</h1>
          </div>
          <p className="text-xs sm:text-sm text-muted-foreground ml-10">
            Legal officer review · Regulatory submission records · Deadline enforcement
          </p>
          {lastRefreshed && (
            <p className="text-xs text-muted-foreground ml-10 mt-1 hidden sm:block">
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
      <div className="grid grid-cols-2 sm:grid-cols-2 xl:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <SummaryCard label="Total Collateral Items" value={summary?.totalCollateral ?? 0} sub="Active items in registry" icon={Building2} variant="default" />
        <SummaryCard label="Compliant (Perfected)" value={summary?.compliant ?? 0} sub={`${summary?.perfectionRate ?? '0.0'}% perfection rate`} icon={CheckCircle2} variant="success" />
        <SummaryCard label="Non-Compliant" value={summary?.nonCompliant ?? 0} sub="Overdue or rejected items" icon={XCircle} variant="danger" />
        <SummaryCard label="Pending Legal Review" value={summary?.pendingReview ?? 0} sub="Submitted or under review" icon={Clock} variant="warning" />
        <SummaryCard label="Overdue Deadlines" value={summary?.overdueDeadlines ?? 0} sub="Past perfection deadline" icon={AlertTriangle} variant="danger" />
        <SummaryCard label="Audit Log Entries" value={auditLogs.length} sub="Total recorded actions" icon={FileText} variant="default" />
      </div>

      {/* ── Compliance Status by Collateral ──────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-1">
          <SectionHeader
            title="Compliance Status by Collateral"
            sub="Per-item compliance overview for legal officer review and regulatory submission"
          />
          {collaterals.length > COMPLIANCE_TABLE_LIMIT && (
            <p className="text-xs text-muted-foreground shrink-0 mb-4">
              Showing {complianceByCollateral.length} of {collaterals.length} —{' '}
              <Link href="/collateral-management" className="text-primary hover:underline inline-flex items-center gap-1">
                View Collateral Registry <ExternalLink size={11} />
              </Link>
            </p>
          )}
        </div>
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
                <th className="text-left py-2.5 px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">SMS</th>
              </tr>
            </thead>
            <tbody>
              {filteredDeadlines.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-muted-foreground text-sm">No deadline records match the selected filter.</td>
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
                  const showSmsBtn = urgency === 'overdue' || urgency === 'critical' || urgency === 'warning';
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
                      <td className="py-3 px-3">
                        {showSmsBtn && (
                          <button
                            onClick={() => setSmsDeadlineRecord(d)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-600 text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                            title="Send SMS deadline warning"
                          >
                            <MessageSquare size={11} /> SMS
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Full audit trail lives in Compliance Trail ───────────────────────── */}
      <div className="bg-white rounded-xl border border-border shadow-card p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ClipboardList size={18} className="text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Looking for the full audit trail?</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Search, filter, and export every system event — logins, document actions, status changes, and more — in Compliance Trail.
            </p>
          </div>
        </div>
        <Link
          href="/audit-trail"
          className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors shrink-0"
        >
          Open Compliance Trail
          <ExternalLink size={14} />
        </Link>
      </div>

      {smsDeadlineRecord && (
        <SmsDeadlineModal record={smsDeadlineRecord} onClose={() => setSmsDeadlineRecord(null)} />
      )}
        </>
      )}
    </div>
  );
}
