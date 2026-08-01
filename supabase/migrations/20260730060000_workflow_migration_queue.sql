-- Workflow Migration Queue
-- Stores old workflow instances that need to be migrated to the new engine.
-- Auto-migrated instances are processed immediately; ambiguous ones go into the review queue.

DROP TYPE IF EXISTS public.migration_item_status CASCADE;
CREATE TYPE public.migration_item_status AS ENUM ('pending_review', 'auto_migrated', 'manually_migrated', 'skipped');

CREATE TABLE IF NOT EXISTS public.workflow_migration_queue (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instance_id         UUID NOT NULL REFERENCES public.workflow_instances(id) ON DELETE CASCADE,
  suggested_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  suggested_step_id   UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  migration_status    public.migration_item_status NOT NULL DEFAULT 'pending_review',
  ambiguity_reason    TEXT,
  match_confidence    NUMERIC(5,2) DEFAULT 0,
  reviewed_by         UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at         TIMESTAMPTZ,
  confirmed_template_id UUID REFERENCES public.workflow_templates(id) ON DELETE SET NULL,
  confirmed_step_id   UUID REFERENCES public.workflow_steps(id) ON DELETE SET NULL,
  migration_notes     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wmq_instance_id ON public.workflow_migration_queue(instance_id);
CREATE INDEX IF NOT EXISTS idx_wmq_status ON public.workflow_migration_queue(migration_status);
CREATE INDEX IF NOT EXISTS idx_wmq_created_at ON public.workflow_migration_queue(created_at DESC);

ALTER TABLE public.workflow_migration_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins_manage_migration_queue" ON public.workflow_migration_queue;
CREATE POLICY "admins_manage_migration_queue"
ON public.workflow_migration_queue
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);
