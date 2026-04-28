'use client';

import { createClient } from '@/lib/supabase/client';

export type AlertChannel = 'sms' | 'email';
export type AlertType = 'fraud_detection' | 'brela_deadline' | 'approval_request' | 'overdue_collateral' | 'status_change' | 'system';

export interface InboxAlert {
  id: string;
  channel: AlertChannel;
  type: AlertType;
  subject: string;
  body: string;
  sender: string;
  recipient: string;
  isRead: boolean;
  priority: 'high' | 'medium' | 'low';
  receivedAt: string;
  collateralId?: string;
  actionLabel?: string;
  actionHref?: string;
}

function smsAlertTypeToInboxType(alertType: string): AlertType {
  switch (alertType) {
    case 'FRAUD_DETECTION': return 'fraud_detection';
    case 'BRELA_DEADLINE': return 'brela_deadline';
    case 'APPROVAL_REQUEST': return 'approval_request';
    case 'OVERDUE_COLLATERAL': return 'overdue_collateral';
    default: return 'system';
  }
}

function smsAlertTypeToPriority(alertType: string): 'high' | 'medium' | 'low' {
  switch (alertType) {
    case 'FRAUD_DETECTION': return 'high';
    case 'BRELA_DEADLINE': return 'high';
    case 'APPROVAL_REQUEST': return 'medium';
    case 'OVERDUE_COLLATERAL': return 'high';
    default: return 'low';
  }
}

function smsAlertTypeToActionHref(alertType: string): string {
  switch (alertType) {
    case 'FRAUD_DETECTION': return '/fraud-prevention';
    case 'BRELA_DEADLINE': return '/compliance-audit';
    case 'APPROVAL_REQUEST': return '/perfection-workflow';
    case 'OVERDUE_COLLATERAL': return '/collateral-management';
    default: return '/notifications-hub';
  }
}

function smsAlertTypeToActionLabel(alertType: string): string {
  switch (alertType) {
    case 'FRAUD_DETECTION': return 'Review Alert';
    case 'BRELA_DEADLINE': return 'Take Action';
    case 'APPROVAL_REQUEST': return 'Review Request';
    case 'OVERDUE_COLLATERAL': return 'View Collateral';
    default: return 'View';
  }
}

function buildSubjectFromSms(alertType: string, message: string, collateralId?: string | null): string {
  const id = collateralId ? ` — ${collateralId}` : '';
  switch (alertType) {
    case 'FRAUD_DETECTION': return `FRAUD ALERT: Fraud detected${id}`;
    case 'BRELA_DEADLINE': return `BRELA DEADLINE: Action required${id}`;
    case 'APPROVAL_REQUEST': return `APPROVAL NEEDED: Perfection request${id}`;
    case 'OVERDUE_COLLATERAL': return `Overdue: Collateral past deadline${id}`;
    default: return message.slice(0, 80);
  }
}

function auditActionToInboxType(action: string, eventCategory?: string): AlertType {
  if (eventCategory === 'approval' || ['approved', 'rejected', 'reviewed', 'returned'].includes(action)) {
    return 'approval_request';
  }
  if (action === 'overdue') return 'overdue_collateral';
  if (['status_changed', 'perfected', 'submitted'].includes(action)) return 'status_change';
  if (action === 'created' || action === 'updated') return 'status_change';
  return 'system';
}

function auditActionToPriority(action: string): 'high' | 'medium' | 'low' {
  if (['overdue', 'rejected'].includes(action)) return 'high';
  if (['approved', 'submitted', 'reviewed', 'returned', 'status_changed'].includes(action)) return 'medium';
  return 'low';
}

function rowToInboxAlert(row: any): InboxAlert {
  const inboxType = smsAlertTypeToInboxType(row.alert_type);
  return {
    id: `sms-${row.id}`,
    channel: 'sms',
    type: inboxType,
    subject: buildSubjectFromSms(row.alert_type, row.message, row.collateral_id),
    body: row.message,
    sender: 'CollateralMS System',
    recipient: row.recipient_phone,
    isRead: row.status === 'DELIVERED' || row.status === 'SENT',
    priority: smsAlertTypeToPriority(row.alert_type),
    receivedAt: row.created_at,
    collateralId: row.collateral_id ?? undefined,
    actionLabel: smsAlertTypeToActionLabel(row.alert_type),
    actionHref: smsAlertTypeToActionHref(row.alert_type),
  };
}

function auditRowToInboxAlert(row: any): InboxAlert {
  const inboxType = auditActionToInboxType(row.action, row.event_category);
  const collateralId = row.collateral_id ?? undefined;
  const actionHref = smsAlertTypeToActionHref(
    inboxType === 'fraud_detection' ? 'FRAUD_DETECTION' :
    inboxType === 'brela_deadline' ? 'BRELA_DEADLINE' :
    inboxType === 'approval_request' ? 'APPROVAL_REQUEST' :
    inboxType === 'overdue_collateral' ? 'OVERDUE_COLLATERAL' : 'SYSTEM'
  );
  return {
    id: `audit-${row.id}`,
    channel: 'email',
    type: inboxType,
    subject: row.message,
    body: row.detail || row.message,
    sender: 'noreply@collateralms.system',
    recipient: row.performed_by_name || 'System',
    isRead: true,
    priority: auditActionToPriority(row.action),
    receivedAt: row.created_at,
    collateralId,
    actionLabel: 'View Details',
    actionHref: actionHref,
  };
}

export const alertsInboxService = {
  async fetchAlerts(limit = 100): Promise<InboxAlert[]> {
    const supabase = createClient();

    const [smsResult, auditResult] = await Promise.all([
      supabase
        .from('sms_alerts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit),
      supabase
        .from('audit_logs')
        .select('*')
        .in('action', ['overdue', 'approved', 'rejected', 'returned', 'submitted', 'status_changed', 'perfected'])
        .order('created_at', { ascending: false })
        .limit(limit),
    ]);

    const smsAlerts: InboxAlert[] = (smsResult.data ?? []).map(rowToInboxAlert);
    const auditAlerts: InboxAlert[] = (auditResult.data ?? []).map(auditRowToInboxAlert);

    // Merge and sort by receivedAt descending
    const all = [...smsAlerts, ...auditAlerts].sort(
      (a, b) => new Date(b.receivedAt).getTime() - new Date(a.receivedAt).getTime()
    );

    return all;
  },

  async markRead(id: string): Promise<void> {
    // For SMS alerts, update status to DELIVERED
    if (id.startsWith('sms-')) {
      const supabase = createClient();
      const realId = id.replace('sms-', '');
      await supabase
        .from('sms_alerts')
        .update({ status: 'DELIVERED' })
        .eq('id', realId);
    }
    // Audit log entries don't have a read status — handled client-side only
  },

  async deleteAlert(id: string): Promise<void> {
    if (id.startsWith('sms-')) {
      const supabase = createClient();
      const realId = id.replace('sms-', '');
      await supabase.from('sms_alerts').delete().eq('id', realId);
    }
    // Audit log entries are immutable — deletion is client-side only
  },
};
