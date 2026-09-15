'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Scissors, Plus, Edit2, CheckCircle2, AlertTriangle, Info,
  TrendingDown, BarChart2, Save, X, RefreshCw, Loader2, History,
} from 'lucide-react';
import {
  haircutService,
  HaircutSchedule,
  HaircutApplicationLog,
  applyHaircut,
  calculateHaircutAdjustedLtv,
} from '@/lib/supabase/haircutService';
import { useAuth } from '@/contexts/AuthContext';
import Icon from '@/components/ui/AppIcon';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtPct(rate: number): string {
  return `${(rate * 100).toFixed(2)}%`;
}

function fmtTsh(val: number): string {
  if (val >= 1e9) return `TSh ${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `TSh ${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `TSh ${(val / 1e3).toFixed(0)}K`;
  return `TSh ${val.toFixed(0)}`;
}

function haircutColor(rate: number): { text: string; bg: string; border: string } {
  const pct = rate * 100;
  if (pct === 0)   return { text: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' };
  if (pct <= 5)    return { text: 'text-teal-700',   bg: 'bg-teal-50',   border: 'border-teal-200' };
  if (pct <= 10)   return { text: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' };
  if (pct <= 20)   return { text: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' };
  return             { text: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' };
}

// ─── Edit Modal ───────────────────────────────────────────────────────────────

interface EditModalProps {
  schedule: HaircutSchedule | null;
  onClose: () => void;
  onSaved: () => void;
  userId: string;
}

function EditModal({ schedule, onClose, onSaved, userId }: EditModalProps) {
  const isNew = !schedule;
  const [collateralClass, setCollateralClass] = useState(schedule?.collateralClass ?? '');
  const [haircutPct, setHaircutPct] = useState(
    schedule ? String((schedule.haircutRate * 100).toFixed(2)) : '0'
  );
  const [description, setDescription] = useState(schedule?.description ?? '');
  const [notes, setNotes] = useState(schedule?.notes ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const rate = Math.min(30, Math.max(0, parseFloat(haircutPct) || 0)) / 100;
  const preview = applyHaircut(1_000_000, rate);

  async function handleSave() {
    if (!collateralClass.trim()) { setError('Collateral class is required.'); return; }
    const pct = parseFloat(haircutPct);
    if (isNaN(pct) || pct < 0 || pct > 30) { setError('Haircut rate must be between 0% and 30%.'); return; }
    setSaving(true);
    setError(null);
    try {
      await haircutService.upsertSchedule({
        collateralClass: collateralClass.trim(),
        haircutRate: pct / 100,
        description: description.trim() || undefined,
        notes: notes.trim() || undefined,
        userId,
      });
      onSaved();
    } catch (e: any) {
      setError(e.message ?? 'Save failed.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <div className="flex items-center gap-2">
            <Icon icon={Scissors} size={18} className="text-blue-600" />
            <h2 className="font-semibold text-slate-800">
              {isNew ? 'Add Haircut Rate' : `Edit — ${schedule?.collateralClass}`}
            </h2>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <Icon icon={X} size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {error && (
            <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <Icon icon={AlertTriangle} size={14} />
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Collateral Class <span className="text-red-500">*</span>
            </label>
            <input
              value={collateralClass}
              onChange={(e) => setCollateralClass(e.target.value)}
              disabled={!isNew}
              placeholder="e.g. Residential Land & Buildings"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-slate-50 disabled:text-slate-500"
            />
            {!isNew && (
              <p className="text-xs text-slate-400 mt-1">
                Class name cannot be changed. Create a new entry to rename.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Haircut Rate (%) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min={0}
                max={30}
                step={0.5}
                value={haircutPct}
                onChange={(e) => setHaircutPct(e.target.value)}
                className="w-full border border-slate-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">%</span>
            </div>
            <input
              type="range"
              min={0}
              max={30}
              step={0.5}
              value={parseFloat(haircutPct) || 0}
              onChange={(e) => setHaircutPct(e.target.value)}
              className="w-full mt-2 accent-blue-600"
            />
            <div className="flex justify-between text-xs text-slate-400 mt-0.5">
              <span>0% (No haircut)</span>
              <span>30% (Maximum)</span>
            </div>
          </div>

          {/* Live preview */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm">
            <p className="text-xs font-medium text-slate-500 mb-2">Live Preview — TSh 1,000,000 gross value</p>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-xs text-slate-400">Gross Value</p>
                <p className="font-semibold text-slate-700">TSh 1,000,000</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Haircut ({fmtPct(rate)})</p>
                <p className="font-semibold text-red-600">− {fmtTsh(preview.haircutAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Net Value</p>
                <p className="font-semibold text-green-700">{fmtTsh(preview.netValue)}</p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief rationale for this haircut rate"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Additional notes or regulatory references"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-slate-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save Rate'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── LTV Calculator Panel ─────────────────────────────────────────────────────

interface LtvCalcProps {
  schedules: HaircutSchedule[];
}

function LtvCalculatorPanel({ schedules }: LtvCalcProps) {
  const [selectedClass, setSelectedClass] = useState('');
  const [grossValue, setGrossValue] = useState('');
  const [loanExposure, setLoanExposure] = useState('');

  const schedule = schedules.find((s) => s.collateralClass === selectedClass && s.isActive);
  const rate = schedule?.haircutRate ?? 0;
  const gross = parseFloat(grossValue) || 0;
  const loan = parseFloat(loanExposure) || 0;

  const result = gross > 0 ? calculateHaircutAdjustedLtv(loan, gross, rate) : null;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Icon icon={TrendingDown} size={16} className="text-blue-600" />
        <h3 className="font-semibold text-slate-800 text-sm">Haircut-Adjusted LTV Calculator</h3>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Collateral Class</label>
          <select
            value={selectedClass}
            onChange={(e) => setSelectedClass(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select class…</option>
            {schedules.filter((s) => s.isActive).map((s) => (
              <option key={s.id} value={s.collateralClass}>
                {s.collateralClass} ({fmtPct(s.haircutRate)})
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Gross Collateral Value (TSh)</label>
            <input
              type="number"
              value={grossValue}
              onChange={(e) => setGrossValue(e.target.value)}
              placeholder="e.g. 500000000"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Loan Exposure (TSh)</label>
            <input
              type="number"
              value={loanExposure}
              onChange={(e) => setLoanExposure(e.target.value)}
              placeholder="e.g. 350000000"
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {result && selectedClass && (
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs text-slate-400">Gross Value</p>
                <p className="font-semibold text-slate-700">{fmtTsh(gross)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Haircut Rate</p>
                <p className="font-semibold text-orange-600">{fmtPct(rate)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Haircut Amount</p>
                <p className="font-semibold text-red-600">− {fmtTsh(result.haircutAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400">Net Collateral Value</p>
                <p className="font-semibold text-green-700">{fmtTsh(result.netCollateralValue)}</p>
              </div>
            </div>
            <div className="border-t border-slate-200 pt-2 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-600">Haircut-Adjusted LTV</span>
                <span
                  className={`text-lg font-bold ${
                    result.ltv > 0.9
                      ? 'text-red-600'
                      : result.ltv > 0.75
                      ? 'text-orange-600' :'text-green-700'
                  }`}
                >
                  {isFinite(result.ltv) ? fmtPct(result.ltv) : '∞'}
                </span>
              </div>
              {loan > 0 && (
                <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      result.ltv > 0.9 ? 'bg-red-500' : result.ltv > 0.75 ? 'bg-orange-500' : 'bg-green-500'
                    }`}
                    style={{ width: `${Math.min(100, result.ltv * 100)}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function HaircutScheduleContent() {
  const { user } = useAuth();
  const [schedules, setSchedules] = useState<HaircutSchedule[]>([]);
  const [logs, setLogs] = useState<HaircutApplicationLog[]>([]);
  const [stats, setStats] = useState<Awaited<ReturnType<typeof haircutService.getStats>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [editTarget, setEditTarget] = useState<HaircutSchedule | null | undefined>(undefined);
  const [activeTab, setActiveTab] = useState<'schedule' | 'log' | 'calculator'>('schedule');
  const [filterActive, setFilterActive] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, l, st] = await Promise.all([
      haircutService.listSchedules(false),
      haircutService.listApplicationLog({ limit: 50 }),
      haircutService.getStats(),
    ]);
    setSchedules(s);
    setLogs(l);
    setStats(st);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const displayed = filterActive ? schedules.filter((s) => s.isActive) : schedules;

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <Icon icon={Scissors} size={22} className="text-blue-600" />
            Haircut Schedule Engine
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Configurable asset-class haircut rates (0–30%) applied during valuation and LTV calculation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
          >
            <Icon icon={RefreshCw} size={14} />
            Refresh
          </button>
          <button
            onClick={() => setEditTarget(null)}
            className="flex items-center gap-1.5 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <Icon icon={Plus} size={14} />
            Add Rate
          </button>
        </div>
      </div>

      {/* KPI Strip */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Active Classes',    value: stats.activeClasses,                    icon: CheckCircle2, color: 'text-green-600' },
            { label: 'Avg Haircut',       value: `${stats.avgHaircutPct.toFixed(1)}%`,   icon: BarChart2,    color: 'text-blue-600' },
            { label: 'Max Haircut',       value: `${stats.maxHaircutPct.toFixed(1)}%`,   icon: TrendingDown, color: 'text-red-600' },
            { label: 'Min Haircut',       value: `${stats.minHaircutPct.toFixed(1)}%`,   icon: TrendingDown, color: 'text-green-600' },
            { label: 'Applications',      value: stats.totalApplications,                icon: History,      color: 'text-purple-600' },
            { label: 'Total Haircut Amt', value: fmtTsh(stats.totalHaircutAmount),       icon: Scissors,     color: 'text-orange-600' },
          ].map((kpi) => (
            <div key={kpi.label} className="bg-white border border-slate-200 rounded-xl p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Icon icon={kpi.icon} size={14} className={kpi.color} />
                <span className="text-xs text-slate-500">{kpi.label}</span>
              </div>
              <p className="text-xl font-bold text-slate-800">{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-slate-200">
        {(['schedule', 'calculator', 'log'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600' :'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {tab === 'schedule' ? 'Haircut Schedule' : tab === 'calculator' ? 'LTV Calculator' : 'Application Log'}
          </button>
        ))}
      </div>

      {/* Tab: Schedule */}
      {activeTab === 'schedule' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-sm text-slate-600 cursor-pointer">
                <input
                  type="checkbox"
                  checked={filterActive}
                  onChange={(e) => setFilterActive(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600"
                />
                Active rates only
              </label>
            </div>
            <p className="text-xs text-slate-400">{displayed.length} collateral class{displayed.length !== 1 ? 'es' : ''}</p>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : displayed.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Icon icon={Scissors} size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No haircut schedules found.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Collateral Class</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Haircut Rate</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:table-cell">Description</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Effective Date</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Status</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {displayed.map((s) => {
                    const colors = haircutColor(s.haircutRate);
                    return (
                      <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-medium text-slate-800">{s.collateralClass}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border ${colors.text} ${colors.bg} ${colors.border}`}>
                            <Icon icon={Scissors} size={10} />
                            {fmtPct(s.haircutRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 hidden md:table-cell max-w-xs truncate">
                          {s.description ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-center text-slate-600">
                          {s.effectiveDate}
                        </td>
                        <td className="px-4 py-3 text-center">
                          {s.isActive ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
                              <CheckCircle2 size={10} /> Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setEditTarget(s)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
                          >
                            <Icon icon={Edit2} size={12} />
                            Edit
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Info banner */}
          <div className="flex items-start gap-2 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 text-xs text-blue-700">
            <Icon icon={Info} size={14} className="mt-0.5 flex-shrink-0" />
            <span>
              Haircut rates are applied to gross collateral values during valuation approval and LTV calculation.
              The net (post-haircut) value is used for LTV ratio computation. Rates are configurable per asset class
              and must remain within the 0–30% regulatory range per BOT CF 2025 guidance.
            </span>
          </div>
        </div>
      )}

      {/* Tab: Calculator */}
      {activeTab === 'calculator' && (
        <div className="max-w-lg">
          <LtvCalculatorPanel schedules={schedules} />
        </div>
      )}

      {/* Tab: Application Log */}
      {activeTab === 'log' && (
        <div className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <Loader2 size={24} className="animate-spin text-blue-500" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-16 text-slate-400">
              <Icon icon={History} size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No haircut applications recorded yet.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Collateral</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Class</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Gross Value</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Haircut Amt</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Net Value</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Context</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Applied At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {logs.map((l) => {
                    const colors = haircutColor(l.haircutRate);
                    return (
                      <tr key={l.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 text-slate-700 max-w-[160px] truncate">
                          {l.collateralDescription ?? l.collateralId.slice(0, 8) + '…'}
                        </td>
                        <td className="px-4 py-3 text-slate-600 text-xs">{l.collateralClass}</td>
                        <td className="px-4 py-3 text-right text-slate-700">{fmtTsh(l.grossValue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${colors.text} ${colors.bg} ${colors.border}`}>
                            {fmtPct(l.haircutRate)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-red-600 font-medium">− {fmtTsh(l.haircutAmount)}</td>
                        <td className="px-4 py-3 text-right text-green-700 font-medium">{fmtTsh(l.netValue)}</td>
                        <td className="px-4 py-3 text-center">
                          <span className="px-2 py-0.5 rounded-full text-xs bg-slate-100 text-slate-600 capitalize">
                            {l.context.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center text-slate-500 text-xs">
                          {new Date(l.appliedAt).toLocaleDateString('en-GB')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Edit / Add Modal */}
      {editTarget !== undefined && (
        <EditModal
          schedule={editTarget}
          onClose={() => setEditTarget(undefined)}
          onSaved={() => { setEditTarget(undefined); load(); }}
          userId={user?.id ?? ''}
        />
      )}
    </div>
  );
}
