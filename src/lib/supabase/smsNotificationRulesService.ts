'use client';

import { createClient } from '@/lib/supabase/client';
import { smsAlertService } from '@/lib/supabase/smsAlertService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SmsEventType = 'COVENANT_BREACH' | 'OVERDUE_ACTION' | 'STATUS_CHANGE';
export type SmsSeverity = 'all' | 'critical' | 'high';

export interface SmsRecipient {
  name: string;
  phone: string;
  role?: string;
}

export interface SmsNotificationRule {
  id: string;
  eventType: SmsEventType;
  eventLabel: string;
  description: string | null;
  isEnabled: boolean;
  recipients: SmsRecipient[];
  minSeverity: SmsSeverity;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToRule(row: any): SmsNotificationRule {
  return {
    id: row.id,
    eventType: row.event_type,
    eventLabel: row.event_label,
    description: row.description,
    isEnabled: row.is_enabled,
    recipients: Array.isArray(row.recipients) ? row.recipients : [],
    minSeverity: row.min_severity ?? 'all',
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const smsNotificationRulesService = {
  async listRules(): Promise<SmsNotificationRule[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_notification_rules')
      .select('*')
      .order('event_label', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToRule);
  },

  async getRule(eventType: SmsEventType): Promise<SmsNotificationRule | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_notification_rules')
      .select('*')
      .eq('event_type', eventType)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToRule(data) : null;
  },

  async updateRule(
    id: string,
    patch: {
      isEnabled?: boolean;
      recipients?: SmsRecipient[];
      minSeverity?: SmsSeverity;
    },
    updatedBy?: string
  ): Promise<SmsNotificationRule> {
    const supabase = createClient();
    const update: Record<string, any> = { updated_by: updatedBy ?? null };
    if (patch.isEnabled !== undefined) update.is_enabled = patch.isEnabled;
    if (patch.recipients !== undefined) update.recipients = patch.recipients;
    if (patch.minSeverity !== undefined) update.min_severity = patch.minSeverity;

    const { data, error } = await supabase
      .from('sms_notification_rules')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToRule(data);
  },
};

// ─── SMS Dispatcher ───────────────────────────────────────────────────────────

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://collateral8511.builtwithrocket.new';

/**
 * Fire SMS alerts for a COVENANT_BREACH event.
 * Call this after a covenant is flagged as Breached.
 */
export async function triggerCovenantBreachSms(params: {
  covenantName: string;
  loanNumber: string;
  obligorName: string;
  thresholdValue: number | null;
  currentValue: number | null;
  unit: string | null;
}): Promise<void> {
  try {
    const rule = await smsNotificationRulesService.getRule('COVENANT_BREACH');
    if (!rule || !rule.isEnabled || rule.recipients.length === 0) return;

    const { covenantName, loanNumber, obligorName, thresholdValue, currentValue, unit } = params;
    const unitStr = unit ? ` ${unit}` : '';
    const message =
      `[CollateralMS BREACH] Covenant "${covenantName}" breached on loan ${loanNumber} (${obligorName}). ` +
      `Current: ${currentValue ?? 'N/A'}${unitStr}, Threshold: ${thresholdValue ?? 'N/A'}${unitStr}. ` +
      `Review: ${APP_URL}/covenant-tracking`;

    await Promise.allSettled(
      rule.recipients.map((r) =>
        smsAlertService.sendAlertViaApi({
          to: r.phone,
          recipientName: r.name,
          alertType: 'OVERDUE_COLLATERAL', // closest existing enum
          message,
          actionUrl: `${APP_URL}/covenant-tracking`,
        })
      )
    );
  } catch (err) {
    console.error('[SMS] triggerCovenantBreachSms failed:', err);
  }
}

/**
 * Fire SMS alerts for an OVERDUE_ACTION event.
 * Call this when a valuation or perfection task becomes overdue.
 */
export async function triggerOverdueActionSms(params: {
  actionType: 'Valuation' | 'Perfection' | 'Review';
  collateralId: string;
  collateralDescription?: string;
  scheduledDate: string;
  daysOverdue: number;
}): Promise<void> {
  try {
    const rule = await smsNotificationRulesService.getRule('OVERDUE_ACTION');
    if (!rule || !rule.isEnabled || rule.recipients.length === 0) return;

    const { actionType, collateralId, collateralDescription, scheduledDate, daysOverdue } = params;
    const descStr = collateralDescription ? ` (${collateralDescription})` : '';
    const message =
      `[CollateralMS OVERDUE] ${actionType} overdue for collateral ${collateralId}${descStr}. ` +
      `Scheduled: ${scheduledDate}, ${daysOverdue} day(s) overdue. ` +
      `Action required: ${APP_URL}/valuation-workflow`;

    await Promise.allSettled(
      rule.recipients.map((r) =>
        smsAlertService.sendAlertViaApi({
          to: r.phone,
          recipientName: r.name,
          alertType: 'OVERDUE_COLLATERAL',
          message,
          collateralId,
          actionUrl: `${APP_URL}/valuation-workflow`,
        })
      )
    );
  } catch (err) {
    console.error('[SMS] triggerOverdueActionSms failed:', err);
  }
}

/**
 * Fire SMS alerts for a STATUS_CHANGE event.
 * Call this when a collateral record status changes.
 */
export async function triggerStatusChangeSms(params: {
  collateralId: string;
  collateralDescription?: string;
  previousStatus: string;
  newStatus: string;
  changedBy?: string;
}): Promise<void> {
  try {
    const rule = await smsNotificationRulesService.getRule('STATUS_CHANGE');
    if (!rule || !rule.isEnabled || rule.recipients.length === 0) return;

    const { collateralId, collateralDescription, previousStatus, newStatus, changedBy } = params;
    const descStr = collateralDescription ? ` (${collateralDescription})` : '';
    const byStr = changedBy ? ` by ${changedBy}` : '';
    const message =
      `[CollateralMS STATUS] Collateral ${collateralId}${descStr} status changed from "${previousStatus}" to "${newStatus}"${byStr}. ` +
      `View: ${APP_URL}/collateral-detail/${collateralId}`;

    await Promise.allSettled(
      rule.recipients.map((r) =>
        smsAlertService.sendAlertViaApi({
          to: r.phone,
          recipientName: r.name,
          alertType: 'APPROVAL_REQUEST',
          message,
          collateralId,
          actionUrl: `${APP_URL}/collateral-detail/${collateralId}`,
        })
      )
    );
  } catch (err) {
    console.error('[SMS] triggerStatusChangeSms failed:', err);
  }
}
