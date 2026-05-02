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

const volumeData: VolumePoint[] = [
  { label: 'Mon', created: 12, perfected: 9, overdue: 2 },
  { label: 'Tue', created: 18, perfected: 14, overdue: 1 },
  { label: 'Wed', created: 8, perfected: 11, overdue: 3 },
  { label: 'Thu', created: 22, perfected: 17, overdue: 2 },
  { label: 'Fri', created: 15, perfected: 13, overdue: 1 },
  { label: 'Sat', created: 5, perfected: 4, overdue: 0 },
  { label: 'Sun', created: 3, perfected: 2, overdue: 1 },
];

const registryTurnaround: RegistryTurnaround[] = [
  { registry: 'BRELA', avgDays: 18, target: 14 },
  { registry: 'Lands', avgDays: 32, target: 28 },
  { registry: 'TRA', avgDays: 12, target: 10 },
  { registry: 'DSE', avgDays: 7, target: 7 },
  { registry: 'TASAC', avgDays: 21, target: 18 },
];

const concentrationData: ConcentrationItem[] = [
  { name: 'Land & Property', value: 42, color: '#2563eb' },
  { name: 'Motor Vehicles', value: 23, color: '#7c3aed' },
  { name: 'Shares/Securities', value: 15, color: '#0891b2' },
  { name: 'Equipment', value: 12, color: '#059669' },
  { name: 'Other', value: 8, color: '#d97706' },
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

  useEffect(() => {
    setLastUpdate(new Date().toLocaleTimeString('en-GB'));
  }, []);

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
