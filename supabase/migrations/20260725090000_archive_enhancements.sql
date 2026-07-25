-- ============================================================
-- Archive Enhancements Migration
-- Timeline logs, collateral movement tracking, request status
-- tracking, chain-of-custody, real-time sync support
-- ============================================================

-- ─── 1. EXTEND ARCHIVE EVENT TYPES ────────────────────────────────────────────

DROP TYPE IF EXISTS public.archive_event_type CASCADE;
CREATE TYPE public.archive_event_type AS ENUM (
  'vault_created', 'vault_updated',
  'placement_assigned', 'placement_updated', 'placement_removed',
  'collateral_moved',
  'request_raised', 'request_approved', 'request_rejected',
  'checked_out', 'returned', 'overdue_flagged', 'sms_sent',
  'document_added', 'document_removed',
  'custody_handoff', 'custody_received', 'officer_assigned'
);

-- ─── 2. ADD MOVEMENT TRACKING COLUMNS TO AUDIT LOG ────────────────────────────

ALTER TABLE public.archive_audit_log
  ADD COLUMN IF NOT EXISTS source_location_id UUID REFERENCES public.archive_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS destination_location_id UUID REFERENCES public.archive_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS actor_name TEXT,
  ADD COLUMN IF NOT EXISTS reason TEXT;

-- ─── 3. CHAIN-OF-CUSTODY TABLE ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.archive_custody_chain (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  from_officer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  to_officer_id UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  from_location_id UUID REFERENCES public.archive_locations(id) ON DELETE SET NULL,
  to_location_id UUID REFERENCES public.archive_locations(id) ON DELETE SET NULL,
  confirmed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  confirmation_status TEXT DEFAULT 'pending' CHECK (confirmation_status IN ('pending', 'confirmed', 'rejected')),
  notes TEXT,
  confirmed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 4. REQUEST STATUS TRACKING TABLE ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.archive_request_status_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES public.archive_requests(id) ON DELETE CASCADE,
  collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE SET NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 5. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_archive_audit_log_source_loc ON public.archive_audit_log(source_location_id);
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_dest_loc ON public.archive_audit_log(destination_location_id);
CREATE INDEX IF NOT EXISTS idx_archive_custody_chain_collateral ON public.archive_custody_chain(collateral_id);
CREATE INDEX IF NOT EXISTS idx_archive_custody_chain_created ON public.archive_custody_chain(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_archive_custody_chain_from_officer ON public.archive_custody_chain(from_officer_id);
CREATE INDEX IF NOT EXISTS idx_archive_custody_chain_to_officer ON public.archive_custody_chain(to_officer_id);
CREATE INDEX IF NOT EXISTS idx_archive_request_status_log_request ON public.archive_request_status_log(request_id);
CREATE INDEX IF NOT EXISTS idx_archive_request_status_log_created ON public.archive_request_status_log(created_at DESC);

-- ─── 6. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.archive_custody_chain ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_request_status_log ENABLE ROW LEVEL SECURITY;

-- ─── 7. RLS POLICIES ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "archive_custody_chain_authenticated" ON public.archive_custody_chain;
CREATE POLICY "archive_custody_chain_authenticated" ON public.archive_custody_chain
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "archive_request_status_log_authenticated" ON public.archive_request_status_log;
CREATE POLICY "archive_request_status_log_authenticated" ON public.archive_request_status_log
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 8. FUNCTION: LOG REQUEST STATUS CHANGE ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_archive_request_status_change()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.request_status IS DISTINCT FROM NEW.request_status THEN
    INSERT INTO public.archive_request_status_log (
      request_id, collateral_id, old_status, new_status, changed_by
    ) VALUES (
      NEW.id, NEW.collateral_id,
      OLD.request_status::TEXT, NEW.request_status::TEXT,
      NEW.approved_by
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_archive_request_status_log ON public.archive_requests;
CREATE TRIGGER trg_archive_request_status_log
AFTER UPDATE ON public.archive_requests
FOR EACH ROW EXECUTE FUNCTION public.log_archive_request_status_change();

-- ─── 9. SEED SAMPLE CUSTODY CHAIN DATA ───────────────────────────────────────

DO $$
DECLARE
  v_user_id UUID;
  v_collateral_id UUID;
  v_location_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;
  SELECT id INTO v_collateral_id FROM public.collateral_records LIMIT 1;
  SELECT id INTO v_location_id FROM public.archive_locations WHERE location_type = 'slot' LIMIT 1;

  IF v_user_id IS NOT NULL AND v_collateral_id IS NOT NULL THEN
    INSERT INTO public.archive_custody_chain (
      collateral_id, event_type, to_officer_id, to_location_id,
      confirmation_status, notes, confirmed_at
    ) VALUES (
      v_collateral_id, 'custody_received', v_user_id, v_location_id,
      'confirmed', 'Initial custody assignment at vault intake', CURRENT_TIMESTAMP
    ) ON CONFLICT (id) DO NOTHING;

    -- Also seed some movement audit log entries
    INSERT INTO public.archive_audit_log (
      event_type, collateral_id, location_id, performed_by, description,
      actor_name, reason
    ) VALUES (
      'placement_assigned', v_collateral_id, v_location_id, v_user_id,
      'Collateral filed into vault slot during initial intake',
      'System', 'Initial vault intake'
    ) ON CONFLICT (id) DO NOTHING;
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Archive enhancements seed failed: %', SQLERRM;
END $$;
