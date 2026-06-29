-- ============================================================
-- Business Logic Constraints
-- Enforces at the database level:
--   1. Collateral valuation amount cannot be zero (must be > 0 when provided)
--   2. LTV ratio must stay within 0–100% (stored as 0.00–1.00)
--   3. BRELA submission date (registration_date) must precede perfection date
--      (perfection_deadline) — enforced via trigger on collateral_records
-- ============================================================

-- -------------------------------------------------------
-- 1. collateral_records: valuation_amount > 0
-- -------------------------------------------------------
ALTER TABLE public.collateral_records
  DROP CONSTRAINT IF EXISTS chk_collateral_valuation_nonzero;

ALTER TABLE public.collateral_records
  ADD CONSTRAINT chk_collateral_valuation_nonzero
  CHECK (valuation_amount IS NULL OR valuation_amount > 0);

-- -------------------------------------------------------
-- 2. collateral_records: ltv_ratio between 0 and 1 (0%–100%)
-- -------------------------------------------------------
ALTER TABLE public.collateral_records
  DROP CONSTRAINT IF EXISTS chk_collateral_ltv_range;

ALTER TABLE public.collateral_records
  ADD CONSTRAINT chk_collateral_ltv_range
  CHECK (ltv_ratio IS NULL OR (ltv_ratio >= 0 AND ltv_ratio <= 1));

-- -------------------------------------------------------
-- 3. collateral_valuation_history: valuation_amount > 0
-- -------------------------------------------------------
ALTER TABLE public.collateral_valuation_history
  DROP CONSTRAINT IF EXISTS chk_valuation_history_nonzero;

ALTER TABLE public.collateral_valuation_history
  ADD CONSTRAINT chk_valuation_history_nonzero
  CHECK (valuation_amount > 0);

-- -------------------------------------------------------
-- 4. collateral_valuation_history: ltv_ratio between 0 and 1
-- -------------------------------------------------------
ALTER TABLE public.collateral_valuation_history
  DROP CONSTRAINT IF EXISTS chk_valuation_history_ltv_range;

ALTER TABLE public.collateral_valuation_history
  ADD CONSTRAINT chk_valuation_history_ltv_range
  CHECK (ltv_ratio IS NULL OR (ltv_ratio >= 0 AND ltv_ratio <= 1));

-- -------------------------------------------------------
-- 5. collateral_records: BRELA submission date must precede perfection date
--    The existing trigger (trg_brela_validation) already enforces this for
--    requires_perfection = true rows. We extend the trigger function to also
--    enforce the date ordering unconditionally whenever both dates are present,
--    regardless of the requires_perfection flag.
-- -------------------------------------------------------
CREATE OR REPLACE FUNCTION public.validate_brela_perfection_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  reg_date DATE;
  perf_date DATE;
  days_diff INTEGER;
BEGIN
  -- -------------------------------------------------------
  -- Rule A: When both dates are present, submission date
  --         must always precede (or equal) perfection date.
  -- -------------------------------------------------------
  IF (NEW.registration_date IS NOT NULL AND NEW.registration_date <> '')
     AND (NEW.perfection_deadline IS NOT NULL AND NEW.perfection_deadline <> '')
  THEN
    BEGIN
      reg_date := NEW.registration_date::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Invalid submission date format: %', NEW.registration_date
        USING ERRCODE = 'P0001';
    END;

    BEGIN
      perf_date := NEW.perfection_deadline::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Invalid perfection date format: %', NEW.perfection_deadline
        USING ERRCODE = 'P0001';
    END;

    IF perf_date < reg_date THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Perfection date (%) must be on or after BRELA submission date (%).',
        NEW.perfection_deadline, NEW.registration_date
        USING ERRCODE = 'P0001';
    END IF;

    -- Auto-compute days_to_deadline from today
    NEW.days_to_deadline := (perf_date - CURRENT_DATE);
  END IF;

  -- -------------------------------------------------------
  -- Rule B: Additional checks when perfection is required.
  -- -------------------------------------------------------
  IF NEW.requires_perfection = true THEN
    -- Both dates are mandatory
    IF NEW.registration_date IS NULL OR NEW.registration_date = '' THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Submission date is required when perfection is required.'
        USING ERRCODE = 'P0001';
    END IF;

    IF NEW.perfection_deadline IS NULL OR NEW.perfection_deadline = '' THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Perfection deadline is required when perfection is required.'
        USING ERRCODE = 'P0001';
    END IF;

    -- Parse dates (already validated above if both present, but re-parse for safety)
    BEGIN
      reg_date := NEW.registration_date::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Invalid submission date format: %', NEW.registration_date
        USING ERRCODE = 'P0001';
    END;

    BEGIN
      perf_date := NEW.perfection_deadline::DATE;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Invalid perfection date format: %', NEW.perfection_deadline
        USING ERRCODE = 'P0001';
    END;

    -- For BRELA registry: enforce 42-day maximum window
    IF NEW.registry = 'BRELA' THEN
      days_diff := (perf_date - reg_date);
      IF days_diff > 42 THEN
        RAISE EXCEPTION 'BRELA_VALIDATION: BRELA debentures must be perfected within 42 days of submission. Deadline is % days after submission (max 42 days allowed).',
          days_diff
          USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS trg_brela_validation ON public.collateral_records;
CREATE TRIGGER trg_brela_validation
  BEFORE INSERT OR UPDATE ON public.collateral_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_brela_perfection_deadline();
