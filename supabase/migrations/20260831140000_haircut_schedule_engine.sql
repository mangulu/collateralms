-- ─────────────────────────────────────────────────────────────────────────────
-- Haircut Schedule Engine
-- Asset-class haircut rates (0–30%) applied during valuation and LTV calculation
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Core table
CREATE TABLE IF NOT EXISTS public.haircut_schedules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_class    TEXT NOT NULL,
  haircut_rate        NUMERIC(5,4) NOT NULL DEFAULT 0 CHECK (haircut_rate >= 0 AND haircut_rate <= 0.30),
  description         TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,
  effective_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  approved_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_at         TIMESTAMPTZ,
  notes               TEXT,
  created_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unique active rate per collateral class
CREATE UNIQUE INDEX IF NOT EXISTS idx_haircut_schedules_active_class
  ON public.haircut_schedules (collateral_class)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_haircut_schedules_class
  ON public.haircut_schedules (collateral_class);

CREATE INDEX IF NOT EXISTS idx_haircut_schedules_active
  ON public.haircut_schedules (is_active);

-- 2. Valuation haircut application log
CREATE TABLE IF NOT EXISTS public.haircut_application_log (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  haircut_schedule_id UUID REFERENCES public.haircut_schedules(id) ON DELETE SET NULL,
  collateral_id       UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  valuation_id        UUID REFERENCES public.collateral_valuations(id) ON DELETE SET NULL,
  collateral_class    TEXT NOT NULL,
  gross_value         NUMERIC(20,2) NOT NULL,
  haircut_rate        NUMERIC(5,4) NOT NULL,
  haircut_amount      NUMERIC(20,2) NOT NULL,
  net_value           NUMERIC(20,2) NOT NULL,
  applied_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  applied_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  context             TEXT DEFAULT 'valuation' -- 'valuation' | 'ltv_calculation' | 'manual'
);

CREATE INDEX IF NOT EXISTS idx_haircut_log_collateral
  ON public.haircut_application_log (collateral_id);

CREATE INDEX IF NOT EXISTS idx_haircut_log_valuation
  ON public.haircut_application_log (valuation_id);

CREATE INDEX IF NOT EXISTS idx_haircut_log_applied_at
  ON public.haircut_application_log (applied_at DESC);

-- 3. updated_at trigger
CREATE OR REPLACE FUNCTION public.set_haircut_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_haircut_schedules_updated_at ON public.haircut_schedules;
CREATE TRIGGER trg_haircut_schedules_updated_at
  BEFORE UPDATE ON public.haircut_schedules
  FOR EACH ROW EXECUTE FUNCTION public.set_haircut_updated_at();

-- 4. RLS
ALTER TABLE public.haircut_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.haircut_application_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "haircut_schedules_all_authenticated" ON public.haircut_schedules;
CREATE POLICY "haircut_schedules_all_authenticated"
  ON public.haircut_schedules FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "haircut_log_all_authenticated" ON public.haircut_application_log;
CREATE POLICY "haircut_log_all_authenticated"
  ON public.haircut_application_log FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 5. Seed default haircut schedule (BOT-aligned commercial collateral classes)
DO $$
BEGIN
  INSERT INTO public.haircut_schedules
    (collateral_class, haircut_rate, description, is_active, effective_date)
  VALUES
    ('Residential Land & Buildings',  0.10, 'Freehold/leasehold residential property; 10% haircut per BOT CF 2025 guidance', true, CURRENT_DATE),
    ('Commercial Land & Buildings',   0.15, 'Commercial real estate; higher haircut reflecting liquidity risk',               true, CURRENT_DATE),
    ('Agricultural Land',             0.20, 'Agricultural land; limited marketability warrants 20% haircut',                  true, CURRENT_DATE),
    ('Motor Vehicles',                0.20, 'Registered motor vehicles; depreciation and liquidity risk',                     true, CURRENT_DATE),
    ('Plant & Machinery',             0.25, 'Industrial plant and machinery; specialised assets with limited resale market',  true, CURRENT_DATE),
    ('Listed Shares (DSE)',           0.15, 'Shares listed on Dar es Salaam Stock Exchange; market price volatility haircut', true, CURRENT_DATE),
    ('Unlisted Shares',               0.30, 'Unlisted equity; maximum haircut due to illiquidity',                            true, CURRENT_DATE),
    ('Treasury Bills (< 91 days)',    0.005,'Short-term government securities; near-cash equivalent',                         true, CURRENT_DATE),
    ('Treasury Bills (91–182 days)',  0.01, 'Medium short-term T-Bills per BOT CF 2025 residual maturity schedule',           true, CURRENT_DATE),
    ('Treasury Bonds (< 1 year)',     0.02, 'Short residual maturity government bonds',                                       true, CURRENT_DATE),
    ('Treasury Bonds (1–3 years)',    0.05, 'Medium-term government bonds',                                                   true, CURRENT_DATE),
    ('Treasury Bonds (3–5 years)',    0.10, 'Longer-term government bonds; higher duration risk',                             true, CURRENT_DATE),
    ('Treasury Bonds (> 5 years)',    0.15, 'Long-dated government bonds; significant duration and liquidity risk',           true, CURRENT_DATE),
    ('Cash & Cash Equivalents',       0.00, 'Cash collateral; no haircut applied',                                            true, CURRENT_DATE),
    ('Inventory & Stock',             0.25, 'Inventory; perishability and marketability risk',                                true, CURRENT_DATE),
    ('Debtors / Receivables',         0.20, 'Trade receivables; collection risk haircut',                                     true, CURRENT_DATE)
  ON CONFLICT DO NOTHING;
END $$;
