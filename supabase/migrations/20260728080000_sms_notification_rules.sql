-- ─── SMS Notification Rules ──────────────────────────────────────────────────
-- Stores per-event SMS notification rules: which officers get SMS for which events

CREATE TABLE IF NOT EXISTS public.sms_notification_rules (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type      TEXT NOT NULL,
  event_label     TEXT NOT NULL,
  description     TEXT,
  is_enabled      BOOLEAN NOT NULL DEFAULT true,
  recipients      JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- recipients: [{name, phone, role}]
  min_severity    TEXT NOT NULL DEFAULT 'all',
  -- 'all' | 'critical' | 'high'
  created_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_notification_rules_event_type
  ON public.sms_notification_rules (event_type);

CREATE INDEX IF NOT EXISTS idx_sms_notification_rules_enabled
  ON public.sms_notification_rules (is_enabled);

ALTER TABLE public.sms_notification_rules ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sms_notification_rules_all_authenticated" ON public.sms_notification_rules;
CREATE POLICY "sms_notification_rules_all_authenticated"
  ON public.sms_notification_rules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- ─── Updated-at trigger ───────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.set_sms_notification_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sms_notification_rules_updated_at ON public.sms_notification_rules;
CREATE TRIGGER trg_sms_notification_rules_updated_at
  BEFORE UPDATE ON public.sms_notification_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_sms_notification_rules_updated_at();

-- ─── Seed default rules for the three critical event types ───────────────────
INSERT INTO public.sms_notification_rules (event_type, event_label, description, is_enabled, recipients, min_severity)
VALUES
  (
    'COVENANT_BREACH',
    'Covenant Breach',
    'Sent when a loan covenant is automatically flagged as Breached (current value falls below threshold).',
    true,
    '[]'::jsonb,
    'all'
  ),
  (
    'OVERDUE_ACTION',
    'Overdue Action',
    'Sent when a collateral valuation or perfection task becomes overdue (scheduled date has passed without completion).',
    true,
    '[]'::jsonb,
    'all'
  ),
  (
    'STATUS_CHANGE',
    'Collateral Status Change',
    'Sent when a collateral record status changes (e.g. Active → Released, Pending → Active).',
    false,
    '[]'::jsonb,
    'critical'
  )
ON CONFLICT (event_type) DO NOTHING;
