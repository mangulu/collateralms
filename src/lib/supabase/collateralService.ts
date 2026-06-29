'use client';

import { createClient } from '@/lib/supabase/client';

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
  type: CollateralType;
  description: string;
  valueTSh: string;
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
}

export interface AuditLog {
  id: string;
  collateralRecordId?: string;
  collateralId?: string;
  action: string;
  message: string;
  detail: string;
  performedBy?: string;
  performedByName: string;
  createdAt: string;
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
    type: row.collateral_type as CollateralType,
    description: row.description,
    valueTSh: row.value_tsh,
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
  };
}

function collateralToRow(data: Partial<CollateralRecord>) {
  const row: any = {};
  if (data.collateralId !== undefined) row.collateral_id = data.collateralId;
  if (data.obligor !== undefined) row.obligor = data.obligor;
  if (data.obligorId !== undefined) row.obligor_id = data.obligorId;
  if (data.type !== undefined) row.collateral_type = data.type;
  if (data.description !== undefined) row.description = data.description;
  if (data.valueTSh !== undefined) row.value_tsh = data.valueTSh;
  if (data.facilityId !== undefined) row.facility_id = data.facilityId;
  if (data.status !== undefined) row.status = data.status;
  if (data.registry !== undefined) row.registry = data.registry;
  if (data.registrationDate !== undefined) row.registration_date = data.registrationDate;
  if (data.perfectionDeadline !== undefined) row.perfection_deadline = data.perfectionDeadline;
  if (data.assignedOfficer !== undefined) row.assigned_officer = data.assignedOfficer;
  if (data.requiresPerfection !== undefined) row.requires_perfection = data.requiresPerfection;
  if (data.daysToDeadline !== undefined) row.days_to_deadline = data.daysToDeadline;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
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
      return rowToCollateral(data);
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
      return rowToCollateral(data);
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
};

export const auditService = {
  async getRecent(limit = 8): Promise<AuditLog[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        if (isSchemaError(error)) throw error;
        return [];
      }
      return (data ?? []).map((row) => ({
        id: row.id,
        collateralRecordId: row.collateral_record_id,
        collateralId: row.collateral_id,
        action: row.action ?? row.event_category ?? 'updated',
        message: row.message,
        detail: row.detail ?? '',
        performedBy: row.performed_by,
        performedByName: row.performed_by_name ?? '',
        createdAt: row.created_at,
      }));
    } catch (err: any) {
      throw err;
    }
  },

  async log(entry: {
    collateralRecordId?: string;
    collateralId?: string;
    action: string;
    message: string;
    detail?: string;
    performedBy?: string;
    performedByName?: string;
  }): Promise<void> {
    const supabase = createClient();
    try {
      // Build insert payload — include action only if the column exists
      // We always include it; if the column is missing the insert will fail silently
      const payload: Record<string, any> = {
        collateral_record_id: entry.collateralRecordId ?? null,
        collateral_id: entry.collateralId ?? null,
        message: entry.message,
        detail: entry.detail ?? '',
        performed_by: entry.performedBy ?? null,
        performed_by_name: entry.performedByName ?? '',
        event_category: 'collateral_change',
      };

      // Include action field — the migration ensures this column exists
      payload.action = entry.action;

      const { error } = await supabase.from('audit_logs').insert(payload);
      if (error) {
        // If action column doesn't exist, retry without it
        if (error.message?.includes('action') || error.code === '42703') {
          const { action: _action, ...payloadWithoutAction } = payload;
          const { error: retryError } = await supabase.from('audit_logs').insert(payloadWithoutAction);
          if (retryError) {
            console.log('Audit log retry error:', retryError.message);
          }
          return;
        }
        if (isSchemaError(error)) throw error;
        console.log('Audit log error:', error.message);
      }
    } catch (err: any) {
      console.log('Audit log failed:', err.message);
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
};

export { createClient };