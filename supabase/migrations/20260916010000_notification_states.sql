-- ============================================================
-- Notification Read/Dismiss State
-- Notifications Hub aggregates real events from several existing
-- tables (compliance_breaches, user_tasks, audit_logs,
-- collateral_insurance) rather than storing notification rows
-- directly. This table just tracks, per user, whether one of those
-- derived notifications has been read or dismissed.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.notification_states (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  source_key    TEXT NOT NULL,
  is_read       BOOLEAN NOT NULL DEFAULT false,
  is_dismissed  BOOLEAN NOT NULL DEFAULT false,
  read_at       TIMESTAMPTZ,
  dismissed_at  TIMESTAMPTZ,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_notification_states_user_source
  ON public.notification_states(user_id, source_key);
CREATE INDEX IF NOT EXISTS idx_notification_states_user_id
  ON public.notification_states(user_id);

ALTER TABLE public.notification_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_notification_states" ON public.notification_states;
CREATE POLICY "auth_users_notification_states"
ON public.notification_states
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);
