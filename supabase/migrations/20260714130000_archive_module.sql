-- ============================================================
-- Archive Module Migration
-- Vault Management, Collateral Placement, Documents Library,
-- Request Workflow, Custody Tracker, Archive Audit Log
-- ============================================================

-- ─── 1. ENUM TYPES ────────────────────────────────────────────────────────────

DROP TYPE IF EXISTS public.archive_location_type CASCADE;
CREATE TYPE public.archive_location_type AS ENUM ('vault', 'room', 'cabinet', 'shelf', 'slot');

DROP TYPE IF EXISTS public.custody_status CASCADE;
CREATE TYPE public.custody_status AS ENUM ('in_vault', 'on_loan', 'overdue', 'returned', 'missing');

DROP TYPE IF EXISTS public.archive_request_status CASCADE;
CREATE TYPE public.archive_request_status AS ENUM ('pending', 'approved', 'rejected', 'checked_out', 'returned');

DROP TYPE IF EXISTS public.archive_event_type CASCADE;
CREATE TYPE public.archive_event_type AS ENUM (
  'vault_created', 'vault_updated', 'placement_assigned', 'placement_updated',
  'request_raised', 'request_approved', 'request_rejected',
  'checked_out', 'returned', 'overdue_flagged', 'sms_sent', 'document_added', 'document_removed'
);

-- ─── 2. CORE TABLES ───────────────────────────────────────────────────────────

-- Hierarchical vault locations (vault > room > cabinet > shelf > slot)
CREATE TABLE IF NOT EXISTS public.archive_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL,
  location_type public.archive_location_type NOT NULL,
  parent_id UUID REFERENCES public.archive_locations(id) ON DELETE CASCADE,
  description TEXT,
  capacity INTEGER DEFAULT 100,
  current_occupancy INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Physical placement of collateral in a vault location
CREATE TABLE IF NOT EXISTS public.archive_placements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  location_id UUID REFERENCES public.archive_locations(id) ON DELETE SET NULL,
  physical_ref TEXT,
  electronic_record_url TEXT,
  notes TEXT,
  placed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  placed_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(collateral_id)
);

-- Physical file loan/return request workflow
CREATE TABLE IF NOT EXISTS public.archive_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  request_status public.archive_request_status DEFAULT 'pending',
  purpose TEXT NOT NULL,
  expected_return_date DATE,
  actual_return_date DATE,
  rejection_reason TEXT,
  checkout_notes TEXT,
  return_notes TEXT,
  sms_reminder_sent BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Live custody status per collateral
CREATE TABLE IF NOT EXISTS public.archive_custody (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE UNIQUE,
  current_status public.custody_status DEFAULT 'in_vault',
  current_request_id UUID REFERENCES public.archive_requests(id) ON DELETE SET NULL,
  last_checked_out_at TIMESTAMPTZ,
  last_returned_at TIMESTAMPTZ,
  checked_out_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  overdue_since TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Archive audit log — every movement timestamped
CREATE TABLE IF NOT EXISTS public.archive_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type public.archive_event_type NOT NULL,
  collateral_id UUID REFERENCES public.collateral_records(id) ON DELETE SET NULL,
  request_id UUID REFERENCES public.archive_requests(id) ON DELETE SET NULL,
  location_id UUID REFERENCES public.archive_locations(id) ON DELETE SET NULL,
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ─── 3. INDEXES ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_archive_locations_parent ON public.archive_locations(parent_id);
CREATE INDEX IF NOT EXISTS idx_archive_locations_type ON public.archive_locations(location_type);
CREATE INDEX IF NOT EXISTS idx_archive_placements_collateral ON public.archive_placements(collateral_id);
CREATE INDEX IF NOT EXISTS idx_archive_placements_location ON public.archive_placements(location_id);
CREATE INDEX IF NOT EXISTS idx_archive_requests_collateral ON public.archive_requests(collateral_id);
CREATE INDEX IF NOT EXISTS idx_archive_requests_status ON public.archive_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_archive_requests_requested_by ON public.archive_requests(requested_by);
CREATE INDEX IF NOT EXISTS idx_archive_custody_collateral ON public.archive_custody(collateral_id);
CREATE INDEX IF NOT EXISTS idx_archive_custody_status ON public.archive_custody(current_status);
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_collateral ON public.archive_audit_log(collateral_id);
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_event ON public.archive_audit_log(event_type);
CREATE INDEX IF NOT EXISTS idx_archive_audit_log_created ON public.archive_audit_log(created_at DESC);

-- ─── 4. FUNCTIONS ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_archive_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- ─── 5. ENABLE RLS ────────────────────────────────────────────────────────────

ALTER TABLE public.archive_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_placements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_custody ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_audit_log ENABLE ROW LEVEL SECURITY;

-- ─── 6. RLS POLICIES ─────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "archive_locations_authenticated" ON public.archive_locations;
CREATE POLICY "archive_locations_authenticated" ON public.archive_locations
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "archive_placements_authenticated" ON public.archive_placements;
CREATE POLICY "archive_placements_authenticated" ON public.archive_placements
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "archive_requests_authenticated" ON public.archive_requests;
CREATE POLICY "archive_requests_authenticated" ON public.archive_requests
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "archive_custody_authenticated" ON public.archive_custody;
CREATE POLICY "archive_custody_authenticated" ON public.archive_custody
FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "archive_audit_log_authenticated" ON public.archive_audit_log;
CREATE POLICY "archive_audit_log_authenticated" ON public.archive_audit_log
FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ─── 7. TRIGGERS ─────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_archive_locations_updated_at ON public.archive_locations;
CREATE TRIGGER trg_archive_locations_updated_at
BEFORE UPDATE ON public.archive_locations
FOR EACH ROW EXECUTE FUNCTION public.update_archive_updated_at();

DROP TRIGGER IF EXISTS trg_archive_placements_updated_at ON public.archive_placements;
CREATE TRIGGER trg_archive_placements_updated_at
BEFORE UPDATE ON public.archive_placements
FOR EACH ROW EXECUTE FUNCTION public.update_archive_updated_at();

DROP TRIGGER IF EXISTS trg_archive_requests_updated_at ON public.archive_requests;
CREATE TRIGGER trg_archive_requests_updated_at
BEFORE UPDATE ON public.archive_requests
FOR EACH ROW EXECUTE FUNCTION public.update_archive_updated_at();

DROP TRIGGER IF EXISTS trg_archive_custody_updated_at ON public.archive_custody;
CREATE TRIGGER trg_archive_custody_updated_at
BEFORE UPDATE ON public.archive_custody
FOR EACH ROW EXECUTE FUNCTION public.update_archive_updated_at();

-- ─── 8. SEED DATA ─────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_user_id UUID;
  v_vault1 UUID := gen_random_uuid();
  v_vault2 UUID := gen_random_uuid();
  v_room1 UUID := gen_random_uuid();
  v_room2 UUID := gen_random_uuid();
  v_cabinet1 UUID := gen_random_uuid();
  v_cabinet2 UUID := gen_random_uuid();
  v_shelf1 UUID := gen_random_uuid();
  v_shelf2 UUID := gen_random_uuid();
  v_slot1 UUID := gen_random_uuid();
  v_slot2 UUID := gen_random_uuid();
  v_collateral_id UUID;
BEGIN
  SELECT id INTO v_user_id FROM public.user_profiles LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE NOTICE 'No user found, skipping archive seed data';
    RETURN;
  END IF;

  -- Vaults
  INSERT INTO public.archive_locations (id, name, code, location_type, parent_id, description, capacity, created_by)
  VALUES
    (v_vault1, 'Main Vault', 'VLT-001', 'vault', NULL, 'Primary collateral vault — ground floor', 500, v_user_id),
    (v_vault2, 'Secondary Vault', 'VLT-002', 'vault', NULL, 'Overflow vault — first floor', 300, v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Rooms
  INSERT INTO public.archive_locations (id, name, code, location_type, parent_id, description, capacity, created_by)
  VALUES
    (v_room1, 'Room A', 'VLT-001-RA', 'room', v_vault1, 'Title deeds and charge certificates', 200, v_user_id),
    (v_room2, 'Room B', 'VLT-001-RB', 'room', v_vault1, 'Valuation reports and insurance', 150, v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Cabinets
  INSERT INTO public.archive_locations (id, name, code, location_type, parent_id, description, capacity, created_by)
  VALUES
    (v_cabinet1, 'Cabinet 1', 'VLT-001-RA-C1', 'cabinet', v_room1, 'Active collaterals A–M', 50, v_user_id),
    (v_cabinet2, 'Cabinet 2', 'VLT-001-RA-C2', 'cabinet', v_room1, 'Active collaterals N–Z', 50, v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Shelves
  INSERT INTO public.archive_locations (id, name, code, location_type, parent_id, description, capacity, created_by)
  VALUES
    (v_shelf1, 'Shelf 1', 'VLT-001-RA-C1-S1', 'shelf', v_cabinet1, 'Top shelf', 20, v_user_id),
    (v_shelf2, 'Shelf 2', 'VLT-001-RA-C1-S2', 'shelf', v_cabinet1, 'Middle shelf', 20, v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Slots
  INSERT INTO public.archive_locations (id, name, code, location_type, parent_id, description, capacity, created_by)
  VALUES
    (v_slot1, 'Slot 1', 'VLT-001-RA-C1-S1-F1', 'slot', v_shelf1, 'Filing slot 1', 1, v_user_id),
    (v_slot2, 'Slot 2', 'VLT-001-RA-C1-S1-F2', 'slot', v_shelf1, 'Filing slot 2', 1, v_user_id)
  ON CONFLICT (id) DO NOTHING;

  -- Seed a placement if a collateral record exists
  SELECT id INTO v_collateral_id FROM public.collateral_records LIMIT 1;
  IF v_collateral_id IS NOT NULL THEN
    INSERT INTO public.archive_placements (collateral_id, location_id, physical_ref, notes, placed_by)
    VALUES (v_collateral_id, v_slot1, 'PHY-REF-001', 'Original title deed — sealed envelope', v_user_id)
    ON CONFLICT (collateral_id) DO NOTHING;

    INSERT INTO public.archive_custody (collateral_id, current_status, updated_at)
    VALUES (v_collateral_id, 'in_vault', CURRENT_TIMESTAMP)
    ON CONFLICT (collateral_id) DO NOTHING;

    INSERT INTO public.archive_audit_log (event_type, collateral_id, location_id, performed_by, description)
    VALUES ('placement_assigned', v_collateral_id, v_slot1, v_user_id, 'Initial placement assigned during archive setup')
    ON CONFLICT (id) DO NOTHING;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Archive seed data failed: %', SQLERRM;
END $$;
