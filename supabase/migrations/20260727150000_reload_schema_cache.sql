-- ============================================================
-- Force PostgREST schema cache reload
-- Fixes: "Could not find the table 'public.loans' in the schema cache"
-- The loans table exists but PostgREST needs to reload its cache
-- ============================================================

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
