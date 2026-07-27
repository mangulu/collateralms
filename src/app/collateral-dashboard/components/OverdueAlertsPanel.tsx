'use client';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { dashboardService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';

const registryBadgeStyles: Record<string, React.CSSProperties> = {
  BRELA: { backgroundColor: 'rgba(0,169,224,0.1)', color: '#007CB3' },
  'Lands Registry': { backgroundColor: '#f0fdfa', color: '#0f766e' },
  TRA: { backgroundColor: '#f5f3ff', color: '#7c3aed' },
  DSE: { backgroundColor: '#fff7ed', color: '#c2410c' },
  TASAC: { backgroundColor: '#fdf2f8', color: '#9d174d' },
};

export default function OverdueAlertsPanel() {
  const [overdueItems, setOverdueItems] = useState<CollateralRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOverdue = () => {
    dashboardService.getOverdueItems().then((data) => {
      setOverdueItems(data);
      setIsLoading(false);
    }).catch(() => {
      setError('Failed to load overdue items.');
      setIsLoading(false);
    });
  };

  useEffect(() => {
    loadOverdue();
  }, []);

  useCollateralRealtime({
    onCollateralChange: () => {
      dashboardService.getOverdueItems().then((data) => setOverdueItems(data)).catch(() => {});
    },
  });

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)'
      }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: '1px solid var(--izou-border)' }}
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#fef2f2' }}>
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>Overdue Perfection Actions</h3>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>
              {isLoading ? 'Loading...' : error ? 'Error loading data' : `${overdueItems.length} items past their registry submission deadline`}
            </p>
          </div>
        </div>
        <Link
          href="/collateral-management"
          className="flex items-center gap-1 text-xs font-semibold hover:underline"
          style={{ color: 'var(--izou-primary)' }}
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-10 animate-pulse rounded-xl" style={{ backgroundColor: 'rgba(0,169,224,0.08)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm font-semibold text-red-600">Could not load overdue items</p>
          <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{error}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ backgroundColor: 'var(--izou-primary-light)', borderBottom: '1px solid var(--izou-border)' }}>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--izou-muted)' }}>Collateral ID</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--izou-muted)' }}>Obligor</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--izou-muted)' }}>Type</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--izou-muted)' }}>Registry</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--izou-muted)' }}>Days Overdue</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--izou-muted)' }}>Value</th>
                <th className="text-left px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--izou-muted)' }}>Assigned</th>
              </tr>
            </thead>
            <tbody>
              {overdueItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm" style={{ color: 'var(--izou-muted)' }}>
                    No overdue items — great work!
                  </td>
                </tr>
              ) : (
                overdueItems.map((item, i) => (
                  <tr
                    key={`overdue-${item.id}`}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--izou-border)', backgroundColor: i % 2 !== 0 ? 'rgba(0,169,224,0.03)' : 'transparent' }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fef2f2'; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 !== 0 ? 'rgba(0,169,224,0.03)' : 'transparent'; }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--izou-primary)' }}>{item.collateralId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-semibold" style={{ color: 'var(--izou-text)' }}>{item.obligor}</p>
                      <p className="text-xs font-mono" style={{ color: 'var(--izou-muted)' }}>{item.facilityId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm" style={{ color: 'var(--izou-text)' }}>{item.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                        style={registryBadgeStyles[item.registry] ?? { backgroundColor: '#f3f4f6', color: '#4b5563' }}
                      >
                        {item.registry}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700">
                        <Clock size={11} />
                        {item.daysToDeadline !== null ? `${Math.abs(item.daysToDeadline)}d overdue` : 'Overdue'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--izou-text)' }}>TSh {item.valueTSh}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--izou-muted)' }}>{item.assignedOfficer}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}