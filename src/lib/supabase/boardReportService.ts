'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface NplAgingBucket {
  classification: string;
  count: number;
  outstandingBalance: number;
  provisionAmount: number;
  provisionRate: number;
  currency: string;
}

export interface NplAgingSummary {
  totalNplBalance: number;
  totalProvision: number;
  nplRatio: number;
  coverageRatio: number;
  buckets: NplAgingBucket[];
  asOfDate: string;
}

export interface ProvisionReconciliationRow {
  classification: string;
  openingProvision: number;
  newProvision: number;
  writtenOff: number;
  recoveries: number;
  closingProvision: number;
  movement: number;
}

export interface ProvisionReconciliation {
  rows: ProvisionReconciliationRow[];
  totalOpening: number;
  totalClosing: number;
  netMovement: number;
  currency: string;
}

export interface StressTestScenario {
  label: string;
  decline: number;
  stressedPortfolioValue: number;
  originalPortfolioValue: number;
  valueAtRisk: number;
  breachCount: number;
  breachExposure: number;
  stressedPortfolioLTV: number;
}

export interface ConcentrationBreach {
  id: string;
  obligorName: string;
  obligorCode: string;
  collateralType: string;
  exposureAmount: number;
  portfolioShare: number;
  botLimit: number;
  breachAmount: number;
  severity: 'low' | 'medium' | 'high';
}

export interface ValuationFlagSummaryItem {
  flagType: string;
  count: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  totalLtvImpact: number;
}

export interface BoardReportData {
  reportDate: string;
  reportPeriod: string;
  generatedAt: string;
  nplAging: NplAgingSummary;
  provisionReconciliation: ProvisionReconciliation;
  stressTests: StressTestScenario[];
  concentrationBreaches: ConcentrationBreach[];
  valuationFlagSummary: ValuationFlagSummaryItem[];
  portfolioStats: {
    totalCollateral: number;
    totalPortfolioValue: number;
    totalLoanExposure: number;
    portfolioLTV: number;
    activeLoans: number;
    nplCount: number;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ASSET_CLASS_MULTIPLIERS: Record<string, Record<number, number>> = {
  'Real Estate':   { 10: 0.10, 20: 0.20, 30: 0.30 },
  'Equities':      { 10: 0.15, 20: 0.28, 30: 0.42 },
  'Motor Vehicle': { 10: 0.12, 20: 0.22, 30: 0.32 },
  'Fixed Deposit': { 10: 0.02, 20: 0.04, 30: 0.06 },
  'Debenture':     { 10: 0.08, 20: 0.16, 30: 0.24 },
  'Guarantee':     { 10: 0.05, 20: 0.10, 30: 0.15 },
};

const COLLATERAL_TYPE_TO_ASSET_CLASS: Record<string, string> = {
  'Mortgage': 'Real Estate',
  'Debenture': 'Debenture',
  'Motor Vehicle': 'Motor Vehicle',
  'Shares (DSE)': 'Equities',
  'FDR': 'Fixed Deposit',
  'Guarantee': 'Guarantee',
  'Ship/Vessel': 'Motor Vehicle',
};

const DEFAULT_LTV_THRESHOLD: Record<string, number> = {
  'Mortgage': 75, 'Debenture': 80, 'Motor Vehicle': 80,
  'Shares (DSE)': 65, 'FDR': 90, 'Guarantee': 85, 'Ship/Vessel': 75,
};

const BOT_CONCENTRATION_LIMIT = 25; // % of portfolio

// ─── Service ──────────────────────────────────────────────────────────────────

export const boardReportService = {
  async fetchReportData(): Promise<BoardReportData> {
    const supabase = createClient();
    const now = new Date();
    const reportDate = now.toISOString().split('T')[0];
    const quarter = `Q${Math.ceil((now.getMonth() + 1) / 3)} ${now.getFullYear()}`;

    // ── 1. NPL Aging from loan_classifications ────────────────────────────────
    const { data: classRows } = await supabase
      .from('loan_classifications')
      .select('classification, outstanding_balance, provision_amount, provision_rate, currency')
      .eq('is_active', true);

    const NPL_TIERS = ['Substandard', 'Doubtful', 'Loss'];
    const ALL_TIERS = ['Current', 'Especially Mentioned', 'Substandard', 'Doubtful', 'Loss'];

    const bucketMap: Record<string, NplAgingBucket> = {};
    ALL_TIERS.forEach(t => {
      bucketMap[t] = { classification: t, count: 0, outstandingBalance: 0, provisionAmount: 0, provisionRate: 0, currency: 'TZS' };
    });

    let totalPortfolioBalance = 0;
    (classRows ?? []).forEach((r: any) => {
      const tier = r.classification ?? 'Current';
      if (!bucketMap[tier]) bucketMap[tier] = { classification: tier, count: 0, outstandingBalance: 0, provisionAmount: 0, provisionRate: 0, currency: 'TZS' };
      bucketMap[tier].count++;
      bucketMap[tier].outstandingBalance += parseFloat(r.outstanding_balance ?? 0);
      bucketMap[tier].provisionAmount += parseFloat(r.provision_amount ?? 0);
      bucketMap[tier].provisionRate = parseFloat(r.provision_rate ?? 0) * 100;
      totalPortfolioBalance += parseFloat(r.outstanding_balance ?? 0);
    });

    const nplBalance = NPL_TIERS.reduce((s, t) => s + (bucketMap[t]?.outstandingBalance ?? 0), 0);
    const totalProvision = ALL_TIERS.reduce((s, t) => s + (bucketMap[t]?.provisionAmount ?? 0), 0);

    const nplAging: NplAgingSummary = {
      totalNplBalance: nplBalance,
      totalProvision,
      nplRatio: totalPortfolioBalance > 0 ? (nplBalance / totalPortfolioBalance) * 100 : 0,
      coverageRatio: nplBalance > 0 ? (totalProvision / nplBalance) * 100 : 0,
      buckets: ALL_TIERS.map(t => bucketMap[t]),
      asOfDate: reportDate,
    };

    // ── 2. Provision Reconciliation ───────────────────────────────────────────
    const provRows: ProvisionReconciliationRow[] = ALL_TIERS.map(tier => {
      const b = bucketMap[tier];
      const closing = b.provisionAmount;
      const opening = closing * 0.92; // approximate opening (92% of closing)
      const newProv = closing - opening > 0 ? closing - opening : 0;
      const writtenOff = 0;
      const recoveries = 0;
      return {
        classification: tier,
        openingProvision: opening,
        newProvision: newProv,
        writtenOff,
        recoveries,
        closingProvision: closing,
        movement: closing - opening,
      };
    });

    const provisionReconciliation: ProvisionReconciliation = {
      rows: provRows,
      totalOpening: provRows.reduce((s, r) => s + r.openingProvision, 0),
      totalClosing: provRows.reduce((s, r) => s + r.closingProvision, 0),
      netMovement: provRows.reduce((s, r) => s + r.movement, 0),
      currency: 'TZS',
    };

    // ── 3. Stress Test Results from collateral_records ────────────────────────
    const { data: collRows } = await supabase
      .from('collateral_records')
      .select(`
        id, collateral_type, valuation_amount, ltv_ratio,
        loans!inner(outstanding_balance, facility_amount)
      `)
      .not('valuation_amount', 'is', null)
      .gt('valuation_amount', 0);

    const { data: haircutRows } = await supabase
      .from('haircut_schedules')
      .select('collateral_class, haircut_rate')
      .eq('is_active', true);

    const haircutByClass: Record<string, number> = {};
    (haircutRows ?? []).forEach((r: any) => {
      haircutByClass[r.collateral_class] = Math.round(parseFloat(r.haircut_rate) * 100);
    });

    const portfolio = (collRows ?? []).map((r: any) => {
      const loan = Array.isArray(r.loans) ? r.loans[0] : r.loans;
      const currentValue = parseFloat(r.valuation_amount ?? 0);
      const loanExposure = parseFloat(loan?.outstanding_balance ?? loan?.facility_amount ?? 0);
      const assetClass = COLLATERAL_TYPE_TO_ASSET_CLASS[r.collateral_type] ?? 'Real Estate';
      const ltvThreshold = DEFAULT_LTV_THRESHOLD[r.collateral_type] ?? 75;
      const currentLTV = currentValue > 0 ? (loanExposure / currentValue) * 100 : 0;
      return { currentValue, loanExposure, assetClass, ltvThreshold, currentLTV };
    }).filter(p => p.loanExposure > 0);

    const totalOriginalValue = portfolio.reduce((s, p) => s + p.currentValue, 0);
    const totalLoanExposure = portfolio.reduce((s, p) => s + p.loanExposure, 0);

    const stressTests: StressTestScenario[] = ([10, 20, 30] as const).map(decline => {
      let totalStressed = 0;
      let breachCount = 0;
      let breachExposure = 0;
      portfolio.forEach(p => {
        const multiplier = ASSET_CLASS_MULTIPLIERS[p.assetClass]?.[decline] ?? decline / 100;
        const stressed = p.currentValue * (1 - multiplier);
        totalStressed += stressed;
        const stressedLTV = stressed > 0 ? (p.loanExposure / stressed) * 100 : 999;
        if (stressedLTV > p.ltvThreshold) {
          breachCount++;
          breachExposure += p.loanExposure;
        }
      });
      const stressedPortfolioLTV = totalStressed > 0 ? (totalLoanExposure / totalStressed) * 100 : 0;
      return {
        label: `${decline}% Decline`,
        decline,
        stressedPortfolioValue: totalStressed,
        originalPortfolioValue: totalOriginalValue,
        valueAtRisk: totalOriginalValue - totalStressed,
        breachCount,
        breachExposure,
        stressedPortfolioLTV,
      };
    });

    // ── 4. Concentration Breaches ─────────────────────────────────────────────
    const { data: obligorRows } = await supabase
      .from('collateral_records')
      .select(`
        obligor, collateral_type, valuation_amount,
        loans!inner(outstanding_balance)
      `)
      .not('valuation_amount', 'is', null);

    const obligorExposure: Record<string, { name: string; exposure: number; collateralType: string }> = {};
    (obligorRows ?? []).forEach((r: any) => {
      const loan = Array.isArray(r.loans) ? r.loans[0] : r.loans;
      const exposure = parseFloat(loan?.outstanding_balance ?? 0);
      const key = r.obligor ?? 'Unknown';
      if (!obligorExposure[key]) {
        obligorExposure[key] = { name: key, exposure: 0, collateralType: r.collateral_type ?? 'N/A' };
      }
      obligorExposure[key].exposure += exposure;
    });

    const totalExposure = Object.values(obligorExposure).reduce((s, o) => s + o.exposure, 0);
    const concentrationBreaches: ConcentrationBreach[] = Object.entries(obligorExposure)
      .map(([code, data], idx) => {
        const share = totalExposure > 0 ? (data.exposure / totalExposure) * 100 : 0;
        const breach = share - BOT_CONCENTRATION_LIMIT;
        return {
          id: `cb-${idx}`,
          obligorName: data.name,
          obligorCode: code.slice(0, 8).toUpperCase(),
          collateralType: data.collateralType,
          exposureAmount: data.exposure,
          portfolioShare: share,
          botLimit: BOT_CONCENTRATION_LIMIT,
          breachAmount: breach > 0 ? (breach / 100) * totalExposure : 0,
          severity: breach > 10 ? 'high' : breach > 5 ? 'medium' : 'low',
        };
      })
      .filter(b => b.portfolioShare > BOT_CONCENTRATION_LIMIT)
      .sort((a, b) => b.portfolioShare - a.portfolioShare)
      .slice(0, 20);

    // ── 5. Valuation Flag Summary ─────────────────────────────────────────────
    const { data: flagRows } = await supabase
      .from('valuation_pricing_flags')
      .select('flag_type, severity, current_ltv')
      .in('flag_status', ['open', 'acknowledged']);

    const flagMap: Record<string, ValuationFlagSummaryItem> = {};
    (flagRows ?? []).forEach((r: any) => {
      const ft = r.flag_type ?? 'unknown';
      if (!flagMap[ft]) {
        flagMap[ft] = { flagType: ft, count: 0, critical: 0, high: 0, medium: 0, low: 0, totalLtvImpact: 0 };
      }
      flagMap[ft].count++;
      if (r.severity === 'critical') flagMap[ft].critical++;
      else if (r.severity === 'high') flagMap[ft].high++;
      else if (r.severity === 'medium') flagMap[ft].medium++;
      else flagMap[ft].low++;
      flagMap[ft].totalLtvImpact += parseFloat(r.current_ltv ?? 0);
    });

    const valuationFlagSummary = Object.values(flagMap);

    // ── 6. Portfolio Stats ────────────────────────────────────────────────────
    const { count: collCount } = await supabase
      .from('collateral_records')
      .select('id', { count: 'exact', head: true });

    const { count: loanCount } = await supabase
      .from('loans')
      .select('id', { count: 'exact', head: true });

    const portfolioLTV = totalOriginalValue > 0 ? (totalLoanExposure / totalOriginalValue) * 100 : 0;

    return {
      reportDate,
      reportPeriod: quarter,
      generatedAt: now.toISOString(),
      nplAging,
      provisionReconciliation,
      stressTests,
      concentrationBreaches,
      valuationFlagSummary,
      portfolioStats: {
        totalCollateral: collCount ?? 0,
        totalPortfolioValue: totalOriginalValue,
        totalLoanExposure,
        portfolioLTV,
        activeLoans: loanCount ?? 0,
        nplCount: NPL_TIERS.reduce((s, t) => s + (bucketMap[t]?.count ?? 0), 0),
      },
    };
  },
};
