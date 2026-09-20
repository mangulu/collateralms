'use client';

import { createClient } from '@/lib/supabase/client';

export interface CollateralOption {
  id: string;
  collateralId: string;
  description: string;
  type: string;
  facilityId: string;
  loanId: string | null;
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
  loanId: string;
}

export const workflowLookupsService = {
  async getCollateralOptions(): Promise<CollateralOption[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('collateral_records')
      .select('id, collateral_id, description, collateral_type, facility_id, loan_id, obligor')
      .order('created_at', { ascending: false });
    if (error) { console.error('workflowLookupsService.getCollateralOptions:', error.message); return []; }
    return (data ?? []).map((row) => ({
      id: row.id,
      collateralId: row.collateral_id,
      description: row.description,
      type: row.collateral_type,
      facilityId: row.facility_id,
      loanId: row.loan_id ?? null,
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

  // A "facility" IS a loan — derive facility options from the real loans table
  // (keyed by loan.id) rather than deduping collateral_records' free-text
  // facility_id, which drifts from the actual loan whenever it's edited by hand.
  deriveFacilityOptions(loans: LoanOption[]): FacilityOption[] {
    return loans.map((l) => ({ facilityId: l.loanNumber, label: l.loanNumber, loanId: l.id }));
  },
};
