-- Adds Microsoft 365 / Exchange Online as a fourth email provider option.
-- Microsoft Graph's sendMail API is app-only OAuth2 (client credentials),
-- not a simple API key, so this needs tenant/client id + secret + the
-- mailbox to send as, rather than the single "api key" shape used by the
-- other providers.

ALTER TYPE public.email_provider_type ADD VALUE IF NOT EXISTS 'microsoft365';

ALTER TABLE public.email_provider_config
  ADD COLUMN IF NOT EXISTS microsoft365_tenant_id TEXT,
  ADD COLUMN IF NOT EXISTS microsoft365_client_id TEXT,
  ADD COLUMN IF NOT EXISTS microsoft365_client_secret TEXT,
  ADD COLUMN IF NOT EXISTS microsoft365_from_email TEXT;
