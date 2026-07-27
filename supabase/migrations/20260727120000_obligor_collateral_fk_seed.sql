-- ============================================================
-- Obligor-Collateral FK Link: Seed collateral records with
-- proper obligor_ref_id foreign keys to the obligors table.
-- This ensures the obligor profile shows linked collaterals
-- and collateral records resolve back to full obligor profiles.
-- ============================================================

-- Seed collateral records linked to existing obligors via FK
DO $$
DECLARE
  v_user_id UUID;
  v_obl1 UUID;
  v_obl2 UUID;
  v_obl3 UUID;
  v_obl4 UUID;
  v_obl5 UUID;
  v_obl6 UUID;
BEGIN
  -- Get a valid user for created_by
  SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;

  -- Get obligor IDs by code (seeded in 20260725051000_obligors_and_geomapping.sql)
  SELECT id INTO v_obl1 FROM public.obligors WHERE obligor_code = 'OBL-2024-0001' LIMIT 1;
  SELECT id INTO v_obl2 FROM public.obligors WHERE obligor_code = 'OBL-2024-0002' LIMIT 1;
  SELECT id INTO v_obl3 FROM public.obligors WHERE obligor_code = 'OBL-2024-0003' LIMIT 1;
  SELECT id INTO v_obl4 FROM public.obligors WHERE obligor_code = 'OBL-2024-0004' LIMIT 1;
  SELECT id INTO v_obl5 FROM public.obligors WHERE obligor_code = 'OBL-2024-0005' LIMIT 1;
  SELECT id INTO v_obl6 FROM public.obligors WHERE obligor_code = 'OBL-2024-0006' LIMIT 1;

  IF v_obl1 IS NULL THEN
    RAISE NOTICE 'Obligors not found — skipping collateral seed.';
    RETURN;
  END IF;

  -- Insert collateral records with obligor_ref_id FK
  INSERT INTO public.collateral_records (
    id, collateral_id, obligor, obligor_id, obligor_ref_id,
    collateral_type, description, value_tsh, facility_id,
    status, registry, registration_date, perfection_deadline,
    assigned_officer, requires_perfection, days_to_deadline,
    created_by, created_at, updated_at
  ) VALUES
    -- Tanzanian Steel Industries Ltd (OBL-2024-0001) — 2 collaterals
    (gen_random_uuid(), 'col-001001', 'Tanzanian Steel Industries Ltd', 'OBL-2024-0001', v_obl1,
     'Mortgage'::public.collateral_type,
     'Industrial land and factory building at Ohio Street, Dar es Salaam — Plot 45',
     '2,500,000,000', 'FAC-2024-0011',
     'Perfected'::public.collateral_status, 'Lands Registry'::public.registry_type,
     '2024-02-15', '2024-03-28',
     'James Mwangi', true, null,
     v_user_id, now() - interval '180 days', now() - interval '10 days'),

    (gen_random_uuid(), 'col-001002', 'Tanzanian Steel Industries Ltd', 'OBL-2024-0001', v_obl1,
     'Debenture'::public.collateral_type,
     'Fixed and floating charge over all assets of Tanzanian Steel Industries Ltd',
     '1,800,000,000', 'FAC-2024-0011',
     'Monitoring'::public.collateral_status, 'BRELA'::public.registry_type,
     '2024-03-01', '2024-04-12',
     'James Mwangi', true, null,
     v_user_id, now() - interval '160 days', now() - interval '5 days'),

    -- Kilimanjaro Coffee Exporters Ltd (OBL-2024-0002) — 2 collaterals
    (gen_random_uuid(), 'col-002001', 'Kilimanjaro Coffee Exporters Ltd', 'OBL-2024-0002', v_obl2,
     'Mortgage'::public.collateral_type,
     'Coffee processing plant and warehouse, Moshi Town Centre Block B',
     '950,000,000', 'FAC-2024-0022',
     'Perfected'::public.collateral_status, 'Lands Registry'::public.registry_type,
     '2024-01-10', '2024-02-21',
     'Grace Kimaro', true, null,
     v_user_id, now() - interval '200 days', now() - interval '20 days'),

    (gen_random_uuid(), 'col-002002', 'Kilimanjaro Coffee Exporters Ltd', 'OBL-2024-0002', v_obl2,
     'FDR'::public.collateral_type,
     'Fixed Deposit Receipt — CRDB Bank, Account No. 0150-XXXX-XXXX, Maturity 2025-12-31',
     '400,000,000', 'FAC-2024-0022',
     'Submitted'::public.collateral_status, 'N/A'::public.registry_type,
     '2024-06-01', '',
     'Grace Kimaro', false, null,
     v_user_id, now() - interval '60 days', now() - interval '2 days'),

    -- Dar es Salaam Logistics Co. (OBL-2024-0003) — 2 collaterals
    (gen_random_uuid(), 'col-003001', 'Dar es Salaam Logistics Co.', 'OBL-2024-0003', v_obl3,
     'Motor Vehicle'::public.collateral_type,
     'Fleet of 5 Isuzu FVZ trucks, Reg: T123ABC, T124ABC, T125ABC, T126ABC, T127ABC',
     '350,000,000', 'FAC-2024-0033',
     'Under Review'::public.collateral_status, 'TRA'::public.registry_type,
     '2024-05-20', '2024-07-01',
     'Peter Makundi', true, 12,
     v_user_id, now() - interval '40 days', now() - interval '1 day'),

    (gen_random_uuid(), 'col-003002', 'Dar es Salaam Logistics Co.', 'OBL-2024-0003', v_obl3,
     'Debenture'::public.collateral_type,
     'Debenture over warehouse and logistics equipment at Temeke Industrial Zone',
     '280,000,000', 'FAC-2024-0033',
     'Draft'::public.collateral_status, 'BRELA'::public.registry_type,
     '2024-07-01', '2024-08-12',
     'Peter Makundi', true, 42,
     v_user_id, now() - interval '5 days', now() - interval '1 day'),

    -- Mwanza Fish Processing Ltd (OBL-2024-0004) — 1 collateral (HIGH risk)
    (gen_random_uuid(), 'col-004001', 'Mwanza Fish Processing Ltd', 'OBL-2024-0004', v_obl4,
     'Mortgage'::public.collateral_type,
     'Fish processing facility and cold storage, Mwanza City Centre Port Road',
     '180,000,000', 'FAC-2024-0044',
     'Overdue'::public.collateral_status, 'Lands Registry'::public.registry_type,
     '2023-11-15', '2023-12-27',
     'Sarah Nyerere', true, -120,
     v_user_id, now() - interval '250 days', now() - interval '30 days'),

    -- Arusha New Ventures Ltd (OBL-2024-0005) — 2 collaterals
    (gen_random_uuid(), 'col-005001', 'Arusha New Ventures Ltd', 'OBL-2024-0005', v_obl5,
     'Shares (DSE)'::public.collateral_type,
     'Listed shares — 2,500,000 units of CRDB Bank Plc (DSE: CRDB)',
     '1,250,000,000', 'FAC-2024-0055',
     'Perfected'::public.collateral_status, 'DSE'::public.registry_type,
     '2024-04-01', '2024-05-13',
     'David Laizer', true, null,
     v_user_id, now() - interval '120 days', now() - interval '15 days'),

    (gen_random_uuid(), 'col-005002', 'Arusha New Ventures Ltd', 'OBL-2024-0005', v_obl5,
     'Mortgage'::public.collateral_type,
     'Commercial property at Arusha CBD, Sokoine Road — 3-storey office block',
     '900,000,000', 'FAC-2024-0055',
     'Monitoring'::public.collateral_status, 'Lands Registry'::public.registry_type,
     '2024-02-28', '2024-04-10',
     'David Laizer', true, null,
     v_user_id, now() - interval '150 days', now() - interval '8 days'),

    -- John Mwamba (OBL-2024-0006) — 1 collateral (individual)
    (gen_random_uuid(), 'col-006001', 'John Mwamba', 'OBL-2024-0006', v_obl6,
     'Mortgage'::public.collateral_type,
     'Residential property — Plot 12, Mikocheni B, Dar es Salaam, Title Deed No. DSM/MKB/2019/0012',
     '120,000,000', 'FAC-2024-0066',
     'Perfected'::public.collateral_status, 'Lands Registry'::public.registry_type,
     '2024-03-15', '2024-04-26',
     'James Mwangi', true, null,
     v_user_id, now() - interval '100 days', now() - interval '7 days')

  ON CONFLICT (collateral_id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Collateral seed failed: %', SQLERRM;
END $$;
