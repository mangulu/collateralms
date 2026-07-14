-- ============================================================
-- CollateralMS — Fix Storage RLS & Ensure Collateral Seed
-- Adds missing UPDATE policy on storage.objects for the
-- collateral-documents bucket and re-seeds collateral records
-- if the table is empty (handles cases where seed was wiped).
-- ============================================================

-- 1. Add missing UPDATE policy on storage.objects
--    (needed for metadata updates and some SDK operations)
DROP POLICY IF EXISTS "authenticated_update_collateral_docs" ON storage.objects;
CREATE POLICY "authenticated_update_collateral_docs"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'collateral-documents')
WITH CHECK (bucket_id = 'collateral-documents' AND auth.uid() IS NOT NULL);

-- 2. Ensure collateral_documents RLS policies are correct
--    (idempotent — safe to re-run)
DROP POLICY IF EXISTS "authenticated_read_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_read_collateral_documents"
ON public.collateral_documents
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_insert_collateral_documents"
ON public.collateral_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_update_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_update_collateral_documents"
ON public.collateral_documents
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_delete_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_delete_collateral_documents"
ON public.collateral_documents
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.get_user_role() IN ('system_admin', 'legal_officer')
);

-- 3. Re-seed collateral records if table is empty
DO $$
DECLARE
  v_count     INTEGER;
  credit_uuid UUID;
  legal_uuid  UUID;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.collateral_records;

  IF v_count > 0 THEN
    RAISE NOTICE 'collateral_records already has % rows — skipping seed.', v_count;
    RETURN;
  END IF;

  -- Fetch user profiles
  SELECT id INTO credit_uuid FROM public.user_profiles WHERE role = 'credit_officer' LIMIT 1;
  SELECT id INTO legal_uuid  FROM public.user_profiles WHERE role = 'legal_officer'  LIMIT 1;
  IF credit_uuid IS NULL THEN SELECT id INTO credit_uuid FROM public.user_profiles LIMIT 1; END IF;
  IF legal_uuid  IS NULL THEN SELECT id INTO legal_uuid  FROM public.user_profiles LIMIT 1; END IF;

  IF credit_uuid IS NULL THEN
    RAISE NOTICE 'No user profiles found — cannot seed collateral records.';
    RETURN;
  END IF;

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
     'Lands Registry'::public.registry_type, '2026-03-02', '2026-04-13', 'Cornel Mangulu', true, COALESCE(legal_uuid, credit_uuid)),

    ('col-0309', 'Mbeya Mining Corp.', 'OBL-2023-1107', 'Debenture'::public.collateral_type,
     'Fixed & Floating Charge over all assets — registered at BRELA',
     '8,400,000,000', 8400000000, 0.70, 5880000000, 0, 5880000000,
     'TZ-FAC-2024-0771', 'Perfected'::public.collateral_status,
     'BRELA'::public.registry_type, '2026-02-15', '2026-03-29', 'Cornel Mangulu', true, COALESCE(legal_uuid, credit_uuid)),

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

  RAISE NOTICE 'Seeded 12 collateral records.';
END;
$$;
