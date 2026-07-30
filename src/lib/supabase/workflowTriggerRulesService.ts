'use client';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowTriggerEvent =
  | 'collateral_status_change' |'days_since_submission' |'value_threshold' |'ltv_breach' |'days_overdue' |'document_count_change';

export type WorkflowTriggerOperator =
  | 'equals' |'not_equals' |'greater_than' |'less_than' |'greater_than_or_equal' |'less_than_or_equal';

export type WorkflowTriggerStatus = 'active' | 'inactive' | 'draft';

export interface WorkflowTriggerCondition {
  id: string;
  ruleId: string;
  eventType: WorkflowTriggerEvent;
  operator: WorkflowTriggerOperator;
  conditionValue: string;
  conditionValueTo: string | null;
  sortOrder: number;
  createdAt: string;
}

export interface WorkflowTriggerRule {
  id: string;
  templateId: string;
  name: string;
  description: string;
  triggerStatus: WorkflowTriggerStatus;
  conditionLogic: 'AND' | 'OR';
  referenceType: string;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  conditions: WorkflowTriggerCondition[];
}

// ─── Labels & Metadata ────────────────────────────────────────────────────────

export const TRIGGER_EVENT_LABELS: Record<WorkflowTriggerEvent, string> = {
  collateral_status_change: 'Collateral Status Change',
  days_since_submission: 'Days Since Submission',
  value_threshold: 'Collateral Value Threshold',
  ltv_breach: 'LTV Ratio Breach',
  days_overdue: 'Days Overdue',
  document_count_change: 'Document Count Change',
};

export const TRIGGER_EVENT_DESCRIPTIONS: Record<WorkflowTriggerEvent, string> = {
  collateral_status_change: 'Triggers when collateral status changes to a specific value',
  days_since_submission: 'Triggers after a set number of days from submission date',
  value_threshold: 'Triggers when collateral value crosses a defined threshold (TZS)',
  ltv_breach: 'Triggers when LTV ratio exceeds a defined percentage',
  days_overdue: 'Triggers when a collateral item is overdue by N days',
  document_count_change: 'Triggers when the number of attached documents changes',
};

export const TRIGGER_OPERATOR_LABELS: Record<WorkflowTriggerOperator, string> = {
  equals: 'equals',
  not_equals: 'does not equal',
  greater_than: 'is greater than',
  less_than: 'is less than',
  greater_than_or_equal: 'is at least',
  less_than_or_equal: 'is at most',
};

export const COLLATERAL_STATUS_OPTIONS = [
  { value: 'active', label: 'Active' },
  { value: 'pending', label: 'Pending' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'released', label: 'Released' },
  { value: 'expired', label: 'Expired' },
  { value: 'impaired', label: 'Impaired' },
];

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function rowToCondition(row: any): WorkflowTriggerCondition {
  return {
    id: row.id,
    ruleId: row.rule_id,
    eventType: row.event_type,
    operator: row.operator,
    conditionValue: row.condition_value,
    conditionValueTo: row.condition_value_to,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

function rowToRule(row: any, conditions: WorkflowTriggerCondition[] = []): WorkflowTriggerRule {
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    description: row.description ?? '',
    triggerStatus: row.trigger_status,
    conditionLogic: row.condition_logic,
    referenceType: row.reference_type,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    conditions,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const workflowTriggerRulesService = {
  async getAll(): Promise<WorkflowTriggerRule[]> {
    const supabase = createClient();
    const { data: rulesData, error } = await supabase
      .from('workflow_trigger_rules')
      .select('*')
      .order('created_at');
    if (error) throw error;
    const rules = rulesData ?? [];
    if (rules.length === 0) return [];
    const ruleIds = rules.map((r: any) => r.id);
    const { data: condData } = await supabase
      .from('workflow_trigger_conditions')
      .select('*')
      .in('rule_id', ruleIds)
      .order('sort_order');
    const conditions = (condData ?? []).map(rowToCondition);
    return rules.map((r: any) =>
      rowToRule(r, conditions.filter((c) => c.ruleId === r.id))
    );
  },

  async getByTemplateId(templateId: string): Promise<WorkflowTriggerRule[]> {
    const supabase = createClient();
    const { data: rulesData, error } = await supabase
      .from('workflow_trigger_rules')
      .select('*')
      .eq('template_id', templateId)
      .order('created_at');
    if (error) throw error;
    const rules = rulesData ?? [];
    if (rules.length === 0) return [];
    const ruleIds = rules.map((r: any) => r.id);
    const { data: condData } = await supabase
      .from('workflow_trigger_conditions')
      .select('*')
      .in('rule_id', ruleIds)
      .order('sort_order');
    const conditions = (condData ?? []).map(rowToCondition);
    return rules.map((r: any) =>
      rowToRule(r, conditions.filter((c) => c.ruleId === r.id))
    );
  },

  async create(payload: {
    templateId: string;
    name: string;
    description: string;
    conditionLogic: 'AND' | 'OR';
    referenceType: string;
    createdBy: string;
    conditions: Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>[];
  }): Promise<WorkflowTriggerRule> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workflow_trigger_rules')
      .insert({
        template_id: payload.templateId,
        name: payload.name,
        description: payload.description,
        condition_logic: payload.conditionLogic,
        reference_type: payload.referenceType,
        trigger_status: 'active',
        created_by: payload.createdBy,
        updated_by: payload.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    const rule = rowToRule(data, []);
    if (payload.conditions.length > 0) {
      const condRows = payload.conditions.map((c, i) => ({
        rule_id: rule.id,
        event_type: c.eventType,
        operator: c.operator,
        condition_value: c.conditionValue,
        condition_value_to: c.conditionValueTo ?? null,
        sort_order: i + 1,
      }));
      const { data: condData, error: condErr } = await supabase
        .from('workflow_trigger_conditions')
        .insert(condRows)
        .select();
      if (condErr) throw condErr;
      rule.conditions = (condData ?? []).map(rowToCondition);
    }
    return rule;
  },

  async update(
    ruleId: string,
    payload: {
      name?: string;
      description?: string;
      conditionLogic?: 'AND' | 'OR';
      triggerStatus?: WorkflowTriggerStatus;
      updatedBy?: string;
      conditions?: Omit<WorkflowTriggerCondition, 'id' | 'ruleId' | 'createdAt'>[];
    }
  ): Promise<void> {
    const supabase = createClient();
    const updateFields: any = {};
    if (payload.name !== undefined) updateFields.name = payload.name;
    if (payload.description !== undefined) updateFields.description = payload.description;
    if (payload.conditionLogic !== undefined) updateFields.condition_logic = payload.conditionLogic;
    if (payload.triggerStatus !== undefined) updateFields.trigger_status = payload.triggerStatus;
    if (payload.updatedBy) updateFields.updated_by = payload.updatedBy;

    if (Object.keys(updateFields).length > 0) {
      const { error } = await supabase
        .from('workflow_trigger_rules')
        .update(updateFields)
        .eq('id', ruleId);
      if (error) throw error;
    }

    if (payload.conditions !== undefined) {
      // Replace all conditions
      await supabase.from('workflow_trigger_conditions').delete().eq('rule_id', ruleId);
      if (payload.conditions.length > 0) {
        const condRows = payload.conditions.map((c, i) => ({
          rule_id: ruleId,
          event_type: c.eventType,
          operator: c.operator,
          condition_value: c.conditionValue,
          condition_value_to: c.conditionValueTo ?? null,
          sort_order: i + 1,
        }));
        const { error: condErr } = await supabase
          .from('workflow_trigger_conditions')
          .insert(condRows);
        if (condErr) throw condErr;
      }
    }
  },

  async delete(ruleId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('workflow_trigger_rules')
      .delete()
      .eq('id', ruleId);
    if (error) throw error;
  },

  async toggleStatus(ruleId: string, currentStatus: WorkflowTriggerStatus, updatedBy: string): Promise<void> {
    const newStatus: WorkflowTriggerStatus = currentStatus === 'active' ? 'inactive' : 'active';
    const supabase = createClient();
    const { error } = await supabase
      .from('workflow_trigger_rules')
      .update({ trigger_status: newStatus, updated_by: updatedBy })
      .eq('id', ruleId);
    if (error) throw error;
  },
};
