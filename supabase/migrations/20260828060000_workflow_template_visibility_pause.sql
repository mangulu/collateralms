-- Migration: Add is_visible to workflow_templates + pause/resume instance logic
-- Timestamp: 20260828060000

-- 1. Add is_visible column to workflow_templates
ALTER TABLE public.workflow_templates
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT true;

-- 2. Index for fast filtering in end-user pickers
CREATE INDEX IF NOT EXISTS idx_workflow_templates_is_visible
ON public.workflow_templates (is_visible);

-- 3. Index for fast pause/resume queries on instances
CREATE INDEX IF NOT EXISTS idx_workflow_instances_template_status
ON public.workflow_instances (template_id, instance_status);

-- 4. Function: pause all active instances of a template (called when is_active set to false)
CREATE OR REPLACE FUNCTION public.pause_instances_for_template(p_template_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.workflow_instances
  SET
    instance_status = 'on_hold',
    metadata = jsonb_set(
      COALESCE(metadata, '{}'::jsonb),
      '{paused_by_template}',
      'true'::jsonb
    )
  WHERE
    template_id = p_template_id
    AND instance_status = 'active';

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;

-- 5. Function: resume instances that were paused by template deactivation
CREATE OR REPLACE FUNCTION public.resume_instances_for_template(p_template_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  affected INTEGER;
BEGIN
  UPDATE public.workflow_instances
  SET
    instance_status = 'active',
    metadata = metadata - 'paused_by_template'
  WHERE
    template_id = p_template_id
    AND instance_status = 'on_hold'
    AND (metadata->>'paused_by_template')::boolean IS TRUE;

  GET DIAGNOSTICS affected = ROW_COUNT;
  RETURN affected;
END;
$$;
