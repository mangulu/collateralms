-- Migration: collateral_updates table
-- Tracks field-level changes to collateral records (assignee, geolocation, status overrides, etc.)

CREATE TABLE IF NOT EXISTS public.collateral_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  update_type TEXT NOT NULL,
  field_changed TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  notes TEXT,
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_collateral_updates_record_id ON public.collateral_updates(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_collateral_updates_created_at ON public.collateral_updates(created_at DESC);

ALTER TABLE public.collateral_updates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "authenticated_manage_collateral_updates" ON public.collateral_updates;
CREATE POLICY "authenticated_manage_collateral_updates"
  ON public.collateral_updates
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);
