-- Migration: Executive Dashboard Features
-- Adds: valuation_history, 2FA OTP, deadline_predictions, global_search_index

-- ─── Valuation History Table ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.collateral_valuation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  valuation_amount NUMERIC(18,2) NOT NULL,
  ltv_ratio NUMERIC(5,4),
  max_securable_amount NUMERIC(18,2),
  available_equity NUMERIC(18,2),
  valuation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  valuation_note TEXT,
  recorded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_val_history_collateral_id ON public.collateral_valuation_history(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_val_history_date ON public.collateral_valuation_history(valuation_date);

ALTER TABLE public.collateral_valuation_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_valuation_history" ON public.collateral_valuation_history;
CREATE POLICY "auth_users_valuation_history"
ON public.collateral_valuation_history
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ─── OTP / 2FA Table ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.otp_verifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  otp_code TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  verified_at TIMESTAMPTZ,
  attempts INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_otp_user_id ON public.otp_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_otp_expires ON public.otp_verifications(expires_at);

ALTER TABLE public.otp_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_otp" ON public.otp_verifications;
CREATE POLICY "auth_users_otp"
ON public.otp_verifications
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- ─── Deadline Predictions Table ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.deadline_predictions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  predicted_miss BOOLEAN DEFAULT false,
  risk_score INTEGER DEFAULT 0,
  risk_factors JSONB DEFAULT '[]'::jsonb,
  predicted_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  days_to_deadline INTEGER,
  current_status TEXT
);

CREATE INDEX IF NOT EXISTS idx_deadline_pred_collateral ON public.deadline_predictions(collateral_record_id);

ALTER TABLE public.deadline_predictions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_deadline_predictions" ON public.deadline_predictions;
CREATE POLICY "auth_users_deadline_predictions"
ON public.deadline_predictions
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ─── Add phone to user_profiles if missing ───────────────────────────────────
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS two_fa_verified_at TIMESTAMPTZ;

-- ─── Seed valuation history for existing collateral records ──────────────────
DO $$
DECLARE
  rec RECORD;
BEGIN
  FOR rec IN
    SELECT id, collateral_id, value_tsh
    FROM public.collateral_records
    LIMIT 20
  LOOP
    INSERT INTO public.collateral_valuation_history (
      collateral_record_id, collateral_id, valuation_amount,
      ltv_ratio, max_securable_amount, available_equity, valuation_date, valuation_note
    )
    SELECT
      rec.id,
      rec.collateral_id,
      COALESCE(rec.value_tsh, 500000000),
      0.65,
      COALESCE(rec.value_tsh, 500000000) * 0.65,
      COALESCE(rec.value_tsh, 500000000) * 0.35,
      CURRENT_DATE - INTERVAL '6 months',
      'Initial valuation on record creation'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.collateral_valuation_history
      WHERE collateral_record_id = rec.id
      AND valuation_date = CURRENT_DATE - INTERVAL '6 months'
    );

    INSERT INTO public.collateral_valuation_history (
      collateral_record_id, collateral_id, valuation_amount,
      ltv_ratio, max_securable_amount, available_equity, valuation_date, valuation_note
    )
    SELECT
      rec.id,
      rec.collateral_id,
      COALESCE(rec.value_tsh, 500000000) * 1.05,
      0.62,
      COALESCE(rec.value_tsh, 500000000) * 1.05 * 0.62,
      COALESCE(rec.value_tsh, 500000000) * 1.05 * 0.38,
      CURRENT_DATE - INTERVAL '3 months',
      'Quarterly revaluation'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.collateral_valuation_history
      WHERE collateral_record_id = rec.id
      AND valuation_date = CURRENT_DATE - INTERVAL '3 months'
    );

    INSERT INTO public.collateral_valuation_history (
      collateral_record_id, collateral_id, valuation_amount,
      ltv_ratio, max_securable_amount, available_equity, valuation_date, valuation_note
    )
    SELECT
      rec.id,
      rec.collateral_id,
      COALESCE(rec.value_tsh, 500000000) * 1.08,
      0.60,
      COALESCE(rec.value_tsh, 500000000) * 1.08 * 0.60,
      COALESCE(rec.value_tsh, 500000000) * 1.08 * 0.40,
      CURRENT_DATE,
      'Latest market valuation'
    WHERE NOT EXISTS (
      SELECT 1 FROM public.collateral_valuation_history
      WHERE collateral_record_id = rec.id
      AND valuation_date = CURRENT_DATE
    );
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Valuation history seed failed: %', SQLERRM;
END $$;
