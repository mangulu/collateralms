-- system_config's RLS policy hardcoded "role = 'system_admin'", while the
-- app itself gates the Settings UI on the granular settings.manage
-- permission (src/app/settings/page.tsx). A custom role granted
-- settings.manage without being system_admin would see the full settings
-- UI with no access-denied message, but every save would fail RLS --
-- confusing, and inconsistent with how every other admin-configurable
-- table in this app is gated. Align it to the real permission.

DROP POLICY IF EXISTS "admin_manage_system_config" ON public.system_config;
CREATE POLICY "admin_manage_system_config"
ON public.system_config
FOR ALL
TO authenticated
USING (public.user_has_permission('settings.manage'))
WITH CHECK (public.user_has_permission('settings.manage'));
