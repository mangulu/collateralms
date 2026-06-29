'use client';
import React, { useEffect, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Zap } from 'lucide-react';
import { createClient } from '@/lib/supabase/collateralService';
import { CollateralRecord } from '@/lib/supabase/collateralService';

interface Prediction {
  collateral: CollateralRecord;
  riskScore: number;
  predictedMiss: boolean;
  factors: string[];
  urgency: 'critical' | 'high' | 'medium' | 'low';
}

function computePrediction(c: CollateralRecord): Prediction {
  const factors: string[] = [];
  let score = 0;

  // Days to deadline factor
  if (c.daysToDeadline != null) {
    if (c.daysToDeadline < 0) { score += 40; factors.push(`${Math.abs(c.daysToDeadline)}d overdue`); }
    else if (c.daysToDeadline <= 3) { score += 35; factors.push(`Only ${c.daysToDeadline}d left`); }
    else if (c.daysToDeadline <= 7) { score += 25; factors.push(`${c.daysToDeadline}d to deadline`); }
    else if (c.daysToDeadline <= 14) { score += 15; factors.push(`${c.daysToDeadline}d to deadline`); }
  }

  // Status factor
  if (c.status === 'Overdue') { score += 30; factors.push('Status: Overdue'); }
  else if (c.status === 'Draft') { score += 20; factors.push('Still in Draft'); }
  else if (c.status === 'Submitted') { score += 10; factors.push('Awaiting review'); }

  // LTV factor
  if (c.ltvRatio != null && c.ltvRatio >= 0.8) { score += 15; factors.push(`High LTV ${(c.ltvRatio * 100).toFixed(0)}%`); }

  // Requires perfection but not perfected
  if (c.requiresPerfection && c.status !== 'Perfected') { score += 10; factors.push('Perfection required'); }

  const capped = Math.min(score, 100);
  const urgency: Prediction['urgency'] = capped >= 75 ? 'critical' : capped >= 50 ? 'high' : capped >= 25 ? 'medium' : 'low';

  return {
    collateral: c,
    riskScore: capped,
    predictedMiss: capped >= 50,
    factors,
    urgency,
  };
}

const URGENCY_STYLES = {
  critical: { bg: 'bg-red-50 border-red-200', badge: 'bg-red-100 text-red-700', bar: 'bg-red-500', label: 'Critical' },
  high: { bg: 'bg-orange-50 border-orange-200', badge: 'bg-orange-100 text-orange-700', bar: 'bg-orange-500', label: 'High Risk' },
  medium: { bg: 'bg-amber-50 border-amber-200', badge: 'bg-amber-100 text-amber-700', bar: 'bg-amber-400', label: 'Medium' },
  low: { bg: 'bg-green-50 border-green-200', badge: 'bg-green-100 text-green-700', bar: 'bg-green-500', label: 'Low Risk' },
};

export default function DeadlinePredictionsPanel() {
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'critical' | 'high'>('all');

  const load = async () => {
    setLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from('collateral_records')
      .select('*')
      .not('status', 'eq', 'Perfected')
      .not('status', 'eq', 'Released')
      .order('days_to_deadline', { ascending: true })
      .limit(50);

    const records: CollateralRecord[] = (data ?? []).map((r: any) => ({
      id: r.id,
      collateralId: r.collateral_id,
      obligor: r.obligor,
      obligorId: r.obligor_id,
      type: r.collateral_type,
      description: r.description,
      valueTSh: r.value_tsh,
      facilityId: r.facility_id,
      status: r.status,
      registry: r.registry,
      registrationDate: r.registration_date,
      perfectionDeadline: r.perfection_deadline,
      assignedOfficer: r.assigned_officer,
      requiresPerfection: r.requires_perfection,
      daysToDeadline: r.days_to_deadline,
      ltvRatio: r.ltv_ratio,
      availableEquity: r.available_equity,
    }));

    const preds = records.map(computePrediction).sort((a, b) => b.riskScore - a.riskScore);
    setPredictions(preds);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = predictions.filter((p) => {
    if (filter === 'critical') return p.urgency === 'critical';
    if (filter === 'high') return p.urgency === 'critical' || p.urgency === 'high';
    return true;
  });

  const criticalCount = predictions.filter((p) => p.urgency === 'critical').length;
  const highCount = predictions.filter((p) => p.urgency === 'high').length;

  return (
    <div className="p-4 sm:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Zap size={18} className="text-primary" />
            <h2 className="text-lg font-bold text-foreground">Smart Deadline Predictions</h2>
          </div>
          <p className="text-sm text-muted-foreground">AI-scored risk assessment for collateral likely to miss perfection deadlines</p>
        </div>
        <button onClick={load} disabled={loading} className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors disabled:opacity-60 self-start sm:self-auto">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-red-700 font-mono">{criticalCount}</p>
          <p className="text-xs text-red-600 font-medium">Critical</p>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-orange-700 font-mono">{highCount}</p>
          <p className="text-xs text-orange-600 font-medium">High Risk</p>
        </div>
        <div className="bg-muted/30 border border-border rounded-lg p-3 text-center">
          <p className="text-2xl font-bold text-foreground font-mono">{predictions.length}</p>
          <p className="text-xs text-muted-foreground font-medium">Total Monitored</p>
        </div>
      </div>

      {/* Filter */}
      <div className="flex gap-2">
        {(['all', 'high', 'critical'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${filter === f ? 'bg-primary text-white' : 'bg-white border border-border text-muted-foreground hover:bg-muted'}`}>
            {f === 'all' ? 'All' : f === 'high' ? 'High+' : 'Critical Only'}
          </button>
        ))}
      </div>

      {/* Predictions List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted/30 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <CheckCircle2 size={32} className="text-green-500 mx-auto mb-3" />
          <p className="text-sm font-medium text-foreground">No at-risk collateral found</p>
          <p className="text-xs text-muted-foreground mt-1">All monitored items are on track</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => {
            const s = URGENCY_STYLES[p.urgency];
            return (
              <div key={p.collateral.id} className={`border rounded-xl p-4 ${s.bg}`}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground">{p.collateral.collateralId}</p>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${s.badge}`}>{s.label}</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">{p.collateral.obligor} · {p.collateral.type} · {p.collateral.registry}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold font-mono text-foreground">{p.riskScore}</p>
                    <p className="text-[10px] text-muted-foreground">Risk Score</p>
                  </div>
                </div>
                {/* Score Bar */}
                <div className="h-1.5 bg-white/60 rounded-full overflow-hidden mb-2">
                  <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${p.riskScore}%` }} />
                </div>
                {/* Factors */}
                <div className="flex flex-wrap gap-1.5">
                  {p.factors.map((f, i) => (
                    <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-white/70 border border-white/50 rounded-full text-[10px] text-foreground">
                      <AlertTriangle size={9} className="text-amber-500" />
                      {f}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
