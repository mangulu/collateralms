-- The "users_manage_own_profile" RLS policy (USING/WITH CHECK id = auth.uid())
-- only checks row ownership, not which columns are being changed. Since
-- `role` and `is_active` are ordinary columns on user_profiles, any
-- authenticated user could run `update({ role: 'system_admin' })` (or
-- reactivate their own deactivated account) against their own row and RLS
-- would allow it -- independent of any UI-level restriction. The app's own
-- User Management screen had the same gap (fixed separately in app code),
-- but that's not a substitute for enforcing this at the database layer.
--
-- A BEFORE UPDATE trigger blocks it outright: nobody may change their own
-- role or is_active, regardless of which RLS policy let the UPDATE through.
-- This does not affect an admin editing a DIFFERENT user's row (NEW.id
-- would not equal auth.uid() in that case), nor service-role/server-side
-- operations (auth.uid() is NULL outside a user request context).

CREATE OR REPLACE FUNCTION public.prevent_self_role_escalation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NEW.id = auth.uid() THEN
    IF NEW.role IS DISTINCT FROM OLD.role THEN
      RAISE EXCEPTION 'You cannot change your own role. Ask another administrator to do this.';
    END IF;
    IF NEW.is_active IS DISTINCT FROM OLD.is_active THEN
      RAISE EXCEPTION 'You cannot activate or deactivate your own account.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_self_role_escalation ON public.user_profiles;
CREATE TRIGGER trg_prevent_self_role_escalation
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_self_role_escalation();
