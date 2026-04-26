-- ============================================================
-- CollateralMS — Audit Trail IP Address Enhancement
-- Adds ip_address, session_id, and event_category columns
-- to audit_logs for regulatory compliance audit trail
-- ============================================================

-- 1. ADD COLUMNS TO audit_logs

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS ip_address TEXT DEFAULT NULL;

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS session_id TEXT DEFAULT NULL;

ALTER TABLE public.audit_logs
ADD COLUMN IF NOT EXISTS event_category TEXT DEFAULT 'collateral_change';

-- event_category: 'login' | 'collateral_change' | 'status_transition' | 'export' | 'document' | 'user_management' | 'system'

-- 2. INDEXES

CREATE INDEX IF NOT EXISTS idx_audit_logs_ip_address ON public.audit_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_audit_logs_event_category ON public.audit_logs(event_category);

-- 3. ENRICH EXISTING ROWS WITH MOCK IP ADDRESSES AND CATEGORIES

DO $$
BEGIN
  UPDATE public.audit_logs
  SET
    ip_address = CASE (RANDOM() * 4)::INT
      WHEN 0 THEN '196.216.10.45'
      WHEN 1 THEN '196.216.10.67'
      WHEN 2 THEN '41.188.32.12'
      ELSE '196.216.10.89'
    END,
    event_category = CASE action::TEXT
      WHEN 'created'          THEN 'collateral_change'
      WHEN 'updated'          THEN 'collateral_change'
      WHEN 'deleted'          THEN 'collateral_change'
      WHEN 'perfected'        THEN 'status_transition'
      WHEN 'overdue'          THEN 'status_transition'
      WHEN 'submitted'        THEN 'status_transition'
      WHEN 'reviewed'         THEN 'status_transition'
      WHEN 'approved'         THEN 'status_transition'
      WHEN 'rejected'         THEN 'status_transition'
      WHEN 'returned'         THEN 'status_transition'
      WHEN 'STATUS_CHANGE'    THEN 'status_transition'
      WHEN 'DOCUMENT_UPLOAD'  THEN 'document'
      WHEN 'DOCUMENT_DELETE'  THEN 'document'
      WHEN 'REVIEW'           THEN 'status_transition'
      ELSE 'collateral_change'
    END
  WHERE ip_address IS NULL;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Audit trail enrichment skipped: %', SQLERRM;
END $$;

-- 4. INSERT MOCK LOGIN AND EXPORT EVENTS

DO $$
DECLARE
  existing_user_id UUID;
  existing_user_name TEXT;
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_profiles'
  ) THEN
    SELECT id, full_name INTO existing_user_id, existing_user_name
    FROM public.user_profiles LIMIT 1;

    IF existing_user_id IS NOT NULL THEN
      INSERT INTO public.audit_logs (
        id, entity_type, action, message, detail,
        performed_by, performed_by_name, ip_address, event_category, created_at
      ) VALUES
        (gen_random_uuid(), 'system', 'login', 'User login successful',
         'Session started via web browser', existing_user_id,
         COALESCE(existing_user_name, 'System User'),
         '196.216.10.45', 'login',
         NOW() - INTERVAL '2 hours'),
        (gen_random_uuid(), 'system', 'login', 'User login successful',
         'Session started via web browser', existing_user_id,
         COALESCE(existing_user_name, 'System User'),
         '196.216.10.67', 'login',
         NOW() - INTERVAL '8 hours'),
        (gen_random_uuid(), 'system', 'export', 'Collateral registry exported to CSV',
         'Exported 47 records — all collateral types', existing_user_id,
         COALESCE(existing_user_name, 'System User'),
         '196.216.10.45', 'export',
         NOW() - INTERVAL '5 hours'),
        (gen_random_uuid(), 'system', 'export', 'Compliance audit report exported',
         'PDF export — deadline monitoring report', existing_user_id,
         COALESCE(existing_user_name, 'System User'),
         '196.216.10.89', 'export',
         NOW() - INTERVAL '1 day')
      ON CONFLICT (id) DO NOTHING;
    END IF;
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock audit trail events skipped: %', SQLERRM;
END $$;
