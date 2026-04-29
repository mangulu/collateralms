-- ============================================================
-- CollateralMS — Add CUSTODY_DISCREPANCY alert type to sms_alerts
-- ============================================================

-- Drop old check constraint and recreate with new type
ALTER TABLE public.sms_alerts
  DROP CONSTRAINT IF EXISTS sms_alerts_alert_type_check;

ALTER TABLE public.sms_alerts
  ADD CONSTRAINT sms_alerts_alert_type_check
  CHECK (alert_type IN ('FRAUD_DETECTION', 'BRELA_DEADLINE', 'APPROVAL_REQUEST', 'OVERDUE_COLLATERAL', 'CUSTODY_DISCREPANCY'));
