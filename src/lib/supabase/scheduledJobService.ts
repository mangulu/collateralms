'use client';

import { createClient } from '@/lib/supabase/client';
import { collateralLinkService } from '@/lib/supabase/collateralLinkService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ScheduleFrequency = 'DAILY' | 'WEEKLY';
export type JobStatus = 'ACTIVE' | 'PAUSED';
export type RunStatus = 'SUCCESS' | 'FAILED' | 'PARTIAL';
export type DayOfWeek = 'MON' | 'TUE' | 'WED' | 'THU' | 'FRI' | 'SAT' | 'SUN';

export interface ValidationCheck {
  id: string;
  label: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  detail: string;
}

export interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  eligibleCount: number;
  totalCandidates: number;
  estimatedEquityRelease: number;
  warnings: string[];
}

export interface ReleasedItem {
  loanAccountId: string;
  beneficiaryName: string;
  collateralId: string;
  allocatedAmount: number;
  registry: string;
  status: 'RELEASED' | 'FAILED';
  reason?: string;
}

export interface JobRunSummary {
  id: string;
  jobId: string;
  runAt: string;
  status: RunStatus;
  totalProcessed: number;
  released: number;
  failed: number;
  equityReleased: number;
  durationSeconds: number;
  errors: string[];
  releasedItems: ReleasedItem[];
}

export interface ScheduledJob {
  id: string;
  name: string;
  description: string;
  frequency: ScheduleFrequency;
  runTime: string; // HH:MM
  dayOfWeek: DayOfWeek | null; // only for WEEKLY
  status: JobStatus;
  registryFilter: string[];
  requireDischargeNumber: boolean;
  createdAt: string;
  lastRunAt: string | null;
  nextRunAt: string | null;
  totalRuns: number;
  successRuns: number;
  lastSummary?: JobRunSummary;
}

interface EligibleItem {
  linkId: string;
  loanAccountId: string;
  beneficiaryName: string;
  collateralId: string;
  collateralRecordId: string;
  allocatedAmount: number;
  registry: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Next occurrence purely for display -- there's no server-side scheduler that reads this; the actual cron job (see supabase/migrations) runs on a fixed daily check and evaluates every active job's frequency/day itself. */
export function nextRunDate(freq: ScheduleFrequency, runTime: string, dayOfWeek?: DayOfWeek | null): string {
  const now = new Date();
  const [h, m] = runTime.split(':').map(Number);
  const candidate = new Date(now);
  candidate.setHours(h, m, 0, 0);

  if (freq === 'DAILY') {
    if (candidate <= now) candidate.setDate(candidate.getDate() + 1);
    return candidate.toISOString();
  }

  const dayMap: Record<DayOfWeek, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const targetDay = dayMap[dayOfWeek ?? 'MON'];
  const currentDay = now.getDay();
  let daysUntil = (targetDay - currentDay + 7) % 7;
  if (daysUntil === 0 && candidate <= now) daysUntil = 7;
  candidate.setDate(candidate.getDate() + daysUntil);
  return candidate.toISOString();
}

function rowToJob(row: any, lastSummary?: JobRunSummary): ScheduledJob {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    frequency: row.frequency,
    runTime: row.run_time,
    dayOfWeek: row.day_of_week ?? null,
    status: row.status,
    registryFilter: row.registry_filter ?? [],
    requireDischargeNumber: row.require_discharge_number,
    createdAt: row.created_at,
    lastRunAt: row.last_run_at,
    nextRunAt: row.status === 'ACTIVE' ? nextRunDate(row.frequency, row.run_time, row.day_of_week) : null,
    totalRuns: row.total_runs,
    successRuns: row.success_runs,
    lastSummary,
  };
}

function rowToSummary(row: any): JobRunSummary {
  return {
    id: row.id,
    jobId: row.job_id,
    runAt: row.run_at,
    status: row.status,
    totalProcessed: row.total_processed,
    released: row.released,
    failed: row.failed,
    equityReleased: (row.released_items ?? []).reduce((s: number, i: ReleasedItem) => s + (i.status === 'RELEASED' ? i.allocatedAmount : 0), 0),
    durationSeconds: row.duration_seconds,
    errors: row.errors ?? [],
    releasedItems: row.released_items ?? [],
  };
}

/**
 * Real eligibility: an ACTIVE collateral_loan_links row whose matching
 * charge_registry entry (same collateral + loan + charge rank) is in one of
 * the target registries. There's no reliable "days since loan closure"
 * signal in this schema -- collateral_loan_links.end_date is only ever set
 * BY the release itself -- so the only safe automated criterion is whether
 * the registry has already confirmed the charge discharged.
 */
async function getEligibleItems(
  registryFilter: string[],
  requireDischargeNumber: boolean
): Promise<{ eligible: EligibleItem[]; totalCandidates: number }> {
  const supabase = createClient();

  const { data: links, error: linksErr } = await supabase
    .from('collateral_loan_links')
    .select('id, collateral_id, loan_account_id, beneficiary_name, allocated_amount, charge_rank')
    .eq('status', 'ACTIVE');
  if (linksErr) throw linksErr;
  if (!links || links.length === 0) return { eligible: [], totalCandidates: 0 };

  const { data: charges, error: chargesErr } = await supabase
    .from('charge_registry')
    .select('collateral_id, loan_account_id, charge_rank, registry_name, discharge_number, status')
    .in('registry_name', registryFilter.length > 0 ? registryFilter : ['__none__']);
  if (chargesErr) throw chargesErr;

  const chargeMap = new Map<string, { registryName: string; dischargeNumber: string | null; status: string }>();
  (charges ?? []).forEach((c: any) => {
    chargeMap.set(`${c.collateral_id}:${c.loan_account_id}:${c.charge_rank}`, {
      registryName: c.registry_name,
      dischargeNumber: c.discharge_number,
      status: c.status,
    });
  });

  const collateralIds = [...new Set(links.map((l: any) => l.collateral_id))];
  const { data: collaterals } = await supabase
    .from('collateral_records')
    .select('id, collateral_id')
    .in('id', collateralIds.length > 0 ? collateralIds : ['00000000-0000-0000-0000-000000000000']);
  const colMap = new Map((collaterals ?? []).map((c: any) => [c.id, c.collateral_id]));

  let totalCandidates = 0;
  const eligible: EligibleItem[] = [];
  for (const link of links) {
    const charge = chargeMap.get(`${link.collateral_id}:${link.loan_account_id}:${link.charge_rank}`);
    if (!charge) continue; // not tracked against any of the target registries
    totalCandidates++;
    if (requireDischargeNumber && (!charge.dischargeNumber || charge.status !== 'DISCHARGED')) continue;

    eligible.push({
      linkId: link.id,
      loanAccountId: link.loan_account_id,
      beneficiaryName: link.beneficiary_name ?? 'Unknown',
      collateralId: colMap.get(link.collateral_id) ?? link.collateral_id,
      collateralRecordId: link.collateral_id,
      allocatedAmount: parseFloat(link.allocated_amount) || 0,
      registry: charge.registryName,
    });
  }

  return { eligible, totalCandidates };
}

// ─── Validation ───────────────────────────────────────────────────────────────

export async function runPreExecutionValidation(job: ScheduledJob): Promise<ValidationResult> {
  const checks: ValidationCheck[] = [];
  const warnings: string[] = [];

  checks.push({
    id: 'schedule-config',
    label: 'Schedule Configuration',
    status: 'PASS',
    detail: `${job.frequency} at ${job.runTime}${job.frequency === 'WEEKLY' ? ` on ${job.dayOfWeek}` : ''}`,
  });

  const registryOk = job.registryFilter.length > 0;
  checks.push({
    id: 'registry-filter',
    label: 'Registry Filter',
    status: registryOk ? 'PASS' : 'FAIL',
    detail: registryOk ? `Targeting: ${job.registryFilter.join(', ')}` : 'No registries selected',
  });

  checks.push({
    id: 'discharge-req',
    label: 'Discharge Number Requirement',
    status: job.requireDischargeNumber ? 'PASS' : 'WARN',
    detail: job.requireDischargeNumber
      ? 'Only releases items the registry has already confirmed discharged'
      : 'Discharge confirmation not required — this will release items with no registry confirmation on file',
  });
  if (!job.requireDischargeNumber) warnings.push('Discharge confirmation not enforced — this can release collateral the registry never confirmed as discharged. Strongly recommended to keep this on.');

  let eligibleCount = 0;
  let totalCandidates = 0;
  let estimatedEquityRelease = 0;
  if (registryOk) {
    try {
      const result = await getEligibleItems(job.registryFilter, job.requireDischargeNumber);
      eligibleCount = result.eligible.length;
      totalCandidates = result.totalCandidates;
      estimatedEquityRelease = result.eligible.reduce((s, i) => s + i.allocatedAmount, 0);
      checks.push({
        id: 'eligible-items',
        label: 'Eligible Items Found',
        status: eligibleCount > 0 ? 'PASS' : 'WARN',
        detail: `${eligibleCount} of ${totalCandidates} candidate(s) tracked in these registries meet the release criteria`,
      });
    } catch (err: any) {
      checks.push({ id: 'eligible-items', label: 'Eligible Items Found', status: 'FAIL', detail: `Failed to query eligible items: ${err.message}` });
    }
  }

  const allPassed = checks.every((c) => c.status !== 'FAIL');

  return { passed: allPassed, checks, eligibleCount, totalCandidates, estimatedEquityRelease, warnings };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const scheduledJobService = {
  async getAll(): Promise<ScheduledJob[]> {
    const supabase = createClient();
    const { data: jobs, error } = await supabase
      .from('scheduled_release_jobs')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    if (!jobs || jobs.length === 0) return [];

    const { data: runs } = await supabase
      .from('scheduled_release_job_runs')
      .select('*')
      .in('job_id', jobs.map((j: any) => j.id))
      .order('run_at', { ascending: false });

    const lastRunByJob = new Map<string, any>();
    (runs ?? []).forEach((r: any) => {
      if (!lastRunByJob.has(r.job_id)) lastRunByJob.set(r.job_id, r);
    });

    return jobs.map((j: any) => {
      const lastRun = lastRunByJob.get(j.id);
      return rowToJob(j, lastRun ? rowToSummary(lastRun) : undefined);
    });
  },

  async create(payload: {
    name: string;
    description: string;
    frequency: ScheduleFrequency;
    runTime: string;
    dayOfWeek: DayOfWeek | null;
    registryFilter: string[];
    requireDischargeNumber: boolean;
    createdBy?: string;
  }): Promise<ScheduledJob> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('scheduled_release_jobs')
      .insert({
        name: payload.name,
        description: payload.description,
        frequency: payload.frequency,
        run_time: payload.runTime,
        day_of_week: payload.frequency === 'WEEKLY' ? payload.dayOfWeek : null,
        status: 'ACTIVE',
        registry_filter: payload.registryFilter,
        require_discharge_number: payload.requireDischargeNumber,
        created_by: payload.createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToJob(data);
  },

  async update(id: string, updates: Partial<{
    name: string;
    description: string;
    frequency: ScheduleFrequency;
    runTime: string;
    dayOfWeek: DayOfWeek | null;
    status: JobStatus;
    registryFilter: string[];
    requireDischargeNumber: boolean;
  }>): Promise<ScheduledJob> {
    const supabase = createClient();
    const row: any = {};
    if (updates.name !== undefined) row.name = updates.name;
    if (updates.description !== undefined) row.description = updates.description;
    if (updates.frequency !== undefined) row.frequency = updates.frequency;
    if (updates.runTime !== undefined) row.run_time = updates.runTime;
    if (updates.dayOfWeek !== undefined) row.day_of_week = updates.dayOfWeek;
    if (updates.status !== undefined) row.status = updates.status;
    if (updates.registryFilter !== undefined) row.registry_filter = updates.registryFilter;
    if (updates.requireDischargeNumber !== undefined) row.require_discharge_number = updates.requireDischargeNumber;
    row.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('scheduled_release_jobs')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToJob(data);
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('scheduled_release_jobs').delete().eq('id', id);
    if (error) throw error;
  },

  /** Runs a job right now, on behalf of the given user, and records the outcome. */
  async runNow(job: ScheduledJob, userId: string | null): Promise<JobRunSummary> {
    const start = Date.now();
    const supabase = createClient();
    const { eligible } = await getEligibleItems(job.registryFilter, job.requireDischargeNumber);

    const today = new Date().toISOString().slice(0, 10);
    const items: ReleasedItem[] = [];
    let released = 0;
    let failed = 0;

    for (const item of eligible) {
      const result = await collateralLinkService.releaseLink(item.linkId, {
        releaseReason: 'LOAN_FULLY_REPAID',
        releaseDate: today,
      });
      if (result.success) {
        released++;
        items.push({ loanAccountId: item.loanAccountId, beneficiaryName: item.beneficiaryName, collateralId: item.collateralId, allocatedAmount: item.allocatedAmount, registry: item.registry, status: 'RELEASED' });
      } else {
        failed++;
        items.push({ loanAccountId: item.loanAccountId, beneficiaryName: item.beneficiaryName, collateralId: item.collateralId, allocatedAmount: item.allocatedAmount, registry: item.registry, status: 'FAILED', reason: result.error });
      }
    }

    const status: RunStatus = failed === 0 ? (released > 0 ? 'SUCCESS' : 'SUCCESS') : released === 0 ? 'FAILED' : 'PARTIAL';
    const durationSeconds = Math.round((Date.now() - start) / 1000);

    const { data: runRow, error: runErr } = await supabase
      .from('scheduled_release_job_runs')
      .insert({
        job_id: job.id,
        status,
        total_processed: eligible.length,
        released,
        failed,
        duration_seconds: durationSeconds,
        errors: items.filter((i) => i.status === 'FAILED').map((i) => `${i.loanAccountId}: ${i.reason}`),
        released_items: items,
        triggered_by: userId,
      })
      .select()
      .single();
    if (runErr) throw runErr;

    const { error: updateErr } = await supabase
      .from('scheduled_release_jobs')
      .update({
        last_run_at: runRow.run_at,
        total_runs: job.totalRuns + 1,
        success_runs: status === 'SUCCESS' ? job.successRuns + 1 : job.successRuns,
      })
      .eq('id', job.id);
    if (updateErr) console.error('scheduledJobService.runNow: failed to update job stats:', updateErr);

    return rowToSummary(runRow);
  },
};
