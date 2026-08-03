-- Migration: add allow_multiple flag to collateral_type_required_documents
-- When allow_multiple = false, only one document of that type is permitted per collateral.
-- Uploading a second one requires the user to confirm "Upload as Newer Version",
-- which marks the previous document as superseded.

-- 1. Add allow_multiple column (default true = existing behaviour unchanged)
ALTER TABLE public.collateral_type_required_documents
  ADD COLUMN IF NOT EXISTS allow_multiple BOOLEAN NOT NULL DEFAULT true;

-- 2. Add is_superseded flag to collateral_documents so we can mark old versions
ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS is_superseded BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS superseded_at TIMESTAMPTZ;

ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS superseded_by UUID REFERENCES public.collateral_documents(id) ON DELETE SET NULL;

-- 3. Index for fast lookup of active (non-superseded) docs by type
CREATE INDEX IF NOT EXISTS idx_cd_collateral_type_active
  ON public.collateral_documents (collateral_record_id, document_type, is_superseded);
