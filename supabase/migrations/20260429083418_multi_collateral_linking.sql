-- ─── Multi-Collateral Linking & Charge Registry ───────────────────────────────
-- Migration: 20260429083418_multi_collateral_linking.sql

-- ─── 1. Add columns to collateral_records ─────────────────────────────────────
ALTER TABLE public.collateral_records
  ADD COLUMN IF NOT EXISTS is_shared BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS valuation_amount DECIMAL(20,2),
  ADD COLUMN IF NOT EXISTS valuation_date DATE,
  ADD COLUMN IF NOT EXISTS ltv_ratio DECIMAL(5,4) DEFAULT 0.70,
  ADD COLUMN IF NOT EXISTS max_securable_amount DECIMAL(20,2),
  ADD COLUMN IF NOT EXISTS total_secured_amount DECIMAL(20,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS available_equity DECIMAL(20,2);

-- ─── 2. Collateral Loan Link (junction table) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collateral_loan_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID NOT NULL REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  loan_account_id TEXT NOT NULL,
  beneficiary_id TEXT NOT NULL,
  beneficiary_name TEXT NOT NULL DEFAULT '',
  charge_rank INT NOT NULL DEFAULT 1,
  allocated_amount DECIMAL(20,2) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  release_date DATE,
  release_reason TEXT,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 3. Charge Registry ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.charge_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID NOT NULL REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_loan_link_id UUID REFERENCES public.collateral_loan_links(id) ON DELETE SET NULL,
  loan_account_id TEXT NOT NULL DEFAULT '',
  charge_rank INT NOT NULL DEFAULT 1,
  registry_name TEXT NOT NULL DEFAULT '',
  registration_number TEXT,
  registration_date DATE,
  discharge_number TEXT,
  discharge_date DATE,
  discharge_certificate_url TEXT,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  notes TEXT DEFAULT '',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 4. Indexes ───────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_collateral_loan_links_collateral_id ON public.collateral_loan_links(collateral_id);
CREATE INDEX IF NOT EXISTS idx_collateral_loan_links_status ON public.collateral_loan_links(status);
CREATE INDEX IF NOT EXISTS idx_collateral_loan_links_loan_account_id ON public.collateral_loan_links(loan_account_id);
CREATE INDEX IF NOT EXISTS idx_charge_registry_collateral_id ON public.charge_registry(collateral_id);
CREATE INDEX IF NOT EXISTS idx_charge_registry_status ON public.charge_registry(status);

-- ─── 5. Enable RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.collateral_loan_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.charge_registry ENABLE ROW LEVEL SECURITY;

-- ─── 6. RLS Policies ─────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_manage_collateral_loan_links" ON public.collateral_loan_links;
CREATE POLICY "authenticated_manage_collateral_loan_links"
ON public.collateral_loan_links
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_charge_registry" ON public.charge_registry;
CREATE POLICY "authenticated_manage_charge_registry"
ON public.charge_registry
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ─── 7. Updated_at trigger function ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS update_collateral_loan_links_updated_at ON public.collateral_loan_links;
CREATE TRIGGER update_collateral_loan_links_updated_at
  BEFORE UPDATE ON public.collateral_loan_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_charge_registry_updated_at ON public.charge_registry;
CREATE TRIGGER update_charge_registry_updated_at
  BEFORE UPDATE ON public.charge_registry
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ─── 8. Mock Data ─────────────────────────────────────────────────────────────
DO $$
DECLARE
  col1_id UUID;
  col2_id UUID;
  col3_id UUID;
  existing_user_id UUID;
  link1_id UUID := gen_random_uuid();
  link2_id UUID := gen_random_uuid();
  link3_id UUID := gen_random_uuid();
  link4_id UUID := gen_random_uuid();
BEGIN
  -- Get existing user
  SELECT id INTO existing_user_id FROM public.user_profiles LIMIT 1;

  -- Get first 3 collateral records
  SELECT id INTO col1_id FROM public.collateral_records ORDER BY created_at LIMIT 1;
  SELECT id INTO col2_id FROM public.collateral_records ORDER BY created_at OFFSET 1 LIMIT 1;
  SELECT id INTO col3_id FROM public.collateral_records ORDER BY created_at OFFSET 2 LIMIT 1;

  IF col1_id IS NOT NULL THEN
    -- Update collateral 1 with valuation data
    UPDATE public.collateral_records SET
      valuation_amount = 500000000,
      ltv_ratio = 0.70,
      max_securable_amount = 350000000,
      total_secured_amount = 300000000,
      available_equity = 50000000,
      is_shared = TRUE,
      valuation_date = '2024-01-15'
    WHERE id = col1_id;

    -- Insert loan links for collateral 1
    INSERT INTO public.collateral_loan_links (id, collateral_id, loan_account_id, beneficiary_id, beneficiary_name, charge_rank, allocated_amount, start_date, status, created_by)
    VALUES
      (link1_id, col1_id, 'LN-2024-001234', 'CUST-56789', 'Lisa Alkado', 1, 200000000, '2024-01-01', 'ACTIVE', existing_user_id),
      (link2_id, col1_id, 'LN-2024-005678', 'CUST-90123', 'Cornel Mangulu', 2, 100000000, '2024-02-01', 'ACTIVE', existing_user_id)
    ON CONFLICT (id) DO NOTHING;

    -- Insert charge registry entries for collateral 1
    INSERT INTO public.charge_registry (collateral_id, collateral_loan_link_id, loan_account_id, charge_rank, registry_name, registration_number, registration_date, status, created_by)
    VALUES
      (col1_id, link1_id, 'LN-2024-001234', 1, 'BRELA', 'BR-2024-001', '2024-01-05', 'ACTIVE', existing_user_id),
      (col1_id, link2_id, 'LN-2024-005678', 2, 'BRELA', 'BR-2024-002', '2024-02-10', 'ACTIVE', existing_user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF col2_id IS NOT NULL THEN
    -- Update collateral 2
    UPDATE public.collateral_records SET
      valuation_amount = 300000000,
      ltv_ratio = 0.70,
      max_securable_amount = 210000000,
      total_secured_amount = 150000000,
      available_equity = 60000000,
      is_shared = TRUE,
      valuation_date = '2024-03-01'
    WHERE id = col2_id;

    INSERT INTO public.collateral_loan_links (id, collateral_id, loan_account_id, beneficiary_id, beneficiary_name, charge_rank, allocated_amount, start_date, status, created_by)
    VALUES
      (link3_id, col2_id, 'LN-2024-007890', 'CUST-11111', 'Amina Hassan', 1, 150000000, '2024-03-01', 'ACTIVE', existing_user_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.charge_registry (collateral_id, collateral_loan_link_id, loan_account_id, charge_rank, registry_name, registration_number, registration_date, status, created_by)
    VALUES
      (col2_id, link3_id, 'LN-2024-007890', 1, 'Lands Registry', 'LR-2024-045', '2024-03-05', 'ACTIVE', existing_user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF col3_id IS NOT NULL THEN
    -- Update collateral 3 with a released link
    UPDATE public.collateral_records SET
      valuation_amount = 200000000,
      ltv_ratio = 0.70,
      max_securable_amount = 140000000,
      total_secured_amount = 80000000,
      available_equity = 60000000,
      is_shared = FALSE,
      valuation_date = '2023-12-01'
    WHERE id = col3_id;

    INSERT INTO public.collateral_loan_links (id, collateral_id, loan_account_id, beneficiary_id, beneficiary_name, charge_rank, allocated_amount, start_date, end_date, status, release_date, release_reason, created_by)
    VALUES
      (link4_id, col3_id, 'LN-2023-009900', 'CUST-22222', 'Peter Mwangi', 1, 80000000, '2023-06-01', '2024-01-15', 'RELEASED', '2024-01-15', 'LOAN_FULLY_REPAID', existing_user_id)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.charge_registry (collateral_id, collateral_loan_link_id, loan_account_id, charge_rank, registry_name, registration_number, registration_date, discharge_number, discharge_date, status, created_by)
    VALUES
      (col3_id, link4_id, 'LN-2023-009900', 1, 'BRELA', 'BR-2023-099', '2023-06-10', 'DIS-BR-2024-001', '2024-01-20', 'DISCHARGED', existing_user_id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
