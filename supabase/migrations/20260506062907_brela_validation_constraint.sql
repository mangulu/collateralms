-- ============================================================
-- BRELA Validation — DB-level enforcement for collateral_records
-- Enforces:
--   1. BRELA debentures must have perfection_deadline within 42 days of registration_date
--   2. When requires_perfection = true and registry = 'BRELA', both dates must be present
--   3. perfection_deadline must not be before registration_date
-- ============================================================

-- Function: validate BRELA 42-day rule on INSERT and UPDATE
CREATE OR REPLACE FUNCTION public.validate_brela_perfection_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  reg_date DATE;
  perf_date DATE;
  days_diff INTEGER;
BEGIN
  -- Only enforce when perfection is required
  IF NEW.requires_perfection = false THEN
    RETURN NEW;
  END IF;

  -- Require both dates when perfection is required
  IF NEW.registration_date IS NULL OR NEW.registration_date = '' THEN
    RAISE EXCEPTION 'BRELA_VALIDATION: Execution date is required when perfection is required.'
      USING ERRCODE = 'P0001';
  END IF;

  IF NEW.perfection_deadline IS NULL OR NEW.perfection_deadline = '' THEN
    RAISE EXCEPTION 'BRELA_VALIDATION: Perfection deadline is required when perfection is required.'
      USING ERRCODE = 'P0001';
  END IF;

  -- Parse dates safely
  BEGIN
    reg_date := NEW.registration_date::DATE;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BRELA_VALIDATION: Invalid execution date format: %', NEW.registration_date
      USING ERRCODE = 'P0001';
  END;

  BEGIN
    perf_date := NEW.perfection_deadline::DATE;
  EXCEPTION WHEN OTHERS THEN
    RAISE EXCEPTION 'BRELA_VALIDATION: Invalid perfection deadline format: %', NEW.perfection_deadline
      USING ERRCODE = 'P0001';
  END;

  -- Deadline must not be before execution date
  IF perf_date < reg_date THEN
    RAISE EXCEPTION 'BRELA_VALIDATION: Perfection deadline (%) cannot be before execution date (%).',
      NEW.perfection_deadline, NEW.registration_date
      USING ERRCODE = 'P0001';
  END IF;

  -- For BRELA registry: enforce 42-day maximum window
  IF NEW.registry = 'BRELA' THEN
    days_diff := (perf_date - reg_date);
    IF days_diff > 42 THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: BRELA debentures must be perfected within 42 days of execution. Deadline is % days after execution (max 42 days allowed).',
        days_diff
        USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Auto-compute days_to_deadline from today
  NEW.days_to_deadline := (perf_date - CURRENT_DATE);

  RETURN NEW;
END;
$$;

-- Attach trigger to collateral_records
DROP TRIGGER IF EXISTS trg_brela_validation ON public.collateral_records;
CREATE TRIGGER trg_brela_validation
  BEFORE INSERT OR UPDATE ON public.collateral_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_brela_perfection_deadline();
