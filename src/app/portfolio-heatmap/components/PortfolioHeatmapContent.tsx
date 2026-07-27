'use client';
import React, { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  ZAxis,
  Legend,
} from 'recharts';
import { Map, TrendingUp, AlertTriangle, Layers, BarChart2, RefreshCw, Info, ArrowUpRight, ArrowDownRight,  } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface RegionData {
  region: string;
  collateralCount: number;
  totalValueTZS: number;
  avgLTV: number;
  overdueCount: number;
  overdueRate: number;
  concentration: number; // % of total portfolio
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  lat: number;
  lng: number;
}

type HeatmapMetric = 'concentration' | 'avgLTV' | 'overdueRate';

// ─── Tanzania Region Coordinates (approximate centroids) ─────────────────────

const REGION_COORDS: Record<string, { lat: number; lng: number }> = {
  'Dar es Salaam': { lat: -6.7924, lng: 39.2083 },
  'Arusha': { lat: -3.3869, lng: 36.6830 },
  'Kilimanjaro': { lat: -3.3731, lng: 36.6823 },
  'Mwanza': { lat: -2.5164, lng: 32.9175 },
  'Dodoma': { lat: -6.1722, lng: 35.7395 },
  'Zanzibar': { lat: -6.1659, lng: 39.2026 },
  'Mbeya': { lat: -8.9000, lng: 33.4600 },
  'Tanga': { lat: -5.0690, lng: 39.0980 },
  'Morogoro': { lat: -6.8219, lng: 37.6603 },
  'Iringa': { lat: -7.7700, lng: 35.6900 },
};

// ─── Mock / Seed Data ─────────────────────────────────────────────────────────

const MOCK_REGIONS: RegionData[] = [
  { region: 'Dar es Salaam', collateralCount: 142, totalValueTZS: 12500000000, avgLTV: 68.4, overdueCount: 18, overdueRate: 12.7, concentration: 41.5, riskLevel: 'MEDIUM', ...REGION_COORDS['Dar es Salaam'] },
  { region: 'Arusha', collateralCount: 48, totalValueTZS: 4200000000, avgLTV: 55.2, overdueCount: 4, overdueRate: 8.3, concentration: 14.0, riskLevel: 'LOW', ...REGION_COORDS['Arusha'] },
  { region: 'Kilimanjaro', collateralCount: 31, totalValueTZS: 2800000000, avgLTV: 52.1, overdueCount: 2, overdueRate: 6.5, concentration: 9.1, riskLevel: 'LOW', ...REGION_COORDS['Kilimanjaro'] },
  { region: 'Mwanza', collateralCount: 29, totalValueTZS: 1900000000, avgLTV: 82.3, overdueCount: 9, overdueRate: 31.0, concentration: 8.5, riskLevel: 'HIGH', ...REGION_COORDS['Mwanza'] },
  { region: 'Dodoma', collateralCount: 22, totalValueTZS: 1600000000, avgLTV: 61.7, overdueCount: 3, overdueRate: 13.6, concentration: 6.4, riskLevel: 'MEDIUM', ...REGION_COORDS['Dodoma'] },
  { region: 'Zanzibar', collateralCount: 18, totalValueTZS: 1400000000, avgLTV: 74.5, overdueCount: 5, overdueRate: 27.8, concentration: 5.3, riskLevel: 'HIGH', ...REGION_COORDS['Zanzibar'] },
  { region: 'Mbeya', collateralCount: 16, totalValueTZS: 1100000000, avgLTV: 49.8, overdueCount: 1, overdueRate: 6.3, concentration: 4.7, riskLevel: 'LOW', ...REGION_COORDS['Mbeya'] },
  { region: 'Tanga', collateralCount: 14, totalValueTZS: 980000000, avgLTV: 58.9, overdueCount: 2, overdueRate: 14.3, concentration: 4.1, riskLevel: 'MEDIUM', ...REGION_COORDS['Tanga'] },
  { region: 'Morogoro', collateralCount: 12, totalValueTZS: 820000000, avgLTV: 63.2, overdueCount: 2, overdueRate: 16.7, concentration: 3.5, riskLevel: 'MEDIUM', ...REGION_COORDS['Morogoro'] },
  { region: 'Iringa', collateralCount: 9, totalValueTZS: 560000000, avgLTV: 44.1, overdueCount: 0, overdueRate: 0.0, concentration: 2.6, riskLevel: 'LOW', ...REGION_COORDS['Iringa'] },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getRiskColor(level: 'LOW' | 'MEDIUM' | 'HIGH', opacity = 1): string {
  if (level === 'HIGH') return `rgba(239,68,68,${opacity})`;
  if (level === 'MEDIUM') return `rgba(245,158,11,${opacity})`;
  return `rgba(34,197,94,${opacity})`;
}

function getMetricColor(value: number, metric: HeatmapMetric): string {
  if (metric === 'concentration') {
    if (value > 30) return '#ef4444';
    if (value > 15) return '#f59e0b';
    if (value > 8) return '#3b82f6';
    return '#22c55e';
  }
  if (metric === 'avgLTV') {
    if (value > 75) return '#ef4444';
    if (value > 60) return '#f59e0b';
    if (value > 45) return '#3b82f6';
    return '#22c55e';
  }
  // overdueRate
  if (value > 25) return '#ef4444';
  if (value > 12) return '#f59e0b';
  if (value > 5) return '#3b82f6';
  return '#22c55e';
}

function formatTZS(val: number): string {
  if (val >= 1_000_000_000) return `TZS ${(val / 1_000_000_000).toFixed(1)}B`;
  if (val >= 1_000_000) return `TZS ${(val / 1_000_000).toFixed(0)}M`;
  return `TZS ${val.toLocaleString()}`;
}

// ─── SVG Bubble Map Component ─────────────────────────────────────────────────

// Tanzania bounding box: lat -11.7 to -1.0, lng 29.3 to 40.4
const MAP_BOUNDS = { minLat: -11.7, maxLat: -1.0, minLng: 29.3, maxLng: 40.4 };
const SVG_W = 480;
const SVG_H = 380;

function latLngToSVG(lat: number, lng: number): { x: number; y: number } {
  const x = ((lng - MAP_BOUNDS.minLng) / (MAP_BOUNDS.maxLng - MAP_BOUNDS.minLng)) * SVG_W;
  const y = ((MAP_BOUNDS.maxLat - lat) / (MAP_BOUNDS.maxLat - MAP_BOUNDS.minLat)) * SVG_H;
  return { x, y };
}

interface BubbleMapProps {
  regions: RegionData[];
  metric: HeatmapMetric;
  selectedRegion: string | null;
  onSelect: (region: string) => void;
}

function BubbleMap({ regions, metric, selectedRegion, onSelect }: BubbleMapProps) {
  const [tooltip, setTooltip] = useState<{ x: number; y: number; region: RegionData } | null>(null);

  const maxCount = Math.max(...regions.map((r) => r.collateralCount));

  return (
    <div className="relative w-full" style={{ paddingBottom: '79%' }}>
      <div className="absolute inset-0">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          className="w-full h-full"
          style={{ background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #f0fdf4 100%)' }}
        >
          {/* Tanzania outline approximation */}
          <rect x="0" y="0" width={SVG_W} height={SVG_H} rx="8" fill="url(#mapBg)" />
          <defs>
            <radialGradient id="mapBg" cx="50%" cy="50%" r="70%">
              <stop offset="0%" stopColor="#e0f2fe" />
              <stop offset="100%" stopColor="#f0fdf4" />
            </radialGradient>
          </defs>

          {/* Grid lines */}
          {[0.25, 0.5, 0.75].map((f) => (
            <React.Fragment key={f}>
              <line x1={SVG_W * f} y1={0} x2={SVG_W * f} y2={SVG_H} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4,4" />
              <line x1={0} y1={SVG_H * f} x2={SVG_W} y2={SVG_H * f} stroke="#cbd5e1" strokeWidth="0.5" strokeDasharray="4,4" />
            </React.Fragment>
          ))}

          {/* Country label */}
          <text x={SVG_W / 2} y={SVG_H - 10} textAnchor="middle" fill="#94a3b8" fontSize="11" fontFamily="DM Sans, sans-serif">Tanzania</text>

          {/* Bubbles */}
          {regions.map((r) => {
            const { x, y } = latLngToSVG(r.lat, r.lng);
            const radius = 12 + (r.collateralCount / maxCount) * 28;
            const color = getMetricColor(
              metric === 'concentration' ? r.concentration : metric === 'avgLTV' ? r.avgLTV : r.overdueRate,
              metric
            );
            const isSelected = selectedRegion === r.region;

            return (
              <g key={r.region}>
                {/* Pulse ring for high risk */}
                {r.riskLevel === 'HIGH' && (
                  <circle cx={x} cy={y} r={radius + 6} fill="none" stroke="#ef4444" strokeWidth="1.5" opacity="0.4" />
                )}
                <circle
                  cx={x}
                  cy={y}
                  r={radius}
                  fill={color}
                  fillOpacity={isSelected ? 0.95 : 0.75}
                  stroke={isSelected ? '#1e293b' : '#ffffff'}
                  strokeWidth={isSelected ? 2.5 : 1.5}
                  style={{ cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => onSelect(r.region)}
                  onMouseEnter={(e) => {
                    const svgEl = (e.target as SVGElement).closest('svg');
                    if (!svgEl) return;
                    const rect = svgEl.getBoundingClientRect();
                    const svgX = (x / SVG_W) * rect.width;
                    const svgY = (y / SVG_H) * rect.height;
                    setTooltip({ x: svgX, y: svgY, region: r });
                  }}
                  onMouseLeave={() => setTooltip(null)}
                />
                <text
                  x={x}
                  y={y + 1}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#ffffff"
                  fontSize={radius > 22 ? '9' : '7'}
                  fontWeight="600"
                  fontFamily="DM Sans, sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {r.region.length > 8 ? r.region.slice(0, 7) + '…' : r.region}
                </text>
                <text
                  x={x}
                  y={y + (radius > 22 ? 11 : 9)}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="rgba(255,255,255,0.9)"
                  fontSize="7"
                  fontFamily="DM Sans, sans-serif"
                  style={{ pointerEvents: 'none' }}
                >
                  {r.collateralCount}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div
            className="absolute z-20 bg-slate-900 text-white rounded-lg shadow-xl p-3 text-xs pointer-events-none"
            style={{ left: tooltip.x + 12, top: tooltip.y - 60, minWidth: 160 }}
          >
            <p className="font-semibold text-sm mb-1">{tooltip.region.region}</p>
            <p className="text-slate-300">{tooltip.region.collateralCount} collaterals</p>
            <p className="text-slate-300">Avg LTV: <span className="text-white font-medium">{tooltip.region.avgLTV.toFixed(1)}%</span></p>
            <p className="text-slate-300">Overdue: <span className="text-red-300 font-medium">{tooltip.region.overdueRate.toFixed(1)}%</span></p>
            <p className="text-slate-300">Concentration: <span className="text-blue-300 font-medium">{tooltip.region.concentration.toFixed(1)}%</span></p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function CustomBarTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-900 text-white rounded-lg shadow-xl p-3 text-xs border border-slate-700">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: <span className="font-medium">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}{p.name.includes('%') || p.name.includes('LTV') || p.name.includes('Rate') ? '%' : ''}</span>
        </p>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PortfolioHeatmapContent() {
  const [regions, setRegions] = useState<RegionData[]>(MOCK_REGIONS);
  const [loading, setLoading] = useState(true);
  const [isSampleData, setIsSampleData] = useState(true);
  const [metric, setMetric] = useState<HeatmapMetric>('concentration');
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'concentration' | 'avgLTV' | 'overdueRate' | 'collateralCount'>('concentration');

  // Load live data from Supabase
  useEffect(() => {
    const supabase = createClient();
    supabase
      .from('collateral_records')
      .select('id, status, latitude, longitude, location_address, value_tsh, ltv_ratio')
      .then(({ data }) => {
        if (data && data.length > 0) {
          // Group by region (derived from location_address)
          const regionMap: Record<string, { count: number; totalValue: number; ltvSum: number; ltvCount: number; overdueCount: number }> = {};
          data.forEach((row: any) => {
            const addr: string = row.location_address ?? '';
            // Try to match known regions
            let region = 'Other';
            for (const r of Object.keys(REGION_COORDS)) {
              if (addr.toLowerCase().includes(r.toLowerCase())) {
                region = r;
                break;
              }
            }
            if (!regionMap[region]) regionMap[region] = { count: 0, totalValue: 0, ltvSum: 0, ltvCount: 0, overdueCount: 0 };
            regionMap[region].count++;
            const val = parseFloat(row.value_tsh ?? '0') || 0;
            regionMap[region].totalValue += val;
            if (row.ltv_ratio) {
              regionMap[region].ltvSum += parseFloat(row.ltv_ratio);
              regionMap[region].ltvCount++;
            }
            if (row.status === 'Overdue') regionMap[region].overdueCount++;
          });

          const total = data.length;
          const liveRegions: RegionData[] = Object.entries(regionMap)
            .filter(([r]) => r !== 'Other')
            .map(([r, d]) => {
              const avgLTV = d.ltvCount > 0 ? d.ltvSum / d.ltvCount : 60;
              const overdueRate = d.count > 0 ? (d.overdueCount / d.count) * 100 : 0;
              const concentration = (d.count / total) * 100;
              const riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' =
                overdueRate > 25 || avgLTV > 75 ? 'HIGH' : overdueRate > 12 || avgLTV > 60 ? 'MEDIUM' : 'LOW';
              return {
                region: r,
                collateralCount: d.count,
                totalValueTZS: d.totalValue,
                avgLTV,
                overdueCount: d.overdueCount,
                overdueRate,
                concentration,
                riskLevel,
                ...REGION_COORDS[r],
              };
            });

          if (liveRegions.length >= 3) {
            setRegions(liveRegions);
            setIsSampleData(false);
          }
          // else: fewer than 3 geo-tagged regions — keep mock data with sample label
        }
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const selectedData = regions.find((r) => r.region === selectedRegion) ?? null;
  const totalCollateral = regions.reduce((s, r) => s + r.collateralCount, 0);
  const totalValue = regions.reduce((s, r) => s + r.totalValueTZS, 0);
  const avgPortfolioLTV = regions.reduce((s, r) => s + r.avgLTV * r.collateralCount, 0) / Math.max(totalCollateral, 1);
  const totalOverdue = regions.reduce((s, r) => s + r.overdueCount, 0);
  const portfolioOverdueRate = totalCollateral > 0 ? (totalOverdue / totalCollateral) * 100 : 0;
  const highRiskRegions = regions.filter((r) => r.riskLevel === 'HIGH').length;

  const sortedRegions = [...regions].sort((a, b) => b[sortBy] - a[sortBy]);

  const metricLabels: Record<HeatmapMetric, string> = {
    concentration: 'Collateral Concentration (%)',
    avgLTV: 'Average LTV (%)',
    overdueRate: 'Overdue Rate (%)',
  };

  const metricColors: Record<HeatmapMetric, string> = {
    concentration: '#3b82f6',
    avgLTV: '#f59e0b',
    overdueRate: '#ef4444',
  };

  return (
    <div className="p-6 space-y-6 bg-slate-50 min-h-screen">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center">
              <Map className="w-4 h-4 text-white" />
            </div>
            <h1 className="text-xl font-bold text-slate-900">Portfolio Heatmap</h1>
            {isSampleData && !loading && (
              <span className="inline-flex items-center gap-1 text-xs font-600 px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                <Info className="w-3 h-3" />
                Sample Data
              </span>
            )}
          </div>
          <p className="text-sm text-slate-500 ml-10">Regional risk analysis — collateral concentration, LTV, and overdue rates by geography</p>
        </div>
        <button
          onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 600); }}
          className="flex items-center gap-2 px-3 py-2 text-sm text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Collaterals', value: totalCollateral.toLocaleString(), sub: `Across ${regions.length} regions`, icon: Layers, color: 'bg-blue-50 text-blue-600', trend: null },
          { label: 'Portfolio Value', value: formatTZS(totalValue), sub: 'Total secured value', icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600', trend: null },
          { label: 'Avg Portfolio LTV', value: `${avgPortfolioLTV.toFixed(1)}%`, sub: avgPortfolioLTV > 70 ? 'Above threshold' : 'Within limits', icon: BarChart2, color: avgPortfolioLTV > 70 ? 'bg-amber-50 text-amber-600' : 'bg-green-50 text-green-600', trend: avgPortfolioLTV > 70 ? 'up' : 'down' },
          { label: 'Portfolio Overdue Rate', value: `${portfolioOverdueRate.toFixed(1)}%`, sub: `${totalOverdue} overdue items`, icon: AlertTriangle, color: portfolioOverdueRate > 15 ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-600', trend: portfolioOverdueRate > 15 ? 'up' : null },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-500 font-medium">{kpi.label}</span>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${kpi.color}`}>
                <kpi.icon className="w-3.5 h-3.5" />
              </div>
            </div>
            <p className="text-xl font-bold text-slate-900">{kpi.value}</p>
            <div className="flex items-center gap-1 mt-1">
              {kpi.trend === 'up' && <ArrowUpRight className="w-3 h-3 text-red-500" />}
              {kpi.trend === 'down' && <ArrowDownRight className="w-3 h-3 text-green-500" />}
              <p className="text-xs text-slate-400">{kpi.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* High Risk Alert Banner */}
      {highRiskRegions > 0 && (
        <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-800">
              {highRiskRegions} high-risk region{highRiskRegions > 1 ? 's' : ''} detected
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {regions.filter((r) => r.riskLevel === 'HIGH').map((r) => r.region).join(', ')} — elevated overdue rates or LTV above threshold
            </p>
          </div>
        </div>
      )}

      {/* Sample Data Notice */}
      {isSampleData && !loading && (
        <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-xl p-4">
          <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-600 text-amber-900">Showing Sample Data</p>
            <p className="text-xs text-amber-700 mt-0.5">
              No geo-tagged collateral records were found in the database. The map below displays illustrative regional data.
              To see live data, ensure collateral records include <span className="font-mono bg-amber-100 px-1 rounded">location_address</span> values matching Tanzania regions.
            </p>
          </div>
        </div>
      )}

      {/* Main Content: Map + Detail */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Bubble Map */}
        <div className="xl:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Map className="w-4 h-4 text-slate-500" />
              <h2 className="text-sm font-semibold text-slate-800">Geographic Distribution</h2>
            </div>
            {/* Metric Selector */}
            <div className="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
              {(['concentration', 'avgLTV', 'overdueRate'] as HeatmapMetric[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMetric(m)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    metric === m ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {m === 'concentration' ? 'Concentration' : m === 'avgLTV' ? 'Avg LTV' : 'Overdue Rate'}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4">
            <BubbleMap
              regions={regions}
              metric={metric}
              selectedRegion={selectedRegion}
              onSelect={(r) => setSelectedRegion(selectedRegion === r ? null : r)}
            />
          </div>

          {/* Legend */}
          <div className="px-5 pb-4 flex items-center gap-6 flex-wrap">
            <span className="text-xs text-slate-500 font-medium">Bubble size = # collaterals</span>
            <div className="flex items-center gap-4">
              {[
                { label: 'Low', color: '#22c55e' },
                { label: 'Moderate', color: '#3b82f6' },
                { label: 'Elevated', color: '#f59e0b' },
                { label: 'High', color: '#ef4444' },
              ].map((l) => (
                <div key={l.label} className="flex items-center gap-1.5">
                  <div className="w-3 h-3 rounded-full" style={{ background: l.color }} />
                  <span className="text-xs text-slate-500">{l.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Region Detail Panel */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-100">
            <h2 className="text-sm font-semibold text-slate-800">
              {selectedData ? selectedData.region : 'Region Detail'}
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {selectedData ? 'Click another region to compare' : 'Click a bubble to inspect a region'}
            </p>
          </div>

          {selectedData ? (
            <div className="p-5 space-y-4 flex-1">
              {/* Risk Badge */}
              <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                selectedData.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' :
                selectedData.riskLevel === 'MEDIUM'? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'
              }`}>
                <div className={`w-1.5 h-1.5 rounded-full ${
                  selectedData.riskLevel === 'HIGH' ? 'bg-red-500' :
                  selectedData.riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'
                }`} />
                {selectedData.riskLevel} RISK
              </div>

              {/* Metrics */}
              <div className="space-y-3">
                {[
                  { label: 'Collateral Count', value: selectedData.collateralCount.toLocaleString(), sub: `${selectedData.concentration.toFixed(1)}% of portfolio` },
                  { label: 'Total Value', value: formatTZS(selectedData.totalValueTZS), sub: 'Secured collateral value' },
                  { label: 'Average LTV', value: `${selectedData.avgLTV.toFixed(1)}%`, sub: selectedData.avgLTV > 70 ? '⚠ Above 70% threshold' : '✓ Within acceptable range', warn: selectedData.avgLTV > 70 },
                  { label: 'Overdue Count', value: selectedData.overdueCount.toLocaleString(), sub: `${selectedData.overdueRate.toFixed(1)}% overdue rate`, warn: selectedData.overdueRate > 15 },
                ].map((item) => (
                  <div key={item.label} className="flex items-center justify-between py-2.5 border-b border-slate-50 last:border-0">
                    <div>
                      <p className="text-xs text-slate-500">{item.label}</p>
                      <p className={`text-xs mt-0.5 ${item.warn ? 'text-amber-600' : 'text-slate-400'}`}>{item.sub}</p>
                    </div>
                    <p className={`text-sm font-bold ${item.warn ? 'text-red-600' : 'text-slate-900'}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Mini bar: concentration vs portfolio avg */}
              <div className="bg-slate-50 rounded-lg p-3">
                <p className="text-xs text-slate-500 mb-2">Concentration vs Portfolio Avg</p>
                <div className="space-y-1.5">
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">{selectedData.region}</span>
                      <span className="font-medium text-slate-800">{selectedData.concentration.toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-blue-500 transition-all" style={{ width: `${Math.min(selectedData.concentration * 2, 100)}%` }} />
                    </div>
                  </div>
                  <div>
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-slate-600">Portfolio Avg</span>
                      <span className="font-medium text-slate-800">{(100 / regions.length).toFixed(1)}%</span>
                    </div>
                    <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                      <div className="h-full rounded-full bg-slate-400 transition-all" style={{ width: `${Math.min((100 / regions.length) * 2, 100)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center mb-3">
                <Map className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-600">Select a region</p>
              <p className="text-xs text-slate-400 mt-1">Click any bubble on the map to view detailed regional risk metrics</p>
            </div>
          )}
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Concentration Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Collateral Concentration by Region</h3>
            <span className="text-xs text-slate-400">% of total portfolio</span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={sortedRegions.slice(0, 8)} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
              <YAxis type="category" dataKey="region" tick={{ fontSize: 10, fill: '#64748b' }} width={90} />
              <Tooltip content={<CustomBarTooltip />} />
              <Bar dataKey="concentration" name="Concentration %" radius={[0, 4, 4, 0]}>
                {sortedRegions.slice(0, 8).map((r) => (
                  <Cell key={r.region} fill={getMetricColor(r.concentration, 'concentration')} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* LTV vs Overdue Scatter */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-800">Avg LTV vs Overdue Rate</h3>
            <div className="flex items-center gap-1 text-xs text-slate-400">
              <Info className="w-3.5 h-3.5" />
              Bubble size = # collaterals
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="avgLTV" name="Avg LTV" type="number" domain={[30, 90]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} label={{ value: 'Avg LTV (%)', position: 'insideBottom', offset: -2, fontSize: 10, fill: '#94a3b8' }} />
              <YAxis dataKey="overdueRate" name="Overdue Rate" type="number" domain={[0, 40]} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(v) => `${v}%`} />
              <ZAxis dataKey="collateralCount" range={[40, 400]} />
              <Tooltip
                cursor={{ strokeDasharray: '3 3' }}
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload as RegionData;
                  return (
                    <div className="bg-slate-900 text-white rounded-lg p-3 text-xs shadow-xl border border-slate-700">
                      <p className="font-semibold mb-1">{d.region}</p>
                      <p className="text-slate-300">LTV: <span className="text-white">{d.avgLTV.toFixed(1)}%</span></p>
                      <p className="text-slate-300">Overdue: <span className="text-red-300">{d.overdueRate.toFixed(1)}%</span></p>
                      <p className="text-slate-300">Count: <span className="text-white">{d.collateralCount}</span></p>
                    </div>
                  );
                }}
              />
              <Scatter
                data={regions}
                fill="#3b82f6"
              >
                {regions.map((r) => (
                  <Cell
                    key={r.region}
                    fill={getRiskColor(r.riskLevel, 0.8)}
                  />
                ))}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
          {/* Risk legend */}
          <div className="flex items-center gap-4 mt-2 justify-center">
            {(['LOW', 'MEDIUM', 'HIGH'] as const).map((l) => (
              <div key={l} className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full" style={{ background: getRiskColor(l, 0.8) }} />
                <span className="text-xs text-slate-500">{l}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Region Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h3 className="text-sm font-semibold text-slate-800">Regional Risk Summary</h3>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">Sort by:</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
              className="text-xs border border-slate-200 rounded-lg px-2 py-1.5 text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="concentration">Concentration</option>
              <option value="avgLTV">Avg LTV</option>
              <option value="overdueRate">Overdue Rate</option>
              <option value="collateralCount">Count</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Region', 'Collaterals', 'Concentration', 'Total Value', 'Avg LTV', 'Overdue', 'Overdue Rate', 'Risk Level'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {sortedRegions.map((r) => (
                <tr
                  key={r.region}
                  className={`hover:bg-slate-50 cursor-pointer transition-colors ${selectedRegion === r.region ? 'bg-blue-50' : ''}`}
                  onClick={() => setSelectedRegion(selectedRegion === r.region ? null : r.region)}
                >
                  <td className="px-4 py-3 font-medium text-slate-800">{r.region}</td>
                  <td className="px-4 py-3 text-slate-600">{r.collateralCount}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${Math.min(r.concentration * 2.5, 100)}%`, background: getMetricColor(r.concentration, 'concentration') }} />
                      </div>
                      <span className="text-slate-700 text-xs">{r.concentration.toFixed(1)}%</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-600 text-xs">{formatTZS(r.totalValueTZS)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${r.avgLTV > 70 ? 'text-red-600' : r.avgLTV > 55 ? 'text-amber-600' : 'text-green-600'}`}>
                      {r.avgLTV.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{r.overdueCount}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold ${r.overdueRate > 25 ? 'text-red-600' : r.overdueRate > 12 ? 'text-amber-600' : 'text-green-600'}`}>
                      {r.overdueRate.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${
                      r.riskLevel === 'HIGH' ? 'bg-red-50 text-red-700 border-red-200' :
                      r.riskLevel === 'MEDIUM'? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-green-50 text-green-700 border-green-200'
                    }`}>
                      <div className={`w-1.5 h-1.5 rounded-full ${r.riskLevel === 'HIGH' ? 'bg-red-500' : r.riskLevel === 'MEDIUM' ? 'bg-amber-500' : 'bg-green-500'}`} />
                      {r.riskLevel}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
