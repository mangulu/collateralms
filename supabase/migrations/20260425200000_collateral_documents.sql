-- ============================================================
-- CollateralMS — Collateral Documents & Storage Migration
-- ============================================================

-- 1. ENUM for document type
DROP TYPE IF EXISTS public.document_type CASCADE;
CREATE TYPE public.document_type AS ENUM (
  'Title Deed',
  'Charge Certificate',
  'Valuation Report',
  'BRELA Confirmation',
  'Insurance Certificate',
  'Board Resolution',
  'Other'
);

-- 2. collateral_documents table
CREATE TABLE IF NOT EXISTS public.collateral_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID NOT NULL REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
  document_type public.document_type DEFAULT 'Other'::public.document_type,
  version INTEGER NOT NULL DEFAULT 1,
  notes TEXT DEFAULT '',
  uploaded_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  uploaded_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_collateral_documents_record_id ON public.collateral_documents(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_collateral_documents_collateral_id ON public.collateral_documents(collateral_id);
CREATE INDEX IF NOT EXISTS idx_collateral_documents_created_at ON public.collateral_documents(created_at DESC);

-- 4. Enable RLS
ALTER TABLE public.collateral_documents ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "authenticated_read_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_read_collateral_documents"
ON public.collateral_documents
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_insert_collateral_documents"
ON public.collateral_documents
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_delete_collateral_documents" ON public.collateral_documents;
CREATE POLICY "authenticated_delete_collateral_documents"
ON public.collateral_documents
FOR DELETE
TO authenticated
USING (
  uploaded_by = auth.uid()
  OR public.get_user_role() IN ('system_admin', 'legal_officer')
);

-- 6. Storage bucket for collateral documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'collateral-documents',
  'collateral-documents',
  false,
  10485760,
  ARRAY['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
ON CONFLICT (id) DO NOTHING;

-- 7. Storage RLS Policies
DROP POLICY IF EXISTS "authenticated_upload_collateral_docs" ON storage.objects;
CREATE POLICY "authenticated_upload_collateral_docs"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'collateral-documents' AND auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "authenticated_read_collateral_docs" ON storage.objects;
CREATE POLICY "authenticated_read_collateral_docs"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'collateral-documents');

DROP POLICY IF EXISTS "authenticated_delete_collateral_docs" ON storage.objects;
CREATE POLICY "authenticated_delete_collateral_docs"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'collateral-documents');
