-- ─── BOT Loan Classification & Provisioning Module ───────────────────────────
-- Migration: 20260831120000_loan_classification_provisioning.sql
-- BOT Risk Assets Regulations 2014 — 5-tier classification + provisioning

-- ─── 1. ENUM TYPES ────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.bot_classification CASCADE;
CREATE TYPE public.bot_classification AS ENUM (
  'Current',
  'Especially Mentioned',
  'Substandard',
  'Doubtful',
  'Loss'
);

DROP TYPE IF EXISTS public.classification_trigger CASCADE;
CREATE TYPE public.classification_trigger AS ENUM (
  'days_past_due',
  'qualitative_flag',
  'manual_override',
  'insurance_expired',
  'perfection_overdue',
  'covenant_breach',
  'collateral_deficiency'
);

-- ─── 2. LOAN CLASSIFICATIONS TABLE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.loan_classifications (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id               UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  obligor_id            UUID REFERENCES public.obligors(id) ON DELETE CASCADE,
  classification        public.bot_classification NOT NULL DEFAULT 'Current',
  days_past_due         INTEGER NOT NULL DEFAULT 0,
  outstanding_balance   NUMERIC(20, 2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'TZS',
  provision_rate        NUMERIC(5, 4) NOT NULL DEFAULT 0.01,
  provision_amount      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  primary_trigger       public.classification_trigger NOT NULL DEFAULT 'days_past_due',
  qualitative_flags     JSONB NOT NULL DEFAULT '[]',
  override_reason       TEXT,
  classified_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  classification_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  review_date           DATE,
  quarter               TEXT NOT NULL, -- e.g. '2026-Q3'
  is_active             BOOLEAN NOT NULL DEFAULT true,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_loan_classifications_loan_id
  ON public.loan_classifications(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_classifications_obligor_id
  ON public.loan_classifications(obligor_id);
CREATE INDEX IF NOT EXISTS idx_loan_classifications_quarter
  ON public.loan_classifications(quarter);
CREATE INDEX IF NOT EXISTS idx_loan_classifications_classification
  ON public.loan_classifications(classification);
CREATE INDEX IF NOT EXISTS idx_loan_classifications_active
  ON public.loan_classifications(is_active);

-- ─── 3. PROVISIONING REPORTS TABLE ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.provisioning_reports (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter               TEXT NOT NULL, -- e.g. '2026-Q3'
  report_date           DATE NOT NULL DEFAULT CURRENT_DATE,
  total_portfolio       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  total_provision       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  currency              TEXT NOT NULL DEFAULT 'TZS',
  -- Breakdown by tier
  current_balance       NUMERIC(20, 2) NOT NULL DEFAULT 0,
  current_provision     NUMERIC(20, 2) NOT NULL DEFAULT 0,
  current_count         INTEGER NOT NULL DEFAULT 0,
  em_balance            NUMERIC(20, 2) NOT NULL DEFAULT 0,
  em_provision          NUMERIC(20, 2) NOT NULL DEFAULT 0,
  em_count              INTEGER NOT NULL DEFAULT 0,
  substandard_balance   NUMERIC(20, 2) NOT NULL DEFAULT 0,
  substandard_provision NUMERIC(20, 2) NOT NULL DEFAULT 0,
  substandard_count     INTEGER NOT NULL DEFAULT 0,
  doubtful_balance      NUMERIC(20, 2) NOT NULL DEFAULT 0,
  doubtful_provision    NUMERIC(20, 2) NOT NULL DEFAULT 0,
  doubtful_count        INTEGER NOT NULL DEFAULT 0,
  loss_balance          NUMERIC(20, 2) NOT NULL DEFAULT 0,
  loss_provision        NUMERIC(20, 2) NOT NULL DEFAULT 0,
  loss_count            INTEGER NOT NULL DEFAULT 0,
  generated_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  status                TEXT NOT NULL DEFAULT 'Draft', -- Draft | Finalized | Submitted
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provisioning_reports_quarter
  ON public.provisioning_reports(quarter);

CREATE INDEX IF NOT EXISTS idx_provisioning_reports_status
  ON public.provisioning_reports(status);

-- ─── 4. UPDATED_AT TRIGGERS ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at_loan_classification()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loan_classifications_updated_at ON public.loan_classifications;
CREATE TRIGGER trg_loan_classifications_updated_at
  BEFORE UPDATE ON public.loan_classifications
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_loan_classification();

CREATE OR REPLACE FUNCTION public.set_updated_at_provisioning_report()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_provisioning_reports_updated_at ON public.provisioning_reports;
CREATE TRIGGER trg_provisioning_reports_updated_at
  BEFORE UPDATE ON public.provisioning_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at_provisioning_report();

-- ─── 5. RLS ───────────────────────────────────────────────────────────────────

ALTER TABLE public.loan_classifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.provisioning_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_all_loan_classifications" ON public.loan_classifications;
CREATE POLICY "authenticated_all_loan_classifications"
  ON public.loan_classifications FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_all_provisioning_reports" ON public.provisioning_reports;
CREATE POLICY "authenticated_all_provisioning_reports"
  ON public.provisioning_reports FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- ─── 6. SEED SAMPLE CLASSIFICATIONS ──────────────────────────────────────────

DO $$
DECLARE
  v_loan_id   UUID;
  v_obligor_id UUID;
  v_user_id   UUID;
  v_loan      RECORD;
  v_dpd       INTEGER;
  v_class     public.bot_classification;
  v_rate      NUMERIC(5,4);
  v_balance   NUMERIC(20,2);
  v_quarter   TEXT;
BEGIN
  v_quarter := TO_CHAR(CURRENT_DATE, 'YYYY') || '-Q' ||
               CEIL(EXTRACT(MONTH FROM CURRENT_DATE) / 3.0)::TEXT;

  SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;

  IF NOT EXISTS (SELECT 1 FROM public.loan_classifications LIMIT 1) THEN
    FOR v_loan IN
      SELECT l.id, l.obligor_id,
             COALESCE(l.outstanding_balance, l.facility_amount, 0) AS bal,
             l.currency
      FROM public.loans l
      LIMIT 8
    LOOP
      -- Simulate varying DPD
      v_dpd := (RANDOM() * 180)::INTEGER;
      v_balance := v_loan.bal;

      IF v_dpd = 0 THEN
        v_class := 'Current'; v_rate := 0.01;
      ELSIF v_dpd <= 30 THEN
        v_class := 'Especially Mentioned'; v_rate := 0.03;
      ELSIF v_dpd <= 90 THEN
        v_class := 'Substandard'; v_rate := 0.20;
      ELSIF v_dpd <= 180 THEN
        v_class := 'Doubtful'; v_rate := 0.50;
      ELSE
        v_class := 'Loss'; v_rate := 1.00;
      END IF;

      INSERT INTO public.loan_classifications (
        loan_id, obligor_id, classification, days_past_due,
        outstanding_balance, currency, provision_rate, provision_amount,
        primary_trigger, qualitative_flags, classified_by,
        classification_date, review_date, quarter, is_active
      ) VALUES (
        v_loan.id, v_loan.obligor_id, v_class, v_dpd,
        v_balance, v_loan.currency, v_rate, v_balance * v_rate,
        'days_past_due', '[]', v_user_id,
        CURRENT_DATE, CURRENT_DATE + INTERVAL '90 days', v_quarter, true
      ) ON CONFLICT DO NOTHING;
    END LOOP;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed skipped: %', SQLERRM;
END $$;
