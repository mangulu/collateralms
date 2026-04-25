'use client';
import React from 'react';
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
import Icon from '@/components/ui/AppIcon';


// Grid plan: 6 KPI cards → grid-cols-3 on xl, 2 rows
// Row 1: Total Collateral Value (spans 2 cols — hero), Perfection Rate
// Row 2: Overdue Actions (alert), Approaching Deadline (warning), Coverage Ratio, Pending Legal Review

interface KPICardProps {
  label: string;
  value: string;
  subtext: string;
  trend?: { direction: 'up' | 'down' | 'neutral'; label: string };
  icon: React.ElementType;
  variant?: 'default' | 'alert' | 'warning' | 'success';
  colSpan?: string;
}

function KPICard({
  label,
  value,
  subtext,
  trend,
  icon: Icon,
  variant = 'default',
  colSpan = '',
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
    <div
      className={`rounded-xl p-5 shadow-card border ${variantStyles[variant]} ${colSpan}`}
    >
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
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-3 gap-4">
      {/* Row 1 */}
      <KPICard
        label="Total Collateral Value"
        value="TSh 847.3B"
        subtext="Across 312 active collateral items"
        trend={{ direction: 'up', label: '+12.4% this quarter' }}
        icon={Banknote}
        variant="success"
        colSpan="xl:col-span-2"
      />
      <KPICard
        label="Portfolio Perfection Rate"
        value="78.2%"
        subtext="244 of 312 items fully perfected"
        trend={{ direction: 'up', label: '+3.1% vs last month' }}
        icon={Shield}
        variant="default"
      />
      {/* Row 2 */}
      <KPICard
        label="Overdue Perfection Actions"
        value="5"
        subtext="Past BRELA/registry submission deadline"
        trend={{ direction: 'down', label: 'Requires immediate action' }}
        icon={AlertTriangle}
        variant="alert"
      />
      <KPICard
        label="Approaching 42-Day Deadline"
        value="11"
        subtext="BRELA submissions due within 7 days"
        trend={{ direction: 'neutral', label: 'Monitor closely' }}
        icon={Clock}
        variant="warning"
      />
      <KPICard
        label="Collateral Coverage Ratio"
        value="1.84×"
        subtext="TSh 847.3B collateral vs TSh 460.2B exposure"
        trend={{ direction: 'up', label: '+0.07× vs Q1 2026' }}
        icon={Scale}
        variant="default"
      />
      <KPICard
        label="Pending Legal Review"
        value="18"
        subtext="Awaiting Legal Officer approval"
        trend={{ direction: 'neutral', label: '6 submitted today' }}
        icon={FileCheck}
        variant="warning"
        colSpan="xl:col-span-2"
      />
    </div>
  );
}