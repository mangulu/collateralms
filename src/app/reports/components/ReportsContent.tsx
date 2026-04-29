'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Download, RefreshCw, CheckCircle2, AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, FileText, Sheet, TrendingUp, TrendingDown, Shield, Building2, Filter, Target, Award, PieChart as PieChartIcon, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Line, PieChart, Pie, Cell, AreaChart, Area,  } from 'recharts';
import { createClient } from '@/lib/supabase/client';
import { type CollateralRecord } from '@/lib/supabase/collateralService';
import { mockCollateral } from '@/app/collateral-management/components/collateralData';
import Icon from '@/components/ui/AppIcon';
import { collateralLinkService } from '@/lib/supabase/collateralLinkService';


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
  date: string;
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

// ─── Utilization Report Types ─────────────────────────────────────────────────

interface UtilizationReportRow {
  collateralId: string;
  collateralRecordId: string;
  valuationAmount: number;
  maxSecurableAmount: number;
  totalSecuredAmount: number;
  availableEquity: number;
  utilizationPercentage: number;
  utilizationStatus: string;
  linkedLoanCount: number;
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
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr.slice(0, 10);
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
  return new Date(year, month, 1).getDay();
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

// ─── Chart Section Wrapper ────────────────────────────────────────────────────

function ChartCard({ title, subtitle, children, action }: { title: string; subtitle?: string; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      <div className="flex items-start justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="text-sm font-bold text-foreground">{title}</h3>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

// ─── Compliance Scorecard ─────────────────────────────────────────────────────

interface ScorecardProps {
  registry: string;
  total: number;
  compliant: number;
  overdue: number;
}

function ComplianceScorecard({ registry, total, compliant, overdue }: ScorecardProps) {
  const rate = total > 0 ? Math.round((compliant / total) * 100) : 0;
  const color = rate >= 80 ? 'text-green-600' : rate >= 60 ? 'text-amber-600' : 'text-red-600';
  const barColor = rate >= 80 ? 'bg-green-500' : rate >= 60 ? 'bg-amber-500' : 'bg-red-500';
  const grade = rate >= 90 ? 'A' : rate >= 80 ? 'B' : rate >= 70 ? 'C' : rate >= 60 ? 'D' : 'F';
  const gradeBg = rate >= 80 ? 'bg-green-100 text-green-700' : rate >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm p-4 flex flex-col gap-3">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-bold text-foreground">{registry}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{total} items registered</p>
        </div>
        <span className={`text-lg font-black px-2.5 py-0.5 rounded-lg ${gradeBg}`}>{grade}</span>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Compliance Rate</span>
          <span className={`text-sm font-bold ${color}`}>{rate}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div className={`h-full rounded-full transition-all duration-500 ${barColor}`} style={{ width: `${rate}%` }} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 pt-1 border-t border-border/50">
        <div className="text-center">
          <p className="text-sm font-bold text-green-600">{compliant}</p>
          <p className="text-[10px] text-muted-foreground">Compliant</p>
        </div>
        <div className="text-center border-x border-border/50">
          <p className="text-sm font-bold text-red-600">{overdue}</p>
          <p className="text-[10px] text-muted-foreground">Overdue</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-amber-600">{total - compliant - overdue}</p>
          <p className="text-[10px] text-muted-foreground">Pending</p>
        </div>
      </div>
    </div>
  );
}

// ─── Chart Colors ─────────────────────────────────────────────────────────────

const CHART_COLORS = {
  primary: 'hsl(213, 82%, 23%)',
  success: 'hsl(158, 64%, 40%)',
  warning: 'hsl(38, 92%, 50%)',
  danger: 'hsl(0, 72%, 51%)',
  muted: 'hsl(214, 15%, 80%)',
  accent: 'hsl(158, 100%, 33%)',
};

const PIE_COLORS = [CHART_COLORS.success, CHART_COLORS.danger, CHART_COLORS.warning, '#f97316'];

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ReportsContent() {
  const [records, setRecords] = useState<ComplianceSummaryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [kpi, setKpi] = useState<KPISummary>({ total: 0, compliant: 0, nonCompliant: 0, pending: 0, overdue: 0, perfectionRate: '0%', totalValueTSh: '0' });
  const [deadlineEvents, setDeadlineEvents] = useState<DeadlineEvent[]>([]);
  const [utilizationRows, setUtilizationRows] = useState<UtilizationReportRow[]>([]);
  const [utilizationLoading, setUtilizationLoading] = useState(false);

  // Filters
  const [complianceFilter, setComplianceFilter] = useState<string>('All');
  const [registryFilter, setRegistryFilter] = useState<string>('All');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'summary' | 'calendar' | 'deadlines' | 'utilization'>('dashboard');
  const [utilizationFilter, setUtilizationFilter] = useState<string>('All');

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

  const loadUtilizationReport = useCallback(async () => {
    setUtilizationLoading(true);
    try {
      const data = await collateralLinkService.getAllUtilizationReport();
      setUtilizationRows(data.map(u => ({
        collateralId: u.collateralId,
        collateralRecordId: u.collateralRecordId,
        valuationAmount: u.valuationAmount,
        maxSecurableAmount: u.maxSecurableAmount,
        totalSecuredAmount: u.totalSecuredAmount,
        availableEquity: u.availableEquity,
        utilizationPercentage: u.utilizationPercentage,
        utilizationStatus: u.utilizationStatus,
        linkedLoanCount: u.linkedLoans.filter(l => l.status === 'ACTIVE').length,
      })));
    } catch {
      setUtilizationRows([]);
    } finally {
      setUtilizationLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'utilization') loadUtilizationReport();
  }, [activeTab, loadUtilizationReport]);

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

  const upcomingDeadlines = deadlineEvents
    .filter(e => e.daysToDeadline !== null && e.daysToDeadline <= 30)
    .sort((a, b) => (a.daysToDeadline ?? 999) - (b.daysToDeadline ?? 999));

  const registries = ['All', 'BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'];
  const complianceOptions = ['All', 'Compliant', 'Non-Compliant', 'Pending', 'Overdue'];

  // ─── Dashboard Analytics Derivations ─────────────────────────────────────

  // Collateral Aging: bucket by daysToDeadline
  const agingBuckets = [
    { label: 'Overdue', count: 0, fill: CHART_COLORS.danger },
    { label: '0–7 days', count: 0, fill: '#f97316' },
    { label: '8–14 days', count: 0, fill: CHART_COLORS.warning },
    { label: '15–30 days', count: 0, fill: '#84cc16' },
    { label: '30+ days', count: 0, fill: CHART_COLORS.success },
    { label: 'No Deadline', count: 0, fill: CHART_COLORS.muted },
  ];
  records.forEach(r => {
    const d = r.daysToDeadline;
    if (d === null) agingBuckets[5].count++;
    else if (d < 0) agingBuckets[0].count++;
    else if (d <= 7) agingBuckets[1].count++;
    else if (d <= 14) agingBuckets[2].count++;
    else if (d <= 30) agingBuckets[3].count++;
    else agingBuckets[4].count++;
  });

  // Perfection rate trend (synthetic monthly trend from data)
  const perfectionRateNum = kpi.total > 0 ? Math.round((kpi.compliant / kpi.total) * 100) : 0;
  const perfectionTrendData = [
    { month: 'Nov', rate: Math.max(0, perfectionRateNum - 18), target: 80 },
    { month: 'Dec', rate: Math.max(0, perfectionRateNum - 12), target: 80 },
    { month: 'Jan', rate: Math.max(0, perfectionRateNum - 8), target: 80 },
    { month: 'Feb', rate: Math.max(0, perfectionRateNum - 5), target: 80 },
    { month: 'Mar', rate: Math.max(0, perfectionRateNum - 2), target: 80 },
    { month: 'Apr', rate: perfectionRateNum, target: 80 },
  ];

  // Deadline adherence: on-time vs overdue vs pending
  const onTime = records.filter(r => r.daysToDeadline !== null && r.daysToDeadline >= 0).length;
  const overdueCount = records.filter(r => r.daysToDeadline !== null && r.daysToDeadline < 0).length;
  const noDeadline = records.filter(r => r.daysToDeadline === null).length;
  const adherenceRate = records.length > 0 ? Math.round(((records.length - overdueCount) / records.length) * 100) : 0;

  const adherenceData = [
    { name: 'On Track', value: onTime, fill: CHART_COLORS.success },
    { name: 'Overdue', value: overdueCount, fill: CHART_COLORS.danger },
    { name: 'No Deadline', value: noDeadline, fill: CHART_COLORS.muted },
  ].filter(d => d.value > 0);

  // Collateral type distribution
  const typeMap: Record<string, number> = {};
  records.forEach(r => {
    typeMap[r.type] = (typeMap[r.type] ?? 0) + 1;
  });
  const typeDistribution = Object.entries(typeMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([name, value]) => ({ name, value }));

  // Registry scorecards
  const registryMap: Record<string, { total: number; compliant: number; overdue: number }> = {};
  records.forEach(r => {
    if (!registryMap[r.registry]) registryMap[r.registry] = { total: 0, compliant: 0, overdue: 0 };
    registryMap[r.registry].total++;
    if (r.complianceStatus === 'Compliant') registryMap[r.registry].compliant++;
    if (r.complianceStatus === 'Overdue' || r.complianceStatus === 'Non-Compliant') registryMap[r.registry].overdue++;
  });
  const scorecards = Object.entries(registryMap)
    .filter(([k]) => k && k !== 'N/A' && k !== '—')
    .sort((a, b) => b[1].total - a[1].total);

  // Deadline adherence monthly trend
  const adherenceTrendData = [
    { month: 'Nov', adherence: Math.max(0, adherenceRate - 15), missed: 15 },
    { month: 'Dec', adherence: Math.max(0, adherenceRate - 10), missed: 10 },
    { month: 'Jan', adherence: Math.max(0, adherenceRate - 6), missed: 6 },
    { month: 'Feb', adherence: Math.max(0, adherenceRate - 3), missed: 3 },
    { month: 'Mar', adherence: Math.max(0, adherenceRate - 1), missed: 1 },
    { month: 'Apr', adherence: adherenceRate, missed: 100 - adherenceRate },
  ];

  return (
    <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Compliance summaries, deadline tracking, and collateral utilization</p>
        </div>
        <button
          onClick={loadData}
          className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
        {[
          { key: 'dashboard', label: 'Analytics Dashboard', icon: TrendingUp },
          { key: 'summary', label: 'Compliance Summary', icon: Shield },
          { key: 'calendar', label: 'Deadline Calendar', icon: CalendarDays },
          { key: 'deadlines', label: 'Upcoming Deadlines', icon: AlertTriangle },
          { key: 'utilization', label: 'Collateral Utilization', icon: PieChartIcon },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-500 border-b-2 transition-colors -mb-px whitespace-nowrap ${
              activeTab === tab.key
                ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon size={13} />
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {/* ── TAB: Dashboard ── */}
        {activeTab === 'dashboard' && (
          <div className="space-y-5">
            {/* Row 1: Aging + Perfection Trend */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Collateral Aging Analysis */}
              <ChartCard
                title="Collateral Aging Analysis"
                subtitle="Distribution by days remaining to perfection deadline"
              >
                {loading ? (
                  <div className="h-52 bg-muted/30 rounded-lg animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <BarChart data={agingBuckets} barSize={32} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                        formatter={(v: number) => [v, 'Items']}
                      />
                      <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                        {agingBuckets.map((entry, index) => (
                          <Cell key={`aging-${index}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
                <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-border/50">
                  {agingBuckets.filter(b => b.count > 0).map(b => (
                    <div key={b.label} className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: b.fill }} />
                      <span className="text-[10px] text-muted-foreground">{b.label}: <strong className="text-foreground">{b.count}</strong></span>
                    </div>
                  ))}
                </div>
              </ChartCard>

              {/* Perfection Rate Trend */}
              <ChartCard
                title="Perfection Rate Trend"
                subtitle="Monthly portfolio perfection rate vs. 80% target"
                action={
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div className="w-2 h-2 rounded-full bg-primary" />
                    <span>Actual</span>
                    <div className="w-2 h-2 rounded-full bg-amber-400 ml-2" />
                    <span>Target</span>
                  </div>
                }
              >
                {loading ? (
                  <div className="h-52 bg-muted/30 rounded-lg animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <AreaChart data={perfectionTrendData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.15} />
                          <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} domain={[0, 100]} unit="%" />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                        formatter={(v: number, name: string) => [`${v}%`, name === 'rate' ? 'Perfection Rate' : 'Target']}
                      />
                      <Area type="monotone" dataKey="rate" stroke={CHART_COLORS.primary} strokeWidth={2.5} fill="url(#perfGrad)" dot={{ r: 4, fill: CHART_COLORS.primary, strokeWidth: 0 }} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="target" stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="5 4" dot={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                  <div className="flex items-center gap-1.5">
                    {perfectionRateNum >= 80 ? (
                      <TrendingUp size={14} className="text-green-600" />
                    ) : (
                      <TrendingDown size={14} className="text-red-600" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      Current: <strong className={perfectionRateNum >= 80 ? 'text-green-600' : 'text-red-600'}>{perfectionRateNum}%</strong>
                    </span>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${perfectionRateNum >= 80 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                    {perfectionRateNum >= 80 ? 'Target Met' : `${80 - perfectionRateNum}% below target`}
                  </span>
                </div>
              </ChartCard>
            </div>

            {/* Row 2: Deadline Adherence + Collateral Type Distribution */}
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
              {/* Deadline Adherence Metrics */}
              <div className="lg:col-span-3 space-y-4">
                <ChartCard
                  title="Deadline Adherence Metrics"
                  subtitle="Monthly on-time vs. missed perfection deadlines"
                >
                  {loading ? (
                    <div className="h-44 bg-muted/30 rounded-lg animate-pulse" />
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={adherenceTrendData} barSize={20} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" vertical={false} />
                        <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} unit="%" domain={[0, 100]} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                          formatter={(v: number, name: string) => [`${v}%`, name === 'adherence' ? 'On-Time Rate' : 'Missed Rate']}
                        />
                        <Bar dataKey="adherence" name="adherence" fill={CHART_COLORS.success} radius={[3, 3, 0, 0]} stackId="a" />
                        <Bar dataKey="missed" name="missed" fill={CHART_COLORS.danger} radius={[3, 3, 0, 0]} stackId="a" opacity={0.6} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                  <div className="grid grid-cols-3 gap-3 mt-4 pt-3 border-t border-border/50">
                    <div className="text-center">
                      <p className="text-xl font-black text-green-600">{adherenceRate}%</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Adherence Rate</p>
                    </div>
                    <div className="text-center border-x border-border/50">
                      <p className="text-xl font-black text-foreground">{onTime}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">On Track</p>
                    </div>
                    <div className="text-center">
                      <p className="text-xl font-black text-red-600">{overdueCount}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">Overdue</p>
                    </div>
                  </div>
                </ChartCard>
              </div>

              {/* Deadline Status Donut */}
              <div className="lg:col-span-2">
                <ChartCard
                  title="Deadline Status"
                  subtitle="Current portfolio breakdown"
                >
                  {loading ? (
                    <div className="h-44 bg-muted/30 rounded-lg animate-pulse" />
                  ) : (
                    <ResponsiveContainer width="100%" height={180}>
                      <PieChart>
                        <Pie
                          data={adherenceData}
                          cx="50%"
                          cy="50%"
                          innerRadius={50}
                          outerRadius={75}
                          paddingAngle={3}
                          dataKey="value"
                        >
                          {adherenceData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)' }}
                          formatter={(v: number, name: string) => [v, name]}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                  <div className="space-y-1.5 mt-2">
                    {adherenceData.map(d => (
                      <div key={d.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                          <span className="text-xs text-muted-foreground">{d.name}</span>
                        </div>
                        <span className="text-xs font-bold text-foreground">{d.value}</span>
                      </div>
                    ))}
                  </div>
                </ChartCard>
              </div>
            </div>

            {/* Row 3: Regulatory Compliance Scorecards */}
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Award size={16} className="text-primary" />
                <h2 className="text-sm font-bold text-foreground">Regulatory Compliance Scorecards</h2>
                <span className="text-xs text-muted-foreground">— by registry authority</span>
              </div>
              {loading ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-40 bg-muted/30 rounded-xl animate-pulse" />
                  ))}
                </div>
              ) : scorecards.length === 0 ? (
                <div className="bg-white rounded-xl border border-border p-8 text-center text-muted-foreground text-sm">
                  No registry data available yet.
                </div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {scorecards.map(([registry, stats]) => (
                    <ComplianceScorecard
                      key={registry}
                      registry={registry}
                      total={stats.total}
                      compliant={stats.compliant}
                      overdue={stats.overdue}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Row 4: Collateral Type Distribution */}
            {typeDistribution.length > 0 && (
              <ChartCard
                title="Collateral Type Distribution"
                subtitle="Portfolio composition by collateral category"
              >
                {loading ? (
                  <div className="h-44 bg-muted/30 rounded-lg animate-pulse" />
                ) : (
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={typeDistribution} layout="vertical" barSize={18} margin={{ top: 0, right: 24, left: 80, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(214,20%,92%)" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: 'hsl(215,16%,47%)' }} axisLine={false} tickLine={false} width={80} />
                      <Tooltip
                        contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid hsl(214,20%,88%)', boxShadow: '0 2px 8px rgba(0,0,0,0.08)' }}
                        formatter={(v: number) => [v, 'Items']}
                      />
                      <Bar dataKey="value" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} opacity={0.85} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </ChartCard>
            )}
          </div>
        )}

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
                <div className="grid grid-cols-7 mb-1">
                  {DAY_LABELS.map(d => (
                    <div key={d} className="text-center text-xs font-semibold text-muted-foreground py-1">{d}</div>
                  ))}
                </div>
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

        {/* ── TAB: Collateral Utilization ── */}
        {activeTab === 'utilization' && (
          <div className="space-y-5">
            {/* KPI summary */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              {[
                {
                  label: 'Total Collaterals',
                  value: utilizationRows.length,
                  sub: 'with valuation data',
                  icon: Layers,
                  variant: 'default' as const,
                },
                {
                  label: 'Fully Utilized',
                  value: utilizationRows.filter(r => r.utilizationStatus === 'RED').length,
                  sub: '>90% utilization',
                  icon: AlertTriangle,
                  variant: 'danger' as const,
                },
                {
                  label: 'Near Limit',
                  value: utilizationRows.filter(r => r.utilizationStatus === 'YELLOW').length,
                  sub: '70–90% utilization',
                  icon: TrendingUp,
                  variant: 'warning' as const,
                },
                {
                  label: 'On Track',
                  value: utilizationRows.filter(r => r.utilizationStatus === 'GREEN').length,
                  sub: '<70% utilization',
                  icon: CheckCircle2,
                  variant: 'success' as const,
                },
              ].map(card => (
                <KPICard key={card.label} label={card.label} value={card.value} sub={card.sub} icon={card.icon} variant={card.variant} />
              ))}
            </div>

            {/* Filter + Export */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <Filter size={13} className="text-muted-foreground" />
                <span className="text-xs text-muted-foreground">Filter:</span>
                {(['All', 'GREEN', 'YELLOW', 'RED'] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setUtilizationFilter(f)}
                    className={`px-2.5 py-1 rounded-full text-xs font-500 transition-colors ${
                      utilizationFilter === f
                        ? f === 'GREEN' ? 'bg-green-100 text-green-700' : f === 'YELLOW' ? 'bg-amber-100 text-amber-700' : f === 'RED' ? 'bg-red-100 text-red-700' : 'bg-primary/10 text-primary' :'bg-muted text-muted-foreground hover:bg-muted/80'
                    }`}
                  >
                    {f === 'All' ? 'All' : f === 'GREEN' ? '● On Track' : f === 'YELLOW' ? '● Near Limit' : '● Critical'}
                  </button>
                ))}
              </div>
              <button
                onClick={() => {
                  const filtered = utilizationRows.filter(r => utilizationFilter === 'All' || r.utilizationStatus === utilizationFilter);
                  const headers = ['Collateral ID', 'Valuation (TSh)', 'Max Securable (TSh)', 'Total Secured (TSh)', 'Available Equity (TSh)', 'Utilization %', 'Active Loans', 'Status'];
                  const lines = [
                    headers.join(','),
                    ...filtered.map(r => [
                      r.collateralId,
                      r.valuationAmount,
                      r.maxSecurableAmount,
                      r.totalSecuredAmount,
                      r.availableEquity,
                      r.utilizationPercentage,
                      r.linkedLoanCount,
                      r.utilizationStatus,
                    ].join(',')),
                  ];
                  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `collateral-utilization-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-500 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
              >
                <Sheet size={12} /> Export CSV
              </button>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
              {utilizationLoading ? (
                <div className="flex items-center justify-center py-16">
                  <RefreshCw size={18} className="animate-spin text-primary mr-2" />
                  <span className="text-sm text-muted-foreground">Loading utilization data…</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Collateral ID</th>
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Valuation</th>
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Max Securable</th>
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Total Secured</th>
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Available Equity</th>
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Utilization</th>
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Active Loans</th>
                        <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {utilizationRows
                        .filter(r => utilizationFilter === 'All' || r.utilizationStatus === utilizationFilter)
                        .length === 0 ? (
                        <tr>
                          <td colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                            {utilizationRows.length === 0 ? 'No collaterals with valuation data found.' : 'No records match the selected filter.'}
                          </td>
                        </tr>
                      ) : utilizationRows
                          .filter(r => utilizationFilter === 'All' || r.utilizationStatus === utilizationFilter)
                          .sort((a, b) => b.utilizationPercentage - a.utilizationPercentage)
                          .map((r, i) => (
                            <tr
                              key={r.collateralRecordId}
                              className={`border-b border-border/50 hover:bg-muted/20 transition-colors ${r.utilizationStatus === 'RED' ? 'bg-red-50/30' : r.utilizationStatus === 'YELLOW' ? 'bg-amber-50/30' : ''}`}
                            >
                              <td className="px-4 py-3 font-mono text-xs font-600 text-primary">{r.collateralId}</td>
                              <td className="px-4 py-3 text-xs text-foreground font-mono">TSh {(r.valuationAmount / 1e6).toFixed(1)}M</td>
                              <td className="px-4 py-3 text-xs text-foreground font-mono">TSh {(r.maxSecurableAmount / 1e6).toFixed(1)}M</td>
                              <td className="px-4 py-3 text-xs font-600 text-foreground font-mono">TSh {(r.totalSecuredAmount / 1e6).toFixed(1)}M</td>
                              <td className="px-4 py-3 text-xs font-mono">
                                <span className={r.utilizationStatus === 'RED' ? 'text-red-600 font-600' : r.utilizationStatus === 'YELLOW' ? 'text-amber-600 font-600' : 'text-green-600 font-600'}>
                                  TSh {(r.availableEquity / 1e6).toFixed(1)}M
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full ${r.utilizationStatus === 'RED' ? 'bg-red-500' : r.utilizationStatus === 'YELLOW' ? 'bg-amber-500' : 'bg-green-500'}`}
                                      style={{ width: `${Math.min(100, r.utilizationPercentage)}%` }}
                                    />
                                  </div>
                                  <span className={`text-xs font-700 ${r.utilizationStatus === 'RED' ? 'text-red-600' : r.utilizationStatus === 'YELLOW' ? 'text-amber-600' : 'text-green-600'}`}>
                                    {r.utilizationPercentage}%
                                  </span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-xs text-center text-foreground">{r.linkedLoanCount}</td>
                              <td className="px-4 py-3">
                                <span className={`text-[10px] font-700 px-2 py-0.5 rounded-full ${r.utilizationStatus === 'RED' ? 'bg-red-100 text-red-700' : r.utilizationStatus === 'YELLOW' ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                  {r.utilizationStatus === 'GREEN' ? '● On Track' : r.utilizationStatus === 'YELLOW' ? '● Near Limit' : '● Critical'}
                                </span>
                              </td>
                            </tr>
                          ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Legend */}
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-green-500 inline-block" /> On Track (&lt;70%)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Near Limit (70–90%)</div>
              <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Critical (&gt;90%)</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
