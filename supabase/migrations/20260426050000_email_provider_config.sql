-- Email Provider Configuration Table
-- Stores the active email provider and its credentials for the notification system

DROP TYPE IF EXISTS public.email_provider_type CASCADE;
CREATE TYPE public.email_provider_type AS ENUM ('resend', 'sendgrid', 'brevo');

CREATE TABLE IF NOT EXISTS public.email_provider_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  active_provider public.email_provider_type NOT NULL DEFAULT 'resend',
  resend_api_key TEXT,
  resend_from_email TEXT,
  sendgrid_api_key TEXT,
  sendgrid_from_email TEXT,
  brevo_api_key TEXT,
  brevo_from_email TEXT,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_email_provider_config_active ON public.email_provider_config(active_provider);

-- Only one row should exist (singleton config)
CREATE UNIQUE INDEX IF NOT EXISTS idx_email_provider_config_singleton ON public.email_provider_config ((true));

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.set_email_provider_config_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_email_provider_config_updated_at ON public.email_provider_config;
CREATE TRIGGER trg_email_provider_config_updated_at
  BEFORE UPDATE ON public.email_provider_config
  FOR EACH ROW EXECUTE FUNCTION public.set_email_provider_config_updated_at();

ALTER TABLE public.email_provider_config ENABLE ROW LEVEL SECURITY;

-- Only authenticated users can read config
DROP POLICY IF EXISTS "authenticated_read_email_provider_config" ON public.email_provider_config;
CREATE POLICY "authenticated_read_email_provider_config"
  ON public.email_provider_config
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert/update (using auth metadata)
DROP POLICY IF EXISTS "admin_manage_email_provider_config" ON public.email_provider_config;
CREATE POLICY "admin_manage_email_provider_config"
  ON public.email_provider_config
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'system_admin'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles up
      WHERE up.id = auth.uid() AND up.role = 'system_admin'
    )
  );

-- Seed default config row
DO $$
BEGIN
  INSERT INTO public.email_provider_config (active_provider)
  VALUES ('resend')
  ON CONFLICT DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Could not seed email_provider_config: %', SQLERRM;
END $$;
