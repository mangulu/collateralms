'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type InsuranceStatus = 'Active' | 'Expiring Soon' | 'Expired' | 'Cancelled' | 'Pending Renewal';

export interface CollateralInsurance {
  id: string;
  collateralId: string;
  policyNumber: string;
  insurerName: string;
  coverageType: string;
  coverageAmount: number;
  currency: string;
  premiumAmount: number | null;
  premiumFrequency: string;
  policyStartDate: string;
  policyEndDate: string;
  renewalDate: string | null;
  insuranceStatus: InsuranceStatus;
  beneficiary: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  certificateRef: string | null;
  notes: string | null;
  expiryAlertSent: boolean;
  renewalAlertSent: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // joined
  collateralDescription?: string;
  collateralType?: string;
  daysToExpiry?: number;
}

function rowToInsurance(row: any): CollateralInsurance {
  const endDate = row.policy_end_date ? new Date(row.policy_end_date) : null;
  const today = new Date();
  const daysToExpiry = endDate
    ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : undefined;

  return {
    id: row.id,
    collateralId: row.collateral_id,
    policyNumber: row.policy_number,
    insurerName: row.insurer_name,
    coverageType: row.coverage_type ?? 'Comprehensive',
    coverageAmount: row.coverage_amount != null ? parseFloat(row.coverage_amount) : 0,
    currency: row.currency ?? 'TZS',
    premiumAmount: row.premium_amount != null ? parseFloat(row.premium_amount) : null,
    premiumFrequency: row.premium_frequency ?? 'Annual',
    policyStartDate: row.policy_start_date,
    policyEndDate: row.policy_end_date,
    renewalDate: row.renewal_date,
    insuranceStatus: row.insurance_status,
    beneficiary: row.beneficiary,
    contactPerson: row.contact_person,
    contactPhone: row.contact_phone,
    contactEmail: row.contact_email,
    certificateRef: row.certificate_ref,
    notes: row.notes,
    expiryAlertSent: row.expiry_alert_sent ?? false,
    renewalAlertSent: row.renewal_alert_sent ?? false,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    collateralDescription: row.collateral_records?.description,
    collateralType: row.collateral_records?.collateral_type,
    daysToExpiry,
  };
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function listInsurancePolicies(filters?: {
  status?: InsuranceStatus;
  collateralId?: string;
}): Promise<CollateralInsurance[]> {
  const supabase = createClient();
  let query = supabase
    .from('collateral_insurance')
    .select('*, collateral_records(description, collateral_type)')
    .order('policy_end_date', { ascending: true });

  if (filters?.status) query = query.eq('insurance_status', filters.status);
  if (filters?.collateralId) query = query.eq('collateral_id', filters.collateralId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToInsurance);
}

export async function createInsurancePolicy(payload: {
  collateralId: string;
  policyNumber: string;
  insurerName: string;
  coverageType: string;
  coverageAmount: number;
  currency?: string;
  premiumAmount?: number;
  premiumFrequency?: string;
  policyStartDate: string;
  policyEndDate: string;
  renewalDate?: string;
  beneficiary?: string;
  contactPerson?: string;
  contactPhone?: string;
  contactEmail?: string;
  certificateRef?: string;
  notes?: string;
  createdBy?: string;
}): Promise<CollateralInsurance> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_insurance')
    .insert({
      collateral_id: payload.collateralId,
      policy_number: payload.policyNumber,
      insurer_name: payload.insurerName,
      coverage_type: payload.coverageType,
      coverage_amount: payload.coverageAmount,
      currency: payload.currency ?? 'TZS',
      premium_amount: payload.premiumAmount,
      premium_frequency: payload.premiumFrequency ?? 'Annual',
      policy_start_date: payload.policyStartDate,
      policy_end_date: payload.policyEndDate,
      renewal_date: payload.renewalDate,
      beneficiary: payload.beneficiary,
      contact_person: payload.contactPerson,
      contact_phone: payload.contactPhone,
      contact_email: payload.contactEmail,
      certificate_ref: payload.certificateRef,
      notes: payload.notes,
      created_by: payload.createdBy,
    })
    .select('*, collateral_records(description, collateral_type)')
    .single();
  if (error) throw error;
  return rowToInsurance(data);
}

export async function updateInsurancePolicy(
  id: string,
  payload: Partial<{
    policyNumber: string;
    insurerName: string;
    coverageType: string;
    coverageAmount: number;
    premiumAmount: number;
    policyStartDate: string;
    policyEndDate: string;
    renewalDate: string;
    insuranceStatus: InsuranceStatus;
    notes: string;
  }>
): Promise<CollateralInsurance> {
  const supabase = createClient();
  const row: any = {};
  if (payload.policyNumber !== undefined) row.policy_number = payload.policyNumber;
  if (payload.insurerName !== undefined) row.insurer_name = payload.insurerName;
  if (payload.coverageType !== undefined) row.coverage_type = payload.coverageType;
  if (payload.coverageAmount !== undefined) row.coverage_amount = payload.coverageAmount;
  if (payload.premiumAmount !== undefined) row.premium_amount = payload.premiumAmount;
  if (payload.policyStartDate !== undefined) row.policy_start_date = payload.policyStartDate;
  if (payload.policyEndDate !== undefined) row.policy_end_date = payload.policyEndDate;
  if (payload.renewalDate !== undefined) row.renewal_date = payload.renewalDate;
  if (payload.insuranceStatus !== undefined) row.insurance_status = payload.insuranceStatus;
  if (payload.notes !== undefined) row.notes = payload.notes;

  const { data, error } = await supabase
    .from('collateral_insurance')
    .update(row)
    .eq('id', id)
    .select('*, collateral_records(description, collateral_type)')
    .single();
  if (error) throw error;
  return rowToInsurance(data);
}

export async function getInsuranceStats(): Promise<{
  total: number;
  active: number;
  expiringSoon: number;
  expired: number;
  pendingRenewal: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_insurance')
    .select('insurance_status');
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    active: rows.filter((r) => r.insurance_status === 'Active').length,
    expiringSoon: rows.filter((r) => r.insurance_status === 'Expiring Soon').length,
    expired: rows.filter((r) => r.insurance_status === 'Expired').length,
    pendingRenewal: rows.filter((r) => r.insurance_status === 'Pending Renewal').length,
  };
}
