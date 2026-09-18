import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// ============================================================
// Cron-triggered scheduled report delivery.
// Called by a Postgres pg_cron job (see the accompanying
// migration) once a day; checks every enabled
// scheduled_report_configs row and sends the ones actually due
// today, using the same real send-report-email edge function
// the manual "Send Now" button uses.
//
// Requires two server-only env vars this route does not
// validate the presence of anywhere else:
//   SUPABASE_SERVICE_ROLE_KEY -- from Supabase dashboard, Settings > API.
//     Needed because this route has no user session (RLS on these
//     tables requires the 'authenticated' role); never expose this
//     key to the client.
//   CRON_SECRET -- shared secret the pg_cron job sends as a Bearer
//     token; must match the value baked into the migration.
// ============================================================

/** Minimal 5-field cron matcher (minute hour dom month dow) -- supports '*', a single number, or a comma list. */
function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;
  return field.split(',').map(Number).includes(value);
}

function cronMatchesNow(cronExpr: string, now: Date): boolean {
  const parts = cronExpr.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  const [minute, hour, dom, month, dow] = parts;
  return (
    fieldMatches(minute, now.getUTCMinutes()) &&
    fieldMatches(hour, now.getUTCHours()) &&
    fieldMatches(dom, now.getUTCDate()) &&
    fieldMatches(month, now.getUTCMonth() + 1) &&
    fieldMatches(dow, now.getUTCDay())
  );
}

function getPeriodLabel(reportType: string, now: Date): string {
  if (reportType === 'weekly_perfection_summary') {
    const weekStart = new Date(now);
    weekStart.setUTCDate(now.getUTCDate() - now.getUTCDay() + 1);
    return `Week of ${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })}`;
  }
  return now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' });
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
  const results: { configId: string; reportLabel: string; sent: number; failed: number; skipped?: string }[] = [];

  try {
    const { data: configs, error: cfgErr } = await supabase
      .from('scheduled_report_configs')
      .select('*')
      .eq('is_enabled', true);
    if (cfgErr) throw cfgErr;

    for (const cfg of configs ?? []) {
      if (!cronMatchesNow(cfg.schedule_cron, now)) continue;
      if (isSameUtcDate(cfg.last_sent_at, now)) {
        results.push({ configId: cfg.id, reportLabel: cfg.report_label, sent: 0, failed: 0, skipped: 'already sent today' });
        continue;
      }
      if (!Array.isArray(cfg.recipients) || cfg.recipients.length === 0) {
        results.push({ configId: cfg.id, reportLabel: cfg.report_label, sent: 0, failed: 0, skipped: 'no recipients configured' });
        continue;
      }

      let status: 'sent' | 'partial' | 'failed' = 'failed';
      let sent = 0;
      let failedCount = 0;
      let errorMessage: string | undefined;
      let reportSummary: Record<string, string | number> = {};

      try {
        const { data: collaterals } = await supabase
          .from('collateral_records')
          .select('status, ltv_ratio, valuation_amount');
        const total = collaterals?.length ?? 0;
        const perfected = collaterals?.filter((c) => c.status === 'Perfected').length ?? 0;
        const overdue = collaterals?.filter((c) => c.status === 'Overdue').length ?? 0;
        const totalValue = collaterals?.reduce((s, c) => s + (parseFloat(c.valuation_amount) || 0), 0) ?? 0;
        reportSummary = {
          'Total Collateral Records': total,
          'Perfected': perfected,
          'Perfection Rate': total > 0 ? `${((perfected / total) * 100).toFixed(1)}%` : '0%',
          'Overdue Items': overdue,
          'Total Portfolio Value': `TZS ${(totalValue / 1e9).toFixed(2)}B`,
        };

        const { data: sendResult, error: invokeErr } = await supabase.functions.invoke('send-report-email', {
          body: {
            to: cfg.recipients,
            reportType: cfg.report_type,
            reportLabel: cfg.report_label,
            period: getPeriodLabel(cfg.report_type, now),
            reportSummary,
          },
        });
        if (invokeErr) throw invokeErr;

        sent = sendResult?.sent ?? 0;
        failedCount = sendResult?.failed ?? 0;
        status = sendResult?.success ? 'sent' : sent > 0 ? 'partial' : 'failed';
      } catch (err: any) {
        errorMessage = err.message ?? 'Unknown error';
      }

      await supabase.from('scheduled_report_deliveries').insert({
        config_id: cfg.id,
        report_type: cfg.report_type,
        report_label: cfg.report_label,
        recipient_count: cfg.recipients.length,
        recipients: cfg.recipients,
        status,
        error_message: errorMessage ?? null,
        report_summary: reportSummary,
        triggered_by: null, // system/cron, not a user
      });
      await supabase.from('scheduled_report_configs').update({ last_sent_at: now.toISOString() }).eq('id', cfg.id);

      results.push({ configId: cfg.id, reportLabel: cfg.report_label, sent, failed: failedCount });
    }

    return NextResponse.json({ checked: configs?.length ?? 0, results });
  } catch (err: any) {
    console.error('send-scheduled-reports cron error:', err);
    return NextResponse.json({ error: err.message ?? 'Unknown error' }, { status: 500 });
  }
}
