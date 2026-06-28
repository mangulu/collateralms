-- ============================================================
-- CollateralMS — Document Library: Add workflow_stage column
-- ============================================================

-- Add workflow_stage column to collateral_documents for linking
-- documents to specific perfection workflow stages
ALTER TABLE public.collateral_documents
ADD COLUMN IF NOT EXISTS workflow_stage TEXT DEFAULT NULL;

-- Add index for workflow_stage queries
CREATE INDEX IF NOT EXISTS idx_collateral_documents_workflow_stage
  ON public.collateral_documents(workflow_stage);
