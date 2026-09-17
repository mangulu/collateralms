-- ============================================================
-- Archive Retention & Disposal Lifecycle
-- Physical collateral documents currently sit in the vault
-- forever after a collateral is released, with no tracking of
-- when they become eligible for destruction and no disposal
-- workflow or audit trail. This adds a retention period per
-- document type, an eligibility timestamp per placement, and a
-- disposal record.
-- ============================================================

-- ─── 1. Retention period per document type ─────────────────────────────────
-- NULL means "retain indefinitely" (no automatic disposal eligibility).

ALTER TABLE public.document_type_settings
  ADD COLUMN IF NOT EXISTS retention_period_months INTEGER;

-- ─── 2. Disposal fields on archive_placements ──────────────────────────────
-- The placement row is kept (not hard-deleted) after disposal, so the
-- audit trail and slot history remain intact.

ALTER TABLE public.archive_placements
  ADD COLUMN IF NOT EXISTS retention_eligible_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disposed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS disposed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS disposal_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_archive_placements_retention_eligible
  ON public.archive_placements(retention_eligible_at)
  WHERE disposed_at IS NULL;

-- ─── 3. New audit event types ───────────────────────────────────────────────
-- Uses ALTER TYPE ... ADD VALUE (safe, additive) rather than the
-- DROP TYPE ... CASCADE + CREATE TYPE pattern used by earlier archive
-- migrations, which would risk dropping the event_type column.

ALTER TYPE public.archive_event_type ADD VALUE IF NOT EXISTS 'disposal_flagged';
ALTER TYPE public.archive_event_type ADD VALUE IF NOT EXISTS 'disposal_approved';
ALTER TYPE public.archive_event_type ADD VALUE IF NOT EXISTS 'disposed';
