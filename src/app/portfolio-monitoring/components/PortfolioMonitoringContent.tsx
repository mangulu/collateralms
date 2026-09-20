'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Wifi, WifiOff, BarChart2, Clock, AlertTriangle, Shield, Layers, Download,  } from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { toast } from 'sonner';
import { createClient } from '@/lib/supabase/client';
import { dashboardService } from '@/lib/supabase/collateralService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioMetrics {
  total: number;
  totalValue: number;
  utilizationPercentage: number;
  perfectionRate: string;
  overdueFilings: number;
  pendingPerfection: number;
  delinquencyRate: number;
  timestamp: string;
}

interface VolumePoint {
  label: string;
  created: number;
  perfected: number;
  overdue: number;
}

interface RegistryTurnaround {
  registry: string;
  avgDays: number | null;
  target: number;
}

interface ConcentrationItem {
  name: string;
  value: number;
  color: string;
}

const CONCENTRATION_COLORS: Record<string, string> = {
  'Mortgage': 'var(--izou-secondary)',
  'Motor Vehicle': 'var(--izou-primary)',
  'Shares (DSE)': 'var(--izou-secondary-mid)',
  'Debenture': 'var(--izou-success)',
  'FDR': 'var(--izou-warning)',
  'Guarantee': 'var(--izou-highlight)',
  'Ship/Vessel': 'var(--izou-neutral)',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Target days are policy SLAs, not measured data -- avgDays (the actual
// figure) is computed live from perfection_requests in fetchTurnaroundData.
const REGISTRY_TARGETS: Record<string, number> = {
  BRELA: 14,
  'Lands Registry': 28,
  TRA: 10,
  DSE: 7,
  TASAC: 18,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTZS(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString();
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function MetricCard({ label, value, sub, icon: Icon, trend, variant = 'default', live = false }: {
  label: string; value: string; sub: string; icon: React.ElementType;
  trend?: { dir: 'up' | 'down'; label: string }; variant?: 'default' | 'danger' | 'warning' | 'success'; live?: boolean;
}) {
  const bg = { default: 'bg-white border-border', danger: 'bg-red-50 border-red-200', warning: 'bg-amber-50 border-amber-200', success: 'bg-green-50 border-green-200' };
  const iconBg = { default: 'bg-primary/10 text-primary', danger: 'bg-red-100 text-red-600', warning: 'bg-amber-100 text-amber-600', success: 'bg-green-100 text-green-600' };
  const valColor = { default: 'text-foreground', danger: 'text-red-700', warning: 'text-amber-700', success: 'text-green-700' };
  return (
    <div className={`rounded-xl p-5 shadow-card border ${bg[variant]} relative overflow-hidden`}>
      {live && <span className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-600 text-green-600"><span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />LIVE</span>}
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider leading-tight pr-2">{label}</p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-3xl font-700 tabular-nums mb-1 font-mono ${valColor[variant]}`}>{value}</p>
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">{sub}</p>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-500 ${trend.dir === 'up' ? 'text-green-600' : 'text-red-600'}`}>
            {trend.dir === 'up' ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioMonitoringContent() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'volumes' | 'turnaround' | 'concentration' | 'delinquency'>('volumes');
  const [exporting, setExporting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live chart data state
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  const [concentrationData, setConcentrationData] = useState<ConcentrationItem[]>([]);
  const [concentrationLoading, setConcentrationLoading] = useState(true);
  const [concentrationError, setConcentrationError] = useState<string | null>(null);

  const [turnaroundData, setTurnaroundData] = useState<RegistryTurnaround[]>([]);
  const [turnaroundLoading, setTurnaroundLoading] = useState(true);
  const [turnaroundError, setTurnaroundError] = useState<string | null>(null);

  // ── Fetch real portfolio-wide KPI metrics ─────────────────────────────────
  const fetchMetrics = useCallback(async () => {
    try {
      const data = await dashboardService.getPortfolioMonitoringMetrics();
      if (data) setMetrics(data);
      setLastUpdate(new Date().toLocaleTimeString('en-GB'));
    } catch {
      // keep showing the last good metrics rather than clearing them
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  // ── Fetch registry turnaround (real avg days, merged with SLA targets) ────
  const fetchTurnaroundData = useCallback(async () => {
    setTurnaroundLoading(true);
    setTurnaroundError(null);
    try {
      const avgByRegistry = await dashboardService.getRegistryTurnaround();
      const rows: RegistryTurnaround[] = Object.entries(REGISTRY_TARGETS).map(([registry, target]) => ({
        registry,
        avgDays: avgByRegistry[registry] ?? null,
        target,
      }));
      setTurnaroundData(rows);
    } catch (err: unknown) {
      setTurnaroundError(err instanceof Error ? err.message : 'Failed to load turnaround data');
    } finally {
      setTurnaroundLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTurnaroundData();
  }, [fetchTurnaroundData]);

  // ── Fetch daily collateral volumes (last 7 days) ──────────────────────────
  const fetchVolumeData = useCallback(async () => {
    setVolumeLoading(true);
    setVolumeError(null);
    try {
      const supabase = createClient();
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);

      const { data, error } = await supabase
        .from('collateral_records')
        .select('created_at, status')
        .gte('created_at', since.toISOString());

      if (error) throw new Error(error.message);

      // Build a map keyed by day-of-week index (0=Sun … 6=Sat) for the last 7 days
      const dayMap: Record<number, { created: number; perfected: number; overdue: number }> = {};
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        dayMap[d.getDay()] = { created: 0, perfected: 0, overdue: 0 };
      }

      (data ?? []).forEach((row) => {
        const dow = new Date(row.created_at).getDay();
        if (dayMap[dow] !== undefined) {
          dayMap[dow].created += 1;
          if (row.status === 'Perfected') dayMap[dow].perfected += 1;
          if (row.status === 'Overdue') dayMap[dow].overdue += 1;
        }
      });

      // Build ordered array starting from 6 days ago → today
      const points: VolumePoint[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dow = d.getDay();
        points.push({
          label: DAY_LABELS[dow],
          created: dayMap[dow]?.created ?? 0,
          perfected: dayMap[dow]?.perfected ?? 0,
          overdue: dayMap[dow]?.overdue ?? 0,
        });
      }

      setVolumeData(points);
    } catch (err: unknown) {
      setVolumeError(err instanceof Error ? err.message : 'Failed to load volume data');
    } finally {
      setVolumeLoading(false);
    }
  }, []);

  // ── Fetch collateral concentration by type ────────────────────────────────
  const fetchConcentrationData = useCallback(async () => {
    setConcentrationLoading(true);
    setConcentrationError(null);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('collateral_records')
        .select('collateral_type');

      if (error) throw new Error(error.message);

      const counts: Record<string, number> = {};
      (data ?? []).forEach((row) => {
        const t = row.collateral_type ?? 'Other';
        counts[t] = (counts[t] ?? 0) + 1;
      });

      const total = Object.values(counts).reduce((s, v) => s + v, 0) || 1;
      const items: ConcentrationItem[] = Object.entries(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([name, count]) => ({
          name,
          value: Math.round((count / total) * 100),
          color: CONCENTRATION_COLORS[name] ?? 'var(--izou-neutral)',
        }));

      setConcentrationData(items);
    } catch (err: unknown) {
      setConcentrationError(err instanceof Error ? err.message : 'Failed to load concentration data');
    } finally {
      setConcentrationLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchVolumeData();
    fetchConcentrationData();
  }, [fetchVolumeData, fetchConcentrationData]);

  // "Live" polls all real data sources on an interval -- there is no actual
  // push/WebSocket connection, just a periodic refetch while enabled.
  const startPolling = useCallback(() => {
    setWsConnected(true);
    intervalRef.current = setInterval(() => {
      fetchMetrics();
      fetchVolumeData();
      fetchConcentrationData();
    }, 30000);
  }, [fetchMetrics, fetchVolumeData, fetchConcentrationData]);

  const stopPolling = useCallback(() => {
    setWsConnected(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startPolling();
    return () => stopPolling();
  }, [startPolling, stopPolling]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const dateTo = new Date();
      const dateFrom = new Date(dateTo.getFullYear(), dateTo.getMonth() - 5, 1);
      const response = await fetch('/api/export/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reportType: 'perfection_rate',
          dateFrom: dateFrom.toISOString().slice(0, 10),
          dateTo: dateTo.toISOString().slice(0, 10),
          registries: [],
          statuses: [],
          collateralTypes: [],
          includeCharts: false,
          includeSummary: true,
          includeDetails: false,
          stakeholderMode: false,
        }),
      });
      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(err.error ?? `HTTP ${response.status}`);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `portfolio_monitoring_${dateTo.toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Report exported');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to export report');
    } finally {
      setExporting(false);
    }
  };

  const tabs = [
    { key: 'volumes' as const, label: 'Volumes', icon: BarChart2 },
    { key: 'turnaround' as const, label: 'Turnaround Time', icon: Clock },
    { key: 'concentration' as const, label: 'Concentration', icon: Layers },
    { key: 'delinquency' as const, label: 'Delinquency', icon: AlertTriangle },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center">
              <Activity size={18} className="text-blue-600" />
            </div>
            <h1 className="text-xl font-700" style={{ color: 'var(--izou-primary)' }}>Real-Time Portfolio Monitoring</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={wsConnected ? stopPolling : startPolling}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-500 rounded-lg border transition-colors ${
              wsConnected
                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' :'bg-white border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {wsConnected ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-60"
          >
            <Download size={14} className={exporting ? 'animate-pulse' : ''} /> {exporting ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Live KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-xl bg-muted/40 animate-pulse" />
          ))
        ) : (
          <>
            <MetricCard label="Total Collateral" value={String(metrics.total)} sub="Active items" icon={Shield} live={wsConnected} variant="default" />
            <MetricCard label="Portfolio Value" value={`TZS ${formatTZS(metrics.totalValue)}`} sub="Total registered value" icon={TrendingUp} live={wsConnected} variant="success" />
            <MetricCard label="Utilization" value={`${metrics.utilizationPercentage.toFixed(1)}%`} sub="Secured / max securable" icon={Activity} live={wsConnected} variant={metrics.utilizationPercentage > 80 ? 'warning' : 'default'} />
            <MetricCard label="Perfection Rate" value={`${metrics.perfectionRate}%`} sub="vs 80% target" icon={Shield} live={wsConnected} variant={Number(metrics.perfectionRate) >= 80 ? 'success' : 'warning'} />
            <MetricCard label="Overdue Filings" value={String(metrics.overdueFilings)} sub="Past deadline" icon={AlertTriangle} live={wsConnected} variant="danger" />
            <MetricCard label="Pending Perfection" value={String(metrics.pendingPerfection)} sub="In progress" icon={Clock} live={wsConnected} variant="warning" />
          </>
        )}
      </div>

      {/* Chart Tabs */}
      <div className="bg-white border border-border rounded-xl shadow-card overflow-hidden">
        <div className="flex border-b border-border overflow-x-auto">
          {tabs.map((tab) => {
            const TabIcon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-500 whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <TabIcon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="p-5">
          {activeTab === 'volumes' && (
            <div>
              <h3 className="text-sm font-700 text-foreground mb-1">Daily Collateral Volumes</h3>
              <p className="text-xs text-muted-foreground mb-4">New collateral created, perfected, and overdue by day</p>
              {volumeLoading ? (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">Loading volume data…</div>
              ) : volumeError ? (
                <div className="flex items-center justify-center h-[280px] text-sm text-red-500">{volumeError}</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={volumeData} barGap={4}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--izou-border)" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="created" name="Created" fill="var(--izou-secondary)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="perfected" name="Perfected" fill="var(--izou-success)" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="overdue" name="Overdue" fill="var(--izou-danger)" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {activeTab === 'turnaround' && (
            <div>
              <h3 className="text-sm font-700 text-foreground mb-1">Average Turnaround Time by Registry</h3>
              <p className="text-xs text-muted-foreground mb-4">Actual avg days from submission to decision (perfection_requests) vs SLA target</p>
              {turnaroundLoading ? (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">Loading turnaround data…</div>
              ) : turnaroundError ? (
                <div className="flex items-center justify-center h-[280px] text-sm text-red-500">{turnaroundError}</div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={turnaroundData.map((r) => ({ ...r, avgDays: r.avgDays ?? 0 }))} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--izou-border)" />
                    <XAxis type="number" tick={{ fontSize: 12 }} unit=" days" />
                    <YAxis dataKey="registry" type="category" tick={{ fontSize: 12 }} width={80} />
                    <Tooltip formatter={(v, name, props: any) => props.dataKey === 'avgDays' && props.payload.avgDays === 0 ? ['No decided requests yet', 'Avg Days'] : [v, name]} />
                    <Legend />
                    <Bar dataKey="avgDays" name="Avg Days" fill="var(--izou-secondary)" radius={[0, 3, 3, 0]} />
                    <Bar dataKey="target" name="Target" fill="var(--izou-border)" radius={[0, 3, 3, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {activeTab === 'concentration' && (
            <div>
              <h3 className="text-sm font-700 text-foreground mb-1">Collateral Concentration by Type</h3>
              <p className="text-xs text-muted-foreground mb-4">Exposure distribution across collateral categories</p>
              {concentrationLoading ? (
                <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">Loading concentration data…</div>
              ) : concentrationError ? (
                <div className="flex items-center justify-center h-[280px] text-sm text-red-500">{concentrationError}</div>
              ) : (
                <div className="flex items-center justify-center">
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie data={concentrationData} cx="50%" cy="50%" outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}%`} labelLine={false}>
                        {concentrationData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v) => `${v}%`} />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {activeTab === 'delinquency' && (
            <div>
              <h3 className="text-sm font-700 text-foreground mb-1">Delinquency Rate</h3>
              <p className="text-xs text-muted-foreground mb-4">
                Share of collateral-linked loans currently marked Defaulted. Only a current snapshot is shown — there's
                no historical snapshot data to build a real trend from, so this no longer fabricates one.
              </p>
              {metricsLoading || !metrics ? (
                <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">Loading…</div>
              ) : (
                <div className="flex items-center justify-center h-[200px]">
                  <div className={`rounded-2xl px-10 py-8 text-center border ${metrics.delinquencyRate > 10 ? 'bg-red-50 border-red-200' : metrics.delinquencyRate > 5 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                    <p className={`text-4xl font-700 font-mono ${metrics.delinquencyRate > 10 ? 'text-red-700' : metrics.delinquencyRate > 5 ? 'text-amber-700' : 'text-green-700'}`}>
                      {metrics.delinquencyRate.toFixed(1)}%
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">of loan-linked collateral, as of {lastUpdate || 'now'}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Technology Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Wifi size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-600 text-blue-800">Auto-Refresh</p>
            <p className="text-xs text-blue-700 mt-0.5">
              While "Live" is on, the KPI grid, Volumes, and Concentration data are re-queried every 30 seconds. This is
              periodic polling, not a push-based connection — toggle to "Paused" to stop it.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
