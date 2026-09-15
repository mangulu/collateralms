-- ─── Credit Policy Review Workflow ───────────────────────────────────────────
-- Board-level annual credit policy review tracker with approval stages
-- and BOT submission status tracking

-- ─── Types ────────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.cpr_approval_stage CASCADE;
CREATE TYPE public.cpr_approval_stage AS ENUM (
  'Draft',
  'Credit Committee Review',
  'Risk Management Review',
  'Board Audit Committee',
  'Full Board Approval',
  'Approved'
);

DROP TYPE IF EXISTS public.cpr_bot_status CASCADE;
CREATE TYPE public.cpr_bot_status AS ENUM (
  'Pending',
  'Submitted',
  'Acknowledged'
);

DROP TYPE IF EXISTS public.cpr_priority CASCADE;
CREATE TYPE public.cpr_priority AS ENUM (
  'Low',
  'Medium',
  'High',
  'Critical'
);

-- ─── Core Table ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_policy_reviews (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_title          TEXT NOT NULL,
  policy_reference      TEXT NOT NULL,
  review_year           INTEGER NOT NULL,
  review_cycle          TEXT NOT NULL DEFAULT 'Annual',
  description           TEXT,
  priority              public.cpr_priority NOT NULL DEFAULT 'Medium'::public.cpr_priority,
  current_stage         public.cpr_approval_stage NOT NULL DEFAULT 'Draft'::public.cpr_approval_stage,
  bot_status            public.cpr_bot_status NOT NULL DEFAULT 'Pending'::public.cpr_bot_status,
  bot_submission_date   DATE,
  bot_acknowledgement_date DATE,
  bot_reference_number  TEXT,
  due_date              DATE,
  completed_date        DATE,
  initiated_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_to           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes                 TEXT,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Approval Stage History ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.credit_policy_review_stages (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id         UUID NOT NULL REFERENCES public.credit_policy_reviews(id) ON DELETE CASCADE,
  stage             public.cpr_approval_stage NOT NULL,
  status            TEXT NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'In Progress', 'Approved', 'Rejected', 'Skipped')),
  approver_id       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at       TIMESTAMPTZ,
  comments          TEXT,
  order_index       INTEGER NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_cpr_review_year ON public.credit_policy_reviews(review_year);
CREATE INDEX IF NOT EXISTS idx_cpr_current_stage ON public.credit_policy_reviews(current_stage);
CREATE INDEX IF NOT EXISTS idx_cpr_bot_status ON public.credit_policy_reviews(bot_status);
CREATE INDEX IF NOT EXISTS idx_cpr_is_active ON public.credit_policy_reviews(is_active);
CREATE INDEX IF NOT EXISTS idx_cpr_stages_review_id ON public.credit_policy_review_stages(review_id);
CREATE INDEX IF NOT EXISTS idx_cpr_stages_stage ON public.credit_policy_review_stages(stage);

-- ─── Updated At Trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.cpr_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS cpr_reviews_updated_at ON public.credit_policy_reviews;
CREATE TRIGGER cpr_reviews_updated_at
  BEFORE UPDATE ON public.credit_policy_reviews
  FOR EACH ROW EXECUTE FUNCTION public.cpr_set_updated_at();

DROP TRIGGER IF EXISTS cpr_stages_updated_at ON public.credit_policy_review_stages;
CREATE TRIGGER cpr_stages_updated_at
  BEFORE UPDATE ON public.credit_policy_review_stages
  FOR EACH ROW EXECUTE FUNCTION public.cpr_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.credit_policy_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_policy_review_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_access_credit_policy_reviews" ON public.credit_policy_reviews;
CREATE POLICY "authenticated_access_credit_policy_reviews"
  ON public.credit_policy_reviews
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_access_credit_policy_review_stages" ON public.credit_policy_review_stages;
CREATE POLICY "authenticated_access_credit_policy_review_stages"
  ON public.credit_policy_review_stages
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Seed Data ────────────────────────────────────────────────────────────────

DO $$
DECLARE
  existing_user_id UUID;
  rev1_id UUID := gen_random_uuid();
  rev2_id UUID := gen_random_uuid();
  rev3_id UUID := gen_random_uuid();
  rev4_id UUID := gen_random_uuid();
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;
  END IF;

  -- Review 1: Fully approved and BOT acknowledged
  INSERT INTO public.credit_policy_reviews (
    id, policy_title, policy_reference, review_year, review_cycle, description,
    priority, current_stage, bot_status, bot_submission_date, bot_acknowledgement_date,
    bot_reference_number, due_date, completed_date, initiated_by, assigned_to, notes
  ) VALUES (
    rev1_id,
    'Credit Risk Management Policy',
    'CRMP-2025-001',
    2025,
    'Annual',
    'Annual review of the core credit risk management framework covering classification criteria, provisioning methodology, and collateral valuation standards.',
    'High'::public.cpr_priority,
    'Approved'::public.cpr_approval_stage,
    'Acknowledged'::public.cpr_bot_status,
    '2025-03-15',
    '2025-04-02',
    'BOT/CRM/2025/0042',
    '2025-03-31',
    '2025-03-20',
    existing_user_id,
    existing_user_id,
    'Approved unanimously at Full Board meeting on 20 March 2025. BOT acknowledgement received 2 April 2025.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Review 2: Submitted to BOT, awaiting acknowledgement
  INSERT INTO public.credit_policy_reviews (
    id, policy_title, policy_reference, review_year, review_cycle, description,
    priority, current_stage, bot_status, bot_submission_date,
    bot_reference_number, due_date, initiated_by, assigned_to, notes
  ) VALUES (
    rev2_id,
    'Collateral Valuation & Haircut Policy',
    'CVHP-2026-001',
    2026,
    'Annual',
    'Annual review of collateral valuation methodologies, haircut schedules per asset class, and LTV thresholds in line with BOT Prudential Guidelines.',
    'Critical'::public.cpr_priority,
    'Approved'::public.cpr_approval_stage,
    'Submitted'::public.cpr_bot_status,
    '2026-08-20',
    '2026-08-31',
    existing_user_id,
    existing_user_id,
    'Board approved on 18 August 2026. Submitted to BOT on 20 August 2026. Awaiting formal acknowledgement.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Review 3: In Board Audit Committee stage
  INSERT INTO public.credit_policy_reviews (
    id, policy_title, policy_reference, review_year, review_cycle, description,
    priority, current_stage, bot_status, due_date, initiated_by, assigned_to, notes
  ) VALUES (
    rev3_id,
    'Loan Classification & Provisioning Policy',
    'LCPP-2026-001',
    2026,
    'Annual',
    'Annual review of the loan classification engine (5-tier BOT framework), provisioning rates, and quarterly reporting obligations.',
    'High'::public.cpr_priority,
    'Board Audit Committee'::public.cpr_approval_stage,
    'Pending'::public.cpr_bot_status,
    '2026-09-30',
    existing_user_id,
    existing_user_id,
    'Passed Credit Committee and Risk Management reviews. Currently with Board Audit Committee for final review before Full Board.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Review 4: Early draft stage
  INSERT INTO public.credit_policy_reviews (
    id, policy_title, policy_reference, review_year, review_cycle, description,
    priority, current_stage, bot_status, due_date, initiated_by, assigned_to, notes
  ) VALUES (
    rev4_id,
    'Large Exposure & Concentration Risk Policy',
    'LECRP-2026-001',
    2026,
    'Annual',
    'Annual review of single-borrower limits, sector concentration thresholds, and related-party exposure controls per BOT regulations.',
    'Medium'::public.cpr_priority,
    'Credit Committee Review'::public.cpr_approval_stage,
    'Pending'::public.cpr_bot_status,
    '2026-10-31',
    existing_user_id,
    existing_user_id,
    'Draft completed. Submitted to Credit Committee for initial review.'
  ) ON CONFLICT (id) DO NOTHING;

  -- Stage records for rev3 (Board Audit Committee stage)
  INSERT INTO public.credit_policy_review_stages (review_id, stage, status, order_index, approved_at, comments) VALUES
    (rev3_id, 'Draft'::public.cpr_approval_stage, 'Approved', 1, NOW() - INTERVAL '30 days', 'Initial draft approved by policy team.'),
    (rev3_id, 'Credit Committee Review'::public.cpr_approval_stage, 'Approved', 2, NOW() - INTERVAL '20 days', 'Credit Committee approved with minor amendments.'),
    (rev3_id, 'Risk Management Review'::public.cpr_approval_stage, 'Approved', 3, NOW() - INTERVAL '10 days', 'Risk Management sign-off obtained.'),
    (rev3_id, 'Board Audit Committee'::public.cpr_approval_stage, 'In Progress', 4, NULL, NULL),
    (rev3_id, 'Full Board Approval'::public.cpr_approval_stage, 'Pending', 5, NULL, NULL),
    (rev3_id, 'Approved'::public.cpr_approval_stage, 'Pending', 6, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;

  -- Stage records for rev4 (Credit Committee stage)
  INSERT INTO public.credit_policy_review_stages (review_id, stage, status, order_index, approved_at, comments) VALUES
    (rev4_id, 'Draft'::public.cpr_approval_stage, 'Approved', 1, NOW() - INTERVAL '5 days', 'Draft completed and approved internally.'),
    (rev4_id, 'Credit Committee Review'::public.cpr_approval_stage, 'In Progress', 2, NULL, NULL),
    (rev4_id, 'Risk Management Review'::public.cpr_approval_stage, 'Pending', 3, NULL, NULL),
    (rev4_id, 'Board Audit Committee'::public.cpr_approval_stage, 'Pending', 4, NULL, NULL),
    (rev4_id, 'Full Board Approval'::public.cpr_approval_stage, 'Pending', 5, NULL, NULL),
    (rev4_id, 'Approved'::public.cpr_approval_stage, 'Pending', 6, NULL, NULL)
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Credit policy review seed data failed: %', SQLERRM;
END $$;
