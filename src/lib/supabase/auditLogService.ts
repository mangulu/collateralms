'use client';

import { createClient } from '@/lib/supabase/client';

export interface FieldChange {
  field: string;
  label: string;
  old_value: string;
  new_value: string;
}

export interface BatchSummaryItem {
  label: string;
  value: string | number;
  highlight?: boolean;
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
  ipAddress?: string;
  sessionId?: string;
  eventCategory?: string;
  fieldChanges: FieldChange[] | null;
  batchSummary?: BatchSummaryItem[];
  createdAt: string;
}

export interface AuditLogFilters {
  search?: string;
  action?: string;
  entityType?: string;
  eventCategory?: string;
  dateFrom?: string;
  dateTo?: string;
  performedBy?: string;
}

// Multi-collateral event categories
export const MULTI_COLLATERAL_CATEGORIES = [
  'multi_collateral',
  'charge_registry',
  'batch_operation',
] as const;

// Multi-collateral action types
export const MULTI_COLLATERAL_ACTIONS = [
  'loan_linked',
  'loan_released',
  'charge_rank_changed',
  'equity_recalculated',
  'discharge_recorded',
  'batch_release',
] as const;

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
    ipAddress: row.ip_address ?? undefined,
    sessionId: row.session_id ?? undefined,
    eventCategory: row.event_category ?? 'collateral_change',
    fieldChanges: Array.isArray(row.field_changes) ? row.field_changes : null,
    batchSummary: Array.isArray(row.batch_summary) ? row.batch_summary : undefined,
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
    if (filters?.eventCategory && filters.eventCategory !== 'All') {
      query = query.eq('event_category', filters.eventCategory);
    }
    if (filters?.dateFrom) {
      query = query.gte('created_at', filters.dateFrom);
    }
    if (filters?.dateTo) {
      const end = new Date(filters.dateTo);
      end.setDate(end.getDate() + 1);
      query = query.lt('created_at', end.toISOString());
    }

    const { data, error } = await query;
    if (error) throw error;

    let entries = (data ?? []).map(rowToEntry);

    if (filters?.search) {
      const s = filters.search.toLowerCase();
      entries = entries.filter(
        (e) =>
          e.message.toLowerCase().includes(s) ||
          (e.collateralId ?? '').toLowerCase().includes(s) ||
          e.performedByName.toLowerCase().includes(s) ||
          e.detail.toLowerCase().includes(s) ||
          (e.ipAddress ?? '').toLowerCase().includes(s)
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

  async getDistinctCategories(): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from('audit_logs')
      .select('event_category')
      .order('event_category');
    const unique = Array.from(
      new Set((data ?? []).map((r: any) => r.event_category as string).filter(Boolean))
    );
    return unique;
  },

  /**
   * Log a multi-collateral event (charge ranking change, equity recalculation,
   * discharge date, or batch operation summary).
   */
  async logMultiCollateralEvent(params: {
    collateralId?: string;
    entityType: 'collateral_link' | 'charge_registry' | 'batch_operation';
    action: typeof MULTI_COLLATERAL_ACTIONS[number];
    message: string;
    detail?: string;
    performedBy?: string;
    performedByName?: string;
    fieldChanges?: FieldChange[];
    batchSummary?: BatchSummaryItem[];
  }): Promise<boolean> {
    const supabase = createClient();
    try {
      const categoryMap: Record<string, string> = {
        collateral_link: 'multi_collateral',
        charge_registry: 'charge_registry',
        batch_operation: 'batch_operation',
      };
      const { error } = await supabase.from('audit_logs').insert({
        collateral_id: params.collateralId ?? null,
        entity_type: params.entityType,
        action: params.action,
        message: params.message,
        detail: params.detail ?? '',
        performed_by: params.performedBy ?? null,
        performed_by_name: params.performedByName ?? 'System',
        event_category: categoryMap[params.entityType] ?? 'multi_collateral',
        field_changes: params.fieldChanges ?? null,
        batch_summary: params.batchSummary ?? null,
      });
      return !error;
    } catch {
      return false;
    }
  },
};
