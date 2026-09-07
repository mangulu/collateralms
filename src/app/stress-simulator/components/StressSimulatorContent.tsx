'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, Legend, ReferenceLine,
} from 'recharts';
import {
  TrendingDown, AlertTriangle, ShieldAlert, CheckCircle2, RefreshCw,
  ChevronDown, ChevronUp, Info, Zap, BarChart2, Activity, Loader2,
} from 'lucide-react';
import { stressSimulatorService, StressPortfolioPosition } from '@/lib/supabase/stressSimulatorService';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioResult {
  decline: 10 | 20 | 30;
  label: string;
  color: string;
  bgColor: string;
  borderColor: string;
  positions: {
    id: string;
    collateralRef: string;
    obligorName: string;
    collateralType: string;
    assetClass: string;
    originalValue: number;
    stressedValue: number;
    loanExposure: number;
    originalLTV: number;
    stressedLTV: number;
    ltvThreshold: number;
    breached: boolean;
    breachMargin: number;
  }[];
  summary: {
    totalOriginalValue: number;
    totalStressedValue: number;
    totalLoanExposure: number;
    breachCount: number;
    breachExposure: number;
    portfolioLTV: number;
    stressedPortfolioLTV: number;
    valueAtRisk: number;
  };
}

// ─── Asset-class specific stress multipliers ──────────────────────────────────

const ASSET_CLASS_MULTIPLIERS: Record<string, Record<number, number>> = {
  'Real Estate':    { 10: 0.10, 20: 0.20, 30: 0.30 },
  'Equities':       { 10: 0.15, 20: 0.28, 30: 0.42 },
  'Motor Vehicle':  { 10: 0.12, 20: 0.22, 30: 0.32 },
  'Fixed Deposit':  { 10: 0.02, 20: 0.04, 30: 0.06 },
  'Debenture':      { 10: 0.08, 20: 0.16, 30: 0.24 },
  'Guarantee':      { 10: 0.05, 20: 0.10, 30: 0.15 },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number): string {
  if (v >= 1e9) return `TZS ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `TZS ${(v / 1e6).toFixed(1)}M`;
  return `TZS ${v.toLocaleString()}`;
}

function fmtPct(v: number): string {
  return `${v.toFixed(1)}%`;
}

function computeScenario(portfolio: StressPortfolioPosition[], decline: 10 | 20 | 30): ScenarioResult {
  const colors = {
    10: { color: '#D97706', bgColor: 'rgba(217,119,6,0.06)', borderColor: '#D97706' },
    20: { color: '#EA580C', bgColor: 'rgba(234,88,12,0.06)', borderColor: '#EA580C' },
    30: { color: '#DC2626', bgColor: 'rgba(220,38,38,0.06)', borderColor: '#DC2626' },
  };

  const positions = portfolio.map(p => {
    const multiplier = ASSET_CLASS_MULTIPLIERS[p.assetClass]?.[decline] ?? decline / 100;
    const stressedValue = p.currentValue * (1 - multiplier);
    const stressedLTV = (p.loanExposure / stressedValue) * 100;
    const breached = stressedLTV > p.ltvThreshold;
    const breachMargin = stressedLTV - p.ltvThreshold;
    return {
      id: p.id,
      collateralRef: p.collateralRef,
      obligorName: p.obligorName,
      collateralType: p.collateralType,
      assetClass: p.assetClass,
      originalValue: p.currentValue,
      stressedValue,
      loanExposure: p.loanExposure,
      originalLTV: p.currentLTV,
      stressedLTV,
      ltvThreshold: p.ltvThreshold,
      breached,
      breachMargin,
    };
  });

  const totalOriginalValue = positions.reduce((s, p) => s + p.originalValue, 0);
  const totalStressedValue = positions.reduce((s, p) => s + p.stressedValue, 0);
  const totalLoanExposure = positions.reduce((s, p) => s + p.loanExposure, 0);
  const breachCount = positions.filter(p => p.breached).length;
  const breachExposure = positions.filter(p => p.breached).reduce((s, p) => s + p.loanExposure, 0);
  const portfolioLTV = totalOriginalValue > 0 ? (totalLoanExposure / totalOriginalValue) * 100 : 0;
  const stressedPortfolioLTV = totalStressedValue > 0 ? (totalLoanExposure / totalStressedValue) * 100 : 0;
  const valueAtRisk = totalOriginalValue - totalStressedValue;

  return {
    decline,
    label: `${decline}% Decline`,
    ...colors[decline],
    positions,
    summary: {
      totalOriginalValue,
      totalStressedValue,
      totalLoanExposure,
      breachCount,
      breachExposure,
      portfolioLTV,
      stressedPortfolioLTV,
      valueAtRisk,
    },
  };
}

// ─── Custom Tooltips ──────────────────────────────────────────────────────────

const CustomBarTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.fill }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-800">{fmt(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

const CustomLTVTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-xs">
      <p className="font-semibold text-gray-800 mb-1">{label}</p>
      {payload.map((entry: any) => (
        <div key={entry.name} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full" style={{ background: entry.stroke }} />
          <span className="text-gray-600">{entry.name}:</span>
          <span className="font-medium text-gray-800">{fmtPct(entry.value)}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function StressSimulatorContent() {
  const [portfolio, setPortfolio] = useState<StressPortfolioPosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeScenarios, setActiveScenarios] = useState<Set<10 | 20 | 30>>(new Set([10, 20, 30]));
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [filterBreached, setFilterBreached] = useState(false);
  const [selectedAssetClass, setSelectedAssetClass] = useState<string>('All');
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const loadPortfolio = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await stressSimulatorService.fetchPortfolio();
      setPortfolio(data);
      setLastRefreshed(new Date());
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load portfolio data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPortfolio();
  }, [loadPortfolio]);

  const scenarios = useMemo(() => {
    if (portfolio.length === 0) return [] as ScenarioResult[];
    const all: (10 | 20 | 30)[] = [10, 20, 30];
    return all.map(d => computeScenario(portfolio, d));
  }, [portfolio]);

  const activeScenarioList = scenarios.filter(s => activeScenarios.has(s.decline));

  // Chart data: portfolio value comparison
  const valueChartData = useMemo(() => {
    if (scenarios.length === 0) return [];
    return [
      { name: 'Current', value: scenarios[0].summary.totalOriginalValue, fill: '#007CB3' },
      ...scenarios.map(s => ({
        name: s.label,
        value: s.summary.totalStressedValue,
        fill: s.color,
      })),
    ];
  }, [scenarios]);

  // Chart data: LTV progression per position
  const ltvChartData = useMemo(() => {
    if (scenarios.length === 0) return [];
    return portfolio.map(p => {
      const row: Record<string, any> = {
        name: p.collateralRef,
        'Current LTV': parseFloat(p.currentLTV.toFixed(1)),
        Threshold: parseFloat(p.ltvThreshold.toFixed(1)),
      };
      scenarios.forEach(s => {
        const pos = s.positions.find(x => x.id === p.id);
        if (pos) row[s.label] = parseFloat(pos.stressedLTV.toFixed(1));
      });
      return row;
    });
  }, [scenarios, portfolio]);

  // Breach count chart
  const breachChartData = useMemo(() => {
    return scenarios.map(s => ({
      name: s.label,
      'Breached Positions': s.summary.breachCount,
      'Breach Exposure (B)': parseFloat((s.summary.breachExposure / 1e9).toFixed(2)),
      fill: s.color,
    }));
  }, [scenarios]);

  const assetClasses = useMemo(() => {
    return ['All', ...Array.from(new Set(portfolio.map(p => p.assetClass)))];
  }, [portfolio]);

  // Filtered positions for the table (use worst-case scenario = 30%)
  const worstScenario = scenarios[2];
  const filteredPositions = worstScenario
    ? worstScenario.positions.filter(p => {
        if (filterBreached && !p.breached) return false;
        if (selectedAssetClass !== 'All' && p.assetClass !== selectedAssetClass) return false;
        return true;
      })
    : [];

  const handleRefresh = () => loadPortfolio();

  const toggleScenario = (d: 10 | 20 | 30) => {
    setActiveScenarios(prev => {
      const next = new Set(prev);
      if (next.has(d)) {
        if (next.size > 1) next.delete(d);
      } else {
        next.add(d);
      }
      return next;
    });
  };

  // ── Loading state ──
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          <p className="text-sm font-medium">Loading live portfolio data…</p>
        </div>
      </div>
    );
  }

  // ── Error state ──
  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-red-200 p-8 max-w-md text-center">
          <AlertTriangle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-gray-800 mb-1">Failed to load portfolio</h2>
          <p className="text-sm text-gray-500 mb-4">{error}</p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  // ── Empty state ──
  if (portfolio.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
          <BarChart2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h2 className="text-base font-semibold text-gray-800 mb-1">No portfolio data available</h2>
          <p className="text-sm text-gray-500 mb-4">
            No collateral records with valuation amounts and linked loans were found. Add collateral records with valuations and loan links to run stress simulations.
          </p>
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors mx-auto"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ── Header ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-lg bg-red-50 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-red-600" />
              </div>
              <h1 className="text-xl font-bold text-gray-900">Portfolio Stress Simulator</h1>
            </div>
            <p className="text-sm text-gray-500 ml-10">
              Collateral value impact under 10%, 20%, and 30% market decline scenarios with real-time LTV breach forecasting
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5 text-xs text-green-700 bg-green-50 border border-green-200 px-2.5 py-1 rounded-lg">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
              Live — {portfolio.length} positions
            </div>
            <span className="text-xs text-gray-400">
              Last refreshed: {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
            </span>
            <button
              onClick={handleRefresh}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Refresh
            </button>
          </div>
        </div>

        {/* Scenario toggles */}
        <div className="flex items-center gap-2 mt-4 ml-10">
          <span className="text-xs text-gray-500 font-medium mr-1">Active Scenarios:</span>
          {([10, 20, 30] as const).map(d => {
            const s = scenarios.find(x => x.decline === d)!;
            const active = activeScenarios.has(d);
            return (
              <button
                key={d}
                onClick={() => toggleScenario(d)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                  active
                    ? 'text-white border-transparent' : 'bg-white text-gray-400 border-gray-200'
                }`}
                style={active ? { background: s.color, borderColor: s.color } : {}}
              >
                <TrendingDown className="w-3 h-3" />
                {d}% Decline
              </button>
            );
          })}
        </div>
      </div>

      <div className="px-6 py-5 space-y-6">

        {/* ── Scenario KPI Cards ── */}
        <div className="grid grid-cols-3 gap-4">
          {scenarios.map(s => {
            const active = activeScenarios.has(s.decline);
            return (
              <div
                key={s.decline}
                className={`rounded-xl border-2 p-5 transition-all ${active ? 'opacity-100' : 'opacity-40'}`}
                style={{ borderColor: s.borderColor, background: s.bgColor }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={{ background: s.color }}
                    >
                      <TrendingDown className="w-3.5 h-3.5 text-white" />
                    </div>
                    <span className="text-sm font-bold text-gray-800">{s.decline}% Decline Scenario</span>
                  </div>
                  {s.summary.breachCount > 0 ? (
                    <span
                      className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                      style={{ background: s.color }}
                    >
                      <AlertTriangle className="w-3 h-3" />
                      {s.summary.breachCount} Breach{s.summary.breachCount > 1 ? 'es' : ''}
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                      <CheckCircle2 className="w-3 h-3" />
                      No Breaches
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Stressed Portfolio Value</p>
                    <p className="text-base font-bold text-gray-900">{fmt(s.summary.totalStressedValue)}</p>
                    <p className="text-xs text-gray-400">from {fmt(s.summary.totalOriginalValue)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Value at Risk</p>
                    <p className="text-base font-bold" style={{ color: s.color }}>{fmt(s.summary.valueAtRisk)}</p>
                    <p className="text-xs text-gray-400">collateral erosion</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Portfolio LTV (Stressed)</p>
                    <p className="text-base font-bold text-gray-900">{fmtPct(s.summary.stressedPortfolioLTV)}</p>
                    <p className="text-xs text-gray-400">was {fmtPct(s.summary.portfolioLTV)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Breach Exposure</p>
                    <p className="text-base font-bold" style={{ color: s.color }}>
                      {s.summary.breachExposure > 0 ? fmt(s.summary.breachExposure) : '—'}
                    </p>
                    <p className="text-xs text-gray-400">loan exposure at risk</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Charts Row ── */}
        <div className="grid grid-cols-2 gap-4">

          {/* Portfolio Value Comparison */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <BarChart2 className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">Portfolio Value Under Stress</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={valueChartData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis
                  tickFormatter={v => `${(v / 1e9).toFixed(1)}B`}
                  tick={{ fontSize: 11 }}
                  width={55}
                />
                <Tooltip content={<CustomBarTooltip />} />
                <Bar dataKey="value" name="Portfolio Value" radius={[4, 4, 0, 0]}>
                  {valueChartData.map((entry, i) => (
                    <rect key={i} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Breach Count & Exposure */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <div className="flex items-center gap-2 mb-4">
              <ShieldAlert className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">LTV Breach Forecast by Scenario</h3>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={breachChartData} barSize={40}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="left" tick={{ fontSize: 11 }} width={30} />
                <YAxis yAxisId="right" orientation="right" tickFormatter={v => `${v}B`} tick={{ fontSize: 11 }} width={40} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="left" dataKey="Breached Positions" fill="#DC2626" radius={[4, 4, 0, 0]} />
                <Bar yAxisId="right" dataKey="Breach Exposure (B)" fill="#F97316" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* ── LTV Progression Chart ── */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">LTV Progression per Collateral Position</h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 bg-gray-50 px-2.5 py-1 rounded-lg">
              <Info className="w-3 h-3" />
              Dashed line = LTV threshold
            </div>
          </div>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={ltvChartData} margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-20} textAnchor="end" height={40} />
              <YAxis tickFormatter={v => `${v}%`} tick={{ fontSize: 11 }} width={45} domain={[0, 'auto']} />
              <Tooltip content={<CustomLTVTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <ReferenceLine y={75} stroke="#9CA3AF" strokeDasharray="5 5" label={{ value: 'Threshold 75%', position: 'insideTopRight', fontSize: 10, fill: '#9CA3AF' }} />
              <Line type="monotone" dataKey="Current LTV" stroke="#007CB3" strokeWidth={2} dot={{ r: 3 }} />
              {activeScenarioList.map(s => (
                <Line
                  key={s.decline}
                  type="monotone"
                  dataKey={s.label}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.decline === 30 ? '4 2' : undefined}
                  dot={{ r: 3 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* ── Position-Level Breach Table ── */}
        <div className="bg-white rounded-xl border border-gray-200">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-gray-500" />
              <h3 className="text-sm font-semibold text-gray-800">Position-Level Stress Analysis</h3>
              <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
                Worst-case (30% decline)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* Asset class filter */}
              <select
                value={selectedAssetClass}
                onChange={e => setSelectedAssetClass(e.target.value)}
                className="text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 text-gray-600 bg-white focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {assetClasses.map(ac => (
                  <option key={ac} value={ac}>{ac}</option>
                ))}
              </select>
              {/* Breach filter */}
              <button
                onClick={() => setFilterBreached(f => !f)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                  filterBreached
                    ? 'bg-red-50 text-red-700 border-red-200' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                {filterBreached ? 'Showing Breaches Only' : 'Show Breaches Only'}
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Collateral Ref</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Obligor</th>
                  <th className="text-left px-4 py-3 font-semibold text-gray-600">Asset Class</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Current Value</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Stressed Value</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Loan Exposure</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Current LTV</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Stressed LTV</th>
                  <th className="text-right px-4 py-3 font-semibold text-gray-600">Threshold</th>
                  <th className="text-center px-4 py-3 font-semibold text-gray-600">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {filteredPositions.map(pos => {
                  const expanded = expandedRow === pos.id;
                  const s10 = scenarios[0]?.positions.find(x => x.id === pos.id);
                  const s20 = scenarios[1]?.positions.find(x => x.id === pos.id);
                  return (
                    <React.Fragment key={pos.id}>
                      <tr
                        className={`border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${
                          pos.breached ? 'bg-red-50/40' : ''
                        }`}
                        onClick={() => setExpandedRow(expanded ? null : pos.id)}
                      >
                        <td className="px-4 py-3 font-mono font-medium text-blue-700">{pos.collateralRef}</td>
                        <td className="px-4 py-3 text-gray-700">{pos.obligorName}</td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-600 font-medium">
                            {pos.assetClass}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(pos.originalValue)}</td>
                        <td className="px-4 py-3 text-right font-medium text-red-700">{fmt(pos.stressedValue)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmt(pos.loanExposure)}</td>
                        <td className="px-4 py-3 text-right text-gray-700">{fmtPct(pos.originalLTV)}</td>
                        <td className="px-4 py-3 text-right font-bold" style={{ color: pos.breached ? '#DC2626' : '#059669' }}>
                          {fmtPct(pos.stressedLTV)}
                        </td>
                        <td className="px-4 py-3 text-right text-gray-500">{fmtPct(pos.ltvThreshold)}</td>
                        <td className="px-4 py-3 text-center">
                          {pos.breached ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-semibold">
                              <AlertTriangle className="w-3 h-3" />
                              Breach +{fmtPct(pos.breachMargin)}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700 font-semibold">
                              <CheckCircle2 className="w-3 h-3" />
                              Safe
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-400">
                          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                        </td>
                      </tr>

                      {/* Expanded row: all 3 scenarios */}
                      {expanded && s10 && s20 && (
                        <tr className="bg-gray-50 border-b border-gray-100">
                          <td colSpan={11} className="px-6 py-4">
                            <div className="grid grid-cols-3 gap-3">
                              {[s10, s20, pos].map((sp, idx) => {
                                const sc = scenarios[idx];
                                return (
                                  <div
                                    key={sc.decline}
                                    className="rounded-lg border p-3"
                                    style={{ borderColor: sc.borderColor, background: sc.bgColor }}
                                  >
                                    <p className="text-xs font-bold mb-2" style={{ color: sc.color }}>
                                      {sc.decline}% Decline Scenario
                                    </p>
                                    <div className="space-y-1 text-xs">
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Stressed Value</span>
                                        <span className="font-medium text-gray-800">{fmt(sp.stressedValue)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Stressed LTV</span>
                                        <span className="font-bold" style={{ color: sp.breached ? '#DC2626' : '#059669' }}>
                                          {fmtPct(sp.stressedLTV)}
                                        </span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Threshold</span>
                                        <span className="text-gray-600">{fmtPct(sp.ltvThreshold)}</span>
                                      </div>
                                      <div className="flex justify-between">
                                        <span className="text-gray-500">Breach Margin</span>
                                        <span className="font-medium" style={{ color: sp.breached ? '#DC2626' : '#059669' }}>
                                          {sp.breached ? `+${fmtPct(sp.breachMargin)}` : 'Within limit'}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>

            {filteredPositions.length === 0 && (
              <div className="text-center py-10 text-gray-400 text-sm">
                No positions match the current filters.
              </div>
            )}
          </div>

          {/* Table footer summary */}
          <div className="px-5 py-3 border-t border-gray-100 bg-gray-50 flex items-center justify-between">
            <span className="text-xs text-gray-500">
              Showing {filteredPositions.length} of {worstScenario?.positions.length ?? 0} positions
            </span>
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>
                <span className="font-semibold text-red-600">{worstScenario?.summary.breachCount ?? 0}</span> positions breach LTV under 30% stress
              </span>
              <span>
                Breach exposure: <span className="font-semibold text-red-600">{worstScenario ? fmt(worstScenario.summary.breachExposure) : '—'}</span>
              </span>
            </div>
          </div>
        </div>

        {/* ── Methodology Note ── */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-5 py-4 flex items-start gap-3">
          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
          <div className="text-xs text-blue-800">
            <p className="font-semibold mb-1">Stress Test Methodology</p>
            <p>
              Asset-class specific stress multipliers are applied: Equities (1.5× base), Fixed Deposits (0.2× base), Real Estate (1.0× base), Motor Vehicles (1.1× base), Debentures (0.8× base), Guarantees (0.5× base).
              Stressed LTV = Loan Exposure ÷ Stressed Collateral Value. A breach occurs when Stressed LTV exceeds the BOT-prescribed threshold for that collateral type.
              Portfolio-level LTV is computed as aggregate loan exposure divided by aggregate stressed collateral value.
              Data is sourced live from the Supabase collateral portfolio — haircut rates are pulled from the active Haircut Schedule Engine.
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
