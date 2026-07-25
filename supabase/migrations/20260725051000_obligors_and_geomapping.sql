-- ============================================================
-- Obligors Module + Geo-mapping for Collateral Records
-- ============================================================

-- 1. Add lat/lng columns to collateral_records (idempotent)
ALTER TABLE public.collateral_records
  ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS location_address TEXT DEFAULT NULL;

-- 2. Create obligors table
CREATE TABLE IF NOT EXISTS public.obligors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligor_code TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  entity_type TEXT NOT NULL DEFAULT 'individual', -- 'individual' | 'company'
  id_number TEXT DEFAULT NULL,
  registration_number TEXT DEFAULT NULL,
  tax_id TEXT DEFAULT NULL,
  -- Address
  address_line1 TEXT DEFAULT NULL,
  address_line2 TEXT DEFAULT NULL,
  city TEXT DEFAULT NULL,
  region TEXT DEFAULT NULL,
  country TEXT DEFAULT 'Tanzania',
  postal_code TEXT DEFAULT NULL,
  -- Contacts
  phone_primary TEXT DEFAULT NULL,
  phone_secondary TEXT DEFAULT NULL,
  email TEXT DEFAULT NULL,
  contact_person TEXT DEFAULT NULL,
  -- Risk
  risk_rating TEXT DEFAULT 'MEDIUM', -- 'LOW' | 'MEDIUM' | 'HIGH'
  credit_limit NUMERIC DEFAULT NULL,
  -- Meta
  notes TEXT DEFAULT NULL,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Add obligor_ref_id to collateral_records (FK to obligors, nullable for backward compat)
ALTER TABLE public.collateral_records
  ADD COLUMN IF NOT EXISTS obligor_ref_id UUID REFERENCES public.obligors(id) ON DELETE SET NULL;

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_obligors_obligor_code ON public.obligors(obligor_code);
CREATE INDEX IF NOT EXISTS idx_obligors_full_name ON public.obligors(full_name);
CREATE INDEX IF NOT EXISTS idx_obligors_entity_type ON public.obligors(entity_type);
CREATE INDEX IF NOT EXISTS idx_collateral_records_obligor_ref_id ON public.collateral_records(obligor_ref_id);
CREATE INDEX IF NOT EXISTS idx_collateral_records_lat_lng ON public.collateral_records(latitude, longitude);

-- 5. Updated_at trigger for obligors
CREATE OR REPLACE FUNCTION public.set_obligors_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obligors_updated_at ON public.obligors;
CREATE TRIGGER trg_obligors_updated_at
  BEFORE UPDATE ON public.obligors
  FOR EACH ROW EXECUTE FUNCTION public.set_obligors_updated_at();

-- 6. Enable RLS
ALTER TABLE public.obligors ENABLE ROW LEVEL SECURITY;

-- 7. RLS Policies
DROP POLICY IF EXISTS "authenticated_read_obligors" ON public.obligors;
CREATE POLICY "authenticated_read_obligors"
  ON public.obligors FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_obligors" ON public.obligors;
CREATE POLICY "authenticated_insert_obligors"
  ON public.obligors FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_obligors" ON public.obligors;
CREATE POLICY "authenticated_update_obligors"
  ON public.obligors FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_obligors" ON public.obligors;
CREATE POLICY "authenticated_delete_obligors"
  ON public.obligors FOR DELETE TO authenticated USING (true);

-- 8. Seed sample obligors
DO $$
DECLARE
  existing_user_id UUID;
BEGIN
  SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

  INSERT INTO public.obligors (
    id, obligor_code, full_name, entity_type, registration_number, tax_id,
    address_line1, city, region, country,
    phone_primary, email, contact_person,
    risk_rating, credit_limit, is_active, created_by
  ) VALUES
    (gen_random_uuid(), 'OBL-2024-0001', 'Tanzanian Steel Industries Ltd', 'company',
     'REG-2018-00123', 'TIN-123456789',
     'Plot 45, Industrial Area, Ohio Street', 'Dar es Salaam', 'Dar es Salaam', 'Tanzania',
     '+255 22 211 0001', 'info@tanzaniansteel.co.tz', 'James Mwangi',
     'LOW', 5000000000, true, existing_user_id),
    (gen_random_uuid(), 'OBL-2024-0002', 'Kilimanjaro Coffee Exporters Ltd', 'company',
     'REG-2015-00456', 'TIN-987654321',
     'Moshi Town Centre, Block B', 'Moshi', 'Kilimanjaro', 'Tanzania',
     '+255 27 275 0002', 'exports@kilicoffee.co.tz', 'Grace Kimaro',
     'LOW', 2000000000, true, existing_user_id),
    (gen_random_uuid(), 'OBL-2024-0003', 'Dar es Salaam Logistics Co.', 'company',
     'REG-2020-00789', 'TIN-456789123',
     'Temeke Industrial Zone, Warehouse 7', 'Dar es Salaam', 'Dar es Salaam', 'Tanzania',
     '+255 22 285 0003', 'ops@dslogistics.co.tz', 'Peter Makundi',
     'MEDIUM', 800000000, true, existing_user_id),
    (gen_random_uuid(), 'OBL-2024-0004', 'Mwanza Fish Processing Ltd', 'company',
     'REG-2019-01012', 'TIN-321654987',
     'Mwanza City Centre, Port Road', 'Mwanza', 'Mwanza', 'Tanzania',
     '+255 28 250 0004', 'admin@mwanzafish.co.tz', 'Sarah Nyerere',
     'HIGH', 400000000, true, existing_user_id),
    (gen_random_uuid(), 'OBL-2024-0005', 'Arusha New Ventures Ltd', 'company',
     'REG-2021-01345', 'TIN-654321789',
     'Arusha CBD, Sokoine Road', 'Arusha', 'Arusha', 'Tanzania',
     '+255 27 250 0005', 'contact@arushaventures.co.tz', 'David Laizer',
     'LOW', 3000000000, true, existing_user_id),
    (gen_random_uuid(), 'OBL-2024-0006', 'John Mwamba', 'individual',
     NULL, 'TIN-111222333',
     'Mikocheni B, Plot 12', 'Dar es Salaam', 'Dar es Salaam', 'Tanzania',
     '+255 754 000 006', 'john.mwamba@gmail.com', NULL,
     'MEDIUM', 150000000, true, existing_user_id)
  ON CONFLICT (obligor_code) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed obligors failed: %', SQLERRM;
END $$;
