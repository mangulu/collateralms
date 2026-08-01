'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Loader2, Package, ExternalLink, TrendingUp, AlertCircle, CheckCircle2, Clock, XCircle, Link2, Unlink } from 'lucide-react';

interface LinkedCollateral {
  id: string;
  collateral_id: string;
  description: string;
  collateral_type: string;
  collateral_status: string;
  valuation_amount: number | null;
  obligor_ref_id: string | null;
}

interface Props {
  loanId: string;
  loanNumber: string;
}

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Perfected: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  'Under Review': { color: 'text-blue-700', bg: 'bg-blue-100', icon: Clock },
  Submitted: { color: 'text-indigo-700', bg: 'bg-indigo-100', icon: Clock },
  Draft: { color: 'text-slate-600', bg: 'bg-slate-100', icon: Clock },
  Overdue: { color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
  Released: { color: 'text-gray-600', bg: 'bg-gray-100', icon: XCircle },
  Monitoring: { color: 'text-amber-700', bg: 'bg-amber-100', icon: AlertCircle },
  Rejected: { color: 'text-rose-700', bg: 'bg-rose-100', icon: XCircle },
};

function formatTsh(val: number | null | undefined): string {
  if (val == null || val === 0) return '—';
  if (val >= 1e9) return `TSh ${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `TSh ${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `TSh ${(val / 1e3).toFixed(0)}K`;
  return `TSh ${val.toFixed(0)}`;
}

export default function LinkedCollateralsPanel({ loanId, loanNumber }: Props) {
  const [collaterals, setCollaterals] = useState<LinkedCollateral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const supabase = createClient();
        const { data, error: err } = await supabase
          .from('collateral_records')
          .select('id, collateral_id, description, collateral_type, collateral_status, valuation_amount, obligor_ref_id')
          .eq('loan_id', loanId)
          .order('created_at', { ascending: false });
        if (!cancelled) {
          if (err) setError(err.message);
          else setCollaterals(data ?? []);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message ?? 'Failed to load collaterals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [loanId]);

  const totalValue = collaterals.reduce((s, c) => s + (c.valuation_amount ?? 0), 0);

  return (
    <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-slate-50/60">
        <div className="flex items-center gap-2">
          <Link2 size={14} className="text-primary" />
          <span className="text-sm font-600 text-foreground">Linked Collaterals</span>
          {!loading && (
            <span className="ml-1 text-xs font-600 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary">
              {collaterals.length}
            </span>
          )}
        </div>
        {totalValue > 0 && (
          <span className="text-xs font-600 text-green-700 bg-green-50 px-2 py-0.5 rounded-full border border-green-200">
            Total: {formatTsh(totalValue)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="p-3">
        {loading ? (
          <div className="flex items-center justify-center py-8 gap-2 text-muted-foreground">
            <Loader2 size={15} className="animate-spin" />
            <span className="text-xs">Loading collaterals…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 py-4 text-xs text-red-600">
            <AlertCircle size={13} /> {error}
          </div>
        ) : collaterals.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 gap-2 text-center">
            <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center">
              <Unlink size={15} className="text-muted-foreground" />
            </div>
            <p className="text-xs text-muted-foreground">No collaterals linked to {loanNumber}</p>
            <Link
              href={`/collateral-management`}
              className="text-xs text-primary hover:underline flex items-center gap-1 mt-1"
            >
              <ExternalLink size={11} /> Go to Collateral Registry to link
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {collaterals.map((c) => {
              const sc = statusConfig[c.collateral_status] ?? statusConfig['Draft'];
              const StatusIcon = sc.icon;
              return (
                <div
                  key={c.id}
                  className="flex items-start gap-3 p-2.5 rounded-lg border border-border hover:bg-muted/20 transition-colors group"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary/8 flex items-center justify-center shrink-0 mt-0.5">
                    <Package size={13} className="text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-700 text-foreground font-mono">{c.collateral_id}</span>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-600 ${sc.bg} ${sc.color}`}>
                        <StatusIcon size={9} />
                        {c.collateral_status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description || '—'}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.collateral_type}</span>
                      {c.valuation_amount != null && (
                        <span className="text-[10px] font-600 text-green-700 flex items-center gap-0.5">
                          <TrendingUp size={9} /> {formatTsh(c.valuation_amount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/collateral-detail/${c.id}`}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-primary/10 text-primary"
                    title="View collateral detail"
                  >
                    <ExternalLink size={12} />
                  </Link>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
