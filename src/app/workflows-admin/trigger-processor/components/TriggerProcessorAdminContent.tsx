'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Play, Loader2, RefreshCw, CheckCircle2, XCircle, AlertTriangle, Clock, BarChart3, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { workflowTriggerProcessorService, type TriggerJobLog, type TriggerProcessorResult } from '@/lib/supabase/workflowTriggerProcessorService';
import { toast } from 'sonner';

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  success: { label: 'Success', color: 'text-emerald-700', bg: 'bg-emerald-50 border-emerald-200', icon: <CheckCircle2 size={14} className="text-emerald-500" /> },
  partial: { label: 'Partial', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <AlertTriangle size={14} className="text-amber-500" /> },
  failed: { label: 'Failed', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <XCircle size={14} className="text-red-500" /> },
  running: { label: 'Running', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <Loader2 size={14} className="animate-spin text-blue-500" /> },
};

function fmtDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' });
}

function fmtDuration(ms: number | null) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export default function TriggerProcessorAdminContent() {
  const [logs, setLogs] = useState<TriggerJobLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<TriggerProcessorResult | null>(null);
  const [expandedLog, setExpandedLog] = useState<string | null>(null);

  const loadLogs = useCallback(async () => {
    setLoading(true);
    workflowTriggerProcessorService.getRecentLogs(20).then(setLogs).catch(() => setLogs([])).finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadLogs(); }, [loadLogs]);

  const handleRunNow = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const result = await workflowTriggerProcessorService.runNow();
      setLastResult(result);
      toast.success(`Trigger processor completed — ${result.instancesCreated} instance(s) created`);
      await loadLogs();
    } catch (err: any) {
      toast.error(err?.message ?? 'Trigger processor failed');
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-teal-600 flex items-center justify-center">
              <Play size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Trigger Processor</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Manually run the auto-trigger job, view execution logs, and monitor rule match results
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={handleRunNow}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:opacity-60"
          >
            {running ? <Loader2 size={15} className="animate-spin" /> : <Play size={15} />}
            {running ? 'Running…' : 'Run Now'}
          </button>
        </div>
      </div>

      {/* Last result banner */}
      {lastResult && (
        <div className={`mb-6 p-4 rounded-xl border ${lastResult.status === 'success' ? 'bg-emerald-50 border-emerald-200' : lastResult.status === 'partial' ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'}`}>
          <div className="flex items-center gap-2 mb-3">
            {STATUS_CONFIG[lastResult.status]?.icon}
            <h2 className={`text-sm font-semibold ${STATUS_CONFIG[lastResult.status]?.color}`}>
              Run completed — {STATUS_CONFIG[lastResult.status]?.label}
            </h2>
            <span className="ml-auto text-xs text-muted-foreground">{fmtDuration(lastResult.durationMs)}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            {[
              { label: 'Rules Evaluated', value: lastResult.rulesEvaluated },
              { label: 'Rules Matched', value: lastResult.rulesMatched },
              { label: 'Instances Created', value: lastResult.instancesCreated },
              { label: 'Skipped (duplicate)', value: lastResult.instancesSkipped },
            ].map((stat) => (
              <div key={stat.label} className="bg-white rounded-lg px-3 py-2 border border-border">
                <p className="text-muted-foreground">{stat.label}</p>
                <p className="text-lg font-bold text-foreground">{stat.value}</p>
              </div>
            ))}
          </div>
          {lastResult.detail.length > 0 && (
            <div className="mt-3 space-y-1">
              {lastResult.detail.map((d, i) => (
                <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-1.5 border border-border">
                  <Zap size={11} className="text-amber-500 shrink-0" />
                  <span className="font-medium text-foreground truncate">{d.ruleName}</span>
                  <span className="ml-auto text-muted-foreground shrink-0">{d.matched} matched · {d.created} created · {d.skipped} skipped</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Execution history */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <BarChart3 size={15} className="text-muted-foreground" />
          <h2 className="text-sm font-semibold text-foreground">Execution History</h2>
          <span className="ml-auto text-xs text-muted-foreground">{logs.length} recent runs</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 size={20} className="animate-spin text-muted-foreground" />
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-12">
            <Clock size={28} className="mx-auto mb-2 text-muted-foreground opacity-40" />
            <p className="text-sm text-muted-foreground">No execution history yet</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => {
              const cfg = STATUS_CONFIG[log.status] ?? STATUS_CONFIG.failed;
              const isExpanded = expandedLog === log.id;
              return (
                <div key={log.id}>
                  <button
                    onClick={() => setExpandedLog(isExpanded ? null : log.id)}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors text-left"
                  >
                    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${cfg.bg} ${cfg.color} shrink-0`}>
                      {cfg.icon}
                      {cfg.label}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-foreground">
                        {fmtDate(log.runAt)} · <span className="text-muted-foreground">{log.triggeredBy === 'manual' ? 'Manual run' : 'Scheduled'}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {log.rulesEvaluated} rules · {log.rulesMatched} matched · {log.instancesCreated} created · {fmtDuration(log.durationMs)}
                      </p>
                    </div>
                    {isExpanded ? <ChevronUp size={14} className="text-muted-foreground shrink-0" /> : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                  </button>

                  {isExpanded && log.detail.length > 0 && (
                    <div className="px-4 pb-3 bg-slate-50 border-t border-border">
                      <div className="space-y-1 mt-2">
                        {log.detail.map((d, i) => (
                          <div key={i} className="flex items-center gap-2 text-xs bg-white rounded-lg px-3 py-1.5 border border-border">
                            <Zap size={11} className="text-amber-500 shrink-0" />
                            <span className="font-medium text-foreground truncate">{d.ruleName}</span>
                            <span className="ml-auto text-muted-foreground shrink-0">{d.matched} matched · {d.created} created · {d.skipped} skipped</span>
                          </div>
                        ))}
                        {log.errorMessages.length > 0 && (
                          <div className="mt-2 p-2 bg-red-50 rounded-lg border border-red-100">
                            {log.errorMessages.map((e, i) => (
                              <p key={i} className="text-xs text-red-700">{e}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
