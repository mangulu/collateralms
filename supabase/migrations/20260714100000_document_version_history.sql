-- ============================================================
-- CollateralMS — Document Version History & Rollback Audit
-- ============================================================

-- 1. Add rollback tracking columns to collateral_documents
ALTER TABLE public.collateral_documents
ADD COLUMN IF NOT EXISTS is_rollback BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.collateral_documents
ADD COLUMN IF NOT EXISTS rolled_back_from_version INTEGER DEFAULT NULL;

ALTER TABLE public.collateral_documents
ADD COLUMN IF NOT EXISTS rolled_back_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL DEFAULT NULL;

ALTER TABLE public.collateral_documents
ADD COLUMN IF NOT EXISTS rolled_back_by_name TEXT DEFAULT NULL;

ALTER TABLE public.collateral_documents
ADD COLUMN IF NOT EXISTS rolled_back_at TIMESTAMPTZ DEFAULT NULL;

-- 2. document_version_audit table — immutable audit log for compliance
CREATE TABLE IF NOT EXISTS public.document_version_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID NOT NULL REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  document_id UUID NOT NULL REFERENCES public.collateral_documents(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('upload', 'rollback', 'delete')),
  from_version INTEGER DEFAULT NULL,
  to_version INTEGER NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL DEFAULT 0,
  notes TEXT DEFAULT '',
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT NOT NULL DEFAULT '',
  performed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_doc_version_audit_collateral ON public.document_version_audit(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_doc_version_audit_document ON public.document_version_audit(document_id);
CREATE INDEX IF NOT EXISTS idx_doc_version_audit_file_name ON public.document_version_audit(file_name);
CREATE INDEX IF NOT EXISTS idx_doc_version_audit_performed_at ON public.document_version_audit(performed_at DESC);

-- 4. Enable RLS
ALTER TABLE public.document_version_audit ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies — read-only for all authenticated, insert for authenticated
DROP POLICY IF EXISTS "authenticated_read_doc_version_audit" ON public.document_version_audit;
CREATE POLICY "authenticated_read_doc_version_audit"
ON public.document_version_audit
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_doc_version_audit" ON public.document_version_audit;
CREATE POLICY "authenticated_insert_doc_version_audit"
ON public.document_version_audit
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- No UPDATE or DELETE on audit table — immutable by design

-- 6. Backfill existing uploads into audit log (idempotent)
DO $$
BEGIN
  INSERT INTO public.document_version_audit (
    collateral_record_id, collateral_id, document_id, file_name,
    action, from_version, to_version, file_path, file_size, notes,
    performed_by, performed_by_name, performed_at
  )
  SELECT
    cd.collateral_record_id,
    cd.collateral_id,
    cd.id,
    cd.file_name,
    'upload',
    NULL,
    cd.version,
    cd.file_path,
    cd.file_size,
    COALESCE(cd.notes, ''),
    cd.uploaded_by,
    COALESCE(cd.uploaded_by_name, ''),
    cd.created_at
  FROM public.collateral_documents cd
  WHERE NOT EXISTS (
    SELECT 1 FROM public.document_version_audit dva
    WHERE dva.document_id = cd.id AND dva.action = 'upload'
  );
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Backfill skipped: %', SQLERRM;
END $$;
