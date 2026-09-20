-- Adds an optional expiry date to collateral_documents so the Documents
-- Library can flag time-bound documents (insurance certificates, valuation
-- reports, registry search certificates, etc.) that are expiring soon or
-- already expired, instead of every document looking equally "current"
-- regardless of age. NULL means no expiry tracked for that document.

ALTER TABLE public.collateral_documents
  ADD COLUMN IF NOT EXISTS expiry_date DATE;

CREATE INDEX IF NOT EXISTS idx_collateral_documents_expiry_date
  ON public.collateral_documents(expiry_date)
  WHERE expiry_date IS NOT NULL;
