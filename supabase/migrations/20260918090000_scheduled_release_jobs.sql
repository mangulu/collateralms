-- ============================================================
-- Real Scheduled Batch Release Jobs
-- Scheduled Jobs (Administration) previously had zero backing --
-- scheduledJobService stored everything in localStorage, seeded
-- with fabricated demo data, and "Run Now" (literally named
-- simulateRun) faked a delay then invented random released/failed
-- items. No real collateral was ever released; nothing was shared
-- across users or devices.
--
-- Real automated release can only safely act on collateral whose
-- charge has already been discharged at the registry (an officer
-- filed the paperwork and recorded the discharge number via
-- charge_registry, e.g. from the Batch Release page) but whose
-- collateral_loan_links row is still ACTIVE -- i.e. the registry
-- confirmed the charge is clear, and this job's only job is to
-- finalize the release in-system on a schedule instead of someone
-- clicking through it manually. There's no reliable "days since loan
-- closure" signal in this schema (collateral_loan_links.end_date is
-- only ever set BY the release itself, never before), so that
-- criterion from the old fake version is dropped rather than kept
-- as a knob that can't mean anything.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.scheduled_release_jobs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT NOT NULL,
  description               TEXT NOT NULL DEFAULT '',
  frequency                 TEXT NOT NULL DEFAULT 'DAILY' CHECK (frequency IN ('DAILY', 'WEEKLY')),
  run_time                  TEXT NOT NULL DEFAULT '06:00',
  day_of_week               TEXT CHECK (day_of_week IN ('MON','TUE','WED','THU','FRI','SAT','SUN')),
  status                    TEXT NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'PAUSED')),
  registry_filter           TEXT[] NOT NULL DEFAULT ARRAY['BRELA'],
  require_discharge_number  BOOLEAN NOT NULL DEFAULT true,
  created_by                UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_at               TIMESTAMPTZ,
  total_runs                INTEGER NOT NULL DEFAULT 0,
  success_runs              INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.scheduled_release_job_runs (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id            UUID NOT NULL REFERENCES public.scheduled_release_jobs(id) ON DELETE CASCADE,
  run_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  status            TEXT NOT NULL CHECK (status IN ('SUCCESS', 'PARTIAL', 'FAILED')),
  total_processed   INTEGER NOT NULL DEFAULT 0,
  released          INTEGER NOT NULL DEFAULT 0,
  failed            INTEGER NOT NULL DEFAULT 0,
  duration_seconds  INTEGER NOT NULL DEFAULT 0,
  errors            JSONB NOT NULL DEFAULT '[]'::jsonb,
  released_items    JSONB NOT NULL DEFAULT '[]'::jsonb,
  triggered_by      UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  -- null triggered_by = cron/system run, not a manual "Run Now"
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scheduled_release_jobs_status ON public.scheduled_release_jobs(status);
CREATE INDEX IF NOT EXISTS idx_scheduled_release_job_runs_job ON public.scheduled_release_job_runs(job_id);
CREATE INDEX IF NOT EXISTS idx_scheduled_release_job_runs_run_at ON public.scheduled_release_job_runs(run_at DESC);

ALTER TABLE public.scheduled_release_jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_release_job_runs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scheduled_release_jobs_authenticated" ON public.scheduled_release_jobs;
CREATE POLICY "scheduled_release_jobs_authenticated"
ON public.scheduled_release_jobs FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "scheduled_release_job_runs_authenticated" ON public.scheduled_release_job_runs;
CREATE POLICY "scheduled_release_job_runs_authenticated"
ON public.scheduled_release_job_runs FOR ALL TO authenticated USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
