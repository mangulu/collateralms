import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TriggerCondition {
  id: string;
  rule_id: string;
  event_type: string;
  operator: string;
  condition_value: string;
  condition_value_to: string | null;
  sort_order: number;
}

interface TriggerRule {
  id: string;
  template_id: string;
  name: string;
  trigger_status: string;
  condition_logic: 'AND' | 'OR';
  reference_type: string;
  conditions: TriggerCondition[];
}

interface CollateralRow {
  id: string;
  collateral_description: string | null;
  status: string | null;
  created_at: string;
  current_value: number | null;
  ltv_ratio: number | null;
  document_count?: number;
}

interface RuleResult {
  ruleId: string;
  ruleName: string;
  templateId: string;
  matched: number;
  created: number;
  skipped: number;
  errors: string[];
}

// ─── Operator Evaluator ───────────────────────────────────────────────────────

function evaluate(
  actual: number | string | null,
  operator: string,
  expected: string,
  expectedTo?: string | null
): boolean {
  if (actual === null || actual === undefined) return false;

  const numActual = typeof actual === 'number' ? actual : parseFloat(String(actual));
  const numExpected = parseFloat(expected);

  switch (operator) {
    case 'equals':
      return String(actual).toLowerCase() === expected.toLowerCase();
    case 'not_equals':
      return String(actual).toLowerCase() !== expected.toLowerCase();
    case 'greater_than':
      return !isNaN(numActual) && !isNaN(numExpected) && numActual > numExpected;
    case 'less_than':
      return !isNaN(numActual) && !isNaN(numExpected) && numActual < numExpected;
    case 'greater_than_or_equal':
      return !isNaN(numActual) && !isNaN(numExpected) && numActual >= numExpected;
    case 'less_than_or_equal':
      return !isNaN(numActual) && !isNaN(numExpected) && numActual <= numExpected;
    default:
      return false;
  }
}

// ─── Condition Evaluator per event type ──────────────────────────────────────

function evaluateCondition(cond: TriggerCondition, collateral: CollateralRow): boolean {
  switch (cond.event_type) {
    case 'collateral_status_change':
      return evaluate(collateral.status, cond.operator, cond.condition_value);

    case 'days_since_submission': {
      const submittedAt = new Date(collateral.created_at);
      const daysSince = Math.floor((Date.now() - submittedAt.getTime()) / 86400000);
      return evaluate(daysSince, cond.operator, cond.condition_value);
    }

    case 'value_threshold':
      return evaluate(collateral.current_value, cond.operator, cond.condition_value);

    case 'ltv_breach':
      return evaluate(collateral.ltv_ratio, cond.operator, cond.condition_value);

    case 'days_overdue': {
      const submittedAt = new Date(collateral.created_at);
      const daysOverdue = Math.floor((Date.now() - submittedAt.getTime()) / 86400000);
      return evaluate(daysOverdue, cond.operator, cond.condition_value);
    }

    case 'document_count_change':
      return evaluate(collateral.document_count ?? 0, cond.operator, cond.condition_value);

    default:
      return false;
  }
}

// ─── Rule Evaluator ───────────────────────────────────────────────────────────

function evaluateRule(rule: TriggerRule, collateral: CollateralRow): boolean {
  if (rule.conditions.length === 0) return false;
  const results = rule.conditions.map((c) => evaluateCondition(c, collateral));
  return rule.condition_logic === 'AND'
    ? results.every(Boolean)
    : results.some(Boolean);
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  const startTime = Date.now();

  // Validate secret header for cron/scheduler calls
  const authHeader = req.headers.get('x-trigger-secret');
  const expectedSecret = process.env.WORKFLOW_TRIGGER_SECRET ?? 'workflow-trigger-secret';
  if (authHeader !== expectedSecret) {
    // Also allow calls from the app itself (no secret needed for manual runs from UI)
    const isManual = req.headers.get('x-trigger-source') === 'manual';
    if (!isManual) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  const triggeredBy = req.headers.get('x-trigger-source') === 'manual' ? 'manual' : 'scheduler';

  // Use service-role key for server-side operations
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  // ── Create job log entry ──────────────────────────────────────────────────
  const { data: logEntry, error: logErr } = await supabase
    .from('workflow_trigger_job_log')
    .insert({ triggered_by: triggeredBy, status: 'running' })
    .select()
    .single();

  if (logErr || !logEntry) {
    return NextResponse.json({ error: 'Failed to create job log', detail: logErr?.message }, { status: 500 });
  }

  const logId = logEntry.id;
  const ruleResults: RuleResult[] = [];
  const globalErrors: string[] = [];

  let totalRulesEvaluated = 0;
  let totalRulesMatched = 0;
  let totalInstancesCreated = 0;
  let totalInstancesSkipped = 0;
  let totalErrors = 0;

  try {
    // ── 1. Load all active trigger rules with conditions ──────────────────
    const { data: rulesData, error: rulesErr } = await supabase
      .from('workflow_trigger_rules')
      .select('*')
      .eq('trigger_status', 'active');

    if (rulesErr) throw new Error(`Failed to load trigger rules: ${rulesErr.message}`);
    if (!rulesData || rulesData.length === 0) {
      await finalizeLog(supabase, logId, 'success', 0, 0, 0, 0, 0, [], startTime);
      return NextResponse.json({ message: 'No active trigger rules found', instancesCreated: 0 });
    }

    // Load conditions for all rules
    const ruleIds = rulesData.map((r: any) => r.id);
    const { data: condData } = await supabase
      .from('workflow_trigger_conditions')
      .select('*')
      .in('rule_id', ruleIds)
      .order('sort_order');

    const rules: TriggerRule[] = rulesData.map((r: any) => ({
      ...r,
      conditions: (condData ?? []).filter((c: any) => c.rule_id === r.id),
    }));

    totalRulesEvaluated = rules.length;

    // ── 2. Load collaterals (with document counts) ────────────────────────
    const { data: collaterals, error: colErr } = await supabase
      .from('collateral_records')
      .select('id, collateral_description, status, created_at, current_value, ltv_ratio');

    if (colErr) throw new Error(`Failed to load collaterals: ${colErr.message}`);
    const collateralList: CollateralRow[] = collaterals ?? [];

    // Load document counts per collateral
    const { data: docCounts } = await supabase
      .from('collateral_documents')
      .select('collateral_id')
      .in('collateral_id', collateralList.map((c) => c.id));

    const docCountMap: Record<string, number> = {};
    (docCounts ?? []).forEach((d: any) => {
      docCountMap[d.collateral_id] = (docCountMap[d.collateral_id] ?? 0) + 1;
    });

    collateralList.forEach((c) => {
      c.document_count = docCountMap[c.id] ?? 0;
    });

    // ── 3. Load existing active instances to avoid duplicates ─────────────
    const { data: existingInstances } = await supabase
      .from('workflow_instances')
      .select('template_id, reference_id, instance_status')
      .in('instance_status', ['active', 'on_hold', 'escalated']);

    // Set of "templateId:referenceId" that already have an active instance
    const activeInstanceKeys = new Set<string>(
      (existingInstances ?? []).map((i: any) => `${i.template_id}:${i.reference_id}`)
    );

    // ── 4. Load template first steps for instance creation ────────────────
    const templateIds = [...new Set(rules.map((r) => r.template_id))];
    const { data: firstSteps } = await supabase
      .from('workflow_steps')
      .select('id, template_id, step_order, sla_hours')
      .in('template_id', templateIds)
      .eq('step_order', 1);

    const firstStepMap: Record<string, any> = {};
    (firstSteps ?? []).forEach((s: any) => {
      firstStepMap[s.template_id] = s;
    });

    // ── 5. Evaluate each rule against each collateral ─────────────────────
    for (const rule of rules) {
      const result: RuleResult = {
        ruleId: rule.id,
        ruleName: rule.name,
        templateId: rule.template_id,
        matched: 0,
        created: 0,
        skipped: 0,
        errors: [],
      };

      // Only process collateral reference types
      if (rule.reference_type !== 'collateral') {
        ruleResults.push(result);
        continue;
      }

      for (const collateral of collateralList) {
        try {
          const matches = evaluateRule(rule, collateral);
          if (!matches) continue;

          result.matched++;
          totalRulesMatched++;

          const instanceKey = `${rule.template_id}:${collateral.id}`;
          if (activeInstanceKeys.has(instanceKey)) {
            result.skipped++;
            totalInstancesSkipped++;
            continue;
          }

          // Create workflow instance
          const firstStep = firstStepMap[rule.template_id];
          const { data: newInstance, error: instErr } = await supabase
            .from('workflow_instances')
            .insert({
              template_id: rule.template_id,
              reference_type: 'collateral',
              reference_id: collateral.id,
              reference_label: collateral.collateral_description ?? collateral.id,
              current_step_id: firstStep?.id ?? null,
              instance_status: 'active',
              started_by: null, // system-initiated
              metadata: {
                triggered_by_rule: rule.id,
                triggered_by_rule_name: rule.name,
                auto_triggered: true,
                trigger_source: triggeredBy,
              },
              due_at: firstStep?.sla_hours
                ? new Date(Date.now() + firstStep.sla_hours * 3600000).toISOString()
                : null,
            })
            .select()
            .single();

          if (instErr || !newInstance) {
            result.errors.push(`Collateral ${collateral.id}: ${instErr?.message ?? 'Unknown error'}`);
            totalErrors++;
            continue;
          }

          // Mark as active so we don't create duplicates within this run
          activeInstanceKeys.add(instanceKey);

          // Create instance step records
          const { data: allSteps } = await supabase
            .from('workflow_steps')
            .select('id, step_order, sla_hours')
            .eq('template_id', rule.template_id)
            .order('step_order');

          if (allSteps && allSteps.length > 0) {
            const instanceStepRows = allSteps.map((s: any, i: number) => ({
              instance_id: newInstance.id,
              step_id: s.id,
              step_status: i === 0 ? 'active' : 'pending',
              started_at: i === 0 ? new Date().toISOString() : null,
              due_at:
                i === 0 && s.sla_hours
                  ? new Date(Date.now() + s.sla_hours * 3600000).toISOString()
                  : null,
            }));
            await supabase.from('workflow_instance_steps').insert(instanceStepRows);
          }

          // Log transition
          await supabase.from('workflow_transition_log').insert({
            instance_id: newInstance.id,
            action: 'auto_triggered',
            performed_by: null,
            performed_by_name: 'System',
            performed_by_role: 'Trigger Processor',
            comment: `Auto-triggered by rule: "${rule.name}"`,
            to_step_id: firstStep?.id ?? null,
          });

          result.created++;
          totalInstancesCreated++;
        } catch (err: any) {
          result.errors.push(`Collateral ${collateral.id}: ${err?.message ?? 'Unknown error'}`);
          totalErrors++;
        }
      }

      ruleResults.push(result);
    }

    // ── 6. Finalize log ───────────────────────────────────────────────────
    const finalStatus =
      totalErrors === 0
        ? 'success'
        : totalInstancesCreated > 0
        ? 'partial' :'failed';

    await finalizeLog(
      supabase,
      logId,
      finalStatus,
      totalRulesEvaluated,
      totalRulesMatched,
      totalInstancesCreated,
      totalInstancesSkipped,
      totalErrors,
      globalErrors,
      startTime,
      ruleResults
    );

    return NextResponse.json({
      status: finalStatus,
      rulesEvaluated: totalRulesEvaluated,
      rulesMatched: totalRulesMatched,
      instancesCreated: totalInstancesCreated,
      instancesSkipped: totalInstancesSkipped,
      errors: totalErrors,
      durationMs: Date.now() - startTime,
      detail: ruleResults,
    });
  } catch (err: any) {
    globalErrors.push(err?.message ?? 'Unexpected error');
    await finalizeLog(
      supabase,
      logId,
      'failed',
      totalRulesEvaluated,
      totalRulesMatched,
      totalInstancesCreated,
      totalInstancesSkipped,
      totalErrors + 1,
      globalErrors,
      startTime,
      ruleResults
    );
    return NextResponse.json({ error: err?.message ?? 'Unexpected error' }, { status: 500 });
  }
}

// ─── GET: Fetch recent job logs ───────────────────────────────────────────────

export async function GET() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data, error } = await supabase
    .from('workflow_trigger_job_log')
    .select('*')
    .order('run_at', { ascending: false })
    .limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ logs: data ?? [] });
}

// ─── Helper: finalize log entry ───────────────────────────────────────────────

async function finalizeLog(
  supabase: ReturnType<typeof createClient>,
  logId: string,
  status: string,
  rulesEvaluated: number,
  rulesMatched: number,
  instancesCreated: number,
  instancesSkipped: number,
  errorsCount: number,
  errorMessages: string[],
  startTime: number,
  detail: RuleResult[] = []
) {
  await supabase
    .from('workflow_trigger_job_log')
    .update({
      status,
      rules_evaluated: rulesEvaluated,
      rules_matched: rulesMatched,
      instances_created: instancesCreated,
      instances_skipped: instancesSkipped,
      errors_count: errorsCount,
      error_messages: errorMessages,
      duration_ms: Date.now() - startTime,
      detail: detail,
      completed_at: new Date().toISOString(),
    })
    .eq('id', logId);
}
