-- ─── User Profile Permissions & Notification Preferences Enhancement ──────────
-- Adds user_permission_overrides table so Legal Officers and Managers can have
-- role-scoped permission overrides persisted in their profiles.
-- Also ensures notification_preferences RLS allows users to manage their own prefs.

-- ─── 1. user_permission_overrides table ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_permission_overrides (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  permission_key  TEXT NOT NULL,
  granted         BOOLEAN NOT NULL DEFAULT true,
  reason          TEXT,
  granted_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_permission_overrides_unique
  ON public.user_permission_overrides(user_id, permission_key);

CREATE INDEX IF NOT EXISTS idx_user_permission_overrides_user_id
  ON public.user_permission_overrides(user_id);

-- ─── 2. Enable RLS ────────────────────────────────────────────────────────────
ALTER TABLE public.user_permission_overrides ENABLE ROW LEVEL SECURITY;

-- ─── 3. RLS Policies ─────────────────────────────────────────────────────────

-- Users can view their own overrides
DROP POLICY IF EXISTS "users_view_own_permission_overrides" ON public.user_permission_overrides;
CREATE POLICY "users_view_own_permission_overrides"
  ON public.user_permission_overrides
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- System admins can manage all overrides (via auth metadata)
DROP POLICY IF EXISTS "admins_manage_permission_overrides" ON public.user_permission_overrides;
CREATE POLICY "admins_manage_permission_overrides"
  ON public.user_permission_overrides
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'system_admin'
             OR au.raw_app_meta_data->>'role' = 'system_admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM auth.users au
      WHERE au.id = auth.uid()
        AND (au.raw_user_meta_data->>'role' = 'system_admin'
             OR au.raw_app_meta_data->>'role' = 'system_admin')
    )
  );

-- ─── 4. Fix notification_preferences RLS (users manage their own) ─────────────
DROP POLICY IF EXISTS "users_manage_own_notification_preferences" ON public.notification_preferences;
CREATE POLICY "users_manage_own_notification_preferences"
  ON public.notification_preferences
  FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 5. updated_at trigger for user_permission_overrides ─────────────────────
CREATE OR REPLACE FUNCTION public.set_user_permission_overrides_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_permission_overrides_updated_at ON public.user_permission_overrides;
CREATE TRIGGER trg_user_permission_overrides_updated_at
  BEFORE UPDATE ON public.user_permission_overrides
  FOR EACH ROW
  EXECUTE FUNCTION public.set_user_permission_overrides_updated_at();
