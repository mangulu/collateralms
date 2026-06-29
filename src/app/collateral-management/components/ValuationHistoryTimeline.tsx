'use client';
import React, { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Plus, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ValuationPoint {
  id: string;
  valuationDate: string;
  valuationAmount: number;
  ltvRatio: number | null;
  maxSecurableAmount: number | null;
  availableEquity: number | null;
  valuationNote: string | null;
}

interface Props {
  collateralRecordId: string;
  collateralId: string;
  currentValue?: number | null;
}

function fmtTSh(n: number | null | undefined) {
  if (n == null) return '—';
  if (n >= 1_000_000_000) return `TSh ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `TSh ${(n / 1_000_000).toFixed(1)}M`;
  return `TSh ${n.toLocaleString()}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function ValuationHistoryTimeline({ collateralRecordId, collateralId, currentValue }: Props) {
  const [history, setHistory] = useState<ValuationPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newVal, setNewVal] = useState({ amount: '', ltv: '', note: '', date: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('collateral_valuation_history')
      .select('*')
      .eq('collateral_record_id', collateralRecordId)
      .order('valuation_date', { ascending: true });

    setHistory((data ?? []).map((r: any) => ({
      id: r.id,
      valuationDate: r.valuation_date,
      valuationAmount: r.valuation_amount,
      ltvRatio: r.ltv_ratio,
      maxSecurableAmount: r.max_securable_amount,
      availableEquity: r.available_equity,
      valuationNote: r.valuation_note,
    })));
    setLoading(false);
  };

  useEffect(() => { load(); }, [collateralRecordId]);

  const handleAdd = async () => {
    if (!newVal.amount || isNaN(Number(newVal.amount))) return;
    setSaving(true);
    const supabase = createClient();
    const amount = Number(newVal.amount);
    const ltv = newVal.ltv ? Number(newVal.ltv) / 100 : null;
    await supabase.from('collateral_valuation_history').insert({
      collateral_record_id: collateralRecordId,
      collateral_id: collateralId,
      valuation_amount: amount,
      ltv_ratio: ltv,
      max_securable_amount: ltv ? amount * ltv : null,
      available_equity: ltv ? amount * (1 - ltv) : null,
      valuation_date: newVal.date,
      valuation_note: newVal.note || null,
    });
    setNewVal({ amount: '', ltv: '', note: '', date: new Date().toISOString().split('T')[0] });
    setShowAddForm(false);
    setSaving(false);
    load();
  };

  const chartData = history.map((h) => ({
    date: fmtDate(h.valuationDate),
    value: h.valuationAmount / 1_000_000,
    ltv: h.ltvRatio != null ? Math.round(h.ltvRatio * 100) : null,
    equity: h.availableEquity != null ? h.availableEquity / 1_000_000 : null,
  }));

  const latest = history[history.length - 1];
  const prev = history[history.length - 2];
  const change = latest && prev ? ((latest.valuationAmount - prev.valuationAmount) / prev.valuationAmount) * 100 : null;

  if (loading) {
    return <div className="animate-pulse h-48 bg-muted/30 rounded-xl" />;
  }

  return (
    <div className="space-y-4">
      {/* Summary Row */}
      {latest && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Latest Valuation</p>
            <p className="text-sm font-bold text-foreground font-mono">{fmtTSh(latest.valuationAmount)}</p>
            {change != null && (
              <p className={`text-[10px] flex items-center gap-0.5 mt-0.5 ${change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {change >= 0 ? <TrendingUp size={10} /> : <TrendingDown size={10} />}
                {Math.abs(change).toFixed(1)}% vs prior
              </p>
            )}
          </div>
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">LTV Ratio</p>
            <p className={`text-sm font-bold font-mono ${latest.ltvRatio != null && latest.ltvRatio >= 0.8 ? 'text-red-600' : latest.ltvRatio != null && latest.ltvRatio >= 0.65 ? 'text-amber-600' : 'text-green-600'}`}>
              {latest.ltvRatio != null ? `${(latest.ltvRatio * 100).toFixed(1)}%` : '—'}
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Loan-to-value</p>
          </div>
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Available Equity</p>
            <p className="text-sm font-bold text-foreground font-mono">{fmtTSh(latest.availableEquity)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Unencumbered value</p>
          </div>
          <div className="bg-muted/30 border border-border rounded-lg p-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">Valuations</p>
            <p className="text-sm font-bold text-foreground font-mono">{history.length}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">Historical records</p>
          </div>
        </div>
      )}

      {/* Chart */}
      {chartData.length > 1 && (
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Value Over Time (TSh M)</p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="valGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v: any) => [`TSh ${Number(v).toFixed(1)}M`, 'Value']} />
              <Area type="monotone" dataKey="value" stroke="#2563eb" fill="url(#valGrad)" strokeWidth={2} dot={{ r: 4, fill: '#2563eb' }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Timeline */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Valuation History</p>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <Plus size={12} /> Add Valuation
          </button>
        </div>

        {showAddForm && (
          <div className="bg-muted/20 border border-border rounded-lg p-3 space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Amount (TSh)</label>
                <input type="number" value={newVal.amount} onChange={(e) => setNewVal({ ...newVal, amount: e.target.value })}
                  placeholder="e.g. 500000000" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">LTV % (optional)</label>
                <input type="number" value={newVal.ltv} onChange={(e) => setNewVal({ ...newVal, ltv: e.target.value })}
                  placeholder="e.g. 65" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Date</label>
                <input type="date" value={newVal.date} onChange={(e) => setNewVal({ ...newVal, date: e.target.value })}
                  className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
              <div>
                <label className="text-[10px] font-medium text-muted-foreground uppercase">Note</label>
                <input type="text" value={newVal.note} onChange={(e) => setNewVal({ ...newVal, note: e.target.value })}
                  placeholder="e.g. Annual revaluation" className="w-full mt-0.5 px-2 py-1.5 text-xs border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary/30" />
              </div>
            </div>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setShowAddForm(false)} className="px-3 py-1.5 text-xs border border-border rounded-md hover:bg-muted">Cancel</button>
              <button onClick={handleAdd} disabled={saving} className="px-3 py-1.5 text-xs bg-primary text-white rounded-md hover:bg-primary/90 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        )}

        {history.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">No valuation history recorded yet.</div>
        ) : (
          <div className="relative pl-4">
            <div className="absolute left-1.5 top-0 bottom-0 w-px bg-border" />
            {[...history].reverse().map((h, i) => (
              <div key={h.id} className="relative mb-3 pl-4">
                <div className="absolute -left-[3px] top-1.5 w-2.5 h-2.5 rounded-full border-2 border-primary bg-white" />
                <div className="bg-white border border-border rounded-lg p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-foreground font-mono">{fmtTSh(h.valuationAmount)}</p>
                      {h.valuationNote && <p className="text-[10px] text-muted-foreground mt-0.5">{h.valuationNote}</p>}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                        <Calendar size={9} /> {fmtDate(h.valuationDate)}
                      </p>
                      {h.ltvRatio != null && (
                        <p className={`text-[10px] font-medium mt-0.5 ${h.ltvRatio >= 0.8 ? 'text-red-600' : h.ltvRatio >= 0.65 ? 'text-amber-600' : 'text-green-600'}`}>
                          LTV {(h.ltvRatio * 100).toFixed(1)}%
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
