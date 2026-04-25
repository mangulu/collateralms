'use client';
import React, { useState } from 'react';
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

// Backend integration point: GET /api/dashboard/collateral-by-type
const typeData = [
  { type: 'Mortgage', count: 98, value: 312 },
  { type: 'Debenture', count: 74, value: 218 },
  { type: 'Motor Vehicle', count: 52, value: 43 },
  { type: 'Shares (DSE)', count: 34, value: 89 },
  { type: 'FDR', count: 28, value: 67 },
  { type: 'Guarantee', count: 18, value: 94 },
  { type: 'Ship/Vessel', count: 8, value: 24 },
];

const colors = [
  '#0B3D6B', '#1A5A9A', '#00A86B', '#007A4D',
  '#D97706', '#DC2626', '#7C3AED',
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg shadow-dropdown p-3 text-xs">
      <p className="font-600 text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-4">
          <span className="text-muted-foreground">Count:</span>
          <span className="font-600 font-mono">{payload[0]?.value}</span>
        </div>
      </div>
    </div>
  );
};

export default function CollateralTypeChart() {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  return (
    <div className="bg-white rounded-xl shadow-card border border-border p-5 h-full">
      <div className="mb-4">
        <h3 className="text-base font-600 text-foreground">Collateral by Type</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Count of active collateral items per security type
        </p>
      </div>
      <ResponsiveContainer width="100%" height={280}>
        <BarChart
          data={typeData}
          layout="vertical"
          margin={{ top: 0, right: 8, bottom: 0, left: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" horizontal={false} />
          <XAxis
            type="number"
            tick={{ fontSize: 11, fill: '#6B7280', fontFamily: 'DM Sans' }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            type="category"
            dataKey="type"
            tick={{ fontSize: 11, fill: '#374151', fontFamily: 'DM Sans' }}
            axisLine={false}
            tickLine={false}
            width={58}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {typeData.map((_, index) => (
              <Cell
                key={`cell-type-${index}`}
                fill={colors[index % colors.length]}
                opacity={activeIndex === null || activeIndex === index ? 1 : 0.5}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}