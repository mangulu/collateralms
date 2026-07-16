'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { SlidersHorizontal, Save, RotateCcw, Info, TrendingDown, Percent, CalendarClock, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { alertThresholdsService, AlertThresholds } from '@/lib/supabase/alertThresholdsService';

const DEFAULTS: AlertThresholds = {
  ltvBreachPct: 80,
  perfectionRateDropPct: 10,
  brelaDeadlineDays: 30,
};

interface ThresholdCardProps {
  icon: React.ReactNode;
  title: string;
  description: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  value: number;
  defaultValue: number;
  onChange: (v: number) => void;
  accentColor: string;
  trackColor: string;
  warningNote?: string;
}

function ThresholdCard({
  icon, title, description, unit, min, max, step,
  value, defaultValue, onChange, accentColor, trackColor, warningNote,
}: ThresholdCardProps) {
  const pct = ((value - min) / (max - min)) * 100;
  const isDirty = value !== defaultValue;

  return (
    <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-5 shadow-sm">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${trackColor}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-600 text-foreground">{title}</h3>
            {isDirty && (
              <span className="text-[10px] font-600 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">
                Modified
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
        </div>
      </div>

      {/* Value display */}
      <div className="flex items-end justify-between">
        <div>
          <span className="text-3xl font-700 tabular-nums" style={{ color: accentColor }}>
            {value}
          </span>
          <span className="text-sm font-500 text-muted-foreground ml-1">{unit}</span>
        </div>
        <button
          onClick={() => onChange(defaultValue)}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          title="Reset to default"
        >
          <RotateCcw size={12} />
          Default ({defaultValue}{unit})
        </button>
      </div>

      {/* Slider */}
      <div className="relative">
        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
          <div
            className="absolute left-0 top-0 h-full rounded-full transition-all duration-150"
            style={{ width: `${pct}%`, backgroundColor: accentColor }}
          />
        </div>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          className="absolute inset-0 w-full opacity-0 cursor-pointer h-2"
          aria-label={title}
        />
        {/* Tick marks */}
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">{min}{unit}</span>
          <span className="text-[10px] text-muted-foreground">{Math.round((min + max) / 2)}{unit}</span>
          <span className="text-[10px] text-muted-foreground">{max}{unit}</span>
        </div>
      </div>

      {/* Number input */}
      <div className="flex items-center gap-2">
        <label className="text-xs text-muted-foreground shrink-0">Enter exact value:</label>
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (!isNaN(v) && v >= min && v <= max) onChange(v);
          }}
          className="w-24 px-2 py-1 text-sm border border-border rounded-md bg-background focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary tabular-nums"
        />
        <span className="text-xs text-muted-foreground">{unit}</span>
      </div>

      {/* Warning note */}
      {warningNote && (
        <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
          <Info size={13} className="text-amber-600 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-700">{warningNote}</p>
        </div>
      )}
    </div>
  );
}

export default function AlertThresholdsContent() {
  const { user } = useAuth();
  const [config, setConfig] = useState<AlertThresholds>(DEFAULTS);
  const [saved, setSaved] = useState<AlertThresholds>(DEFAULTS);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState<string | null>(null);

  const loadThresholds = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await alertThresholdsService.load(user.id);
      setConfig(data);
      setSaved(data);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    loadThresholds();
  }, [loadThresholds]);

  const isDirty =
    config.ltvBreachPct !== saved.ltvBreachPct ||
    config.perfectionRateDropPct !== saved.perfectionRateDropPct ||
    config.brelaDeadlineDays !== saved.brelaDeadlineDays;

  async function handleSave() {
    if (!user?.id) return;
    setSaveStatus('saving');
    setSaveError(null);
    try {
      await alertThresholdsService.save(user.id, config);
      setSaved({ ...config });
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2500);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save thresholds.');
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  }

  function handleResetAll() {
    setConfig({ ...DEFAULTS });
  }

  const set = (key: keyof AlertThresholds) => (v: number) =>
    setConfig((prev) => ({ ...prev, [key]: v }));

  if (loading) {
    return (
      <div className="p-6 space-y-6 max-w-5xl">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <SlidersHorizontal size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-700 text-foreground">Forecasting Alert Thresholds</h1>
            <p className="text-sm text-muted-foreground">Loading your saved thresholds…</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-border p-6 h-64 animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-3" />
              <div className="h-3 bg-muted rounded w-full mb-2" />
              <div className="h-3 bg-muted rounded w-5/6" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <SlidersHorizontal size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-700 text-foreground">Forecasting Alert Thresholds</h1>
            <p className="text-sm text-muted-foreground">
              Configure the trigger levels for automated forecasting alerts sent to officers.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleResetAll}
            disabled={!isDirty}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-500 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <RotateCcw size={14} />
            Reset All
          </button>
          <button
            onClick={handleSave}
            disabled={!isDirty || saveStatus === 'saving'}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-600 rounded-lg bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saveStatus === 'saving' ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : saveStatus === 'saved' ? (
              <>
                <CheckCircle2 size={14} />
                Saved
              </>
            ) : (
              <>
                <Save size={14} />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>

      {/* Unsaved changes banner */}
      {isDirty && saveStatus === 'idle' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-2.5">
          <AlertTriangle size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-500">
            You have unsaved threshold changes. Save to apply them to live alert monitoring.
          </p>
        </div>
      )}

      {/* Save error banner */}
      {saveStatus === 'error' && saveError && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-4 py-2.5">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-500">{saveError}</p>
        </div>
      )}

      {/* Threshold cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        <ThresholdCard
          icon={<Percent size={18} className="text-red-600" />}
          title="LTV Breach Threshold"
          description="Alert fires when a collateral's Loan-to-Value ratio exceeds this percentage, signalling under-collateralisation risk."
          unit="%"
          min={50}
          max={120}
          step={1}
          value={config.ltvBreachPct}
          defaultValue={DEFAULTS.ltvBreachPct}
          onChange={set('ltvBreachPct')}
          accentColor="#DC2626"
          trackColor="bg-red-100"
          warningNote="Setting this too high may delay critical risk alerts. Recommended range: 75–90%."
        />

        <ThresholdCard
          icon={<TrendingDown size={18} className="text-amber-600" />}
          title="Perfection Rate Drop"
          description="Alert fires when the portfolio perfection rate falls by this percentage within the monitoring window."
          unit="%"
          min={1}
          max={50}
          step={1}
          value={config.perfectionRateDropPct}
          defaultValue={DEFAULTS.perfectionRateDropPct}
          onChange={set('perfectionRateDropPct')}
          accentColor="#D97706"
          trackColor="bg-amber-100"
          warningNote="A very low value (< 5%) may generate excessive noise. Recommended: 8–15%."
        />

        <ThresholdCard
          icon={<CalendarClock size={18} className="text-blue-600" />}
          title="BRELA Deadline Warning"
          description="Alert fires when a BRELA registration deadline is within this many days, prompting officers to act in time."
          unit=" days"
          min={1}
          max={90}
          step={1}
          value={config.brelaDeadlineDays}
          defaultValue={DEFAULTS.brelaDeadlineDays}
          onChange={set('brelaDeadlineDays')}
          accentColor="#2563EB"
          trackColor="bg-blue-100"
          warningNote="Fewer than 7 days may not leave enough time for remediation. Recommended: 14–45 days."
        />
      </div>

      {/* Current active thresholds summary */}
      <div className="bg-white rounded-xl border border-border p-5 shadow-sm">
        <h2 className="text-sm font-600 text-foreground mb-4 flex items-center gap-2">
          <CheckCircle2 size={15} className="text-green-600" />
          Currently Active Thresholds
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {[
            { label: 'LTV Breach', value: `${saved.ltvBreachPct}%`, icon: <Percent size={14} className="text-red-500" />, color: 'text-red-600' },
            { label: 'Perfection Rate Drop', value: `${saved.perfectionRateDropPct}%`, icon: <TrendingDown size={14} className="text-amber-500" />, color: 'text-amber-600' },
            { label: 'BRELA Deadline', value: `${saved.brelaDeadlineDays} days`, icon: <CalendarClock size={14} className="text-blue-500" />, color: 'text-blue-600' },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-3 p-3 rounded-lg bg-muted/40 border border-border">
              <div className="w-8 h-8 rounded-md bg-white border border-border flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{item.label}</p>
                <p className={`text-sm font-700 tabular-nums ${item.color}`}>{item.value}</p>
              </div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          These are the thresholds currently driving live alert generation. Changes take effect after saving.
        </p>
      </div>
    </div>
  );
}
