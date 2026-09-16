-- ============================================================
-- Obligor Service Tiers (Fast Track)
-- Fast Track Tiers previously stored each obligor's assigned
-- service tier as a JSON blob inside the generic system_config
-- table (config_key='fast_track_tiers') — no per-obligor row, no
-- real query/audit support, and inconsistently double-encoded
-- (JSON.stringify'd into a jsonb column) versus every other
-- config_value in that table. This gives tier assignments a real,
-- dedicated home.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.obligor_service_tiers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obligor_id        UUID NOT NULL UNIQUE REFERENCES public.obligors(id) ON DELETE CASCADE,
  tier              TEXT NOT NULL CHECK (tier IN ('PREMIER', 'REPEAT', 'STANDARD')),
  effective_date    DATE NOT NULL DEFAULT CURRENT_DATE,
  reason            TEXT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_obligor_service_tiers_tier ON public.obligor_service_tiers(tier);

ALTER TABLE public.obligor_service_tiers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_obligor_service_tiers" ON public.obligor_service_tiers;
CREATE POLICY "auth_users_obligor_service_tiers"
ON public.obligor_service_tiers
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- Best-effort backfill from the old system_config blob. Wrapped so a
-- malformed/legacy blob can never break this migration — worst case
-- it's skipped and tiers are re-assigned via the UI.
DO $$
DECLARE
  raw jsonb;
  unwrapped jsonb;
  rec RECORD;
BEGIN
  SELECT config_value INTO raw FROM public.system_config WHERE config_key = 'fast_track_tiers';
  IF raw IS NOT NULL THEN
    IF jsonb_typeof(raw) = 'string' THEN
      unwrapped := (raw #>> '{}')::jsonb;
    ELSE
      unwrapped := raw;
    END IF;

    FOR rec IN SELECT * FROM jsonb_each(unwrapped) LOOP
      INSERT INTO public.obligor_service_tiers (obligor_id, tier, effective_date, reason)
      VALUES (
        rec.key::uuid,
        rec.value->>'tier',
        COALESCE(NULLIF(rec.value->>'since', '')::date, CURRENT_DATE),
        rec.value->>'reason'
      )
      ON CONFLICT (obligor_id) DO NOTHING;
    END LOOP;
  END IF;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'fast_track_tiers backfill skipped: %', SQLERRM;
END $$;
