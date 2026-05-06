'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

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
  reason?: string;
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
  collateralId?: string;
}

// ─── Action type constants ────────────────────────────────────────────────────

export const AUDIT_ACTIONS = {
  // Collateral lifecycle
  CREATED:          'created',
  UPDATED:          'updated',
  DELETED:          'deleted',
  STATUS_CHANGED:   'status_changed',
  PERFECTED:        'perfected',
  SUBMITTED:        'submitted',
  RELEASED:         'released',
  OVERDUE:          'overdue',
  // Document
  DOCUMENT_UPLOADED: 'document_uploaded',
  DOCUMENT_DELETED:  'document_deleted',
  // SMS
  SMS_SENT:          'sms_sent',
  // Auth / session
  LOGIN:             'login',
  LOGOUT:            'logout',
  // Data operations
  EXPORT:            'export',
  BULK_UPLOAD:       'bulk_upload',
  // User management
  USER_CREATED:      'user_created',
  USER_UPDATED:      'user_updated',
  USER_DEACTIVATED:  'user_deactivated',
  // Multi-collateral
  LOAN_LINKED:           'loan_linked',
  LOAN_RELEASED:         'loan_released',
  CHARGE_RANK_CHANGED:   'charge_rank_changed',
  EQUITY_RECALCULATED:   'equity_recalculated',
  DISCHARGE_RECORDED:    'discharge_recorded',
  BATCH_RELEASE:         'batch_release',
} as const;

export type AuditAction = typeof AUDIT_ACTIONS[keyof typeof AUDIT_ACTIONS];

export const EVENT_CATEGORIES = {
  COLLATERAL_CHANGE: 'collateral_change',
  STATUS_TRANSITION: 'status_transition',
  DOCUMENT:          'document',
  SMS:               'sms',
  LOGIN:             'login',
  EXPORT:            'export',
  BATCH_OPERATION:   'batch_operation',
  USER_MANAGEMENT:   'user_management',
  MULTI_COLLATERAL:  'multi_collateral',
  CHARGE_REGISTRY:   'charge_registry',
  SYSTEM:            'system',
} as const;

// Multi-collateral helpers (kept for backward compat)
export const MULTI_COLLATERAL_CATEGORIES = [
  'multi_collateral',
  'charge_registry',
  'batch_operation',
] as const;

export const MULTI_COLLATERAL_ACTIONS = [
  'loan_linked',
  'loan_released',
  'charge_rank_changed',
  'equity_recalculated',
  'discharge_recorded',
  'batch_release',
] as const;

// ─── Row mapper ───────────────────────────────────────────────────────────────

function rowToEntry(row: any): AuditLogEntry {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id ?? undefined,
    collateralId: row.collateral_id ?? undefined,
    entityType: row.entity_type ?? 'collateral',
    action: row.action,
    message: row.message,
    detail: row.detail ?? '',
    reason: row.reason ?? undefined,
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

// ─── Base insert helper (immutable — INSERT only, never UPDATE/DELETE) ────────

async function insertAuditLog(payload: {
  collateral_record_id?: string | null;
  collateral_id?: string | null;
  entity_type: string;
  action: string;
  message: string;
  detail?: string;
  reason?: string | null;
  performed_by?: string | null;
  performed_by_name?: string;
  ip_address?: string | null;
  session_id?: string | null;
  event_category?: string;
  field_changes?: FieldChange[] | null;
  batch_summary?: BatchSummaryItem[] | null;
}): Promise<boolean> {
  const supabase = createClient();
  try {
    const { error } = await supabase.from('audit_logs').insert({
      collateral_record_id: payload.collateral_record_id ?? null,
      collateral_id:        payload.collateral_id ?? null,
      entity_type:          payload.entity_type,
      action:               payload.action,
      message:              payload.message,
      detail:               payload.detail ?? '',
      reason:               payload.reason ?? null,
      performed_by:         payload.performed_by ?? null,
      performed_by_name:    payload.performed_by_name ?? 'System',
      ip_address:           payload.ip_address ?? null,
      session_id:           payload.session_id ?? null,
      event_category:       payload.event_category ?? EVENT_CATEGORIES.COLLATERAL_CHANGE,
      field_changes:        payload.field_changes ?? null,
      batch_summary:        payload.batch_summary ?? null,
    });
    return !error;
  } catch {
    return false;
  }
}

// ─── auditLogService ──────────────────────────────────────────────────────────

export const auditLogService = {

  // ── Query helpers ──────────────────────────────────────────────────────────

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
    if (filters?.performedBy && filters.performedBy !== 'All') {
      query = query.eq('performed_by_name', filters.performedBy);
    }
    if (filters?.collateralId && filters.collateralId !== 'All') {
      query = query.eq('collateral_id', filters.collateralId);
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
          (e.reason ?? '').toLowerCase().includes(s) ||
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
    return Array.from(new Set((data ?? []).map((r: any) => r.action as string)));
  },

  async getDistinctUsers(): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from('audit_logs')
      .select('performed_by_name')
      .order('performed_by_name');
    return Array.from(
      new Set((data ?? []).map((r: any) => r.performed_by_name as string).filter(Boolean))
    );
  },

  async getDistinctCategories(): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from('audit_logs')
      .select('event_category')
      .order('event_category');
    return Array.from(
      new Set((data ?? []).map((r: any) => r.event_category as string).filter(Boolean))
    );
  },

  async getDistinctCollateralIds(): Promise<string[]> {
    const supabase = createClient();
    const { data } = await supabase
      .from('audit_logs')
      .select('collateral_id')
      .not('collateral_id', 'is', null)
      .order('collateral_id');
    return Array.from(
      new Set((data ?? []).map((r: any) => r.collateral_id as string).filter(Boolean))
    );
  },

  // ── Collateral lifecycle ───────────────────────────────────────────────────

  /** Log collateral creation */
  async logCreate(params: {
    collateralRecordId: string;
    collateralId: string;
    performedBy?: string;
    performedByName?: string;
    fieldChanges?: FieldChange[];
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      collateral_record_id: params.collateralRecordId,
      collateral_id:        params.collateralId,
      entity_type:          'collateral',
      action:               AUDIT_ACTIONS.CREATED,
      message:              `Collateral ${params.collateralId} created`,
      detail:               'New collateral record added to registry',
      reason:               params.reason ?? null,
      performed_by:         params.performedBy,
      performed_by_name:    params.performedByName,
      ip_address:           params.ipAddress,
      event_category:       EVENT_CATEGORIES.COLLATERAL_CHANGE,
      field_changes:        params.fieldChanges ?? null,
    });
  },

  /** Log collateral edit */
  async logEdit(params: {
    collateralRecordId: string;
    collateralId: string;
    performedBy?: string;
    performedByName?: string;
    fieldChanges: FieldChange[];
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      collateral_record_id: params.collateralRecordId,
      collateral_id:        params.collateralId,
      entity_type:          'collateral',
      action:               AUDIT_ACTIONS.UPDATED,
      message:              `Collateral ${params.collateralId} updated`,
      detail:               `${params.fieldChanges.length} field(s) modified`,
      reason:               params.reason ?? null,
      performed_by:         params.performedBy,
      performed_by_name:    params.performedByName,
      ip_address:           params.ipAddress,
      event_category:       EVENT_CATEGORIES.COLLATERAL_CHANGE,
      field_changes:        params.fieldChanges,
    });
  },

  /** Log collateral deletion */
  async logDelete(params: {
    collateralRecordId?: string;
    collateralId: string;
    performedBy?: string;
    performedByName?: string;
    reason: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      collateral_record_id: params.collateralRecordId ?? null,
      collateral_id:        params.collateralId,
      entity_type:          'collateral',
      action:               AUDIT_ACTIONS.DELETED,
      message:              `Collateral ${params.collateralId} deleted`,
      detail:               'Record permanently removed from registry',
      reason:               params.reason,
      performed_by:         params.performedBy,
      performed_by_name:    params.performedByName,
      ip_address:           params.ipAddress,
      event_category:       EVENT_CATEGORIES.COLLATERAL_CHANGE,
    });
  },

  /** Log status change */
  async logStatusChange(params: {
    collateralRecordId: string;
    collateralId: string;
    fromStatus: string;
    toStatus: string;
    performedBy?: string;
    performedByName?: string;
    reason?: string;
    additionalChanges?: FieldChange[];
    ipAddress?: string;
  }): Promise<boolean> {
    const fieldChanges: FieldChange[] = [
      { field: 'status', label: 'Status', old_value: params.fromStatus, new_value: params.toStatus },
      ...(params.additionalChanges ?? []),
    ];
    return insertAuditLog({
      collateral_record_id: params.collateralRecordId,
      collateral_id:        params.collateralId,
      entity_type:          'collateral',
      action:               AUDIT_ACTIONS.STATUS_CHANGED,
      message:              `Status changed: ${params.fromStatus} → ${params.toStatus}`,
      detail:               `Collateral ${params.collateralId} status transition`,
      reason:               params.reason ?? null,
      performed_by:         params.performedBy,
      performed_by_name:    params.performedByName,
      ip_address:           params.ipAddress,
      event_category:       EVENT_CATEGORIES.STATUS_TRANSITION,
      field_changes:        fieldChanges,
    });
  },

  // ── Document events ────────────────────────────────────────────────────────

  /** Log document upload */
  async logDocumentUpload(params: {
    collateralRecordId: string;
    collateralId: string;
    fileName: string;
    documentType: string;
    version?: number;
    performedBy?: string;
    performedByName?: string;
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      collateral_record_id: params.collateralRecordId,
      collateral_id:        params.collateralId,
      entity_type:          'document',
      action:               AUDIT_ACTIONS.DOCUMENT_UPLOADED,
      message:              `Document uploaded: ${params.documentType}`,
      detail:               `File: ${params.fileName}`,
      reason:               params.reason ?? null,
      performed_by:         params.performedBy,
      performed_by_name:    params.performedByName,
      ip_address:           params.ipAddress,
      event_category:       EVENT_CATEGORIES.DOCUMENT,
      field_changes: [
        { field: 'document_type', label: 'Document Type', old_value: '', new_value: params.documentType },
        { field: 'version',       label: 'Version',       old_value: '', new_value: String(params.version ?? 1) },
      ],
    });
  },

  /** Log document deletion */
  async logDocumentDelete(params: {
    collateralRecordId: string;
    collateralId: string;
    fileName: string;
    documentType: string;
    performedBy?: string;
    performedByName?: string;
    reason: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      collateral_record_id: params.collateralRecordId,
      collateral_id:        params.collateralId,
      entity_type:          'document',
      action:               AUDIT_ACTIONS.DOCUMENT_DELETED,
      message:              `Document deleted: ${params.documentType}`,
      detail:               `File: ${params.fileName} removed`,
      reason:               params.reason,
      performed_by:         params.performedBy,
      performed_by_name:    params.performedByName,
      ip_address:           params.ipAddress,
      event_category:       EVENT_CATEGORIES.DOCUMENT,
      field_changes: [
        { field: 'document_type', label: 'Document Type', old_value: params.documentType, new_value: '' },
        { field: 'file_name',     label: 'File Name',     old_value: params.fileName,     new_value: '' },
      ],
    });
  },

  // ── SMS events ─────────────────────────────────────────────────────────────

  /** Log SMS alert sent */
  async logSmsSent(params: {
    collateralRecordId?: string;
    collateralId?: string;
    alertType: string;
    recipientPhone: string;
    recipientName?: string;
    deliveryStatus: 'SENT' | 'FAILED' | 'DELIVERED';
    twilioSid?: string;
    performedBy?: string;
    performedByName?: string;
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      collateral_record_id: params.collateralRecordId ?? null,
      collateral_id:        params.collateralId ?? null,
      entity_type:          'sms_alert',
      action:               AUDIT_ACTIONS.SMS_SENT,
      message:              `SMS alert sent: ${params.alertType}`,
      detail:               `Recipient: ${params.recipientName ?? params.recipientPhone} | Status: ${params.deliveryStatus}${params.twilioSid ? ` | SID: ${params.twilioSid}` : ''}`,
      reason:               params.reason ?? null,
      performed_by:         params.performedBy,
      performed_by_name:    params.performedByName,
      ip_address:           params.ipAddress,
      event_category:       EVENT_CATEGORIES.SMS,
      field_changes: [
        { field: 'alert_type',       label: 'Alert Type',       old_value: '', new_value: params.alertType },
        { field: 'delivery_status',  label: 'Delivery Status',  old_value: 'PENDING', new_value: params.deliveryStatus },
      ],
    });
  },

  // ── Auth / session events ──────────────────────────────────────────────────

  /** Log user login */
  async logLogin(params: {
    performedBy?: string;
    performedByName?: string;
    ipAddress?: string;
    sessionId?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      entity_type:       'system',
      action:            AUDIT_ACTIONS.LOGIN,
      message:           'User authenticated successfully',
      detail:            'Session started via web browser',
      performed_by:      params.performedBy,
      performed_by_name: params.performedByName,
      ip_address:        params.ipAddress,
      session_id:        params.sessionId,
      event_category:    EVENT_CATEGORIES.LOGIN,
    });
  },

  /** Log user logout */
  async logLogout(params: {
    performedBy?: string;
    performedByName?: string;
    ipAddress?: string;
    sessionId?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      entity_type:       'system',
      action:            AUDIT_ACTIONS.LOGOUT,
      message:           'User session ended',
      detail:            'User logged out',
      performed_by:      params.performedBy,
      performed_by_name: params.performedByName,
      ip_address:        params.ipAddress,
      session_id:        params.sessionId,
      event_category:    EVENT_CATEGORIES.LOGIN,
    });
  },

  // ── Data operations ────────────────────────────────────────────────────────

  /** Log data export */
  async logExport(params: {
    exportType: string;
    recordCount?: number;
    format?: string;
    performedBy?: string;
    performedByName?: string;
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      entity_type:       'system',
      action:            AUDIT_ACTIONS.EXPORT,
      message:           `Data exported: ${params.exportType}`,
      detail:            `${params.recordCount != null ? `${params.recordCount} records` : 'Records'} exported${params.format ? ` as ${params.format}` : ''}`,
      reason:            params.reason ?? null,
      performed_by:      params.performedBy,
      performed_by_name: params.performedByName,
      ip_address:        params.ipAddress,
      event_category:    EVENT_CATEGORIES.EXPORT,
    });
  },

  /** Log bulk upload */
  async logBulkUpload(params: {
    fileName: string;
    recordsCreated: number;
    recordsFailed: number;
    performedBy?: string;
    performedByName?: string;
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      entity_type:       'collateral',
      action:            AUDIT_ACTIONS.BULK_UPLOAD,
      message:           `Bulk upload: ${params.recordsCreated} records imported`,
      detail:            `File: ${params.fileName} — ${params.recordsCreated} created, ${params.recordsFailed} failed`,
      reason:            params.reason ?? null,
      performed_by:      params.performedBy,
      performed_by_name: params.performedByName,
      ip_address:        params.ipAddress,
      event_category:    EVENT_CATEGORIES.BATCH_OPERATION,
      field_changes: [
        { field: 'records_created', label: 'Records Created', old_value: '0', new_value: String(params.recordsCreated) },
        { field: 'records_failed',  label: 'Records Failed',  old_value: '0', new_value: String(params.recordsFailed) },
      ],
    });
  },

  // ── User management events ─────────────────────────────────────────────────

  /** Log user account creation */
  async logUserCreated(params: {
    targetUserName: string;
    targetUserRole: string;
    performedBy?: string;
    performedByName?: string;
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      entity_type:       'user',
      action:            AUDIT_ACTIONS.USER_CREATED,
      message:           `User account created: ${params.targetUserName}`,
      detail:            `Role: ${params.targetUserRole}`,
      reason:            params.reason ?? null,
      performed_by:      params.performedBy,
      performed_by_name: params.performedByName,
      ip_address:        params.ipAddress,
      event_category:    EVENT_CATEGORIES.USER_MANAGEMENT,
      field_changes: [
        { field: 'role',      label: 'Role',   old_value: '', new_value: params.targetUserRole },
        { field: 'is_active', label: 'Active', old_value: '', new_value: 'true' },
      ],
    });
  },

  /** Log user profile update */
  async logUserUpdated(params: {
    targetUserName: string;
    performedBy?: string;
    performedByName?: string;
    fieldChanges: FieldChange[];
    reason?: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      entity_type:       'user',
      action:            AUDIT_ACTIONS.USER_UPDATED,
      message:           `User profile updated: ${params.targetUserName}`,
      detail:            `${params.fieldChanges.length} field(s) changed`,
      reason:            params.reason ?? null,
      performed_by:      params.performedBy,
      performed_by_name: params.performedByName,
      ip_address:        params.ipAddress,
      event_category:    EVENT_CATEGORIES.USER_MANAGEMENT,
      field_changes:     params.fieldChanges,
    });
  },

  /** Log user deactivation */
  async logUserDeactivated(params: {
    targetUserName: string;
    performedBy?: string;
    performedByName?: string;
    reason: string;
    ipAddress?: string;
  }): Promise<boolean> {
    return insertAuditLog({
      entity_type:       'user',
      action:            AUDIT_ACTIONS.USER_DEACTIVATED,
      message:           `User account deactivated: ${params.targetUserName}`,
      detail:            'Account access revoked',
      reason:            params.reason,
      performed_by:      params.performedBy,
      performed_by_name: params.performedByName,
      ip_address:        params.ipAddress,
      event_category:    EVENT_CATEGORIES.USER_MANAGEMENT,
      field_changes: [
        { field: 'is_active', label: 'Active', old_value: 'true', new_value: 'false' },
      ],
    });
  },

  // ── Multi-collateral events (backward compat) ──────────────────────────────

  async logMultiCollateralEvent(params: {
    collateralId?: string;
    entityType: 'collateral_link' | 'charge_registry' | 'batch_operation';
    action: typeof MULTI_COLLATERAL_ACTIONS[number];
    message: string;
    detail?: string;
    reason?: string;
    performedBy?: string;
    performedByName?: string;
    fieldChanges?: FieldChange[];
    batchSummary?: BatchSummaryItem[];
  }): Promise<boolean> {
    const categoryMap: Record<string, string> = {
      collateral_link: EVENT_CATEGORIES.MULTI_COLLATERAL,
      charge_registry: EVENT_CATEGORIES.CHARGE_REGISTRY,
      batch_operation: EVENT_CATEGORIES.BATCH_OPERATION,
    };
    return insertAuditLog({
      collateral_id:     params.collateralId ?? null,
      entity_type:       params.entityType,
      action:            params.action,
      message:           params.message,
      detail:            params.detail ?? '',
      reason:            params.reason ?? null,
      performed_by:      params.performedBy ?? null,
      performed_by_name: params.performedByName ?? 'System',
      event_category:    categoryMap[params.entityType] ?? EVENT_CATEGORIES.MULTI_COLLATERAL,
      field_changes:     params.fieldChanges ?? null,
      batch_summary:     params.batchSummary ?? null,
    });
  },
};
