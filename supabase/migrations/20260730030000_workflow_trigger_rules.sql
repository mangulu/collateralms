-- ─── Workflow Trigger Rules ────────────────────────────────────────────────────
-- Allows admins to define conditions that auto-trigger workflow instances
-- without manual initiation.

-- Trigger event type enum
DROP TYPE IF EXISTS public.workflow_trigger_event CASCADE;
CREATE TYPE public.workflow_trigger_event AS ENUM (
  'collateral_status_change',
  'days_since_submission',
  'value_threshold',
  'ltv_breach',
  'days_overdue',
  'document_count_change'
);

-- Trigger operator enum
DROP TYPE IF EXISTS public.workflow_trigger_operator CASCADE;
CREATE TYPE public.workflow_trigger_operator AS ENUM (
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal'
);

-- Trigger rule status
DROP TYPE IF EXISTS public.workflow_trigger_status CASCADE;
CREATE TYPE public.workflow_trigger_status AS ENUM (
  'active',
  'inactive',
  'draft'
);

-- Main trigger rules table
CREATE TABLE IF NOT EXISTS public.workflow_trigger_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id UUID NOT NULL REFERENCES public.workflow_templates(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  trigger_status public.workflow_trigger_status DEFAULT 'active'::public.workflow_trigger_status,
  -- Logic operator between conditions: AND / OR
  condition_logic TEXT NOT NULL DEFAULT 'AND' CHECK (condition_logic IN ('AND', 'OR')),
  -- Reference type this rule applies to (e.g. 'collateral', 'loan')
  reference_type TEXT NOT NULL DEFAULT 'collateral',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  updated_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Individual conditions within a trigger rule
CREATE TABLE IF NOT EXISTS public.workflow_trigger_conditions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL REFERENCES public.workflow_trigger_rules(id) ON DELETE CASCADE,
  event_type public.workflow_trigger_event NOT NULL,
  operator public.workflow_trigger_operator NOT NULL DEFAULT 'equals'::public.workflow_trigger_operator,
  -- The value to compare against (stored as text, cast at evaluation time)
  condition_value TEXT NOT NULL DEFAULT '',
  -- Optional secondary value for range checks
  condition_value_to TEXT DEFAULT NULL,
  sort_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_workflow_trigger_rules_template_id
  ON public.workflow_trigger_rules(template_id);

CREATE INDEX IF NOT EXISTS idx_workflow_trigger_rules_status
  ON public.workflow_trigger_rules(trigger_status);

CREATE INDEX IF NOT EXISTS idx_workflow_trigger_conditions_rule_id
  ON public.workflow_trigger_conditions(rule_id);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION public.set_workflow_trigger_rules_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_workflow_trigger_rules_updated_at ON public.workflow_trigger_rules;
CREATE TRIGGER trg_workflow_trigger_rules_updated_at
  BEFORE UPDATE ON public.workflow_trigger_rules
  FOR EACH ROW EXECUTE FUNCTION public.set_workflow_trigger_rules_updated_at();

-- RLS
ALTER TABLE public.workflow_trigger_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workflow_trigger_conditions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_workflow_trigger_rules" ON public.workflow_trigger_rules;
CREATE POLICY "authenticated_manage_workflow_trigger_rules"
  ON public.workflow_trigger_rules
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_manage_workflow_trigger_conditions" ON public.workflow_trigger_conditions;
CREATE POLICY "authenticated_manage_workflow_trigger_conditions"
  ON public.workflow_trigger_conditions
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
