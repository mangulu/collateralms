-- ─── Registry Submission Tracker ─────────────────────────────────────────────
-- Tracks perfection registry submissions per collateral record
-- Covers: BRELA, Lands Registry, TRA (motor vehicles), DSE/CSDR (shares), Tanzania Shipping (vessels)

-- 1. Enum types
DROP TYPE IF EXISTS public.registry_submission_status CASCADE;
CREATE TYPE public.registry_submission_status AS ENUM (
  'Pending',
  'Submitted',
  'Acknowledged',
  'Registered',
  'Rejected'
);

DROP TYPE IF EXISTS public.perfection_registry_name CASCADE;
CREATE TYPE public.perfection_registry_name AS ENUM (
  'BRELA',
  'Lands Registry',
  'TRA',
  'DSE/CSDR',
  'Tanzania Shipping',
  'Other'
);

-- 2. Main submissions table
CREATE TABLE IF NOT EXISTS public.registry_submission_tracker (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID NOT NULL REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  registry_name        public.perfection_registry_name NOT NULL,
  submission_status    public.registry_submission_status NOT NULL DEFAULT 'Pending',
  submission_ref       TEXT,
  submitted_at         TIMESTAMPTZ,
  submitted_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  acknowledged_at      TIMESTAMPTZ,
  acknowledged_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  acknowledgement_ref  TEXT,
  registered_at        TIMESTAMPTZ,
  registered_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  registration_ref     TEXT,
  rejected_at          TIMESTAMPTZ,
  rejected_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  rejection_reason     TEXT,
  notes                TEXT,
  document_paths       JSONB NOT NULL DEFAULT '[]'::JSONB,
  created_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Audit trail table for every status change
CREATE TABLE IF NOT EXISTS public.registry_submission_audit (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id     UUID NOT NULL REFERENCES public.registry_submission_tracker(id) ON DELETE CASCADE,
  from_status       public.registry_submission_status,
  to_status         public.registry_submission_status NOT NULL,
  changed_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_by_name   TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. Indexes
CREATE INDEX IF NOT EXISTS idx_rst_collateral_record_id ON public.registry_submission_tracker(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_rst_registry_name ON public.registry_submission_tracker(registry_name);
CREATE INDEX IF NOT EXISTS idx_rst_status ON public.registry_submission_tracker(submission_status);
CREATE INDEX IF NOT EXISTS idx_rsa_submission_id ON public.registry_submission_audit(submission_id);

-- 5. updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_rst_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rst_updated_at ON public.registry_submission_tracker;
CREATE TRIGGER trg_rst_updated_at
  BEFORE UPDATE ON public.registry_submission_tracker
  FOR EACH ROW EXECUTE FUNCTION public.set_rst_updated_at();

-- 6. RLS
ALTER TABLE public.registry_submission_tracker ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registry_submission_audit ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_registry_submission_tracker" ON public.registry_submission_tracker;
CREATE POLICY "authenticated_all_registry_submission_tracker"
  ON public.registry_submission_tracker
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_registry_submission_audit" ON public.registry_submission_audit;
CREATE POLICY "authenticated_all_registry_submission_audit"
  ON public.registry_submission_audit
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
