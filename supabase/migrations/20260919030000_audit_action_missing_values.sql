-- auditLogService.ts inserts several action values that were never added to
-- the audit_action enum, so every one of these inserts has always failed
-- (Postgres rejects the invalid enum value), silently swallowed by
-- insertAuditLog()'s error handling. Concretely: legal sign-offs and
-- document approve/reject decisions never produced an audit trail entry,
-- so Compliance Trail's "Signed Off" counts/badges and per-collateral log
-- counts always undercounted these events. loan_linked/loan_released/
-- charge_rank_changed/equity_recalculated/discharge_recorded/batch_release
-- have no live callers yet but would hit the same failure the moment one
-- is added, so they're included here too.

ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'legal_signoff';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'document_approved';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'document_rejected';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'loan_linked';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'loan_released';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'charge_rank_changed';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'equity_recalculated';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'discharge_recorded';
ALTER TYPE public.audit_action ADD VALUE IF NOT EXISTS 'batch_release';
