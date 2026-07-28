'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type AlertStatus = 'Open' | 'Acknowledged' | 'Resolved' | 'Waived';
export type AlertSeverity = 'Critical' | 'High' | 'Medium';

export interface LtvBreachAlert {
  id: string;
  collateralId: string;
  loanId: string;
  alertType: string;
  covenantThreshold: number;
  currentLtv: number;
  collateralValue: number;
  loanExposure: number;
  breachAmount: number | null;
  severity: AlertSeverity;
  alertStatus: AlertStatus;
  triggeredAt: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  resolvedAt: string | null;
  resolvedBy: string | null;
  resolutionNotes: string | null;
  smsSent: boolean;
  emailSent: boolean;
  createdAt: string;
  updatedAt: string;
  // joined
  collateralDescription?: string;
  collateralType?: string;
  loanNumber?: string;
  obligorName?: string;
}

export interface LtvAlertThreshold {
  id: string;
  collateralType: string;
  warningThreshold: number;
  criticalThreshold: number;
  isEnabled: boolean;
  notifyOfficer: boolean;
  notifyEmail: boolean;
  notifySms: boolean;
  createdAt: string;
  updatedAt: string;
}

function rowToAlert(row: any): LtvBreachAlert {
  return {
    id: row.id,
    collateralId: row.collateral_id,
    loanId: row.loan_id,
    alertType: row.alert_type,
    covenantThreshold: parseFloat(row.covenant_threshold),
    currentLtv: parseFloat(row.current_ltv),
    collateralValue: parseFloat(row.collateral_value),
    loanExposure: parseFloat(row.loan_exposure),
    breachAmount: row.breach_amount != null ? parseFloat(row.breach_amount) : null,
    severity: row.severity,
    alertStatus: row.alert_status,
    triggeredAt: row.triggered_at,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    resolvedAt: row.resolved_at,
    resolvedBy: row.resolved_by,
    resolutionNotes: row.resolution_notes,
    smsSent: row.sms_sent ?? false,
    emailSent: row.email_sent ?? false,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    collateralDescription: row.collateral_records?.description,
    collateralType: row.collateral_records?.collateral_type,
    loanNumber: row.loans?.loan_number,
    obligorName: row.loans?.obligors?.full_name,
  };
}

function rowToThreshold(row: any): LtvAlertThreshold {
  return {
    id: row.id,
    collateralType: row.collateral_type,
    warningThreshold: parseFloat(row.warning_threshold),
    criticalThreshold: parseFloat(row.critical_threshold),
    isEnabled: row.is_enabled,
    notifyOfficer: row.notify_officer,
    notifyEmail: row.notify_email,
    notifySms: row.notify_sms,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const ltvBreachAlertService = {
  async listAlerts(filters?: {
    status?: AlertStatus;
    severity?: AlertSeverity;
  }): Promise<LtvBreachAlert[]> {
    const supabase = createClient();
    let query = supabase
      .from('ltv_breach_alerts')
      .select('*, collateral_records(description, collateral_type), loans(loan_number, obligors(full_name))')
      .order('triggered_at', { ascending: false });

    if (filters?.status) query = query.eq('alert_status', filters.status);
    if (filters?.severity) query = query.eq('severity', filters.severity);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(rowToAlert);
  },

  async createAlert(payload: {
    collateralId: string;
    loanId: string;
    covenantThreshold: number;
    currentLtv: number;
    collateralValue: number;
    loanExposure: number;
    severity?: AlertSeverity;
  }): Promise<LtvBreachAlert> {
    const supabase = createClient();
    const breachAmount =
      payload.loanExposure - payload.collateralValue * payload.covenantThreshold;
    const severity: AlertSeverity =
      payload.currentLtv >= 0.9
        ? 'Critical'
        : payload.currentLtv >= 0.8
        ? 'High' :'Medium';

    const { data, error } = await supabase
      .from('ltv_breach_alerts')
      .insert({
        collateral_id: payload.collateralId,
        loan_id: payload.loanId,
        covenant_threshold: payload.covenantThreshold,
        current_ltv: payload.currentLtv,
        collateral_value: payload.collateralValue,
        loan_exposure: payload.loanExposure,
        breach_amount: breachAmount > 0 ? breachAmount : null,
        severity: payload.severity ?? severity,
        alert_status: 'Open',
      })
      .select('*, collateral_records(description, collateral_type), loans(loan_number, obligors(full_name))')
      .single();
    if (error) throw error;
    return rowToAlert(data);
  },

  async acknowledgeAlert(id: string, userId: string): Promise<LtvBreachAlert> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ltv_breach_alerts')
      .update({
        alert_status: 'Acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, collateral_records(description, collateral_type), loans(loan_number, obligors(full_name))')
      .single();
    if (error) throw error;
    return rowToAlert(data);
  },

  async resolveAlert(
    id: string,
    userId: string,
    resolutionNotes: string
  ): Promise<LtvBreachAlert> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ltv_breach_alerts')
      .update({
        alert_status: 'Resolved',
        resolved_at: new Date().toISOString(),
        resolved_by: userId,
        resolution_notes: resolutionNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*, collateral_records(description, collateral_type), loans(loan_number, obligors(full_name))')
      .single();
    if (error) throw error;
    return rowToAlert(data);
  },

  async getStats(): Promise<{
    total: number;
    open: number;
    acknowledged: number;
    resolved: number;
    critical: number;
    high: number;
  }> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ltv_breach_alerts')
      .select('alert_status, severity');
    if (error) throw error;
    const rows = data ?? [];
    return {
      total: rows.length,
      open: rows.filter((r) => r.alert_status === 'Open').length,
      acknowledged: rows.filter((r) => r.alert_status === 'Acknowledged').length,
      resolved: rows.filter((r) => r.alert_status === 'Resolved').length,
      critical: rows.filter((r) => r.severity === 'Critical').length,
      high: rows.filter((r) => r.severity === 'High').length,
    };
  },

  async listThresholds(): Promise<LtvAlertThreshold[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('ltv_alert_thresholds')
      .select('*')
      .order('collateral_type');
    if (error) throw error;
    return (data ?? []).map(rowToThreshold);
  },

  async upsertThreshold(payload: {
    collateralType: string;
    warningThreshold: number;
    criticalThreshold: number;
    isEnabled: boolean;
    notifyOfficer: boolean;
    notifyEmail: boolean;
    notifySms: boolean;
    userId: string;
  }): Promise<LtvAlertThreshold> {
    const supabase = createClient();
    const { data: existing } = await supabase
      .from('ltv_alert_thresholds')
      .select('id')
      .eq('collateral_type', payload.collateralType)
      .maybeSingle();

    const row = {
      collateral_type: payload.collateralType,
      warning_threshold: payload.warningThreshold,
      critical_threshold: payload.criticalThreshold,
      is_enabled: payload.isEnabled,
      notify_officer: payload.notifyOfficer,
      notify_email: payload.notifyEmail,
      notify_sms: payload.notifySms,
      updated_by: payload.userId,
    };

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('ltv_alert_thresholds')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) throw error;
      result = data;
    } else {
      const { data, error } = await supabase
        .from('ltv_alert_thresholds')
        .insert({ ...row, created_by: payload.userId })
        .select()
        .single();
      if (error) throw error;
      result = data;
    }
    return rowToThreshold(result);
  },

  /**
   * Check collateral LTV against thresholds and create breach alert if needed.
   * Call this after a new valuation is approved.
   */
  async checkAndCreateBreachAlert(payload: {
    collateralId: string;
    loanId: string;
    collateralType: string;
    collateralValue: number;
    loanExposure: number;
  }): Promise<LtvBreachAlert | null> {
    const supabase = createClient();

    // Get threshold for this collateral type or fall back to 'All'
    const { data: thresholds } = await supabase
      .from('ltv_alert_thresholds')
      .select('*')
      .in('collateral_type', [payload.collateralType, 'All'])
      .eq('is_enabled', true);

    const threshold =
      thresholds?.find((t) => t.collateral_type === payload.collateralType) ??
      thresholds?.find((t) => t.collateral_type === 'All');

    if (!threshold || payload.collateralValue <= 0) return null;

    const currentLtv = payload.loanExposure / payload.collateralValue;
    const covenantThreshold = parseFloat(threshold.warning_threshold);

    if (currentLtv <= covenantThreshold) return null;

    // Check if an open alert already exists for this collateral+loan
    const { data: existing } = await supabase
      .from('ltv_breach_alerts')
      .select('id')
      .eq('collateral_id', payload.collateralId)
      .eq('loan_id', payload.loanId)
      .eq('alert_status', 'Open')
      .maybeSingle();

    if (existing) return null; // already flagged

    return ltvBreachAlertService.createAlert({
      collateralId: payload.collateralId,
      loanId: payload.loanId,
      covenantThreshold,
      currentLtv,
      collateralValue: payload.collateralValue,
      loanExposure: payload.loanExposure,
    });
  },
};
