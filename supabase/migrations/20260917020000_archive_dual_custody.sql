-- ============================================================
-- Archive Dual-Custody Approval
-- Access Requests today lets a single approver check out any
-- physical file regardless of value. Standard practice for
-- high-value physical collateral (title deeds, share certificates)
-- is two-person sign-off. This adds a configurable value threshold
-- above which a second, different approver is required.
-- ============================================================

-- ─── 1. Track the first approver separately from the final one ────────────

ALTER TABLE public.archive_requests
  ADD COLUMN IF NOT EXISTS first_approved_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS first_approved_at TIMESTAMPTZ;

-- ─── 2. New intermediate request status ────────────────────────────────────
-- Safe additive change (see 20260917010000_archive_retention_disposal.sql
-- for why ADD VALUE is used instead of the DROP TYPE CASCADE pattern).

ALTER TYPE public.archive_request_status ADD VALUE IF NOT EXISTS 'pending_second_approval';

-- ─── 3. Dual-custody threshold (TSh) ────────────────────────────────────────
-- No schema change needed here: the threshold lives as one more key inside
-- the existing system_config row 'default_thresholds' (System Settings →
-- Threshold Values), alongside the app's other configurable numeric
-- thresholds. See SystemConfigContent.tsx's `thresholds` FIELD_DEFS and
-- archiveRequestService.approve() in archiveService.ts.
