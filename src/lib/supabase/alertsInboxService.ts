'use client';

import { createClient } from '@/lib/supabase/client';

export type AlertType = 'fraud_detection' | 'brela_deadline' | 'approval_request' | 'overdue_collateral' | 'status_change' | 'system';

export interface InboxAlert {
  id: string;
  type: AlertType;
  subject: string;
  body: string;
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

function rowToInboxAlert(row: any): InboxAlert {
  return {
    id: row.id,
    type: smsAlertTypeToInboxType(row.alert_type),
    subject: buildSubjectFromSms(row.alert_type, row.message, row.collateral_id),
    body: row.message,
    recipient: row.recipient_phone,
    isRead: row.status === 'DELIVERED' || row.status === 'SENT',
    priority: smsAlertTypeToPriority(row.alert_type),
    receivedAt: row.created_at,
    collateralId: row.collateral_id ?? undefined,
    actionLabel: smsAlertTypeToActionLabel(row.alert_type),
    actionHref: smsAlertTypeToActionHref(row.alert_type),
  };
}

export const alertsInboxService = {
  /**
   * Triage view over real SMS alerts (sms_alerts). This used to also
   * synthesize a fake "email" channel from audit_logs rows — no email
   * was ever actually sent for those, so that channel was dropped.
   */
  async fetchAlerts(limit = 100): Promise<InboxAlert[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    if (error) {
      console.error('alertsInboxService.fetchAlerts:', error.message);
      return [];
    }
    return (data ?? []).map(rowToInboxAlert);
  },

  async markRead(id: string): Promise<void> {
    const supabase = createClient();
    await supabase.from('sms_alerts').update({ status: 'DELIVERED' }).eq('id', id);
  },

  async deleteAlert(id: string): Promise<void> {
    const supabase = createClient();
    await supabase.from('sms_alerts').delete().eq('id', id);
  },
};
