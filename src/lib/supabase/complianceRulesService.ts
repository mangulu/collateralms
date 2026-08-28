import { createClient } from '@/lib/supabase/client';

export interface ComplianceRuleDB {
  id: string;
  rule_name: string;
  rule_type: 'LTV' | 'DEADLINE' | 'ELIGIBILITY';
  condition: { field: string; operator: string; value: number | string };
  action: 'BLOCK' | 'WARN' | 'LOG';
  message: string;
  is_active: boolean;
  triggered_count: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateComplianceRuleInput {
  rule_name: string;
  rule_type: 'LTV' | 'DEADLINE' | 'ELIGIBILITY';
  condition: { field: string; operator: string; value: number | string };
  action: 'BLOCK' | 'WARN' | 'LOG';
  message: string;
  is_active?: boolean;
}

export interface UpdateComplianceRuleInput extends Partial<CreateComplianceRuleInput> {
  triggered_count?: number;
}

export const complianceRulesService = {
  async fetchAll(): Promise<ComplianceRuleDB[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('compliance_rules')
      .select('*')
      .order('created_at', { ascending: true });
    if (error) throw error;
    return data ?? [];
  },

  async create(input: CreateComplianceRuleInput): Promise<ComplianceRuleDB> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('compliance_rules')
      .insert([{ ...input, is_active: input.is_active ?? true }])
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, input: UpdateComplianceRuleInput): Promise<ComplianceRuleDB> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('compliance_rules')
      .update({ ...input, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async toggleActive(id: string, isActive: boolean): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('compliance_rules')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('compliance_rules')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
