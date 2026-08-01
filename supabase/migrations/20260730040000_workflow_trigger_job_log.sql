-- ─── Workflow Trigger Job Log ─────────────────────────────────────────────────
-- Tracks every execution of the workflow trigger processor job,
-- including which rules fired, which instances were created, and any errors.

CREATE TABLE IF NOT EXISTS public.workflow_trigger_job_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  triggered_by TEXT NOT NULL DEFAULT 'scheduler', -- 'scheduler' | 'manual'
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'success', 'partial', 'failed')),
  rules_evaluated INT NOT NULL DEFAULT 0,
  rules_matched INT NOT NULL DEFAULT 0,
  instances_created INT NOT NULL DEFAULT 0,
  instances_skipped INT NOT NULL DEFAULT 0,  -- already has active instance
  errors_count INT NOT NULL DEFAULT 0,
  duration_ms INT,
  detail JSONB NOT NULL DEFAULT '[]'::JSONB, -- array of per-rule results
  error_messages TEXT[] DEFAULT ARRAY[]::TEXT[],
  completed_at TIMESTAMPTZ
);

-- Index for recent runs
CREATE INDEX IF NOT EXISTS idx_workflow_trigger_job_log_run_at
  ON public.workflow_trigger_job_log(run_at DESC);

CREATE INDEX IF NOT EXISTS idx_workflow_trigger_job_log_status
  ON public.workflow_trigger_job_log(status);

-- RLS
ALTER TABLE public.workflow_trigger_job_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_workflow_trigger_job_log" ON public.workflow_trigger_job_log;
CREATE POLICY "authenticated_manage_workflow_trigger_job_log"
  ON public.workflow_trigger_job_log
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
