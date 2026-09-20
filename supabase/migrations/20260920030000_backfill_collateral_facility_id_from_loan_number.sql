-- Fixes historic collateral_records rows where facility_id was saved as the
-- linked loan's raw UUID (a bug in the Add/Edit Collateral form) instead of
-- the loan's human-readable loan_number. loan_id (the real foreign key) was
-- always correct, so this backfill is a pure display/search fix: it re-derives
-- facility_id from the linked loan wherever the two have drifted apart.
-- Rows with no loan_id, or whose facility_id already matches the loan's
-- loan_number, are left untouched.

UPDATE public.collateral_records cr
SET facility_id = l.loan_number
FROM public.loans l
WHERE cr.loan_id = l.id
  AND l.loan_number IS NOT NULL
  AND cr.facility_id IS DISTINCT FROM l.loan_number;
