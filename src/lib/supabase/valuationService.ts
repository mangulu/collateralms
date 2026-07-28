'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type ValuationStatus = 'Scheduled' | 'In Progress' | 'Completed' | 'Approved' | 'Rejected' | 'Overdue';

export interface CollateralValuation {
  id: string;
  collateralId: string;
  valuationType: string;
  scheduledDate: string;
  completedDate: string | null;
  valuationAmount: number | null;
  previousAmount: number | null;
  valuerName: string | null;
  valuerFirm: string | null;
  valuationMethod: string;
  reportReference: string | null;
  notes: string | null;
  valuationStatus: ValuationStatus;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  agingAlertSent: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // joined
  collateralDescription?: string;
  collateralType?: string;
  approvedByName?: string;
}

function rowToValuation(row: any): CollateralValuation {
  return {
    id: row.id,
    collateralId: row.collateral_id,
    valuationType: row.valuation_type ?? 'Full Valuation',
    scheduledDate: row.scheduled_date,
    completedDate: row.completed_date,
    valuationAmount: row.valuation_amount != null ? parseFloat(row.valuation_amount) : null,
    previousAmount: row.previous_amount != null ? parseFloat(row.previous_amount) : null,
    valuerName: row.valuer_name,
    valuerFirm: row.valuer_firm,
    valuationMethod: row.valuation_method ?? 'Market Value',
    reportReference: row.report_reference,
    notes: row.notes,
    valuationStatus: row.valuation_status,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    agingAlertSent: row.aging_alert_sent ?? false,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    collateralDescription: row.collateral_records?.description,
    collateralType: row.collateral_records?.collateral_type,
    approvedByName: row.user_profiles?.full_name,
  };
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function listValuations(filters?: {
  status?: ValuationStatus;
  collateralId?: string;
}): Promise<CollateralValuation[]> {
  const supabase = createClient();
  let query = supabase
    .from('collateral_valuations')
    .select('*, collateral_records(description, collateral_type), user_profiles!approved_by(full_name)')
    .order('scheduled_date', { ascending: false });

  if (filters?.status) query = query.eq('valuation_status', filters.status);
  if (filters?.collateralId) query = query.eq('collateral_id', filters.collateralId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToValuation);
}

export async function createValuation(payload: {
  collateralId: string;
  valuationType: string;
  scheduledDate: string;
  valuerName?: string;
  valuerFirm?: string;
  valuationMethod?: string;
  notes?: string;
  createdBy?: string;
}): Promise<CollateralValuation> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_valuations')
    .insert({
      collateral_id: payload.collateralId,
      valuation_type: payload.valuationType,
      scheduled_date: payload.scheduledDate,
      valuer_name: payload.valuerName,
      valuer_firm: payload.valuerFirm,
      valuation_method: payload.valuationMethod ?? 'Market Value',
      notes: payload.notes,
      created_by: payload.createdBy,
      valuation_status: 'Scheduled',
    })
    .select('*, collateral_records(description, collateral_type)')
    .single();
  if (error) throw error;
  return rowToValuation(data);
}

export async function recordValuationResult(
  id: string,
  payload: {
    completedDate: string;
    valuationAmount: number;
    reportReference?: string;
    notes?: string;
  }
): Promise<CollateralValuation> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_valuations')
    .update({
      completed_date: payload.completedDate,
      valuation_amount: payload.valuationAmount,
      report_reference: payload.reportReference,
      notes: payload.notes,
      valuation_status: 'Completed',
    })
    .eq('id', id)
    .select('*, collateral_records(description, collateral_type)')
    .single();
  if (error) throw error;
  return rowToValuation(data);
}

export async function approveValuation(
  id: string,
  approvedBy: string
): Promise<CollateralValuation> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_valuations')
    .update({
      valuation_status: 'Approved',
      approved_by: approvedBy,
      approved_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*, collateral_records(description, collateral_type)')
    .single();
  if (error) throw error;
  return rowToValuation(data);
}

export async function rejectValuation(
  id: string,
  rejectionReason: string
): Promise<CollateralValuation> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_valuations')
    .update({
      valuation_status: 'Rejected',
      rejection_reason: rejectionReason,
    })
    .eq('id', id)
    .select('*, collateral_records(description, collateral_type)')
    .single();
  if (error) throw error;
  return rowToValuation(data);
}

export async function getValuationStats(): Promise<{
  total: number;
  scheduled: number;
  overdue: number;
  pendingApproval: number;
  approved: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_valuations')
    .select('valuation_status');
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    scheduled: rows.filter((r) => r.valuation_status === 'Scheduled').length,
    overdue: rows.filter((r) => r.valuation_status === 'Overdue').length,
    pendingApproval: rows.filter((r) => r.valuation_status === 'Completed').length,
    approved: rows.filter((r) => r.valuation_status === 'Approved').length,
  };
}
