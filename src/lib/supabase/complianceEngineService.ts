'use client';

import { createClient } from '@/lib/supabase/client';
import { complianceRulesService, type ComplianceRuleDB } from '@/lib/supabase/complianceRulesService';

// ─── Field → data-source mapping ───────────────────────────────────────────────
// Mirrors the field options offered when creating a rule in
// src/app/compliance-rules/components/ComplianceRulesContent.tsx.

type Severity = 'Critical' | 'High' | 'Medium' | 'Low';
type SubjectKey = 'collateral_record_id' | 'obligor_id';

const DEADLINE_FIELD_REGISTRY: Record<string, string> = {
  days_to_brela_deadline: 'BRELA',
  days_to_lands_deadline: 'Lands Registry',
  days_to_tra_deadline: 'TRA',
  days_to_dse_deadline: 'DSE',
  days_to_tasac_deadline: 'TASAC',
};

const LTV_FIELDS = new Set(['ltv_ratio', 'collateral_utilization']);

function deriveSeverity(action: string, ruleType: string): Severity {
  if (action === 'BLOCK') return 'Critical';
  if (action === 'WARN' && ruleType === 'LTV') return 'High';
  if (action === 'WARN') return 'Medium';
  return 'Low';
}

function compare(actual: number, operator: string, threshold: number): boolean {
  switch (operator) {
    case '>': return actual > threshold;
    case '>=': return actual >= threshold;
    case '<': return actual < threshold;
    case '<=': return actual <= threshold;
    case '=': return actual === threshold;
    default: return false;
  }
}

function monthsBetween(fromISO: string, to: Date): number {
  const from = new Date(fromISO);
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

function yearsBetween(fromISO: string, to: Date): number {
  const from = new Date(fromISO);
  let years = to.getFullYear() - from.getFullYear();
  const monthDiff = to.getMonth() - from.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && to.getDate() < from.getDate())) years--;
  return years;
}

interface BreachCandidate {
  ruleId: string;
  ruleName: string;
  ruleType: string;
  action: string;
  severity: Severity;
  field: string;
  operator: string;
  thresholdValue: string;
  triggerValue: string;
  collateralRecordId: string | null;
  collateralId: string | null;
  collateralRef: string | null;
  collateralType: string | null;
  obligorId: string | null;
  obligorName: string | null;
  message: string | null;
}

async function upsertBreach(supabase: ReturnType<typeof createClient>, c: BreachCandidate): Promise<'created' | 'exists'> {
  let existingQuery = supabase.from('compliance_breaches').select('id').eq('rule_id', c.ruleId).eq('status', 'Open');
  existingQuery = c.collateralRecordId
    ? existingQuery.eq('collateral_record_id', c.collateralRecordId)
    : existingQuery.eq('obligor_id', c.obligorId).is('collateral_record_id', null);
  const { data: existing } = await existingQuery.maybeSingle();
  if (existing) return 'exists';

  const { error } = await supabase.from('compliance_breaches').insert({
    rule_id: c.ruleId,
    rule_name: c.ruleName,
    rule_type: c.ruleType,
    action: c.action,
    severity: c.severity,
    field: c.field,
    operator: c.operator,
    threshold_value: c.thresholdValue,
    trigger_value: c.triggerValue,
    collateral_record_id: c.collateralRecordId,
    collateral_id: c.collateralId,
    collateral_ref: c.collateralRef,
    collateral_type: c.collateralType,
    obligor_id: c.obligorId,
    obligor_name: c.obligorName,
    message: c.message,
    status: 'Open',
  });
  if (error) {
    // A concurrent run may have inserted the same open breach first — the
    // partial unique indexes on compliance_breaches make that a no-op, not
    // a real failure.
    if (error.code === '23505') return 'exists';
    console.error('complianceEngineService.upsertBreach:', error.message);
    return 'exists';
  }
  return 'created';
}

async function resolveStale(supabase: ReturnType<typeof createClient>, ruleId: string, stillBreaching: Set<string>, subjectKey: SubjectKey) {
  const { data: open } = await supabase
    .from('compliance_breaches')
    .select('id, collateral_record_id, obligor_id')
    .eq('rule_id', ruleId)
    .eq('status', 'Open');
  for (const b of open ?? []) {
    const subjectId = subjectKey === 'collateral_record_id' ? b.collateral_record_id : b.obligor_id;
    if (subjectId && !stillBreaching.has(subjectId)) {
      await supabase.from('compliance_breaches').update({ status: 'Resolved', resolved_at: new Date().toISOString() }).eq('id', b.id);
    }
  }
}

async function obligorNameMap(supabase: ReturnType<typeof createClient>, obligorIds: (string | null)[]): Promise<Map<string, string>> {
  const ids = [...new Set(obligorIds.filter((id): id is string => !!id))];
  if (ids.length === 0) return new Map();
  const { data } = await supabase.from('obligors').select('id, full_name').in('id', ids);
  return new Map((data ?? []).map((o: any) => [o.id, o.full_name as string]));
}

async function bumpTriggeredCount(supabase: ReturnType<typeof createClient>, rule: ComplianceRuleDB, by: number) {
  if (by <= 0) return;
  await supabase.from('compliance_rules').update({ triggered_count: (rule.triggered_count ?? 0) + by }).eq('id', rule.id);
}

// ─── Per-field evaluators ───────────────────────────────────────────────────────

async function evaluateLtvRule(supabase: ReturnType<typeof createClient>, rule: ComplianceRuleDB) {
  const { data: collaterals } = await supabase
    .from('collateral_records')
    .select('id, collateral_id, description, collateral_type, ltv_ratio, obligor_ref_id')
    .not('ltv_ratio', 'is', null);
  const rows = collaterals ?? [];
  const names = await obligorNameMap(supabase, rows.map((r: any) => r.obligor_ref_id));
  const threshold = Number(rule.condition.value);
  const breaching = new Set<string>();
  let created = 0;
  for (const c of rows as any[]) {
    const actual = Number(c.ltv_ratio) * 100;
    if (!compare(actual, rule.condition.operator, threshold)) continue;
    breaching.add(c.id);
    const result = await upsertBreach(supabase, {
      ruleId: rule.id, ruleName: rule.rule_name, ruleType: rule.rule_type, action: rule.action,
      severity: deriveSeverity(rule.action, rule.rule_type),
      field: rule.condition.field, operator: rule.condition.operator,
      thresholdValue: `${threshold}%`, triggerValue: `${actual.toFixed(1)}%`,
      collateralRecordId: c.id, collateralId: c.collateral_id, collateralRef: c.description, collateralType: c.collateral_type,
      obligorId: c.obligor_ref_id ?? null, obligorName: c.obligor_ref_id ? names.get(c.obligor_ref_id) ?? null : null,
      message: rule.message,
    });
    if (result === 'created') created++;
  }
  await resolveStale(supabase, rule.id, breaching, 'collateral_record_id');
  return created;
}

// Collateral Utilization % is genuinely distinct from LTV Ratio: it's how
// much of a collateral's max securable amount is currently pledged across
// all active loan links (collateralLinkService.getUtilization() computes
// the same figure per-collateral), not the stored ltv_ratio policy figure.
async function evaluateUtilizationRule(supabase: ReturnType<typeof createClient>, rule: ComplianceRuleDB) {
  const { data: collaterals } = await supabase
    .from('collateral_records')
    .select('id, collateral_id, description, collateral_type, max_securable_amount, obligor_ref_id')
    .not('max_securable_amount', 'is', null)
    .gt('max_securable_amount', 0);
  const rows = collaterals ?? [];
  if (rows.length === 0) return 0;

  const { data: links } = await supabase
    .from('collateral_loan_links')
    .select('collateral_id, allocated_amount')
    .eq('status', 'ACTIVE')
    .in('collateral_id', rows.map((r: any) => r.id));

  const securedByCollateral = new Map<string, number>();
  for (const l of links ?? []) {
    securedByCollateral.set(l.collateral_id, (securedByCollateral.get(l.collateral_id) ?? 0) + (parseFloat(l.allocated_amount) || 0));
  }

  const names = await obligorNameMap(supabase, rows.map((r: any) => r.obligor_ref_id));
  const threshold = Number(rule.condition.value);
  const breaching = new Set<string>();
  let created = 0;
  for (const c of rows as any[]) {
    const secured = securedByCollateral.get(c.id) ?? 0;
    const maxSecurable = Number(c.max_securable_amount);
    const actual = (secured / maxSecurable) * 100;
    if (!compare(actual, rule.condition.operator, threshold)) continue;
    breaching.add(c.id);
    const result = await upsertBreach(supabase, {
      ruleId: rule.id, ruleName: rule.rule_name, ruleType: rule.rule_type, action: rule.action,
      severity: deriveSeverity(rule.action, rule.rule_type),
      field: rule.condition.field, operator: rule.condition.operator,
      thresholdValue: `${threshold}%`, triggerValue: `${actual.toFixed(1)}%`,
      collateralRecordId: c.id, collateralId: c.collateral_id, collateralRef: c.description, collateralType: c.collateral_type,
      obligorId: c.obligor_ref_id ?? null, obligorName: c.obligor_ref_id ? names.get(c.obligor_ref_id) ?? null : null,
      message: rule.message,
    });
    if (result === 'created') created++;
  }
  await resolveStale(supabase, rule.id, breaching, 'collateral_record_id');
  return created;
}

async function evaluateDeadlineRule(supabase: ReturnType<typeof createClient>, rule: ComplianceRuleDB) {
  const registry = DEADLINE_FIELD_REGISTRY[rule.condition.field];
  if (!registry) return 0;
  const { data: collaterals } = await supabase
    .from('collateral_records')
    .select('id, collateral_id, description, collateral_type, days_to_deadline, obligor_ref_id')
    .eq('registry', registry)
    .eq('requires_perfection', true)
    .neq('status', 'Perfected')
    .not('days_to_deadline', 'is', null);
  const rows = collaterals ?? [];
  const names = await obligorNameMap(supabase, rows.map((r: any) => r.obligor_ref_id));
  const threshold = Number(rule.condition.value);
  const breaching = new Set<string>();
  let created = 0;
  for (const c of rows as any[]) {
    const actual = Number(c.days_to_deadline);
    if (!compare(actual, rule.condition.operator, threshold)) continue;
    breaching.add(c.id);
    const result = await upsertBreach(supabase, {
      ruleId: rule.id, ruleName: rule.rule_name, ruleType: rule.rule_type, action: rule.action,
      severity: deriveSeverity(rule.action, rule.rule_type),
      field: rule.condition.field, operator: rule.condition.operator,
      thresholdValue: `${threshold} days`, triggerValue: `${actual} days`,
      collateralRecordId: c.id, collateralId: c.collateral_id, collateralRef: c.description, collateralType: c.collateral_type,
      obligorId: c.obligor_ref_id ?? null, obligorName: c.obligor_ref_id ? names.get(c.obligor_ref_id) ?? null : null,
      message: rule.message,
    });
    if (result === 'created') created++;
  }
  await resolveStale(supabase, rule.id, breaching, 'collateral_record_id');
  return created;
}

async function evaluateValuationAgeRule(supabase: ReturnType<typeof createClient>, rule: ComplianceRuleDB) {
  const { data: collaterals } = await supabase
    .from('collateral_records')
    .select('id, collateral_id, description, collateral_type, valuation_date, registration_date, obligor_ref_id');
  const rows = collaterals ?? [];
  const names = await obligorNameMap(supabase, rows.map((r: any) => r.obligor_ref_id));
  const threshold = Number(rule.condition.value);
  const breaching = new Set<string>();
  const now = new Date();
  let created = 0;
  for (const c of rows as any[]) {
    const baseDate = c.valuation_date ?? c.registration_date;
    if (!baseDate) continue;
    const actual = monthsBetween(baseDate, now);
    if (!compare(actual, rule.condition.operator, threshold)) continue;
    breaching.add(c.id);
    const result = await upsertBreach(supabase, {
      ruleId: rule.id, ruleName: rule.rule_name, ruleType: rule.rule_type, action: rule.action,
      severity: deriveSeverity(rule.action, rule.rule_type),
      field: rule.condition.field, operator: rule.condition.operator,
      thresholdValue: `${threshold} months`, triggerValue: `${actual} months`,
      collateralRecordId: c.id, collateralId: c.collateral_id, collateralRef: c.description, collateralType: c.collateral_type,
      obligorId: c.obligor_ref_id ?? null, obligorName: c.obligor_ref_id ? names.get(c.obligor_ref_id) ?? null : null,
      message: rule.message,
    });
    if (result === 'created') created++;
  }
  await resolveStale(supabase, rule.id, breaching, 'collateral_record_id');
  return created;
}

async function evaluateCustomerRelationshipRule(supabase: ReturnType<typeof createClient>, rule: ComplianceRuleDB) {
  const { data: obligors } = await supabase.from('obligors').select('id, full_name, created_at');
  const rows = obligors ?? [];
  const threshold = Number(rule.condition.value);
  const breaching = new Set<string>();
  const now = new Date();
  let created = 0;
  for (const o of rows as any[]) {
    if (!o.created_at) continue;
    const actual = yearsBetween(o.created_at, now);
    if (!compare(actual, rule.condition.operator, threshold)) continue;
    breaching.add(o.id);
    const result = await upsertBreach(supabase, {
      ruleId: rule.id, ruleName: rule.rule_name, ruleType: rule.rule_type, action: rule.action,
      severity: deriveSeverity(rule.action, rule.rule_type),
      field: rule.condition.field, operator: rule.condition.operator,
      thresholdValue: `${threshold} years`, triggerValue: `${actual} years`,
      collateralRecordId: null, collateralId: null, collateralRef: null, collateralType: null,
      obligorId: o.id, obligorName: o.full_name ?? null,
      message: rule.message,
    });
    if (result === 'created') created++;
  }
  await resolveStale(supabase, rule.id, breaching, 'obligor_id');
  return created;
}

async function evaluateRule(supabase: ReturnType<typeof createClient>, rule: ComplianceRuleDB): Promise<number> {
  const field = rule.condition.field;
  if (field === 'ltv_ratio') return evaluateLtvRule(supabase, rule);
  if (field === 'collateral_utilization') return evaluateUtilizationRule(supabase, rule);
  if (field in DEADLINE_FIELD_REGISTRY) return evaluateDeadlineRule(supabase, rule);
  if (field === 'valuation_age_months') return evaluateValuationAgeRule(supabase, rule);
  if (field === 'customer_relationship_years') return evaluateCustomerRelationshipRule(supabase, rule);
  return 0;
}

// ─── Public API ─────────────────────────────────────────────────────────────────

export interface EngineRunResult {
  rulesEvaluated: number;
  breachesCreated: number;
}

export const complianceEngineService = {
  /** Evaluate every active compliance rule against all live data. Safe to run repeatedly. */
  async runFullSweep(): Promise<EngineRunResult> {
    const supabase = createClient();
    const rules = (await complianceRulesService.fetchAll()).filter((r) => r.is_active);
    let breachesCreated = 0;
    for (const rule of rules) {
      const created = await evaluateRule(supabase, rule);
      breachesCreated += created;
      await bumpTriggeredCount(supabase, rule, created);
    }
    return { rulesEvaluated: rules.length, breachesCreated };
  },

  /**
   * Evaluate only the collateral-scoped rules against one collateral record.
   * Call this right after a collateral create/update so breaches surface
   * immediately instead of waiting for the next full sweep.
   */
  async runForCollateral(collateralRecordId: string): Promise<EngineRunResult> {
    const supabase = createClient();
    const rules = (await complianceRulesService.fetchAll()).filter(
      (r) => r.is_active && (LTV_FIELDS.has(r.condition.field) || r.condition.field in DEADLINE_FIELD_REGISTRY || r.condition.field === 'valuation_age_months')
    );
    if (rules.length === 0) return { rulesEvaluated: 0, breachesCreated: 0 };

    const { data: c } = await supabase
      .from('collateral_records')
      .select('id, collateral_id, description, collateral_type, ltv_ratio, max_securable_amount, days_to_deadline, registry, requires_perfection, status, valuation_date, registration_date, obligor_ref_id')
      .eq('id', collateralRecordId)
      .maybeSingle();
    if (!c) return { rulesEvaluated: 0, breachesCreated: 0 };

    const needsUtilization = rules.some((r) => r.condition.field === 'collateral_utilization');
    let securedAmount = 0;
    if (needsUtilization) {
      const { data: links } = await supabase
        .from('collateral_loan_links')
        .select('allocated_amount')
        .eq('collateral_id', collateralRecordId)
        .eq('status', 'ACTIVE');
      securedAmount = (links ?? []).reduce((sum: number, l: any) => sum + (parseFloat(l.allocated_amount) || 0), 0);
    }

    const names = await obligorNameMap(supabase, [c.obligor_ref_id]);
    const obligorName = c.obligor_ref_id ? names.get(c.obligor_ref_id) ?? null : null;
    const now = new Date();
    let breachesCreated = 0;

    for (const rule of rules) {
      const threshold = Number(rule.condition.value);
      let actual: number | null = null;
      let triggerValue = '';
      let thresholdValue = '';

      if (rule.condition.field === 'ltv_ratio') {
        if (c.ltv_ratio == null) continue;
        actual = Number(c.ltv_ratio) * 100;
        triggerValue = `${actual.toFixed(1)}%`; thresholdValue = `${threshold}%`;
      } else if (rule.condition.field === 'collateral_utilization') {
        if (!c.max_securable_amount) continue;
        actual = (securedAmount / Number(c.max_securable_amount)) * 100;
        triggerValue = `${actual.toFixed(1)}%`; thresholdValue = `${threshold}%`;
      } else if (rule.condition.field in DEADLINE_FIELD_REGISTRY) {
        if (c.registry !== DEADLINE_FIELD_REGISTRY[rule.condition.field] || !c.requires_perfection || c.status === 'Perfected' || c.days_to_deadline == null) continue;
        actual = Number(c.days_to_deadline);
        triggerValue = `${actual} days`; thresholdValue = `${threshold} days`;
      } else if (rule.condition.field === 'valuation_age_months') {
        const baseDate = c.valuation_date ?? c.registration_date;
        if (!baseDate) continue;
        actual = monthsBetween(baseDate, now);
        triggerValue = `${actual} months`; thresholdValue = `${threshold} months`;
      }

      if (actual == null || !compare(actual, rule.condition.operator, threshold)) continue;

      const result = await upsertBreach(supabase, {
        ruleId: rule.id, ruleName: rule.rule_name, ruleType: rule.rule_type, action: rule.action,
        severity: deriveSeverity(rule.action, rule.rule_type),
        field: rule.condition.field, operator: rule.condition.operator, thresholdValue, triggerValue,
        collateralRecordId: c.id, collateralId: c.collateral_id, collateralRef: c.description, collateralType: c.collateral_type,
        obligorId: c.obligor_ref_id ?? null, obligorName,
        message: rule.message,
      });
      if (result === 'created') {
        breachesCreated++;
        await bumpTriggeredCount(supabase, rule, 1);
      }
    }
    return { rulesEvaluated: rules.length, breachesCreated };
  },
};
