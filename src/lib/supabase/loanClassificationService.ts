'use client';

import { createClient } from '@/lib/supabase/client';

// ─── BOT Classification Constants ─────────────────────────────────────────────

export const BOT_TIERS = [
  { key: 'Current',              label: 'Current',              dpd_min: 0,   dpd_max: 0,   rate: 0.01, color: 'text-green-700',  bg: 'bg-green-100',  border: 'border-green-300' },
  { key: 'Especially Mentioned', label: 'Especially Mentioned', dpd_min: 1,   dpd_max: 30,  rate: 0.03, color: 'text-amber-700',  bg: 'bg-amber-100',  border: 'border-amber-300' },
  { key: 'Substandard',          label: 'Substandard',          dpd_min: 31,  dpd_max: 90,  rate: 0.20, color: 'text-orange-700', bg: 'bg-orange-100', border: 'border-orange-300' },
  { key: 'Doubtful',             label: 'Doubtful',             dpd_min: 91,  dpd_max: 180, rate: 0.50, color: 'text-red-700',    bg: 'bg-red-100',    border: 'border-red-300' },
  { key: 'Loss',                 label: 'Loss',                 dpd_min: 181, dpd_max: 9999,rate: 1.00, color: 'text-rose-900',   bg: 'bg-rose-100',   border: 'border-rose-400' },
] as const;

export type BotClassification = 'Current' | 'Especially Mentioned' | 'Substandard' | 'Doubtful' | 'Loss';

export const QUALITATIVE_FLAGS = [
  { key: 'insurance_expired',     label: 'Insurance Expired',          tier: 'Especially Mentioned' },
  { key: 'perfection_overdue',    label: 'Perfection Overdue',         tier: 'Especially Mentioned' },
  { key: 'covenant_breach',       label: 'Covenant Breach',            tier: 'Substandard' },
  { key: 'collateral_deficiency', label: 'Collateral Deficiency',      tier: 'Substandard' },
  { key: 'legal_dispute',         label: 'Legal Dispute on Collateral',tier: 'Doubtful' },
  { key: 'borrower_insolvent',    label: 'Borrower Insolvency Signs',  tier: 'Doubtful' },
  { key: 'write_off_recommended', label: 'Write-Off Recommended',      tier: 'Loss' },
] as const;

export type QualitativeFlag = typeof QUALITATIVE_FLAGS[number]['key'];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoanClassification {
  id: string;
  loanId: string;
  obligorId: string;
  classification: BotClassification;
  daysPastDue: number;
  outstandingBalance: number;
  currency: string;
  provisionRate: number;
  provisionAmount: number;
  primaryTrigger: string;
  qualitativeFlags: QualitativeFlag[];
  overrideReason: string | null;
  classifiedBy: string | null;
  classificationDate: string;
  reviewDate: string | null;
  quarter: string;
  isActive: boolean;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  loanNumber?: string;
  obligorName?: string;
  obligorCode?: string;
  facilityType?: string;
}

export interface ProvisioningReport {
  id: string;
  quarter: string;
  reportDate: string;
  totalPortfolio: number;
  totalProvision: number;
  currency: string;
  currentBalance: number;
  currentProvision: number;
  currentCount: number;
  emBalance: number;
  emProvision: number;
  emCount: number;
  substandardBalance: number;
  substandardProvision: number;
  substandardCount: number;
  doubtfulBalance: number;
  doubtfulProvision: number;
  doubtfulCount: number;
  lossBalance: number;
  lossProvision: number;
  lossCount: number;
  generatedBy: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClassifyLoanInput {
  loanId: string;
  obligorId: string;
  daysPastDue: number;
  outstandingBalance: number;
  currency: string;
  qualitativeFlags: QualitativeFlag[];
  overrideClassification?: BotClassification;
  overrideReason?: string;
  notes?: string;
  classifiedBy?: string;
}

// ─── Engine ───────────────────────────────────────────────────────────────────

export function classifyByDPD(dpd: number): BotClassification {
  if (dpd <= 0)   return 'Current';
  if (dpd <= 30)  return 'Especially Mentioned';
  if (dpd <= 90)  return 'Substandard';
  if (dpd <= 180) return 'Doubtful';
  return 'Loss';
}

export function classifyByFlags(flags: QualitativeFlag[]): BotClassification | null {
  const tierOrder: BotClassification[] = ['Loss', 'Doubtful', 'Substandard', 'Especially Mentioned', 'Current'];
  for (const tier of tierOrder) {
    const flagsForTier = QUALITATIVE_FLAGS.filter(f => f.tier === tier).map(f => f.key);
    if (flags.some(f => flagsForTier.includes(f))) return tier;
  }
  return null;
}

export function worstClassification(a: BotClassification, b: BotClassification): BotClassification {
  const order: BotClassification[] = ['Current', 'Especially Mentioned', 'Substandard', 'Doubtful', 'Loss'];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export function getProvisionRate(classification: BotClassification): number {
  const tier = BOT_TIERS.find(t => t.key === classification);
  return tier?.rate ?? 0.01;
}

export function computeClassification(input: ClassifyLoanInput): {
  classification: BotClassification;
  provisionRate: number;
  provisionAmount: number;
  primaryTrigger: string;
} {
  if (input.overrideClassification) {
    const rate = getProvisionRate(input.overrideClassification);
    return {
      classification: input.overrideClassification,
      provisionRate: rate,
      provisionAmount: input.outstandingBalance * rate,
      primaryTrigger: 'manual_override',
    };
  }

  const dpdClass = classifyByDPD(input.daysPastDue);
  const flagClass = classifyByFlags(input.qualitativeFlags);
  const finalClass = flagClass ? worstClassification(dpdClass, flagClass) : dpdClass;
  const rate = getProvisionRate(finalClass);

  return {
    classification: finalClass,
    provisionRate: rate,
    provisionAmount: input.outstandingBalance * rate,
    primaryTrigger: flagClass && worstClassification(dpdClass, flagClass) !== dpdClass
      ? 'qualitative_flag' :'days_past_due',
  };
}

export function getCurrentQuarter(): string {
  const now = new Date();
  let q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
}

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function rowToClassification(row: any): LoanClassification {
  return {
    id: row.id,
    loanId: row.loan_id,
    obligorId: row.obligor_id,
    classification: row.classification,
    daysPastDue: row.days_past_due ?? 0,
    outstandingBalance: parseFloat(row.outstanding_balance ?? 0),
    currency: row.currency ?? 'TZS',
    provisionRate: parseFloat(row.provision_rate ?? 0),
    provisionAmount: parseFloat(row.provision_amount ?? 0),
    primaryTrigger: row.primary_trigger ?? 'days_past_due',
    qualitativeFlags: row.qualitative_flags ?? [],
    overrideReason: row.override_reason ?? null,
    classifiedBy: row.classified_by ?? null,
    classificationDate: row.classification_date,
    reviewDate: row.review_date ?? null,
    quarter: row.quarter,
    isActive: row.is_active ?? true,
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    loanNumber: row.loans?.loan_number,
    obligorName: row.obligors?.full_name,
    obligorCode: row.obligors?.obligor_code,
    facilityType: row.loans?.facility_type,
  };
}

function rowToReport(row: any): ProvisioningReport {
  return {
    id: row.id,
    quarter: row.quarter,
    reportDate: row.report_date,
    totalPortfolio: parseFloat(row.total_portfolio ?? 0),
    totalProvision: parseFloat(row.total_provision ?? 0),
    currency: row.currency ?? 'TZS',
    currentBalance: parseFloat(row.current_balance ?? 0),
    currentProvision: parseFloat(row.current_provision ?? 0),
    currentCount: row.current_count ?? 0,
    emBalance: parseFloat(row.em_balance ?? 0),
    emProvision: parseFloat(row.em_provision ?? 0),
    emCount: row.em_count ?? 0,
    substandardBalance: parseFloat(row.substandard_balance ?? 0),
    substandardProvision: parseFloat(row.substandard_provision ?? 0),
    substandardCount: row.substandard_count ?? 0,
    doubtfulBalance: parseFloat(row.doubtful_balance ?? 0),
    doubtfulProvision: parseFloat(row.doubtful_provision ?? 0),
    doubtfulCount: row.doubtful_count ?? 0,
    lossBalance: parseFloat(row.loss_balance ?? 0),
    lossProvision: parseFloat(row.loss_provision ?? 0),
    lossCount: row.loss_count ?? 0,
    generatedBy: row.generated_by ?? null,
    status: row.status ?? 'Draft',
    notes: row.notes ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const loanClassificationService = {
  async getAll(quarter?: string): Promise<LoanClassification[]> {
    const supabase = createClient();
    let q = supabase
      .from('loan_classifications')
      .select('*, loans(loan_number, facility_type), obligors(full_name, obligor_code)')
      .eq('is_active', true)
      .order('created_at', { ascending: false });
    if (quarter) q = q.eq('quarter', quarter);
    const { data, error } = await q;
    if (error) { console.error('loanClassificationService.getAll:', error.message); return []; }
    return (data ?? []).map(rowToClassification);
  },

  async getByLoanId(loanId: string): Promise<LoanClassification[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('loan_classifications')
      .select('*, loans(loan_number, facility_type), obligors(full_name, obligor_code)')
      .eq('loan_id', loanId)
      .order('created_at', { ascending: false });
    if (error) { console.error('loanClassificationService.getByLoanId:', error.message); return []; }
    return (data ?? []).map(rowToClassification);
  },

  async classify(input: ClassifyLoanInput): Promise<LoanClassification | null> {
    const supabase = createClient();
    const { classification, provisionRate, provisionAmount, primaryTrigger } = computeClassification(input);
    const quarter = getCurrentQuarter();

    // Deactivate previous active classification for this loan
    await supabase
      .from('loan_classifications')
      .update({ is_active: false })
      .eq('loan_id', input.loanId)
      .eq('is_active', true);

    const row = {
      loan_id: input.loanId,
      obligor_id: input.obligorId,
      classification,
      days_past_due: input.daysPastDue,
      outstanding_balance: input.outstandingBalance,
      currency: input.currency,
      provision_rate: provisionRate,
      provision_amount: provisionAmount,
      primary_trigger: primaryTrigger,
      qualitative_flags: input.qualitativeFlags,
      override_reason: input.overrideReason ?? null,
      classified_by: input.classifiedBy ?? null,
      classification_date: new Date().toISOString().split('T')[0],
      review_date: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      quarter,
      is_active: true,
      notes: input.notes ?? null,
    };

    const { data, error } = await supabase
      .from('loan_classifications')
      .insert(row)
      .select('*, loans(loan_number, facility_type), obligors(full_name, obligor_code)')
      .single();
    if (error) { console.error('loanClassificationService.classify:', error.message); return null; }
    return rowToClassification(data);
  },

  async update(id: string, updates: Partial<{
    classification: BotClassification;
    daysPastDue: number;
    outstandingBalance: number;
    qualitativeFlags: QualitativeFlag[];
    overrideReason: string;
    notes: string;
  }>): Promise<LoanClassification | null> {
    const supabase = createClient();
    const row: any = {};
    if (updates.classification !== undefined) row.classification = updates.classification;
    if (updates.daysPastDue !== undefined) row.days_past_due = updates.daysPastDue;
    if (updates.outstandingBalance !== undefined) row.outstanding_balance = updates.outstandingBalance;
    if (updates.qualitativeFlags !== undefined) row.qualitative_flags = updates.qualitativeFlags;
    if (updates.overrideReason !== undefined) row.override_reason = updates.overrideReason;
    if (updates.notes !== undefined) row.notes = updates.notes;

    const { data, error } = await supabase
      .from('loan_classifications')
      .update(row)
      .eq('id', id)
      .select('*, loans(loan_number, facility_type), obligors(full_name, obligor_code)')
      .single();
    if (error) { console.error('loanClassificationService.update:', error.message); return null; }
    return rowToClassification(data);
  },

  // ─── Provisioning Reports ──────────────────────────────────────────────────

  async getReports(): Promise<ProvisioningReport[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('provisioning_reports')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) { console.error('loanClassificationService.getReports:', error.message); return []; }
    return (data ?? []).map(rowToReport);
  },

  async generateReport(quarter: string, generatedBy?: string): Promise<ProvisioningReport | null> {
    const supabase = createClient();

    const { data: classifications, error: cErr } = await supabase
      .from('loan_classifications')
      .select('*')
      .eq('quarter', quarter)
      .eq('is_active', true);
    if (cErr) { console.error('generateReport fetch:', cErr.message); return null; }

    const rows = classifications ?? [];

    const sum = (cls: string) => rows.filter(r => r.classification === cls);
    const bal = (arr: any[]) => arr.reduce((s, r) => s + parseFloat(r.outstanding_balance ?? 0), 0);
    const prov = (arr: any[]) => arr.reduce((s, r) => s + parseFloat(r.provision_amount ?? 0), 0);

    const curr = sum('Current');
    const em   = sum('Especially Mentioned');
    const sub  = sum('Substandard');
    const dbt  = sum('Doubtful');
    const loss = sum('Loss');

    const report = {
      quarter,
      report_date: new Date().toISOString().split('T')[0],
      total_portfolio: bal(rows),
      total_provision: prov(rows),
      currency: 'TZS',
      current_balance: bal(curr),       current_provision: prov(curr),       current_count: curr.length,
      em_balance: bal(em),              em_provision: prov(em),              em_count: em.length,
      substandard_balance: bal(sub),    substandard_provision: prov(sub),    substandard_count: sub.length,
      doubtful_balance: bal(dbt),       doubtful_provision: prov(dbt),       doubtful_count: dbt.length,
      loss_balance: bal(loss),          loss_provision: prov(loss),          loss_count: loss.length,
      generated_by: generatedBy ?? null,
      status: 'Draft',
    };

    const { data, error } = await supabase
      .from('provisioning_reports')
      .upsert(report, { onConflict: 'quarter' })
      .select()
      .single();
    if (error) { console.error('generateReport upsert:', error.message); return null; }
    return rowToReport(data);
  },

  async updateReportStatus(id: string, status: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('provisioning_reports')
      .update({ status })
      .eq('id', id);
    if (error) { console.error('updateReportStatus:', error.message); return false; }
    return true;
  },
};
