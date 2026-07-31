'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Activity, TrendingUp, TrendingDown, Wifi, WifiOff, BarChart2, Clock, AlertTriangle, Shield, Layers, Download,  } from 'lucide-react';
import {
  AreaChart,
  Area,
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
import Icon from '@/components/ui/AppIcon';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PortfolioMetrics {
  totalCollateral: number;
  totalValue: number;
  utilizationPercentage: number;
  perfectionRate: number;
  overdueFilings: number;
  pendingPerfection: number;
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
  avgDays: number;
  target: number;
}

interface ConcentrationItem {
  name: string;
  value: number;
  color: string;
}

// ─── Mock Data Generators ─────────────────────────────────────────────────────

function generateMetrics(): PortfolioMetrics {
  return {
    totalCollateral: 342 + Math.floor(Math.random() * 5),
    totalValue: 25000000000 + Math.floor(Math.random() * 500000000),
    utilizationPercentage: 72 + Math.random() * 5,
    perfectionRate: 79 + Math.random() * 4,
    overdueFilings: 10 + Math.floor(Math.random() * 5),
    pendingPerfection: 28 + Math.floor(Math.random() * 8),
    timestamp: new Date().toISOString(),
  };
}

const CONCENTRATION_COLORS: Record<string, string> = {
  'Mortgage': '#2563eb',
  'Motor Vehicle': '#7c3aed',
  'Shares (DSE)': '#0891b2',
  'Debenture': '#059669',
  'FDR': '#d97706',
  'Guarantee': '#db2777',
  'Ship/Vessel': '#64748b',
};

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const registryTurnaround: RegistryTurnaround[] = [
  { registry: 'BRELA', avgDays: 18, target: 14 },
  { registry: 'Lands', avgDays: 32, target: 28 },
  { registry: 'TRA', avgDays: 12, target: 10 },
  { registry: 'DSE', avgDays: 7, target: 7 },
  { registry: 'TASAC', avgDays: 21, target: 18 },
];

const delinquencyTrend = [
  { month: 'Jan', rate: 4.2 },
  { month: 'Feb', rate: 3.8 },
  { month: 'Mar', rate: 5.1 },
  { month: 'Apr', rate: 4.7 },
  { month: 'May', rate: 3.9 },
  { month: 'Jun', rate: 4.3 },
];

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
  const [metrics, setMetrics] = useState<PortfolioMetrics>(generateMetrics());
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'volumes' | 'turnaround' | 'concentration' | 'delinquency'>('volumes');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Live chart data state
  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  const [concentrationData, setConcentrationData] = useState<ConcentrationItem[]>([]);
  const [concentrationLoading, setConcentrationLoading] = useState(true);
  const [concentrationError, setConcentrationError] = useState<string | null>(null);

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString('en-GB'));
  }, []);

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
          color: CONCENTRATION_COLORS[name] ?? '#94a3b8',
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

  const startWebSocket = useCallback(() => {
    setWsConnected(true);
    intervalRef.current = setInterval(() => {
      setMetrics(generateMetrics());
      setLastUpdate(new Date().toLocaleTimeString('en-GB'));
    }, 5000);
  }, []);

  const stopWebSocket = useCallback(() => {
    setWsConnected(false);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    startWebSocket();
    return () => stopWebSocket();
  }, [startWebSocket, stopWebSocket]);

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
            <h1 className="text-xl font-700 text-foreground">Real-Time Portfolio Monitoring</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Live portfolio metrics with WebSocket updates · Last updated: {lastUpdate}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={wsConnected ? stopWebSocket : startWebSocket}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-500 rounded-lg border transition-colors ${
              wsConnected
                ? 'bg-green-50 border-green-200 text-green-700 hover:bg-green-100' :'bg-white border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
            {wsConnected ? 'Live' : 'Connect'}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors">
            <Download size={14} /> Export PDF
          </button>
        </div>
      </div>

      {/* Live KPI Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <MetricCard label="Total Collateral" value={String(metrics.totalCollateral)} sub="Active items" icon={Shield} live={wsConnected} variant="default" />
        <MetricCard label="Portfolio Value" value={`TZS ${formatTZS(metrics.totalValue)}`} sub="Total registered value" icon={TrendingUp} live={wsConnected} variant="success" />
        <MetricCard label="Utilization" value={`${metrics.utilizationPercentage.toFixed(1)}%`} sub="Collateral utilization" icon={Activity} live={wsConnected} variant={metrics.utilizationPercentage > 80 ? 'warning' : 'default'} />
        <MetricCard label="Perfection Rate" value={`${metrics.perfectionRate.toFixed(1)}%`} sub="vs 80% target" icon={Shield} live={wsConnected} variant={metrics.perfectionRate >= 80 ? 'success' : 'warning'} trend={{ dir: 'up', label: '+2.1%' }} />
        <MetricCard label="Overdue Filings" value={String(metrics.overdueFilings)} sub="Past deadline" icon={AlertTriangle} live={wsConnected} variant="danger" />
        <MetricCard label="Pending Perfection" value={String(metrics.pendingPerfection)} sub="In progress" icon={Clock} live={wsConnected} variant="warning" />
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
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="label" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="created" name="Created" fill="#2563eb" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="perfected" name="Perfected" fill="#059669" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="overdue" name="Overdue" fill="#dc2626" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          )}

          {activeTab === 'turnaround' && (
            <div>
              <h3 className="text-sm font-700 text-foreground mb-1">Average Turnaround Time by Registry</h3>
              <p className="text-xs text-muted-foreground mb-4">Average days per registry vs target (hourly refresh)</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={registryTurnaround} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 12 }} unit=" days" />
                  <YAxis dataKey="registry" type="category" tick={{ fontSize: 12 }} width={60} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="avgDays" name="Avg Days" fill="#7c3aed" radius={[0, 3, 3, 0]} />
                  <Bar dataKey="target" name="Target" fill="#d1d5db" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
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
              <h3 className="text-sm font-700 text-foreground mb-1">Delinquency Rate Trend</h3>
              <p className="text-xs text-muted-foreground mb-4">Collateral linked to delinquent loans (monthly)</p>
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={delinquencyTrend}>
                  <defs>
                    <linearGradient id="delinqGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} unit="%" />
                  <Tooltip formatter={(v) => `${v}%`} />
                  <Area type="monotone" dataKey="rate" name="Delinquency Rate" stroke="#dc2626" fill="url(#delinqGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Technology Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Wifi size={16} className="text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-600 text-blue-800">WebSocket Real-Time Updates</p>
            <p className="text-xs text-blue-700 mt-0.5">
              Dashboard metrics refresh every 5 seconds via simulated WebSocket connection. In production, this connects to <code className="bg-blue-100 px-1 rounded">GET /reports/portfolio/real-time</code> WebSocket endpoint. Materialized views pre-aggregate metrics for sub-second response times.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
