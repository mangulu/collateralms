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

interface TrendPoint {
  month: string;
  perfected: number;
  submitted: number;
  overdue: number;
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-dropdown p-3 text-xs">
      <p className="font-600 text-foreground mb-2">{label}</p>
      {payload.map((p: any) => (
        <div key={`tt-${p.dataKey}`} className="flex items-center gap-2 mb-1">
          <span
            className="w-2.5 h-2.5 rounded-sm shrink-0"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground capitalize">{p.name}:</span>
          <span className="font-600 text-foreground font-mono">{p.value}</span>
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

  // Derive the date range label dynamically
  const rangeLabel =
    trendData.length >= 2
      ? `${trendData[0].month} – ${trendData[trendData.length - 1].month}`
      : '6-month view';

  return (
    <div className="bg-white rounded-xl shadow-card border border-border p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-base font-600 text-foreground">Perfection Status Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monthly breakdown of perfected, submitted, and overdue collateral
          </p>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          {rangeLabel}
        </span>
      </div>

      <div className="mt-4">
        {isLoading ? (
          <div className="h-[280px] bg-muted animate-pulse rounded-lg" />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[280px] gap-2 text-center">
            <AlertCircle size={24} className="text-red-400" />
            <p className="text-sm font-500 text-red-600">Could not load trend chart</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={trendData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
              <defs>
                <linearGradient id="gradPerfected" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00A86B" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#00A86B" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0B3D6B" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#0B3D6B" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id="gradOverdue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#DC2626" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#DC2626" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" vertical={false} />
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'DM Sans' }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'DM Sans' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: '11px', paddingTop: '12px', fontFamily: 'DM Sans' }}
              />
              <Area
                type="monotone"
                dataKey="perfected"
                name="Perfected"
                stroke="#00A86B"
                strokeWidth={2}
                fill="url(#gradPerfected)"
              />
              <Area
                type="monotone"
                dataKey="submitted"
                name="Submitted"
                stroke="#0B3D6B"
                strokeWidth={2}
                fill="url(#gradSubmitted)"
              />
              <Area
                type="monotone"
                dataKey="overdue"
                name="Overdue"
                stroke="#DC2626"
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