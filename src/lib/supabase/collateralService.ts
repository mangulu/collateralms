'use client';

import { createClient } from '@/lib/supabase/client';
import { complianceEngineService } from '@/lib/supabase/complianceEngineService';

export type CollateralStatus =
  | 'Draft' | 'Submitted' | 'Under Review' | 'Perfected' | 'Monitoring' | 'Released' | 'Overdue' | 'Rejected';

export type CollateralType =
  | 'Mortgage' | 'Debenture' | 'Motor Vehicle' | 'Shares (DSE)' | 'FDR' | 'Guarantee' | 'Ship/Vessel';

export type RegistryType =
  | 'BRELA' | 'Lands Registry' | 'TRA' | 'DSE' | 'TASAC' | 'N/A';

export type CollateralWriteErrorKind =
  | 'network'        // fetch/connection failure
  | 'constraint'     // unique/FK/check constraint violation (23xxx)
  | 'auth'           // RLS / permission denied (42501 / PGRST301)
  | 'schema'         // missing column/table (42xxx)
  | 'validation'     // BRELA or app-level validation
  | 'unknown';

export class CollateralWriteError extends Error {
  kind: CollateralWriteErrorKind;
  retryable: boolean;
  userMessage: string;

  constructor(kind: CollateralWriteErrorKind, message: string, userMessage: string) {
    super(message);
    this.name = 'CollateralWriteError';
    this.kind = kind;
    this.retryable = kind === 'network' || kind === 'unknown';
    this.userMessage = userMessage;
  }
}

export interface CollateralRecord {
  id: string;
  collateralId: string;
  obligor: string;
  obligorId: string;
  obligorRefId?: string | null;
  type: CollateralType;
  description: string;
  valueTSh: number;
  facilityId: string;
  status: CollateralStatus;
  registry: RegistryType;
  registrationDate: string;
  perfectionDeadline: string;
  assignedOfficer: string;
  requiresPerfection: boolean;
  daysToDeadline: number | null;
  createdBy?: string;
  createdAt?: string;
  updatedAt?: string;
  // Financial health fields
  valuationAmount?: number | null;
  ltvRatio?: number | null;
  maxSecurableAmount?: number | null;
  availableEquity?: number | null;
  // Geo fields
  latitude?: number | null;
  longitude?: number | null;
  locationAddress?: string | null;
}

function classifySupabaseError(error: any): CollateralWriteError {
  if (!error) {
    return new CollateralWriteError('unknown', 'Unknown error', 'An unexpected error occurred. Please try again.');
  }

  const code = error.code ?? '';
  const msg: string = error.message ?? '';

  // Network / connection errors
  if (
    msg.includes('Failed to fetch') ||
    msg.includes('NetworkError') ||
    msg.includes('network') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('timeout') ||
    code === 'PGRST000'
  ) {
    return new CollateralWriteError(
      'network',
      msg,
      'Network error — check your connection and try again.'
    );
  }

  // Auth / RLS errors
  if (code === '42501' || code === 'PGRST301' || msg.includes('permission denied') || msg.includes('row-level security')) {
    return new CollateralWriteError(
      'auth',
      msg,
      'You do not have permission to perform this action. Contact your administrator.'
    );
  }

  // Constraint violations (23xxx)
  if (code.startsWith('23')) {
    if (code === '23505') {
      // Unique constraint
      const brelaMatch = msg.match(/BRELA_VALIDATION:\s*(.+)/);
      if (brelaMatch) {
        return new CollateralWriteError('validation', msg, `BRELA_VALIDATION: ${brelaMatch[1].trim()}`);
      }
      if (msg.includes('collateral_id') || msg.includes('col-')) {
        return new CollateralWriteError(
          'constraint',
          msg,
          'A collateral record with this ID already exists. Please try saving again.'
        );
      }
      if (msg.includes('facility_id') || msg.includes('obligor_id')) {
        return new CollateralWriteError(
          'constraint',
          msg,
          'A duplicate record was detected. Check the Facility ID and Obligor ID for uniqueness.'
        );
      }
      return new CollateralWriteError(
        'constraint',
        msg,
        'A duplicate record was detected. Please review your inputs and try again.'
      );
    }
    if (code === '23503') {
      return new CollateralWriteError(
        'constraint',
        msg,
        'A referenced record (e.g. facility or obligor) does not exist. Verify your IDs.'
      );
    }
    if (code === '23514') {
      const brelaMatch = msg.match(/BRELA_VALIDATION:\s*(.+)/);
      if (brelaMatch) {
        return new CollateralWriteError('validation', msg, `BRELA_VALIDATION: ${brelaMatch[1].trim()}`);
      }
      return new CollateralWriteError(
        'constraint',
        msg,
        'A data constraint was violated. Please review your inputs.'
      );
    }
    return new CollateralWriteError(
      'constraint',
      msg,
      'A database constraint was violated. Please review your inputs and try again.'
    );
  }

  // Schema errors (42xxx)
  if (
    code.startsWith('42') ||
    /relation.*does not exist/i.test(msg) ||
    /column.*does not exist/i.test(msg)
  ) {
    return new CollateralWriteError(
      'schema',
      msg,
      'A database configuration error occurred. Please contact support.'
    );
  }

  // BRELA validation in message
  const brelaMatch = msg.match(/BRELA_VALIDATION:\s*(.+)/);
  if (brelaMatch) {
    return new CollateralWriteError('validation', msg, `BRELA_VALIDATION: ${brelaMatch[1].trim()}`);
  }

  return new CollateralWriteError('unknown', msg || 'Unknown error', 'An unexpected error occurred. Please try again.');
}

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const errorClass = error.code.substring(0, 2);
    if (errorClass === '42') return true;
    if (errorClass === '23') return false;
    if (errorClass === '08') return true;
  }
  if (error.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
      /type.*does not exist/i,
    ];
    return schemaErrorPatterns.some((p) => p.test(error.message));
  }
  return false;
}

/** Exponential-backoff retry for retryable write operations */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelayMs = 600
): Promise<T> {
  let lastError: any;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      // Only retry if it's a CollateralWriteError and retryable
      if (err instanceof CollateralWriteError && !err.retryable) throw err;
      // Don't retry on last attempt
      if (attempt === maxAttempts) break;
      await new Promise((res) => setTimeout(res, baseDelayMs * Math.pow(2, attempt - 1)));
    }
  }
  throw lastError;
}

function rowToCollateral(row: any): CollateralRecord {
  return {
    id: row.id,
    collateralId: row.collateral_id,
    obligor: row.obligor,
    obligorId: row.obligor_id,
    obligorRefId: row.obligor_ref_id ?? null,
    type: row.collateral_type as CollateralType,
    description: row.description,
    valueTSh: parseInt(String(row.value_tsh ?? '0').replace(/,/g, ''), 10) || 0,
    facilityId: row.facility_id,
    status: row.status as CollateralStatus,
    registry: row.registry as RegistryType,
    registrationDate: row.registration_date ?? '',
    perfectionDeadline: row.perfection_deadline ?? '',
    assignedOfficer: row.assigned_officer ?? '',
    requiresPerfection: row.requires_perfection,
    daysToDeadline: row.days_to_deadline ?? null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    // Financial health fields
    valuationAmount: row.valuation_amount != null ? parseFloat(row.valuation_amount) || null : null,
    ltvRatio: row.ltv_ratio != null ? parseFloat(row.ltv_ratio) || null : null,
    maxSecurableAmount: row.max_securable_amount != null ? parseFloat(row.max_securable_amount) || null : null,
    availableEquity: row.available_equity != null ? parseFloat(row.available_equity) || null : null,
    // Geo fields
    latitude: row.latitude != null ? parseFloat(row.latitude) : null,
    longitude: row.longitude != null ? parseFloat(row.longitude) : null,
    locationAddress: row.location_address ?? null,
    loanId: row.loan_id ?? null,
  } as any;
}

function collateralToRow(data: Partial<CollateralRecord>) {
  const row: any = {};
  if (data.collateralId !== undefined) row.collateral_id = data.collateralId;
  if (data.obligor !== undefined) row.obligor = data.obligor;
  if (data.obligorId !== undefined) row.obligor_id = data.obligorId;
  if (data.obligorRefId !== undefined) row.obligor_ref_id = data.obligorRefId;
  if (data.type !== undefined) row.collateral_type = data.type;
  if (data.description !== undefined) row.description = data.description;
  if (data.valueTSh !== undefined) row.value_tsh = String(data.valueTSh);
  if (data.facilityId !== undefined) row.facility_id = data.facilityId;
  if (data.status !== undefined) row.status = data.status;
  if (data.registry !== undefined) row.registry = data.registry;
  if (data.registrationDate !== undefined) row.registration_date = data.registrationDate;
  if (data.perfectionDeadline !== undefined) row.perfection_deadline = data.perfectionDeadline;
  if (data.assignedOfficer !== undefined) row.assigned_officer = data.assignedOfficer;
  if (data.requiresPerfection !== undefined) row.requires_perfection = data.requiresPerfection;
  if (data.daysToDeadline !== undefined) row.days_to_deadline = data.daysToDeadline;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  if (data.latitude !== undefined) row.latitude = data.latitude;
  if (data.longitude !== undefined) row.longitude = data.longitude;
  if (data.locationAddress !== undefined) row.location_address = data.locationAddress;
  if ((data as any).loanId !== undefined) row.loan_id = (data as any).loanId;
  return row;
}

export const collateralService = {
  async getAll(): Promise<CollateralRecord[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        console.log('Fetch error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToCollateral);
    } catch (err: any) {
      console.log('Schema error:', err.message);
      throw err;
    }
  },

  async getById(id: string): Promise<CollateralRecord | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }
      return data ? rowToCollateral(data) : null;
    } catch (err: any) {
      throw err;
    }
  },

  async create(record: Partial<CollateralRecord>, userId: string): Promise<CollateralRecord> {
    const supabase = createClient();

    const doInsert = async (): Promise<CollateralRecord> => {
      const timestamp = Date.now();
      const suffix = String(timestamp).slice(-6);
      const collateralId = `col-${suffix}`;

      const row = collateralToRow({
        ...record,
        collateralId,
        status: 'Draft',
        daysToDeadline: record.requiresPerfection ? 42 : null,
        createdBy: userId,
      });

      const { data, error } = await supabase
        .from('collateral_records')
        .insert(row)
        .select()
        .single();

      if (error) {
        throw classifySupabaseError(error);
      }
      if (!data) {
        throw new CollateralWriteError('unknown', 'No data returned after insert', 'Failed to create record. Please try again.');
      }
      const created = rowToCollateral(data);
      complianceEngineService.runForCollateral(created.id).catch(() => {});
      return created;
    };

    return withRetry(doInsert, 3, 600);
  },

  async update(id: string, record: Partial<CollateralRecord>): Promise<CollateralRecord> {
    const supabase = createClient();

    const doUpdate = async (): Promise<CollateralRecord> => {
      const row = collateralToRow(record);
      const { data, error } = await supabase
        .from('collateral_records')
        .update(row)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        throw classifySupabaseError(error);
      }
      if (!data) {
        throw new CollateralWriteError('unknown', 'No data returned after update', 'Failed to update record. Please try again.');
      }
      const updated = rowToCollateral(data);
      complianceEngineService.runForCollateral(updated.id).catch(() => {});
      return updated;
    };

    return withRetry(doUpdate, 3, 600);
  },

  async updateStatus(id: string, status: CollateralStatus): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('collateral_records')
        .update({ status })
        .eq('id', id);

      if (error) {
        if (isSchemaError(error)) throw error;
        return false;
      }
      return true;
    } catch (err: any) {
      throw err;
    }
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('collateral_records')
        .delete()
        .eq('id', id);

      if (error) {
        if (isSchemaError(error)) throw error;
        return false;
      }
      return true;
    } catch (err: any) {
      throw err;
    }
  },

  async deleteMany(ids: string[]): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('collateral_records')
        .delete()
        .in('id', ids);

      if (error) {
        if (isSchemaError(error)) throw error;
        return false;
      }
      return true;
    } catch (err: any) {
      throw err;
    }
  },

  /**
   * Active (non-Perfected, non-Released) collaterals whose days_to_deadline
   * falls within +/-1 day of daysBeforeDeadline, or overdue when negative.
   */
  async getByDeadlineWindow(daysBeforeDeadline: number, limit = 20): Promise<CollateralRecord[]> {
    const supabase = createClient();
    try {
      let query = supabase
        .from('collateral_records')
        .select('*')
        .not('status', 'eq', 'Perfected')
        .not('status', 'eq', 'Released');

      if (daysBeforeDeadline < 0) {
        query = query.lt('days_to_deadline', 0);
      } else {
        query = query
          .gte('days_to_deadline', daysBeforeDeadline - 1)
          .lte('days_to_deadline', daysBeforeDeadline + 1);
      }

      const { data, error } = await query.limit(limit);
      if (error) {
        if (isSchemaError(error)) throw error;
        console.log('Fetch error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToCollateral);
    } catch (err: any) {
      console.log('Schema error:', err.message);
      throw err;
    }
  },
};

export const dashboardService = {
  async getKPIStats() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('status, requires_perfection, days_to_deadline, value_tsh');

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }

      const records = data ?? [];
      const total = records.length;
      const perfected = records.filter((r) => r.status === 'Perfected').length;
      const overdue = records.filter((r) => r.status === 'Overdue').length;
      const approachingDeadline = records.filter(
        (r) => r.days_to_deadline !== null && r.days_to_deadline >= 0 && r.days_to_deadline <= 7
      ).length;
      const pendingReview = records.filter(
        (r) => r.status === 'Under Review' || r.status === 'Submitted'
      ).length;
      const perfectionRate = total > 0 ? ((perfected / total) * 100).toFixed(1) : '0.0';

      return {
        total,
        perfected,
        overdue,
        approachingDeadline,
        pendingReview,
        perfectionRate,
      };
    } catch (err: any) {
      throw err;
    }
  },

  async getOverdueItems() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('*')
        .eq('status', 'Overdue')
        .order('days_to_deadline', { ascending: true })
        .limit(10);

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data ?? []).map(rowToCollateral);
    } catch (err: any) {
      throw err;
    }
  },

  async getTypeDistribution() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('collateral_type, status');

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }

      const counts: Record<string, number> = {};
      (data ?? []).forEach((r) => {
        counts[r.collateral_type] = (counts[r.collateral_type] ?? 0) + 1;
      });

      return Object.entries(counts).map(([type, count]) => ({ type, count }));
    } catch (err: any) {
      throw err;
    }
  },

  async getPerfectionTrend(): Promise<{ month: string; perfected: number; submitted: number; overdue: number }[]> {
    const supabase = createClient();
    try {
      // Build last 6 months array
      const months: { key: string; label: string; start: string; end: string }[] = [];
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
        const end = new Date(d.getFullYear(), d.getMonth() + 1, 1).toISOString();
        const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
        months.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label, start, end });
      }

      const earliest = months[0].start;

      const { data, error } = await supabase
        .from('audit_logs')
        .select('action, created_at')
        .in('action', ['perfected', 'submitted', 'overdue'])
        .gte('created_at', earliest)
        .order('created_at', { ascending: true });

      if (error) {
        if (isSchemaError(error)) throw error;
        return months.map((m) => ({ month: m.label, perfected: 0, submitted: 0, overdue: 0 }));
      }

      const rows = data ?? [];

      return months.map((m) => {
        const inMonth = rows.filter((r) => r.created_at >= m.start && r.created_at < m.end);
        return {
          month: m.label,
          perfected: inMonth.filter((r) => r.action === 'perfected').length,
          submitted: inMonth.filter((r) => r.action === 'submitted').length,
          overdue: inMonth.filter((r) => r.action === 'overdue').length,
        };
      });
    } catch (err: any) {
      throw err;
    }
  },

  /** Real portfolio-wide stats for Portfolio Monitoring's KPI strip (was previously Math.random()). */
  async getPortfolioMonitoringMetrics() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('id, status, days_to_deadline, value_tsh, valuation_amount, max_securable_amount, loan_id');

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }

      const records = data ?? [];
      const total = records.length;

      const totalValue = records.reduce((sum, r: any) => {
        const dedicated = parseFloat(r.valuation_amount) || 0;
        const legacy = typeof r.value_tsh === 'string' ? parseFloat(r.value_tsh.replace(/,/g, '')) || 0 : parseFloat(r.value_tsh) || 0;
        return sum + (dedicated > 0 ? dedicated : legacy);
      }, 0);

      const perfected = records.filter((r) => r.status === 'Perfected').length;
      const perfectionRate = total > 0 ? ((perfected / total) * 100).toFixed(1) : '0.0';
      const overdueFilings = records.filter((r) => r.status === 'Overdue').length;
      const pendingPerfection = records.filter((r) => r.status === 'Under Review' || r.status === 'Submitted').length;

      // Utilization = total currently secured / total max securable, across
      // collaterals with a securable-amount ceiling set. Recomputed from
      // collateral_loan_links (not the cached total_secured_amount column)
      // for the same reason collateralLinkService.getUtilization() does.
      const withCeiling = records.filter((r: any) => (parseFloat(r.max_securable_amount) || 0) > 0);
      let utilizationPercentage = 0;
      if (withCeiling.length > 0) {
        const { data: links } = await supabase
          .from('collateral_loan_links')
          .select('collateral_id, allocated_amount')
          .eq('status', 'ACTIVE')
          .in('collateral_id', withCeiling.map((r) => r.id));
        const securedByCollateral = new Map<string, number>();
        (links ?? []).forEach((l: any) => {
          securedByCollateral.set(l.collateral_id, (securedByCollateral.get(l.collateral_id) ?? 0) + (parseFloat(l.allocated_amount) || 0));
        });
        const totalSecured = withCeiling.reduce((sum, r: any) => sum + (securedByCollateral.get(r.id) ?? 0), 0);
        const totalMaxSecurable = withCeiling.reduce((sum, r: any) => sum + (parseFloat(r.max_securable_amount) || 0), 0);
        utilizationPercentage = totalMaxSecurable > 0 ? (totalSecured / totalMaxSecurable) * 100 : 0;
      }

      // Delinquency = share of collaterals whose linked loan is Defaulted.
      const loanIds = [...new Set(records.map((r: any) => r.loan_id).filter(Boolean))];
      let delinquencyRate = 0;
      if (loanIds.length > 0) {
        const { data: loans } = await supabase.from('loans').select('id, loan_status').in('id', loanIds);
        const defaultedIds = new Set((loans ?? []).filter((l: any) => l.loan_status === 'Defaulted').map((l: any) => l.id));
        const linkedCount = records.filter((r: any) => r.loan_id).length;
        const delinquentCount = records.filter((r: any) => r.loan_id && defaultedIds.has(r.loan_id)).length;
        delinquencyRate = linkedCount > 0 ? (delinquentCount / linkedCount) * 100 : 0;
      }

      return {
        total,
        totalValue,
        utilizationPercentage,
        perfectionRate,
        overdueFilings,
        pendingPerfection,
        delinquencyRate,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      throw err;
    }
  },

  /** Average days from submission to decision per registry, for Portfolio Monitoring's Turnaround Time tab. */
  async getRegistryTurnaround() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('perfection_requests')
        .select('registry, submitted_at, reviewed_at')
        .not('submitted_at', 'is', null)
        .not('reviewed_at', 'is', null);

      if (error) {
        if (isSchemaError(error)) throw error;
        return {};
      }

      const totalsByRegistry: Record<string, { sumDays: number; count: number }> = {};
      (data ?? []).forEach((r: any) => {
        if (!r.registry) return;
        const days = (new Date(r.reviewed_at).getTime() - new Date(r.submitted_at).getTime()) / (1000 * 60 * 60 * 24);
        if (days < 0) return;
        const bucket = totalsByRegistry[r.registry] ?? { sumDays: 0, count: 0 };
        bucket.sumDays += days;
        bucket.count += 1;
        totalsByRegistry[r.registry] = bucket;
      });

      const avgByRegistry: Record<string, number | null> = {};
      Object.entries(totalsByRegistry).forEach(([registry, { sumDays, count }]) => {
        avgByRegistry[registry] = count > 0 ? Math.round((sumDays / count) * 10) / 10 : null;
      });
      return avgByRegistry;
    } catch (err: any) {
      throw err;
    }
  },

  /** LTV risk-band distribution across the portfolio, for the Dashboard's LTV/Risk Exposure widget. */
  async getLTVExposure() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('ltv_ratio')
        .not('ltv_ratio', 'is', null);

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }

      const rows = data ?? [];
      const total = rows.length;
      let critical = 0, high = 0, elevated = 0, healthy = 0, sum = 0;
      rows.forEach((r: any) => {
        const pct = (parseFloat(r.ltv_ratio) || 0) * 100;
        sum += pct;
        if (pct > 90) critical++;
        else if (pct > 75) high++;
        else if (pct > 60) elevated++;
        else healthy++;
      });

      return {
        total,
        critical,
        high,
        elevated,
        healthy,
        avgLtv: total > 0 ? sum / total : 0,
      };
    } catch (err: any) {
      throw err;
    }
  },

  /** Top obligors by pledged collateral value, for the Dashboard's Obligor Concentration widget. */
  async getObligorConcentration(limit = 5) {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('obligor_ref_id, obligor, value_tsh, valuation_amount');

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }

      const rows = data ?? [];
      const byObligor = new Map<string, { name: string; value: number }>();
      let portfolioTotal = 0;

      rows.forEach((r: any) => {
        const dedicated = parseFloat(r.valuation_amount) || 0;
        const legacy = typeof r.value_tsh === 'string' ? parseFloat(r.value_tsh.replace(/,/g, '')) || 0 : parseFloat(r.value_tsh) || 0;
        const value = dedicated > 0 ? dedicated : legacy;
        portfolioTotal += value;

        // Group by the real obligor FK when set; fall back to the free-text
        // name for older records that predate obligor_ref_id.
        const key = r.obligor_ref_id ?? `name:${r.obligor ?? 'Unknown'}`;
        const existing = byObligor.get(key);
        if (existing) existing.value += value;
        else byObligor.set(key, { name: r.obligor ?? 'Unknown', value });
      });

      // Resolve real names for FK-linked obligors (in case the free-text
      // `obligor` column has drifted from the canonical obligors row).
      const realIds = [...byObligor.keys()].filter((k) => !k.startsWith('name:'));
      if (realIds.length > 0) {
        const { data: obligorRows } = await supabase.from('obligors').select('id, full_name').in('id', realIds);
        (obligorRows ?? []).forEach((o: any) => {
          const entry = byObligor.get(o.id);
          if (entry) entry.name = o.full_name;
        });
      }

      const sorted = [...byObligor.values()]
        .map((v) => ({ name: v.name, value: v.value, pct: portfolioTotal > 0 ? (v.value / portfolioTotal) * 100 : 0 }))
        .sort((a, b) => b.value - a.value);

      const top = sorted.slice(0, limit);
      const top5Value = sorted.slice(0, 5).reduce((s, o) => s + o.value, 0);
      const top5ConcentrationPct = portfolioTotal > 0 ? (top5Value / portfolioTotal) * 100 : 0;

      return {
        obligors: top,
        portfolioTotal,
        top5ConcentrationPct,
        obligorCount: byObligor.size,
      };
    } catch (err: any) {
      throw err;
    }
  },

  /** Real per-stage counts for the Module Hub's Collateral Lifecycle map. */
  async getLifecycleStageCounts() {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_records')
        .select('id, status, valuation_amount, value_tsh, loan_id, ltv_ratio');

      if (error) {
        if (isSchemaError(error)) throw error;
        return null;
      }

      const rows = data ?? [];

      const origination = rows.filter((r) => r.status === 'Draft').length;

      const pendingValuation = rows.filter((r: any) => {
        const dedicated = parseFloat(r.valuation_amount) || 0;
        const legacy = typeof r.value_tsh === 'string' ? parseFloat(r.value_tsh.replace(/,/g, '')) || 0 : parseFloat(r.value_tsh) || 0;
        return dedicated <= 0 && legacy <= 0;
      }).length;

      const overdue = rows.filter((r) => r.status === 'Overdue').length;

      const atRisk = rows.filter((r: any) => {
        if (r.ltv_ratio == null) return false;
        return (parseFloat(r.ltv_ratio) || 0) * 100 > 75;
      }).length;

      // Release-ready: an ACTIVE collateral_loan_links row whose collateral's
      // linked loan has actually closed (same real check as Batch Release).
      const loanIds = [...new Set(rows.map((r: any) => r.loan_id).filter(Boolean))];
      let releaseReady = 0;
      if (loanIds.length > 0) {
        const [{ data: closedLoans }, { data: activeLinks }] = await Promise.all([
          supabase.from('loans').select('id').eq('loan_status', 'Closed').in('id', loanIds),
          supabase.from('collateral_loan_links').select('collateral_id').eq('status', 'ACTIVE'),
        ]);
        const closedIds = new Set((closedLoans ?? []).map((l: any) => l.id));
        const activeLinkedIds = new Set((activeLinks ?? []).map((l: any) => l.collateral_id));
        releaseReady = rows.filter((r: any) => r.loan_id && closedIds.has(r.loan_id) && activeLinkedIds.has(r.id)).length;
      }

      const { count: archived } = await supabase
        .from('archive_placements')
        .select('id', { count: 'exact', head: true });

      return {
        origination,
        pendingValuation,
        overdue,
        atRisk,
        releaseReady,
        archived: archived ?? 0,
      };
    } catch (err: any) {
      throw err;
    }
  },
};

export { createClient };