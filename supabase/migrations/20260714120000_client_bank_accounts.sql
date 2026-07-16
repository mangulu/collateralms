-- ─── Client Bank Accounts ────────────────────────────────────────────────────
-- Contentpro admin screen: manage client bank deployments with custom
-- credentials, branding URLs, and active/inactive status.

CREATE TABLE IF NOT EXISTS public.client_bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  bank_name       TEXT NOT NULL,
  bank_code       TEXT NOT NULL,
  contact_email   TEXT,
  contact_phone   TEXT,
  country         TEXT NOT NULL DEFAULT 'Tanzania',
  -- Branding
  logo_url        TEXT,
  primary_color   TEXT DEFAULT '#2563EB',
  accent_color    TEXT DEFAULT '#10B981',
  tagline         TEXT,
  app_url         TEXT,
  -- Credentials / deployment
  supabase_url    TEXT,
  supabase_anon_key TEXT,
  admin_email     TEXT,
  -- Status
  is_active       BOOLEAN NOT NULL DEFAULT true,
  notes           TEXT,
  -- Audit
  created_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_bank_accounts_bank_code
  ON public.client_bank_accounts (bank_code);

CREATE INDEX IF NOT EXISTS idx_client_bank_accounts_is_active
  ON public.client_bank_accounts (is_active);

CREATE INDEX IF NOT EXISTS idx_client_bank_accounts_created_at
  ON public.client_bank_accounts (created_at DESC);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_client_bank_accounts_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_client_bank_accounts_updated_at ON public.client_bank_accounts;
CREATE TRIGGER trg_client_bank_accounts_updated_at
  BEFORE UPDATE ON public.client_bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.set_client_bank_accounts_updated_at();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE public.client_bank_accounts ENABLE ROW LEVEL SECURITY;

-- Only system_admin role can manage client bank accounts
CREATE OR REPLACE FUNCTION public.is_system_admin_for_banks()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid() AND up.role = 'system_admin'
  )
$$;

DROP POLICY IF EXISTS "system_admin_manage_client_bank_accounts" ON public.client_bank_accounts;
CREATE POLICY "system_admin_manage_client_bank_accounts"
  ON public.client_bank_accounts
  FOR ALL
  TO authenticated
  USING (public.is_system_admin_for_banks())
  WITH CHECK (public.is_system_admin_for_banks());

-- ─── Seed sample data ─────────────────────────────────────────────────────────

DO $$
DECLARE
  admin_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO admin_id FROM public.user_profiles LIMIT 1;
  END IF;

  INSERT INTO public.client_bank_accounts (
    bank_name, bank_code, contact_email, contact_phone, country,
    logo_url, primary_color, accent_color, tagline, app_url,
    admin_email, is_active, notes, created_by
  ) VALUES
  (
    'EXIM Bank Tanzania', 'EXIM-TZ',
    'collateral@exim.co.tz', '+255 22 211 0000', 'Tanzania',
    'https://img.rocket.new/generatedImages/rocket_gen_img_14265f36a-1768411597753.png',
    '#1E40AF', '#10B981',
    'Collateral Lifecycle Management Platform',
    'https://collateral8511.builtwithrocket.new',
    'admin@exim.co.tz', true,
    'Primary deployment — EXIM Bank Tanzania head office.',
    admin_id
  ),
  (
    'NMB Bank Tanzania', 'NMB-TZ',
    'collateral@nmb.co.tz', '+255 22 219 0000', 'Tanzania',
    null, '#0F4C81', '#F59E0B',
    'Secure Collateral Management',
    null,
    'admin@nmb.co.tz', true,
    'Pilot deployment for NMB Bank.',
    admin_id
  ),
  (
    'CRDB Bank', 'CRDB-TZ',
    'collateral@crdb.co.tz', '+255 22 211 7441', 'Tanzania',
    null, '#006B3C', '#EF4444',
    'Collateral & Securities Platform',
    null,
    'admin@crdb.co.tz', false,
    'Onboarding in progress — not yet live.',
    admin_id
  )
  ON CONFLICT (bank_code) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
