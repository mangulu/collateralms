-- ============================================================
-- Force PostgREST schema cache reload
-- Fixes: "Failed to load vault data" / "Failed to load disposal
-- queue data" after the retention/disposal and dual-custody
-- migrations — the new columns and enum values exist, but
-- PostgREST needs to reload its cache to see them.
-- ============================================================

NOTIFY pgrst, 'reload schema';
