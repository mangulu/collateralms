'use client';

import { createClient } from '@/lib/supabase/client';

export type FraudAlertType = 'DUPLICATE_TITLE' | 'IDENTITY_MISMATCH' | 'VALUATION_ANOMALY' | 'EARLY_WARNING' | 'DOCUMENT_FORGERY';
export type FraudAlertStatus = 'PENDING_REVIEW' | 'FALSE_POSITIVE' | 'ESCALATED' | 'RESOLVED';

export interface FraudAlertRow {
  id: string;
  collateral_id: string | null;
  alert_type: FraudAlertType;
  risk_score: number;
  confidence: number;
  details: Record<string, any>;
  status: FraudAlertStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
}

export interface CreateFraudAlertInput {
  collateral_id?: string | null;
  alert_type: FraudAlertType;
  risk_score: number;
  confidence: number;
  details: Record<string, any>;
  status?: FraudAlertStatus;
}

export async function saveFraudAlert(input: CreateFraudAlertInput): Promise<FraudAlertRow | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fraud_alerts')
    .insert({
      collateral_id: input.collateral_id ?? null,
      alert_type: input.alert_type,
      risk_score: input.risk_score,
      confidence: input.confidence,
      details: input.details,
      status: input.status ?? 'PENDING_REVIEW',
    })
    .select()
    .single();

  if (error) {
    console.error('saveFraudAlert error:', error);
    return null;
  }
  return data as FraudAlertRow;
}

export async function fetchFraudAlerts(): Promise<FraudAlertRow[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('fraud_alerts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('fetchFraudAlerts error:', error);
    return [];
  }
  return (data ?? []) as FraudAlertRow[];
}

export async function updateFraudAlertStatus(
  id: string,
  status: FraudAlertStatus,
  reviewedBy?: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from('fraud_alerts')
    .update({
      status,
      reviewed_by: reviewedBy ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', id);

  if (error) {
    console.error('updateFraudAlertStatus error:', error);
    return false;
  }
  return true;
}
