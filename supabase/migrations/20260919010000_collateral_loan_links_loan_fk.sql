-- collateral_loan_links.loan_account_id is free text a user types by hand
-- (e.g. 'LN-2024-0771') and was built three months before the real `loans`
-- table existed, so it was never reconciled with it -- real loan numbers
-- look like 'TZ-LN-2024-0001' and share no values with the seeded
-- loan_account_id data. Any code joining the two on equality (comparing
-- loan_account_id to loans.id or loans.loan_number) can never match.
--
-- Add a real FK so new links can be tied to an actual loan. Existing rows
-- can't be reliably backfilled -- there is no dependable mapping from their
-- loan_account_id text to a loans row -- so loan_id stays NULL on them
-- until someone re-links them through the (now loan-picker-based) UI.

ALTER TABLE public.collateral_loan_links
  ADD COLUMN IF NOT EXISTS loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL;

ALTER TABLE public.charge_registry
  ADD COLUMN IF NOT EXISTS loan_id UUID REFERENCES public.loans(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_collateral_loan_links_loan_id ON public.collateral_loan_links(loan_id);
CREATE INDEX IF NOT EXISTS idx_charge_registry_loan_id ON public.charge_registry(loan_id);
