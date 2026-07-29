-- ─── IP Restrictions Global Toggle ──────────────────────────────────────────
-- Migration: 20260729060000_ip_restrictions_global_toggle.sql
-- Adds a system_config entry to enable/disable IP restrictions globally.
-- Default: DISABLED (whitelist-all) so no one is locked out.

INSERT INTO public.system_config (config_key, config_value, category, label, description)
VALUES (
  'ip_restrictions_enabled',
  '{"enabled": false}'::jsonb,
  'security',
  'IP Restrictions',
  'When enabled, users with sensitive roles (system_admin, supervisor) can only access the dashboard from whitelisted IP addresses. Disabled by default.'
)
ON CONFLICT (config_key) DO UPDATE
  SET config_value = EXCLUDED.config_value,
      label        = EXCLUDED.label,
      description  = EXCLUDED.description;
