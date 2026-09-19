'use client';
import React, { useEffect, useState } from 'react';
import { dashboardService } from '@/lib/supabase/collateralService';
import { useDashboardRefresh } from '../DashboardRefreshContext';
import { ShieldAlert, AlertTriangle, TrendingUp, CheckCircle2 } from 'lucide-react';

interface RiskSegment {
  label: string;
  count: number;
  barColor: string;
  bgStyle: React.CSSProperties;
  textStyle: React.CSSProperties;
  icon: React.ElementType;
}

export default function LTVRiskPanel() {
  const { refreshKey } = useDashboardRefresh();
  const [stats, setStats] = useState<{
    total: number;
    critical: number;
    high: number;
    elevated: number;
    healthy: number;
    avgLtv: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dashboardService.getLTVExposure().then((data) => {
      setStats(data);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [refreshKey]);

  const total = stats?.total ?? 0;
  const critical = stats?.critical ?? 0;
  const high = stats?.high ?? 0;
  const elevated = stats?.elevated ?? 0;
  const healthy = stats?.healthy ?? 0;
  const avgLtv = stats?.avgLtv ?? 0;

  const segments: RiskSegment[] = [
    {
      label: 'Healthy (<60%)',
      count: healthy,
      barColor: '#16a34a',
      bgStyle: { backgroundColor: '#f0fdf4' },
      textStyle: { color: '#15803d' },
      icon: CheckCircle2,
    },
    {
      label: 'Elevated (60–75%)',
      count: elevated,
      barColor: 'var(--izou-primary)',
      bgStyle: { backgroundColor: 'var(--izou-primary-light)' },
      textStyle: { color: 'var(--izou-primary-dark)' },
      icon: TrendingUp,
    },
    {
      label: 'High (75–90%)',
      count: high,
      barColor: '#d97706',
      bgStyle: { backgroundColor: '#fffbeb' },
      textStyle: { color: '#b45309' },
      icon: AlertTriangle,
    },
    {
      label: 'Critical (>90%)',
      count: critical,
      barColor: '#dc2626',
      bgStyle: { backgroundColor: '#fef2f2' },
      textStyle: { color: '#b91c1c' },
      icon: ShieldAlert,
    },
  ];

  const riskLabel =
    critical > 0 ? 'Critical exposure' :
    high > 0 ? 'Elevated exposure' :
    'Under control';
  const riskColor = critical > 0 ? '#dc2626' : high > 0 ? '#d97706' : '#16a34a';

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>LTV / Risk Exposure</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>Loan-to-value risk distribution across the portfolio</p>
        </div>
        {!isLoading && total > 0 && (
          <div className="text-right">
            <p className="text-2xl font-bold font-mono tabular-nums" style={{ color: riskColor }}>{avgLtv.toFixed(0)}%</p>
            <p className="text-xs font-semibold" style={{ color: riskColor }}>Avg LTV · {riskLabel}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-5 animate-pulse rounded-full" style={{ backgroundColor: 'rgba(0,169,224,0.08)' }} />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(0,169,224,0.08)' }} />
            ))}
          </div>
        </div>
      ) : total === 0 ? (
        <div className="flex items-center justify-center h-20 text-sm" style={{ color: 'var(--izou-muted)' }}>
          No LTV data available
        </div>
      ) : (
        <>
          {/* Stacked risk bar */}
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
        </>
      )}
    </div>
  );
}
