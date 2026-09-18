-- ============================================================
-- Archive Vault Reconciliation (Stock-Take)
-- Nothing today verifies that archive_placements (what the system
-- believes is filed) matches physical reality. This adds a periodic
-- reconciliation workflow: an officer walks a vault/room/cabinet
-- slot by slot, confirms or flags each one, and any discrepancy is
-- tracked (and, for missing collateral, finally puts the existing
-- but never-used custody_status 'missing' value to real use).
-- ============================================================

-- ─── 1. Reconciliation session (one walk over a chosen location) ───────────

CREATE TABLE IF NOT EXISTS public.archive_reconciliation_sessions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id    UUID NOT NULL REFERENCES public.archive_locations(id) ON DELETE CASCADE,
  status         TEXT NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'cancelled')),
  started_by     UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  started_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  completed_at   TIMESTAMPTZ,
  notes          TEXT
);

-- ─── 2. Per-slot review within a session ───────────────────────────────────

CREATE TABLE IF NOT EXISTS public.archive_reconciliation_items (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES public.archive_reconciliation_sessions(id) ON DELETE CASCADE,
  location_id        UUID NOT NULL REFERENCES public.archive_locations(id) ON DELETE CASCADE,
  expected_count     INTEGER NOT NULL DEFAULT 0,
  result             TEXT NOT NULL DEFAULT 'pending' CHECK (result IN ('pending', 'confirmed', 'discrepancy')),
  discrepancy_notes  TEXT,
  reviewed_by        UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_at        TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_archive_reconciliation_sessions_location ON public.archive_reconciliation_sessions(location_id);
CREATE INDEX IF NOT EXISTS idx_archive_reconciliation_sessions_status ON public.archive_reconciliation_sessions(status);
CREATE INDEX IF NOT EXISTS idx_archive_reconciliation_items_session ON public.archive_reconciliation_items(session_id);
CREATE INDEX IF NOT EXISTS idx_archive_reconciliation_items_location ON public.archive_reconciliation_items(location_id);

ALTER TABLE public.archive_reconciliation_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.archive_reconciliation_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_users_archive_reconciliation_sessions" ON public.archive_reconciliation_sessions;
CREATE POLICY "auth_users_archive_reconciliation_sessions"
ON public.archive_reconciliation_sessions
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "auth_users_archive_reconciliation_items" ON public.archive_reconciliation_items;
CREATE POLICY "auth_users_archive_reconciliation_items"
ON public.archive_reconciliation_items
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ─── 3. New audit event types ───────────────────────────────────────────────
-- Additive ALTER TYPE ... ADD VALUE (see prior archive migrations this week
-- for why this is used instead of DROP TYPE ... CASCADE).

ALTER TYPE public.archive_event_type ADD VALUE IF NOT EXISTS 'reconciliation_started';
ALTER TYPE public.archive_event_type ADD VALUE IF NOT EXISTS 'reconciliation_completed';
ALTER TYPE public.archive_event_type ADD VALUE IF NOT EXISTS 'reconciliation_discrepancy';
