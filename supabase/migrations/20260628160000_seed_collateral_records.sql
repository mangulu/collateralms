-- ============================================================
-- CollateralMS — Seed Collateral Records & Fix audit_logs action column
-- Ensures collateral_records are populated and audit_logs.action exists
-- ============================================================

-- ─── 1. Ensure audit_logs.action column exists ───────────────────────────────
-- The action column may have been lost if audit_action enum was recreated with CASCADE.
-- We add it back as TEXT (more flexible than enum) if missing.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'action'
  ) THEN
    ALTER TABLE public.audit_logs
      ADD COLUMN action TEXT NOT NULL DEFAULT 'created';
  END IF;
END $$;

-- ─── 2. Seed collateral_records if empty ─────────────────────────────────────

DO $$
DECLARE
  v_count       INTEGER;
  credit_uuid   UUID;
  legal_uuid    UUID;
  officer_uuid  UUID;
  col1_uuid     UUID := gen_random_uuid();
  col2_uuid     UUID := gen_random_uuid();
  col3_uuid     UUID := gen_random_uuid();
  col4_uuid     UUID := gen_random_uuid();
  col5_uuid     UUID := gen_random_uuid();
  col6_uuid     UUID := gen_random_uuid();
  col7_uuid     UUID := gen_random_uuid();
  col8_uuid     UUID := gen_random_uuid();
  col9_uuid     UUID := gen_random_uuid();
  col10_uuid    UUID := gen_random_uuid();
  col11_uuid    UUID := gen_random_uuid();
  col12_uuid    UUID := gen_random_uuid();
BEGIN
  -- Check if collateral_records already has data
  SELECT COUNT(*) INTO v_count FROM public.collateral_records;

  IF v_count > 0 THEN
    RAISE NOTICE 'collateral_records already has % rows, skipping seed.', v_count;
    RETURN;
  END IF;

  -- Fetch existing user profiles by role
  SELECT id INTO credit_uuid FROM public.user_profiles WHERE role = 'credit_officer' LIMIT 1;
  SELECT id INTO legal_uuid  FROM public.user_profiles WHERE role = 'legal_officer'  LIMIT 1;
  SELECT id INTO officer_uuid FROM public.user_profiles WHERE role = 'credit_officer' ORDER BY created_at DESC LIMIT 1;

  -- Fallback: use any user if specific roles not found
  IF credit_uuid IS NULL THEN
    SELECT id INTO credit_uuid FROM public.user_profiles LIMIT 1;
  END IF;
  IF legal_uuid IS NULL THEN
    SELECT id INTO legal_uuid FROM public.user_profiles LIMIT 1;
  END IF;
  IF officer_uuid IS NULL THEN
    SELECT id INTO officer_uuid FROM public.user_profiles LIMIT 1;
  END IF;

  -- Insert collateral records
  INSERT INTO public.collateral_records (
    id, collateral_id, obligor, obligor_id, collateral_type, description,
    value_tsh, facility_id, status, registry, registration_date,
    perfection_deadline, assigned_officer, requires_perfection, days_to_deadline, created_by
  ) VALUES
    (col1_uuid, 'col-0312', 'Coastal Traders Co.', 'OBL-2024-0441', 'Mortgage'::public.collateral_type,
     'Plot 245, Block D, Kinondoni, Dar es Salaam — Title Deed Vol. 18 Folio 99',
     '780,000,000', 'TZ-FAC-2025-0441', 'Under Review'::public.collateral_status,
     'Lands Registry'::public.registry_type, '14 Apr 2026', '26 May 2026', 'Lisa Alkado', true, 31, credit_uuid),
    (col2_uuid, 'col-0311', 'Arusha Coffee Growers', 'OBL-2023-0812', 'FDR'::public.collateral_type,
     'Fixed Deposit Receipt — EXIM Bank, Account No. 0180-003-44821, 12-month tenor',
     '420,000,000', 'TZ-FAC-2025-0388', 'Perfected'::public.collateral_status,
     'N/A'::public.registry_type, '10 Apr 2026', '', 'Godfrey Woiso', false, null, credit_uuid),
    (col3_uuid, 'col-0310', 'Dodoma Real Estate Ltd', 'OBL-2022-0334', 'Mortgage'::public.collateral_type,
     'Plot 88, Chamwino District, Dodoma — Title Deed Vol. 7 Folio 22',
     '1,250,000,000', 'TZ-FAC-2024-1021', 'Perfected'::public.collateral_status,
     'Lands Registry'::public.registry_type, '02 Mar 2026', '13 Apr 2026', 'Cornel Mangulu', true, null, legal_uuid),
    (col4_uuid, 'col-0309', 'Mbeya Mining Corp.', 'OBL-2023-1107', 'Debenture'::public.collateral_type,
     'Fixed & Floating Charge over all assets — registered at BRELA',
     '8,400,000,000', 'TZ-FAC-2024-0771', 'Perfected'::public.collateral_status,
     'BRELA'::public.registry_type, '15 Feb 2026', '29 Mar 2026', 'Cornel Mangulu', true, null, legal_uuid),
    (col5_uuid, 'col-0308', 'Kilimanjaro Logistics', 'OBL-2024-0229', 'Motor Vehicle'::public.collateral_type,
     '2023 Volvo FH16 Truck — Reg. T 112 DXB · Chassis No. YV2RT40A4PA123456',
     '185,000,000', 'TZ-FAC-2024-0889', 'Monitoring'::public.collateral_status,
     'TRA'::public.registry_type, '28 Jan 2026', '11 Mar 2026', 'Yahaya Frezier', true, null, officer_uuid),
    (col6_uuid, 'col-0307', 'DSE Listed Holdings Ltd', 'OBL-2023-0594', 'Shares (DSE)'::public.collateral_type,
     '4,200,000 ordinary shares in CRDB Bank PLC — DSE Listed, pledged in favor of EXIM',
     '2,940,000,000', 'TZ-FAC-2024-0612', 'Submitted'::public.collateral_status,
     'DSE'::public.registry_type, '18 Apr 2026', '30 May 2026', 'Lisa Alkado', true, 35, credit_uuid),
    (col7_uuid, 'col-0306', 'Zanzibar Tourism Group', 'OBL-2022-0878', 'Guarantee'::public.collateral_type,
     'Corporate Guarantee from ZTG Holdings Ltd — unlimited in amount',
     '3,200,000,000', 'TZ-FAC-2024-0503', 'Perfected'::public.collateral_status,
     'N/A'::public.registry_type, '05 Dec 2025', '', 'Godfrey Woiso', false, null, credit_uuid),
    (col8_uuid, 'col-0305', 'Tanga Steel Mills', 'OBL-2023-0712', 'Shares (DSE)'::public.collateral_type,
     '1,800,000 shares in Tanzania Breweries Ltd — DSE pledge lodged',
     '2,100,000,000', 'TZ-FAC-2025-0388', 'Submitted'::public.collateral_status,
     'DSE'::public.registry_type, '20 Apr 2026', '01 Jun 2026', 'Lisa Alkado', true, 37, credit_uuid),
    (col9_uuid, 'col-0103', 'Zanzibar Spice Exports', 'OBL-2024-0099', 'Ship/Vessel'::public.collateral_type,
     'MV Spice Trader — IMO 9812344, 1,200 DWT, registered at TASAC Zanzibar',
     '6,700,000,000', 'TZ-FAC-2025-0211', 'Overdue'::public.collateral_status,
     'TASAC'::public.registry_type, '22 Mar 2026', '22 Apr 2026', 'Godfrey Woiso', true, -3, officer_uuid),
    (col10_uuid, 'col-0091', 'Dar Transport Holdings', 'OBL-2024-0155', 'Motor Vehicle'::public.collateral_type,
     '2022 Mercedes-Benz Actros 2645 · Reg. T 880 CFX · Chassis No. WDB9634031L521987',
     '320,000,000', 'TZ-FAC-2025-0034', 'Overdue'::public.collateral_status,
     'TRA'::public.registry_type, '20 Mar 2026', '20 Apr 2026', 'Lisa Alkado', true, -5, credit_uuid),
    (col11_uuid, 'col-0078', 'Mwanza Fishing Co.', 'OBL-2023-0488', 'Mortgage'::public.collateral_type,
     'Plot 14, Ilemela District, Mwanza — Title Deed Vol. 3 Folio 7',
     '1,800,000,000', 'TZ-FAC-2024-1104', 'Overdue'::public.collateral_status,
     'Lands Registry'::public.registry_type, '18 Mar 2026', '18 Apr 2026', 'Yahaya Frezier', true, -7, officer_uuid),
    (col12_uuid, 'col-0041', 'Karibu Enterprises Ltd', 'OBL-2022-0211', 'Debenture'::public.collateral_type,
     'Fixed Charge over land & buildings + floating charge over all other assets',
     '4,200,000,000', 'TZ-FAC-2024-0892', 'Overdue'::public.collateral_status,
     'BRELA'::public.registry_type, '01 Mar 2026', '13 Apr 2026', 'Lisa Alkado', true, -12, credit_uuid)
  ON CONFLICT (collateral_id) DO NOTHING;

  -- Seed audit log entries (only if action column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'audit_logs'
      AND column_name = 'action'
  ) THEN
    INSERT INTO public.audit_logs (
      id, collateral_record_id, collateral_id, action, message, detail,
      performed_by, performed_by_name
    ) VALUES
      (gen_random_uuid(), col4_uuid, 'col-0309', 'perfected',
       'Collateral col-0309 perfected at BRELA', 'Mbeya Mining Corp. · Debenture', legal_uuid, 'Cornel Mangulu'),
      (gen_random_uuid(), col1_uuid, 'col-0312', 'created',
       'New collateral registered: col-0312', 'Coastal Traders Co. · Mortgage · TSh 780M', credit_uuid, 'Lisa Alkado'),
      (gen_random_uuid(), col12_uuid, 'col-0041', 'overdue',
       'BRELA deadline missed — col-0041', 'Karibu Enterprises Ltd · 12 days overdue', credit_uuid, 'System'),
      (gen_random_uuid(), col3_uuid, 'col-0310', 'submitted',
       'Lands Registry submission filed', 'col-0310 · Dodoma Real Estate Ltd · Mortgage', officer_uuid, 'Yahaya Frezier'),
      (gen_random_uuid(), col10_uuid, 'col-0091', 'perfected',
       'TRA registration confirmed: col-0091', 'Dar Transport Holdings · Motor Vehicle', legal_uuid, 'Cornel Mangulu'),
      (gen_random_uuid(), col2_uuid, 'col-0311', 'created',
       'New collateral registered: col-0311', 'Arusha Coffee Growers · FDR · TSh 420M', credit_uuid, 'Godfrey Woiso'),
      (gen_random_uuid(), col8_uuid, 'col-0305', 'submitted',
       'DSE share pledge registered', 'col-0305 · Tanga Steel Mills · Shares', credit_uuid, 'Lisa Alkado'),
      (gen_random_uuid(), col7_uuid, 'col-0306', 'created',
       'Guarantee collateral registered: col-0306', 'Zanzibar Tourism Group · Guarantee', credit_uuid, 'Godfrey Woiso')
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RAISE NOTICE 'Collateral records seeded successfully.';

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed failed: %', SQLERRM;
END $$;
