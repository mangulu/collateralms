// ============================================================
// Shared multi-provider email sending for edge functions.
// Every send-*-email function previously hardcoded Resend via a
// RESEND_API_KEY env var, completely ignoring the active provider
// and credentials saved on the Email Provider settings page
// (public.email_provider_config) -- selecting SendGrid or Brevo
// there had zero effect. This fetches that config (service-role,
// so it works with no user session) and sends through whichever
// provider is actually configured, each with its own request shape.
//
// RESEND_API_KEY remains a supported fallback: if the config row
// doesn't exist yet, or the active provider has no key saved, this
// falls back to Resend using that env var so nothing breaks for
// deployments that never touch the settings page.
// ============================================================

declare const Deno: { env: { get(key: string): string | undefined } };

export type EmailProviderType = 'resend' | 'sendgrid' | 'brevo' | 'microsoft365';

export interface EmailProviderConfig {
  activeProvider: EmailProviderType;
  resendApiKey?: string | null;
  resendFromEmail?: string | null;
  sendgridApiKey?: string | null;
  sendgridFromEmail?: string | null;
  brevoApiKey?: string | null;
  brevoFromEmail?: string | null;
  microsoft365TenantId?: string | null;
  microsoft365ClientId?: string | null;
  microsoft365ClientSecret?: string | null;
  microsoft365FromEmail?: string | null;
}

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/** Fetches the singleton email_provider_config row via the REST API using the service role key (works with no user session). */
export async function fetchEmailProviderConfig(): Promise<EmailProviderConfig | null> {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!supabaseUrl || !serviceRoleKey) return null;

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/email_provider_config?select=*&limit=1`, {
      headers: { apikey: serviceRoleKey, Authorization: `Bearer ${serviceRoleKey}` },
    });
    if (!res.ok) return null;
    const rows = await res.json();
    const row = rows?.[0];
    if (!row) return null;
    return {
      activeProvider: row.active_provider,
      resendApiKey: row.resend_api_key,
      resendFromEmail: row.resend_from_email,
      sendgridApiKey: row.sendgrid_api_key,
      sendgridFromEmail: row.sendgrid_from_email,
      brevoApiKey: row.brevo_api_key,
      brevoFromEmail: row.brevo_from_email,
      microsoft365TenantId: row.microsoft365_tenant_id,
      microsoft365ClientId: row.microsoft365_client_id,
      microsoft365ClientSecret: row.microsoft365_client_secret,
      microsoft365FromEmail: row.microsoft365_from_email,
    };
  } catch {
    return null;
  }
}

async function sendViaResend(apiKey: string, from: string, params: SendEmailParams): Promise<SendEmailResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from, to: params.to, subject: params.subject, html: params.html }),
  });
  const result = await res.json().catch(() => ({}));
  return res.ok
    ? { success: true, id: result?.id }
    : { success: false, error: result?.message ?? `Resend error ${res.status}` };
}

async function sendViaSendGrid(apiKey: string, from: string, params: SendEmailParams): Promise<SendEmailResult> {
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: params.to }] }],
      from: { email: from },
      subject: params.subject,
      content: [{ type: 'text/html', value: params.html }],
    }),
  });
  // SendGrid returns 202 with an empty body on success.
  if (res.ok) return { success: true };
  const result = await res.json().catch(() => ({}));
  return { success: false, error: result?.errors?.[0]?.message ?? `SendGrid error ${res.status}` };
}

async function sendViaBrevo(apiKey: string, from: string, params: SendEmailParams): Promise<SendEmailResult> {
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      sender: { email: from },
      to: [{ email: params.to }],
      subject: params.subject,
      htmlContent: params.html,
    }),
  });
  const result = await res.json().catch(() => ({}));
  return res.ok
    ? { success: true, id: result?.messageId }
    : { success: false, error: result?.message ?? `Brevo error ${res.status}` };
}

async function getMicrosoftGraphToken(tenantId: string, clientId: string, clientSecret: string): Promise<string | null> {
  const res = await fetch(`https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'https://graph.microsoft.com/.default',
    }),
  });
  if (!res.ok) return null;
  const result = await res.json().catch(() => ({}));
  return result?.access_token ?? null;
}

async function sendViaMicrosoft365(
  tenantId: string,
  clientId: string,
  clientSecret: string,
  from: string,
  params: SendEmailParams
): Promise<SendEmailResult> {
  const token = await getMicrosoftGraphToken(tenantId, clientId, clientSecret);
  if (!token) return { success: false, error: 'Failed to obtain a Microsoft Graph access token — check the tenant ID, client ID and client secret.' };

  const res = await fetch(`https://graph.microsoft.com/v1.0/users/${encodeURIComponent(from)}/sendMail`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: {
        subject: params.subject,
        body: { contentType: 'HTML', content: params.html },
        toRecipients: [{ emailAddress: { address: params.to } }],
      },
      saveToSentItems: false,
    }),
  });
  // sendMail returns 202 Accepted with no body on success.
  if (res.ok) return { success: true };
  const result = await res.json().catch(() => ({}));
  return { success: false, error: result?.error?.message ?? `Microsoft Graph error ${res.status}` };
}

/**
 * Sends one email through whichever provider is actually configured and
 * has credentials, falling back to Resend via RESEND_API_KEY if the config
 * row is missing or the active provider has no key saved.
 */
export async function sendEmailViaProvider(
  config: EmailProviderConfig | null,
  params: SendEmailParams
): Promise<SendEmailResult> {
  const fallbackResendKey = Deno.env.get('RESEND_API_KEY');
  const provider = config?.activeProvider ?? 'resend';

  if (provider === 'sendgrid' && config?.sendgridApiKey) {
    return sendViaSendGrid(config.sendgridApiKey, config.sendgridFromEmail || 'noreply@example.com', params);
  }
  if (provider === 'brevo' && config?.brevoApiKey) {
    return sendViaBrevo(config.brevoApiKey, config.brevoFromEmail || 'noreply@example.com', params);
  }
  if (provider === 'microsoft365' && config?.microsoft365TenantId && config?.microsoft365ClientId && config?.microsoft365ClientSecret && config?.microsoft365FromEmail) {
    return sendViaMicrosoft365(
      config.microsoft365TenantId,
      config.microsoft365ClientId,
      config.microsoft365ClientSecret,
      config.microsoft365FromEmail,
      params
    );
  }

  const resendKey = config?.resendApiKey || fallbackResendKey;
  if (!resendKey) {
    return { success: false, error: `No credentials configured for active provider "${provider}", and no RESEND_API_KEY fallback is set.` };
  }
  return sendViaResend(resendKey, config?.resendFromEmail || 'onboarding@resend.dev', params);
}
