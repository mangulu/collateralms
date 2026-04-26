'use client';

import { createClient } from '@/lib/supabase/client';

export interface FieldChange {
  field: string;
  label: string;
  old_value: string;
  new_value: string;
}

export interface AuditLogEntry {
  id: string;
  collateralRecordId?: string;
  collateralId?: string;
  entityType: string;
  action: string;
  message: string;
  detail: string;
  performedBy?: string;
  performedByName: string;
  fieldChanges: FieldChange[] | null;
  createdAt: string;
}

export interface AuditLogFilters {
  search?: string;
  action?: string;
  entityType?: string;
  dateFrom?: string;
  dateTo?: string;
  performedBy?: string;
}

function rowToEntry(row: any): AuditLogEntry {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id ?? undefined,
    collateralId: row.collateral_id ?? undefined,
    entityType: row.entity_type ?? 'collateral',
    action: row.action,
    message: row.message,
    detail: row.detail ?? '',
    performedBy: row.performed_by ?? undefined,
    performedByName: row.performed_by_name ?? 'System',
    fieldChanges: Array.isArray(row.field_changes) ? row.field_changes : null,
    createdAt: row.created_at,
  };
}

export const auditLogService = {
  async getAll(filters?: AuditLogFilters, limit = 500): Promise<AuditLogEntry[]> {
    const supabase = createClient();
    let query = supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (filters?.action && filters.action !== 'All') {
      query = query.eq('action', filters.action);
    }
    if (filters?.entityType && filters.entityType !== 'All') {
      query = query.eq('entity_type', filters.entityType);
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      // Add 1 day to include the full end date
      const end = new Date(filters.dateTo);
      end.setDate(end.getDate() + 1);
      query = query.lt('created_at', end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    let entries = (data ?? []).map(rowToEntry);

    // Client-side search filter (message, collateralId, performedByName, detail)
    if (filters?.search) {
      const s = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.message.toLowerCase().includes(s) ||
          (e.collateralId ?? '').toLowerCase().includes(s) ||
          e.performedByName.toLowerCase().includes(s) ||
          e.detail.toLowerCase().includes(s)
      );
    }

    return entries;
  },

  async getDistinctActions(): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from('audit_logs')
      .select('action')
      .order('action');
    const unique = Array.from(new Set((data ?? []).map((r: any) => r.action as string)));
    return unique;
  },

  async getDistinctUsers(): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from('audit_logs')
      .select('performed_by_name')
      .order('performed_by_name');
    const unique = Array.from(
      new Set((data ?? []).map((r: any) => r.performed_by_name as string).filter(Boolean))
    );
    return unique;
  },
};
