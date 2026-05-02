-- ============================================================
-- CollateralMS — Security Pocket: Physical Location Mapping,
-- Custodian Tracking & Check-Out/Check-In Log
-- ============================================================

-- 1. ENUM: pocket status
DROP TYPE IF EXISTS public.pocket_status CASCADE;
CREATE TYPE public.pocket_status AS ENUM ('active', 'inactive', 'archived');

-- 2. ENUM: checkout status
DROP TYPE IF EXISTS public.checkout_status CASCADE;
CREATE TYPE public.checkout_status AS ENUM ('checked_out', 'returned', 'overdue');

-- 3. security_pockets table
CREATE TABLE IF NOT EXISTS public.security_pockets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID NOT NULL REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  pocket_name TEXT NOT NULL,
  -- Physical location fields
  building TEXT DEFAULT '',
  floor TEXT DEFAULT '',
  room TEXT DEFAULT '',
  cabinet TEXT DEFAULT '',
  drawer TEXT DEFAULT '',
  slot TEXT DEFAULT '',
  location_notes TEXT DEFAULT '',
  -- Custodian
  custodian_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  custodian_name TEXT DEFAULT '',
  custodian_assigned_at TIMESTAMPTZ,
  -- Status
  pocket_status public.pocket_status DEFAULT 'active'::public.pocket_status,
  -- Discrepancy flag: digital docs exist but physical not confirmed
  has_discrepancy BOOLEAN DEFAULT false,
  discrepancy_notes TEXT DEFAULT '',
  -- Audit
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 4. pocket_checkout_log table
CREATE TABLE IF NOT EXISTS public.pocket_checkout_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pocket_id UUID NOT NULL REFERENCES public.security_pockets(id) ON DELETE CASCADE,
  collateral_record_id UUID NOT NULL REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  -- Who checked out
  checked_out_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  checked_out_by_name TEXT DEFAULT '',
  checked_out_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  purpose TEXT DEFAULT '',
  expected_return_date DATE,
  -- Return info
  returned_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  returned_by_name TEXT DEFAULT '',
  returned_at TIMESTAMPTZ,
  return_notes TEXT DEFAULT '',
  -- Status
  checkout_status public.checkout_status DEFAULT 'checked_out'::public.checkout_status,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 5. Indexes
CREATE INDEX IF NOT EXISTS idx_security_pockets_collateral_record_id ON public.security_pockets(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_security_pockets_collateral_id ON public.security_pockets(collateral_id);
CREATE INDEX IF NOT EXISTS idx_security_pockets_custodian_id ON public.security_pockets(custodian_id);
CREATE INDEX IF NOT EXISTS idx_pocket_checkout_log_pocket_id ON public.pocket_checkout_log(pocket_id);
CREATE INDEX IF NOT EXISTS idx_pocket_checkout_log_collateral_record_id ON public.pocket_checkout_log(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_pocket_checkout_log_checked_out_at ON public.pocket_checkout_log(checked_out_at DESC);

-- 6. Updated_at trigger function
CREATE OR REPLACE FUNCTION public.update_security_pocket_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_security_pockets_updated_at ON public.security_pockets;
CREATE TRIGGER trg_security_pockets_updated_at
  BEFORE UPDATE ON public.security_pockets
  FOR EACH ROW EXECUTE FUNCTION public.update_security_pocket_updated_at();

-- 7. Enable RLS
ALTER TABLE public.security_pockets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pocket_checkout_log ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies — security_pockets
DROP POLICY IF EXISTS "authenticated_read_security_pockets" ON public.security_pockets;
CREATE POLICY "authenticated_read_security_pockets"
ON public.security_pockets
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_security_pockets" ON public.security_pockets;
CREATE POLICY "authenticated_insert_security_pockets"
ON public.security_pockets
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update_security_pockets" ON public.security_pockets;
CREATE POLICY "authenticated_update_security_pockets"
ON public.security_pockets
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_delete_security_pockets" ON public.security_pockets;
CREATE POLICY "authenticated_delete_security_pockets"
ON public.security_pockets
FOR DELETE
TO authenticated
USING (
  created_by = auth.uid()
  OR public.get_user_role() IN ('system_admin', 'legal_officer')
);

-- 9. RLS Policies — pocket_checkout_log
DROP POLICY IF EXISTS "authenticated_read_pocket_checkout_log" ON public.pocket_checkout_log;
CREATE POLICY "authenticated_read_pocket_checkout_log"
ON public.pocket_checkout_log
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_pocket_checkout_log" ON public.pocket_checkout_log;
CREATE POLICY "authenticated_insert_pocket_checkout_log"
ON public.pocket_checkout_log
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update_pocket_checkout_log" ON public.pocket_checkout_log;
CREATE POLICY "authenticated_update_pocket_checkout_log"
ON public.pocket_checkout_log
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);
