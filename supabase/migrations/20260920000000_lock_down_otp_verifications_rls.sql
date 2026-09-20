-- otp_verifications previously allowed any authenticated user to insert,
-- select, and update their own rows directly from the browser
-- ("auth_users_otp" policy: user_id = auth.uid()). That's exactly what let
-- the old 2FA login flow generate the OTP code client-side, write the
-- plaintext code to this table itself, and then "verify" the code by
-- comparing it against a local JS variable -- an attacker with devtools
-- access to that page could read the code straight out of state, or the
-- row straight out of the table, without ever needing the SMS.
--
-- OTP generation and verification now happen exclusively in server-side API
-- routes (/api/auth/otp/request, /api/auth/otp/verify) using the
-- service-role key, which bypasses RLS entirely. No legitimate client-side
-- flow touches this table directly any more, so direct access is revoked
-- outright -- deny by default rather than trust every future caller to only
-- ever touch their own row correctly.

DROP POLICY IF EXISTS "auth_users_otp" ON public.otp_verifications;
