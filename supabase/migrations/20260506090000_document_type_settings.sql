-- Migration: document_type_settings
-- Persists configurable document types (required/optional) from Settings

CREATE TABLE IF NOT EXISTS public.document_type_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  required BOOLEAN NOT NULL DEFAULT false,
  expiry_tracked BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_type_settings_name
  ON public.document_type_settings (name);

CREATE INDEX IF NOT EXISTS idx_document_type_settings_required
  ON public.document_type_settings (required) WHERE is_active = true;

ALTER TABLE public.document_type_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_document_type_settings" ON public.document_type_settings;
CREATE POLICY "authenticated_read_document_type_settings"
  ON public.document_type_settings
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_write_document_type_settings" ON public.document_type_settings;
CREATE POLICY "authenticated_write_document_type_settings"
  ON public.document_type_settings
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Seed default document types
INSERT INTO public.document_type_settings (name, description, required, expiry_tracked, sort_order)
VALUES
  ('Title Deed',               'Official land or property ownership document',     true,  false, 1),
  ('Certificate of Incorporation', 'Company registration certificate from BRELA', true,  false, 2),
  ('Insurance Certificate',    'Asset insurance policy document',                  true,  true,  3),
  ('Valuation Report',         'Independent property or asset valuation',          true,  true,  4),
  ('Board Resolution',         'Board approval for collateral pledge',             false, false, 5),
  ('Mortgage Deed',            'Registered mortgage instrument',                   true,  false, 6),
  ('Share Certificate',        'Equity share ownership certificate',               false, false, 7),
  ('Vessel Registration',      'TASAC vessel registration document',               false, true,  8),
  ('Charge Certificate',       'Certificate confirming registration of charge',    false, false, 9),
  ('BRELA Confirmation',       'BRELA debenture registration confirmation',        false, false, 10),
  ('Other',                    'Any other supporting document',                    false, false, 99)
ON CONFLICT (name) DO NOTHING;
