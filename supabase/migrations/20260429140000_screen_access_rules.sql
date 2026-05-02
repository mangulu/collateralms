-- ─── Screen Access Rules ──────────────────────────────────────────────────────
-- Stores per-role, per-screen, per-action access flags.
-- screen_id  : matches the id field in ScreenDefinition (e.g. 'collateral_registry')
-- role_name  : matches roles.name
-- action_key : e.g. 'view', 'create', 'edit', 'delete', 'export', 'upload', 'manage', 'approve'
-- is_allowed : true = access granted, false = access denied

CREATE TABLE IF NOT EXISTS public.screen_access_rules (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  screen_id   text NOT NULL,
  role_name   text NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  action_key  text NOT NULL,
  is_allowed  boolean NOT NULL DEFAULT false,
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT screen_access_rules_unique UNIQUE (screen_id, role_name, action_key)
);

-- Index for fast role lookups
CREATE INDEX IF NOT EXISTS idx_screen_access_role ON public.screen_access_rules(role_name);
CREATE INDEX IF NOT EXISTS idx_screen_access_screen ON public.screen_access_rules(screen_id);

-- RLS
ALTER TABLE public.screen_access_rules ENABLE ROW LEVEL SECURITY;

-- System admins can read and write; others can only read
CREATE POLICY "screen_access_select" ON public.screen_access_rules
  FOR SELECT USING (true);

CREATE POLICY "screen_access_insert" ON public.screen_access_rules
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "screen_access_update" ON public.screen_access_rules
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

CREATE POLICY "screen_access_delete" ON public.screen_access_rules
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.user_profiles
      WHERE id = auth.uid() AND role = 'system_admin'
    )
  );

-- Seed default access rules for built-in roles
-- system_admin gets full access to everything
INSERT INTO public.screen_access_rules (screen_id, role_name, action_key, is_allowed)
SELECT s.screen_id, 'system_admin', s.action_key, true
FROM (VALUES
  ('dashboard','view'), ('dashboard','export'),
  ('portfolio_monitoring','view'), ('portfolio_monitoring','export'),
  ('collateral_registry','view'), ('collateral_registry','create'), ('collateral_registry','edit'), ('collateral_registry','delete'), ('collateral_registry','export'),
  ('approval_workflow','view'), ('approval_workflow','approve'), ('approval_workflow','edit'),
  ('collateral_documents','view'), ('collateral_documents','upload'), ('collateral_documents','delete'),
  ('batch_release','view'), ('batch_release','manage'),
  ('bulk_upload','view'), ('bulk_upload','upload'),
  ('scheduled_jobs','view'), ('scheduled_jobs','manage'),
  ('fraud_prevention','view'), ('fraud_prevention','manage'),
  ('risk_assessment','view'), ('risk_assessment','export'),
  ('fast_track','view'), ('fast_track','manage'),
  ('geomapping','view'),
  ('compliance_rules','view'), ('compliance_rules','create'), ('compliance_rules','edit'), ('compliance_rules','delete'),
  ('notifications_hub','view'), ('notifications_hub','manage'),
  ('alerts_inbox','view'), ('alerts_inbox','manage'),
  ('alerts_delivery','view'), ('alerts_delivery','manage'),
  ('audit_trail','view'), ('audit_trail','export'),
  ('audit_log','view'), ('audit_log','export'),
  ('audit_report','view'), ('audit_report','export'),
  ('reports','view'), ('reports','export'),
  ('export','view'), ('export','manage'),
  ('user_management','view'), ('user_management','manage'),
  ('settings','view'), ('settings','manage'),
  ('admin','view'), ('admin','manage')
) AS s(screen_id, action_key)
ON CONFLICT (screen_id, role_name, action_key) DO NOTHING;

-- credit_officer: view collateral, documents, reports; create/edit collateral; submit workflow
INSERT INTO public.screen_access_rules (screen_id, role_name, action_key, is_allowed)
SELECT s.screen_id, 'credit_officer', s.action_key, true
FROM (VALUES
  ('dashboard','view'),
  ('portfolio_monitoring','view'),
  ('collateral_registry','view'), ('collateral_registry','create'), ('collateral_registry','edit'), ('collateral_registry','export'),
  ('approval_workflow','view'), ('approval_workflow','edit'),
  ('collateral_documents','view'), ('collateral_documents','upload'),
  ('bulk_upload','view'), ('bulk_upload','upload'),
  ('risk_assessment','view'),
  ('fast_track','view'),
  ('geomapping','view'),
  ('notifications_hub','view'),
  ('alerts_inbox','view'),
  ('audit_trail','view'),
  ('reports','view'), ('reports','export')
) AS s(screen_id, action_key)
ON CONFLICT (screen_id, role_name, action_key) DO NOTHING;

-- legal_officer: view + approve workflow, documents, compliance, reports
INSERT INTO public.screen_access_rules (screen_id, role_name, action_key, is_allowed)
SELECT s.screen_id, 'legal_officer', s.action_key, true
FROM (VALUES
  ('dashboard','view'),
  ('portfolio_monitoring','view'),
  ('collateral_registry','view'), ('collateral_registry','export'),
  ('approval_workflow','view'), ('approval_workflow','approve'),
  ('collateral_documents','view'), ('collateral_documents','upload'),
  ('compliance_rules','view'),
  ('notifications_hub','view'),
  ('alerts_inbox','view'),
  ('audit_trail','view'), ('audit_trail','export'),
  ('audit_report','view'), ('audit_report','export'),
  ('reports','view'), ('reports','export')
) AS s(screen_id, action_key)
ON CONFLICT (screen_id, role_name, action_key) DO NOTHING;
