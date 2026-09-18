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

function sourceKeyFor(id: string): string {
  return `sms_alert:${id}`;
}

function rowToInboxAlert(row: any, isRead: boolean): InboxAlert {
  return {
    id: row.id,
    type: smsAlertTypeToInboxType(row.alert_type),
    subject: buildSubjectFromSms(row.alert_type, row.message, row.collateral_id),
    body: row.message,
    recipient: row.recipient_phone,
    isRead,
    priority: smsAlertTypeToPriority(row.alert_type),
    receivedAt: row.created_at,
    collateralId: row.collateral_id ?? undefined,
    actionLabel: smsAlertTypeToActionLabel(row.alert_type),
    actionHref: smsAlertTypeToActionHref(row.alert_type),
  };
}

interface ReadState {
  isRead: boolean;
  isDismissed: boolean;
}

async function loadReadStates(userId: string): Promise<Map<string, ReadState>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('notification_states')
    .select('source_key, is_read, is_dismissed')
    .eq('user_id', userId);
  const map = new Map<string, ReadState>();
  if (error) {
    console.error('alertsInboxService.loadReadStates:', error.message);
    return map;
  }
  (data ?? []).forEach((r: any) => map.set(r.source_key, { isRead: r.is_read, isDismissed: r.is_dismissed }));
  return map;
}

export const alertsInboxService = {
  /**
   * Triage view over real SMS alerts (sms_alerts). This used to also
   * synthesize a fake "email" channel from audit_logs rows — no email
   * was ever actually sent for those, so that channel was dropped.
   *
   * Read/dismissed state is tracked per-user in notification_states,
   * not on sms_alerts.status itself -- that column tracks actual SMS
   * delivery (pending/sent/failed/delivered) and must stay accurate
   * for the Alert Delivery Log, so opening an alert in this inbox
   * can't be allowed to overwrite it.
   */
  async fetchAlerts(userId: string, limit = 100): Promise<InboxAlert[]> {
    const supabase = createClient();
    const [{ data, error }, readStates] = await Promise.all([
      supabase.from('sms_alerts').select('*').order('created_at', { ascending: false }).limit(limit),
      loadReadStates(userId),
    ]);
    if (error) {
      console.error('alertsInboxService.fetchAlerts:', error.message);
      return [];
    }
    return (data ?? [])
      .map((row: any) => {
        const state = readStates.get(sourceKeyFor(row.id));
        return { row, state };
      })
      .filter(({ state }) => !state?.isDismissed)
      .map(({ row, state }) => rowToInboxAlert(row, state?.isRead ?? false));
  },

  async markRead(userId: string, id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('notification_states').upsert(
      { user_id: userId, source_key: sourceKeyFor(id), is_read: true, read_at: new Date().toISOString() },
      { onConflict: 'user_id,source_key' }
    );
    if (error) console.error('alertsInboxService.markRead failed:', error);
  },

  async markUnread(userId: string, id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('notification_states').upsert(
      { user_id: userId, source_key: sourceKeyFor(id), is_read: false, read_at: null },
      { onConflict: 'user_id,source_key' }
    );
    if (error) console.error('alertsInboxService.markUnread failed:', error);
  },

  /** Removes the alert from this user's inbox only -- the underlying sms_alerts row (and Alert Delivery Log) is untouched. */
  async dismissAlert(userId: string, id: string): Promise<void> {
    const supabase = createClient();
    const now = new Date().toISOString();
    const { error } = await supabase.from('notification_states').upsert(
      { user_id: userId, source_key: sourceKeyFor(id), is_read: true, read_at: now, is_dismissed: true, dismissed_at: now },
      { onConflict: 'user_id,source_key' }
    );
    if (error) console.error('alertsInboxService.dismissAlert failed:', error);
  },
};
