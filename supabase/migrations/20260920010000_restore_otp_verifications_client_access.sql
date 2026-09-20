-- Reverts 20260920000000_lock_down_otp_verifications_rls.sql.
--
-- The app's 2FA flow is going back to client-side OTP generation/verification
-- for now while development and testing continues (the server-authoritative
-- replacement needs SUPABASE_SERVICE_ROLE_KEY configured, which isn't set up
-- in this environment yet). That flow needs the browser to insert, select,
-- and update its own OTP row directly, so the policy that allows that is
-- restored here. Deleting the migration file that dropped it does not undo
-- the drop that already ran against this database -- it has to be re-created
-- explicitly.

DROP POLICY IF EXISTS "auth_users_otp" ON public.otp_verifications;
CREATE POLICY "auth_users_otp"
ON public.otp_verifications
FOR ALL TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
