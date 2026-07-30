-- ============================================================
-- Workflow Instance Step Completions
-- Adds completed_by to workflow_instance_steps for full audit trail
-- ============================================================

-- Add completed_by column to workflow_instance_steps
ALTER TABLE public.workflow_instance_steps
ADD COLUMN IF NOT EXISTS completed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL;

-- Add comment column to workflow_instance_steps for step-level notes
ALTER TABLE public.workflow_instance_steps
ADD COLUMN IF NOT EXISTS action_taken TEXT;

-- Index for completed_by lookups
CREATE INDEX IF NOT EXISTS idx_workflow_instance_steps_completed_by
  ON public.workflow_instance_steps(completed_by);

-- Index for transition log instance_step_id (already exists via FK but ensure it)
CREATE INDEX IF NOT EXISTS idx_workflow_transition_log_instance_step
  ON public.workflow_transition_log(instance_step_id);
