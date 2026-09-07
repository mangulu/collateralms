-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: Valuation Pricing Flags
-- Flags overdue or market-unavailable valuations to alert officers when
-- collateral requires theoretical pricing, preventing incomplete LTV calculations.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. ENUM Types ─────────────────────────────────────────────────────────────
DROP TYPE IF EXISTS public.valuation_flag_type CASCADE;
CREATE TYPE public.valuation_flag_type AS ENUM (
  'overdue_valuation',
  'market_unavailable',
  'theoretical_pricing_required',
  'stale_valuation',
  'no_market_data'
);

DROP TYPE IF EXISTS public.valuation_flag_status CASCADE;
CREATE TYPE public.valuation_flag_status AS ENUM (
  'open',
  'acknowledged',
  'resolved',
  'suppressed'
);

DROP TYPE IF EXISTS public.pricing_method CASCADE;
CREATE TYPE public.pricing_method AS ENUM (
  'market_value',
  'theoretical',
  'forced_sale',
  'desktop_estimate',
  'book_value'
);

-- ── 2. Core Table ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.valuation_pricing_flags (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id         UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  valuation_id          UUID REFERENCES public.collateral_valuations(id) ON DELETE SET NULL,
  flag_type             public.valuation_flag_type NOT NULL,
  flag_status           public.valuation_flag_status NOT NULL DEFAULT 'open',
  severity              TEXT NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title                 TEXT NOT NULL,
  description           TEXT,
  days_overdue          INTEGER DEFAULT 0,
  last_valuation_date   DATE,
  next_valuation_due    DATE,
  current_ltv           NUMERIC(5,4),
  theoretical_value     NUMERIC(18,2),
  market_value          NUMERIC(18,2),
  pricing_method_used   public.pricing_method DEFAULT 'theoretical',
  ltv_impact_note       TEXT,
  officer_note          TEXT,
  acknowledged_by       UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  acknowledged_at       TIMESTAMPTZ,
  resolved_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  resolved_at           TIMESTAMPTZ,
  resolution_note       TEXT,
  suppressed_until      DATE,
  suppressed_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  auto_generated        BOOLEAN NOT NULL DEFAULT true,
  created_by            UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_vpf_collateral_id   ON public.valuation_pricing_flags(collateral_id);
CREATE INDEX IF NOT EXISTS idx_vpf_flag_status      ON public.valuation_pricing_flags(flag_status);
CREATE INDEX IF NOT EXISTS idx_vpf_flag_type        ON public.valuation_pricing_flags(flag_type);
CREATE INDEX IF NOT EXISTS idx_vpf_severity         ON public.valuation_pricing_flags(severity);
CREATE INDEX IF NOT EXISTS idx_vpf_created_at       ON public.valuation_pricing_flags(created_at DESC);

-- ── 4. Updated-at trigger function ───────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.vpf_set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ── 5. Enable RLS ─────────────────────────────────────────────────────────────
ALTER TABLE public.valuation_pricing_flags ENABLE ROW LEVEL SECURITY;

-- ── 6. RLS Policies ───────────────────────────────────────────────────────────
DROP POLICY IF EXISTS "authenticated_manage_valuation_pricing_flags" ON public.valuation_pricing_flags;
CREATE POLICY "authenticated_manage_valuation_pricing_flags"
ON public.valuation_pricing_flags
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ── 7. Trigger ────────────────────────────────────────────────────────────────
DROP TRIGGER IF EXISTS vpf_updated_at_trigger ON public.valuation_pricing_flags;
CREATE TRIGGER vpf_updated_at_trigger
BEFORE UPDATE ON public.valuation_pricing_flags
FOR EACH ROW EXECUTE FUNCTION public.vpf_set_updated_at();

-- ── 8. Seed data ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_collateral_id UUID;
  v_valuation_id  UUID;
  v_user_id       UUID;
BEGIN
  -- Verify tables exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'collateral_records'
  ) THEN
    RAISE NOTICE 'collateral_records table not found, skipping seed data';
    RETURN;
  END IF;

  SELECT id INTO v_collateral_id FROM public.collateral_records LIMIT 1;
  SELECT id INTO v_user_id       FROM public.user_profiles LIMIT 1;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'collateral_valuations'
  ) THEN
    SELECT id INTO v_valuation_id FROM public.collateral_valuations
    WHERE valuation_status = 'Overdue' LIMIT 1;
  END IF;

  IF v_collateral_id IS NOT NULL THEN
    INSERT INTO public.valuation_pricing_flags (
      id, collateral_id, valuation_id, flag_type, flag_status, severity,
      title, description, days_overdue, last_valuation_date, next_valuation_due,
      current_ltv, theoretical_value, pricing_method_used, ltv_impact_note,
      auto_generated, created_by
    ) VALUES
    (
      gen_random_uuid(), v_collateral_id, v_valuation_id,
      'overdue_valuation', 'open', 'high',
      'Valuation Overdue — Theoretical Pricing Active',
      'Scheduled valuation has not been completed. LTV calculation is using a theoretical estimate based on last known market data adjusted for depreciation.',
      45, (CURRENT_DATE - INTERVAL '45 days')::DATE, (CURRENT_DATE - INTERVAL '15 days')::DATE,
      0.7250, 850000000, 'theoretical',
      'LTV may be understated by up to 8% due to market movement since last valuation.',
      true, v_user_id
    ),
    (
      gen_random_uuid(), v_collateral_id, NULL,
      'market_unavailable', 'open', 'critical',
      'No Active Market — DSE Share Pricing Unavailable',
      'Collateral is listed on DSE but no trades recorded in the past 90 days. Market price is unavailable; theoretical book value is being used for LTV.',
      0, (CURRENT_DATE - INTERVAL '90 days')::DATE, CURRENT_DATE,
      0.8100, 320000000, 'book_value',
      'Critical: LTV calculation relies entirely on book value. Actual realisable value may differ significantly.',
      true, v_user_id
    ),
    (
      gen_random_uuid(), v_collateral_id, NULL,
      'stale_valuation', 'acknowledged', 'medium',
      'Stale Valuation — Over 12 Months Old',
      'Last approved valuation is more than 12 months old. BOT guidelines require annual revaluation for this collateral class.',
      30, (CURRENT_DATE - INTERVAL '13 months')::DATE, (CURRENT_DATE - INTERVAL '1 month')::DATE,
      0.6500, 1200000000, 'desktop_estimate',
      'Using desktop estimate pending full revaluation. LTV impact: moderate.',
      true, v_user_id
    )
    ON CONFLICT (id) DO NOTHING;
  ELSE
    RAISE NOTICE 'No collateral records found, skipping seed data for valuation_pricing_flags';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed data insertion failed: %', SQLERRM;
END $$;
