'use client';

import { createClient } from '@/lib/supabase/client';

export type BreachStatus = 'Open' | 'Resolved';
export type BreachSeverity = 'Critical' | 'High' | 'Medium' | 'Low';

export interface ComplianceBreach {
  id: string;
  ruleId: string;
  ruleName: string;
  ruleType: 'LTV' | 'DEADLINE' | 'ELIGIBILITY';
  action: 'BLOCK' | 'WARN' | 'LOG';
  severity: BreachSeverity;
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
  status: BreachStatus;
  breachedAt: string;
  resolvedAt: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

function rowToBreach(row: any): ComplianceBreach {
  return {
    id: row.id,
    ruleId: row.rule_id,
    ruleName: row.rule_name,
    ruleType: row.rule_type,
    action: row.action,
    severity: row.severity,
    field: row.field,
    operator: row.operator,
    thresholdValue: row.threshold_value,
    triggerValue: row.trigger_value,
    collateralRecordId: row.collateral_record_id,
    collateralId: row.collateral_id,
    collateralRef: row.collateral_ref,
    collateralType: row.collateral_type,
    obligorId: row.obligor_id,
    obligorName: row.obligor_name,
    message: row.message,
    status: row.status,
    breachedAt: row.breached_at,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    createdAt: row.created_at,
  };
}

export const complianceBreachService = {
  async list(filters?: { status?: BreachStatus }): Promise<ComplianceBreach[]> {
    const supabase = createClient();
    let query = supabase.from('compliance_breaches').select('*').order('breached_at', { ascending: false });
    if (filters?.status) query = query.eq('status', filters.status);
    const { data, error } = await query;
    if (error) { console.error('complianceBreachService.list:', error.message); return []; }
    return (data ?? []).map(rowToBreach);
  },

  async resolve(id: string, userId: string): Promise<ComplianceBreach | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('compliance_breaches')
      .update({ status: 'Resolved', resolved_at: new Date().toISOString(), resolved_by: userId })
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('complianceBreachService.resolve:', error.message); return null; }
    return data ? rowToBreach(data) : null;
  },
};
