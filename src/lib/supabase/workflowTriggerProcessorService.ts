'use client';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriggerJobRuleResult {
  ruleId: string;
  ruleName: string;
  templateId: string;
  matched: number;
  created: number;
  skipped: number;
  errors: string[];
}

export interface TriggerJobLog {
  id: string;
  runAt: string;
  triggeredBy: 'scheduler' | 'manual';
  status: 'running' | 'success' | 'partial' | 'failed';
  rulesEvaluated: number;
  rulesMatched: number;
  instancesCreated: number;
  instancesSkipped: number;
  errorsCount: number;
  durationMs: number | null;
  detail: TriggerJobRuleResult[];
  errorMessages: string[];
  completedAt: string | null;
}

export interface TriggerProcessorResult {
  status: 'success' | 'partial' | 'failed';
  rulesEvaluated: number;
  rulesMatched: number;
  instancesCreated: number;
  instancesSkipped: number;
  errors: number;
  durationMs: number;
  detail: TriggerJobRuleResult[];
}

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToLog(row: any): TriggerJobLog {
  return {
    id: row.id,
    runAt: row.run_at,
    triggeredBy: row.triggered_by,
    status: row.status,
    rulesEvaluated: row.rules_evaluated,
    rulesMatched: row.rules_matched,
    instancesCreated: row.instances_created,
    instancesSkipped: row.instances_skipped,
    errorsCount: row.errors_count,
    durationMs: row.duration_ms,
    detail: row.detail ?? [],
    errorMessages: row.error_messages ?? [],
    completedAt: row.completed_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const workflowTriggerProcessorService = {
  /**
   * Manually invoke the trigger processor job from the UI.
   * Calls the Next.js API route which runs the full evaluation loop.
   */
  async runNow(): Promise<TriggerProcessorResult> {
    const res = await fetch('/api/workflow/trigger-processor', {
      method: 'POST',
      headers: {
        'x-trigger-source': 'manual',
        'Content-Type': 'application/json',
      },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err?.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  /**
   * Fetch recent job execution logs from the database.
   */
  async getRecentLogs(limit = 20): Promise<TriggerJobLog[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workflow_trigger_job_log')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(limit);
    if (error) throw error;
    return (data ?? []).map(rowToLog);
  },

  /**
   * Get summary stats for the trigger processor.
   */
  async getStats(): Promise<{
    totalRuns: number;
    successRuns: number;
    totalInstancesCreated: number;
    lastRunAt: string | null;
  }> {
    const supabase = createClient();
    const { data } = await supabase
      .from('workflow_trigger_job_log')
      .select('status, instances_created, run_at')
      .order('run_at', { ascending: false })
      .limit(100);
    const rows = data ?? [];
    return {
      totalRuns: rows.length,
      successRuns: rows.filter((r: any) => r.status === 'success' || r.status === 'partial').length,
      totalInstancesCreated: rows.reduce((s: number, r: any) => s + (r.instances_created ?? 0), 0),
      lastRunAt: rows[0]?.run_at ?? null,
    };
  },
};
