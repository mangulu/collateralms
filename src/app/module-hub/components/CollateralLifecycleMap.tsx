'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { dashboardService } from '@/lib/supabase/collateralService';
import type { ModuleCard } from '../page';
import {
  FilePlus,
  Scale,
  ShieldCheck,
  Activity,
  Unlock,
  Archive,
  ChevronRight,
  Link2,
} from 'lucide-react';

// ─── Lifecycle stage definitions ──────────────────────────────────────────────

interface LifecycleStage {
  step: string;
  title: string;
  description: string;
  href: string;
  icon: React.ElementType;
  ariaLabel: string;
  countKey: 'origination' | 'pendingValuation' | 'overdue' | 'atRisk' | 'releaseReady' | 'archived';
  countLabel: string;
}

const STAGES: LifecycleStage[] = [
  {
    step: '01',
    title: 'Origination',
    description: 'Register collateral & attach documents',
    href: '/collateral-management',
    icon: FilePlus,
    ariaLabel: 'Go to Collateral Registry',
    countKey: 'origination',
    countLabel: 'draft',
  },
  {
    step: '02',
    title: 'Valuation',
    description: 'Independent valuation & pricing checks',
    href: '/valuation-workflow',
    icon: Scale,
    ariaLabel: 'Go to Valuation Workflow',
    countKey: 'pendingValuation',
    countLabel: 'awaiting valuation',
  },
  {
    step: '03',
    title: 'Perfection',
    description: 'Legal registration — BRELA, Lands, TRA, DSE, TASAC',
    href: '/perfection-workflow',
    icon: ShieldCheck,
    ariaLabel: 'Go to Perfection Workflow',
    countKey: 'overdue',
    countLabel: 'overdue',
  },
  {
    step: '04',
    title: 'Monitoring',
    description: 'LTV, covenants, insurance & portfolio health',
    href: '/portfolio-monitoring',
    icon: Activity,
    ariaLabel: 'Go to Portfolio Monitoring',
    countKey: 'atRisk',
    countLabel: 'at risk (LTV > 75%)',
  },
  {
    step: '05',
    title: 'Release & Settlement',
    description: 'Discharge on repayment, batch release',
    href: '/batch-release',
    icon: Unlock,
    ariaLabel: 'Go to Bulk Release',
    countKey: 'releaseReady',
    countLabel: 'ready to release',
  },
  {
    step: '06',
    title: 'Archive',
    description: 'Vault custody & retention after release',
    href: '/archive/vault-management',
    icon: Archive,
    ariaLabel: 'Go to Vault Management',
    countKey: 'archived',
    countLabel: 'stored',
  },
];

type StageCounts = Record<LifecycleStage['countKey'], number>;

interface Props {
  /** Already permission-filtered modules from the parent page; supporting tools are whichever of these aren't already a lifecycle stage above (Collaterals, Archive). */
  visibleModules: ModuleCard[];
  searchQuery?: string;
  onShowRelationshipMap?: () => void;
}

function matchesSearch(query: string, ...fields: string[]): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase();
  return fields.some((f) => f.toLowerCase().includes(q));
}

export default function CollateralLifecycleMap({ visibleModules, searchQuery = '', onShowRelationshipMap }: Props) {
  const [counts, setCounts] = useState<StageCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardService.getLifecycleStageCounts().then((data) => {
      if (data) setCounts(data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Collaterals and Archive already have a dedicated stage on the spine above;
  // everything else permission-filtered stays as a supporting tool.
  const supportingTools = visibleModules.filter((m) => m.id !== 'collaterals' && m.id !== 'archive');

  const noStageMatches = searchQuery.trim() !== '' && !STAGES.some((s) => matchesSearch(searchQuery, s.title, s.description));
  const noToolMatches = searchQuery.trim() !== '' && !supportingTools.some((m) => matchesSearch(searchQuery, m.title, m.description));

  return (
    <div className="flex flex-col gap-6">

      {/* Lifecycle spine */}
      {!noStageMatches && (
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{ backgroundColor: 'var(--izou-card)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(13,28,46,0.06)' }}
        >
          <div className="flex items-center justify-between mb-6 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: 'var(--izou-primary)', display: 'inline-block' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--izou-primary)' }}>The Collateral Lifecycle</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>6 stages, registration through release</span>
              {onShowRelationshipMap && (
                <button
                  onClick={onShowRelationshipMap}
                  className="flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg transition-colors"
                  style={{ color: 'var(--izou-secondary)', backgroundColor: 'var(--izou-secondary-light)' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-border)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-secondary-light)'; }}
                >
                  <Link2 size={12} />
                  How it connects
                </button>
              )}
            </div>
          </div>

          <div className="flex items-start overflow-x-auto pb-1">
            {STAGES.map((stage, i) => {
              const StageIcon = stage.icon;
              const count = counts?.[stage.countKey] ?? 0;
              const dim = searchQuery.trim() !== '' && !matchesSearch(searchQuery, stage.title, stage.description);
              return (
                <React.Fragment key={stage.href}>
                  <Link
                    href={stage.href}
                    aria-label={stage.ariaLabel}
                    className="group flex flex-col items-center text-center gap-2.5 shrink-0"
                    style={{ flex: '1 1 0', minWidth: 140, opacity: dim ? 0.35 : 1, transition: 'opacity 0.15s ease' }}
                  >
                    <span className="text-[11px] font-bold font-mono" style={{ color: 'var(--izou-muted)', opacity: 0.7 }}>{stage.step}</span>
                    <div
                      className="w-16 h-16 rounded-full flex items-center justify-center transition-all duration-150 group-hover:-translate-y-0.5"
                      style={{
                        backgroundColor: 'var(--izou-primary)',
                        border: '1px solid var(--izou-primary-dark)',
                        boxShadow: '0 4px 10px var(--izou-primary-tint)',
                      }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 10px 22px var(--izou-primary-shadow)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--izou-primary-dark)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-dark)'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 10px var(--izou-primary-tint)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--izou-primary-dark)'; (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary)'; }}
                    >
                      <StageIcon size={26} style={{ color: '#ffffff' }} strokeWidth={1.8} />
                    </div>
                    <span className="text-sm font-bold" style={{ color: 'var(--izou-text)' }}>{stage.title}</span>
                    <span className="text-xs leading-snug" style={{ color: 'var(--izou-muted)' }}>{stage.description}</span>
                    <span
                      className="text-[11px] font-semibold font-mono px-2.5 py-0.5 rounded-full"
                      style={{ color: 'var(--izou-primary-dark)', backgroundColor: 'var(--izou-primary-light)', border: '1px solid var(--izou-primary-tint)' }}
                    >
                      {loading ? '···' : `${count} ${stage.countLabel}`}
                    </span>
                  </Link>

                  {i < STAGES.length - 1 && (
                    <div className="relative shrink-0" style={{ flex: '0 0 32px', height: 3, marginTop: 44, backgroundColor: 'var(--izou-secondary)', borderRadius: 2 }}>
                      <ChevronRight size={20} strokeWidth={3.2} style={{ position: 'absolute', top: -9, right: -4, color: 'var(--izou-secondary)' }} />
                    </div>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Supporting tools */}
      {!noToolMatches && supportingTools.length > 0 && (
        <div
          className="rounded-2xl p-6 sm:p-8"
          style={{ backgroundColor: 'var(--izou-card)', border: '1px solid rgba(0,0,0,0.06)', boxShadow: '0 1px 4px rgba(13,28,46,0.06)' }}
        >
          <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
            <div className="flex items-center gap-2.5">
              <span style={{ width: 20, height: 3, borderRadius: 2, backgroundColor: 'var(--izou-muted)', display: 'inline-block' }} />
              <span className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--izou-muted)' }}>Supporting Tools</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--izou-muted)' }}>Cross-cutting — not tied to one lifecycle stage</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3.5">
            {supportingTools.map((mod) => {
              const ModIcon = mod.icon;
              const dim = searchQuery.trim() !== '' && !matchesSearch(searchQuery, mod.title, mod.description);
              return (
                <Link
                  key={mod.id}
                  href={mod.href}
                  className="group flex items-center gap-3 p-4 rounded-xl transition-all"
                  style={{ backgroundColor: 'var(--izou-bg)', border: '1px solid var(--izou-border)', opacity: dim ? 0.35 : 1 }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-card)'; (e.currentTarget as HTMLElement).style.borderColor = mod.iconBg; (e.currentTarget as HTMLElement).style.boxShadow = '0 6px 16px rgba(13,28,46,0.08)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-bg)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--izou-border)'; (e.currentTarget as HTMLElement).style.boxShadow = 'none'; }}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `color-mix(in srgb, ${mod.iconBg} 15%, white)`, border: `1px solid color-mix(in srgb, ${mod.iconBg} 30%, white)` }}
                  >
                    <ModIcon size={18} style={{ color: mod.iconBg }} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--izou-text)' }}>{mod.title}</p>
                    <p className="text-xs truncate" style={{ color: 'var(--izou-muted)' }}>{mod.description}</p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 opacity-40 group-hover:opacity-100 group-hover:translate-x-0.5 transition-all" style={{ color: 'var(--izou-muted)' }} />
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {noStageMatches && noToolMatches && (
        <div className="text-center py-16 text-sm" style={{ color: 'var(--izou-muted)' }}>
          No stages or tools match "{searchQuery}"
        </div>
      )}
    </div>
  );
}
