'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp, TrendingDown, AlertTriangle, Clock, Shield, Banknote,
  Scale, Activity, RefreshCw, Download, BarChart3, Target, Zap
} from 'lucide-react';
import { dashboardService } from '@/lib/supabase/collateralService';
import { createClient } from '@/lib/supabase/client';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend
} from 'recharts';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';


interface KPIStats {
  total: number;
  perfected: number;
  overdue: number;
  approachingDeadline: number;
  pendingReview: number;
  perfectionRate: string;
  totalValueTSh?: number;
  avgLTV?: number;
}

interface TrendData {
  month: string;
  perfected: number;
  submitted: number;
  overdue: number;
}

interface TypeDist {
  type: string;
  count: number;
}

const PIE_COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2', '#be185d'];

function fmtTSh(n: number) {
  if (n >= 1_000_000_000_000) return `TSh ${(n / 1_000_000_000_000).toFixed(1)}T`;
  if (n >= 1_000_000_000) return `TSh ${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `TSh ${(n / 1_000_000).toFixed(0)}M`;
  return `TSh ${n.toLocaleString()}`;
}

function KPICard({
  label, value, subtext, trend, icon: Icon, variant = 'default'
}: {
  label: string; value: string; subtext: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string };
  icon: React.ElementType; variant?: 'default' | 'alert' | 'warning' | 'success';
}) {
  const styles = {
    default: { card: 'bg-white border-border', icon: 'bg-primary/10 text-primary', val: 'text-foreground' },
    alert: { card: 'bg-red-50 border-red-200', icon: 'bg-red-100 text-red-600', val: 'text-red-700' },
    warning: { card: 'bg-amber-50 border-amber-200', icon: 'bg-amber-100 text-amber-600', val: 'text-amber-700' },
    success: { card: 'bg-green-50 border-green-200', icon: 'bg-green-100 text-green-600', val: 'text-green-700' },
  };
  const s = styles[variant];
  return (
    <div className={`rounded-xl p-4 shadow-sm border ${s.card}`}>
      <div className="flex items-start justify-between mb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider leading-tight pr-2">{label}</p>
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${s.icon}`}>
          <Icon size={16} />
        </div>
      </div>
      <p className={`text-xl font-bold tabular-nums mb-1 font-mono leading-tight break-all ${s.val}`}>{value}</p>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">{subtext}</p>
        {trend && (
          <span className={`inline-flex items-center gap-0.5 text-xs font-medium ${
            trend.direction === 'up' ? 'text-green-600' : trend.direction === 'down' ? 'text-red-600' : 'text-muted-foreground'
          }`}>
            {trend.direction === 'up' ? <TrendingUp size={11} /> : trend.direction === 'down' ? <TrendingDown size={11} /> : null}
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ExecutiveDashboardContent() {
  const [stats, setStats] = useState<KPIStats | null>(null);
  const [trend, setTrend] = useState<TrendData[]>([]);
  const [typeDist, setTypeDist] = useState<TypeDist[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const supabase = createClient();
      const [kpi, trendData, typeData, valData] = await Promise.all([
        dashboardService.getKPIStats(),
        dashboardService.getPerfectionTrend(),
        dashboardService.getTypeDistribution(),
        supabase.from('collateral_records').select('value_tsh, ltv_ratio').limit(500),
      ]);

      const records = valData.data ?? [];
      const totalValue = records.reduce((sum, r) => sum + (r.value_tsh ?? 0), 0);
      const ltvValues = records.filter((r) => r.ltv_ratio != null).map((r) => r.ltv_ratio as number);
      const avgLTV = ltvValues.length > 0 ? ltvValues.reduce((a, b) => a + b, 0) / ltvValues.length : 0;

      setStats({ ...(kpi ?? { total: 0, perfected: 0, overdue: 0, approachingDeadline: 0, pendingReview: 0, perfectionRate: '0.0' }), totalValueTSh: totalValue, avgLTV });
      setTrend(trendData ?? []);
      setTypeDist(typeData ?? []);
      setLastUpdated(new Date().toLocaleTimeString('en-TZ', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  if (loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="rounded-xl p-4 border bg-white animate-pulse h-24" />
          ))}
        </div>
      </div>
    );
  }

  const total = stats?.total ?? 0;
  const perfected = stats?.perfected ?? 0;
  const overdue = stats?.overdue ?? 0;
  const approaching = stats?.approachingDeadline ?? 0;
  const pending = stats?.pendingReview ?? 0;
  const rate = stats?.perfectionRate ?? '0.0';
  const totalVal = stats?.totalValueTSh ?? 0;
  const avgLTV = stats?.avgLTV ?? 0;

  return (
    <div className="p-4 sm:p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-foreground">Executive Dashboard</h1>
            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-100 text-green-700 text-xs font-medium rounded-full">
              <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
              Live
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Real-time portfolio KPIs · EXIM Bank Tanzania
            {lastUpdated && <span className="ml-2 text-xs">· Updated {lastUpdated}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
          <button
            onClick={() => toast.info('PDF export queued')}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-all"
          >
            <Download size={14} />
            <span className="hidden sm:inline">Export</span>
          </button>
        </div>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
        <KPICard label="Total Portfolio Value" value={fmtTSh(totalVal)} subtext="Across all active collateral" trend={{ direction: 'up', label: 'Live' }} icon={Banknote} variant="success" />
        <KPICard label="Perfection Rate" value={`${rate}%`} subtext={`${perfected} of ${total} perfected`} trend={{ direction: 'up', label: 'Live' }} icon={Shield} variant="default" />
        <KPICard label="Total Collateral Items" value={String(total)} subtext="Active items in portfolio" trend={{ direction: 'up', label: 'Live' }} icon={Scale} variant="default" />
        <KPICard label="Avg LTV Ratio" value={`${(avgLTV * 100).toFixed(1)}%`} subtext="Portfolio-wide average" trend={{ direction: avgLTV > 0.75 ? 'down' : 'neutral', label: avgLTV > 0.75 ? 'High risk' : 'Healthy' }} icon={Target} variant={avgLTV > 0.75 ? 'warning' : 'default'} />
        <KPICard label="Overdue Actions" value={String(overdue)} subtext="Past registry deadline" trend={{ direction: 'down', label: 'Action needed' }} icon={AlertTriangle} variant="alert" />
        <KPICard label="Approaching Deadline" value={String(approaching)} subtext="Due within 7 days" trend={{ direction: 'neutral', label: 'Monitor' }} icon={Clock} variant="warning" />
        <KPICard label="Pending Legal Review" value={String(pending)} subtext="Awaiting Legal Officer" trend={{ direction: 'neutral', label: 'Under review' }} icon={Activity} variant="warning" />
        <KPICard label="Perfected Items" value={String(perfected)} subtext="Fully registered" trend={{ direction: 'up', label: 'Completed' }} icon={Zap} variant="success" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Perfection Trend */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Perfection Trend (6 Months)</h3>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="overdueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="perfected" stroke="#2563eb" fill="url(#perfGrad)" strokeWidth={2} name="Perfected" />
              <Area type="monotone" dataKey="submitted" stroke="#16a34a" fill="none" strokeWidth={2} strokeDasharray="4 2" name="Submitted" />
              <Area type="monotone" dataKey="overdue" stroke="#dc2626" fill="url(#overdueGrad)" strokeWidth={2} name="Overdue" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Type Distribution */}
        <div className="bg-white rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <Scale size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Collateral by Type</h3>
          </div>
          {typeDist.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={typeDist} dataKey="count" nameKey="type" cx="50%" cy="50%" outerRadius={75} label={({ type, percent }) => `${type.split(' ')[0]} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                  {typeDist.map((_, i) => (
                    <Cell key={`cell-${i}`} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[220px] flex items-center justify-center text-sm text-muted-foreground">No data available</div>
          )}
        </div>
      </div>

      {/* LTV Distribution Bar Chart */}
      {trend.length > 0 && (
        <div className="bg-white rounded-xl border border-border p-4 sm:p-5">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Monthly Activity Breakdown</h3>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={trend} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="perfected" fill="#2563eb" name="Perfected" radius={[3, 3, 0, 0]} />
              <Bar dataKey="submitted" fill="#16a34a" name="Submitted" radius={[3, 3, 0, 0]} />
              <Bar dataKey="overdue" fill="#dc2626" name="Overdue" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
