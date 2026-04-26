-- ============================================================
-- CollateralMS — Notification Preferences Migration
-- ============================================================

-- 1. TABLE

CREATE TABLE IF NOT EXISTS public.notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,

  -- Alert Types
  alert_overdue_collateral BOOLEAN NOT NULL DEFAULT true,
  alert_perfection_deadline BOOLEAN NOT NULL DEFAULT true,
  alert_workflow_status_change BOOLEAN NOT NULL DEFAULT true,
  alert_document_expiry BOOLEAN NOT NULL DEFAULT true,
  alert_new_collateral_added BOOLEAN NOT NULL DEFAULT false,
  alert_audit_log_events BOOLEAN NOT NULL DEFAULT false,

  -- Frequency
  notification_frequency TEXT NOT NULL DEFAULT 'realtime' CHECK (notification_frequency IN ('realtime', 'hourly', 'daily', 'weekly')),

  -- Email Preferences
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  email_overdue_collateral BOOLEAN NOT NULL DEFAULT true,
  email_perfection_deadline BOOLEAN NOT NULL DEFAULT true,
  email_workflow_status_change BOOLEAN NOT NULL DEFAULT true,
  email_document_expiry BOOLEAN NOT NULL DEFAULT true,
  email_digest_enabled BOOLEAN NOT NULL DEFAULT false,
  email_digest_frequency TEXT NOT NULL DEFAULT 'daily' CHECK (email_digest_frequency IN ('daily', 'weekly')),

  -- In-App Notifications
  inapp_enabled BOOLEAN NOT NULL DEFAULT true,
  inapp_overdue_collateral BOOLEAN NOT NULL DEFAULT true,
  inapp_perfection_deadline BOOLEAN NOT NULL DEFAULT true,
  inapp_workflow_status_change BOOLEAN NOT NULL DEFAULT true,
  inapp_document_expiry BOOLEAN NOT NULL DEFAULT true,
  inapp_sound_enabled BOOLEAN NOT NULL DEFAULT false,

  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT notification_preferences_user_id_unique UNIQUE (user_id)
);

-- 2. INDEXES

CREATE INDEX IF NOT EXISTS idx_notification_preferences_user_id ON public.notification_preferences(user_id);

-- 3. UPDATED_AT TRIGGER FUNCTION

CREATE OR REPLACE FUNCTION public.update_notification_preferences_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- 4. ENABLE RLS

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

-- 5. RLS POLICIES

DROP POLICY IF EXISTS "users_manage_own_notification_preferences" ON public.notification_preferences;
CREATE POLICY "users_manage_own_notification_preferences"
ON public.notification_preferences
FOR ALL
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- 6. TRIGGER

DROP TRIGGER IF EXISTS update_notification_preferences_updated_at ON public.notification_preferences;
CREATE TRIGGER update_notification_preferences_updated_at
  BEFORE UPDATE ON public.notification_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.update_notification_preferences_updated_at();

-- 7. SEED DEFAULT PREFERENCES FOR EXISTING USERS

DO $$
DECLARE
  rec RECORD;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    FOR rec IN SELECT id FROM public.user_profiles LOOP
      INSERT INTO public.notification_preferences (user_id)
      VALUES (rec.id)
      ON CONFLICT (user_id) DO NOTHING;
    END LOOP;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed notification_preferences failed: %', SQLERRM;
END $$;
