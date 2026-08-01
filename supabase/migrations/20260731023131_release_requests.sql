-- ─── release_requests table ────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.release_request_status CASCADE;
CREATE TYPE public.release_request_status AS ENUM ('Pending', 'Under Review', 'Approved', 'Rejected');

DROP TYPE IF EXISTS public.release_request_priority CASCADE;
CREATE TYPE public.release_request_priority AS ENUM ('High', 'Normal', 'Low');

CREATE TABLE IF NOT EXISTS public.release_requests (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_ref    TEXT NOT NULL,
  collateral_type   TEXT NOT NULL,
  client_name       TEXT NOT NULL,
  loan_ref          TEXT NOT NULL,
  estimated_value   NUMERIC(20, 2) NOT NULL DEFAULT 0,
  requested_by      TEXT NOT NULL,
  requested_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  release_reason    TEXT NOT NULL,
  request_status    public.release_request_status NOT NULL DEFAULT 'Pending',
  priority          public.release_request_priority NOT NULL DEFAULT 'Normal',
  notes             TEXT,
  reviewed_by       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_release_requests_status   ON public.release_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_release_requests_priority ON public.release_requests(priority);
CREATE INDEX IF NOT EXISTS idx_release_requests_created  ON public.release_requests(created_at DESC);

-- ─── updated_at trigger ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_release_requests_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_release_requests_updated_at ON public.release_requests;
CREATE TRIGGER trg_release_requests_updated_at
  BEFORE UPDATE ON public.release_requests
  FOR EACH ROW EXECUTE FUNCTION public.set_release_requests_updated_at();

-- ─── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.release_requests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "release_requests_authenticated_all" ON public.release_requests;
CREATE POLICY "release_requests_authenticated_all"
  ON public.release_requests
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Seed data ─────────────────────────────────────────────────────────────────

DO $$
DECLARE
  existing_user_id UUID;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;
  END IF;

  INSERT INTO public.release_requests
    (collateral_ref, collateral_type, client_name, loan_ref, estimated_value,
     requested_by, requested_date, release_reason, request_status, priority, notes, created_by)
  VALUES
    ('COL-2024-0045', 'Land Title',          'Karibu Enterprises Ltd',  'LN-2024-1123', 450000000,
     'James Mwangi',   '2026-07-14', 'Loan fully repaid — collateral discharge requested',
     'Pending',       'High',   NULL,                                                         existing_user_id),
    ('COL-2024-0078', 'Motor Vehicle',        'Simba Trading Co.',       'LN-2024-0987',  85000000,
     'Grace Odhiambo', '2026-07-13', 'Partial settlement — releasing secondary collateral',
     'Under Review',  'Normal', NULL,                                                         existing_user_id),
    ('COL-2023-0312', 'Commercial Property',  'Nguvu Holdings',          'LN-2023-0456', 1200000000,
     'Peter Kamau',    '2026-07-12', 'Collateral substitution approved — releasing original',
     'Approved',      'Normal', NULL,                                                         existing_user_id),
    ('COL-2024-0091', 'Equipment',            'Jua Kali Manufacturers',  'LN-2024-0234',  32000000,
     'Alice Wanjiku',  '2026-07-11', 'Loan restructured — collateral no longer required',
     'Rejected',      'Low',    'Outstanding balance remains. Release denied pending full settlement.', existing_user_id),
    ('COL-2024-0103', 'Fixed Deposit',        'Amani Savings Group',     'LN-2024-0567',  15000000,
     'David Otieno',   '2026-07-10', 'Loan matured and fully settled',
     'Pending',       'Normal', NULL,                                                         existing_user_id)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
