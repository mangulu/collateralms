-- Migration: officer_alert_thresholds
-- Stores per-officer customized alert thresholds for LTV %, perfection drop %, and BRELA days
-- Enables multi-device sync and audit recovery

-- Create table
CREATE TABLE IF NOT EXISTS public.officer_alert_thresholds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  officer_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ltv_breach_pct INTEGER NOT NULL DEFAULT 80,
  perfection_rate_drop_pct INTEGER NOT NULL DEFAULT 10,
  brela_deadline_days INTEGER NOT NULL DEFAULT 30,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT chk_ltv_breach_pct CHECK (ltv_breach_pct BETWEEN 50 AND 120),
  CONSTRAINT chk_perfection_rate_drop_pct CHECK (perfection_rate_drop_pct BETWEEN 1 AND 50),
  CONSTRAINT chk_brela_deadline_days CHECK (brela_deadline_days BETWEEN 1 AND 90)
);

-- Unique constraint: one row per officer
CREATE UNIQUE INDEX IF NOT EXISTS idx_officer_alert_thresholds_officer_id
  ON public.officer_alert_thresholds (officer_id);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_officer_alert_thresholds_updated_at
  ON public.officer_alert_thresholds (updated_at DESC);

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_officer_alert_thresholds_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_officer_alert_thresholds_updated_at ON public.officer_alert_thresholds;
CREATE TRIGGER trg_officer_alert_thresholds_updated_at
  BEFORE UPDATE ON public.officer_alert_thresholds
  FOR EACH ROW
  EXECUTE FUNCTION public.set_officer_alert_thresholds_updated_at();

-- Enable RLS
ALTER TABLE public.officer_alert_thresholds ENABLE ROW LEVEL SECURITY;

-- RLS: each officer can only read/write their own thresholds
DROP POLICY IF EXISTS "officers_manage_own_alert_thresholds" ON public.officer_alert_thresholds;
CREATE POLICY "officers_manage_own_alert_thresholds"
  ON public.officer_alert_thresholds
  FOR ALL
  TO authenticated
  USING (officer_id = auth.uid())
  WITH CHECK (officer_id = auth.uid());
