-- ─── User Tasks Module ────────────────────────────────────────────────────────
-- Tracks tasks assigned to users: workflow steps, document uploads, approvals

DROP TYPE IF EXISTS public.task_type CASCADE;
CREATE TYPE public.task_type AS ENUM (
  'document_upload',
  'workflow_step',
  'approval',
  'perfection',
  'valuation',
  'insurance',
  'general'
);

DROP TYPE IF EXISTS public.task_priority CASCADE;
CREATE TYPE public.task_priority AS ENUM ('low', 'normal', 'high', 'urgent');

DROP TYPE IF EXISTS public.task_status CASCADE;
CREATE TYPE public.task_status AS ENUM ('pending', 'in_progress', 'completed', 'dismissed');

CREATE TABLE IF NOT EXISTS public.user_tasks (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assigned_to           UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  collateral_record_id  UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id         TEXT NOT NULL DEFAULT '',
  task_type             public.task_type NOT NULL DEFAULT 'general',
  title                 TEXT NOT NULL,
  description           TEXT NOT NULL DEFAULT '',
  action_url            TEXT,
  action_label          TEXT,
  priority              public.task_priority NOT NULL DEFAULT 'normal',
  task_status           public.task_status NOT NULL DEFAULT 'pending',
  due_date              DATE,
  completed_at          TIMESTAMPTZ,
  created_by            UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at            TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_user_tasks_assigned_to ON public.user_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_user_tasks_collateral_record_id ON public.user_tasks(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_user_tasks_task_status ON public.user_tasks(task_status);
CREATE INDEX IF NOT EXISTS idx_user_tasks_created_at ON public.user_tasks(created_at DESC);

ALTER TABLE public.user_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_view_own_tasks" ON public.user_tasks;
CREATE POLICY "users_view_own_tasks"
ON public.user_tasks FOR SELECT TO authenticated
USING (assigned_to = auth.uid());

DROP POLICY IF EXISTS "users_update_own_tasks" ON public.user_tasks;
CREATE POLICY "users_update_own_tasks"
ON public.user_tasks FOR UPDATE TO authenticated
USING (assigned_to = auth.uid())
WITH CHECK (assigned_to = auth.uid());

DROP POLICY IF EXISTS "authenticated_insert_tasks" ON public.user_tasks;
CREATE POLICY "authenticated_insert_tasks"
ON public.user_tasks FOR INSERT TO authenticated
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated_delete_tasks" ON public.user_tasks;
CREATE POLICY "authenticated_delete_tasks"
ON public.user_tasks FOR DELETE TO authenticated
USING (assigned_to = auth.uid());

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.update_user_tasks_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_user_tasks_updated_at ON public.user_tasks;
CREATE TRIGGER trg_user_tasks_updated_at
BEFORE UPDATE ON public.user_tasks
FOR EACH ROW EXECUTE FUNCTION public.update_user_tasks_updated_at();
