-- ============================================================
-- Collateral Approval Pipeline
-- Dedicated approval requests for Legal Officers & Credit Managers
-- ============================================================

-- ── 1. ENUM TYPES ──────────────────────────────────────────

DROP TYPE IF EXISTS public.approval_request_status CASCADE;
CREATE TYPE public.approval_request_status AS ENUM (
  'Pending',
  'Under Review',
  'Approved',
  'Rejected',
  'Escalated',
  'Returned'
);

DROP TYPE IF EXISTS public.approval_request_type CASCADE;
CREATE TYPE public.approval_request_type AS ENUM (
  'Legal Review',
  'Credit Assessment',
  'Compliance Check',
  'Valuation Approval',
  'Release Authorization'
);

DROP TYPE IF EXISTS public.approver_role CASCADE;
CREATE TYPE public.approver_role AS ENUM (
  'Legal Officer',
  'Credit Manager',
  'Compliance Officer',
  'Senior Manager',
  'System'
);

-- ── 2. CORE TABLE ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.collateral_approval_requests (
  id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id    UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_ref          TEXT NOT NULL,
  collateral_type         TEXT NOT NULL,
  obligor                 TEXT NOT NULL,
  request_type            public.approval_request_type NOT NULL DEFAULT 'Legal Review',
  request_status          public.approval_request_status NOT NULL DEFAULT 'Pending',
  priority                TEXT NOT NULL DEFAULT 'Normal' CHECK (priority IN ('High', 'Normal', 'Low')),
  routed_by               UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  routed_by_name          TEXT NOT NULL DEFAULT '',
  routed_at               TIMESTAMPTZ DEFAULT now(),
  assigned_to_role        public.approver_role NOT NULL DEFAULT 'Legal Officer',
  assigned_to             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_to_name        TEXT NOT NULL DEFAULT '',
  reviewed_by             UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_by_name        TEXT NOT NULL DEFAULT '',
  reviewed_at             TIMESTAMPTZ,
  decision                TEXT,
  decision_notes          TEXT,
  compliance_attested     BOOLEAN NOT NULL DEFAULT FALSE,
  compliance_attested_by  UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  compliance_attested_at  TIMESTAMPTZ,
  pipeline_stage          INTEGER NOT NULL DEFAULT 1 CHECK (pipeline_stage BETWEEN 1 AND 5),
  due_date                TIMESTAMPTZ,
  collateral_value        NUMERIC(18,2),
  loan_ref                TEXT,
  supporting_notes        TEXT,
  created_at              TIMESTAMPTZ DEFAULT now(),
  updated_at              TIMESTAMPTZ DEFAULT now()
);

-- ── 3. COMMENTS TABLE ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_comments (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id       UUID NOT NULL REFERENCES public.collateral_approval_requests(id) ON DELETE CASCADE,
  author_id         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  author_name       TEXT NOT NULL DEFAULT '',
  author_role       TEXT NOT NULL DEFAULT '',
  comment_text      TEXT NOT NULL,
  is_internal       BOOLEAN NOT NULL DEFAULT FALSE,
  created_at        TIMESTAMPTZ DEFAULT now()
);

-- ── 4. PIPELINE STAGE LOG ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.approval_pipeline_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  approval_id     UUID NOT NULL REFERENCES public.collateral_approval_requests(id) ON DELETE CASCADE,
  from_stage      INTEGER,
  to_stage        INTEGER NOT NULL,
  from_status     TEXT,
  to_status       TEXT NOT NULL,
  changed_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT NOT NULL DEFAULT '',
  changed_by_role TEXT NOT NULL DEFAULT '',
  reason          TEXT,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ── 5. INDEXES ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_car_collateral_record_id ON public.collateral_approval_requests(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_car_request_status ON public.collateral_approval_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_car_assigned_to_role ON public.collateral_approval_requests(assigned_to_role);
CREATE INDEX IF NOT EXISTS idx_car_routed_at ON public.collateral_approval_requests(routed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ac_approval_id ON public.approval_comments(approval_id);
CREATE INDEX IF NOT EXISTS idx_apl_approval_id ON public.approval_pipeline_log(approval_id);

-- ── 6. UPDATED_AT TRIGGER ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_approval_request_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_approval_request_updated_at ON public.collateral_approval_requests;
CREATE TRIGGER trg_approval_request_updated_at
  BEFORE UPDATE ON public.collateral_approval_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_approval_request_updated_at();

-- ── 7. RLS ─────────────────────────────────────────────────

ALTER TABLE public.collateral_approval_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.approval_pipeline_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_approval_requests" ON public.collateral_approval_requests;
CREATE POLICY "authenticated_all_approval_requests"
  ON public.collateral_approval_requests
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_approval_comments" ON public.approval_comments;
CREATE POLICY "authenticated_all_approval_comments"
  ON public.approval_comments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_approval_pipeline_log" ON public.approval_pipeline_log;
CREATE POLICY "authenticated_all_approval_pipeline_log"
  ON public.approval_pipeline_log
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

-- ── 8. SEED DATA ───────────────────────────────────────────

DO $$
DECLARE
  v_user_id UUID;
  v_collateral_id UUID;
  v_req1 UUID := gen_random_uuid();
  v_req2 UUID := gen_random_uuid();
  v_req3 UUID := gen_random_uuid();
  v_req4 UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;
  SELECT id INTO v_collateral_id FROM public.collateral_records LIMIT 1;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.collateral_approval_requests (
      id, collateral_record_id, collateral_ref, collateral_type, obligor,
      request_type, request_status, priority, routed_by, routed_by_name,
      routed_at, assigned_to_role, assigned_to_name, pipeline_stage,
      due_date, collateral_value, loan_ref, supporting_notes
    ) VALUES
    (
      v_req1, v_collateral_id, 'COL-2024-0045', 'Mortgage', 'Karibu Enterprises Ltd',
      'Legal Review', 'Pending', 'High', v_user_id, 'Credit Officer',
      now() - interval '2 hours', 'Legal Officer', '', 2,
      now() + interval '3 days', 85000000, 'LN-2024-0112',
      'Title deed verified. Charge documents ready for legal review before BRELA registration.'
    ),
    (
      v_req2, v_collateral_id, 'COL-2024-0078', 'Debenture', 'Simba Trading Co.',
      'Credit Assessment', 'Under Review', 'Normal', v_user_id, 'Credit Officer',
      now() - interval '5 hours', 'Credit Manager', '', 3,
      now() + interval '5 days', 120000000, 'LN-2024-0089',
      'Debenture amendment requires credit manager sign-off before lodging with BRELA.'
    ),
    (
      v_req3, v_collateral_id, 'COL-2024-0091', 'Land', 'Mwanga Holdings Ltd',
      'Compliance Check', 'Pending', 'High', v_user_id, 'Senior Officer',
      now() - interval '1 hour', 'Compliance Officer', '', 1,
      now() + interval '2 days', 200000000, 'LN-2024-0134',
      'New land collateral requires compliance verification before perfection.'
    ),
    (
      v_req4, v_collateral_id, 'COL-2024-0033', 'Vehicle', 'Jua Kali Motors',
      'Valuation Approval', 'Approved', 'Low', v_user_id, 'Credit Officer',
      now() - interval '2 days', 'Credit Manager', '', 5,
      now() - interval '1 day', 15000000, 'LN-2024-0067',
      'Vehicle valuation approved. Logbook charge registered.'
    )
    ON CONFLICT (id) DO NOTHING;

    -- Seed comments for req1
    INSERT INTO public.approval_comments (approval_id, author_id, author_name, author_role, comment_text, is_internal)
    VALUES
      (v_req1, v_user_id, 'Credit Officer', 'Credit Officer', 'Title deed has been verified with Lands Registry. All documents are in order.', false),
      (v_req1, v_user_id, 'Legal Officer', 'Legal Officer', 'Reviewed charge documents. Minor amendment needed on clause 4.2 before registration.', true)
    ON CONFLICT (id) DO NOTHING;

    -- Seed pipeline log for req2
    INSERT INTO public.approval_pipeline_log (approval_id, from_stage, to_stage, from_status, to_status, changed_by, changed_by_name, changed_by_role, reason)
    VALUES
      (v_req2, 1, 2, 'Pending', 'Pending', v_user_id, 'Credit Officer', 'Credit Officer', 'Routed for credit assessment'),
      (v_req2, 2, 3, 'Pending', 'Under Review', v_user_id, 'Credit Manager', 'Credit Manager', 'Assigned for detailed review')
    ON CONFLICT (id) DO NOTHING;
  ELSE
    RAISE NOTICE 'No user profiles found. Skipping seed data.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
