-- ============================================================
-- Restore archive_audit_log.event_type
-- 20260725090000_archive_enhancements.sql ran
-- `DROP TYPE public.archive_event_type CASCADE` to extend the enum
-- with new values, not accounting for CASCADE dropping every column
-- typed with it -- silently deleting archive_audit_log.event_type.
-- It was never re-added, so every row since has lost its event type
-- (crashing the Movement Timeline Log, which expects it) and every
-- insert naming the column has been failing and getting swallowed
-- (archiveAuditService.log() never checked the insert's error),
-- breaking the audit trail app-wide since that migration.
-- ============================================================

ALTER TABLE public.archive_audit_log
  ADD COLUMN IF NOT EXISTS event_type public.archive_event_type;

-- Best-effort recovery for rows that predate the column loss --
-- their real event can't be recovered, so fall back to the closest
-- generic label rather than leaving them unrenderable.
UPDATE public.archive_audit_log
SET event_type = 'placement_assigned'
WHERE event_type IS NULL AND description ILIKE '%filed%';

UPDATE public.archive_audit_log
SET event_type = 'placement_updated'
WHERE event_type IS NULL;

ALTER TABLE public.archive_audit_log
  ALTER COLUMN event_type SET NOT NULL;

NOTIFY pgrst, 'reload schema';
