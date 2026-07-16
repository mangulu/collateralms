-- Custom Reports: allow officers to create, save, and schedule custom reports

-- 1. Types
DROP TYPE IF EXISTS public.report_export_format CASCADE;
CREATE TYPE public.report_export_format AS ENUM ('csv', 'pdf', 'excel');

DROP TYPE IF EXISTS public.report_schedule_frequency CASCADE;
CREATE TYPE public.report_schedule_frequency AS ENUM ('once', 'daily', 'weekly', 'monthly');

-- 2. Table
CREATE TABLE IF NOT EXISTS public.custom_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Collateral filters (stored as JSONB)
  filters JSONB NOT NULL DEFAULT '{}',
  -- Date range
  date_from DATE,
  date_to DATE,
  -- Export format
  export_format public.report_export_format NOT NULL DEFAULT 'csv',
  -- Schedule
  is_scheduled BOOLEAN NOT NULL DEFAULT false,
  schedule_frequency public.report_schedule_frequency DEFAULT 'once',
  next_run_at TIMESTAMPTZ,
  last_run_at TIMESTAMPTZ,
  -- Metadata
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_custom_reports_created_by ON public.custom_reports(created_by);
CREATE INDEX IF NOT EXISTS idx_custom_reports_is_scheduled ON public.custom_reports(is_scheduled);
CREATE INDEX IF NOT EXISTS idx_custom_reports_next_run_at ON public.custom_reports(next_run_at);

-- 4. updated_at trigger function
CREATE OR REPLACE FUNCTION public.set_custom_reports_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- 5. Enable RLS
ALTER TABLE public.custom_reports ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies
DROP POLICY IF EXISTS "users_manage_own_custom_reports" ON public.custom_reports;
CREATE POLICY "users_manage_own_custom_reports"
ON public.custom_reports
FOR ALL
TO authenticated
USING (created_by = auth.uid())
WITH CHECK (created_by = auth.uid());

-- 7. Trigger
DROP TRIGGER IF EXISTS trg_custom_reports_updated_at ON public.custom_reports;
CREATE TRIGGER trg_custom_reports_updated_at
BEFORE UPDATE ON public.custom_reports
FOR EACH ROW EXECUTE FUNCTION public.set_custom_reports_updated_at();
