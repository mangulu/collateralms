-- Seed collateral records for archive module (only if table is empty)
DO $$
DECLARE
  v_user_id UUID;
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.collateral_records;
  IF v_count > 0 THEN
    RAISE NOTICE 'collateral_records already has data, skipping seed';
    RETURN;
  END IF;

  SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;
  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found, skipping collateral seed';
    RETURN;
  END IF;

  INSERT INTO public.collateral_records
    (collateral_id, obligor, obligor_id, collateral_type, description, value_tsh, facility_id, status, registry, created_by)
  VALUES
    ('col-001', 'Amani Enterprises Ltd', 'OBL-001', 'Mortgage', 'Plot 45, Kinondoni District, Dar es Salaam', '850000000', 'FAC-2024-001', 'Perfected', 'Lands Registry', v_user_id),
    ('col-002', 'Baraka Holdings', 'OBL-002', 'Debenture', 'Fixed and Floating Charge over business assets', '1200000000', 'FAC-2024-002', 'Monitoring', 'BRELA', v_user_id),
    ('col-003', 'Chakula Foods Ltd', 'OBL-003', 'Motor Vehicle', 'Toyota Land Cruiser V8 — TZA 456 B', '120000000', 'FAC-2024-003', 'Perfected', 'TRA', v_user_id),
    ('col-004', 'Dhamana Investments', 'OBL-004', 'Shares (DSE)', '500,000 ordinary shares in TBL listed on DSE', '600000000', 'FAC-2024-004', 'Under Review', 'DSE', v_user_id),
    ('col-005', 'Elimu Foundation', 'OBL-005', 'FDR', 'Fixed Deposit Receipt — CRDB Bank, 12 months', '300000000', 'FAC-2024-005', 'Perfected', 'N/A', v_user_id),
    ('col-006', 'Furaha Properties', 'OBL-006', 'Mortgage', 'House No. 12, Masaki, Dar es Salaam', '950000000', 'FAC-2024-006', 'Submitted', 'Lands Registry', v_user_id),
    ('col-007', 'Gawio Trading Co.', 'OBL-007', 'Guarantee', 'Corporate Guarantee from parent company', '500000000', 'FAC-2024-007', 'Draft', 'N/A', v_user_id),
    ('col-008', 'Habari Media Group', 'OBL-008', 'Debenture', 'Debenture over broadcasting equipment and IP', '750000000', 'FAC-2024-008', 'Perfected', 'BRELA', v_user_id)
  ON CONFLICT (collateral_id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Collateral seed error: %', SQLERRM;
END $$;
