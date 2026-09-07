'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface HaircutSchedule {
  id: string;
  collateralClass: string;
  haircutRate: number;       // 0.00 – 0.30 (decimal)
  haircutPct: number;        // 0 – 30 (percentage display)
  description: string | null;
  isActive: boolean;
  effectiveDate: string;
  approvedBy: string | null;
  approvedAt: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  approvedByName?: string;
}

export interface HaircutApplicationLog {
  id: string;
  haircutScheduleId: string | null;
  collateralId: string;
  valuationId: string | null;
  collateralClass: string;
  grossValue: number;
  haircutRate: number;
  haircutAmount: number;
  netValue: number;
  appliedAt: string;
  appliedBy: string | null;
  context: string;
  collateralDescription?: string;
  appliedByName?: string;
}

export interface HaircutApplicationResult {
  grossValue: number;
  haircutRate: number;
  haircutAmount: number;
  netValue: number;
  collateralClass: string;
  scheduleId: string | null;
}

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function rowToSchedule(row: any): HaircutSchedule {
  const rate = parseFloat(row.haircut_rate ?? 0);
  return {
    id: row.id,
    collateralClass: row.collateral_class,
    haircutRate: rate,
    haircutPct: Math.round(rate * 100 * 100) / 100,
    description: row.description ?? null,
    isActive: row.is_active ?? true,
    effectiveDate: row.effective_date,
    approvedBy: row.approved_by ?? null,
    approvedAt: row.approved_at ?? null,
    notes: row.notes ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approvedByName: row.user_profiles?.full_name,
  };
}

function rowToLog(row: any): HaircutApplicationLog {
  return {
    id: row.id,
    haircutScheduleId: row.haircut_schedule_id ?? null,
    collateralId: row.collateral_id,
    valuationId: row.valuation_id ?? null,
    collateralClass: row.collateral_class,
    grossValue: parseFloat(row.gross_value ?? 0),
    haircutRate: parseFloat(row.haircut_rate ?? 0),
    haircutAmount: parseFloat(row.haircut_amount ?? 0),
    netValue: parseFloat(row.net_value ?? 0),
    appliedAt: row.applied_at,
    appliedBy: row.applied_by ?? null,
    context: row.context ?? 'valuation',
    collateralDescription: row.collateral_records?.description,
    appliedByName: row.user_profiles?.full_name,
  };
}

// ─── Engine ───────────────────────────────────────────────────────────────────

/**
 * Apply a haircut to a gross value.
 * Returns gross, haircut amount, and net (post-haircut) value.
 */
export function applyHaircut(
  grossValue: number,
  haircutRate: number
): { haircutAmount: number; netValue: number } {
  const haircutAmount = grossValue * haircutRate;
  const netValue = grossValue - haircutAmount;
  return { haircutAmount, netValue };
}

/**
 * Calculate LTV using post-haircut collateral value.
 * ltv = loanExposure / netCollateralValue
 */
export function calculateHaircutAdjustedLtv(
  loanExposure: number,
  grossCollateralValue: number,
  haircutRate: number
): { netCollateralValue: number; ltv: number; haircutAmount: number } {
  const { haircutAmount, netValue } = applyHaircut(grossCollateralValue, haircutRate);
  const ltv = netValue > 0 ? loanExposure / netValue : Infinity;
  return { netCollateralValue: netValue, ltv, haircutAmount };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const haircutService = {
  // ── Schedules ──────────────────────────────────────────────────────────────

  async listSchedules(activeOnly = false): Promise<HaircutSchedule[]> {
    const supabase = createClient();
    let query = supabase
      .from('haircut_schedules')
      .select('*, user_profiles!approved_by(full_name)')
      .order('collateral_class');
    if (activeOnly) query = query.eq('is_active', true);
    const { data, error } = await query;
    if (error) { console.error('haircutService.listSchedules:', error.message); return []; }
    return (data ?? []).map(rowToSchedule);
  },

  async getByClass(collateralClass: string): Promise<HaircutSchedule | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('haircut_schedules')
      .select('*')
      .eq('collateral_class', collateralClass)
      .eq('is_active', true)
      .maybeSingle();
    if (error) { console.error('haircutService.getByClass:', error.message); return null; }
    return data ? rowToSchedule(data) : null;
  },

  async upsertSchedule(payload: {
    collateralClass: string;
    haircutRate: number;
    description?: string;
    notes?: string;
    effectiveDate?: string;
    userId?: string;
  }): Promise<HaircutSchedule> {
    const supabase = createClient();

    // Deactivate existing active record for this class
    await supabase
      .from('haircut_schedules')
      .update({ is_active: false })
      .eq('collateral_class', payload.collateralClass)
      .eq('is_active', true);

    const { data, error } = await supabase
      .from('haircut_schedules')
      .insert({
        collateral_class: payload.collateralClass,
        haircut_rate: payload.haircutRate,
        description: payload.description ?? null,
        notes: payload.notes ?? null,
        effective_date: payload.effectiveDate ?? new Date().toISOString().split('T')[0],
        is_active: true,
        created_by: payload.userId ?? null,
      })
      .select('*')
      .single();
    if (error) throw error;
    return rowToSchedule(data);
  },

  async updateSchedule(
    id: string,
    payload: {
      haircutRate?: number;
      description?: string;
      notes?: string;
      isActive?: boolean;
      approvedBy?: string;
    }
  ): Promise<HaircutSchedule> {
    const supabase = createClient();
    const update: any = {};
    if (payload.haircutRate !== undefined) update.haircut_rate = payload.haircutRate;
    if (payload.description !== undefined) update.description = payload.description;
    if (payload.notes !== undefined) update.notes = payload.notes;
    if (payload.isActive !== undefined) update.is_active = payload.isActive;
    if (payload.approvedBy !== undefined) {
      update.approved_by = payload.approvedBy;
      update.approved_at = new Date().toISOString();
    }
    const { data, error } = await supabase
      .from('haircut_schedules')
      .update(update)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return rowToSchedule(data);
  },

  // ── Application ────────────────────────────────────────────────────────────

  /**
   * Apply haircut to a collateral value and log the application.
   */
  async applyAndLog(payload: {
    collateralId: string;
    collateralClass: string;
    grossValue: number;
    valuationId?: string;
    context?: string;
    appliedBy?: string;
  }): Promise<HaircutApplicationResult> {
    const supabase = createClient();

    // Lookup active haircut rate for this class
    const schedule = await haircutService.getByClass(payload.collateralClass);
    const rate = schedule?.haircutRate ?? 0;
    const { haircutAmount, netValue } = applyHaircut(payload.grossValue, rate);

    // Log the application
    await supabase.from('haircut_application_log').insert({
      haircut_schedule_id: schedule?.id ?? null,
      collateral_id: payload.collateralId,
      valuation_id: payload.valuationId ?? null,
      collateral_class: payload.collateralClass,
      gross_value: payload.grossValue,
      haircut_rate: rate,
      haircut_amount: haircutAmount,
      net_value: netValue,
      applied_by: payload.appliedBy ?? null,
      context: payload.context ?? 'valuation',
    }).then(() => {}).catch((e) => console.warn('[haircut] log failed:', e.message));

    return {
      grossValue: payload.grossValue,
      haircutRate: rate,
      haircutAmount,
      netValue,
      collateralClass: payload.collateralClass,
      scheduleId: schedule?.id ?? null,
    };
  },

  // ── Application Log ────────────────────────────────────────────────────────

  async listApplicationLog(filters?: {
    collateralId?: string;
    context?: string;
    limit?: number;
  }): Promise<HaircutApplicationLog[]> {
    const supabase = createClient();
    let query = supabase
      .from('haircut_application_log')
      .select('*, collateral_records(description), user_profiles!applied_by(full_name)')
      .order('applied_at', { ascending: false });

    if (filters?.collateralId) query = query.eq('collateral_id', filters.collateralId);
    if (filters?.context) query = query.eq('context', filters.context);
    if (filters?.limit) query = query.limit(filters.limit);

    const { data, error } = await query;
    if (error) { console.error('haircutService.listApplicationLog:', error.message); return []; }
    return (data ?? []).map(rowToLog);
  },

  // ── Stats ──────────────────────────────────────────────────────────────────

  async getStats(): Promise<{
    totalClasses: number;
    activeClasses: number;
    avgHaircutPct: number;
    maxHaircutPct: number;
    minHaircutPct: number;
    totalApplications: number;
    totalHaircutAmount: number;
  }> {
    const supabase = createClient();
    const [schedulesRes, logRes] = await Promise.all([
      supabase.from('haircut_schedules').select('haircut_rate, is_active'),
      supabase.from('haircut_application_log').select('haircut_amount'),
    ]);

    const schedules = schedulesRes.data ?? [];
    const logs = logRes.data ?? [];
    const active = schedules.filter((s) => s.is_active);
    const rates = active.map((s) => parseFloat(s.haircut_rate) * 100);

    return {
      totalClasses: schedules.length,
      activeClasses: active.length,
      avgHaircutPct: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : 0,
      maxHaircutPct: rates.length ? Math.max(...rates) : 0,
      minHaircutPct: rates.length ? Math.min(...rates) : 0,
      totalApplications: logs.length,
      totalHaircutAmount: logs.reduce((sum, l) => sum + parseFloat(l.haircut_amount ?? 0), 0),
    };
  },
};
