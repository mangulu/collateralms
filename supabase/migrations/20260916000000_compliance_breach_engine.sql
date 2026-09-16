-- ============================================================
-- Compliance Breach Engine
-- Real breach records produced by evaluating compliance_rules
-- against live collateral/obligor data, replacing the previous
-- fabricated Compliance Breach Log placeholder.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.compliance_breaches (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id               UUID NOT NULL REFERENCES public.compliance_rules(id) ON DELETE CASCADE,
  rule_name             TEXT NOT NULL,
  rule_type             TEXT NOT NULL,
  action                TEXT NOT NULL,
  severity              TEXT NOT NULL,
  field                 TEXT NOT NULL,
  operator              TEXT NOT NULL,
  threshold_value       TEXT NOT NULL,
  trigger_value         TEXT NOT NULL,
  collateral_record_id  UUID REFERENCES public.collateral_records(id) ON DELETE SET NULL,
  collateral_id         TEXT,
  collateral_ref        TEXT,
  collateral_type       TEXT,
  obligor_id            UUID REFERENCES public.obligors(id) ON DELETE SET NULL,
  obligor_name          TEXT,
  message               TEXT,
  status                TEXT NOT NULL DEFAULT 'Open' CHECK (status IN ('Open', 'Resolved')),
  breached_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at           TIMESTAMPTZ,
  resolved_by           UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_compliance_breaches_rule_id ON public.compliance_breaches(rule_id);
CREATE INDEX IF NOT EXISTS idx_compliance_breaches_collateral_id ON public.compliance_breaches(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_compliance_breaches_obligor_id ON public.compliance_breaches(obligor_id);
CREATE INDEX IF NOT EXISTS idx_compliance_breaches_status ON public.compliance_breaches(status);

-- Only one open breach per rule+collateral / rule+obligor at a time —
-- the engine re-checks and reuses the existing open row instead of
-- spamming duplicates on every run.
CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_breaches_open_collateral
  ON public.compliance_breaches(rule_id, collateral_record_id)
  WHERE status = 'Open' AND collateral_record_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_compliance_breaches_open_obligor
  ON public.compliance_breaches(rule_id, obligor_id)
  WHERE status = 'Open' AND obligor_id IS NOT NULL AND collateral_record_id IS NULL;

ALTER TABLE public.compliance_breaches ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_compliance_breaches" ON public.compliance_breaches;
CREATE POLICY "auth_users_compliance_breaches"
ON public.compliance_breaches
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
