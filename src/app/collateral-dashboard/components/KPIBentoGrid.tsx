'use client';
import React, { useEffect, useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Shield,
  FileCheck,
  Banknote,
  Scale,
} from 'lucide-react';
import { dashboardService } from '@/lib/supabase/collateralService';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';
import Icon from '@/components/ui/AppIcon';



interface KPICardProps {
  label: string;
  value: string;
  subtext: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string };
  icon: React.ElementType;
  variant?: 'default' | 'alert' | 'warning' | 'success';
}

function KPICard({
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  variant = 'default',
}: KPICardProps) {
  const variantStyles: Record<string, React.CSSProperties> = {
    default: { backgroundColor: '#ffffff', border: '1px solid var(--izou-border)' },
    alert: { backgroundColor: '#fef2f2', border: '1px solid #fecaca' },
    warning: { backgroundColor: '#fffbeb', border: '1px solid #fde68a' },
    success: { backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0' },
  };
  const iconBg: Record<string, React.CSSProperties> = {
    default: { backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary)' },
    alert: { backgroundColor: '#fee2e2', color: '#dc2626' },
    warning: { backgroundColor: '#fef3c7', color: '#d97706' },
    success: { backgroundColor: '#dcfce7', color: '#16a34a' },
  };
  const valueColor: Record<string, string> = {
    default: 'var(--izou-text)',
    alert: '#b91c1c',
    warning: '#b45309',
    success: '#15803d',
  };

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        ...variantStyles[variant],
        boxShadow: '0 1px 4px rgba(0,0,0,0.07), 0 1px 2px rgba(0,0,0,0.04)',
        transition: 'box-shadow 0.22s var(--izou-ease), border-color 0.22s var(--izou-ease)',
      }}
    >
      <div className="flex items-start justify-between mb-3">
        <p
          className="text-xs font-semibold uppercase tracking-wider leading-tight pr-2"
          style={{ color: 'var(--izou-muted)' }}
        >
          {label}
        </p>
        <div
          className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
          style={iconBg[variant]}
        >
          <Icon size={18} />
        </div>
      </div>
      <p
        className="text-3xl font-bold tabular-nums mb-1 font-mono"
        style={{ color: valueColor[variant] }}
      >
        {value}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{subtext}</p>
        {trend && (
          <span
            className="inline-flex items-center gap-0.5 text-xs font-semibold"
            style={{
              color: trend.direction === 'up' ? '#16a34a'
                : trend.direction === 'down'? '#dc2626' :'var(--izou-muted)'
            }}
          >
            {trend.direction === 'up' ? (
              <TrendingUp size={12} />
            ) : trend.direction === 'down' ? (
              <TrendingDown size={12} />
            ) : null}
            {trend.label}
          </span>
        )}
      </div>
    </div>
  );
}

export default function KPIBentoGrid() {
  const [stats, setStats] = useState<{
    total: number;
    perfected: number;
    overdue: number;
    approachingDeadline: number;
    pendingReview: number;
    perfectionRate: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStats = () => {
    dashboardService.getKPIStats().then((data) => {
      setStats(data);
      setIsLoading(false);
    }).catch(() => {
      setError('Failed to load KPI statistics. Please refresh to try again.');
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadStats();
  }, []);

  useCollateralRealtime({
    onCollateralChange: () => {
      dashboardService.getKPIStats().then((data) => setStats(data)).catch(() => {});
    },
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={`kpi-skel-${i}`}
            className="rounded-2xl p-5 animate-pulse h-28"
            style={{ backgroundColor: 'rgba(0,169,224,0.06)', border: '1px solid var(--izou-border)' }}
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="rounded-2xl p-6 flex items-center gap-3"
        style={{ border: '1px solid #fecaca', backgroundColor: '#fef2f2' }}
      >
        <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-red-600" />
        </div>
        <div>
          <p className="text-sm font-semibold text-red-700">Unable to load KPI data</p>
          <p className="text-xs text-red-600 mt-0.5">{error}</p>
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

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
      <KPICard
        label="Total Collateral Items"
        value={String(total)}
        subtext="Active items in portfolio"
        trend={{ direction: 'up', label: 'Live' }}
        icon={Banknote}
        variant="success"
      />
      <KPICard
        label="Perfection Rate"
        value={`${rate}%`}
        subtext={`${perfected} of ${total} perfected`}
        trend={{ direction: 'up', label: 'Live' }}
        icon={Shield}
        variant="default"
      />
      <KPICard
        label="Perfected Items"
        value={String(perfected)}
        subtext="Fully registered & perfected"
        trend={{ direction: 'up', label: 'Completed' }}
        icon={Scale}
        variant="success"
      />
      <KPICard
        label="Overdue Actions"
        value={String(overdue)}
        subtext="Past registry deadline"
        trend={{ direction: 'down', label: 'Action needed' }}
        icon={AlertTriangle}
        variant="alert"
      />
      <KPICard
        label="Approaching Deadline"
        value={String(approaching)}
        subtext="Due within 7 days"
        trend={{ direction: 'neutral', label: 'Monitor' }}
        icon={Clock}
        variant="warning"
      />
      <KPICard
        label="Pending Legal Review"
        value={String(pending)}
        subtext="Awaiting Legal Officer"
        trend={{ direction: 'neutral', label: 'Under review' }}
        icon={FileCheck}
        variant="warning"
      />
    </div>
  );
}