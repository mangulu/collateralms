'use client';
import React from 'react';
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

// Backend integration point: GET /api/dashboard/perfection-trend?period=6m
const trendData = [
  { month: 'Nov 25', perfected: 189, submitted: 34, overdue: 12 },
  { month: 'Dec 25', perfected: 198, submitted: 28, overdue: 9 },
  { month: 'Jan 26', perfected: 210, submitted: 41, overdue: 14 },
  { month: 'Feb 26', perfected: 221, submitted: 37, overdue: 8 },
  { month: 'Mar 26', perfected: 235, submitted: 29, overdue: 6 },
  { month: 'Apr 26', perfected: 244, submitted: 45, overdue: 5 },
];

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
  return (
    <div className="bg-white rounded-xl shadow-card border border-border p-5">
      <div className="flex items-center justify-between mb-1">
        <div>
          <h3 className="text-base font-600 text-foreground">Perfection Status Trend</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Monthly breakdown of perfected, submitted, and overdue collateral — Nov 2025 to Apr 2026
          </p>
        </div>
        <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
          6-month view
        </span>
      </div>
      <div className="mt-4">
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
      </div>
    </div>
  );
}