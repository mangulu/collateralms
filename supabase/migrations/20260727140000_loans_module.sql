-- ============================================================
-- Loans Module: Middle layer between Obligors and Collaterals
-- ============================================================

-- 1. Create loans table
CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_number TEXT NOT NULL UNIQUE,
  obligor_id UUID NOT NULL REFERENCES public.obligors(id) ON DELETE CASCADE,
  -- Facility details
  facility_type TEXT NOT NULL DEFAULT 'Term Loan',
  facility_amount NUMERIC NOT NULL DEFAULT 0,
  outstanding_balance NUMERIC DEFAULT NULL,
  currency TEXT NOT NULL DEFAULT 'TZS',
  interest_rate NUMERIC DEFAULT NULL,
  -- Terms
  disbursement_date DATE DEFAULT NULL,
  maturity_date DATE DEFAULT NULL,
  repayment_frequency TEXT DEFAULT 'Monthly',
  -- Status
  loan_status TEXT NOT NULL DEFAULT 'Active',
  -- Meta
  purpose TEXT DEFAULT NULL,
  notes TEXT DEFAULT NULL,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. Add loan_id FK to collateral_records (nullable for backward compat)
ALTER TABLE public.collateral_records
  ADD COLUMN IF NOT EXISTS loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL;

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_loans_obligor_id ON public.loans(obligor_id);
CREATE INDEX IF NOT EXISTS idx_loans_loan_number ON public.loans(loan_number);
CREATE INDEX IF NOT EXISTS idx_loans_loan_status ON public.loans(loan_status);
CREATE INDEX IF NOT EXISTS idx_collateral_records_loan_id ON public.collateral_records(loan_id);

-- 4. Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_loans_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_loans_updated_at ON public.loans;
CREATE TRIGGER trg_loans_updated_at
  BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.set_loans_updated_at();

-- 5. Enable RLS
ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "authenticated_read_loans" ON public.loans;
CREATE POLICY "authenticated_read_loans"
  ON public.loans FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_insert_loans" ON public.loans;
CREATE POLICY "authenticated_insert_loans"
  ON public.loans FOR INSERT TO authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_update_loans" ON public.loans;
CREATE POLICY "authenticated_update_loans"
  ON public.loans FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_loans" ON public.loans;
CREATE POLICY "authenticated_delete_loans"
  ON public.loans FOR DELETE TO authenticated USING (true);

-- 7. Seed sample loans linked to existing obligors
DO $$
DECLARE
  obl1 UUID; obl2 UUID; obl3 UUID; obl4 UUID; obl5 UUID; obl6 UUID;
  loan1 UUID; loan2 UUID; loan3 UUID; loan4 UUID; loan5 UUID; loan6 UUID; loan7 UUID;
  col1 UUID; col2 UUID;
BEGIN
  -- Fetch existing obligor IDs
  SELECT id INTO obl1 FROM public.obligors ORDER BY created_at ASC LIMIT 1 OFFSET 0;
  SELECT id INTO obl2 FROM public.obligors ORDER BY created_at ASC LIMIT 1 OFFSET 1;
  SELECT id INTO obl3 FROM public.obligors ORDER BY created_at ASC LIMIT 1 OFFSET 2;
  SELECT id INTO obl4 FROM public.obligors ORDER BY created_at ASC LIMIT 1 OFFSET 3;
  SELECT id INTO obl5 FROM public.obligors ORDER BY created_at ASC LIMIT 1 OFFSET 4;
  SELECT id INTO obl6 FROM public.obligors ORDER BY created_at ASC LIMIT 1 OFFSET 5;

  IF obl1 IS NOT NULL THEN
    loan1 := gen_random_uuid();
    INSERT INTO public.loans (id, loan_number, obligor_id, facility_type, facility_amount, outstanding_balance, currency, interest_rate, disbursement_date, maturity_date, repayment_frequency, loan_status, purpose)
    VALUES (loan1, 'TZ-LN-2024-0001', obl1, 'Term Loan', 500000000, 380000000, 'TZS', 14.5, '2024-01-15', '2027-01-15', 'Monthly', 'Active', 'Business expansion and working capital')
    ON CONFLICT (loan_number) DO NOTHING;

    loan2 := gen_random_uuid();
    INSERT INTO public.loans (id, loan_number, obligor_id, facility_type, facility_amount, outstanding_balance, currency, interest_rate, disbursement_date, maturity_date, repayment_frequency, loan_status, purpose)
    VALUES (loan2, 'TZ-LN-2024-0002', obl1, 'Overdraft Facility', 200000000, 150000000, 'TZS', 16.0, '2024-03-01', '2025-03-01', 'Monthly', 'Active', 'Short-term working capital')
    ON CONFLICT (loan_number) DO NOTHING;
  END IF;

  IF obl2 IS NOT NULL THEN
    loan3 := gen_random_uuid();
    INSERT INTO public.loans (id, loan_number, obligor_id, facility_type, facility_amount, outstanding_balance, currency, interest_rate, disbursement_date, maturity_date, repayment_frequency, loan_status, purpose)
    VALUES (loan3, 'TZ-LN-2024-0003', obl2, 'Mortgage', 1200000000, 1050000000, 'TZS', 13.0, '2024-02-10', '2034-02-10', 'Monthly', 'Active', 'Commercial property acquisition')
    ON CONFLICT (loan_number) DO NOTHING;
  END IF;

  IF obl3 IS NOT NULL THEN
    loan4 := gen_random_uuid();
    INSERT INTO public.loans (id, loan_number, obligor_id, facility_type, facility_amount, outstanding_balance, currency, interest_rate, disbursement_date, maturity_date, repayment_frequency, loan_status, purpose)
    VALUES (loan4, 'TZ-LN-2024-0004', obl3, 'Asset Finance', 350000000, 280000000, 'TZS', 15.5, '2024-04-20', '2028-04-20', 'Monthly', 'Active', 'Fleet vehicle acquisition')
    ON CONFLICT (loan_number) DO NOTHING;
  END IF;

  IF obl4 IS NOT NULL THEN
    loan5 := gen_random_uuid();
    INSERT INTO public.loans (id, loan_number, obligor_id, facility_type, facility_amount, outstanding_balance, currency, interest_rate, disbursement_date, maturity_date, repayment_frequency, loan_status, purpose)
    VALUES (loan5, 'TZ-LN-2023-0015', obl4, 'Term Loan', 800000000, 0, 'TZS', 14.0, '2023-06-01', '2026-06-01', 'Monthly', 'Closed', 'Manufacturing equipment')
    ON CONFLICT (loan_number) DO NOTHING;
  END IF;

  IF obl5 IS NOT NULL THEN
    loan6 := gen_random_uuid();
    INSERT INTO public.loans (id, loan_number, obligor_id, facility_type, facility_amount, outstanding_balance, currency, interest_rate, disbursement_date, maturity_date, repayment_frequency, loan_status, purpose)
    VALUES (loan6, 'TZ-LN-2024-0006', obl5, 'Trade Finance', 600000000, 420000000, 'TZS', 12.5, '2024-05-15', '2025-11-15', 'Quarterly', 'Active', 'Import financing for raw materials')
    ON CONFLICT (loan_number) DO NOTHING;
  END IF;

  IF obl6 IS NOT NULL THEN
    loan7 := gen_random_uuid();
    INSERT INTO public.loans (id, loan_number, obligor_id, facility_type, facility_amount, outstanding_balance, currency, interest_rate, disbursement_date, maturity_date, repayment_frequency, loan_status, purpose)
    VALUES (loan7, 'TZ-LN-2024-0007', obl6, 'Revolving Credit', 250000000, 180000000, 'TZS', 17.0, '2024-07-01', '2026-07-01', 'Monthly', 'Active', 'General business operations')
    ON CONFLICT (loan_number) DO NOTHING;
  END IF;

  -- Link some existing collaterals to loans
  IF loan1 IS NOT NULL THEN
    UPDATE public.collateral_records
    SET loan_id = loan1
    WHERE id IN (
      SELECT id FROM public.collateral_records
      WHERE obligor_ref_id = obl1 AND loan_id IS NULL
      LIMIT 2
    );
  END IF;

  IF loan3 IS NOT NULL THEN
    UPDATE public.collateral_records
    SET loan_id = loan3
    WHERE id IN (
      SELECT id FROM public.collateral_records
      WHERE obligor_ref_id = obl2 AND loan_id IS NULL
      LIMIT 1
    );
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Loans seed failed: %', SQLERRM;
END $$;
