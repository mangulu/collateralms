'use client';

import { createClient } from '@/lib/supabase/client';

export interface Loan {
  id: string;
  loanNumber: string;
  obligorId: string;
  facilityType: string;
  facilityAmount: number;
  outstandingBalance: number | null;
  currency: string;
  interestRate: number | null;
  disbursementDate: string | null;
  maturityDate: string | null;
  repaymentFrequency: string;
  loanStatus: string;
  purpose: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  obligorName?: string;
  obligorCode?: string;
}

function rowToLoan(row: any): Loan {
  return {
    id: row.id,
    loanNumber: row.loan_number,
    obligorId: row.obligor_id,
    facilityType: row.facility_type,
    facilityAmount: row.facility_amount != null ? parseFloat(row.facility_amount) : 0,
    outstandingBalance: row.outstanding_balance != null ? parseFloat(row.outstanding_balance) : null,
    currency: row.currency ?? 'TZS',
    interestRate: row.interest_rate != null ? parseFloat(row.interest_rate) : null,
    disbursementDate: row.disbursement_date,
    maturityDate: row.maturity_date,
    repaymentFrequency: row.repayment_frequency ?? 'Monthly',
    loanStatus: row.loan_status ?? 'Active',
    purpose: row.purpose,
    notes: row.notes,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    obligorName: row.obligors?.full_name,
    obligorCode: row.obligors?.obligor_code,
  };
}

function loanToRow(data: Partial<Loan>): any {
  const row: any = {};
  if (data.loanNumber !== undefined) row.loan_number = data.loanNumber;
  if (data.obligorId !== undefined) row.obligor_id = data.obligorId;
  if (data.facilityType !== undefined) row.facility_type = data.facilityType;
  if (data.facilityAmount !== undefined) row.facility_amount = data.facilityAmount;
  if (data.outstandingBalance !== undefined) row.outstanding_balance = data.outstandingBalance;
  if (data.currency !== undefined) row.currency = data.currency;
  if (data.interestRate !== undefined) row.interest_rate = data.interestRate;
  if (data.disbursementDate !== undefined) row.disbursement_date = data.disbursementDate;
  if (data.maturityDate !== undefined) row.maturity_date = data.maturityDate;
  if (data.repaymentFrequency !== undefined) row.repayment_frequency = data.repaymentFrequency;
  if (data.loanStatus !== undefined) row.loan_status = data.loanStatus;
  if (data.purpose !== undefined) row.purpose = data.purpose;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  return row;
}

export const loanService = {
  async getAll(): Promise<Loan[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('loans')
      .select('*, obligors(full_name, obligor_code)')
      .order('created_at', { ascending: false });
    if (error) { console.error('loanService.getAll:', error.message); return []; }
    return (data ?? []).map(rowToLoan);
  },

  async getById(id: string): Promise<Loan | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('loans')
      .select('*, obligors(full_name, obligor_code)')
      .eq('id', id)
      .maybeSingle();
    if (error) { console.error('loanService.getById:', error.message); return null; }
    return data ? rowToLoan(data) : null;
  },

  async getByObligorId(obligorId: string): Promise<Loan[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('loans')
      .select('*, obligors(full_name, obligor_code)')
      .eq('obligor_id', obligorId)
      .order('created_at', { ascending: false });
    if (error) { console.error('loanService.getByObligorId:', error.message); return []; }
    return (data ?? []).map(rowToLoan);
  },

  async create(data: Partial<Loan>, userId: string): Promise<Loan | null> {
    const supabase = createClient();
    const row = loanToRow({ ...data, createdBy: userId });
    const { data: created, error } = await supabase
      .from('loans')
      .insert(row)
      .select('*, obligors(full_name, obligor_code)')
      .single();
    if (error) { console.error('loanService.create:', error.message); throw error; }
    return created ? rowToLoan(created) : null;
  },

  async update(id: string, data: Partial<Loan>): Promise<Loan | null> {
    const supabase = createClient();
    const row = loanToRow(data);
    const { data: updated, error } = await supabase
      .from('loans')
      .update(row)
      .eq('id', id)
      .select('*, obligors(full_name, obligor_code)')
      .single();
    if (error) { console.error('loanService.update:', error.message); throw error; }
    return updated ? rowToLoan(updated) : null;
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) { console.error('loanService.delete:', error.message); return false; }
    return true;
  },

  async generateLoanNumber(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('loans')
      .select('*', { count: 'exact', head: true });
    const next = ((count ?? 0) + 1).toString().padStart(4, '0');
    const year = new Date().getFullYear();
    return `TZ-LN-${year}-${next}`;
  },
};
