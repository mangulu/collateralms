-- ─── Security: 2FA Enforcement & IP-Based Session Restrictions ───────────────
-- Migration: 20260728100000_security_2fa_ip_restrictions.sql

-- ─── 0. Extend user_role enum with supervisor value ──────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'supervisor'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'user_role')
  ) THEN
    ALTER TYPE public.user_role ADD VALUE 'supervisor';
  END IF;
END $$;

-- ─── 1. Add 2FA enforcement flag to user_profiles ────────────────────────────
ALTER TABLE public.user_profiles
  ADD COLUMN IF NOT EXISTS two_fa_enforced BOOLEAN DEFAULT false;

-- ─── 2. IP Whitelist Configuration Table ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ip_whitelist_configs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  label         TEXT NOT NULL,
  ip_address    TEXT NOT NULL,
  description   TEXT,
  applies_to    TEXT[] NOT NULL DEFAULT ARRAY['system_admin', 'supervisor'],
  is_active     BOOLEAN DEFAULT true,
  created_by    UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_active ON public.ip_whitelist_configs(is_active);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_applies_to ON public.ip_whitelist_configs USING GIN(applies_to);

ALTER TABLE public.ip_whitelist_configs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_manage_ip_whitelist" ON public.ip_whitelist_configs;
CREATE POLICY "admin_manage_ip_whitelist"
ON public.ip_whitelist_configs
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ─── 3. IP Access Log Table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ip_access_log (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  ip_address    TEXT NOT NULL,
  user_role     TEXT,
  access_result TEXT NOT NULL CHECK (access_result IN ('allowed', 'blocked')),
  route         TEXT,
  created_at    TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ip_access_log_user ON public.ip_access_log(user_id);
CREATE INDEX IF NOT EXISTS idx_ip_access_log_created ON public.ip_access_log(created_at);

ALTER TABLE public.ip_access_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admin_view_ip_access_log" ON public.ip_access_log;
CREATE POLICY "admin_view_ip_access_log"
ON public.ip_access_log
FOR ALL TO authenticated
USING (true)
WITH CHECK (true);

-- ─── 4. Enforce 2FA for system_admin and supervisor roles ────────────────────
-- Mark existing admin users as having 2FA enforced
UPDATE public.user_profiles
SET two_fa_enforced = true
WHERE role IN ('system_admin', 'supervisor');

-- ─── 5. Seed default office IP whitelist entries ─────────────────────────────
DO $$
DECLARE
  admin_user_id UUID;
BEGIN
  SELECT id INTO admin_user_id FROM public.user_profiles WHERE role = 'system_admin' LIMIT 1;

  INSERT INTO public.ip_whitelist_configs (id, label, ip_address, description, applies_to, is_active, created_by)
  VALUES
    (gen_random_uuid(), 'Head Office - Main', '196.13.0.0/16', 'EXIM Bank Head Office primary network range', ARRAY['system_admin', 'supervisor'], true, admin_user_id),
    (gen_random_uuid(), 'Branch Network', '10.0.0.0/8', 'Internal branch office network', ARRAY['system_admin', 'supervisor'], true, admin_user_id),
    (gen_random_uuid(), 'VPN Gateway', '172.16.0.0/12', 'Corporate VPN exit nodes', ARRAY['system_admin', 'supervisor'], true, admin_user_id)
  ON CONFLICT (id) DO NOTHING;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Seed IP whitelist skipped: %', SQLERRM;
END $$;
