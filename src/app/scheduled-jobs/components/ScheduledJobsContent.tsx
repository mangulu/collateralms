'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  Calendar, Clock, Play, Pause, Trash2, Plus, CheckCircle2, XCircle,
  AlertTriangle, RefreshCw, ChevronDown, ChevronUp, Loader2, Settings2,
  BarChart3, Shield, Zap, CalendarClock, ListChecks, TrendingUp,
  GitBranch, Workflow, Activity,
} from 'lucide-react';
import {
  scheduledJobService,
  runPreExecutionValidation,
  type ScheduledJob,
  type JobRunSummary,
  type ValidationResult,
  type ScheduleFrequency,
  type DayOfWeek,
  type JobStatus,
} from '@/lib/supabase/scheduledJobService';
import {
  workflowTriggerProcessorService,
  type TriggerJobLog,
  type TriggerProcessorResult,
} from '@/lib/supabase/workflowTriggerProcessorService';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return 'TZS ' + n.toLocaleString('en-TZ', { minimumFractionDigits: 0 });
}

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDuration(s: number) {
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

const DAY_LABELS: Record<DayOfWeek, string> = {
  MON: 'Monday', TUE: 'Tuesday', WED: 'Wednesday', THU: 'Thursday',
  FRI: 'Friday', SAT: 'Saturday', SUN: 'Sunday',
};

const REGISTRY_OPTIONS = ['BRELA', 'LANDS', 'TRA'];

function statusPill(status: JobStatus) {
  const map: Record<JobStatus, { bg: string; text: string; dot: string }> = {
    ACTIVE: { bg: 'bg-green-50', text: 'text-green-700', dot: 'bg-green-500' },
    PAUSED: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
    COMPLETED: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
    FAILED: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-500' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
      {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

function runStatusBadge(status: JobRunSummary['status']) {
  const map = {
    SUCCESS: { bg: 'bg-green-100', text: 'text-green-700', icon: <CheckCircle2 className="w-3.5 h-3.5" /> },
    PARTIAL: { bg: 'bg-amber-100', text: 'text-amber-700', icon: <AlertTriangle className="w-3.5 h-3.5" /> },
    FAILED: { bg: 'bg-red-100', text: 'text-red-700', icon: <XCircle className="w-3.5 h-3.5" /> },
    RUNNING: { bg: 'bg-blue-100', text: 'text-blue-700', icon: <Loader2 className="w-3.5 h-3.5 animate-spin" /> },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {s.icon} {status.charAt(0) + status.slice(1).toLowerCase()}
    </span>
  );
}

// ─── Validation Panel ─────────────────────────────────────────────────────────

function ValidationPanel({ result, onClose, onProceed, running }: {
  result: ValidationResult;
  onClose: () => void;
  onProceed: () => void;
  running: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${result.passed ? 'bg-green-50' : 'bg-red-50'}`}>
              {result.passed ? <Shield className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Pre-Execution Validation</p>
              <p className="text-xs text-muted-foreground">{result.passed ? 'All checks passed — ready to run' : 'Validation issues found'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Checks */}
          <div className="space-y-2">
            {result.checks.map((c) => (
              <div key={c.id} className="flex items-start gap-3 p-3 rounded-lg bg-slate-50 border border-border">
                <div className="mt-0.5 shrink-0">
                  {c.status === 'PASS' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
                  {c.status === 'WARN' && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                  {c.status === 'FAIL' && <XCircle className="w-4 h-4 text-red-600" />}
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{c.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.detail}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Estimates */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-blue-700">{result.eligibleCount}</p>
              <p className="text-xs text-blue-600 mt-0.5">Eligible Items</p>
            </div>
            <div className="bg-slate-50 rounded-xl p-3 text-center">
              <p className="text-lg font-bold text-slate-700">{result.totalCandidates}</p>
              <p className="text-xs text-slate-500 mt-0.5">Total Candidates</p>
            </div>
            <div className="bg-green-50 rounded-xl p-3 text-center">
              <p className="text-sm font-bold text-green-700 leading-tight">{fmt(result.estimatedEquityRelease)}</p>
              <p className="text-xs text-green-600 mt-0.5">Est. Equity Release</p>
            </div>
          </div>

          {/* Warnings */}
          {result.warnings.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" /> Warnings
              </p>
              {result.warnings.map((w, i) => (
                <p key={i} className="text-xs text-amber-700 pl-5">• {w}</p>
              ))}
            </div>
          )}

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={onProceed}
              disabled={!result.passed || running}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {running ? <><Loader2 className="w-4 h-4 animate-spin" /> Running…</> : <><Play className="w-4 h-4" /> Run Now</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Post-Execution Summary Panel ─────────────────────────────────────────────

function SummaryPanel({ summary, onClose }: { summary: JobRunSummary; onClose: () => void }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${summary.status === 'SUCCESS' ? 'bg-green-50' : summary.status === 'PARTIAL' ? 'bg-amber-50' : 'bg-red-50'}`}>
              {summary.status === 'SUCCESS' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
              {summary.status === 'PARTIAL' && <AlertTriangle className="w-5 h-5 text-amber-600" />}
              {summary.status === 'FAILED' && <XCircle className="w-5 h-5 text-red-600" />}
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">Post-Execution Summary</p>
              <p className="text-xs text-muted-foreground">{fmtDate(summary.runAt)} · {fmtDuration(summary.durationSeconds)}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* KPI strip */}
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Processed', value: summary.totalProcessed, color: 'text-slate-700', bg: 'bg-slate-50' },
              { label: 'Released', value: summary.released, color: 'text-green-700', bg: 'bg-green-50' },
              { label: 'Failed', value: summary.failed, color: 'text-red-700', bg: 'bg-red-50' },
              { label: 'Skipped', value: summary.skipped, color: 'text-amber-700', bg: 'bg-amber-50' },
            ].map((k) => (
              <div key={k.label} className={`${k.bg} rounded-xl p-3 text-center`}>
                <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          {/* Equity released */}
          <div className="bg-primary/5 border border-primary/20 rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Total Equity Released</span>
            </div>
            <span className="text-base font-bold text-primary">{fmt(summary.equityReleased)}</span>
          </div>

          {/* Errors */}
          {summary.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-red-800 flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5" /> Errors ({summary.errors.length})
              </p>
              {summary.errors.map((e, i) => (
                <p key={i} className="text-xs text-red-700 pl-5">• {e}</p>
              ))}
            </div>
          )}

          {/* Item breakdown */}
          <div>
            <button
              onClick={() => setExpanded((p) => !p)}
              className="w-full flex items-center justify-between text-sm font-semibold text-foreground py-2 border-b border-border"
            >
              <span className="flex items-center gap-2"><ListChecks className="w-4 h-4 text-muted-foreground" /> Item Breakdown ({summary.releasedItems.length})</span>
              {expanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            {expanded && (
              <div className="mt-2 space-y-1.5 max-h-64 overflow-y-auto">
                {summary.releasedItems.map((item, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-border text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-foreground truncate">{item.beneficiaryName}</p>
                      <p className="text-muted-foreground">{item.loanAccountId} · {item.collateralId} · {item.registry}</p>
                      {item.reason && <p className="text-red-600 mt-0.5">{item.reason}</p>}
                    </div>
                    <div className="ml-3 shrink-0 text-right">
                      <p className="font-semibold text-foreground">{fmt(item.allocatedAmount)}</p>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium mt-0.5 ${item.status === 'RELEASED' ? 'bg-green-100 text-green-700' : item.status === 'FAILED' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                        {item.status === 'RELEASED' && <CheckCircle2 className="w-3 h-3" />}
                        {item.status === 'FAILED' && <XCircle className="w-3 h-3" />}
                        {item.status.charAt(0) + item.status.slice(1).toLowerCase()}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={onClose}
            className="w-full px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Create / Edit Job Modal ──────────────────────────────────────────────────

interface JobFormState {
  name: string;
  description: string;
  frequency: ScheduleFrequency;
  runTime: string;
  dayOfWeek: DayOfWeek;
  registryFilter: string[];
  minDaysSinceClosure: number;
  requireDischargeNumber: boolean;
}

const DEFAULT_FORM: JobFormState = {
  name: '',
  description: '',
  frequency: 'DAILY',
  runTime: '06:00',
  dayOfWeek: 'MON',
  registryFilter: ['BRELA'],
  minDaysSinceClosure: 3,
  requireDischargeNumber: true,
};

function JobFormModal({ initial, onSave, onClose }: {
  initial?: ScheduledJob;
  onSave: (form: JobFormState) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<JobFormState>(
    initial
      ? {
          name: initial.name,
          description: initial.description,
          frequency: initial.frequency,
          runTime: initial.runTime,
          dayOfWeek: initial.dayOfWeek ?? 'MON',
          registryFilter: initial.registryFilter,
          minDaysSinceClosure: initial.minDaysSinceClosure,
          requireDischargeNumber: initial.requireDischargeNumber,
        }
      : DEFAULT_FORM
  );

  function toggleRegistry(r: string) {
    setForm((p) => ({
      ...p,
      registryFilter: p.registryFilter.includes(r)
        ? p.registryFilter.filter((x) => x !== r)
        : [...p.registryFilter, r],
    }));
  }

  const isValid = form.name.trim().length > 0 && form.registryFilter.length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-primary" />
            </div>
            <p className="font-semibold text-sm text-foreground">{initial ? 'Edit Schedule' : 'New Scheduled Job'}</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Job Name *</label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
              placeholder="e.g. Daily BRELA Batch Release"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Description</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
              rows={2}
              placeholder="Optional description of what this job does"
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>

          {/* Frequency + Time */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm((p) => ({ ...p, frequency: e.target.value as ScheduleFrequency }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white"
              >
                <option value="DAILY">Daily</option>
                <option value="WEEKLY">Weekly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Run Time</label>
              <input
                type="time"
                value={form.runTime}
                onChange={(e) => setForm((p) => ({ ...p, runTime: e.target.value }))}
                className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* Day of week (weekly only) */}
          {form.frequency === 'WEEKLY' && (
            <div>
              <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Day of Week</label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DAY_LABELS) as DayOfWeek[]).map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, dayOfWeek: d }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${form.dayOfWeek === d ? 'bg-primary text-white border-primary' : 'border-border text-muted-foreground hover:border-primary/50'}`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Registry filter */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Target Registries *</label>
            <div className="flex gap-2">
              {REGISTRY_OPTIONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggleRegistry(r)}
                  className={`flex-1 px-3 py-2 rounded-xl text-xs font-semibold border transition-colors ${form.registryFilter.includes(r) ? 'bg-primary/10 text-primary border-primary/30' : 'border-border text-muted-foreground hover:border-primary/30'}`}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>

          {/* Min days since closure */}
          <div>
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Minimum Days Since Loan Closure
            </label>
            <input
              type="number"
              min={1}
              max={90}
              value={form.minDaysSinceClosure}
              onChange={(e) => setForm((p) => ({ ...p, minDaysSinceClosure: parseInt(e.target.value) || 1 }))}
              className="w-full border border-border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            {form.minDaysSinceClosure < 3 && (
              <p className="text-xs text-amber-600 mt-1 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Under 3 days — verify compliance policy</p>
            )}
          </div>

          {/* Require discharge number */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-border">
            <div>
              <p className="text-sm font-medium text-foreground">Require Discharge Number</p>
              <p className="text-xs text-muted-foreground mt-0.5">Only release items that have a discharge number on file</p>
            </div>
            <button
              type="button"
              onClick={() => setForm((p) => ({ ...p, requireDischargeNumber: !p.requireDischargeNumber }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.requireDischargeNumber ? 'bg-primary' : 'bg-slate-300'}`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.requireDischargeNumber ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => isValid && onSave(form)}
              disabled={!isValid}
              className="flex-1 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {initial ? 'Save Changes' : 'Create Job'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Job Card ─────────────────────────────────────────────────────────────────

function JobCard({
  job,
  onToggle,
  onRunNow,
  onEdit,
  onDelete,
  onViewSummary,
}: {
  job: ScheduledJob;
  onToggle: () => void;
  onRunNow: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onViewSummary: (s: JobRunSummary) => void;
}) {
  const successRate = job.totalRuns > 0 ? Math.round((job.successRuns / job.totalRuns) * 100) : null;

  return (
    <div className="bg-white rounded-2xl border border-border p-5 hover:shadow-md transition-shadow">
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${job.status === 'ACTIVE' ? 'bg-green-50' : 'bg-slate-100'}`}>
            {job.frequency === 'DAILY'
              ? <Clock className={`w-5 h-5 ${job.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'}`} />
              : <Calendar className={`w-5 h-5 ${job.status === 'ACTIVE' ? 'text-green-600' : 'text-slate-400'}`} />}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm text-foreground truncate">{job.name}</p>
            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{job.description}</p>
          </div>
        </div>
        {statusPill(job.status)}
      </div>

      {/* Schedule info */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground">Schedule</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">
            {job.frequency === 'DAILY' ? `Daily at ${job.runTime}` : `${DAY_LABELS[job.dayOfWeek ?? 'MON']}s at ${job.runTime}`}
          </p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground">Registries</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">{job.registryFilter.join(', ')}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground">Last Run</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">{fmtDate(job.lastRunAt)}</p>
        </div>
        <div className="bg-slate-50 rounded-lg p-2.5">
          <p className="text-xs text-muted-foreground">Next Run</p>
          <p className="text-xs font-semibold text-foreground mt-0.5">{fmtDate(job.nextRunAt)}</p>
        </div>
      </div>

      {/* Stats row */}
      <div className="flex items-center gap-3 mb-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><BarChart3 className="w-3.5 h-3.5" /> {job.totalRuns} runs</span>
        {successRate !== null && (
          <span className={`flex items-center gap-1 font-medium ${successRate >= 80 ? 'text-green-600' : successRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
            <CheckCircle2 className="w-3.5 h-3.5" /> {successRate}% success
          </span>
        )}
        <span className="flex items-center gap-1"><Shield className="w-3.5 h-3.5" /> {job.minDaysSinceClosure}d closure window</span>
      </div>

      {/* Last summary quick view */}
      {job.lastSummary && (
        <button
          onClick={() => onViewSummary(job.lastSummary!)}
          className="w-full mb-3 flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-border hover:bg-slate-100 transition-colors text-xs"
        >
          <span className="flex items-center gap-2 text-muted-foreground">
            <ListChecks className="w-3.5 h-3.5" /> Last run summary
          </span>
          <div className="flex items-center gap-2">
            {runStatusBadge(job.lastSummary.status)}
            <span className="text-muted-foreground">{job.lastSummary.released}/{job.lastSummary.totalProcessed} released</span>
          </div>
        </button>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={onRunNow}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
        >
          <Play className="w-3.5 h-3.5" /> Run Now
        </button>
        <button
          onClick={onToggle}
          className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors ${job.status === 'ACTIVE' ? 'border-amber-300 text-amber-700 hover:bg-amber-50' : 'border-green-300 text-green-700 hover:bg-green-50'}`}
        >
          {job.status === 'ACTIVE' ? <><Pause className="w-3.5 h-3.5" /> Pause</> : <><Play className="w-3.5 h-3.5" /> Resume</>}
        </button>
        <button
          onClick={onEdit}
          className="flex items-center justify-center px-3 py-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="flex items-center justify-center px-3 py-2 rounded-xl border border-red-200 text-red-500 hover:bg-red-50 transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}

// ─── Trigger Processor Panel ──────────────────────────────────────────────────

function TriggerProcessorPanel() {
  const [logs, setLogs] = useState<TriggerJobLog[]>([]);
  const [stats, setStats] = useState<{ totalRuns: number; successRuns: number; totalInstancesCreated: number; lastRunAt: string | null }>({
    totalRuns: 0, successRuns: 0, totalInstancesCreated: 0, lastRunAt: null,
  });
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<TriggerProcessorResult | null>(null);
  const [logsLoading, setLogsLoading] = useState(true);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLogsLoading(true);
    try {
      const [logsData, statsData] = await Promise.all([
        workflowTriggerProcessorService.getRecentLogs(15),
        workflowTriggerProcessorService.getStats(),
      ]);
      setLogs(logsData);
      setStats(statsData);
    } catch {
      // silently fail — table may not exist yet
    } finally {
      setLogsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleRunNow() {
    setRunning(true);
    setLastResult(null);
    try {
      const result = await workflowTriggerProcessorService.runNow();
      setLastResult(result);
      await loadData();
    } catch (err: any) {
      setLastResult({
        status: 'failed',
        rulesEvaluated: 0,
        rulesMatched: 0,
        instancesCreated: 0,
        instancesSkipped: 0,
        errors: 1,
        durationMs: 0,
        detail: [],
      });
    } finally {
      setRunning(false);
    }
  }

  const successRate = stats.totalRuns > 0 ? Math.round((stats.successRuns / stats.totalRuns) * 100) : 0;

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border bg-gradient-to-r from-violet-50 to-white">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center">
            <GitBranch className="w-5 h-5 text-violet-600" />
          </div>
          <div>
            <p className="font-semibold text-sm text-foreground">Workflow Trigger Processor</p>
            <p className="text-xs text-muted-foreground">Auto-initiates workflow instances when trigger rule conditions match</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors"
            title="Refresh logs"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 text-white text-sm font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {running ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Running…</>
            ) : (
              <><Play className="w-4 h-4" /> Run Now</>
            )}
          </button>
        </div>
      </div>

      <div className="p-6 space-y-5">
        {/* KPI strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Total Runs', value: stats.totalRuns, icon: <Activity className="w-4 h-4 text-violet-600" />, bg: 'bg-violet-50', text: 'text-violet-700' },
            { label: 'Success Rate', value: `${successRate}%`, icon: <CheckCircle2 className="w-4 h-4 text-green-600" />, bg: 'bg-green-50', text: 'text-green-700' },
            { label: 'Instances Created', value: stats.totalInstancesCreated, icon: <Workflow className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-50', text: 'text-blue-700' },
            { label: 'Last Run', value: stats.lastRunAt ? new Date(stats.lastRunAt).toLocaleDateString('en-TZ', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—', icon: <Clock className="w-4 h-4 text-slate-500" />, bg: 'bg-slate-50', text: 'text-slate-700' },
          ].map((k) => (
            <div key={k.label} className={`${k.bg} rounded-xl p-3 flex items-center gap-2.5`}>
              <div className="shrink-0">{k.icon}</div>
              <div className="min-w-0">
                <p className={`text-lg font-bold ${k.text} truncate`}>{k.value}</p>
                <p className="text-xs text-muted-foreground">{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Last run result banner */}
        {lastResult && (
          <div className={`rounded-xl border p-4 ${lastResult.status === 'success' ? 'bg-green-50 border-green-200' : lastResult.status === 'partial' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
            <div className="flex items-center gap-2 mb-2">
              {lastResult.status === 'success' && <CheckCircle2 className="w-4 h-4 text-green-600" />}
              {lastResult.status === 'partial' && <AlertTriangle className="w-4 h-4 text-amber-600" />}
              {lastResult.status === 'failed' && <XCircle className="w-4 h-4 text-red-600" />}
              <span className={`text-sm font-semibold ${lastResult.status === 'success' ? 'text-green-800' : lastResult.status === 'partial' ? 'text-amber-800' : 'text-red-800'}`}>
                Run {lastResult.status === 'success' ? 'Completed' : lastResult.status === 'partial' ? 'Completed with Errors' : 'Failed'}
              </span>
              <span className="text-xs text-muted-foreground ml-auto">{lastResult.durationMs}ms</span>
            </div>
            <div className="grid grid-cols-4 gap-2 text-xs">
              <div><span className="text-muted-foreground">Rules evaluated:</span> <span className="font-semibold">{lastResult.rulesEvaluated}</span></div>
              <div><span className="text-muted-foreground">Rules matched:</span> <span className="font-semibold">{lastResult.rulesMatched}</span></div>
              <div><span className="text-muted-foreground">Instances created:</span> <span className="font-semibold text-green-700">{lastResult.instancesCreated}</span></div>
              <div><span className="text-muted-foreground">Skipped (dup):</span> <span className="font-semibold">{lastResult.instancesSkipped}</span></div>
            </div>
            {lastResult.detail.length > 0 && (
              <div className="mt-3 space-y-1.5">
                {lastResult.detail.filter((d) => d.matched > 0).map((d) => (
                  <div key={d.ruleId} className="flex items-center justify-between text-xs bg-white/60 rounded-lg px-3 py-1.5">
                    <span className="font-medium text-foreground truncate max-w-[60%]">{d.ruleName}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-muted-foreground">{d.matched} matched</span>
                      <span className="text-green-700 font-semibold">+{d.created} created</span>
                      {d.skipped > 0 && <span className="text-amber-600">{d.skipped} skipped</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Recent logs */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Recent Executions</p>
          {logsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              No executions yet. Click <span className="font-semibold">Run Now</span> to trigger the processor.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {logs.map((log) => (
                <div key={log.id} className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                    className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${log.status === 'success' ? 'bg-green-100 text-green-700' : log.status === 'partial' ? 'bg-amber-100 text-amber-700' : log.status === 'running' ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>
                        {log.status === 'running' && <Loader2 className="w-3 h-3 animate-spin" />}
                        {log.status === 'success' && <CheckCircle2 className="w-3 h-3" />}
                        {log.status === 'partial' && <AlertTriangle className="w-3 h-3" />}
                        {log.status === 'failed' && <XCircle className="w-3 h-3" />}
                        {log.status.charAt(0).toUpperCase() + log.status.slice(1)}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {new Date(log.runAt).toLocaleString('en-TZ', { dateStyle: 'medium', timeStyle: 'short' })}
                      </span>
                      <span className="text-xs text-muted-foreground shrink-0">
                        {log.triggeredBy === 'manual' ? '(manual)' : '(scheduler)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 shrink-0 ml-3">
                      <span className="text-xs text-muted-foreground hidden sm:block">{log.rulesEvaluated} rules</span>
                      <span className="text-xs font-semibold text-green-700">+{log.instancesCreated} instances</span>
                      {log.durationMs && <span className="text-xs text-muted-foreground hidden md:block">{log.durationMs}ms</span>}
                      {expandedLog === log.id ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                    </div>
                  </button>
                  {expandedLog === log.id && (
                    <div className="px-4 pb-3 pt-1 border-t border-border bg-slate-50 space-y-2">
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div><span className="text-muted-foreground">Rules matched:</span> <span className="font-semibold">{log.rulesMatched}</span></div>
                        <div><span className="text-muted-foreground">Skipped (dup):</span> <span className="font-semibold">{log.instancesSkipped}</span></div>
                        <div><span className="text-muted-foreground">Errors:</span> <span className={`font-semibold ${log.errorsCount > 0 ? 'text-red-600' : ''}`}>{log.errorsCount}</span></div>
                      </div>
                      {log.detail.filter((d) => d.matched > 0).length > 0 && (
                        <div className="space-y-1">
                          {log.detail.filter((d) => d.matched > 0).map((d, i) => (
                            <div key={i} className="flex items-center justify-between text-xs bg-white rounded-lg px-3 py-1.5 border border-border">
                              <span className="font-medium text-foreground truncate max-w-[55%]">{d.ruleName}</span>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-muted-foreground">{d.matched} matched</span>
                                <span className="text-green-700 font-semibold">+{d.created}</span>
                                {d.errors.length > 0 && <span className="text-red-600">{d.errors.length} err</span>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                      {log.errorMessages.length > 0 && (
                        <div className="bg-red-50 rounded-lg p-2 space-y-0.5">
                          {log.errorMessages.map((e, i) => (
                            <p key={i} className="text-xs text-red-700">• {e}</p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="bg-slate-50 rounded-xl p-4 border border-border">
          <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" /> How It Works
          </p>
          <ol className="space-y-1 text-xs text-muted-foreground list-decimal list-inside">
            <li>Loads all <span className="font-medium text-foreground">active trigger rules</span> from Workflow Templates</li>
            <li>Evaluates each rule's conditions against every collateral record</li>
            <li>Supports <span className="font-medium text-foreground">status change</span>, <span className="font-medium text-foreground">days-since-submission</span>, value threshold, LTV breach, and more</li>
            <li>Creates a new workflow instance for each match — skips collaterals that already have an active instance</li>
            <li>Logs every run with per-rule results for full auditability</li>
          </ol>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScheduledJobsContent() {
  const { hasPermission, loading: permsLoading } = usePermissions();
  const [jobs, setJobs] = useState<ScheduledJob[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingJob, setEditingJob] = useState<ScheduledJob | undefined>();
  const [validationResult, setValidationResult] = useState<{ result: ValidationResult; job: ScheduledJob } | null>(null);
  const [runningJobId, setRunningJobId] = useState<string | null>(null);
  const [activeSummary, setActiveSummary] = useState<JobRunSummary | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const reload = useCallback(() => setJobs(scheduledJobService.getAll()), []);

  useEffect(() => { reload(); }, [reload]);

  if (permsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!hasPermission(PERMISSIONS.COLLATERAL_EDIT)) {
    return <AccessDenied />;
  }

  // KPI counts
  const activeCount = jobs.filter((j) => j.status === 'ACTIVE').length;
  const totalRuns = jobs.reduce((s, j) => s + j.totalRuns, 0);
  const totalSuccess = jobs.reduce((s, j) => s + j.successRuns, 0);
  const overallRate = totalRuns > 0 ? Math.round((totalSuccess / totalRuns) * 100) : 0;

  function handleSaveForm(form: JobFormState) {
    if (editingJob) {
      scheduledJobService.update(editingJob.id, { ...form });
    } else {
      scheduledJobService.create({ ...form, status: 'ACTIVE' });
    }
    reload();
    setShowForm(false);
    setEditingJob(undefined);
  }

  function handleToggle(job: ScheduledJob) {
    scheduledJobService.update(job.id, { status: job.status === 'ACTIVE' ? 'PAUSED' : 'ACTIVE' });
    reload();
  }

  function handleRunNow(job: ScheduledJob) {
    const result = runPreExecutionValidation(job);
    setValidationResult({ result, job });
  }

  async function handleProceedRun() {
    if (!validationResult) return;
    const { job } = validationResult;
    setRunningJobId(job.id);
    try {
      const summary = await scheduledJobService.simulateRun(job);
      reload();
      setValidationResult(null);
      setActiveSummary(summary);
    } finally {
      setRunningJobId(null);
    }
  }

  function handleDelete(id: string) {
    scheduledJobService.delete(id);
    reload();
    setDeleteConfirm(null);
  }

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <CalendarClock className="w-5 h-5 text-primary" /> Scheduled Batch Release Jobs
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Configure automated daily/weekly schedules for batch collateral releases with pre-execution validation
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} className="p-2 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditingJob(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> New Schedule
          </button>
        </div>
      </div>

      {/* ── Workflow Trigger Processor ── */}
      <TriggerProcessorPanel />

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Jobs', value: jobs.length, icon: <CalendarClock className="w-5 h-5 text-primary" />, bg: 'bg-primary/5', text: 'text-primary' },
          { label: 'Active Schedules', value: activeCount, icon: <Zap className="w-5 h-5 text-green-600" />, bg: 'bg-green-50', text: 'text-green-700' },
          { label: 'Total Runs', value: totalRuns, icon: <BarChart3 className="w-5 h-5 text-blue-600" />, bg: 'bg-blue-50', text: 'text-blue-700' },
          { label: 'Success Rate', value: `${overallRate}%`, icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />, bg: 'bg-emerald-50', text: 'text-emerald-700' },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-2xl p-4 flex items-center gap-3`}>
            <div className="shrink-0">{k.icon}</div>
            <div>
              <p className={`text-2xl font-bold ${k.text}`}>{k.value}</p>
              <p className="text-xs text-muted-foreground">{k.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Jobs grid */}
      {jobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center mb-4">
            <CalendarClock className="w-7 h-7 text-slate-400" />
          </div>
          <p className="text-base font-semibold text-foreground">No scheduled jobs yet</p>
          <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first automated batch release schedule</p>
          <button
            onClick={() => { setEditingJob(undefined); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            <Plus className="w-4 h-4" /> Create Schedule
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onToggle={() => handleToggle(job)}
              onRunNow={() => handleRunNow(job)}
              onEdit={() => { setEditingJob(job); setShowForm(true); }}
              onDelete={() => setDeleteConfirm(job.id)}
              onViewSummary={(s) => setActiveSummary(s)}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showForm && (
        <JobFormModal
          initial={editingJob}
          onSave={handleSaveForm}
          onClose={() => { setShowForm(false); setEditingJob(undefined); }}
        />
      )}

      {validationResult && (
        <ValidationPanel
          result={validationResult.result}
          onClose={() => setValidationResult(null)}
          onProceed={handleProceedRun}
          running={runningJobId === validationResult.job.id}
        />
      )}

      {activeSummary && (
        <SummaryPanel
          summary={activeSummary}
          onClose={() => setActiveSummary(null)}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-600" />
            </div>
            <p className="font-semibold text-foreground">Delete this schedule?</p>
            <p className="text-sm text-muted-foreground mt-1 mb-5">This action cannot be undone. All run history will be lost.</p>
            <div className="flex gap-3">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-border text-sm font-medium text-foreground hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirm)}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white text-sm font-semibold hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
