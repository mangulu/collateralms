-- ============================================================
-- Force PostgREST schema cache reload
-- Needed after the archive_reconciliation_* tables and new
-- archive_event_type enum values above, so PostgREST picks them up
-- immediately instead of erroring until its cache next refreshes.
-- ============================================================

NOTIFY pgrst, 'reload schema';
