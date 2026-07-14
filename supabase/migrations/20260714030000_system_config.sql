-- System Configuration Table
-- Stores admin-configurable settings without code changes

CREATE TABLE IF NOT EXISTS public.system_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  config_key TEXT NOT NULL UNIQUE,
  config_value JSONB NOT NULL DEFAULT '{}',
  category TEXT NOT NULL DEFAULT 'general',
  label TEXT NOT NULL,
  description TEXT,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_system_config_key ON public.system_config(config_key);
CREATE INDEX IF NOT EXISTS idx_system_config_category ON public.system_config(category);

ALTER TABLE public.system_config ENABLE ROW LEVEL SECURITY;

-- Only system_admin can read/write system config
CREATE OR REPLACE FUNCTION public.is_system_admin_user()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_profiles
    WHERE id = auth.uid() AND role = 'system_admin'
  )
$$;

DROP POLICY IF EXISTS "admin_manage_system_config" ON public.system_config;
CREATE POLICY "admin_manage_system_config"
ON public.system_config
FOR ALL
TO authenticated
USING (public.is_system_admin_user())
WITH CHECK (public.is_system_admin_user());

-- Seed default config values
DO $$
BEGIN
  -- Bank Details
  INSERT INTO public.system_config (config_key, config_value, category, label, description)
  VALUES (
    'bank_details',
    jsonb_build_object(
      'bank_name', 'EXIM Bank Tanzania',
      'branch_name', 'Head Office',
      'branch_code', '001',
      'swift_code', 'EXTNTZTZ',
      'account_number', '',
      'sort_code', '',
      'contact_email', 'collateral@eximbank.co.tz',
      'contact_phone', '+255 22 211 0000',
      'physical_address', 'Ohio Street, Dar es Salaam, Tanzania'
    ),
    'bank',
    'Bank Details',
    'Bank identification and contact information used in reports and correspondence'
  ) ON CONFLICT (config_key) DO NOTHING;

  -- BRELA Registry URLs
  INSERT INTO public.system_config (config_key, config_value, category, label, description)
  VALUES (
    'brela_registry_urls',
    jsonb_build_object(
      'base_url', 'https://api.brela.go.tz/v1',
      'company_search_url', 'https://api.brela.go.tz/v1/companies/search',
      'certificate_verify_url', 'https://api.brela.go.tz/v1/certificates/verify',
      'charges_registry_url', 'https://api.brela.go.tz/v1/charges',
      'api_timeout_seconds', 30,
      'retry_attempts', 3,
      'webhook_url', ''
    ),
    'registry',
    'BRELA Registry URLs',
    'BRELA API endpoints and connection settings for company and charge registry lookups'
  ) ON CONFLICT (config_key) DO NOTHING;

  -- Notification Email Templates
  INSERT INTO public.system_config (config_key, config_value, category, label, description)
  VALUES (
    'email_templates',
    jsonb_build_object(
      'sender_name', 'CollateralMS – EXIM Bank',
      'sender_email', 'noreply@eximbank.co.tz',
      'reply_to_email', 'collateral@eximbank.co.tz',
      'perfection_due_subject', 'Collateral Perfection Due: {{collateral_id}}',
      'perfection_due_body', 'Dear {{officer_name}},\n\nThis is a reminder that collateral {{collateral_id}} ({{collateral_type}}) is due for perfection on {{due_date}}.\n\nPlease log in to CollateralMS to take action.\n\nRegards,\nCollateralMS System',
      'overdue_subject', 'OVERDUE: Collateral {{collateral_id}} Requires Immediate Action',
      'overdue_body', 'Dear {{officer_name}},\n\nCollateral {{collateral_id}} is now overdue for perfection. Immediate action is required.\n\nDue Date: {{due_date}}\nDays Overdue: {{days_overdue}}\n\nPlease log in to CollateralMS immediately.\n\nRegards,\nCollateralMS System',
      'approval_subject', 'Collateral {{collateral_id}} Approved',
      'approval_body', 'Dear {{officer_name}},\n\nCollateral {{collateral_id}} has been approved by {{approver_name}} on {{approval_date}}.\n\nRegards,\nCollateralMS System',
      'rejection_subject', 'Collateral {{collateral_id}} Requires Revision',
      'rejection_body', 'Dear {{officer_name}},\n\nCollateral {{collateral_id}} has been returned for revision.\n\nReason: {{rejection_reason}}\n\nPlease log in to CollateralMS to make the necessary corrections.\n\nRegards,\nCollateralMS System'
    ),
    'notifications',
    'Notification Email Templates',
    'Email subject lines and body templates for automated notifications. Use {{variable}} placeholders.'
  ) ON CONFLICT (config_key) DO NOTHING;

  -- Default Threshold Values
  INSERT INTO public.system_config (config_key, config_value, category, label, description)
  VALUES (
    'default_thresholds',
    jsonb_build_object(
      'perfection_due_days', 30,
      'perfection_warning_days', 7,
      'overdue_escalation_days', 14,
      'ltv_warning_percent', 75,
      'ltv_critical_percent', 90,
      'valuation_refresh_months', 12,
      'document_expiry_warning_days', 30,
      'fraud_score_alert_threshold', 70,
      'compliance_score_minimum', 80,
      'batch_release_max_items', 50
    ),
    'thresholds',
    'Default Threshold Values',
    'System-wide default thresholds for alerts, LTV ratios, and compliance scoring'
  ) ON CONFLICT (config_key) DO NOTHING;

  -- Document Retention Policies
  INSERT INTO public.system_config (config_key, config_value, category, label, description)
  VALUES (
    'document_retention',
    jsonb_build_object(
      'active_collateral_years', 7,
      'released_collateral_years', 10,
      'audit_log_years', 7,
      'perfection_records_years', 10,
      'correspondence_years', 5,
      'valuation_reports_years', 7,
      'legal_documents_years', 15,
      'auto_archive_enabled', true,
      'auto_delete_enabled', false,
      'archive_storage_path', 'archive/',
      'retention_review_months', 12
    ),
    'retention',
    'Document Retention Policies',
    'Data retention periods (in years) for different document categories per regulatory requirements'
  ) ON CONFLICT (config_key) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'System config seed failed: %', SQLERRM;
END $$;
