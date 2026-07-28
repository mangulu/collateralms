'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type CovenantType = 'Financial Ratio' | 'Insurance Requirement' | 'Reporting Obligation' | 'Operational' | 'Legal' | 'Other';
export type CovenantStatus = 'Active' | 'Breached' | 'Waived' | 'Expired';

export interface LoanCovenant {
  id: string;
  loanId: string;
  facilityId: string | null;
  covenantName: string;
  covenantType: CovenantType;
  description: string | null;
  thresholdValue: number | null;
  thresholdUnit: string | null;
  currentValue: number | null;
  measurementDate: string | null;
  nextReviewDate: string | null;
  covenantStatus: CovenantStatus;
  breachDate: string | null;
  breachNotes: string | null;
  waiverDate: string | null;
  waiverNotes: string | null;
  autoFlag: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // joined
  loanNumber?: string;
  obligorName?: string;
}

export interface CovenantBreachEntry {
  id: string;
  covenantId: string;
  breachDate: string;
  thresholdValue: number | null;
  actualValue: number | null;
  breachNotes: string | null;
  resolvedDate: string | null;
  resolvedBy: string | null;
  createdAt: string;
}

function rowToCovenant(row: any): LoanCovenant {
  return {
    id: row.id,
    loanId: row.loan_id,
    facilityId: row.facility_id,
    covenantName: row.covenant_name,
    covenantType: row.covenant_type,
    description: row.description,
    thresholdValue: row.threshold_value != null ? parseFloat(row.threshold_value) : null,
    thresholdUnit: row.threshold_unit,
    currentValue: row.current_value != null ? parseFloat(row.current_value) : null,
    measurementDate: row.measurement_date,
    nextReviewDate: row.next_review_date,
    covenantStatus: row.covenant_status,
    breachDate: row.breach_date,
    breachNotes: row.breach_notes,
    waiverDate: row.waiver_date,
    waiverNotes: row.waiver_notes,
    autoFlag: row.auto_flag ?? true,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    loanNumber: row.loans?.loan_number,
    obligorName: row.loans?.obligors?.full_name,
  };
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function listCovenants(filters?: {
  status?: CovenantStatus;
  loanId?: string;
}): Promise<LoanCovenant[]> {
  const supabase = createClient();
  let query = supabase
    .from('loan_covenants')
    .select('*, loans(loan_number, obligors(full_name))')
    .order('next_review_date', { ascending: true });

  if (filters?.status) query = query.eq('covenant_status', filters.status);
  if (filters?.loanId) query = query.eq('loan_id', filters.loanId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToCovenant);
}

export async function createCovenant(payload: {
  loanId: string;
  facilityId?: string;
  covenantName: string;
  covenantType: CovenantType;
  description?: string;
  thresholdValue?: number;
  thresholdUnit?: string;
  nextReviewDate?: string;
  autoFlag?: boolean;
  createdBy?: string;
}): Promise<LoanCovenant> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('loan_covenants')
    .insert({
      loan_id: payload.loanId,
      facility_id: payload.facilityId,
      covenant_name: payload.covenantName,
      covenant_type: payload.covenantType,
      description: payload.description,
      threshold_value: payload.thresholdValue,
      threshold_unit: payload.thresholdUnit,
      next_review_date: payload.nextReviewDate,
      auto_flag: payload.autoFlag ?? true,
      created_by: payload.createdBy,
      covenant_status: 'Active',
    })
    .select('*, loans(loan_number, obligors(full_name))')
    .single();
  if (error) throw error;
  return rowToCovenant(data);
}

export async function updateCovenantMeasurement(
  id: string,
  payload: {
    currentValue: number;
    measurementDate: string;
    notes?: string;
  }
): Promise<LoanCovenant> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('loan_covenants')
    .update({
      current_value: payload.currentValue,
      measurement_date: payload.measurementDate,
      breach_notes: payload.notes,
    })
    .eq('id', id)
    .select('*, loans(loan_number, obligors(full_name))')
    .single();
  if (error) throw error;
  return rowToCovenant(data);
}

export async function waiveCovenant(
  id: string,
  waiverNotes: string
): Promise<LoanCovenant> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('loan_covenants')
    .update({
      covenant_status: 'Waived',
      waiver_date: new Date().toISOString().split('T')[0],
      waiver_notes: waiverNotes,
    })
    .eq('id', id)
    .select('*, loans(loan_number, obligors(full_name))')
    .single();
  if (error) throw error;
  return rowToCovenant(data);
}

export async function getCovenantStats(): Promise<{
  total: number;
  active: number;
  breached: number;
  waived: number;
  expired: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('loan_covenants')
    .select('covenant_status');
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((r) => r.covenant_status === 'Active').length,
    breached: rows.filter((r) => r.covenant_status === 'Breached').length,
    waived: rows.filter((r) => r.covenant_status === 'Waived').length,
    expired: rows.filter((r) => r.covenant_status === 'Expired').length,
  };
}
