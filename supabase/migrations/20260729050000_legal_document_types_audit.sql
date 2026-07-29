-- ============================================================
-- CollateralMS — Legal Document Types & Audit Trail Enhancement
-- Adds Deed, Appraisal, Insurance Policy document types
-- and ensures audit trail RLS is properly configured
-- ============================================================

-- 1. Add new legal document type values to the existing enum
--    (safe: ALTER TYPE ADD VALUE is idempotent in Postgres 14+)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Deed'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Deed';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Appraisal'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Appraisal';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'Insurance Policy'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'document_type' AND typnamespace = 'public'::regnamespace)
  ) THEN
    ALTER TYPE public.document_type ADD VALUE 'Insurance Policy';
  END IF;
END $$;

-- 2. Ensure document_version_audit table has RLS enabled and proper policies
ALTER TABLE public.document_version_audit ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to read all audit entries
DROP POLICY IF EXISTS "authenticated_read_document_version_audit" ON public.document_version_audit;
CREATE POLICY "authenticated_read_document_version_audit"
  ON public.document_version_audit
  FOR SELECT
  TO authenticated
  USING (true);

-- Allow authenticated users to insert audit entries
DROP POLICY IF EXISTS "authenticated_insert_document_version_audit" ON public.document_version_audit;
CREATE POLICY "authenticated_insert_document_version_audit"
  ON public.document_version_audit
  FOR INSERT
  TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- 3. Index for fast audit trail queries by collateral and date
CREATE INDEX IF NOT EXISTS idx_doc_version_audit_collateral_record
  ON public.document_version_audit(collateral_record_id, performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_version_audit_performed_at
  ON public.document_version_audit(performed_at DESC);

CREATE INDEX IF NOT EXISTS idx_doc_version_audit_performed_by
  ON public.document_version_audit(performed_by);

-- 4. Ensure collateral_documents storage RLS policies are in place
-- (bucket 'collateral-documents' already exists; ensure policies exist)
DROP POLICY IF EXISTS "authenticated_upload_collateral_documents" ON storage.objects;
CREATE POLICY "authenticated_upload_collateral_documents"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'collateral-documents');

DROP POLICY IF EXISTS "authenticated_read_collateral_documents" ON storage.objects;
CREATE POLICY "authenticated_read_collateral_documents"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (bucket_id = 'collateral-documents');

DROP POLICY IF EXISTS "authenticated_delete_collateral_documents" ON storage.objects;
CREATE POLICY "authenticated_delete_collateral_documents"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'collateral-documents');
