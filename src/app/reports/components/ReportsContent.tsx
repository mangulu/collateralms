'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  FileBarChart2,
  Download,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileText,
  Sheet,
  TrendingUp,
  Shield,
  Building2,
  Filter,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { type CollateralRecord } from '@/lib/supabase/collateralService';
import { mockCollateral } from '@/app/collateral-management/components/collateralData';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface ComplianceSummaryRow {
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
  complianceStatus: 'Compliant' | 'Non-Compliant' | 'Pending' | 'Overdue';
}

interface DeadlineEvent {
  date: string; // YYYY-MM-DD
  collateralId: string;
  obligor: string;
  type: string;
  registry: string;
  daysToDeadline: number | null;
  urgency: 'overdue' | 'critical' | 'warning' | 'ok';
}

interface KPISummary {
  total: number;
  compliant: number;
  nonCompliant: number;
  pending: number;
  overdue: number;
  perfectionRate: string;
  totalValueTSh: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseValueTSh(v: string): number {
  return parseInt((v ?? '0').replace(/,/g, ''), 10) || 0;
}

function formatValueTSh(n: number): string {
  return n.toLocaleString('en-US');
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function toISO(dateStr: string): string {
  if (!dateStr) return '';
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
  // "14 Apr 2026" format
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  return '';
}

function urgencyFromDays(days: number | null): 'overdue' | 'critical' | 'warning' | 'ok' {
  if (days === null) return 'ok';
  if (days < 0) return 'overdue';
  if (days <= 3) return 'critical';
  if (days <= 7) return 'warning';
  return 'ok';
}

function complianceFromRecord(r: CollateralRecord | typeof mockCollateral[0]): ComplianceSummaryRow['complianceStatus'] {
  const s = (r as any).status as string;
  if (s === 'Perfected' || s === 'Monitoring' || s === 'Released') return 'Compliant';
  if (s === 'Overdue' || s === 'Rejected') return 'Non-Compliant';
  if (s === 'Draft') return 'Pending';
  const days = (r as any).daysToDeadline as number | null;
  if (days !== null && days < 0) return 'Overdue';
  return 'Pending';
}

const COMPLIANCE_BADGE: Record<string, string> = {
  Compliant: 'bg-green-100 text-green-700',
  'Non-Compliant': 'bg-red-100 text-red-700',
  Pending: 'bg-amber-100 text-amber-700',
  Overdue: 'bg-red-100 text-red-800',
};

const STATUS_BADGE: Record<string, string> = {
  Perfected: 'bg-green-100 text-green-700',
  Monitoring: 'bg-blue-100 text-blue-700',
  Released: 'bg-gray-100 text-gray-600',
  Overdue: 'bg-red-100 text-red-700',
  Rejected: 'bg-red-100 text-red-800',
  Submitted: 'bg-amber-100 text-amber-700',
  'Under Review': 'bg-purple-100 text-purple-700',
  Draft: 'bg-gray-100 text-gray-500',
};

const URGENCY_STYLES = {
  overdue: { row: 'bg-red-50', badge: 'bg-red-100 text-red-700', dot: 'bg-red-500' },
  critical: { row: 'bg-orange-50', badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  warning: { row: 'bg-amber-50', badge: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  ok: { row: '', badge: 'bg-green-100 text-green-700', dot: 'bg-green-500' },
};

// ─── Calendar helpers ─────────────────────────────────────────────────────────

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay(); // 0=Sun
}
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

// ─── CSV / PDF helpers ────────────────────────────────────────────────────────

function downloadCSV(rows: ComplianceSummaryRow[], filename: string) {
  const headers = ['Collateral ID','Obligor','Type','Registry','Status','Compliance','Value (TSh)','Perfection Deadline','Days to Deadline','Assigned Officer'];
  const lines = [
    headers.join(','),
    ...rows.map(r => [
      r.collateralId,
      `"${r.obligor}"`,
      r.type,
      r.registry,
      r.status,
      r.complianceStatus,
      r.valueTSh,
      r.perfectionDeadline || '—',
      r.daysToDeadline !== null ? String(r.daysToDeadline) : '—',
      r.assignedOfficer,
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function downloadDeadlineCSV(events: DeadlineEvent[], filename: string) {
  const headers = ['Date','Collateral ID','Obligor','Type','Registry','Days to Deadline','Urgency'];
  const lines = [
    headers.join(','),
    ...events.map(e => [
      e.date,
      e.collateralId,
      `"${e.obligor}"`,
      e.type,
      e.registry,
      e.daysToDeadline !== null ? String(e.daysToDeadline) : '—',
      e.urgency,
    ].join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function printPDF(title: string, tableId: string) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const win = window.open('', '_blank');
  if (!win) return;
  win.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: 'Segoe UI', sans-serif; font-size: 11px; color: #111; margin: 24px; }
          h2 { font-size: 15px; margin-bottom: 4px; }
          p.sub { color: #666; font-size: 10px; margin-bottom: 16px; }
          table { width: 100%; border-collapse: collapse; }
          th { background: #f3f4f6; text-align: left; padding: 6px 8px; font-size: 10px; text-transform: uppercase; letter-spacing: .05em; border-bottom: 1px solid #e5e7eb; }
          td { padding: 6px 8px; border-bottom: 1px solid #f3f4f6; }
          tr:nth-child(even) td { background: #fafafa; }
          .badge { display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 9px; font-weight: 600; }
          .green { background: #dcfce7; color: #166534; }
          .red { background: #fee2e2; color: #991b1b; }
          .amber { background: #fef3c7; color: #92400e; }
          .blue { background: #dbeafe; color: #1e40af; }
          .gray { background: #f3f4f6; color: #374151; }
        </style>
      </head>
      <body>
        <h2>${title}</h2>
        <p class="sub">Generated: ${new Date().toLocaleString('en-GB')} · EXIM Bank Tanzania — CollateralMS</p>
        ${table.outerHTML}
      </body>
    </html>
  `);
  win.document.close();
  win.focus();
  setTimeout(() => { win.print(); win.close(); }, 400);
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

interface KPICardProps {
  label: string;
  value: string | number;
  sub: string;
  icon: React.ElementType;
  variant?: 'default' | 'success' | 'danger' | 'warning';
}

function KPICard({ label, value, sub, icon: Icon, variant = 'default' }: KPICardProps) {
  const styles = {
    default: { wrap: 'bg-white border-border', icon: 'bg-primary/10 text-primary', val: 'text-foreground' },
    success: { wrap: 'bg-green-50 border-green-200', icon: 'bg-green-100 text-green-600', val: 'text-green-700' },
    danger: { wrap: 'bg-red-50 border-red-200', icon: 'bg-red-100 text-red-600', val: 'text-red-700' },
    warning: { wrap: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-600', val: 'text-amber-700' },
  };
  const s = styles[variant];
  return (
    <div className={`rounded-xl p-4 border shadow-sm ${s.wrap}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight pr-2">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.icon}`}>
          <Icon size={15} />
        </div>
      </div>
      <p className={`text-2xl font-bold leading-none mb-1 ${s.val}`}>{value}</p>
      <p className="text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsContent() {
  const [records, setRecords] = useState<ComplianceSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPISummary>({ total: 0, compliant: 0, nonCompliant: 0, pending: 0, overdue: 0, perfectionRate: '0%', totalValueTSh: '0' });
  const [deadlineEvents, setDeadlineEvents] = useState<DeadlineEvent[]>([]);

  // Filters
  const [complianceFilter, setComplianceFilter] = useState<string>('All');
  const [registryFilter, setRegistryFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'summary' | 'calendar' | 'deadlines'>('summary');

  // Calendar state
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('collateral_records')
        .select('*')
        .order('created_at', { ascending: false });

      let source: any[] = [];
      if (!error && data && data.length > 0) {
        source = data.map((row: any) => ({
          id: row.id,
          collateralId: row.collateral_id,
          obligor: row.obligor,
          type: row.collateral_type,
          registry: row.registry,
          status: row.status,
          valueTSh: row.value_tsh,
          facilityId: row.facility_id,
          perfectionDeadline: row.perfection_deadline ?? '',
          daysToDeadline: row.days_to_deadline ?? null,
          assignedOfficer: row.assigned_officer ?? '—',
          requiresPerfection: row.requires_perfection ?? false,
        }));
      } else {
        source = mockCollateral;
      }

      const rows: ComplianceSummaryRow[] = source.map((r: any) => ({
        id: r.id,
        collateralId: r.collateralId ?? r.id,
        obligor: r.obligor,
        type: r.type ?? r.collateral_type,
        registry: r.registry,
        status: r.status,
        valueTSh: r.valueTSh ?? r.value_tsh ?? '0',
        perfectionDeadline: r.perfectionDeadline ?? r.perfection_deadline ?? '',
        daysToDeadline: r.daysToDeadline ?? r.days_to_deadline ?? null,
        assignedOfficer: r.assignedOfficer ?? r.assigned_officer ?? '—',
        complianceStatus: complianceFromRecord(r),
      }));

      setRecords(rows);

      // KPI
      const compliant = rows.filter(r => r.complianceStatus === 'Compliant').length;
      const nonCompliant = rows.filter(r => r.complianceStatus === 'Non-Compliant').length;
      const pending = rows.filter(r => r.complianceStatus === 'Pending').length;
      const overdue = rows.filter(r => r.complianceStatus === 'Overdue').length;
      const totalVal = rows.reduce((acc, r) => acc + parseValueTSh(r.valueTSh), 0);
      setKpi({
        total: rows.length,
        compliant,
        nonCompliant,
        pending,
        overdue,
        perfectionRate: rows.length > 0 ? `${Math.round((compliant / rows.length) * 100)}%` : '0%',
        totalValueTSh: formatValueTSh(totalVal),
      });

      // Deadline events
      const events: DeadlineEvent[] = rows
        .filter(r => r.perfectionDeadline && r.perfectionDeadline !== '—')
        .map(r => ({
          date: toISO(r.perfectionDeadline),
          collateralId: r.collateralId,
          obligor: r.obligor,
          type: r.type,
          registry: r.registry,
          daysToDeadline: r.daysToDeadline,
          urgency: urgencyFromDays(r.daysToDeadline),
        }))
        .filter(e => e.date !== '');
      setDeadlineEvents(events);
    } catch {
      // fallback to mock
      const rows: ComplianceSummaryRow[] = mockCollateral.map((r: any) => ({
        id: r.id,
        collateralId: r.id,
        obligor: r.obligor,
        type: r.type,
        registry: r.registry,
        status: r.status,
        valueTSh: r.valueTSh,
        perfectionDeadline: r.perfectionDeadline ?? '',
        daysToDeadline: r.daysToDeadline ?? null,
        assignedOfficer: r.assignedOfficer,
        complianceStatus: complianceFromRecord(r),
      }));
      setRecords(rows);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // Filtered rows
  const filteredRows = records.filter(r => {
    if (complianceFilter !== 'All' && r.complianceStatus !== complianceFilter) return false;
    if (registryFilter !== 'All' && r.registry !== registryFilter) return false;
    return true;
  });

  // Calendar events for current month
  const calEventsThisMonth = deadlineEvents.filter(e => {
    if (!e.date) return false;
    const d = new Date(e.date);
    return d.getFullYear() === calYear && d.getMonth() === calMonth;
  });

  const eventsByDay: Record<number, DeadlineEvent[]> = {};
  calEventsThisMonth.forEach(e => {
    const day = new Date(e.date).getDate();
    if (!eventsByDay[day]) eventsByDay[day] = [];
    eventsByDay[day].push(e);
  });

  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);

  // Upcoming deadlines (next 30 days + overdue)
  const upcomingDeadlines = deadlineEvents
    .filter(e => e.daysToDeadline !== null && e.daysToDeadline <= 30)
    .sort((a, b) => (a.daysToDeadline ?? 999) - (b.daysToDeadline ?? 999));

  const registries = ['All', 'BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];
  const complianceOptions = ['All', 'Compliant', 'Non-Compliant', 'Pending', 'Overdue'];

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-white shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
            <FileBarChart2 size={18} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground leading-tight">Reports</h1>
            <p className="text-xs text-muted-foreground">Compliance summaries, deadline calendars &amp; regulatory exports</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => downloadCSV(filteredRows, `compliance-report-${new Date().toISOString().slice(0,10)}.csv`)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Sheet size={13} />
            Export CSV
          </button>
          <button
            onClick={() => printPDF('Collateral Compliance Report', 'compliance-table')}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
          >
            <FileText size={13} />
            Export PDF
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* KPI Row */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          <KPICard label="Total Collateral" value={kpi.total} sub="All registered items" icon={FileBarChart2} />
          <KPICard label="Compliant" value={kpi.compliant} sub="Perfected / Monitoring" icon={CheckCircle2} variant="success" />
          <KPICard label="Non-Compliant" value={kpi.nonCompliant} sub="Overdue / Rejected" icon={XCircle} variant="danger" />
          <KPICard label="Pending Review" value={kpi.pending} sub="Draft / Submitted" icon={Clock} variant="warning" />
          <KPICard label="Perfection Rate" value={kpi.perfectionRate} sub="Compliant / Total" icon={TrendingUp} variant={parseInt(kpi.perfectionRate) >= 70 ? 'success' : 'warning'} />
          <KPICard label="Portfolio Value" value={`TSh ${kpi.totalValueTSh}`} sub="Aggregate collateral" icon={Shield} />
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-muted rounded-lg p-1 w-fit">
          {(['summary', 'calendar', 'deadlines'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 text-xs font-semibold rounded-md transition-all capitalize ${
                activeTab === tab ? 'bg-white text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab === 'summary' ? 'Compliance Summary' : tab === 'calendar' ? 'Deadline Calendar' : 'Upcoming Deadlines'}
            </button>
          ))}
        </div>

        {/* ── TAB: Compliance Summary ── */}
        {activeTab === 'summary' && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            {/* Filters */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-muted/30">
              <Filter size={14} className="text-muted-foreground shrink-0" />
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium">Compliance:</label>
                <select
                  value={complianceFilter}
                  onChange={e => setComplianceFilter(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {complianceOptions.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-muted-foreground font-medium">Registry:</label>
                <select
                  value={registryFilter}
                  onChange={e => setRegistryFilter(e.target.value)}
                  className="text-xs border border-border rounded-md px-2 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-primary"
                >
                  {registries.map(r => <option key={r}>{r}</option>)}
                </select>
              </div>
              <span className="ml-auto text-xs text-muted-foreground">{filteredRows.length} records</span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw size={20} className="animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Loading compliance data…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table id="compliance-table" className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collateral ID</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Obligor</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registry</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Compliance</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Value (TSh)</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Perfection Deadline</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Officer</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center py-12 text-muted-foreground text-sm">No records match the selected filters.</td>
                      </tr>
                    ) : filteredRows.map((r, i) => (
                      <tr key={r.id} className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${i % 2 === 0 ? '' : 'bg-muted/10'}`}>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{r.collateralId}</td>
                        <td className="px-4 py-2.5 font-medium text-foreground text-xs">{r.obligor}</td>
                        <td className="px-4 py-2.5 text-xs text-foreground">{r.type}</td>
                        <td className="px-4 py-2.5">
                          <span className="flex items-center gap-1 text-xs">
                            <Building2 size={11} className="text-muted-foreground" />
                            {r.registry}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${STATUS_BADGE[r.status] ?? 'bg-gray-100 text-gray-600'}`}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${COMPLIANCE_BADGE[r.complianceStatus]}`}>
                            {r.complianceStatus}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-xs text-foreground font-mono">{r.valueTSh}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.perfectionDeadline ? formatDate(r.perfectionDeadline) : '—'}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{r.assignedOfficer}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── TAB: Deadline Calendar ── */}
        {activeTab === 'calendar' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Calendar */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-border">
                <button
                  onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1); } else setCalMonth(m => m - 1); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <ChevronLeft size={16} className="text-muted-foreground" />
                </button>
                <h3 className="text-sm font-bold text-foreground">{MONTH_NAMES[calMonth]} {calYear}</h3>
                <button
                  onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1); } else setCalMonth(m => m + 1); }}
                  className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <ChevronRight size={16} className="text-muted-foreground" />
                </button>
              </div>
              <div className="p-4">
                {/* Day labels */}
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
                {/* Days grid */}
                <div className="grid grid-cols-7 gap-0.5">
                  {Array.from({ length: firstDay }).map((_, i) => (
                    <div key={`empty-${i}`} />
                  ))}
                  {Array.from({ length: daysInMonth }).map((_, i) => {
                    const day = i + 1;
                    const events = eventsByDay[day] ?? [];
                    const isToday = calYear === now.getFullYear() && calMonth === now.getMonth() && day === now.getDate();
                    const topUrgency = events.reduce<'overdue'|'critical'|'warning'|'ok'>((acc, e) => {
                      const order = { overdue: 0, critical: 1, warning: 2, ok: 3 };
                      return order[e.urgency] < order[acc] ? e.urgency : acc;
                    }, 'ok');
                    const hasEvents = events.length > 0;
                    return (
                      <div
                        key={day}
                        className={`relative min-h-[52px] rounded-lg p-1.5 border transition-colors ${
                          isToday ? 'border-primary bg-primary/5' : hasEvents ? 'border-border bg-muted/20' : 'border-transparent'
                        }`}
                      >
                        <span className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-foreground'}`}>{day}</span>
                        {hasEvents && (
                          <div className="mt-0.5 space-y-0.5">
                            {events.slice(0, 2).map((e, ei) => (
                              <div
                                key={ei}
                                className={`text-[9px] font-medium px-1 py-0.5 rounded truncate ${URGENCY_STYLES[e.urgency].badge}`}
                                title={`${e.obligor} — ${e.type}`}
                              >
                                {e.collateralId}
                              </div>
                            ))}
                            {events.length > 2 && (
                              <div className="text-[9px] text-muted-foreground px-1">+{events.length - 2} more</div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-4 px-5 py-3 border-t border-border bg-muted/20">
                {(['overdue','critical','warning','ok'] as const).map(u => (
                  <div key={u} className="flex items-center gap-1.5">
                    <div className={`w-2.5 h-2.5 rounded-full ${URGENCY_STYLES[u].dot}`} />
                    <span className="text-xs text-muted-foreground capitalize">{u === 'ok' ? 'On Track' : u}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Events this month */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden flex flex-col">
              <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <CalendarDays size={15} className="text-primary" />
                  {MONTH_NAMES[calMonth]} Deadlines
                </h3>
                <span className="text-xs text-muted-foreground">{calEventsThisMonth.length} items</span>
              </div>
              <div className="flex-1 overflow-y-auto divide-y divide-border/50">
                {calEventsThisMonth.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <CalendarDays size={28} className="mb-2 opacity-30" />
                    <p className="text-xs">No deadlines this month</p>
                  </div>
                ) : calEventsThisMonth
                    .sort((a, b) => a.date.localeCompare(b.date))
                    .map((e, i) => (
                  <div key={i} className={`px-4 py-3 ${URGENCY_STYLES[e.urgency].row}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-xs font-semibold text-foreground truncate">{e.obligor}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${URGENCY_STYLES[e.urgency].badge}`}>
                        {e.daysToDeadline !== null ? (e.daysToDeadline < 0 ? `${Math.abs(e.daysToDeadline)}d overdue` : `${e.daysToDeadline}d left`) : '—'}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{e.type} · {e.registry}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{e.collateralId} · {formatDate(e.date)}</p>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t border-border">
                <button
                  onClick={() => downloadDeadlineCSV(calEventsThisMonth, `deadlines-${MONTH_NAMES[calMonth].toLowerCase()}-${calYear}.csv`)}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
                >
                  <Download size={12} />
                  Export Month CSV
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: Upcoming Deadlines ── */}
        {activeTab === 'deadlines' && (
          <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <AlertTriangle size={14} className="text-amber-500" />
                <span className="text-sm font-semibold text-foreground">Upcoming &amp; Overdue Deadlines</span>
                <span className="text-xs text-muted-foreground">(next 30 days + overdue)</span>
              </div>
              <button
                onClick={() => downloadDeadlineCSV(upcomingDeadlines, `upcoming-deadlines-${new Date().toISOString().slice(0,10)}.csv`)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Sheet size={12} />
                Export CSV
              </button>
            </div>
            {loading ? (
              <div className="flex items-center justify-center py-16">
                <RefreshCw size={20} className="animate-spin text-primary mr-2" />
                <span className="text-sm text-muted-foreground">Loading…</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table id="deadlines-table" className="w-full text-sm">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Urgency</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Collateral ID</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Obligor</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Type</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Registry</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Deadline</th>
                      <th className="text-left px-4 py-2.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Days Remaining</th>
                    </tr>
                  </thead>
                  <tbody>
                    {upcomingDeadlines.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-muted-foreground text-sm">No upcoming deadlines in the next 30 days.</td>
                      </tr>
                    ) : upcomingDeadlines.map((e, i) => (
                      <tr key={i} className={`border-b border-border/50 hover:brightness-95 transition-colors ${URGENCY_STYLES[e.urgency].row}`}>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center gap-1.5">
                            <div className={`w-2 h-2 rounded-full ${URGENCY_STYLES[e.urgency].dot}`} />
                            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${URGENCY_STYLES[e.urgency].badge}`}>
                              {e.urgency === 'ok' ? 'On Track' : e.urgency.charAt(0).toUpperCase() + e.urgency.slice(1)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-2.5 font-mono text-xs text-muted-foreground">{e.collateralId}</td>
                        <td className="px-4 py-2.5 text-xs font-medium text-foreground">{e.obligor}</td>
                        <td className="px-4 py-2.5 text-xs text-foreground">{e.type}</td>
                        <td className="px-4 py-2.5 text-xs text-foreground">{e.registry}</td>
                        <td className="px-4 py-2.5 text-xs text-muted-foreground">{formatDate(e.date)}</td>
                        <td className="px-4 py-2.5">
                          {e.daysToDeadline !== null ? (
                            <span className={`text-xs font-bold ${e.daysToDeadline < 0 ? 'text-red-600' : e.daysToDeadline <= 3 ? 'text-orange-600' : e.daysToDeadline <= 7 ? 'text-amber-600' : 'text-green-600'}`}>
                              {e.daysToDeadline < 0 ? `${Math.abs(e.daysToDeadline)} days overdue` : `${e.daysToDeadline} days`}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {/* PDF export for deadlines */}
            <div className="flex justify-end px-4 py-3 border-t border-border bg-muted/20">
              <button
                onClick={() => printPDF('Upcoming Deadlines Report', 'deadlines-table')}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-primary border border-primary rounded-lg hover:bg-primary/5 transition-colors"
              >
                <FileText size={12} />
                Export PDF
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
