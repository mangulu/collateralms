'use client';

import { createClient } from '@/lib/supabase/client';

export type EmailProviderType = 'resend' | 'sendgrid' | 'brevo' | 'microsoft365';

export interface EmailProviderConfig {
  id?: string;
  activeProvider: EmailProviderType;
  resendApiKey?: string;
  resendFromEmail?: string;
  sendgridApiKey?: string;
  sendgridFromEmail?: string;
  brevoApiKey?: string;
  brevoFromEmail?: string;
  microsoft365TenantId?: string;
  microsoft365ClientId?: string;
  microsoft365ClientSecret?: string;
  microsoft365FromEmail?: string;
  updatedBy?: string;
  updatedAt?: string;
}

function rowToConfig(row: any): EmailProviderConfig {
  return {
    id: row.id,
    activeProvider: row.active_provider,
    resendApiKey: row.resend_api_key ?? '',
    resendFromEmail: row.resend_from_email ?? '',
    sendgridApiKey: row.sendgrid_api_key ?? '',
    sendgridFromEmail: row.sendgrid_from_email ?? '',
    brevoApiKey: row.brevo_api_key ?? '',
    brevoFromEmail: row.brevo_from_email ?? '',
    microsoft365TenantId: row.microsoft365_tenant_id ?? '',
    microsoft365ClientId: row.microsoft365_client_id ?? '',
    microsoft365ClientSecret: row.microsoft365_client_secret ?? '',
    microsoft365FromEmail: row.microsoft365_from_email ?? '',
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  };
}

export const defaultEmailProviderConfig = (): EmailProviderConfig => ({
  activeProvider: 'resend',
  resendApiKey: '',
  resendFromEmail: '',
  sendgridApiKey: '',
  sendgridFromEmail: '',
  brevoApiKey: '',
  brevoFromEmail: '',
  microsoft365TenantId: '',
  microsoft365ClientId: '',
  microsoft365ClientSecret: '',
  microsoft365FromEmail: '',
});

export const emailProviderService = {
  async getConfig(): Promise<EmailProviderConfig> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('email_provider_config')
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('Error fetching email provider config:', error.message);
      return defaultEmailProviderConfig();
    }
    if (!data) return defaultEmailProviderConfig();
    return rowToConfig(data);
  },

  async saveConfig(config: EmailProviderConfig, userId: string): Promise<EmailProviderConfig | null> {
    const supabase = createClient();

    const row = {
      active_provider: config.activeProvider,
      resend_api_key: config.resendApiKey || null,
      resend_from_email: config.resendFromEmail || null,
      sendgrid_api_key: config.sendgridApiKey || null,
      sendgrid_from_email: config.sendgridFromEmail || null,
      brevo_api_key: config.brevoApiKey || null,
      brevo_from_email: config.brevoFromEmail || null,
      microsoft365_tenant_id: config.microsoft365TenantId || null,
      microsoft365_client_id: config.microsoft365ClientId || null,
      microsoft365_client_secret: config.microsoft365ClientSecret || null,
      microsoft365_from_email: config.microsoft365FromEmail || null,
      updated_by: userId,
    };

    // Upsert using the singleton index
    const { data: existing } = await supabase
      .from('email_provider_config')
      .select('id')
      .maybeSingle();

    let result;
    if (existing?.id) {
      const { data, error } = await supabase
        .from('email_provider_config')
        .update(row)
        .eq('id', existing.id)
        .select()
        .single();
      if (error) {
        console.error('Error updating email provider config:', error.message);
        return null;
      }
      result = data;
    } else {
      const { data, error } = await supabase
        .from('email_provider_config')
        .insert(row)
        .select()
        .single();
      if (error) {
        console.error('Error inserting email provider config:', error.message);
        return null;
      }
      result = data;
    }

    return rowToConfig(result);
  },
};
