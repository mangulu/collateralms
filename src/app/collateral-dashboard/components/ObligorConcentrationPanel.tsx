'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { dashboardService } from '@/lib/supabase/collateralService';
import { useDashboardRefresh } from '../DashboardRefreshContext';
import { Users, ChevronRight } from 'lucide-react';

function formatTZS(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(0)}M`;
  return n.toLocaleString();
}

const BAR_COLORS = ['var(--izou-secondary)', 'var(--izou-highlight)', 'var(--izou-success)', 'var(--izou-warning)', 'var(--izou-primary)'];

export default function ObligorConcentrationPanel() {
  const { refreshKey } = useDashboardRefresh();
  const [data, setData] = useState<{
    obligors: { name: string; value: number; pct: number }[];
    portfolioTotal: number;
    top5ConcentrationPct: number;
    obligorCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    dashboardService.getObligorConcentration(5).then((result) => {
      setData(result);
      setIsLoading(false);
    }).catch(() => {
      setIsLoading(false);
    });
  }, [refreshKey]);

  const obligors = data?.obligors ?? [];
  const maxValue = obligors.length > 0 ? obligors[0].value : 0;
  const concentrationPct = data?.top5ConcentrationPct ?? 0;
  const concentrationLabel =
    concentrationPct >= 60 ? 'High concentration' :
    concentrationPct >= 35 ? 'Moderate concentration' :
    'Well diversified';
  const concentrationColor = concentrationPct >= 60 ? 'var(--izou-danger)' : concentrationPct >= 35 ? 'var(--izou-warning)' : 'var(--izou-success)';

  return (
    <div
      className="rounded-2xl h-full"
      style={{
        backgroundColor: 'var(--izou-card)',
        border: '1px solid var(--izou-border)',
        boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
      }}
    >
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--izou-border)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-primary-light)' }}>
            <Users size={16} style={{ color: 'var(--izou-primary)' }} />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold truncate" style={{ color: 'var(--izou-text)' }}>Obligor Concentration</h3>
            <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>Top obligors by pledged collateral value</p>
          </div>
        </div>
        <Link
          href="/obligors"
          className="flex items-center gap-1 text-xs font-semibold hover:underline shrink-0 ml-2"
          style={{ color: 'var(--izou-primary)' }}
        >
          View all <ChevronRight size={12} />
        </Link>
      </div>

      {isLoading ? (
        <div className="p-4 space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-9 animate-pulse rounded-lg" style={{ backgroundColor: 'var(--izou-skeleton)' }} />
          ))}
        </div>
      ) : obligors.length === 0 ? (
        <div className="px-5 py-8 text-center text-sm" style={{ color: 'var(--izou-muted)' }}>
          No obligor data available
        </div>
      ) : (
        <div className="p-4 space-y-4">
          {/* Concentration summary */}
          <div className="flex items-center justify-between px-3 py-2.5 rounded-xl" style={{ backgroundColor: 'var(--izou-secondary-light)' }}>
            <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>Top 5 hold</span>
            <span className="text-sm font-bold font-mono" style={{ color: concentrationColor }}>
              {concentrationPct.toFixed(1)}% · {concentrationLabel}
            </span>
          </div>

          {/* Obligor bars */}
          <div className="space-y-2.5">
            {obligors.map((o, i) => (
              <div key={`${o.name}-${i}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold truncate pr-2" style={{ color: 'var(--izou-text)' }}>{o.name}</span>
                  <span className="text-xs font-mono shrink-0" style={{ color: 'var(--izou-muted)' }}>TSh {formatTZS(o.value)} · {o.pct.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--izou-border)' }}>
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${maxValue > 0 ? (o.value / maxValue) * 100 : 0}%`,
                      backgroundColor: BAR_COLORS[i % BAR_COLORS.length],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
