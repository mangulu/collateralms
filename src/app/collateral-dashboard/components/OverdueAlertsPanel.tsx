'use client';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, Clock, ChevronRight, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { dashboardService, CollateralRecord } from '@/lib/supabase/collateralService';
import { useCollateralRealtime } from '@/lib/hooks/useCollateralRealtime';

const registryBadgeColors: Record<string, string> = {
  BRELA: 'bg-blue-100 text-blue-700',
  'Lands Registry': 'bg-teal-100 text-teal-700',
  TRA: 'bg-purple-100 text-purple-700',
  DSE: 'bg-orange-100 text-orange-700',
  TASAC: 'bg-pink-100 text-pink-700',
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

  // Real-time: refresh whenever a collateral record changes
  useCollateralRealtime({
    onCollateralChange: () => {
      dashboardService.getOverdueItems().then((data) => setOverdueItems(data)).catch(() => {});
    },
  });

  return (
    <div className="bg-white rounded-xl shadow-card border border-border overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-red-100 flex items-center justify-center">
            <AlertTriangle size={16} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-base font-600 text-foreground">Overdue Perfection Actions</h3>
            <p className="text-xs text-muted-foreground">
              {isLoading ? 'Loading...' : error ? 'Error loading data' : `${overdueItems.length} items past their registry submission deadline`}
            </p>
          </div>
        </div>
        <Link
          href="/collateral-management"
          className="flex items-center gap-1 text-xs text-primary font-500 hover:underline"
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={`skel-${i}`} className="h-10 bg-muted animate-pulse rounded" />
          ))}
        </div>
      ) : error ? (
        <div className="px-5 py-10 flex flex-col items-center gap-2 text-center">
          <AlertCircle size={28} className="text-red-400" />
          <p className="text-sm font-500 text-red-600">Could not load overdue items</p>
          <p className="text-xs text-muted-foreground">{error}</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                  Collateral ID
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                  Obligor
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                  Type
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                  Registry
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                  Days Overdue
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                  Value
                </th>
                <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                  Assigned
                </th>
              </tr>
            </thead>
            <tbody>
              {overdueItems.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-sm text-muted-foreground">
                    No overdue items — great work!
                  </td>
                </tr>
              ) : (
                overdueItems.map((item, i) => (
                  <tr
                    key={`overdue-${item.id}`}
                    className={`border-b border-border last:border-0 hover:bg-red-50/50 transition-colors cursor-pointer ${
                      i % 2 === 0 ? '' : 'bg-muted/20'
                    }`}
                  >
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-primary font-500">{item.collateralId}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-sm font-500 text-foreground">{item.obligor}</p>
                      <p className="text-xs text-muted-foreground font-mono">{item.facilityId}</p>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">{item.type}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-500 ${
                          registryBadgeColors[item.registry] ?? 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {item.registry}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center gap-1 text-xs font-600 text-red-700">
                        <Clock size={11} />
                        {item.daysToDeadline !== null ? `${Math.abs(item.daysToDeadline)}d overdue` : 'Overdue'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-foreground font-500">TSh {item.valueTSh}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{item.assignedOfficer}</td>
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