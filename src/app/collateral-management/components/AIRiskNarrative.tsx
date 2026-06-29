'use client';
import React, { useState, useCallback } from 'react';
import { Sparkles, AlertTriangle, CheckCircle2, RefreshCw, TrendingUp, TrendingDown, Shield } from 'lucide-react';
import { getChatCompletion } from '@/lib/ai/chatCompletion';
import { CollateralRecord } from '@/lib/supabase/collateralService';

interface Props {
  collateral: CollateralRecord;
}

interface RiskNarrative {
  summary: string;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  keyRisks: string[];
  recommendations: string[];
  score: number;
}

const RISK_COLORS = {
  LOW: { bg: 'bg-green-50 border-green-200', text: 'text-green-700', badge: 'bg-green-100 text-green-700', icon: CheckCircle2 },
  MEDIUM: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', badge: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  HIGH: { bg: 'bg-orange-50 border-orange-200', text: 'text-orange-700', badge: 'bg-orange-100 text-orange-700', icon: AlertTriangle },
  CRITICAL: { bg: 'bg-red-50 border-red-200', text: 'text-red-700', badge: 'bg-red-100 text-red-700', icon: Shield },
};

export default function AIRiskNarrative({ collateral }: Props) {
  const [narrative, setNarrative] = useState<RiskNarrative | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const ltvPct = collateral.ltvRatio != null ? (collateral.ltvRatio * 100).toFixed(1) : 'unknown';
      const daysInfo = collateral.daysToDeadline != null
        ? collateral.daysToDeadline < 0
          ? `${Math.abs(collateral.daysToDeadline)} days OVERDUE`
          : `${collateral.daysToDeadline} days remaining`
        : 'no deadline set';

      const prompt = `You are a senior credit risk analyst at EXIM Bank Tanzania. Analyze this collateral record and provide a structured risk narrative.

Collateral Details:
- ID: ${collateral.collateralId}
- Obligor: ${collateral.obligor}
- Type: ${collateral.type}
- Value: TSh ${collateral.valueTSh}
- Status: ${collateral.status}
- Registry: ${collateral.registry}
- LTV Ratio: ${ltvPct}%
- Deadline: ${daysInfo}
- Requires Perfection: ${collateral.requiresPerfection}
- Available Equity: ${collateral.availableEquity != null ? `TSh ${collateral.availableEquity.toLocaleString()}` : 'unknown'}

Respond ONLY with valid JSON in this exact format:
{
  "summary": "2-3 sentence plain English risk summary",
  "riskLevel": "LOW|MEDIUM|HIGH|CRITICAL",
  "keyRisks": ["risk 1", "risk 2", "risk 3"],
  "recommendations": ["action 1", "action 2"],
  "score": 0-100
}`;

      const response = await getChatCompletion('OPEN_AI', 'gpt-4o-mini', [
        { role: 'system', content: 'You are a credit risk analyst. Always respond with valid JSON only, no markdown.' },
        { role: 'user', content: prompt },
      ], { temperature: 0.3, max_tokens: 600 });

      const content = (response as any)?.choices?.[0]?.message?.content ?? '';
      const cleaned = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      const parsed: RiskNarrative = JSON.parse(cleaned);
      setNarrative(parsed);
    } catch (err: any) {
      setError('Failed to generate risk narrative. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [collateral]);

  if (!narrative && !loading && !error) {
    return (
      <div className="border border-dashed border-border rounded-xl p-5 text-center">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-3">
          <Sparkles size={18} className="text-primary" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">AI Risk Narrative</p>
        <p className="text-xs text-muted-foreground mb-4">Generate a plain-English risk assessment powered by OpenAI</p>
        <button
          onClick={generate}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm font-medium rounded-lg hover:bg-primary/90 transition-all"
        >
          <Sparkles size={14} />
          Generate Risk Narrative
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="border border-border rounded-xl p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles size={16} className="text-primary animate-pulse" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Analyzing collateral risk…</p>
            <p className="text-xs text-muted-foreground">OpenAI is processing the risk factors</p>
          </div>
        </div>
        <div className="space-y-2">
          {[80, 60, 70, 50].map((w, i) => (
            <div key={i} className={`h-3 bg-muted animate-pulse rounded`} style={{ width: `${w}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="border border-red-200 bg-red-50 rounded-xl p-4 flex items-start gap-3">
        <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm text-red-700">{error}</p>
          <button onClick={generate} className="mt-2 text-xs text-red-600 hover:underline flex items-center gap-1">
            <RefreshCw size={11} /> Try again
          </button>
        </div>
      </div>
    );
  }

  if (!narrative) return null;

  const riskStyle = RISK_COLORS[narrative.riskLevel];
  const RiskIcon = riskStyle.icon;
  const scoreColor = narrative.score >= 75 ? 'text-red-600' : narrative.score >= 50 ? 'text-amber-600' : 'text-green-600';

  return (
    <div className={`border rounded-xl p-4 ${riskStyle.bg}`}>
      {/* Header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${riskStyle.badge}`}>
            <RiskIcon size={15} />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">AI Risk Assessment</p>
            <p className="text-xs text-muted-foreground">Generated by OpenAI</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${riskStyle.badge}`}>
            {narrative.riskLevel}
          </span>
          <span className={`text-sm font-bold font-mono ${scoreColor}`}>{narrative.score}/100</span>
          <button onClick={generate} title="Regenerate" className="text-muted-foreground hover:text-foreground transition-colors">
            <RefreshCw size={13} />
          </button>
        </div>
      </div>

      {/* Risk Score Bar */}
      <div className="mb-3">
        <div className="h-1.5 bg-white/60 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${narrative.score >= 75 ? 'bg-red-500' : narrative.score >= 50 ? 'bg-amber-500' : 'bg-green-500'}`}
            style={{ width: `${narrative.score}%` }}
          />
        </div>
      </div>

      {/* Summary */}
      <p className={`text-sm leading-relaxed mb-3 ${riskStyle.text}`}>{narrative.summary}</p>

      {/* Key Risks */}
      {narrative.keyRisks.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Key Risk Factors</p>
          <ul className="space-y-1">
            {narrative.keyRisks.map((risk, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                <TrendingDown size={11} className="text-red-500 mt-0.5 shrink-0" />
                {risk}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {narrative.recommendations.length > 0 && (
        <div>
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1.5">Recommendations</p>
          <ul className="space-y-1">
            {narrative.recommendations.map((rec, i) => (
              <li key={i} className="flex items-start gap-1.5 text-xs text-foreground">
                <TrendingUp size={11} className="text-green-500 mt-0.5 shrink-0" />
                {rec}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
