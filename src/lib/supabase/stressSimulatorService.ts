'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StressPortfolioPosition {
  id: string;
  collateralRef: string;
  obligorName: string;
  collateralType: string;
  currentValue: number;
  loanExposure: number;
  currentLTV: number;
  ltvThreshold: number;
  haircut: number;
  assetClass: 'Real Estate' | 'Equities' | 'Motor Vehicle' | 'Fixed Deposit' | 'Debenture' | 'Guarantee';
}

// ─── Collateral type → asset class mapping ────────────────────────────────────

const COLLATERAL_TYPE_TO_ASSET_CLASS: Record<string, StressPortfolioPosition['assetClass']> = {
  'Mortgage': 'Real Estate',
  'Debenture': 'Debenture',
  'Motor Vehicle': 'Motor Vehicle',
  'Shares (DSE)': 'Equities',
  'FDR': 'Fixed Deposit',
  'Guarantee': 'Guarantee',
  'Ship/Vessel': 'Motor Vehicle',
  // Haircut schedule class names
  'Real Estate': 'Real Estate',
  'Equities': 'Equities',
  'Fixed Deposit': 'Fixed Deposit',
  'Government Securities': 'Fixed Deposit',
  'Corporate Bonds': 'Debenture',
};

// ─── LTV threshold by collateral type (BOT-prescribed defaults) ───────────────

const DEFAULT_LTV_THRESHOLD: Record<string, number> = {
  'Mortgage': 75,
  'Debenture': 80,
  'Motor Vehicle': 80,
  'Shares (DSE)': 65,
  'FDR': 90,
  'Guarantee': 85,
  'Ship/Vessel': 75,
};

const FALLBACK_LTV_THRESHOLD = 75;

// ─── Default haircut by collateral type (fallback if no haircut schedule) ─────

const DEFAULT_HAIRCUT: Record<string, number> = {
  'Mortgage': 20,
  'Debenture': 15,
  'Motor Vehicle': 25,
  'Shares (DSE)': 40,
  'FDR': 5,
  'Guarantee': 10,
  'Ship/Vessel': 25,
};

function resolveAssetClass(collateralType: string): StressPortfolioPosition['assetClass'] {
  return COLLATERAL_TYPE_TO_ASSET_CLASS[collateralType] ?? 'Real Estate';
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const stressSimulatorService = {
  /**
   * Fetch live collateral portfolio positions for stress simulation.
   * Joins collateral_records → loans → obligors.
   * Only includes records with a valuation_amount > 0 and a linked loan.
   */
  async fetchPortfolio(): Promise<StressPortfolioPosition[]> {
    const supabase = createClient();

    // Fetch haircut schedules to use real rates
    const { data: haircutRows } = await supabase
      .from('haircut_schedules')
      .select('collateral_class, haircut_rate')
      .eq('is_active', true);

    const haircutByClass: Record<string, number> = {};
    if (haircutRows) {
      for (const row of haircutRows) {
        haircutByClass[row.collateral_class] = Math.round(parseFloat(row.haircut_rate) * 100);
      }
    }

    // Fetch collateral records with linked loan and obligor
    const { data: rows, error } = await supabase
      .from('collateral_records')
      .select(`
        id,
        collateral_id,
        obligor,
        collateral_type,
        valuation_amount,
        ltv_ratio,
        total_secured_amount,
        max_securable_amount,
        status,
        loan_id,
        loans (
          id,
          loan_number,
          outstanding_balance,
          facility_amount,
          obligor_id,
          obligors (
            id,
            full_name
          )
        )
      `)
      .not('valuation_amount', 'is', null)
      .gt('valuation_amount', 0)
      .not('status', 'eq', 'Released')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[stressSimulatorService] fetchPortfolio error:', error);
      return [];
    }

    if (!rows || rows.length === 0) return [];

    const positions: StressPortfolioPosition[] = [];

    for (const row of rows) {
      const currentValue = parseFloat(row.valuation_amount ?? 0);
      if (currentValue <= 0) continue;

      // Determine loan exposure: prefer outstanding_balance, fallback to total_secured_amount or facility_amount
      const loan = row.loans as any;
      let loanExposure = 0;
      if (loan) {
        loanExposure =
          parseFloat(loan.outstanding_balance ?? 0) ||
          parseFloat(loan.facility_amount ?? 0) ||
          parseFloat(row.total_secured_amount ?? 0);
      } else {
        loanExposure = parseFloat(row.total_secured_amount ?? 0);
      }

      // Skip positions with no loan exposure (can't compute LTV)
      if (loanExposure <= 0) continue;

      const collateralType: string = row.collateral_type ?? 'Mortgage';
      const assetClass = resolveAssetClass(collateralType);

      // Haircut: prefer live haircut schedule, fallback to defaults
      const haircut =
        haircutByClass[collateralType] ??
        haircutByClass[assetClass] ??
        DEFAULT_HAIRCUT[collateralType] ??
        20;

      // LTV: compute from live data
      const currentLTV = (loanExposure / currentValue) * 100;

      // LTV threshold: use stored ltv_ratio if available (stored as decimal 0-1), else BOT defaults
      const storedLtvRatio = row.ltv_ratio != null ? parseFloat(row.ltv_ratio) : null;
      const ltvThreshold =
        storedLtvRatio != null && storedLtvRatio > 0
          ? storedLtvRatio * 100
          : DEFAULT_LTV_THRESHOLD[collateralType] ?? FALLBACK_LTV_THRESHOLD;

      // Obligor name: prefer joined obligors.full_name, fallback to collateral_records.obligor
      const obligorName =
        (loan?.obligors as any)?.full_name ||
        row.obligor ||
        'Unknown Obligor';

      positions.push({
        id: row.id,
        collateralRef: row.collateral_id ?? row.id,
        obligorName,
        collateralType,
        currentValue,
        loanExposure,
        currentLTV,
        ltvThreshold,
        haircut,
        assetClass,
      });
    }

    return positions;
  },
};
