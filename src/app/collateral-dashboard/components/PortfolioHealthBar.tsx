'use client';
import React, { useEffect, useState } from 'react';
import { dashboardService } from '@/lib/supabase/collateralService';
import { useDashboardRefresh } from '../DashboardRefreshContext';
import { TrendingUp, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';


interface HealthSegment {
  label: string;
  count: number;
  barColor: string;
  bgStyle: React.CSSProperties;
  textStyle: React.CSSProperties;
  icon: React.ElementType;
}

export default function PortfolioHealthBar() {
  const { refreshKey } = useDashboardRefresh();
  const [stats, setStats] = useState<{
    total: number;
    perfected: number;
    overdue: number;
    approachingDeadline: number;
    pendingReview: number;
    perfectionRate: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dashboardService.getKPIStats().then((data) => {
      setStats(data);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [refreshKey]);

  const total = stats?.total ?? 0;
  const perfected = stats?.perfected ?? 0;
  const overdue = stats?.overdue ?? 0;
  const approaching = stats?.approachingDeadline ?? 0;
  const pending = stats?.pendingReview ?? 0;
  const inProgress = Math.max(0, total - perfected - overdue - approaching - pending);

  const segments: HealthSegment[] = [
    {
      label: 'Perfected',
      count: perfected,
      barColor: 'var(--izou-success)',
      bgStyle: { backgroundColor: 'var(--izou-success-light)' },
      textStyle: { color: 'var(--izou-success)' },
      icon: CheckCircle2
    },
    {
      label: 'In Progress',
      count: inProgress,
      barColor: 'var(--izou-secondary)',
      bgStyle: { backgroundColor: 'var(--izou-secondary-light)' },
      textStyle: { color: 'var(--izou-secondary)' },
      icon: TrendingUp
    },
    {
      label: 'Approaching',
      count: approaching,
      barColor: 'var(--izou-warning)',
      bgStyle: { backgroundColor: 'var(--izou-warning-light)' },
      textStyle: { color: 'var(--izou-warning)' },
      icon: Clock
    },
    {
      label: 'Overdue',
      count: overdue,
      barColor: 'var(--izou-danger)',
      bgStyle: { backgroundColor: 'var(--izou-danger-light)' },
      textStyle: { color: 'var(--izou-danger)' },
      icon: AlertTriangle
    },
  ];

  const healthScore = total > 0 ? Math.round((perfected / total) * 100) : 0;
  const healthLabel =
    healthScore >= 80 ? 'Healthy' :
    healthScore >= 60 ? 'Moderate' :
    healthScore >= 40 ? 'At Risk' : 'Critical';
  const healthColor =
    healthScore >= 80 ? 'var(--izou-success)' :
    healthScore >= 60 ? 'var(--izou-warning)' :
    healthScore >= 40 ? 'var(--izou-warning)' : 'var(--izou-danger)';

  return (
    <div
      className="rounded-2xl p-5 h-full flex flex-col"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>Portfolio Health</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>Distribution of collateral perfection status</p>
        </div>
        {!isLoading && total > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold font-mono tabular-nums" style={{ color: healthColor }}>{healthScore}%</p>
            <p className="text-xs font-semibold" style={{ color: healthColor }}>{healthLabel}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-5 animate-pulse rounded-full" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
            ))}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex flex-col justify-center">
          {/* Stacked progress bar */}
          <div className="flex rounded-full overflow-hidden h-4 mb-4 gap-0.5">
            {segments.map((seg) => {
              const pct = total > 0 ? (seg.count / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={seg.label}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${pct}%`, backgroundColor: seg.barColor }}
                  title={`${seg.label}: ${seg.count} (${pct.toFixed(1)}%)`}
                />
              );
            })}
            {total === 0 && <div className="h-full w-full rounded-full" style={{ backgroundColor: 'var(--izou-border)' }} />}
          </div>

          {/* Segment breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {segments.map((seg) => {
              const SegIcon = seg.icon;
              const pct = total > 0 ? ((seg.count / total) * 100).toFixed(1) : '0.0';
              return (
                <div key={seg.label} className="rounded-xl p-3" style={seg.bgStyle}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <SegIcon size={13} style={seg.textStyle} />
                    <span className="text-xs font-semibold" style={seg.textStyle}>{seg.label}</span>
                  </div>
                  <p className="text-xl font-bold font-mono tabular-nums" style={seg.textStyle}>{seg.count}</p>
                  <p className="text-xs opacity-75" style={seg.textStyle}>{pct}% of total</p>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
