-- ============================================================
-- CollateralMS — Role-Based RLS Policies
-- Enforces row-level permissions for Legal Officer, Credit Officer, System Admin
-- ============================================================

-- ─── Helper Functions ──────────────────────────────────────────────────────────

-- get_user_role: returns the role of the currently authenticated user
-- Uses auth.users metadata to avoid recursion on user_profiles
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT COALESCE(
    (SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1),
    ''
  );
$$;

-- is_system_admin: true if current user is system_admin
CREATE OR REPLACE FUNCTION public.is_system_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_user_role() = 'system_admin';
$$;

-- is_legal_officer: true if current user is legal_officer or system_admin
CREATE OR REPLACE FUNCTION public.is_legal_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_user_role() IN ('legal_officer', 'system_admin');
$$;

-- can_write_collateral: credit_officer, legal_officer, system_admin can create/edit
CREATE OR REPLACE FUNCTION public.can_write_collateral()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_user_role() IN ('credit_officer', 'legal_officer', 'system_admin');
$$;

-- can_submit_perfection: credit_officer and system_admin can submit
CREATE OR REPLACE FUNCTION public.can_submit_perfection()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_user_role() IN ('credit_officer', 'system_admin');
$$;

-- can_review_perfection: legal_officer and system_admin can approve/reject
CREATE OR REPLACE FUNCTION public.can_review_perfection()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT public.get_user_role() IN ('legal_officer', 'system_admin');
$$;

-- ─── collateral_records: Role-Based RLS ────────────────────────────────────────

-- All authenticated users can read collateral records
DROP POLICY IF EXISTS "authenticated_read_collateral" ON public.collateral_records;
CREATE POLICY "authenticated_read_collateral"
ON public.collateral_records
FOR SELECT
TO authenticated
USING (true);

-- Only credit_officer, legal_officer, system_admin can insert
DROP POLICY IF EXISTS "authenticated_insert_collateral" ON public.collateral_records;
CREATE POLICY "authenticated_insert_collateral"
ON public.collateral_records
FOR INSERT
TO authenticated
WITH CHECK (public.can_write_collateral());

-- Only credit_officer, legal_officer, system_admin can update
DROP POLICY IF EXISTS "authenticated_update_collateral" ON public.collateral_records;
CREATE POLICY "authenticated_update_collateral"
ON public.collateral_records
FOR UPDATE
TO authenticated
USING (public.can_write_collateral())
WITH CHECK (public.can_write_collateral());

-- Only legal_officer and system_admin can delete
DROP POLICY IF EXISTS "privileged_delete_collateral" ON public.collateral_records;
CREATE POLICY "privileged_delete_collateral"
ON public.collateral_records
FOR DELETE
TO authenticated
USING (public.is_legal_or_admin());

-- ─── perfection_requests: Role-Based RLS ───────────────────────────────────────

-- All authenticated users can read perfection requests
DROP POLICY IF EXISTS "authenticated_read_perfection_requests" ON public.perfection_requests;
CREATE POLICY "authenticated_read_perfection_requests"
ON public.perfection_requests
FOR SELECT
TO authenticated
USING (true);

-- Only credit_officer and system_admin can submit (insert) perfection requests
DROP POLICY IF EXISTS "authenticated_insert_perfection_requests" ON public.perfection_requests;
CREATE POLICY "authenticated_insert_perfection_requests"
ON public.perfection_requests
FOR INSERT
TO authenticated
WITH CHECK (public.can_submit_perfection());

-- credit_officer can update their own submissions; legal_officer/admin can update any (for review)
DROP POLICY IF EXISTS "authenticated_update_perfection_requests" ON public.perfection_requests;
CREATE POLICY "authenticated_update_perfection_requests"
ON public.perfection_requests
FOR UPDATE
TO authenticated
USING (
  public.can_review_perfection()
  OR (public.get_user_role() = 'credit_officer' AND submitted_by = auth.uid())
)
WITH CHECK (
  public.can_review_perfection()
  OR (public.get_user_role() = 'credit_officer' AND submitted_by = auth.uid())
);

-- Only legal_officer and system_admin can delete perfection requests
DROP POLICY IF EXISTS "privileged_delete_perfection_requests" ON public.perfection_requests;
CREATE POLICY "privileged_delete_perfection_requests"
ON public.perfection_requests
FOR DELETE
TO authenticated
USING (public.is_legal_or_admin());

-- ─── perfection_comments: Role-Based RLS ───────────────────────────────────────

-- All authenticated users can read comments
DROP POLICY IF EXISTS "authenticated_read_perfection_comments" ON public.perfection_comments;
CREATE POLICY "authenticated_read_perfection_comments"
ON public.perfection_comments
FOR SELECT
TO authenticated
USING (true);

-- All roles with collateral access can add comments
DROP POLICY IF EXISTS "authenticated_insert_perfection_comments" ON public.perfection_comments;
CREATE POLICY "authenticated_insert_perfection_comments"
ON public.perfection_comments
FOR INSERT
TO authenticated
WITH CHECK (public.can_write_collateral());

-- Only the comment author or admin can delete comments
DROP POLICY IF EXISTS "author_delete_perfection_comments" ON public.perfection_comments;
CREATE POLICY "author_delete_perfection_comments"
ON public.perfection_comments
FOR DELETE
TO authenticated
USING (performed_by = auth.uid() OR public.is_system_admin());

-- ─── collateral_documents: Role-Based RLS ──────────────────────────────────────

-- All authenticated users can read documents
DROP POLICY IF EXISTS "authenticated_read_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_read_collateral_documents"
ON public.collateral_documents
FOR SELECT
TO authenticated
USING (true);

-- credit_officer, legal_officer, system_admin can upload documents
DROP POLICY IF EXISTS "authenticated_insert_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_insert_collateral_documents"
ON public.collateral_documents
FOR INSERT
TO authenticated
WITH CHECK (public.can_write_collateral());

-- Only uploader, legal_officer, or system_admin can delete documents
DROP POLICY IF EXISTS "authenticated_delete_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_delete_collateral_documents"
ON public.collateral_documents
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.is_legal_or_admin()
);

-- ─── audit_logs: Role-Based RLS ────────────────────────────────────────────────

-- All authenticated users can read audit logs
DROP POLICY IF EXISTS "authenticated_read_audit_logs" ON public.audit_logs;
CREATE POLICY "authenticated_read_audit_logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

-- All authenticated users can insert audit log entries (system writes)
DROP POLICY IF EXISTS "authenticated_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "authenticated_insert_audit_logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Only system_admin can delete audit logs (immutability)
DROP POLICY IF EXISTS "admin_delete_audit_logs" ON public.audit_logs;
CREATE POLICY "admin_delete_audit_logs"
ON public.audit_logs
FOR DELETE
TO authenticated
USING (public.is_system_admin());

-- ─── compliance_rules: Role-Based RLS ──────────────────────────────────────────

ALTER TABLE public.compliance_rules ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read compliance rules
DROP POLICY IF EXISTS "authenticated_read_compliance_rules" ON public.compliance_rules;
CREATE POLICY "authenticated_read_compliance_rules"
ON public.compliance_rules
FOR SELECT
TO authenticated
USING (true);

-- Only legal_officer and system_admin can manage compliance rules
DROP POLICY IF EXISTS "privileged_insert_compliance_rules" ON public.compliance_rules;
CREATE POLICY "privileged_insert_compliance_rules"
ON public.compliance_rules
FOR INSERT
TO authenticated
WITH CHECK (public.is_legal_or_admin());

DROP POLICY IF EXISTS "privileged_update_compliance_rules" ON public.compliance_rules;
CREATE POLICY "privileged_update_compliance_rules"
ON public.compliance_rules
FOR UPDATE
TO authenticated
USING (public.is_legal_or_admin())
WITH CHECK (public.is_legal_or_admin());

DROP POLICY IF EXISTS "privileged_delete_compliance_rules" ON public.compliance_rules;
CREATE POLICY "privileged_delete_compliance_rules"
ON public.compliance_rules
FOR DELETE
TO authenticated
USING (public.is_legal_or_admin());

-- ─── fraud_alerts: Role-Based RLS ──────────────────────────────────────────────

ALTER TABLE public.fraud_alerts ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read fraud alerts
DROP POLICY IF EXISTS "authenticated_read_fraud_alerts" ON public.fraud_alerts;
CREATE POLICY "authenticated_read_fraud_alerts"
ON public.fraud_alerts
FOR SELECT
TO authenticated
USING (true);

-- Only system_admin and legal_officer can manage fraud alerts
DROP POLICY IF EXISTS "privileged_manage_fraud_alerts" ON public.fraud_alerts;
CREATE POLICY "privileged_manage_fraud_alerts"
ON public.fraud_alerts
FOR ALL
TO authenticated
USING (public.is_legal_or_admin())
WITH CHECK (public.is_legal_or_admin());

-- ─── document_type_settings: Role-Based RLS ────────────────────────────────────

-- All authenticated users can read document type settings
DROP POLICY IF EXISTS "authenticated_read_document_type_settings" ON public.document_type_settings;
CREATE POLICY "authenticated_read_document_type_settings"
ON public.document_type_settings
FOR SELECT
TO authenticated
USING (true);

-- Only system_admin can manage document type settings
DROP POLICY IF EXISTS "admin_manage_document_type_settings" ON public.document_type_settings;
CREATE POLICY "admin_manage_document_type_settings"
ON public.document_type_settings
FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- ─── user_profiles: Role-Based RLS ─────────────────────────────────────────────

-- Users can manage their own profile
DROP POLICY IF EXISTS "users_manage_own_profile" ON public.user_profiles;
CREATE POLICY "users_manage_own_profile"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- All authenticated users can read other profiles (for officer assignment display)
DROP POLICY IF EXISTS "users_read_all_profiles" ON public.user_profiles;
CREATE POLICY "users_read_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- Only system_admin can insert/update/delete other users' profiles
DROP POLICY IF EXISTS "admin_manage_all_profiles" ON public.user_profiles;
CREATE POLICY "admin_manage_all_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- ─── email_provider_config: Admin-only RLS ─────────────────────────────────────

-- Only system_admin can read/write email provider config
DROP POLICY IF EXISTS "admin_manage_email_provider_config" ON public.email_provider_config;
CREATE POLICY "admin_manage_email_provider_config"
ON public.email_provider_config
FOR ALL
TO authenticated
USING (public.is_system_admin())
WITH CHECK (public.is_system_admin());

-- ─── sms_alerts: Role-Based RLS ────────────────────────────────────────────────

ALTER TABLE public.sms_alerts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_sms_alerts" ON public.sms_alerts;
CREATE POLICY "authenticated_read_sms_alerts"
ON public.sms_alerts
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_sms_alerts" ON public.sms_alerts;
CREATE POLICY "authenticated_insert_sms_alerts"
ON public.sms_alerts
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "admin_delete_sms_alerts" ON public.sms_alerts;
CREATE POLICY "admin_delete_sms_alerts"
ON public.sms_alerts
FOR DELETE
TO authenticated
USING (public.is_system_admin());

-- ─── security_pockets: Role-Based RLS ──────────────────────────────────────────

-- All authenticated users can read security pockets
DROP POLICY IF EXISTS "authenticated_read_security_pockets" ON public.security_pockets;
CREATE POLICY "authenticated_read_security_pockets"
ON public.security_pockets
FOR SELECT
TO authenticated
USING (true);

-- Only legal_officer and system_admin can manage security pockets
DROP POLICY IF EXISTS "privileged_manage_security_pockets" ON public.security_pockets;
CREATE POLICY "privileged_manage_security_pockets"
ON public.security_pockets
FOR ALL
TO authenticated
USING (public.is_legal_or_admin())
WITH CHECK (public.is_legal_or_admin());

-- ─── pocket_checkout_log: Role-Based RLS ───────────────────────────────────────

-- All authenticated users can read checkout logs
DROP POLICY IF EXISTS "authenticated_read_pocket_checkout_log" ON public.pocket_checkout_log;
CREATE POLICY "authenticated_read_pocket_checkout_log"
ON public.pocket_checkout_log
FOR SELECT
TO authenticated
USING (true);

-- Only legal_officer and system_admin can insert checkout log entries
DROP POLICY IF EXISTS "privileged_insert_pocket_checkout_log" ON public.pocket_checkout_log;
CREATE POLICY "privileged_insert_pocket_checkout_log"
ON public.pocket_checkout_log
FOR INSERT
TO authenticated
WITH CHECK (public.is_legal_or_admin());
