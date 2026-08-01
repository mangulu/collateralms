-- ============================================================
-- Workflow Engine Migration
-- Configurable workflow templates + runtime instance engine
-- ============================================================

-- ─── ENUMS ────────────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.workflow_template_type CASCADE;
CREATE TYPE public.workflow_template_type AS ENUM (
  'perfection', 'release', 'valuation', 'substitution', 'document_approval', 'custom'
);

DROP TYPE IF EXISTS public.workflow_condition_operator CASCADE;
CREATE TYPE public.workflow_condition_operator AS ENUM (
  'equals', 'not_equals', 'greater_than', 'less_than', 'greater_than_or_equal',
  'less_than_or_equal', 'contains', 'not_contains', 'is_empty', 'is_not_empty'
);

DROP TYPE IF EXISTS public.workflow_condition_field CASCADE;
CREATE TYPE public.workflow_condition_field AS ENUM (
  'collateral_value', 'collateral_type', 'loan_amount', 'ltv_ratio',
  'obligor_tier', 'collateral_status', 'days_overdue', 'document_count'
);

DROP TYPE IF EXISTS public.workflow_instance_status CASCADE;
CREATE TYPE public.workflow_instance_status AS ENUM (
  'active', 'completed', 'cancelled', 'on_hold', 'escalated'
);

DROP TYPE IF EXISTS public.workflow_step_status CASCADE;
CREATE TYPE public.workflow_step_status AS ENUM (
  'pending', 'active', 'completed', 'skipped', 'rejected', 'escalated'
);

DROP TYPE IF EXISTS public.workflow_escalation_action CASCADE;
CREATE TYPE public.workflow_escalation_action AS ENUM (
  'notify_manager', 'reassign', 'auto_approve', 'auto_reject', 'escalate_to_role'
);

-- ─── WORKFLOW TEMPLATES ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  workflow_type public.workflow_template_type NOT NULL DEFAULT 'custom',
  is_active BOOLEAN NOT NULL DEFAULT true,
  is_builtin BOOLEAN NOT NULL DEFAULT false,
  version INTEGER NOT NULL DEFAULT 1,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── WORKFLOW STEPS ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  step_order INTEGER NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  is_optional BOOLEAN NOT NULL DEFAULT false,
  requires_all_actors BOOLEAN NOT NULL DEFAULT false,
  sla_hours INTEGER,
  escalation_action public.workflow_escalation_action,
  escalation_role TEXT,
  notify_on_enter BOOLEAN NOT NULL DEFAULT true,
  notify_on_complete BOOLEAN NOT NULL DEFAULT true,
  notify_roles TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, step_order)
);

-- ─── STEP ACTORS (role assignments per step) ──────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_step_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  actor_role TEXT NOT NULL,
  actor_label TEXT NOT NULL,
  can_approve BOOLEAN NOT NULL DEFAULT true,
  can_reject BOOLEAN NOT NULL DEFAULT true,
  can_return BOOLEAN NOT NULL DEFAULT true,
  can_comment BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── STEP CONDITIONS (visual rule builder) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_step_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE CASCADE,
  condition_group INTEGER NOT NULL DEFAULT 1,
  field public.workflow_condition_field NOT NULL,
  operator public.workflow_condition_operator NOT NULL,
  value TEXT NOT NULL,
  action TEXT NOT NULL DEFAULT 'skip_step',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── WORKFLOW INSTANCES (runtime) ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_instances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE RESTRICT,
  reference_type TEXT NOT NULL,
  reference_id UUID NOT NULL,
  reference_label TEXT,
  current_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  instance_status public.workflow_instance_status NOT NULL DEFAULT 'active',
  started_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  completed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INSTANCE STEP STATES ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_instance_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  step_id UUID NOT NULL REFERENCES public.workflow_steps(id) ON DELETE RESTRICT,
  step_status public.workflow_step_status NOT NULL DEFAULT 'pending',
  assigned_to UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  assigned_role TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  due_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── TRANSITION LOG (every state change) ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.workflow_transition_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  instance_step_id UUID REFERENCES public.workflow_instance_steps(id) ON DELETE SET NULL,
  from_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  to_step_id UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT,
  performed_by_role TEXT,
  comment TEXT,
  conditions_evaluated JSONB DEFAULT '[]'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── INDEXES ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workflow_templates_type ON public.workflow_templates(workflow_type);
CREATE INDEX IF NOT EXISTS idx_workflow_templates_active ON public.workflow_templates(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_steps_template ON public.workflow_steps(template_id, step_order);
CREATE INDEX IF NOT EXISTS idx_workflow_step_actors_step ON public.workflow_step_actors(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_step_conditions_step ON public.workflow_step_conditions(step_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_template ON public.workflow_instances(template_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_reference ON public.workflow_instances(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_workflow_instances_status ON public.workflow_instances(instance_status);
CREATE INDEX IF NOT EXISTS idx_workflow_instance_steps_instance ON public.workflow_instance_steps(instance_id);
CREATE INDEX IF NOT EXISTS idx_workflow_transition_log_instance ON public.workflow_transition_log(instance_id);

-- ─── UPDATED_AT TRIGGER ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.workflow_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_templates_updated_at ON public.workflow_templates;
CREATE TRIGGER trg_workflow_templates_updated_at
  BEFORE UPDATE ON public.workflow_templates
  FOR EACH ROW EXECUTE FUNCTION public.workflow_set_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_steps_updated_at ON public.workflow_steps;
CREATE TRIGGER trg_workflow_steps_updated_at
  BEFORE UPDATE ON public.workflow_steps
  FOR EACH ROW EXECUTE FUNCTION public.workflow_set_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_instances_updated_at ON public.workflow_instances;
CREATE TRIGGER trg_workflow_instances_updated_at
  BEFORE UPDATE ON public.workflow_instances
  FOR EACH ROW EXECUTE FUNCTION public.workflow_set_updated_at();

DROP TRIGGER IF EXISTS trg_workflow_instance_steps_updated_at ON public.workflow_instance_steps;
CREATE TRIGGER trg_workflow_instance_steps_updated_at
  BEFORE UPDATE ON public.workflow_instance_steps
  FOR EACH ROW EXECUTE FUNCTION public.workflow_set_updated_at();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE public.workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_step_conditions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_instance_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_transition_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_read_workflow_templates" ON public.workflow_templates;
CREATE POLICY "authenticated_read_workflow_templates" ON public.workflow_templates
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_workflow_templates" ON public.workflow_templates;
CREATE POLICY "authenticated_write_workflow_templates" ON public.workflow_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_workflow_steps" ON public.workflow_steps;
CREATE POLICY "authenticated_read_workflow_steps" ON public.workflow_steps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_workflow_steps" ON public.workflow_steps;
CREATE POLICY "authenticated_write_workflow_steps" ON public.workflow_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_workflow_step_actors" ON public.workflow_step_actors;
CREATE POLICY "authenticated_read_workflow_step_actors" ON public.workflow_step_actors
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_workflow_step_actors" ON public.workflow_step_actors;
CREATE POLICY "authenticated_write_workflow_step_actors" ON public.workflow_step_actors
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_workflow_step_conditions" ON public.workflow_step_conditions;
CREATE POLICY "authenticated_read_workflow_step_conditions" ON public.workflow_step_conditions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_workflow_step_conditions" ON public.workflow_step_conditions;
CREATE POLICY "authenticated_write_workflow_step_conditions" ON public.workflow_step_conditions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_workflow_instances" ON public.workflow_instances;
CREATE POLICY "authenticated_read_workflow_instances" ON public.workflow_instances
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_workflow_instances" ON public.workflow_instances;
CREATE POLICY "authenticated_write_workflow_instances" ON public.workflow_instances
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_workflow_instance_steps" ON public.workflow_instance_steps;
CREATE POLICY "authenticated_read_workflow_instance_steps" ON public.workflow_instance_steps
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_workflow_instance_steps" ON public.workflow_instance_steps;
CREATE POLICY "authenticated_write_workflow_instance_steps" ON public.workflow_instance_steps
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_read_workflow_transition_log" ON public.workflow_transition_log;
CREATE POLICY "authenticated_read_workflow_transition_log" ON public.workflow_transition_log
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "authenticated_write_workflow_transition_log" ON public.workflow_transition_log;
CREATE POLICY "authenticated_write_workflow_transition_log" ON public.workflow_transition_log
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── SEED: BUILT-IN TEMPLATES ─────────────────────────────────────────────────

DO $$
DECLARE
  v_admin_id UUID;
  -- template IDs
  t_perfection UUID := gen_random_uuid();
  t_release UUID := gen_random_uuid();
  t_valuation UUID := gen_random_uuid();
  t_substitution UUID := gen_random_uuid();
  t_doc_approval UUID := gen_random_uuid();
  -- step IDs - perfection
  s_p1 UUID := gen_random_uuid();
  s_p2 UUID := gen_random_uuid();
  s_p3 UUID := gen_random_uuid();
  s_p4 UUID := gen_random_uuid();
  -- step IDs - release
  s_r1 UUID := gen_random_uuid();
  s_r2 UUID := gen_random_uuid();
  s_r3 UUID := gen_random_uuid();
  -- step IDs - valuation
  s_v1 UUID := gen_random_uuid();
  s_v2 UUID := gen_random_uuid();
  s_v3 UUID := gen_random_uuid();
  -- step IDs - substitution
  s_sub1 UUID := gen_random_uuid();
  s_sub2 UUID := gen_random_uuid();
  s_sub3 UUID := gen_random_uuid();
  s_sub4 UUID := gen_random_uuid();
  -- step IDs - doc approval
  s_d1 UUID := gen_random_uuid();
  s_d2 UUID := gen_random_uuid();
  s_d3 UUID := gen_random_uuid();
BEGIN
  SELECT id INTO v_admin_id FROM public.user_profiles LIMIT 1;

  -- ── Perfection Template ──────────────────────────────────────────────────
  INSERT INTO public.workflow_templates (id, name, description, workflow_type, is_active, is_builtin, created_by)
  VALUES (t_perfection, 'Collateral Perfection', 'Standard collateral perfection process from submission to legal sign-off', 'perfection', true, true, v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_steps (id, template_id, step_order, name, description, sla_hours, escalation_action, escalation_role, notify_roles)
  VALUES
    (s_p1, t_perfection, 1, 'Draft & Submit', 'Credit officer prepares and submits the perfection request with required documents', 48, 'notify_manager', 'credit_manager', ARRAY['credit_officer']),
    (s_p2, t_perfection, 2, 'Legal Review', 'Legal officer reviews documents and verifies completeness', 72, 'escalate_to_role', 'senior_legal_officer', ARRAY['legal_officer', 'credit_officer']),
    (s_p3, t_perfection, 3, 'Senior Approval', 'Senior officer approves or rejects the perfection request', 48, 'notify_manager', 'head_of_legal', ARRAY['legal_officer', 'credit_officer', 'senior_officer']),
    (s_p4, t_perfection, 4, 'Perfection Sign-Off', 'Final sign-off and registration confirmation', 24, 'notify_manager', 'system_admin', ARRAY['credit_officer'])
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_actors (step_id, actor_role, actor_label, can_approve, can_reject, can_return)
  VALUES
    (s_p1, 'credit_officer', 'Credit Officer', true, false, false),
    (s_p2, 'legal_officer', 'Legal Officer', true, true, true),
    (s_p3, 'senior_legal_officer', 'Senior Legal Officer', true, true, true),
    (s_p3, 'system_admin', 'System Admin', true, true, true),
    (s_p4, 'legal_officer', 'Legal Officer', true, false, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_conditions (step_id, condition_group, field, operator, value, action)
  VALUES
    (s_p3, 1, 'collateral_value', 'greater_than', '500000000', 'require_step'),
    (s_p3, 2, 'collateral_type', 'equals', 'Land', 'require_step')
  ON CONFLICT (id) DO NOTHING;

  -- ── Release Template ─────────────────────────────────────────────────────
  INSERT INTO public.workflow_templates (id, name, description, workflow_type, is_active, is_builtin, created_by)
  VALUES (t_release, 'Collateral Release', 'Process for releasing collateral upon loan settlement or substitution', 'release', true, true, v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_steps (id, template_id, step_order, name, description, sla_hours, escalation_action, notify_roles)
  VALUES
    (s_r1, t_release, 1, 'Release Request', 'Credit officer submits release request with settlement confirmation', 24, 'notify_manager', ARRAY['credit_officer']),
    (s_r2, t_release, 2, 'Legal Clearance', 'Legal officer verifies no encumbrances and clears release', 48, 'escalate_to_role', ARRAY['legal_officer', 'credit_officer']),
    (s_r3, t_release, 3, 'Final Release Approval', 'Senior officer authorises the physical release of collateral', 24, 'notify_manager', ARRAY['credit_officer', 'legal_officer'])
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_actors (step_id, actor_role, actor_label, can_approve, can_reject, can_return)
  VALUES
    (s_r1, 'credit_officer', 'Credit Officer', true, false, false),
    (s_r2, 'legal_officer', 'Legal Officer', true, true, true),
    (s_r3, 'senior_legal_officer', 'Senior Legal Officer', true, true, false),
    (s_r3, 'system_admin', 'System Admin', true, true, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_conditions (step_id, condition_group, field, operator, value, action)
  VALUES
    (s_r3, 1, 'loan_amount', 'greater_than', '1000000000', 'require_step'),
    (s_r3, 2, 'collateral_value', 'greater_than', '750000000', 'require_step')
  ON CONFLICT (id) DO NOTHING;

  -- ── Valuation Template ───────────────────────────────────────────────────
  INSERT INTO public.workflow_templates (id, name, description, workflow_type, is_active, is_builtin, created_by)
  VALUES (t_valuation, 'Collateral Valuation', 'Periodic and triggered collateral valuation review process', 'valuation', true, true, v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_steps (id, template_id, step_order, name, description, sla_hours, escalation_action, notify_roles)
  VALUES
    (s_v1, t_valuation, 1, 'Valuation Request', 'Initiate valuation request and assign external valuer', 48, 'notify_manager', ARRAY['credit_officer']),
    (s_v2, t_valuation, 2, 'Valuation Report Submission', 'External valuer submits valuation report for review', 120, 'escalate_to_role', ARRAY['credit_officer', 'legal_officer']),
    (s_v3, t_valuation, 3, 'Valuation Approval', 'Credit officer reviews and approves the valuation report', 48, 'notify_manager', ARRAY['credit_officer', 'system_admin'])
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_actors (step_id, actor_role, actor_label, can_approve, can_reject, can_return)
  VALUES
    (s_v1, 'credit_officer', 'Credit Officer', true, false, false),
    (s_v2, 'credit_officer', 'Credit Officer', true, true, true),
    (s_v3, 'credit_officer', 'Credit Officer', true, true, true),
    (s_v3, 'system_admin', 'System Admin', true, true, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_conditions (step_id, condition_group, field, operator, value, action)
  VALUES
    (s_v3, 1, 'ltv_ratio', 'greater_than', '80', 'require_step'),
    (s_v3, 2, 'days_overdue', 'greater_than', '30', 'require_step')
  ON CONFLICT (id) DO NOTHING;

  -- ── Substitution Template ────────────────────────────────────────────────
  INSERT INTO public.workflow_templates (id, name, description, workflow_type, is_active, is_builtin, created_by)
  VALUES (t_substitution, 'Collateral Substitution', 'Process for substituting one collateral with another of equivalent value', 'substitution', true, true, v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_steps (id, template_id, step_order, name, description, sla_hours, escalation_action, notify_roles)
  VALUES
    (s_sub1, t_substitution, 1, 'Substitution Request', 'Credit officer submits substitution request with proposed replacement', 48, 'notify_manager', ARRAY['credit_officer']),
    (s_sub2, t_substitution, 2, 'Valuation Comparison', 'Verify new collateral value meets or exceeds original', 72, 'notify_manager', ARRAY['credit_officer', 'legal_officer']),
    (s_sub3, t_substitution, 3, 'Legal Review', 'Legal officer reviews title and encumbrances on replacement collateral', 72, 'escalate_to_role', ARRAY['legal_officer', 'credit_officer']),
    (s_sub4, t_substitution, 4, 'Final Approval', 'Senior officer approves the substitution', 48, 'notify_manager', ARRAY['credit_officer', 'legal_officer'])
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_actors (step_id, actor_role, actor_label, can_approve, can_reject, can_return)
  VALUES
    (s_sub1, 'credit_officer', 'Credit Officer', true, false, false),
    (s_sub2, 'credit_officer', 'Credit Officer', true, true, true),
    (s_sub3, 'legal_officer', 'Legal Officer', true, true, true),
    (s_sub4, 'senior_legal_officer', 'Senior Legal Officer', true, true, false),
    (s_sub4, 'system_admin', 'System Admin', true, true, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_conditions (step_id, condition_group, field, operator, value, action)
  VALUES
    (s_sub2, 1, 'collateral_value', 'less_than', '100000000', 'skip_step'),
    (s_sub4, 1, 'collateral_value', 'greater_than', '500000000', 'require_step')
  ON CONFLICT (id) DO NOTHING;

  -- ── Document Approval Template ───────────────────────────────────────────
  INSERT INTO public.workflow_templates (id, name, description, workflow_type, is_active, is_builtin, created_by)
  VALUES (t_doc_approval, 'Document Approval', 'Review and approval workflow for collateral-related documents', 'document_approval', true, true, v_admin_id)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_steps (id, template_id, step_order, name, description, sla_hours, escalation_action, notify_roles)
  VALUES
    (s_d1, t_doc_approval, 1, 'Document Upload', 'Upload document and submit for review', 24, 'notify_manager', ARRAY['credit_officer']),
    (s_d2, t_doc_approval, 2, 'Document Review', 'Legal officer reviews document for completeness and accuracy', 48, 'escalate_to_role', ARRAY['legal_officer', 'credit_officer']),
    (s_d3, t_doc_approval, 3, 'Document Approval', 'Final approval and filing of the document', 24, 'notify_manager', ARRAY['credit_officer', 'legal_officer'])
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_actors (step_id, actor_role, actor_label, can_approve, can_reject, can_return)
  VALUES
    (s_d1, 'credit_officer', 'Credit Officer', true, false, false),
    (s_d2, 'legal_officer', 'Legal Officer', true, true, true),
    (s_d3, 'legal_officer', 'Legal Officer', true, true, false),
    (s_d3, 'system_admin', 'System Admin', true, true, false)
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.workflow_step_conditions (step_id, condition_group, field, operator, value, action)
  VALUES
    (s_d2, 1, 'document_count', 'less_than', '3', 'require_step')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Workflow seed failed: %', SQLERRM;
END $$;
