'use client';

import { createClient } from '@/lib/supabase/client';
import type { SmsAlertType } from '@/lib/supabase/smsAlertService';

export interface DeadlineReminderRule {
  id: string;
  name: string;
  daysBeforeDeadline: number;
  alertType: SmsAlertType;
  recipientRole: string;
  messageTemplate: string;
  isActive: boolean;
  lastRunAt: string | null;
  sentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface CreateDeadlineReminderRuleInput {
  name: string;
  daysBeforeDeadline: number;
  alertType: SmsAlertType;
  recipientRole: string;
  messageTemplate: string;
  createdBy?: string;
}

function rowToRule(row: any): DeadlineReminderRule {
  return {
    id: row.id,
    name: row.name,
    daysBeforeDeadline: row.days_before_deadline,
    alertType: row.alert_type,
    recipientRole: row.recipient_role,
    messageTemplate: row.message_template,
    isActive: row.is_active,
    lastRunAt: row.last_run_at,
    sentCount: row.sent_count,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const deadlineReminderRulesService = {
  async listRules(): Promise<DeadlineReminderRule[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('deadline_reminder_rules')
      .select('*')
      .order('days_before_deadline', { ascending: false });

    if (error) {
      console.error('deadlineReminderRulesService.listRules:', error.message);
      return [];
    }
    return (data ?? []).map(rowToRule);
  },

  async create(input: CreateDeadlineReminderRuleInput): Promise<DeadlineReminderRule | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('deadline_reminder_rules')
      .insert({
        name: input.name,
        days_before_deadline: input.daysBeforeDeadline,
        alert_type: input.alertType,
        recipient_role: input.recipientRole,
        message_template: input.messageTemplate,
        created_by: input.createdBy ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('deadlineReminderRulesService.create:', error.message);
      return null;
    }
    return rowToRule(data);
  },

  async setActive(id: string, isActive: boolean): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('deadline_reminder_rules')
      .update({ is_active: isActive, updated_at: new Date().toISOString() })
      .eq('id', id);
    return !error;
  },

  async remove(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('deadline_reminder_rules').delete().eq('id', id);
    return !error;
  },

  async recordRun(id: string, sentDelta: number): Promise<void> {
    const supabase = createClient();
    const { data } = await supabase
      .from('deadline_reminder_rules')
      .select('sent_count')
      .eq('id', id)
      .maybeSingle();
    const newCount = (data?.sent_count ?? 0) + sentDelta;
    const { error } = await supabase
      .from('deadline_reminder_rules')
      .update({ last_run_at: new Date().toISOString(), sent_count: newCount })
      .eq('id', id);
    if (error) console.error('deadlineReminderRulesService.recordRun failed:', error);
  },
};
