'use client';
import React, { useEffect, useState } from 'react';
import { dashboardService } from '@/lib/supabase/collateralService';
import { TrendingUp, AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


interface HealthSegment {
  label: string;
  count: number;
  color: string;
  bgColor: string;
  textColor: string;
  icon: React.ElementType;
}

export default function PortfolioHealthBar() {
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
  }, []);

  const total = stats?.total ?? 0;
  const perfected = stats?.perfected ?? 0;
  const overdue = stats?.overdue ?? 0;
  const approaching = stats?.approachingDeadline ?? 0;
  const pending = stats?.pendingReview ?? 0;
  const inProgress = Math.max(0, total - perfected - overdue - approaching - pending);

  const segments: HealthSegment[] = [
    { label: 'Perfected', count: perfected, color: '#00A86B', bgColor: 'bg-green-100', textColor: 'text-green-700', icon: CheckCircle2 },
    { label: 'In Progress', count: inProgress, color: '#0B3D6B', bgColor: 'bg-blue-100', textColor: 'text-blue-700', icon: TrendingUp },
    { label: 'Approaching', count: approaching, color: '#D97706', bgColor: 'bg-amber-100', textColor: 'text-amber-700', icon: Clock },
    { label: 'Overdue', count: overdue, color: '#DC2626', bgColor: 'bg-red-100', textColor: 'text-red-700', icon: AlertTriangle },
  ];

  const healthScore = total > 0 ? Math.round((perfected / total) * 100) : 0;
  const healthLabel =
    healthScore >= 80 ? 'Healthy' :
    healthScore >= 60 ? 'Moderate' :
    healthScore >= 40 ? 'At Risk' : 'Critical';
  const healthColor =
    healthScore >= 80 ? 'text-green-600' :
    healthScore >= 60 ? 'text-amber-600' :
    healthScore >= 40 ? 'text-orange-600' : 'text-red-600';

  return (
    <div className="bg-white rounded-xl shadow-card border border-border p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-600 text-foreground">Portfolio Health</h3>
          <p className="text-xs text-muted-foreground mt-0.5">Distribution of collateral perfection status</p>
        </div>
        {!isLoading && total > 0 && (
          <div className="text-right">
            <p className={`text-2xl font-700 font-mono tabular-nums ${healthColor}`}>{healthScore}%</p>
            <p className={`text-xs font-500 ${healthColor}`}>{healthLabel}</p>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          <div className="h-5 bg-muted animate-pulse rounded-full" />
          <div className="grid grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </div>
      ) : (
        <>
          {/* Stacked progress bar */}
          <div className="flex rounded-full overflow-hidden h-4 mb-4 gap-0.5">
            {segments.map((seg) => {
              const pct = total > 0 ? (seg.count / total) * 100 : 0;
              if (pct === 0) return null;
              return (
                <div
                  key={seg.label}
                  className="h-full transition-all duration-500 first:rounded-l-full last:rounded-r-full"
                  style={{ width: `${pct}%`, backgroundColor: seg.color }}
                  title={`${seg.label}: ${seg.count} (${pct.toFixed(1)}%)`}
                />
              );
            })}
            {total === 0 && <div className="h-full w-full bg-muted rounded-full" />}
          </div>

          {/* Segment breakdown */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {segments.map((seg) => {
              const Icon = seg.icon;
              const pct = total > 0 ? ((seg.count / total) * 100).toFixed(1) : '0.0';
              return (
                <div key={seg.label} className={`rounded-lg p-3 ${seg.bgColor}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Icon size={13} className={seg.textColor} />
                    <span className={`text-xs font-500 ${seg.textColor}`}>{seg.label}</span>
                  </div>
                  <p className={`text-xl font-700 font-mono tabular-nums ${seg.textColor}`}>{seg.count}</p>
                  <p className={`text-xs ${seg.textColor} opacity-75`}>{pct}% of total</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
