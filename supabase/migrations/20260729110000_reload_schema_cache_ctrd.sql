-- ============================================================
-- Force PostgREST schema cache reload
-- Fixes: "Could not find the table 'public.collateral_type_required_documents' in the schema cache"
-- The table exists but PostgREST needs to reload its cache
-- ============================================================

-- Notify PostgREST to reload its schema cache
NOTIFY pgrst, 'reload schema';
