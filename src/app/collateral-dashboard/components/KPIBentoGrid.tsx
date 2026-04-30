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
  const variantStyles = {
    default: 'bg-white border-border',
    alert: 'bg-red-50 border-red-200',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-green-50 border-green-200',
  };
  const iconBg = {
    default: 'bg-primary/10 text-primary',
    alert: 'bg-red-100 text-red-600',
    warning: 'bg-amber-100 text-amber-600',
    success: 'bg-green-100 text-green-600',
  };
  const valueColor = {
    default: 'text-foreground',
    alert: 'text-red-700',
    warning: 'text-amber-700',
    success: 'text-green-700',
  };

  return (
    <div className={`rounded-xl p-5 shadow-card border ${variantStyles[variant]}`}>
      <div className="flex items-start justify-between mb-3">
        <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider leading-tight pr-2">
          {label}
        </p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconBg[variant]}`}>
          <Icon size={18} />
        </div>
      </div>
      <p className={`text-3xl font-700 tabular-nums mb-1 font-mono ${valueColor[variant]}`}>
        {value}
      </p>
      <div className="flex items-center gap-2 flex-wrap">
        <p className="text-xs text-muted-foreground">{subtext}</p>
        {trend && (
          <span
            className={`inline-flex items-center gap-0.5 text-xs font-500 ${
              trend.direction === 'up' ?'text-green-600'
                : trend.direction === 'down' ?'text-red-600' :'text-muted-foreground'
            }`}
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

  useEffect(() => {
    dashboardService.getKPIStats().then((data) => {
      setStats(data);
      setIsLoading(false);
    }).catch(() => {
      setError('Failed to load KPI statistics. Please refresh to try again.');
      setIsLoading(false);
    });
  }, []);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`kpi-skel-${i}`} className="rounded-xl p-5 shadow-card border bg-white animate-pulse h-28" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center shrink-0">
          <AlertTriangle size={18} className="text-red-600" />
        </div>
        <div>
          <p className="text-sm font-600 text-red-700">Unable to load KPI data</p>
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