'use client';
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Activity, TrendingUp, Wifi, WifiOff, BarChart2, Clock, AlertTriangle, Layers,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts';
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

function formatTZS(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString();
}

export default function RealTimeMonitoringSection() {
  const [metrics, setMetrics] = useState<PortfolioMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdate, setLastUpdate] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'volumes' | 'turnaround' | 'concentration' | 'delinquency'>('volumes');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [volumeData, setVolumeData] = useState<VolumePoint[]>([]);
  const [volumeLoading, setVolumeLoading] = useState(true);
  const [volumeError, setVolumeError] = useState<string | null>(null);

  const [concentrationData, setConcentrationData] = useState<ConcentrationItem[]>([]);
  const [concentrationLoading, setConcentrationLoading] = useState(true);
  const [concentrationError, setConcentrationError] = useState<string | null>(null);

  const [turnaroundData, setTurnaroundData] = useState<RegistryTurnaround[]>([]);
  const [turnaroundLoading, setTurnaroundLoading] = useState(true);
  const [turnaroundError, setTurnaroundError] = useState<string | null>(null);

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

  useEffect(() => { fetchMetrics(); }, [fetchMetrics]);

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

  useEffect(() => { fetchTurnaroundData(); }, [fetchTurnaroundData]);

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

  const tabs = [
    { key: 'volumes' as const, label: 'Volumes', icon: BarChart2 },
    { key: 'turnaround' as const, label: 'Turnaround Time', icon: Clock },
    { key: 'concentration' as const, label: 'Concentration', icon: Layers },
    { key: 'delinquency' as const, label: 'Delinquency', icon: AlertTriangle },
  ];

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap px-5 py-4" style={{ borderBottom: '1px solid var(--izou-border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-secondary-light)' }}>
            <Activity size={16} style={{ color: 'var(--izou-secondary)' }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-base font-bold truncate" style={{ color: 'var(--izou-text)' }}>Real-Time Monitoring</h3>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>
              Auto-refreshed every 30s while Live · Last updated: {lastUpdate}
            </p>
          </div>
        </div>
        <button
          onClick={wsConnected ? stopPolling : startPolling}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 rounded-lg border transition-colors shrink-0"
          style={wsConnected
            ? { backgroundColor: 'var(--izou-success-light)', borderColor: 'var(--izou-success-light)', color: 'var(--izou-success)' }
            : { backgroundColor: 'var(--izou-card)', borderColor: 'var(--izou-border)', color: 'var(--izou-muted)' }}
        >
          {wsConnected ? <Wifi size={14} /> : <WifiOff size={14} />}
          {wsConnected ? 'Live' : 'Paused'}
        </button>
      </div>

      {/* Portfolio Value + Utilization */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-5" style={{ borderBottom: '1px solid var(--izou-border)' }}>
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ backgroundColor: 'var(--izou-success-light)' }}>
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-card)' }}>
            <TrendingUp size={16} style={{ color: 'var(--izou-success)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>Portfolio Value</p>
            {metricsLoading || !metrics ? (
              <div className="h-6 w-20 mt-0.5 rounded animate-pulse" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
            ) : (
              <p className="text-xl font-bold font-mono tabular-nums" style={{ color: 'var(--izou-success)' }}>TZS {formatTZS(metrics.totalValue)}</p>
            )}
          </div>
        </div>
        <div
          className="rounded-xl p-3 flex items-center gap-3"
          style={{ backgroundColor: metrics && metrics.utilizationPercentage > 80 ? 'var(--izou-warning-light)' : 'var(--izou-secondary-light)' }}
        >
          <div className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-card)' }}>
            <Activity size={16} style={{ color: metrics && metrics.utilizationPercentage > 80 ? 'var(--izou-warning)' : 'var(--izou-secondary)' }} />
          </div>
          <div className="min-w-0">
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>Utilization</p>
            {metricsLoading || !metrics ? (
              <div className="h-6 w-16 mt-0.5 rounded animate-pulse" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
            ) : (
              <p className="text-xl font-bold font-mono tabular-nums" style={{ color: metrics.utilizationPercentage > 80 ? 'var(--izou-warning)' : 'var(--izou-secondary)' }}>
                {metrics.utilizationPercentage.toFixed(1)}%
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Chart Tabs */}
      <div className="flex border-b overflow-x-auto" style={{ borderColor: 'var(--izou-border)' }}>
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1.5 px-4 py-3 text-sm font-500 whitespace-nowrap border-b-2 transition-colors"
              style={isActive
                ? { borderColor: 'var(--izou-primary)', color: 'var(--izou-primary)' }
                : { borderColor: 'transparent', color: 'var(--izou-muted)' }}
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
            <h4 className="text-sm font-700" style={{ color: 'var(--izou-text)' }}>Daily Collateral Volumes</h4>
            <p className="text-xs mb-4" style={{ color: 'var(--izou-muted)' }}>New collateral created, perfected, and overdue by day</p>
            {volumeLoading ? (
              <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--izou-muted)' }}>Loading volume data…</div>
            ) : volumeError ? (
              <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--izou-danger)' }}>{volumeError}</div>
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
            <h4 className="text-sm font-700" style={{ color: 'var(--izou-text)' }}>Average Turnaround Time by Registry</h4>
            <p className="text-xs mb-4" style={{ color: 'var(--izou-muted)' }}>Actual avg days from submission to decision vs SLA target</p>
            {turnaroundLoading ? (
              <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--izou-muted)' }}>Loading turnaround data…</div>
            ) : turnaroundError ? (
              <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--izou-danger)' }}>{turnaroundError}</div>
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
            <h4 className="text-sm font-700" style={{ color: 'var(--izou-text)' }}>Collateral Concentration by Type</h4>
            <p className="text-xs mb-4" style={{ color: 'var(--izou-muted)' }}>Exposure distribution across collateral categories</p>
            {concentrationLoading ? (
              <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--izou-muted)' }}>Loading concentration data…</div>
            ) : concentrationError ? (
              <div className="flex items-center justify-center h-[280px] text-sm" style={{ color: 'var(--izou-danger)' }}>{concentrationError}</div>
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
            <h4 className="text-sm font-700" style={{ color: 'var(--izou-text)' }}>Delinquency Rate</h4>
            <p className="text-xs mb-4" style={{ color: 'var(--izou-muted)' }}>
              Share of collateral-linked loans currently marked Defaulted. Only a current snapshot is shown — there's
              no historical snapshot data to build a real trend from.
            </p>
            {metricsLoading || !metrics ? (
              <div className="flex items-center justify-center h-[200px] text-sm" style={{ color: 'var(--izou-muted)' }}>Loading…</div>
            ) : (
              <div className="flex items-center justify-center h-[200px]">
                <div
                  className="rounded-2xl px-10 py-8 text-center border"
                  style={metrics.delinquencyRate > 10
                    ? { backgroundColor: 'var(--izou-danger-light)', borderColor: 'var(--izou-danger-light)' }
                    : metrics.delinquencyRate > 5
                      ? { backgroundColor: 'var(--izou-warning-light)', borderColor: 'var(--izou-warning-light)' }
                      : { backgroundColor: 'var(--izou-success-light)', borderColor: 'var(--izou-success-light)' }}
                >
                  <p
                    className="text-4xl font-700 font-mono"
                    style={{ color: metrics.delinquencyRate > 10 ? 'var(--izou-danger)' : metrics.delinquencyRate > 5 ? 'var(--izou-warning)' : 'var(--izou-success)' }}
                  >
                    {metrics.delinquencyRate.toFixed(1)}%
                  </p>
                  <p className="text-xs mt-2" style={{ color: 'var(--izou-muted)' }}>of loan-linked collateral, as of {lastUpdate || 'now'}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
