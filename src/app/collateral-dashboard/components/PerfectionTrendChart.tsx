'use client';
import React, { useEffect, useState } from 'react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { dashboardService } from '@/lib/supabase/collateralService';
import { AlertCircle } from 'lucide-react';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';

interface TrendPoint {
  month: string;
  perfected: number;
  submitted: number;
  overdue: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-xl shadow-dropdown p-3 text-xs"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)'
      }}
    >
      <p className="font-bold mb-2" style={{ color: 'var(--izou-text)' }}>{label}</p>
      {payload.map((p: any) => (
        <div key={`tt-${p.dataKey}`} className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span style={{ color: 'var(--izou-muted)' }} className="capitalize">{p.name}:</span>
          <span className="font-bold font-mono" style={{ color: 'var(--izou-text)' }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PerfectionTrendChart() {
  const [trendData, setTrendData] = useState<TrendPoint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    dashboardService.getPerfectionTrend()
      .then((data) => {
        setTrendData(data);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load trend data.');
        setIsLoading(false);
      });
  }, []);

  // Real-time: refresh trend chart whenever collateral records change
  useCollateralRealtime({
    onCollateralChange: () => {
      dashboardService.getPerfectionTrend().then((data) => setTrendData(data)).catch(() => {});
    },
  });

  // Derive the date range label dynamically
  const rangeLabel =
    trendData.length >= 2
      ? `${trendData[0].month} – ${trendData[trendData.length - 1].month}`
      : '6-month view';

  return (
    <div
      className="rounded-2xl p-5"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>Perfection Status Trend</h3>
          <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>
            Monthly breakdown of perfected, submitted, and overdue collateral
          </p>
        </div>
        <span
          className="text-xs px-2.5 py-1 rounded-full font-semibold"
          style={{ backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-primary-dark)' }}
        >
          {rangeLabel}
        </span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="h-[280px] animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(0,169,224,0.08)' }} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[280px] gap-2 text-center">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm font-semibold text-red-600">Could not load trend chart</p>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{error}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="gradPerfected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A9E0" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#00A9E0" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradOverdue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#dc2626" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#dc2626" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--izou-border)" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#667085', fontFamily: 'Plus Jakarta Sans' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#667085', fontFamily: 'Plus Jakarta Sans' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px', fontFamily: 'Plus Jakarta Sans' }}
              />
              <Area
                type="monotone"
                dataKey="perfected"
                name="Perfected"
                stroke="#16a34a"
                strokeWidth={2}
                fill="url(#gradPerfected)"
              />
              <Area
                type="monotone"
                dataKey="submitted"
                name="Submitted"
                stroke="#00A9E0"
                strokeWidth={2}
                fill="url(#gradSubmitted)"
              />
              <Area
                type="monotone"
                dataKey="overdue"
                name="Overdue"
                stroke="#dc2626"
                strokeWidth={2}
                fill="url(#gradOverdue)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}