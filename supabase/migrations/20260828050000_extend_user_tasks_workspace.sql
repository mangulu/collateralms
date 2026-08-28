-- ─── Extend user_tasks for unified Staff Workspace ───────────────────────────
-- Adds workflow metadata, assignment tracking, and workspace columns

-- Extend task_status enum with new values
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'cancelled' AND enumtypid = 'public.task_status'::regtype) THEN
    ALTER TYPE public.task_status ADD VALUE 'cancelled';
  END IF;
END $$;

-- Add new columns to user_tasks
ALTER TABLE public.user_tasks
  ADD COLUMN IF NOT EXISTS workflow_name        TEXT,
  ADD COLUMN IF NOT EXISTS instance_id          UUID,
  ADD COLUMN IF NOT EXISTS task_name            TEXT,
  ADD COLUMN IF NOT EXISTS assigned_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS assigned_by_name     TEXT,
  ADD COLUMN IF NOT EXISTS assigned_date        TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  ADD COLUMN IF NOT EXISTS deadline             TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_attended        TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attended_by          UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS attended_by_name     TEXT,
  ADD COLUMN IF NOT EXISTS comments             TEXT,
  ADD COLUMN IF NOT EXISTS deep_link            TEXT;

-- Indexes for new columns
CREATE INDEX IF NOT EXISTS idx_user_tasks_workflow_name   ON public.user_tasks(workflow_name);
CREATE INDEX IF NOT EXISTS idx_user_tasks_instance_id     ON public.user_tasks(instance_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_assigned_by     ON public.user_tasks(assigned_by);
CREATE INDEX IF NOT EXISTS idx_user_tasks_deadline        ON public.user_tasks(deadline);
CREATE INDEX IF NOT EXISTS idx_user_tasks_assigned_date   ON public.user_tasks(assigned_date);

-- Allow managers/admins to view all tasks (for Staff Workspace admin view)
DROP POLICY IF EXISTS "managers_view_all_tasks" ON public.user_tasks;
CREATE POLICY "managers_view_all_tasks"
ON public.user_tasks FOR SELECT TO authenticated
USING (
  assigned_to = auth.uid()
  OR assigned_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('system_admin'::public.user_role, 'credit_officer'::public.user_role, 'legal_officer'::public.user_role)
  )
);

-- Allow update of attended fields by the assigned user
DROP POLICY IF EXISTS "users_update_own_tasks" ON public.user_tasks;
CREATE POLICY "users_update_own_tasks"
ON public.user_tasks FOR UPDATE TO authenticated
USING (
  assigned_to = auth.uid()
  OR assigned_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('system_admin'::public.user_role, 'credit_officer'::public.user_role)
  )
)
WITH CHECK (
  assigned_to = auth.uid()
  OR assigned_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.user_profiles up
    WHERE up.id = auth.uid()
    AND up.role IN ('system_admin'::public.user_role, 'credit_officer'::public.user_role)
  )
);
