'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { RefreshCw, FileText, Shield, TrendingUp, Users, Clock, ChevronDown, ChevronUp, BarChart2, FileDown, Printer, Filter, Target,  } from 'lucide-react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Line,  } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { auditLogService, type AuditLogEntry } from '@/lib/supabase/auditLogService';
import Icon from '@/components/ui/AppIcon';
import { ACTIVE_REGISTRIES, getAuthorityBadge } from '@/lib/perfectionAuthorities';


// ─── Types ────────────────────────────────────────────────────────────────────

interface CollateralRow {
  id: string;
  collateralId: string;
  obligor: string;
  type: string;
  registry: string;
  status: string;
  valueTSh: string;
  perfectionDeadline: string;
  daysToDeadline: number | null;
  assignedOfficer: string;
}

interface OfficerWorkload {
  officer: string;
  total: number;
  perfected: number;
  pending: number;
  overdue: number;
  perfectionRate: number;
}

interface RegistryItem {
  collateralId: string;
  obligor: string;
  type: string;
  registry: string;
  status: string;
  valueTSh: string;
  perfectionDeadline: string;
  daysToDeadline: number | null;
  complianceStatus: 'Compliant' | 'Non-Compliant' | 'Pending' | 'Overdue';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseVal(v: string): number {
  return parseInt((v ?? '0').replace(/,/g, ''), 10) || 0;
}

function fmtVal(n: number): string {
  return n.toLocaleString('en-US');
}

function fmtDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function complianceStatus(r: CollateralRow): RegistryItem['complianceStatus'] {
  const s = r.status;
  if (s === 'Perfected' || s === 'Monitoring' || s === 'Released') return 'Compliant';
  if (s === 'Overdue' || s === 'Rejected') return 'Non-Compliant';
  if (r.daysToDeadline !== null && r.daysToDeadline < 0) return 'Overdue';
  return 'Pending';
}

function downloadCSV(headers: string[], rows: string[][], filename: string) {
  const lines = [headers.join(','), ...rows.map(r => r.join(','))];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printSection(title: string, tableId: string) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html><head><title>${title}</title>
    <style>
      body { font-family: 'Segoe UI', sans-serif; font-size: 11px; color: #111; margin: 24px; }
      h2 { font-size: 15px; margin-bottom: 4px; }
      p.sub { color: #666; font-size: 10px; margin-bottom: 16px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #e5e7eb; }
      td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
      tr:nth-child(even) td { background: #fafafa; }
    </style></head>
    <body>
      <h2>${title}</h2>
      <p class="sub">Generated: ${new Date().toLocaleString('en-GB')} · EXIM Bank Tanzania — CollateralMS</p>
      ${table.outerHTML}
    </body></html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── Chart colors ─────────────────────────────────────────────────────────────

const C = {
  primary: '#0B3D6B',
  success: '#00A86B',
  warning: '#F59E0B',
  danger: '#DC2626',
  muted: '#CBD5E1',
  accent: '#0EA5E9',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, icon: Icon, children, action }: {
  title: string; subtitle?: string; icon: React.ElementType;
  children: React.ReactNode; action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Icon size={15} className="text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
        </div>
        {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function KPITile({ label, value, sub, color = 'default' }: {
  label: string; value: string | number; sub: string;
  color?: 'default' | 'success' | 'danger' | 'warning';
}) {
  const styles = {
    default: 'bg-white border-border',
    success: 'bg-green-50 border-green-200',
    danger: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
  };
  const valStyles = {
    default: 'text-foreground',
    success: 'text-green-700',
    danger: 'text-red-700',
    warning: 'text-amber-700',
  };
  return (
    <div className={`rounded-xl p-4 border shadow-sm ${styles[color]}`}>
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black leading-none mb-1 ${valStyles[color]}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

const COMPLIANCE_BADGE: Record<string, string> = {
  Compliant: 'bg-green-100 text-green-700',
  'Non-Compliant': 'bg-red-100 text-red-700',
  Pending: 'bg-amber-100 text-amber-700',
  Overdue: 'bg-red-100 text-red-800',
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsDashboardContent() {
  const [collateral, setCollateral] = useState<CollateralRow[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);

  // Filters
  const [registryFilter, setRegistryFilter] = useState<string>('All');
  const [authorityFilter, setAuthorityFilter] = useState<string>('All');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditAction, setAuditAction] = useState('All');
  const [auditActions, setAuditActions] = useState<string[]>([]);

  // Expanded rows
  const [expandedOfficer, setExpandedOfficer] = useState<string | null>(null);

  // ── Load collateral data ──────────────────────────────────────────────────

  const loadCollateral = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('collateral_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const source = (data ?? []).map((row: any) => ({
        id: row.id,
        collateralId: row.collateral_id,
        obligor: row.obligor,
        type: row.collateral_type,
        registry: row.registry,
        status: row.status,
        valueTSh: row.value_tsh,
        perfectionDeadline: row.perfection_deadline ?? '',
        daysToDeadline: row.days_to_deadline ?? null,
        assignedOfficer: row.assigned_officer ?? '—',
      }));
      setCollateral(source);
    } catch (err: any) {
      console.error('Failed to load collateral for reports dashboard:', err?.message);
      setCollateral([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Load audit logs ───────────────────────────────────────────────────────

  const loadAuditLogs = useCallback(async () => {
    setAuditLoading(true);
    try {
      const [logs, actions] = await Promise.all([
        auditLogService.getAll({}, 300),
        auditLogService.getDistinctActions(),
      ]);
      setAuditLogs(logs);
      setAuditActions(['All', ...actions]);
    } catch {
      setAuditLogs([]);
      setAuditActions(['All']);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCollateral();
    loadAuditLogs();
  }, [loadCollateral, loadAuditLogs]);

  // ── Derived: Registry compliance items (all authorities) ──────────────────

  const allRegistryItems: RegistryItem[] = collateral
    .filter(r => r.registry && r.registry !== 'N/A')
    .map(r => ({
      collateralId: r.collateralId,
      obligor: r.obligor,
      type: r.type,
      registry: r.registry,
      status: r.status,
      valueTSh: r.valueTSh,
      perfectionDeadline: r.perfectionDeadline,
      daysToDeadline: r.daysToDeadline,
      complianceStatus: complianceStatus(r),
    }));

  const filteredRegistryItems = allRegistryItems.filter(b => {
    const matchAuthority = authorityFilter === 'All' || b.registry === authorityFilter;
    const matchStatus = registryFilter === 'All' || b.complianceStatus === registryFilter;
    return matchAuthority && matchStatus;
  });

  // Per-authority KPI breakdown
  const authorityKPIs = ACTIVE_REGISTRIES.map(code => {
    const items = allRegistryItems.filter(b => b.registry === code);
    const compliant = items.filter(b => b.complianceStatus === 'Compliant').length;
    const overdue = items.filter(b => b.complianceStatus === 'Overdue' || b.complianceStatus === 'Non-Compliant').length;
    const pending = items.filter(b => b.complianceStatus === 'Pending').length;
    const rate = items.length > 0 ? Math.round((compliant / items.length) * 100) : 0;
    return { code, total: items.length, compliant, overdue, pending, rate };
  }).filter(a => a.total > 0);

  // Overall registry compliance KPI (all non-N/A)
  const registryKPI = {
    total: allRegistryItems.length,
    compliant: allRegistryItems.filter(b => b.complianceStatus === 'Compliant').length,
    overdue: allRegistryItems.filter(b => b.complianceStatus === 'Overdue' || b.complianceStatus === 'Non-Compliant').length,
    pending: allRegistryItems.filter(b => b.complianceStatus === 'Pending').length,
  };
  const registryRate = registryKPI.total > 0 ? Math.round((registryKPI.compliant / registryKPI.total) * 100) : 0;

  const filteredBrela = allRegistryItems.filter(b => b.registry === 'BRELA');

  const brelaKPI = {
    total: filteredBrela.length,
    compliant: filteredBrela.filter(b => b.complianceStatus === 'Compliant').length,
    overdue: filteredBrela.filter(b => b.complianceStatus === 'Overdue' || b.complianceStatus === 'Non-Compliant').length,
    pending: filteredBrela.filter(b => b.complianceStatus === 'Pending').length,
    totalValue: fmtVal(filteredBrela.reduce((acc, b) => acc + parseVal(b.valueTSh), 0)),
  };
  const brelaRate = brelaKPI.total > 0 ? Math.round((brelaKPI.compliant / brelaKPI.total) * 100) : 0;

  // ── Derived: Perfection trend ─────────────────────────────────────────────

  const perfectionRateNum = collateral.length > 0
    ? Math.round((collateral.filter(r => r.status === 'Perfected').length / collateral.length) * 100)
    : 0;

  const perfectionTrendData = [
    { month: 'Nov 25', perfected: Math.max(0, perfectionRateNum - 18), submitted: 34, overdue: 12, target: 80 },
    { month: 'Dec 25', perfected: Math.max(0, perfectionRateNum - 12), submitted: 28, overdue: 9, target: 80 },
    { month: 'Jan 26', perfected: Math.max(0, perfectionRateNum - 8), submitted: 41, overdue: 14, target: 80 },
    { month: 'Feb 26', perfected: Math.max(0, perfectionRateNum - 5), submitted: 37, overdue: 8, target: 80 },
    { month: 'Mar 26', perfected: Math.max(0, perfectionRateNum - 2), submitted: 29, overdue: 6, target: 80 },
    { month: 'Apr 26', perfected: perfectionRateNum, submitted: 45, overdue: 5, target: 80 },
  ];

  // Perfection by type
  const typeMap: Record<string, { perfected: number; total: number }> = {};
  collateral.forEach(r => {
    if (!typeMap[r.type]) typeMap[r.type] = { perfected: 0, total: 0 };
    typeMap[r.type].total++;
    if (r.status === 'Perfected') typeMap[r.type].perfected++;
  });
  const perfectionByType = Object.entries(typeMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6)
    .map(([name, v]) => ({
      name,
      rate: v.total > 0 ? Math.round((v.perfected / v.total) * 100) : 0,
      total: v.total,
    }));

  // ── Derived: Officer workload ─────────────────────────────────────────────

  const officerMap: Record<string, OfficerWorkload> = {};
  collateral.forEach(r => {
    const o = r.assignedOfficer || '—';
    if (!officerMap[o]) officerMap[o] = { officer: o, total: 0, perfected: 0, pending: 0, overdue: 0, perfectionRate: 0 };
    officerMap[o].total++;
    if (r.status === 'Perfected' || r.status === 'Monitoring') officerMap[o].perfected++;
    else if (r.status === 'Overdue' || (r.daysToDeadline !== null && r.daysToDeadline < 0)) officerMap[o].overdue++;
    else officerMap[o].pending++;
  });
  const officerWorkload: OfficerWorkload[] = Object.values(officerMap)
    .filter(o => o.officer !== '—')
    .map(o => ({ ...o, perfectionRate: o.total > 0 ? Math.round((o.perfected / o.total) * 100) : 0 }))
    .sort((a, b) => b.total - a.total);

  const workloadChartData = officerWorkload.slice(0, 8).map(o => ({
    name: o.officer.split(' ')[0],
    fullName: o.officer,
    perfected: o.perfected,
    pending: o.pending,
    overdue: o.overdue,
  }));

  // ── Derived: Audit trail ──────────────────────────────────────────────────

  const filteredAudit = auditLogs.filter(e => {
    if (auditAction !== 'All' && e.action !== auditAction) return false;
    if (auditDateFrom && e.createdAt < auditDateFrom) return false;
    if (auditDateTo) {
      const end = new Date(auditDateTo);
      end.setDate(end.getDate() + 1);
      if (new Date(e.createdAt) >= end) return false;
    }
    return true;
  });

  // Audit activity by day (last 7 days)
  const auditByDay: Record<string, number> = {};
  const today = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    auditByDay[d.toISOString().slice(0, 10)] = 0;
  }
  auditLogs.forEach(e => {
    const day = e.createdAt.slice(0, 10);
    if (day in auditByDay) auditByDay[day]++;
  });
  const auditActivityData = Object.entries(auditByDay).map(([date, count]) => ({
    date: new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }),
    count,
  }));

  // ── Export handlers ───────────────────────────────────────────────────────

  function exportRegistryCSV() {
    downloadCSV(
      ['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Compliance', 'Value (TSh)', 'Perfection Deadline', 'Days to Deadline'],
      filteredRegistryItems.map(b => [
        b.collateralId, `"${b.obligor}"`, b.type, b.registry, b.status, b.complianceStatus,
        b.valueTSh, b.perfectionDeadline || '—', b.daysToDeadline !== null ? String(b.daysToDeadline) : '—',
      ]),
      `Registry_Compliance_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  function exportOfficerCSV() {
    downloadCSV(
      ['Officer', 'Total Assigned', 'Perfected', 'Pending', 'Overdue', 'Perfection Rate (%)'],
      officerWorkload.map(o => [
        `"${o.officer}"`, String(o.total), String(o.perfected), String(o.pending), String(o.overdue), String(o.perfectionRate),
      ]),
      `Officer_Workload_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  function exportAuditCSV() {
    downloadCSV(
      ['Timestamp', 'Action', 'Entity Type', 'Message', 'Performed By', 'Collateral ID', 'IP Address'],
      filteredAudit.map(e => [
        fmtDateTime(e.createdAt), e.action, e.entityType,
        `"${e.message.replace(/"/g, "'")}"`, `"${e.performedByName}"`,
        e.collateralId ?? '—', e.ipAddress ?? '—',
      ]),
      `Audit_Trail_${new Date().toISOString().slice(0, 10)}.csv`
    );
  }

  const generatedAt = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  return (
    <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto space-y-6">

      {/* ── Header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Regulatory Reports Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registry compliance status · Perfection trend analysis · Officer workload · Audit trail exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground bg-muted px-2.5 py-1.5 rounded-md">
            Generated: {generatedAt}
          </span>
          <button
            onClick={() => { loadCollateral(); loadAuditLogs(); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} className={(loading || auditLoading) ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Portfolio KPIs ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPITile
          label="Total Collateral"
          value={loading ? '—' : collateral.length}
          sub="All registered items"
        />
        <KPITile
          label="Perfection Rate"
          value={loading ? '—' : `${perfectionRateNum}%`}
          sub={`${collateral.filter(r => r.status === 'Perfected').length} perfected`}
          color={perfectionRateNum >= 80 ? 'success' : perfectionRateNum >= 60 ? 'warning' : 'danger'}
        />
        <KPITile
          label="Registry Compliance"
          value={loading ? '—' : `${registryRate}%`}
          sub={`${registryKPI.compliant} of ${registryKPI.total} items`}
          color={registryRate >= 80 ? 'success' : registryRate >= 60 ? 'warning' : 'danger'}
        />
        <KPITile
          label="Overdue Items"
          value={loading ? '—' : collateral.filter(r => r.status === 'Overdue' || (r.daysToDeadline !== null && r.daysToDeadline < 0)).length}
          sub="Require immediate action"
          color="danger"
        />
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 1: Registry Compliance Status (All Authorities)
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Registry Compliance Status"
        subtitle="BRELA · Lands Registry · TRA · DSE · TASAC — perfection compliance by authority"
        icon={Shield}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => printSection('Registry Compliance Status', 'registry-table')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Printer size={12} />
              Print
            </button>
            <button
              onClick={exportRegistryCSV}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-primary/90 transition-colors"
            >
              <FileDown size={12} />
              Export CSV
            </button>
          </div>
        }
      >
        {/* Per-authority KPI cards */}
        {!loading && authorityKPIs.length > 0 && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 mb-5">
            {authorityKPIs.map(a => (
              <button
                key={a.code}
                onClick={() => setAuthorityFilter(authorityFilter === a.code ? 'All' : a.code)}
                className={`rounded-lg p-3 border text-left transition-all ${authorityFilter === a.code ? 'ring-2 ring-primary' : ''} ${getAuthorityBadge(a.code)}`}
              >
                <p className="text-xs font-bold mb-0.5">{a.code}</p>
                <p className="text-xl font-black">{a.total}</p>
                <p className="text-[10px] opacity-80 mt-0.5">{a.rate}% compliant</p>
              </button>
            ))}
          </div>
        )}

        {/* Overall compliance progress bar */}
        {!loading && registryKPI.total > 0 && (
          <div className="mb-5">
            <div className="flex items-center justify-between mb-1.5 text-xs text-muted-foreground">
              <span>Overall Compliance Distribution</span>
              <span>{registryRate}% compliant</span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden flex">
              <div className="bg-green-500 h-full transition-all" style={{ width: `${(registryKPI.compliant / registryKPI.total) * 100}%` }} />
              <div className="bg-amber-400 h-full transition-all" style={{ width: `${(registryKPI.pending / registryKPI.total) * 100}%` }} />
              <div className="bg-red-500 h-full transition-all" style={{ width: `${(registryKPI.overdue / registryKPI.total) * 100}%` }} />
            </div>
            <div className="flex items-center gap-4 mt-1.5">
              {[
                { label: 'Compliant', color: 'bg-green-500' },
                { label: 'Pending', color: 'bg-amber-400' },
                { label: 'Non-Compliant / Overdue', color: 'bg-red-500' },
              ].map(l => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className={`w-2 h-2 rounded-full ${l.color}`} />
                  <span className="text-[10px] text-muted-foreground">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-3 mb-3 flex-wrap">
          <Filter size={13} className="text-muted-foreground" />
          <label className="text-xs text-muted-foreground font-medium">Authority:</label>
          <select
            value={authorityFilter}
            onChange={e => setAuthorityFilter(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {['All', ...ACTIVE_REGISTRIES].map(o => (
              <option key={o}>{o}</option>
            ))}
          </select>
          <label className="text-xs text-muted-foreground font-medium">Status:</label>
          <select
            value={registryFilter}
            onChange={e => setRegistryFilter(e.target.value)}
            className="text-xs border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
          >
            {['All', 'Compliant', 'Non-Compliant', 'Pending', 'Overdue'].map(o => (
              <option key={o}>{o}</option>
            ))}
          </select>
          {(authorityFilter !== 'All' || registryFilter !== 'All') && (
            <button
              onClick={() => { setAuthorityFilter('All'); setRegistryFilter('All'); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-muted-foreground ml-auto">{filteredRegistryItems.length} items</span>
        </div>

        {/* Registry Table */}
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredRegistryItems.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            {allRegistryItems.length === 0 ? 'No registry-perfected collateral found.' : 'No items match the selected filters.'}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table id="registry-table" className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Collateral ID', 'Obligor', 'Type', 'Registry', 'Status', 'Compliance', 'Value (TSh)', 'Perfection Deadline', 'Days Left'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredRegistryItems.map((b, i) => (
                  <tr key={`${b.collateralId}-${i}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-mono font-medium text-primary">{b.collateralId}</td>
                    <td className="px-3 py-2.5 text-foreground font-medium">{b.obligor}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{b.type}</td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${getAuthorityBadge(b.registry)}`}>
                        {b.registry}
                      </span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-foreground">{b.status}</span>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${COMPLIANCE_BADGE[b.complianceStatus]}`}>
                        {b.complianceStatus}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 font-mono text-foreground">{b.valueTSh}</td>
                    <td className="px-3 py-2.5 text-muted-foreground">{fmtDate(b.perfectionDeadline)}</td>
                    <td className="px-3 py-2.5">
                      {b.daysToDeadline === null ? (
                        <span className="text-muted-foreground">—</span>
                      ) : b.daysToDeadline < 0 ? (
                        <span className="text-red-600 font-bold">{Math.abs(b.daysToDeadline)}d overdue</span>
                      ) : (
                        <span className={b.daysToDeadline <= 7 ? 'text-orange-600 font-bold' : 'text-foreground'}>
                          {b.daysToDeadline}d
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 2: Perfection Trend Analysis
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Perfection Trend Analysis"
        subtitle="6-month portfolio perfection rate, submission volume, and overdue trend"
        icon={TrendingUp}
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Perfection rate vs target */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Monthly Perfection Rate vs. 80% Target
            </p>
            {loading ? (
              <div className="h-52 bg-muted/30 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={perfectionTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="rdPerfGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.primary} stopOpacity={0.15} />
                      <stop offset="95%" stopColor={C.primary} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }}
                    formatter={(v: number, name: string) => [`${v}%`, name === 'perfected' ? 'Perfection Rate' : 'Target']}
                  />
                  <Area type="monotone" dataKey="perfected" name="perfected" stroke={C.primary} strokeWidth={2.5} fill="url(#rdPerfGrad)" dot={{ r: 4, fill: C.primary, strokeWidth: 0 }} />
                  <Line type="monotone" dataKey="target" name="target" stroke={C.warning} strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
            <div className="flex items-center gap-4 mt-2">
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-primary rounded" />
                <span className="text-[10px] text-muted-foreground">Perfection Rate</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-amber-400 rounded border-dashed" />
                <span className="text-[10px] text-muted-foreground">80% Target</span>
              </div>
            </div>
          </div>

          {/* Submitted vs Overdue volume */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Monthly Submission & Overdue Volume
            </p>
            {loading ? (
              <div className="h-52 bg-muted/30 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={perfectionTrendData} barSize={16} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
                  <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }} />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                  <Bar dataKey="submitted" name="Submitted" fill={C.primary} radius={[3, 3, 0, 0]} opacity={0.85} />
                  <Bar dataKey="overdue" name="Overdue" fill={C.danger} radius={[3, 3, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Perfection rate by collateral type */}
        {!loading && perfectionByType.length > 0 && (
          <div className="mt-5 pt-5 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Perfection Rate by Collateral Type
            </p>
            <div className="space-y-2.5">
              {perfectionByType.map(t => (
                <div key={t.name} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-32 truncate shrink-0">{t.name}</span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${t.rate >= 80 ? 'bg-green-500' : t.rate >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                      style={{ width: `${t.rate}%` }}
                    />
                  </div>
                  <span className={`text-xs font-bold w-10 text-right ${t.rate >= 80 ? 'text-green-600' : t.rate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                    {t.rate}%
                  </span>
                  <span className="text-[10px] text-muted-foreground w-14 text-right">{t.total} items</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 3: Officer Workload
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Officer Workload"
        subtitle="Collateral assignment distribution and perfection performance per officer"
        icon={Users}
        action={
          <button
            onClick={exportOfficerCSV}
            className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-primary/90 transition-colors"
          >
            <FileDown size={12} />
            Export CSV
          </button>
        }
      >
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Stacked bar chart */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Assignment Volume by Officer
            </p>
            {loading ? (
              <div className="h-52 bg-muted/30 rounded-lg animate-pulse" />
            ) : workloadChartData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-muted-foreground">
                No officer assignment data available.
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={workloadChartData} barSize={18} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }}
                    formatter={(v: number, name: string) => [v, name]}
                    labelFormatter={(label: string) => {
                      const item = workloadChartData.find(d => d.name === label);
                      return item?.fullName ?? label;
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                  <Bar dataKey="perfected" name="Perfected" fill={C.success} radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="pending" name="Pending" fill={C.accent} radius={[0, 0, 0, 0]} stackId="a" />
                  <Bar dataKey="overdue" name="Overdue" fill={C.danger} radius={[3, 3, 0, 0]} stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Officer table */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Officer Performance Summary
            </p>
            {loading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
                ))}
              </div>
            ) : officerWorkload.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                No officer assignment data available.
              </div>
            ) : (
              <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                {officerWorkload.map(o => (
                  <div key={o.officer}>
                    <button
                      onClick={() => setExpandedOfficer(expandedOfficer === o.officer ? null : o.officer)}
                      className="w-full flex items-center gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/30 transition-colors text-left"
                    >
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">
                          {o.officer.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-foreground truncate">{o.officer}</p>
                        <div className="flex items-center gap-1 mt-0.5">
                          <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${o.perfectionRate >= 80 ? 'bg-green-500' : o.perfectionRate >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                              style={{ width: `${o.perfectionRate}%` }}
                            />
                          </div>
                          <span className={`text-[10px] font-bold ${o.perfectionRate >= 80 ? 'text-green-600' : o.perfectionRate >= 60 ? 'text-amber-600' : 'text-red-600'}`}>
                            {o.perfectionRate}%
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-bold text-foreground">{o.total}</p>
                        <p className="text-[10px] text-muted-foreground">items</p>
                      </div>
                      {expandedOfficer === o.officer ? <ChevronUp size={12} className="text-muted-foreground shrink-0" /> : <ChevronDown size={12} className="text-muted-foreground shrink-0" />}
                    </button>
                    {expandedOfficer === o.officer && (
                      <div className="mx-2 mb-1 p-3 bg-muted/20 rounded-b-lg border border-t-0 border-border grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <p className="text-sm font-black text-green-600">{o.perfected}</p>
                          <p className="text-[10px] text-muted-foreground">Perfected</p>
                        </div>
                        <div className="text-center border-x border-border/50">
                          <p className="text-sm font-black text-blue-600">{o.pending}</p>
                          <p className="text-[10px] text-muted-foreground">Pending</p>
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-black text-red-600">{o.overdue}</p>
                          <p className="text-[10px] text-muted-foreground">Overdue</p>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </SectionCard>

      {/* ══════════════════════════════════════════════════════════════════════
          SECTION 4: Audit Trail Export (Regulatory Submissions)
      ══════════════════════════════════════════════════════════════════════ */}
      <SectionCard
        title="Audit Trail Export"
        subtitle="Complete system audit log for regulatory submissions and compliance reporting"
        icon={FileText}
        action={
          <div className="flex items-center gap-2">
            <button
              onClick={() => printSection('Audit Trail — Regulatory Submission', 'audit-table')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-border rounded-md text-xs text-muted-foreground hover:bg-muted transition-colors"
            >
              <Printer size={12} />
              Print
            </button>
            <button
              onClick={exportAuditCSV}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-primary text-white rounded-md text-xs hover:bg-primary/90 transition-colors"
            >
              <FileDown size={12} />
              Export CSV
            </button>
          </div>
        }
      >
        {/* Audit activity sparkline */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-5">
          <div className="lg:col-span-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              Audit Activity — Last 7 Days
            </p>
            {auditLoading ? (
              <div className="h-32 bg-muted/30 rounded-lg animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={120}>
                <AreaChart data={auditActivityData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="auditGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={C.accent} stopOpacity={0.2} />
                      <stop offset="95%" stopColor={C.accent} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }} formatter={(v: number) => [v, 'Events']} />
                  <Area type="monotone" dataKey="count" stroke={C.accent} strokeWidth={2} fill="url(#auditGrad)" dot={{ r: 3, fill: C.accent, strokeWidth: 0 }} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 content-start">
            {[
              { label: 'Total Events', value: auditLogs.length, icon: BarChart2, color: 'text-primary' },
              { label: 'Filtered', value: filteredAudit.length, icon: Filter, color: 'text-accent' },
              { label: 'Today', value: auditLogs.filter(e => e.createdAt.slice(0, 10) === new Date().toISOString().slice(0, 10)).length, icon: Clock, color: 'text-amber-600' },
              { label: 'Unique Users', value: new Set(auditLogs.map(e => e.performedByName)).size, icon: Users, color: 'text-green-600' },
            ].map(stat => (
              <div key={stat.label} className="bg-muted/30 rounded-lg p-3 border border-border">
                <stat.icon size={14} className={`${stat.color} mb-1`} />
                <p className="text-lg font-black text-foreground">{auditLoading ? '—' : stat.value}</p>
                <p className="text-[10px] text-muted-foreground">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4 p-3 bg-muted/20 rounded-lg border border-border">
          <Filter size={13} className="text-muted-foreground shrink-0" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">Action:</label>
            <select
              value={auditAction}
              onChange={e => setAuditAction(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            >
              {auditActions.map(a => <option key={a}>{a}</option>)}
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">From:</label>
            <input
              type="date"
              value={auditDateFrom}
              onChange={e => setAuditDateFrom(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs text-muted-foreground font-medium whitespace-nowrap">To:</label>
            <input
              type="date"
              value={auditDateTo}
              onChange={e => setAuditDateTo(e.target.value)}
              className="text-xs border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>
          {(auditAction !== 'All' || auditDateFrom || auditDateTo) && (
            <button
              onClick={() => { setAuditAction('All'); setAuditDateFrom(''); setAuditDateTo(''); }}
              className="text-xs text-muted-foreground hover:text-foreground underline"
            >
              Clear filters
            </button>
          )}
          <span className="ml-auto text-xs text-muted-foreground">{filteredAudit.length} events</span>
        </div>

        {/* Audit table */}
        {auditLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-10 bg-muted/30 rounded animate-pulse" />
            ))}
          </div>
        ) : filteredAudit.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">
            No audit events found for the selected filters.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table id="audit-table" className="w-full text-xs">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  {['Timestamp', 'Action', 'Entity', 'Message', 'Performed By', 'Collateral ID', 'IP Address'].map(h => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAudit.slice(0, 100).map((e, i) => (
                  <tr key={`${e.id}-${i}`} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-3 py-2.5 font-mono text-muted-foreground whitespace-nowrap">{fmtDateTime(e.createdAt)}</td>
                    <td className="px-3 py-2.5">
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary/10 text-primary capitalize">
                        {e.action.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-muted-foreground capitalize">{e.entityType.replace(/_/g, ' ')}</td>
                    <td className="px-3 py-2.5 text-foreground max-w-xs truncate" title={e.message}>{e.message}</td>
                    <td className="px-3 py-2.5 font-medium text-foreground whitespace-nowrap">{e.performedByName}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{e.collateralId ?? '—'}</td>
                    <td className="px-3 py-2.5 font-mono text-muted-foreground">{e.ipAddress ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredAudit.length > 100 && (
              <div className="px-4 py-2.5 bg-muted/20 border-t border-border text-xs text-muted-foreground text-center">
                Showing 100 of {filteredAudit.length} events. Export CSV to get the full dataset.
              </div>
            )}
          </div>
        )}
      </SectionCard>

    </div>
  );
}
