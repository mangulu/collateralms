'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ReportRecipient {
  name: string;
  email: string;
  role?: string;
}

export interface ScheduledReportConfig {
  id: string;
  reportType: string;
  reportLabel: string;
  isEnabled: boolean;
  scheduleCron: string;
  recipients: ReportRecipient[];
  lastSentAt: string | null;
  nextScheduledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduledReportDelivery {
  id: string;
  configId: string;
  reportType: string;
  reportLabel: string;
  sentAt: string;
  recipientCount: number;
  recipients: ReportRecipient[];
  status: 'sent' | 'failed' | 'partial';
  errorMessage: string | null;
  reportSummary: Record<string, string | number> | null;
  triggeredBy: string | null;
  createdAt: string;
}

function rowToConfig(row: any): ScheduledReportConfig {
  return {
    id: row.id,
    reportType: row.report_type,
    reportLabel: row.report_label,
    isEnabled: row.is_enabled,
    scheduleCron: row.schedule_cron,
    recipients: row.recipients ?? [],
    lastSentAt: row.last_sent_at,
    nextScheduledAt: row.next_scheduled_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToDelivery(row: any): ScheduledReportDelivery {
  return {
    id: row.id,
    configId: row.config_id,
    reportType: row.report_type,
    reportLabel: row.report_label,
    sentAt: row.sent_at,
    recipientCount: row.recipient_count,
    recipients: row.recipients ?? [],
    status: row.status,
    errorMessage: row.error_message,
    reportSummary: row.report_summary,
    triggeredBy: row.triggered_by,
    createdAt: row.created_at,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const scheduledReportService = {
  async listConfigs(): Promise<ScheduledReportConfig[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('scheduled_report_configs')
      .select('*')
      .order('report_type');
    if (error) throw error;
    return (data ?? []).map(rowToConfig);
  },

  async updateConfig(
    id: string,
    payload: {
      isEnabled?: boolean;
      recipients?: ReportRecipient[];
      scheduleCron?: string;
    },
    userId: string
  ): Promise<ScheduledReportConfig> {
    const supabase = createClient();
    const update: any = { updated_by: userId };
    if (payload.isEnabled !== undefined) update.is_enabled = payload.isEnabled;
    if (payload.recipients !== undefined) update.recipients = payload.recipients;
    if (payload.scheduleCron !== undefined) update.schedule_cron = payload.scheduleCron;

    const { data, error } = await supabase
      .from('scheduled_report_configs')
      .update(update)
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToConfig(data);
  },

  async listDeliveries(configId?: string): Promise<ScheduledReportDelivery[]> {
    const supabase = createClient();
    let query = supabase
      .from('scheduled_report_deliveries')
      .select('*')
      .order('sent_at', { ascending: false })
      .limit(50);
    if (configId) query = query.eq('config_id', configId);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(rowToDelivery);
  },

  async logDelivery(payload: {
    configId: string;
    reportType: string;
    reportLabel: string;
    recipients: ReportRecipient[];
    status: 'sent' | 'failed' | 'partial';
    errorMessage?: string;
    reportSummary?: Record<string, string | number>;
    triggeredBy?: string;
  }): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('scheduled_report_deliveries').insert({
      config_id: payload.configId,
      report_type: payload.reportType,
      report_label: payload.reportLabel,
      recipient_count: payload.recipients.length,
      recipients: payload.recipients,
      status: payload.status,
      error_message: payload.errorMessage ?? null,
      report_summary: payload.reportSummary ?? null,
      triggered_by: payload.triggeredBy ?? null,
    });
    if (error) throw error;

    // Update last_sent_at on config
    await supabase
      .from('scheduled_report_configs')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', payload.configId);
  },

  async sendReportEmail(payload: {
    configId: string;
    reportType: string;
    reportLabel: string;
    recipients: ReportRecipient[];
    period: string;
    reportSummary: Record<string, string | number>;
    triggeredBy?: string;
  }): Promise<{ success: boolean; sent: number; failed: number }> {
    const supabase = createClient();

    try {
      const { data, error } = await supabase.functions.invoke('send-report-email', {
        body: {
          to: payload.recipients,
          reportType: payload.reportType,
          reportLabel: payload.reportLabel,
          period: payload.period,
          reportSummary: payload.reportSummary,
        },
      });

      if (error) throw error;

      const result = { success: data?.success ?? false, sent: data?.sent ?? 0, failed: data?.failed ?? 0 };

      await scheduledReportService.logDelivery({
        configId: payload.configId,
        reportType: payload.reportType,
        reportLabel: payload.reportLabel,
        recipients: payload.recipients,
        status: result.success ? 'sent' : result.sent > 0 ? 'partial' : 'failed',
        reportSummary: payload.reportSummary,
        triggeredBy: payload.triggeredBy,
      });

      return result;
    } catch (err: any) {
      await scheduledReportService.logDelivery({
        configId: payload.configId,
        reportType: payload.reportType,
        reportLabel: payload.reportLabel,
        recipients: payload.recipients,
        status: 'failed',
        errorMessage: err.message,
        triggeredBy: payload.triggeredBy,
      });
      throw err;
    }
  },
};
