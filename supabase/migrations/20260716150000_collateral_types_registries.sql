-- Collateral Types and Registries Lookup Tables
-- Replaces hardcoded arrays in the application with live DB-driven dropdowns

-- ── Collateral Types ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collateral_types (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  registry_code TEXT,
  perfection_deadline_days INTEGER,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collateral_types_active ON public.collateral_types(active);
CREATE INDEX IF NOT EXISTS idx_collateral_types_sort ON public.collateral_types(sort_order);

ALTER TABLE public.collateral_types ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_collateral_types" ON public.collateral_types;
CREATE POLICY "authenticated_read_collateral_types"
ON public.collateral_types
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admin_manage_collateral_types" ON public.collateral_types;
CREATE POLICY "admin_manage_collateral_types"
ON public.collateral_types
FOR ALL
TO authenticated
USING (public.is_system_admin_user())
WITH CHECK (public.is_system_admin_user());

-- ── Registries ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.registries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  full_name TEXT,
  country TEXT NOT NULL DEFAULT 'Tanzania',
  asset_class TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_registries_active ON public.registries(active);
CREATE INDEX IF NOT EXISTS idx_registries_sort ON public.registries(sort_order);

ALTER TABLE public.registries ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_registries" ON public.registries;
CREATE POLICY "authenticated_read_registries"
ON public.registries
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "admin_manage_registries" ON public.registries;
CREATE POLICY "admin_manage_registries"
ON public.registries
FOR ALL
TO authenticated
USING (public.is_system_admin_user())
WITH CHECK (public.is_system_admin_user());

-- ── Seed Collateral Types ─────────────────────────────────────────────────────
INSERT INTO public.collateral_types (name, description, registry_code, perfection_deadline_days, active, sort_order)
VALUES
  ('Mortgage',       'Freehold and leasehold land and buildings',                        'LANDS', 90, true, 1),
  ('Debenture',      'Fixed and floating charge over company assets',                    'BRELA', 42, true, 2),
  ('Motor Vehicle',  'Cars, trucks, motorcycles and other road vehicles',                'TRA',   30, true, 3),
  ('Shares (DSE)',   'Shares listed on the Dar es Salaam Stock Exchange',                'DSE',   14, true, 4),
  ('FDR',            'Fixed Deposit Receipt — bank deposits and cash collateral',        '',      NULL, true, 5),
  ('Guarantee',      'Corporate or personal guarantee',                                  '',      NULL, true, 6),
  ('Ship/Vessel',    'Ships, boats, and other watercraft',                               'TASAC', 60, true, 7)
ON CONFLICT (name) DO NOTHING;

-- ── Seed Registries ───────────────────────────────────────────────────────────
INSERT INTO public.registries (code, name, full_name, country, asset_class, active, sort_order)
VALUES
  ('BRELA',          'BRELA',         'Business Registrations and Licensing Agency',  'Tanzania', 'Corporate / Business Assets',    true, 1),
  ('Lands Registry', 'Lands Registry','Ministry of Lands – Property Registry',        'Tanzania', 'Real Estate / Land',              true, 2),
  ('TRA',            'TRA',           'Tanzania Revenue Authority',                   'Tanzania', 'Motor Vehicles / Tax Compliance', true, 3),
  ('DSE',            'DSE',           'Dar es Salaam Stock Exchange',                 'Tanzania', 'Listed Securities / Equities',    true, 4),
  ('TASAC',          'TASAC',         'Tanzania Shipping Agencies Corporation',        'Tanzania', 'Vessels / Maritime Assets',       true, 5),
  ('N/A',            'N/A',           'Not Applicable — no external registry required','Tanzania', 'Guarantees / FDRs',               true, 6)
ON CONFLICT (code) DO NOTHING;
