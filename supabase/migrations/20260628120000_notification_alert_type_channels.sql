-- ============================================================
-- CollateralMS — Per-Alert-Type Channel Config & Recipients
-- ============================================================
-- Adds JSONB columns to notification_preferences for:
--   1. alert_channel_config  — per-alert-type channel toggles (email/sms/inapp)
--   2. alert_recipients      — per-alert-type recipient lists (emails/phones)
-- ============================================================

ALTER TABLE public.notification_preferences
  ADD COLUMN IF NOT EXISTS alert_channel_config JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS alert_recipients JSONB DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.notification_preferences.alert_channel_config IS
  'Per-alert-type channel toggles. Structure: { "overdue_collateral": { "email": true, "sms": false, "inapp": true }, ... }';

COMMENT ON COLUMN public.notification_preferences.alert_recipients IS
  'Per-alert-type recipient lists. Structure: { "overdue_collateral": { "emails": ["a@b.com"], "phones": ["+255..."] }, ... }';
