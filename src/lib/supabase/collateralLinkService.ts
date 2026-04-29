'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type LinkStatus = 'ACTIVE' | 'RELEASED' | 'DEFAULTED';
export type ChargeRegistryStatus = 'ACTIVE' | 'DISCHARGED';
export type UtilizationStatus = 'GREEN' | 'YELLOW' | 'RED';

export interface CollateralLoanLink {
  id: string;
  collateralId: string;
  loanAccountId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  chargeRank: number;
  allocatedAmount: number;
  startDate: string;
  endDate: string | null;
  status: LinkStatus;
  releaseDate: string | null;
  releaseReason: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ChargeRegistry {
  id: string;
  collateralId: string;
  collateralLoanLinkId: string | null;
  loanAccountId: string;
  chargeRank: number;
  registryName: string;
  registrationNumber: string | null;
  registrationDate: string | null;
  dischargeNumber: string | null;
  dischargeDate: string | null;
  dischargeCertificateUrl: string | null;
  status: ChargeRegistryStatus;
  notes: string;
  createdBy: string | null;
  createdAt: string;
}

export interface CollateralUtilization {
  collateralId: string;
  collateralRecordId: string;
  titleDeedNumber: string;
  valuationAmount: number;
  ltvRatio: number;
  maxSecurableAmount: number;
  totalSecuredAmount: number;
  availableEquity: number;
  utilizationPercentage: number;
  utilizationStatus: UtilizationStatus;
  linkedLoans: CollateralLoanLink[];
}

export interface LinkLoanPayload {
  loanAccountId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  allocatedAmount: number;
  startDate: string;
}

export interface ReleaseLinkPayload {
  releaseReason: string;
  releaseDate: string;
  dischargeRegistryNumber?: string;
}

export interface DischargeChargePayload {
  registryName: string;
  dischargeNumber: string;
  dischargeDate: string;
  notes?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function rowToLink(row: any): CollateralLoanLink {
  return {
    id: row.id,
    collateralId: row.collateral_id,
    loanAccountId: row.loan_account_id,
    beneficiaryId: row.beneficiary_id,
    beneficiaryName: row.beneficiary_name ?? '',
    chargeRank: row.charge_rank,
    allocatedAmount: parseFloat(row.allocated_amount) || 0,
    startDate: row.start_date ?? '',
    endDate: row.end_date ?? null,
    status: row.status as LinkStatus,
    releaseDate: row.release_date ?? null,
    releaseReason: row.release_reason ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? '',
    updatedAt: row.updated_at ?? '',
  };
}

function rowToChargeRegistry(row: any): ChargeRegistry {
  return {
    id: row.id,
    collateralId: row.collateral_id,
    collateralLoanLinkId: row.collateral_loan_link_id ?? null,
    loanAccountId: row.loan_account_id ?? '',
    chargeRank: row.charge_rank,
    registryName: row.registry_name ?? '',
    registrationNumber: row.registration_number ?? null,
    registrationDate: row.registration_date ?? null,
    dischargeNumber: row.discharge_number ?? null,
    dischargeDate: row.discharge_date ?? null,
    dischargeCertificateUrl: row.discharge_certificate_url ?? null,
    status: row.status as ChargeRegistryStatus,
    notes: row.notes ?? '',
    createdBy: row.created_by ?? null,
    createdAt: row.created_at ?? '',
  };
}

function getUtilizationStatus(pct: number): UtilizationStatus {
  if (pct >= 90) return 'RED';
  if (pct >= 70) return 'YELLOW';
  return 'GREEN';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const collateralLinkService = {
  // ── Get utilization summary for a collateral ──────────────────────────────
  async getUtilization(collateralRecordId: string): Promise<CollateralUtilization | null> {
    const supabase = createClient();
    try {
      const { data: col, error: colErr } = await supabase
        .from('collateral_records')
        .select('id, collateral_id, valuation_amount, ltv_ratio, max_securable_amount, total_secured_amount, available_equity')
        .eq('id', collateralRecordId)
        .maybeSingle();

      if (colErr || !col) return null;

      const { data: links, error: linksErr } = await supabase
        .from('collateral_loan_links')
        .select('*')
        .eq('collateral_id', collateralRecordId)
        .order('charge_rank', { ascending: true });

      if (linksErr) return null;

      const activeLinks = (links ?? []).filter((l: any) => l.status === 'ACTIVE');
      const totalSecured = activeLinks.reduce((sum: number, l: any) => sum + (parseFloat(l.allocated_amount) || 0), 0);
      const valuation = parseFloat(col.valuation_amount) || 0;
      const ltv = parseFloat(col.ltv_ratio) || 0.70;
      const maxSecurable = valuation * ltv;
      const availableEquity = Math.max(0, maxSecurable - totalSecured);
      const utilizationPct = maxSecurable > 0 ? (totalSecured / maxSecurable) * 100 : 0;

      return {
        collateralId: col.collateral_id,
        collateralRecordId: col.id,
        titleDeedNumber: col.collateral_id,
        valuationAmount: valuation,
        ltvRatio: ltv,
        maxSecurableAmount: maxSecurable,
        totalSecuredAmount: totalSecured,
        availableEquity,
        utilizationPercentage: Math.round(utilizationPct * 10) / 10,
        utilizationStatus: getUtilizationStatus(utilizationPct),
        linkedLoans: (links ?? []).map(rowToLink),
      };
    } catch {
      return null;
    }
  },

  // ── Get all links for a collateral ────────────────────────────────────────
  async getLinksByCollateral(collateralRecordId: string): Promise<CollateralLoanLink[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_loan_links')
        .select('*')
        .eq('collateral_id', collateralRecordId)
        .order('charge_rank', { ascending: true });
      if (error) return [];
      return (data ?? []).map(rowToLink);
    } catch {
      return [];
    }
  },

  // ── Link a new loan to collateral ─────────────────────────────────────────
  async linkLoan(
    collateralRecordId: string,
    payload: LinkLoanPayload,
    userId: string
  ): Promise<{ success: boolean; link?: CollateralLoanLink; warning?: string; error?: string }> {
    const supabase = createClient();
    try {
      // Get current utilization
      const util = await collateralLinkService.getUtilization(collateralRecordId);
      if (!util) return { success: false, error: 'Collateral record not found' };

      if (payload.allocatedAmount > util.availableEquity) {
        return {
          success: false,
          error: `Insufficient equity. Available: ${util.availableEquity.toLocaleString()}. Requested: ${payload.allocatedAmount.toLocaleString()}`,
        };
      }

      // Determine next charge rank
      const { data: maxRankRow } = await supabase
        .from('collateral_loan_links')
        .select('charge_rank')
        .eq('collateral_id', collateralRecordId)
        .eq('status', 'ACTIVE')
        .order('charge_rank', { ascending: false })
        .limit(1)
        .maybeSingle();

      const nextRank = maxRankRow ? maxRankRow.charge_rank + 1 : 1;

      const { data, error } = await supabase
        .from('collateral_loan_links')
        .insert({
          collateral_id: collateralRecordId,
          loan_account_id: payload.loanAccountId,
          beneficiary_id: payload.beneficiaryId,
          beneficiary_name: payload.beneficiaryName,
          charge_rank: nextRank,
          allocated_amount: payload.allocatedAmount,
          start_date: payload.startDate,
          status: 'ACTIVE',
          created_by: userId,
        })
        .select()
        .single();

      if (error) return { success: false, error: error.message };

      // Update collateral totals
      const newTotal = util.totalSecuredAmount + payload.allocatedAmount;
      const newEquity = Math.max(0, util.maxSecurableAmount - newTotal);
      await supabase
        .from('collateral_records')
        .update({
          total_secured_amount: newTotal,
          available_equity: newEquity,
          is_shared: nextRank > 1,
        })
        .eq('id', collateralRecordId);

      const newPct = util.maxSecurableAmount > 0 ? (newTotal / util.maxSecurableAmount) * 100 : 0;
      const warning = newPct >= 90 ? `This allocation pushes utilization to ${newPct.toFixed(1)}%. Proceed with caution.` : undefined;

      return { success: true, link: rowToLink(data), warning };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Release a collateral link ─────────────────────────────────────────────
  async releaseLink(
    linkId: string,
    payload: ReleaseLinkPayload
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    try {
      const { data: link, error: fetchErr } = await supabase
        .from('collateral_loan_links')
        .select('*')
        .eq('id', linkId)
        .maybeSingle();

      if (fetchErr || !link) return { success: false, error: 'Link not found' };

      const { error } = await supabase
        .from('collateral_loan_links')
        .update({
          status: 'RELEASED',
          release_date: payload.releaseDate,
          release_reason: payload.releaseReason,
          end_date: payload.releaseDate,
        })
        .eq('id', linkId);

      if (error) return { success: false, error: error.message };

      // Recalculate totals
      const util = await collateralLinkService.getUtilization(link.collateral_id);
      if (util) {
        await supabase
          .from('collateral_records')
          .update({
            total_secured_amount: util.totalSecuredAmount,
            available_equity: util.availableEquity,
          })
          .eq('id', link.collateral_id);
      }

      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Get charge registry entries for a collateral ──────────────────────────
  async getChargeRegistry(collateralRecordId: string): Promise<ChargeRegistry[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('charge_registry')
        .select('*')
        .eq('collateral_id', collateralRecordId)
        .order('charge_rank', { ascending: true });
      if (error) return [];
      return (data ?? []).map(rowToChargeRegistry);
    } catch {
      return [];
    }
  },

  // ── Record charge discharge ───────────────────────────────────────────────
  async recordDischarge(
    collateralRecordId: string,
    chargeRank: number,
    payload: DischargeChargePayload,
    userId: string
  ): Promise<{ success: boolean; error?: string }> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('charge_registry')
        .update({
          discharge_number: payload.dischargeNumber,
          discharge_date: payload.dischargeDate,
          status: 'DISCHARGED',
          notes: payload.notes ?? '',
        })
        .eq('collateral_id', collateralRecordId)
        .eq('charge_rank', chargeRank)
        .eq('status', 'ACTIVE');

      if (error) return { success: false, error: error.message };
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  },

  // ── Create charge registry entry ──────────────────────────────────────────
  async createChargeEntry(
    collateralRecordId: string,
    linkId: string,
    loanAccountId: string,
    chargeRank: number,
    registryName: string,
    registrationNumber: string,
    registrationDate: string,
    userId: string
  ): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('charge_registry')
        .insert({
          collateral_id: collateralRecordId,
          collateral_loan_link_id: linkId,
          loan_account_id: loanAccountId,
          charge_rank: chargeRank,
          registry_name: registryName,
          registration_number: registrationNumber,
          registration_date: registrationDate,
          status: 'ACTIVE',
          created_by: userId,
        });
      return !error;
    } catch {
      return false;
    }
  },

  // ── Get all collateral utilization for report ─────────────────────────────
  async getAllUtilizationReport(): Promise<CollateralUtilization[]> {
    const supabase = createClient();
    try {
      const { data: cols, error } = await supabase
        .from('collateral_records')
        .select('id, collateral_id, valuation_amount, ltv_ratio, max_securable_amount, total_secured_amount, available_equity')
        .not('valuation_amount', 'is', null)
        .order('created_at', { ascending: false });

      if (error || !cols) return [];

      const results: CollateralUtilization[] = [];
      for (const col of cols) {
        const { data: links } = await supabase
          .from('collateral_loan_links')
          .select('*')
          .eq('collateral_id', col.id)
          .order('charge_rank', { ascending: true });

        const activeLinks = (links ?? []).filter((l: any) => l.status === 'ACTIVE');
        const totalSecured = activeLinks.reduce((sum: number, l: any) => sum + (parseFloat(l.allocated_amount) || 0), 0);
        const valuation = parseFloat(col.valuation_amount) || 0;
        const ltv = parseFloat(col.ltv_ratio) || 0.70;
        const maxSecurable = valuation * ltv;
        const availableEquity = Math.max(0, maxSecurable - totalSecured);
        const utilizationPct = maxSecurable > 0 ? (totalSecured / maxSecurable) * 100 : 0;

        results.push({
          collateralId: col.collateral_id,
          collateralRecordId: col.id,
          titleDeedNumber: col.collateral_id,
          valuationAmount: valuation,
          ltvRatio: ltv,
          maxSecurableAmount: maxSecurable,
          totalSecuredAmount: totalSecured,
          availableEquity,
          utilizationPercentage: Math.round(utilizationPct * 10) / 10,
          utilizationStatus: getUtilizationStatus(utilizationPct),
          linkedLoans: (links ?? []).map(rowToLink),
        });
      }
      return results;
    } catch {
      return [];
    }
  },
};
