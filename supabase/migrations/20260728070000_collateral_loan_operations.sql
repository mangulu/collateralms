-- ============================================================
-- Collateral & Loan Operations: Valuation, Substitution,
-- Covenants, Insurance
-- ============================================================

-- ── 1. ENUM TYPES ──────────────────────────────────────────

DROP TYPE IF EXISTS public.valuation_status CASCADE;
CREATE TYPE public.valuation_status AS ENUM (
  'Scheduled', 'In Progress', 'Completed', 'Approved', 'Rejected', 'Overdue'
);

DROP TYPE IF EXISTS public.substitution_status CASCADE;
CREATE TYPE public.substitution_status AS ENUM (
  'Pending', 'Under Review', 'Approved', 'Rejected', 'Completed'
);

DROP TYPE IF EXISTS public.covenant_type CASCADE;
CREATE TYPE public.covenant_type AS ENUM (
  'Financial Ratio', 'Insurance Requirement', 'Reporting Obligation',
  'Operational', 'Legal', 'Other'
);

DROP TYPE IF EXISTS public.covenant_status CASCADE;
CREATE TYPE public.covenant_status AS ENUM (
  'Active', 'Breached', 'Waived', 'Expired'
);

DROP TYPE IF EXISTS public.insurance_status CASCADE;
CREATE TYPE public.insurance_status AS ENUM (
  'Active', 'Expiring Soon', 'Expired', 'Cancelled', 'Pending Renewal'
);

-- ── 2. TABLES ──────────────────────────────────────────────

-- Valuation Schedules & Records
CREATE TABLE IF NOT EXISTS public.collateral_valuations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id       UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  valuation_type      TEXT NOT NULL DEFAULT 'Full Valuation',
  scheduled_date      DATE NOT NULL,
  completed_date      DATE,
  valuation_amount    NUMERIC(18,2),
  previous_amount     NUMERIC(18,2),
  valuer_name         TEXT,
  valuer_firm         TEXT,
  valuation_method    TEXT DEFAULT 'Market Value',
  report_reference    TEXT,
  notes               TEXT,
  valuation_status    public.valuation_status NOT NULL DEFAULT 'Scheduled',
  approved_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  rejection_reason    TEXT,
  aging_alert_sent    BOOLEAN DEFAULT FALSE,
  created_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Collateral Substitution Requests
CREATE TABLE IF NOT EXISTS public.collateral_substitutions (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  facility_id           TEXT NOT NULL,
  loan_id               UUID REFERENCES public.loans(id) ON DELETE SET NULL,
  outgoing_collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE SET NULL,
  incoming_collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE SET NULL,
  reason                TEXT NOT NULL,
  substitution_status   public.substitution_status NOT NULL DEFAULT 'Pending',
  requested_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  requested_at          TIMESTAMPTZ DEFAULT NOW(),
  reviewed_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at           TIMESTAMPTZ,
  approved_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at           TIMESTAMPTZ,
  rejection_reason      TEXT,
  effective_date        DATE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW()
);

-- Substitution Audit Trail
CREATE TABLE IF NOT EXISTS public.substitution_audit_trail (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  substitution_id   UUID REFERENCES public.collateral_substitutions(id) ON DELETE CASCADE,
  action            TEXT NOT NULL,
  performed_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  old_status        TEXT,
  new_status        TEXT,
  notes             TEXT,
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Loan Covenants
CREATE TABLE IF NOT EXISTS public.loan_covenants (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id           UUID REFERENCES public.loans(id) ON DELETE CASCADE,
  facility_id       TEXT,
  covenant_name     TEXT NOT NULL,
  covenant_type     public.covenant_type NOT NULL DEFAULT 'Financial Ratio',
  description       TEXT,
  threshold_value   NUMERIC(18,4),
  threshold_unit    TEXT,
  current_value     NUMERIC(18,4),
  measurement_date  DATE,
  next_review_date  DATE,
  covenant_status   public.covenant_status NOT NULL DEFAULT 'Active',
  breach_date       DATE,
  breach_notes      TEXT,
  waiver_date       DATE,
  waiver_notes      TEXT,
  auto_flag         BOOLEAN DEFAULT TRUE,
  created_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

-- Covenant Breach History
CREATE TABLE IF NOT EXISTS public.covenant_breach_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  covenant_id     UUID REFERENCES public.loan_covenants(id) ON DELETE CASCADE,
  breach_date     DATE NOT NULL,
  threshold_value NUMERIC(18,4),
  actual_value    NUMERIC(18,4),
  breach_notes    TEXT,
  resolved_date   DATE,
  resolved_by     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Insurance Certificates
CREATE TABLE IF NOT EXISTS public.collateral_insurance (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id       UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  policy_number       TEXT NOT NULL,
  insurer_name        TEXT NOT NULL,
  coverage_type       TEXT NOT NULL DEFAULT 'Comprehensive',
  coverage_amount     NUMERIC(18,2) NOT NULL,
  currency            TEXT DEFAULT 'TZS',
  premium_amount      NUMERIC(18,2),
  premium_frequency   TEXT DEFAULT 'Annual',
  policy_start_date   DATE NOT NULL,
  policy_end_date     DATE NOT NULL,
  renewal_date        DATE,
  insurance_status    public.insurance_status NOT NULL DEFAULT 'Active',
  beneficiary         TEXT,
  contact_person      TEXT,
  contact_phone       TEXT,
  contact_email       TEXT,
  certificate_ref     TEXT,
  notes               TEXT,
  expiry_alert_sent   BOOLEAN DEFAULT FALSE,
  renewal_alert_sent  BOOLEAN DEFAULT FALSE,
  created_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);

-- ── 3. INDEXES ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_valuations_collateral_id ON public.collateral_valuations(collateral_id);
CREATE INDEX IF NOT EXISTS idx_valuations_status ON public.collateral_valuations(valuation_status);
CREATE INDEX IF NOT EXISTS idx_valuations_scheduled_date ON public.collateral_valuations(scheduled_date);

CREATE INDEX IF NOT EXISTS idx_substitutions_facility ON public.collateral_substitutions(facility_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_status ON public.collateral_substitutions(substitution_status);
CREATE INDEX IF NOT EXISTS idx_substitutions_outgoing ON public.collateral_substitutions(outgoing_collateral_id);
CREATE INDEX IF NOT EXISTS idx_substitutions_incoming ON public.collateral_substitutions(incoming_collateral_id);

CREATE INDEX IF NOT EXISTS idx_covenants_loan_id ON public.loan_covenants(loan_id);
CREATE INDEX IF NOT EXISTS idx_covenants_status ON public.loan_covenants(covenant_status);
CREATE INDEX IF NOT EXISTS idx_covenants_next_review ON public.loan_covenants(next_review_date);

CREATE INDEX IF NOT EXISTS idx_insurance_collateral_id ON public.collateral_insurance(collateral_id);
CREATE INDEX IF NOT EXISTS idx_insurance_status ON public.collateral_insurance(insurance_status);
CREATE INDEX IF NOT EXISTS idx_insurance_end_date ON public.collateral_insurance(policy_end_date);

-- ── 4. FUNCTIONS ───────────────────────────────────────────

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

-- Flag overdue valuations
CREATE OR REPLACE FUNCTION public.flag_overdue_valuations()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.collateral_valuations
  SET valuation_status = 'Overdue'::public.valuation_status
  WHERE valuation_status = 'Scheduled'::public.valuation_status
    AND scheduled_date < CURRENT_DATE;
END;
$$;

-- Auto-flag covenant breaches
CREATE OR REPLACE FUNCTION public.check_covenant_breach()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.auto_flag = TRUE
     AND NEW.current_value IS NOT NULL
     AND NEW.threshold_value IS NOT NULL
     AND NEW.current_value < NEW.threshold_value
     AND NEW.covenant_status = 'Active'::public.covenant_status THEN
    NEW.covenant_status := 'Breached'::public.covenant_status;
    NEW.breach_date := CURRENT_DATE;
  END IF;
  RETURN NEW;
END;
$$;

-- Auto-update insurance status based on dates
CREATE OR REPLACE FUNCTION public.update_insurance_status()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.policy_end_date < CURRENT_DATE THEN
    NEW.insurance_status := 'Expired'::public.insurance_status;
  ELSIF NEW.policy_end_date <= CURRENT_DATE + INTERVAL '30 days' THEN
    NEW.insurance_status := 'Expiring Soon'::public.insurance_status;
  END IF;
  RETURN NEW;
END;
$$;

-- ── 5. ENABLE RLS ──────────────────────────────────────────

ALTER TABLE public.collateral_valuations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collateral_substitutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.substitution_audit_trail ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_covenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.covenant_breach_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collateral_insurance ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS POLICIES ────────────────────────────────────────

DROP POLICY IF EXISTS "auth_all_collateral_valuations" ON public.collateral_valuations;
CREATE POLICY "auth_all_collateral_valuations" ON public.collateral_valuations
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_collateral_substitutions" ON public.collateral_substitutions;
CREATE POLICY "auth_all_collateral_substitutions" ON public.collateral_substitutions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_substitution_audit_trail" ON public.substitution_audit_trail;
CREATE POLICY "auth_all_substitution_audit_trail" ON public.substitution_audit_trail
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_loan_covenants" ON public.loan_covenants;
CREATE POLICY "auth_all_loan_covenants" ON public.loan_covenants
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_covenant_breach_log" ON public.covenant_breach_log;
CREATE POLICY "auth_all_covenant_breach_log" ON public.covenant_breach_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_all_collateral_insurance" ON public.collateral_insurance;
CREATE POLICY "auth_all_collateral_insurance" ON public.collateral_insurance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ── 7. TRIGGERS ────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_valuations_updated_at ON public.collateral_valuations;
CREATE TRIGGER trg_valuations_updated_at
  BEFORE UPDATE ON public.collateral_valuations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_substitutions_updated_at ON public.collateral_substitutions;
CREATE TRIGGER trg_substitutions_updated_at
  BEFORE UPDATE ON public.collateral_substitutions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_covenants_updated_at ON public.loan_covenants;
CREATE TRIGGER trg_covenants_updated_at
  BEFORE UPDATE ON public.loan_covenants
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_covenant_breach_check ON public.loan_covenants;
CREATE TRIGGER trg_covenant_breach_check
  BEFORE INSERT OR UPDATE ON public.loan_covenants
  FOR EACH ROW EXECUTE FUNCTION public.check_covenant_breach();

DROP TRIGGER IF EXISTS trg_insurance_updated_at ON public.collateral_insurance;
CREATE TRIGGER trg_insurance_updated_at
  BEFORE UPDATE ON public.collateral_insurance
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS trg_insurance_status_update ON public.collateral_insurance;
CREATE TRIGGER trg_insurance_status_update
  BEFORE INSERT OR UPDATE ON public.collateral_insurance
  FOR EACH ROW EXECUTE FUNCTION public.update_insurance_status();

-- ── 8. SEED DATA ───────────────────────────────────────────

DO $$
DECLARE
  v_user_id   UUID;
  v_coll_id   UUID;
  v_loan_id   UUID;
  v_val_id    UUID;
  v_sub_id    UUID;
  v_cov_id    UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;
  SELECT id INTO v_coll_id FROM public.collateral_records LIMIT 1;
  SELECT id INTO v_loan_id FROM public.loans LIMIT 1;

  IF v_coll_id IS NOT NULL THEN
    -- Valuation records
    INSERT INTO public.collateral_valuations
      (collateral_id, valuation_type, scheduled_date, completed_date, valuation_amount,
       previous_amount, valuer_name, valuer_firm, valuation_method, valuation_status, created_by)
    VALUES
      (v_coll_id, 'Full Valuation', CURRENT_DATE - 30, CURRENT_DATE - 28, 850000000,
       800000000, 'John Mwangi', 'Apex Valuers Ltd', 'Market Value', 'Approved', v_user_id),
      (v_coll_id, 'Desk Review', CURRENT_DATE + 60, NULL, NULL,
       850000000, NULL, NULL, 'Market Value', 'Scheduled', v_user_id),
      (v_coll_id, 'Full Valuation', CURRENT_DATE - 5, NULL, NULL,
       850000000, 'Pending Assignment', NULL, 'Market Value', 'Overdue', v_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- Insurance records
    INSERT INTO public.collateral_insurance
      (collateral_id, policy_number, insurer_name, coverage_type, coverage_amount,
       currency, premium_amount, premium_frequency, policy_start_date, policy_end_date,
       renewal_date, beneficiary, created_by)
    VALUES
      (v_coll_id, 'POL-2025-001234', 'Jubilee Insurance', 'Comprehensive Fire & Perils',
       900000000, 'TZS', 4500000, 'Annual',
       CURRENT_DATE - 180, CURRENT_DATE + 185, CURRENT_DATE + 155,
       'Collateral Bank Ltd', v_user_id),
      (v_coll_id, 'POL-2025-005678', 'AAR Insurance', 'Motor Vehicle Comprehensive',
       120000000, 'TZS', 2400000, 'Annual',
       CURRENT_DATE - 340, CURRENT_DATE + 25, CURRENT_DATE + 5,
       'Collateral Bank Ltd', v_user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF v_loan_id IS NOT NULL THEN
    -- Covenant records
    INSERT INTO public.loan_covenants
      (loan_id, covenant_name, covenant_type, description, threshold_value,
       threshold_unit, current_value, measurement_date, next_review_date,
       covenant_status, created_by)
    VALUES
      (v_loan_id, 'Debt Service Coverage Ratio', 'Financial Ratio',
       'Borrower must maintain DSCR of at least 1.25x at all times',
       1.25, 'ratio', 1.42, CURRENT_DATE - 30, CURRENT_DATE + 60,
       'Active', v_user_id),
      (v_loan_id, 'Current Ratio', 'Financial Ratio',
       'Current assets must be at least 1.5x current liabilities',
       1.50, 'ratio', 1.18, CURRENT_DATE - 30, CURRENT_DATE + 30,
       'Breached', v_user_id),
      (v_loan_id, 'Property Insurance', 'Insurance Requirement',
       'Borrower must maintain comprehensive property insurance at all times',
       NULL, NULL, NULL, NULL, CURRENT_DATE + 90,
       'Active', v_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- Substitution request
    IF v_coll_id IS NOT NULL THEN
      INSERT INTO public.collateral_substitutions
        (facility_id, loan_id, outgoing_collateral_id, reason, substitution_status,
         requested_by, notes)
      VALUES
        ('FAC-2025-001', v_loan_id, v_coll_id,
         'Borrower requests substitution of property collateral with FDR of equivalent value',
         'Pending', v_user_id,
         'Incoming collateral to be confirmed upon receipt of FDR certificate')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
