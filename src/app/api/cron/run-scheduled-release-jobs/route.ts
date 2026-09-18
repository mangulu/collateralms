import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Cron-triggered scheduled batch release.
// Called by a Postgres pg_cron job (see the accompanying
// migration) once a day; for every ACTIVE scheduled_release_jobs
// row due today, releases whichever collateral_loan_links rows are
// genuinely eligible: ACTIVE, with a matching charge_registry entry
// in one of the job's target registries, already confirmed
// discharged by that registry (unless the job explicitly disabled
// that check). This mirrors the manual "Run Now" path exactly
// (scheduledJobService.runNow), just running with a service-role
// client instead of a user's browser session.
//
// Requires SUPABASE_SERVICE_ROLE_KEY and CRON_SECRET env vars --
// see supabase/migrations/20260918080000_scheduled_report_cron.sql
// for how those are set up; this route reuses the same two.
// ============================================================

function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  return field.split(',').map(Number).includes(value);
}

const DAY_INDEX: Record<string, number> = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };

function isJobDueNow(job: { frequency: string; run_time: string; day_of_week: string | null }, now: Date): boolean {
  // The cron itself fires once an hour, on the hour, so match on hour
  // only rather than requiring exact-minute alignment.
  const [h] = job.run_time.split(':').map(Number);
  if (now.getUTCHours() !== h) return false;
  if (job.frequency === 'WEEKLY') {
    const targetDay = DAY_INDEX[job.day_of_week ?? 'MON'];
    return now.getUTCDay() === targetDay;
  }
  return true;
}

function isSameUtcDate(a: string | null, b: Date): boolean {
  if (!a) return false;
  const d = new Date(a);
  return d.getUTCFullYear() === b.getUTCFullYear() && d.getUTCMonth() === b.getUTCMonth() && d.getUTCDate() === b.getUTCDate();
}

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = request.headers.get('authorization');
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey || !process.env.NEXT_PUBLIC_SUPABASE_URL) {
    return NextResponse.json({ error: 'Server misconfigured: missing SUPABASE_SERVICE_ROLE_KEY' }, { status: 500 });
  }
  const supabase = createSupabaseClient(process.env.NEXT_PUBLIC_SUPABASE_URL, serviceRoleKey);

  const now = new Date();
  const results: { jobId: string; name: string; released: number; failed: number; skipped?: string }[] = [];

  try {
    const { data: jobs, error: jobsErr } = await supabase
      .from('scheduled_release_jobs')
      .select('*')
      .eq('status', 'ACTIVE');
    if (jobsErr) throw jobsErr;

    for (const job of jobs ?? []) {
      if (!isJobDueNow(job, now)) continue;
      if (isSameUtcDate(job.last_run_at, now)) {
        results.push({ jobId: job.id, name: job.name, released: 0, failed: 0, skipped: 'already ran today' });
        continue;
      }

      const start = Date.now();

      const { data: links, error: linksErr } = await supabase
        .from('collateral_loan_links')
        .select('id, collateral_id, loan_account_id, beneficiary_name, allocated_amount, charge_rank')
        .eq('status', 'ACTIVE');
      if (linksErr) {
        results.push({ jobId: job.id, name: job.name, released: 0, failed: 0, skipped: `link query failed: ${linksErr.message}` });
        continue;
      }

      const registryFilter: string[] = job.registry_filter ?? [];
      const { data: charges } = await supabase
        .from('charge_registry')
        .select('collateral_id, loan_account_id, charge_rank, registry_name, discharge_number, status')
        .in('registry_name', registryFilter.length > 0 ? registryFilter : ['__none__']);

      const chargeMap = new Map<string, any>();
      (charges ?? []).forEach((c: any) => chargeMap.set(`${c.collateral_id}:${c.loan_account_id}:${c.charge_rank}`, c));

      const collateralIds = [...new Set((links ?? []).map((l: any) => l.collateral_id))];
      const { data: collaterals } = await supabase
        .from('collateral_records')
        .select('id, collateral_id')
        .in('id', collateralIds.length > 0 ? collateralIds : ['00000000-0000-0000-0000-000000000000']);
      const colMap = new Map((collaterals ?? []).map((c: any) => [c.id, c.collateral_id]));

      const eligible = (links ?? []).filter((link: any) => {
        const charge = chargeMap.get(`${link.collateral_id}:${link.loan_account_id}:${link.charge_rank}`);
        if (!charge) return false;
        if (job.require_discharge_number && (!charge.discharge_number || charge.status !== 'DISCHARGED')) return false;
        return true;
      }).map((link: any) => ({
        link,
        registry: chargeMap.get(`${link.collateral_id}:${link.loan_account_id}:${link.charge_rank}`)?.registry_name,
      }));

      const today = now.toISOString().slice(0, 10);
      const releasedItems: any[] = [];
      let released = 0;
      let failed = 0;

      for (const { link, registry } of eligible) {
        const { error: releaseErr } = await supabase
          .from('collateral_loan_links')
          .update({ status: 'RELEASED', release_date: today, release_reason: 'LOAN_FULLY_REPAID', end_date: today })
          .eq('id', link.id);

        if (releaseErr) {
          failed++;
          releasedItems.push({ loanAccountId: link.loan_account_id, beneficiaryName: link.beneficiary_name, collateralId: colMap.get(link.collateral_id) ?? link.collateral_id, allocatedAmount: parseFloat(link.allocated_amount) || 0, registry, status: 'FAILED', reason: releaseErr.message });
          continue;
        }

        // Recalculate utilization on the collateral record (mirrors collateralLinkService.releaseLink)
        const { data: activeLinks } = await supabase
          .from('collateral_loan_links')
          .select('allocated_amount')
          .eq('collateral_id', link.collateral_id)
          .eq('status', 'ACTIVE');
        const totalSecured = (activeLinks ?? []).reduce((s: number, l: any) => s + (parseFloat(l.allocated_amount) || 0), 0);
        const { data: collateralRow } = await supabase
          .from('collateral_records')
          .select('max_securable_amount')
          .eq('id', link.collateral_id)
          .maybeSingle();
        const maxSecurable = parseFloat(collateralRow?.max_securable_amount ?? 0) || 0;
        await supabase
          .from('collateral_records')
          .update({ total_secured_amount: totalSecured, available_equity: Math.max(0, maxSecurable - totalSecured) })
          .eq('id', link.collateral_id);

        released++;
        releasedItems.push({ loanAccountId: link.loan_account_id, beneficiaryName: link.beneficiary_name, collateralId: colMap.get(link.collateral_id) ?? link.collateral_id, allocatedAmount: parseFloat(link.allocated_amount) || 0, registry, status: 'RELEASED' });
      }

      const status = failed === 0 ? 'SUCCESS' : released === 0 ? 'FAILED' : 'PARTIAL';
      const durationSeconds = Math.round((Date.now() - start) / 1000);

      const { data: runRow } = await supabase
        .from('scheduled_release_job_runs')
        .insert({
          job_id: job.id,
          status,
          total_processed: eligible.length,
          released,
          failed,
          duration_seconds: durationSeconds,
          errors: releasedItems.filter((i) => i.status === 'FAILED').map((i) => `${i.loanAccountId}: ${i.reason}`),
          released_items: releasedItems,
          triggered_by: null,
        })
        .select()
        .single();

      await supabase
        .from('scheduled_release_jobs')
        .update({
          last_run_at: runRow?.run_at ?? now.toISOString(),
          total_runs: job.total_runs + 1,
          success_runs: status === 'SUCCESS' ? job.success_runs + 1 : job.success_runs,
        })
        .eq('id', job.id);

      results.push({ jobId: job.id, name: job.name, released, failed });
    }

    return NextResponse.json({ checked: jobs?.length ?? 0, results });
  } catch (err: any) {
    console.error('run-scheduled-release-jobs cron error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
