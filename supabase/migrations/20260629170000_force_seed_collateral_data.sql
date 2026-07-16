-- ============================================================
-- CollateralMS — Force Seed Collateral Records (ISO dates)
-- Fixes: BRELA trigger fails on 'DD Mon YYYY' text format
-- Patches trigger + unconditionally seeds if table is empty.
-- ============================================================

-- ── 1. Patch the BRELA validation trigger to handle text date formats ────────
CREATE OR REPLACE FUNCTION public.validate_brela_perfection_deadline()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  reg_date  DATE;
  perf_date DATE;
  days_diff INTEGER;
BEGIN
  -- ── Parse registration_date ─────────────────────────────────────────────
  IF NEW.registration_date IS NOT NULL AND NEW.registration_date <> '' THEN
    BEGIN
      reg_date := NEW.registration_date::DATE;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        reg_date := TO_DATE(NEW.registration_date, 'DD Mon YYYY');
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          reg_date := TO_DATE(NEW.registration_date, 'DD Month YYYY');
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'BRELA_VALIDATION: Invalid submission date format: %', NEW.registration_date
            USING ERRCODE = 'P0001';
        END;
      END;
    END;
  END IF;

  -- ── Parse perfection_deadline ───────────────────────────────────────────
  IF NEW.perfection_deadline IS NOT NULL AND NEW.perfection_deadline <> '' THEN
    BEGIN
      perf_date := NEW.perfection_deadline::DATE;
    EXCEPTION WHEN OTHERS THEN
      BEGIN
        perf_date := TO_DATE(NEW.perfection_deadline, 'DD Mon YYYY');
      EXCEPTION WHEN OTHERS THEN
        BEGIN
          perf_date := TO_DATE(NEW.perfection_deadline, 'DD Month YYYY');
        EXCEPTION WHEN OTHERS THEN
          RAISE EXCEPTION 'BRELA_VALIDATION: Invalid perfection date format: %', NEW.perfection_deadline
            USING ERRCODE = 'P0001';
        END;
      END;
    END;
  END IF;

  -- ── Rule A: submission must precede perfection ──────────────────────────
  IF reg_date IS NOT NULL AND perf_date IS NOT NULL THEN
    IF perf_date < reg_date THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Perfection date (%) must be on or after BRELA submission date (%).',
        NEW.perfection_deadline, NEW.registration_date
        USING ERRCODE = 'P0001';
    END IF;
    NEW.days_to_deadline := (perf_date - CURRENT_DATE);
  END IF;

  -- ── Rule B: additional checks when perfection is required ───────────────
  IF NEW.requires_perfection = true THEN
    IF NEW.registration_date IS NULL OR NEW.registration_date = '' THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Submission date is required when perfection is required.'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.perfection_deadline IS NULL OR NEW.perfection_deadline = '' THEN
      RAISE EXCEPTION 'BRELA_VALIDATION: Perfection deadline is required when perfection is required.'
        USING ERRCODE = 'P0001';
    END IF;
    IF NEW.registry = 'BRELA' AND reg_date IS NOT NULL AND perf_date IS NOT NULL THEN
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

DROP TRIGGER IF EXISTS trg_brela_validation ON public.collateral_records;
CREATE TRIGGER trg_brela_validation
  BEFORE INSERT OR UPDATE ON public.collateral_records
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_brela_perfection_deadline();

-- ── 2. Force-seed collateral records if table is empty ──────────────────────
DO $$
DECLARE
  v_count     INTEGER;
  credit_uuid UUID;
  legal_uuid  UUID;
  col1_id     UUID;
  col2_id     UUID;
  col3_id     UUID;
  col4_id     UUID;
  col5_id     UUID;
  col6_id     UUID;
  col7_id     UUID;
  col8_id     UUID;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.collateral_records;

  IF v_count > 0 THEN
    RAISE NOTICE 'collateral_records already has % rows — updating valuation fields only.', v_count;
    UPDATE public.collateral_records
    SET
      valuation_amount = CASE collateral_id
        WHEN 'col-0312' THEN 780000000
        WHEN 'col-0311' THEN 420000000
        WHEN 'col-0310' THEN 1250000000
        WHEN 'col-0309' THEN 8400000000
        WHEN 'col-0308' THEN 185000000
        WHEN 'col-0307' THEN 2940000000
        WHEN 'col-0306' THEN 3200000000
        WHEN 'col-0305' THEN 2100000000
        WHEN 'col-0103' THEN 6700000000
        WHEN 'col-0091' THEN 320000000
        WHEN 'col-0078' THEN 1800000000
        WHEN 'col-0041' THEN 4200000000
        ELSE valuation_amount
      END,
      ltv_ratio = COALESCE(ltv_ratio, 0.70),
      max_securable_amount = CASE collateral_id
        WHEN 'col-0312' THEN 546000000
        WHEN 'col-0311' THEN 378000000
        WHEN 'col-0310' THEN 875000000
        WHEN 'col-0309' THEN 5880000000
        WHEN 'col-0308' THEN 148000000
        WHEN 'col-0307' THEN 1764000000
        WHEN 'col-0306' THEN 2560000000
        WHEN 'col-0305' THEN 1260000000
        WHEN 'col-0103' THEN 4355000000
        WHEN 'col-0091' THEN 256000000
        WHEN 'col-0078' THEN 1260000000
        WHEN 'col-0041' THEN 2940000000
        ELSE max_securable_amount
      END
    WHERE collateral_id IN (
      'col-0312','col-0311','col-0310','col-0309','col-0308','col-0307',
      'col-0306','col-0305','col-0103','col-0091','col-0078','col-0041'
    )
    AND valuation_amount IS NULL;
    RETURN;
  END IF;

  -- Fetch user profiles
  SELECT id INTO credit_uuid FROM public.user_profiles WHERE role = 'credit_officer' LIMIT 1;
  SELECT id INTO legal_uuid  FROM public.user_profiles WHERE role = 'legal_officer'  LIMIT 1;
  IF credit_uuid IS NULL THEN SELECT id INTO credit_uuid FROM public.user_profiles LIMIT 1; END IF;
  IF legal_uuid  IS NULL THEN SELECT id INTO legal_uuid  FROM public.user_profiles LIMIT 1; END IF;

  -- Insert using ISO dates (YYYY-MM-DD) — trigger handles these cleanly
  INSERT INTO public.collateral_records (
    collateral_id, obligor, obligor_id, collateral_type, description,
    value_tsh, valuation_amount, ltv_ratio, max_securable_amount,
    total_secured_amount, available_equity,
    facility_id, status, registry, registration_date,
    perfection_deadline, assigned_officer, requires_perfection, created_by
  ) VALUES
    ('col-0312', 'Coastal Traders Co.', 'OBL-2024-0441', 'Mortgage'::public.collateral_type,
     'Plot 245, Block D, Kinondoni, Dar es Salaam — Title Deed Vol. 18 Folio 99',
     '780,000,000', 780000000, 0.70, 546000000, 0, 546000000,
     'TZ-FAC-2025-0441', 'Under Review'::public.collateral_status,
     'Lands Registry'::public.registry_type, '2026-04-14', '2026-05-26', 'Lisa Alkado', true, credit_uuid),

    ('col-0311', 'Arusha Coffee Growers', 'OBL-2023-0812', 'FDR'::public.collateral_type,
     'Fixed Deposit Receipt — EXIM Bank, Account No. 0180-003-44821, 12-month tenor',
     '420,000,000', 420000000, 0.90, 378000000, 0, 378000000,
     'TZ-FAC-2025-0388', 'Perfected'::public.collateral_status,
     'N/A'::public.registry_type, '2026-04-10', '', 'Godfrey Woiso', false, credit_uuid),

    ('col-0310', 'Dodoma Real Estate Ltd', 'OBL-2022-0334', 'Mortgage'::public.collateral_type,
     'Plot 88, Chamwino District, Dodoma — Title Deed Vol. 7 Folio 22',
     '1,250,000,000', 1250000000, 0.70, 875000000, 0, 875000000,
     'TZ-FAC-2024-1021', 'Perfected'::public.collateral_status,
     'Lands Registry'::public.registry_type, '2026-03-02', '2026-04-13', 'Cornel Mangulu', true, legal_uuid),

    ('col-0309', 'Mbeya Mining Corp.', 'OBL-2023-1107', 'Debenture'::public.collateral_type,
     'Fixed & Floating Charge over all assets — registered at BRELA',
     '8,400,000,000', 8400000000, 0.70, 5880000000, 0, 5880000000,
     'TZ-FAC-2024-0771', 'Perfected'::public.collateral_status,
     'BRELA'::public.registry_type, '2026-02-15', '2026-03-29', 'Cornel Mangulu', true, legal_uuid),

    ('col-0308', 'Kilimanjaro Logistics', 'OBL-2024-0229', 'Motor Vehicle'::public.collateral_type,
     '2023 Volvo FH16 Truck — Reg. T 112 DXB · Chassis No. YV2RT40A4PA123456',
     '185,000,000', 185000000, 0.80, 148000000, 0, 148000000,
     'TZ-FAC-2024-0889', 'Monitoring'::public.collateral_status,
     'TRA'::public.registry_type, '2026-01-28', '2026-03-11', 'Yahaya Frezier', true, credit_uuid),

    ('col-0307', 'DSE Listed Holdings Ltd', 'OBL-2023-0594', 'Shares (DSE)'::public.collateral_type,
     '4,200,000 ordinary shares in CRDB Bank PLC — DSE Listed, pledged in favor of EXIM',
     '2,940,000,000', 2940000000, 0.60, 1764000000, 0, 1764000000,
     'TZ-FAC-2024-0612', 'Submitted'::public.collateral_status,
     'DSE'::public.registry_type, '2026-04-18', '2026-05-30', 'Lisa Alkado', true, credit_uuid),

    ('col-0306', 'Zanzibar Tourism Group', 'OBL-2022-0878', 'Guarantee'::public.collateral_type,
     'Corporate Guarantee from ZTG Holdings Ltd — unlimited in amount',
     '3,200,000,000', 3200000000, 0.80, 2560000000, 0, 2560000000,
     'TZ-FAC-2024-0503', 'Perfected'::public.collateral_status,
     'N/A'::public.registry_type, '2025-12-05', '', 'Godfrey Woiso', false, credit_uuid),

    ('col-0305', 'Tanga Steel Mills', 'OBL-2023-0712', 'Shares (DSE)'::public.collateral_type,
     '1,800,000 shares in Tanzania Breweries Ltd — DSE pledge lodged',
     '2,100,000,000', 2100000000, 0.60, 1260000000, 0, 1260000000,
     'TZ-FAC-2025-0388', 'Submitted'::public.collateral_status,
     'DSE'::public.registry_type, '2026-04-20', '2026-06-01', 'Lisa Alkado', true, credit_uuid),

    ('col-0103', 'Zanzibar Spice Exports', 'OBL-2024-0099', 'Ship/Vessel'::public.collateral_type,
     'MV Spice Trader — IMO 9812344, 1,200 DWT, registered at TASAC Zanzibar',
     '6,700,000,000', 6700000000, 0.65, 4355000000, 0, 4355000000,
     'TZ-FAC-2025-0211', 'Overdue'::public.collateral_status,
     'TASAC'::public.registry_type, '2026-03-22', '2026-04-22', 'Godfrey Woiso', true, credit_uuid),

    ('col-0091', 'Dar Transport Holdings', 'OBL-2024-0155', 'Motor Vehicle'::public.collateral_type,
     '2022 Mercedes-Benz Actros 2645 · Reg. T 880 CFX · Chassis No. WDB9634031L521987',
     '320,000,000', 320000000, 0.80, 256000000, 0, 256000000,
     'TZ-FAC-2025-0034', 'Overdue'::public.collateral_status,
     'TRA'::public.registry_type, '2026-03-20', '2026-04-20', 'Lisa Alkado', true, credit_uuid),

    ('col-0078', 'Mwanza Fishing Co.', 'OBL-2023-0488', 'Mortgage'::public.collateral_type,
     'Plot 14, Ilemela District, Mwanza — Title Deed Vol. 3 Folio 7',
     '1,800,000,000', 1800000000, 0.70, 1260000000, 0, 1260000000,
     'TZ-FAC-2024-1104', 'Overdue'::public.collateral_status,
     'Lands Registry'::public.registry_type, '2026-03-18', '2026-04-18', 'Yahaya Frezier', true, credit_uuid),

    ('col-0041', 'Karibu Enterprises Ltd', 'OBL-2022-0211', 'Debenture'::public.collateral_type,
     'Fixed Charge over land & buildings + floating charge over all other assets',
     '4,200,000,000', 4200000000, 0.70, 2940000000, 0, 2940000000,
     'TZ-FAC-2024-0892', 'Overdue'::public.collateral_status,
     'BRELA'::public.registry_type, '2026-03-01', '2026-04-12', 'Lisa Alkado', true, credit_uuid)
  ON CONFLICT (collateral_id) DO NOTHING;

  -- ── 3. Seed audit log entries ────────────────────────────────────────────
  INSERT INTO public.audit_logs (
    id, collateral_record_id, collateral_id, action, message, detail,
    performed_by, performed_by_name, created_at
  )
  SELECT
    gen_random_uuid(),
    cr.id,
    cr.collateral_id,
    CASE cr.collateral_id
      WHEN 'col-0309' THEN 'perfected'
      WHEN 'col-0312' THEN 'created'
      WHEN 'col-0041' THEN 'overdue'
      WHEN 'col-0310' THEN 'submitted'
      WHEN 'col-0091' THEN 'perfected'
      WHEN 'col-0311' THEN 'created'
      WHEN 'col-0305' THEN 'submitted'
      WHEN 'col-0306' THEN 'created'
      ELSE 'created'
    END,
    CASE cr.collateral_id
      WHEN 'col-0309' THEN 'Collateral col-0309 perfected at BRELA'
      WHEN 'col-0312' THEN 'New collateral registered: col-0312'
      WHEN 'col-0041' THEN 'BRELA deadline missed — col-0041'
      WHEN 'col-0310' THEN 'Lands Registry submission filed'
      WHEN 'col-0091' THEN 'TRA registration confirmed: col-0091'
      WHEN 'col-0311' THEN 'New collateral registered: col-0311'
      WHEN 'col-0305' THEN 'DSE share pledge registered'
      WHEN 'col-0306' THEN 'Guarantee collateral registered: col-0306'
      ELSE 'Collateral record created: ' || cr.collateral_id
    END,
    cr.obligor || ' · ' || cr.collateral_type::text,
    credit_uuid,
    COALESCE(cr.assigned_officer, 'System'),
    NOW() - (RANDOM() * INTERVAL '90 days')
  FROM public.collateral_records cr
  WHERE cr.collateral_id IN ('col-0309','col-0312','col-0041','col-0310','col-0091','col-0311','col-0305','col-0306');

  -- ── 4. Seed collateral_loan_links ────────────────────────────────────────
  SELECT id INTO col1_id FROM public.collateral_records WHERE collateral_id = 'col-0309';
  SELECT id INTO col2_id FROM public.collateral_records WHERE collateral_id = 'col-0310';
  SELECT id INTO col3_id FROM public.collateral_records WHERE collateral_id = 'col-0307';
  SELECT id INTO col4_id FROM public.collateral_records WHERE collateral_id = 'col-0306';
  SELECT id INTO col5_id FROM public.collateral_records WHERE collateral_id = 'col-0078';
  SELECT id INTO col6_id FROM public.collateral_records WHERE collateral_id = 'col-0041';
  SELECT id INTO col7_id FROM public.collateral_records WHERE collateral_id = 'col-0311';
  SELECT id INTO col8_id FROM public.collateral_records WHERE collateral_id = 'col-0103';

  IF col1_id IS NOT NULL THEN
    INSERT INTO public.collateral_loan_links (
      collateral_id, loan_account_id, beneficiary_id, beneficiary_name,
      charge_rank, allocated_amount, start_date, status, created_by
    ) VALUES
      (col1_id, 'LN-2024-0771', 'BEN-0023', 'Mbeya Mining Corp.',       1, 2500000000, '2024-03-01', 'ACTIVE',   credit_uuid),
      (col1_id, 'LN-2024-0892', 'BEN-0041', 'Karibu Enterprises Ltd',   2, 1200000000, '2024-06-15', 'ACTIVE',   credit_uuid),
      (col2_id, 'LN-2025-0441', 'BEN-0012', 'Coastal Traders Co.',      1,  600000000, '2025-01-10', 'ACTIVE',   credit_uuid),
      (col3_id, 'LN-2024-0612', 'BEN-0034', 'DSE Listed Holdings Ltd',  1,  900000000, '2024-09-01', 'ACTIVE',   credit_uuid),
      (col4_id, 'LN-2024-0503', 'BEN-0056', 'Zanzibar Tourism Group',   1, 1500000000, '2024-07-20', 'ACTIVE',   credit_uuid),
      (col4_id, 'LN-2025-0211', 'BEN-0067', 'Zanzibar Spice Exports',   2,  700000000, '2025-02-01', 'ACTIVE',   credit_uuid),
      (col5_id, 'LN-2024-1104', 'BEN-0078', 'Mwanza Fishing Co.',       1,  800000000, '2024-11-15', 'ACTIVE',   credit_uuid),
      (col6_id, 'LN-2023-0892', 'BEN-0041', 'Karibu Enterprises Ltd',   1, 1800000000, '2023-08-01', 'RELEASED', credit_uuid),
      (col7_id, 'LN-2025-0388', 'BEN-0089', 'Arusha Coffee Growers',    1,  280000000, '2025-03-01', 'ACTIVE',   credit_uuid),
      (col8_id, 'LN-2025-0211', 'BEN-0067', 'Zanzibar Spice Exports',   1, 3000000000, '2025-01-15', 'ACTIVE',   credit_uuid)
    ON CONFLICT DO NOTHING;
  END IF;

  -- ── 5. Recalculate total_secured_amount and available_equity ────────────
  UPDATE public.collateral_records cr
  SET
    total_secured_amount = COALESCE((
      SELECT SUM(cll.allocated_amount)
      FROM public.collateral_loan_links cll
      WHERE cll.collateral_id = cr.id AND cll.status = 'ACTIVE'
    ), 0),
    available_equity = GREATEST(0,
      COALESCE(cr.max_securable_amount, cr.valuation_amount * COALESCE(cr.ltv_ratio, 0.70)) -
      COALESCE((
        SELECT SUM(cll.allocated_amount)
        FROM public.collateral_loan_links cll
        WHERE cll.collateral_id = cr.id AND cll.status = 'ACTIVE'
      ), 0)
    )
  WHERE cr.valuation_amount IS NOT NULL;

  RAISE NOTICE 'Collateral records force-seeded successfully.';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Force seed failed: % — %', SQLSTATE, SQLERRM;
END $$;
