-- ─────────────────────────────────────────────────────────────────────────────
-- Document Approval Workflow
-- Adds per-document approval tracking for Legal Officers
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Add approval_status column to collateral_documents if not exists
ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS approval_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (approval_status IN ('pending', 'approved', 'rejected', 'under_review'));

ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS approval_notes TEXT;

ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES public.user_profiles(id);

ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS approved_by_name TEXT;

ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ;

-- 2. Create document_approvals table for full audit trail
CREATE TABLE IF NOT EXISTS public.document_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID NOT NULL REFERENCES public.collateral_documents(id) ON DELETE CASCADE,
  collateral_record_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL DEFAULT '',
  document_type TEXT NOT NULL DEFAULT '',
  file_name TEXT NOT NULL DEFAULT '',
  action TEXT NOT NULL CHECK (action IN ('approved', 'rejected', 'under_review', 'pending')),
  notes TEXT DEFAULT '',
  performed_by UUID REFERENCES public.user_profiles(id),
  performed_by_name TEXT NOT NULL DEFAULT '',
  performed_by_role TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 3. Indexes
CREATE INDEX IF NOT EXISTS idx_document_approvals_document_id
  ON public.document_approvals(document_id);

CREATE INDEX IF NOT EXISTS idx_document_approvals_collateral_id
  ON public.document_approvals(collateral_id);

CREATE INDEX IF NOT EXISTS idx_document_approvals_performed_by
  ON public.document_approvals(performed_by);

CREATE INDEX IF NOT EXISTS idx_document_approvals_created_at
  ON public.document_approvals(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_collateral_documents_approval_status
  ON public.collateral_documents(approval_status);

-- 4. Enable RLS
ALTER TABLE public.document_approvals ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies for document_approvals
DROP POLICY IF EXISTS "authenticated_read_document_approvals" ON public.document_approvals;
CREATE POLICY "authenticated_read_document_approvals"
  ON public.document_approvals
  FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "authenticated_insert_document_approvals" ON public.document_approvals;
CREATE POLICY "authenticated_insert_document_approvals"
  ON public.document_approvals
  FOR INSERT
  TO authenticated
  WITH CHECK (performed_by = auth.uid());

-- 6. RLS policy for collateral_documents approval columns (already has RLS enabled)
-- Allow authenticated users to update approval fields
DROP POLICY IF EXISTS "authenticated_update_document_approval_status" ON public.collateral_documents;
CREATE POLICY "authenticated_update_document_approval_status"
  ON public.collateral_documents
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);
