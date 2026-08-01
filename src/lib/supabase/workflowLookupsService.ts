'use client';

import { createClient } from '@/lib/supabase/client';

export interface CollateralOption {
  id: string;
  collateralId: string;
  description: string;
  type: string;
  facilityId: string;
  obligor: string;
}

export interface LoanOption {
  id: string;
  loanNumber: string;
  facilityType: string;
  obligorName: string;
  loanStatus: string;
  facilityAmount: number;
  currency: string;
}

export interface FacilityOption {
  facilityId: string;
  label: string;
}

export const workflowLookupsService = {
  async getCollateralOptions(): Promise<CollateralOption[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('collateral_records')
      .select('id, collateral_id, description, collateral_type, facility_id, obligor')
      .order('created_at', { ascending: false });
    if (error) { console.error('workflowLookupsService.getCollateralOptions:', error.message); return []; }
    return (data ?? []).map((row) => ({
      id: row.id,
      collateralId: row.collateral_id,
      description: row.description,
      type: row.collateral_type,
      facilityId: row.facility_id,
      obligor: row.obligor,
    }));
  },

  async getLoanOptions(): Promise<LoanOption[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('loans')
      .select('id, loan_number, facility_type, outstanding_balance, facility_amount, currency, loan_status, obligors(full_name)')
      .order('created_at', { ascending: false });
    if (error) { console.error('workflowLookupsService.getLoanOptions:', error.message); return []; }
    return (data ?? []).map((row: any) => ({
      id: row.id,
      loanNumber: row.loan_number,
      facilityType: row.facility_type,
      obligorName: row.obligors?.full_name ?? '—',
      loanStatus: row.loan_status ?? 'Active',
      facilityAmount: row.facility_amount != null ? parseFloat(row.facility_amount) : 0,
      currency: row.currency ?? 'TZS',
    }));
  },

  deriveFacilityOptions(collaterals: CollateralOption[]): FacilityOption[] {
    const seen = new Set<string>();
    const result: FacilityOption[] = [];
    for (const c of collaterals) {
      if (c.facilityId && !seen.has(c.facilityId)) {
        seen.add(c.facilityId);
        result.push({ facilityId: c.facilityId, label: c.facilityId });
      }
    }
    return result;
  },
};
