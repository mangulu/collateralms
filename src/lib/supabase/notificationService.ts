'use client';

import { createClient } from '@/lib/supabase/client';

export interface NotificationPreferences {
  id?: string;
  userId: string;

  // Alert Types
  alertOverdueCollateral: boolean;
  alertPerfectionDeadline: boolean;
  alertWorkflowStatusChange: boolean;
  alertDocumentExpiry: boolean;
  alertNewCollateralAdded: boolean;
  alertAuditLogEvents: boolean;

  // Frequency
  notificationFrequency: 'realtime' | 'hourly' | 'daily' | 'weekly';

  // Email Preferences
  emailEnabled: boolean;
  emailOverdueCollateral: boolean;
  emailPerfectionDeadline: boolean;
  emailWorkflowStatusChange: boolean;
  emailDocumentExpiry: boolean;
  emailDigestEnabled: boolean;
  emailDigestFrequency: 'daily' | 'weekly';

  // In-App Notifications
  inappEnabled: boolean;
  inappOverdueCollateral: boolean;
  inappPerfectionDeadline: boolean;
  inappWorkflowStatusChange: boolean;
  inappDocumentExpiry: boolean;
  inappSoundEnabled: boolean;

  createdAt?: string;
  updatedAt?: string;
}

function rowToPrefs(row: any): NotificationPreferences {
  return {
    id: row.id,
    userId: row.user_id,
    alertOverdueCollateral: row.alert_overdue_collateral,
    alertPerfectionDeadline: row.alert_perfection_deadline,
    alertWorkflowStatusChange: row.alert_workflow_status_change,
    alertDocumentExpiry: row.alert_document_expiry,
    alertNewCollateralAdded: row.alert_new_collateral_added,
    alertAuditLogEvents: row.alert_audit_log_events,
    notificationFrequency: row.notification_frequency,
    emailEnabled: row.email_enabled,
    emailOverdueCollateral: row.email_overdue_collateral,
    emailPerfectionDeadline: row.email_perfection_deadline,
    emailWorkflowStatusChange: row.email_workflow_status_change,
    emailDocumentExpiry: row.email_document_expiry,
    emailDigestEnabled: row.email_digest_enabled,
    emailDigestFrequency: row.email_digest_frequency,
    inappEnabled: row.inapp_enabled,
    inappOverdueCollateral: row.inapp_overdue_collateral,
    inappPerfectionDeadline: row.inapp_perfection_deadline,
    inappWorkflowStatusChange: row.inapp_workflow_status_change,
    inappDocumentExpiry: row.inapp_document_expiry,
    inappSoundEnabled: row.inapp_sound_enabled,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function prefsToRow(prefs: Partial<NotificationPreferences>): Record<string, any> {
  const row: Record<string, any> = {};
  if (prefs.userId !== undefined) row.user_id = prefs.userId;
  if (prefs.alertOverdueCollateral !== undefined) row.alert_overdue_collateral = prefs.alertOverdueCollateral;
  if (prefs.alertPerfectionDeadline !== undefined) row.alert_perfection_deadline = prefs.alertPerfectionDeadline;
  if (prefs.alertWorkflowStatusChange !== undefined) row.alert_workflow_status_change = prefs.alertWorkflowStatusChange;
  if (prefs.alertDocumentExpiry !== undefined) row.alert_document_expiry = prefs.alertDocumentExpiry;
  if (prefs.alertNewCollateralAdded !== undefined) row.alert_new_collateral_added = prefs.alertNewCollateralAdded;
  if (prefs.alertAuditLogEvents !== undefined) row.alert_audit_log_events = prefs.alertAuditLogEvents;
  if (prefs.notificationFrequency !== undefined) row.notification_frequency = prefs.notificationFrequency;
  if (prefs.emailEnabled !== undefined) row.email_enabled = prefs.emailEnabled;
  if (prefs.emailOverdueCollateral !== undefined) row.email_overdue_collateral = prefs.emailOverdueCollateral;
  if (prefs.emailPerfectionDeadline !== undefined) row.email_perfection_deadline = prefs.emailPerfectionDeadline;
  if (prefs.emailWorkflowStatusChange !== undefined) row.email_workflow_status_change = prefs.emailWorkflowStatusChange;
  if (prefs.emailDocumentExpiry !== undefined) row.email_document_expiry = prefs.emailDocumentExpiry;
  if (prefs.emailDigestEnabled !== undefined) row.email_digest_enabled = prefs.emailDigestEnabled;
  if (prefs.emailDigestFrequency !== undefined) row.email_digest_frequency = prefs.emailDigestFrequency;
  if (prefs.inappEnabled !== undefined) row.inapp_enabled = prefs.inappEnabled;
  if (prefs.inappOverdueCollateral !== undefined) row.inapp_overdue_collateral = prefs.inappOverdueCollateral;
  if (prefs.inappPerfectionDeadline !== undefined) row.inapp_perfection_deadline = prefs.inappPerfectionDeadline;
  if (prefs.inappWorkflowStatusChange !== undefined) row.inapp_workflow_status_change = prefs.inappWorkflowStatusChange;
  if (prefs.inappDocumentExpiry !== undefined) row.inapp_document_expiry = prefs.inappDocumentExpiry;
  if (prefs.inappSoundEnabled !== undefined) row.inapp_sound_enabled = prefs.inappSoundEnabled;
  return row;
}

export const defaultPreferences = (userId: string): NotificationPreferences => ({
  userId,
  alertOverdueCollateral: true,
  alertPerfectionDeadline: true,
  alertWorkflowStatusChange: true,
  alertDocumentExpiry: true,
  alertNewCollateralAdded: false,
  alertAuditLogEvents: false,
  notificationFrequency: 'realtime',
  emailEnabled: true,
  emailOverdueCollateral: true,
  emailPerfectionDeadline: true,
  emailWorkflowStatusChange: true,
  emailDocumentExpiry: true,
  emailDigestEnabled: false,
  emailDigestFrequency: 'daily',
  inappEnabled: true,
  inappOverdueCollateral: true,
  inappPerfectionDeadline: true,
  inappWorkflowStatusChange: true,
  inappDocumentExpiry: true,
  inappSoundEnabled: false,
});

export const notificationService = {
  async getPreferences(userId: string): Promise<NotificationPreferences> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('notification_preferences')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.log('Error fetching notification preferences:', error.message);
      return defaultPreferences(userId);
    }
    if (!data) return defaultPreferences(userId);
    return rowToPrefs(data);
  },

  async savePreferences(prefs: NotificationPreferences): Promise<NotificationPreferences | null> {
    const supabase = createClient();
    const row = prefsToRow(prefs);

    const { data, error } = await supabase
      .from('notification_preferences')
      .upsert(row, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      console.log('Error saving notification preferences:', error.message);
      return null;
    }
    return rowToPrefs(data);
  },
};
