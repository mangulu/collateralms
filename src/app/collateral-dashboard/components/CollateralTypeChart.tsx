'use client';
import React, { useEffect, useState } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import { dashboardService } from '@/lib/supabase/collateralService';
import { AlertCircle } from 'lucide-react';

// IZOU-inspired color palette
const colors = [
  '#00A9E0', '#007CB3', '#00C2A8', '#009E88',
  '#35C8F3', '#1AB8E6', '#7C3AED', '#D97706',
];

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
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span style={{ color: 'var(--izou-muted)' }}>Count:</span>
          <span className="font-bold font-mono" style={{ color: 'var(--izou-text)' }}>{payload[0]?.value}</span>
        </div>
      </div>
    </div>
  );
};

export default function CollateralTypeChart() {
  const [typeData, setTypeData] = useState<{ type: string; count: number }[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  useEffect(() => {
    dashboardService.getTypeDistribution()
      .then((data) => {
        const sorted = [...data].sort((a, b) => b.count - a.count);
        setTypeData(sorted);
        setIsLoading(false);
      })
      .catch(() => {
        setError('Failed to load collateral type data.');
        setIsLoading(false);
      });
  }, []);

  return (
    <div
      className="rounded-2xl p-5 h-full"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div className="mb-4">
        <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>Collateral by Type</h3>
        <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>
          Count of active collateral items per security type
        </p>
      </div>

      {isLoading ? (
        <div className="space-y-2 pt-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-7 animate-pulse rounded-lg" style={{ backgroundColor: 'rgba(0,169,224,0.08)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center h-48 gap-2 text-center">
          <AlertCircle size={24} className="text-red-400" />
          <p className="text-sm font-semibold text-red-600">Could not load chart</p>
          <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{error}</p>
        </div>
      ) : typeData.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-sm" style={{ color: 'var(--izou-muted)' }}>
          No collateral data available
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart
            data={typeData}
            layout="vertical"
            margin={{ top: 0, right: 8, bottom: 0, left: 60 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="var(--izou-border)" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fontSize: 11, fill: '#667085', fontFamily: 'Plus Jakarta Sans' }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              type="category"
              dataKey="type"
              tick={{ fontSize: 11, fill: '#102033', fontFamily: 'Plus Jakarta Sans' }}
              axisLine={false}
              tickLine={false}
              width={58}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar dataKey="count" radius={[0, 6, 6, 0]} maxBarSize={20}>
              {typeData.map((_, index) => (
                <Cell
                  key={`cell-type-${index}`}
                  fill={colors[index % colors.length]}
                  opacity={activeIndex === null || activeIndex === index ? 1 : 0.45}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseLeave={() => setActiveIndex(null)}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}