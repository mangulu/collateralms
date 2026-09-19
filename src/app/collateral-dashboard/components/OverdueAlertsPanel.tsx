'use client';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { dashboardService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';
import { useDashboardRefresh } from '../DashboardRefreshContext';

const registryBadgeStyles: Record<string, React.CSSProperties> = {
  BRELA: { backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-secondary)' },
  'Lands Registry': { backgroundColor: 'var(--izou-success-light)', color: 'var(--izou-success)' },
  TRA: { backgroundColor: 'var(--izou-secondary-light)', color: 'var(--izou-secondary-mid)' },
  DSE: { backgroundColor: 'var(--izou-warning-light)', color: 'var(--izou-warning)' },
  TASAC: { backgroundColor: 'var(--izou-highlight-light)', color: 'var(--izou-highlight)' },
};

export default function OverdueAlertsPanel() {
  const { refreshKey } = useDashboardRefresh();
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
  }, [refreshKey]);

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
        className="flex items-center justify-between px-4 sm:px-5 py-4"
        style={{ borderBottom: '1px solid var(--izou-border)' }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-danger-light)' }}>
            <AlertTriangle size={16} style={{ color: 'var(--izou-danger)' }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--izou-text)' }}>Overdue Perfection Actions</h3>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>
              {isLoading ? 'Loading...' : error ? 'Error loading data' : `${overdueItems.length} items past deadline`}
            </p>
          </div>
        </div>
        <Link
          href="/collateral-management"
          className="flex items-center gap-1 text-xs font-semibold hover:underline shrink-0 ml-2"
          style={{ color: 'var(--izou-primary)' }}
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-4 sm:p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-10 animate-pulse rounded-xl" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
          <AlertCircle size={28} style={{ color: 'var(--izou-danger)' }} />
          <p className="text-sm font-semibold" style={{ color: 'var(--izou-danger)' }}>Could not load overdue items</p>
          <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{error}</p>
        </div>
      ) : overdueItems.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--izou-muted)' }}>
          No overdue items — great work!
        </div>
      ) : (
        <>
          {/* Mobile card layout */}
          <div className="block sm:hidden divide-y" style={{ borderColor: 'var(--izou-border)' }}>
            {overdueItems.map((item) => (
              <div key={`overdue-m-${item.id}`} className="px-4 py-3 space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--izou-secondary)' }}>{item.collateralId}</span>
                  <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--izou-danger)' }}>
                    <Clock size={11} />
                    {item.daysToDeadline !== null ? `${Math.abs(item.daysToDeadline)}d overdue` : 'Overdue'}
                  </span>
                </div>
                <p className="text-sm font-semibold" style={{ color: 'var(--izou-text)' }}>{item.obligor}</p>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>{item.type}</span>
                  <span
                    className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold"
                    style={registryBadgeStyles[item.registry] ?? { backgroundColor: '#f3f4f6', color: '#4b5563' }}
                  >
                    {item.registry}
                  </span>
                  <span className="font-mono text-xs font-semibold" style={{ color: 'var(--izou-text)' }}>TSh {item.valueTSh.toLocaleString()}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: 'var(--izou-secondary-light)', borderBottom: '1px solid var(--izou-border)' }}>
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
                {overdueItems.map((item, i) => (
                  <tr
                    key={`overdue-${item.id}`}
                    className="transition-colors cursor-pointer"
                    style={{ borderBottom: '1px solid var(--izou-border)', backgroundColor: i % 2 !== 0 ? 'var(--izou-hover-tint)' : 'transparent' }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-danger-light)'; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = i % 2 !== 0 ? 'var(--izou-hover-tint)' : 'transparent'; }}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--izou-secondary)' }}>{item.collateralId}</span>
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
                      <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--izou-danger)' }}>
                        <Clock size={11} />
                        {item.daysToDeadline !== null ? `${Math.abs(item.daysToDeadline)}d overdue` : 'Overdue'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold" style={{ color: 'var(--izou-text)' }}>TSh {item.valueTSh.toLocaleString()}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--izou-muted)' }}>{item.assignedOfficer}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}