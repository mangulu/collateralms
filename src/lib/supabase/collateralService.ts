'use client';

import { createClient } from '@/lib/supabase/client';

export type CollateralStatus =
  | 'Draft' | 'Submitted' | 'Under Review' | 'Perfected' | 'Monitoring' | 'Released' | 'Overdue' | 'Rejected';

export type CollateralType =
  | 'Mortgage' | 'Debenture' | 'Motor Vehicle' | 'Shares (DSE)' | 'FDR' | 'Guarantee' | 'Ship/Vessel';

export type RegistryType =
  | 'BRELA' | 'Lands Registry' | 'TRA' | 'DSE' | 'TASAC' | 'N/A';

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

  async create(record: Partial<CollateralRecord>, userId: string): Promise<CollateralRecord | null> {
    const supabase = createClient();
    try {
      // Generate next collateral ID
      const { count } = await supabase
        .from('collateral_records')
        .select('*', { count: 'exact', head: true });

      const nextNum = (count ?? 0) + 313;
      const collateralId = `col-${String(nextNum).padStart(4, '0')}`;

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
        if (isSchemaError(error)) throw error;
        console.log('Insert error:', error.message);
        return null;
      }
      return data ? rowToCollateral(data) : null;
    } catch (err: any) {
      throw err;
    }
  },

  async update(id: string, record: Partial<CollateralRecord>): Promise<CollateralRecord | null> {
    const supabase = createClient();
    try {
      const row = collateralToRow(record);
      const { data, error } = await supabase
        .from('collateral_records')
        .update(row)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (isSchemaError(error)) throw error;
        console.log('Update error:', error.message);
        return null;
      }
      return data ? rowToCollateral(data) : null;
    } catch (err: any) {
      throw err;
    }
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
        action: row.action,
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
      const { error } = await supabase.from('audit_logs').insert({
        collateral_record_id: entry.collateralRecordId ?? null,
        collateral_id: entry.collateralId ?? null,
        action: entry.action,
        message: entry.message,
        detail: entry.detail ?? '',
        performed_by: entry.performedBy ?? null,
        performed_by_name: entry.performedByName ?? '',
      });
      if (error) {
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
