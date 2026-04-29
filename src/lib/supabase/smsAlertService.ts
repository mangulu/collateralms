'use client';

import { createClient } from '@/lib/supabase/client';

export type SmsAlertType = 'FRAUD_DETECTION' | 'BRELA_DEADLINE' | 'APPROVAL_REQUEST' | 'OVERDUE_COLLATERAL' | 'CUSTODY_DISCREPANCY';
export type SmsAlertStatus = 'PENDING' | 'SENT' | 'FAILED' | 'DELIVERED';

export interface SmsAlert {
  id: string;
  recipientPhone: string;
  recipientName?: string;
  alertType: SmsAlertType;
  message: string;
  collateralId?: string;
  actionUrl?: string;
  status: SmsAlertStatus;
  twilioMessageSid?: string;
  errorMessage?: string;
  sentBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SendSmsPayload {
  to: string;
  recipientName?: string;
  alertType: SmsAlertType;
  collateralId?: string;
  actionUrl?: string;
  message: string;
}

function rowToSmsAlert(row: any): SmsAlert {
  return {
    id: row.id,
    recipientPhone: row.recipient_phone,
    recipientName: row.recipient_name,
    alertType: row.alert_type,
    message: row.message,
    collateralId: row.collateral_id,
    actionUrl: row.action_url,
    status: row.status,
    twilioMessageSid: row.twilio_message_sid,
    errorMessage: row.error_message,
    sentBy: row.sent_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const smsAlertService = {
  /**
   * Send an SMS alert via Supabase Edge Function (Twilio)
   */
  async sendAlert(payload: SendSmsPayload): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    const supabase = createClient();

    // Log the alert as PENDING first
    const { data: logRow, error: logError } = await supabase
      .from('sms_alerts')
      .insert({
        recipient_phone: payload.to,
        recipient_name: payload.recipientName,
        alert_type: payload.alertType,
        message: payload.message,
        collateral_id: payload.collateralId,
        action_url: payload.actionUrl,
        status: 'PENDING',
      })
      .select()
      .single();

    if (logError) {
      console.log('Failed to log SMS alert:', logError.message);
    }

    // Invoke Edge Function
    const { data, error } = await supabase.functions.invoke('send-sms-alert', {
      body: {
        to: payload.to,
        message: payload.message,
        alert_type: payload.alertType,
        collateral_id: payload.collateralId,
        action_url: payload.actionUrl,
        recipient_name: payload.recipientName,
      },
    });

    const alertId = logRow?.id;

    if (error || !data?.success) {
      const errMsg = error?.message || data?.error || 'Unknown error';
      // Update log to FAILED
      if (alertId) {
        await supabase
          .from('sms_alerts')
          .update({ status: 'FAILED', error_message: errMsg })
          .eq('id', alertId);
      }
      return { success: false, error: errMsg };
    }

    // Update log to SENT
    if (alertId) {
      await supabase
        .from('sms_alerts')
        .update({ status: 'SENT', twilio_message_sid: data.messageSid })
        .eq('id', alertId);
    }

    return { success: true, messageSid: data.messageSid };
  },

  /**
   * Send an SMS alert via the Next.js API route (server-side Twilio)
   * Use this for alert-rule-triggered notifications from client components.
   */
  async sendAlertViaApi(payload: SendSmsPayload): Promise<{ success: boolean; messageSid?: string; error?: string }> {
    try {
      const res = await fetch('/api/sms/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.to,
          message: payload.message,
          alertType: payload.alertType,
          collateralId: payload.collateralId,
          recipientName: payload.recipientName,
          actionUrl: payload.actionUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        return { success: false, error: data.error ?? 'Failed to send SMS' };
      }
      return { success: true, messageSid: data.messageSid };
    } catch (err: any) {
      return { success: false, error: err?.message ?? 'Network error' };
    }
  },

  /**
   * Fetch recent SMS alert logs
   */
  async fetchAlerts(limit = 50): Promise<SmsAlert[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('sms_alerts')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.log('Failed to fetch SMS alerts:', error.message);
      return [];
    }
    return (data || []).map(rowToSmsAlert);
  },

  /**
   * Build fraud detection SMS message
   */
  buildFraudMessage(collateralId: string, alertType: string, riskScore: number, appUrl: string): string {
    return `[CollateralMS ALERT] Fraud detected on ${collateralId}. Type: ${alertType.replace(/_/g, ' ')}. Risk Score: ${riskScore.toFixed(0)}/100. Review now: ${appUrl}/fraud-prevention`;
  },

  /**
   * Build BRELA deadline SMS message
   */
  buildBrelaMessage(collateralId: string, daysLeft: number, appUrl: string): string {
    const urgency = daysLeft <= 0 ? 'OVERDUE' : daysLeft <= 3 ? 'CRITICAL' : 'WARNING';
    const daysText = daysLeft <= 0 ? `${Math.abs(daysLeft)} days overdue` : `${daysLeft} days remaining`;
    return `[CollateralMS ${urgency}] BRELA deadline for ${collateralId}: ${daysText}. Take action: ${appUrl}/compliance-audit`;
  },

  /**
   * Build approval request SMS message
   */
  buildApprovalMessage(requestId: string, collateralId: string, appUrl: string): string {
    return `[CollateralMS] Approval required for perfection request ${requestId} (${collateralId}). Review & approve: ${appUrl}/perfection-workflow`;
  },

  /**
   * Build overdue collateral SMS message
   */
  buildOverdueMessage(collateralId: string, daysOverdue: number, appUrl: string): string {
    return `[CollateralMS OVERDUE] Collateral ${collateralId} is ${daysOverdue} days past perfection deadline. Immediate action required: ${appUrl}/collateral-management`;
  },

  /**
   * Build custody discrepancy SMS message
   */
  buildCustodyMessage(collateralId: string, discrepancyDetail: string, appUrl: string): string {
    return `[CollateralMS CUSTODY ALERT] Discrepancy detected for ${collateralId}: ${discrepancyDetail}. Review security pocket: ${appUrl}/collateral-documents`;
  },
};
