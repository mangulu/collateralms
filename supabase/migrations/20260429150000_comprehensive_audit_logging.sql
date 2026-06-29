-- ============================================================
-- CollateralMS — Comprehensive Audit Logging
-- Extends audit_logs with:
--   • reason column (why the action was taken)
--   • Expanded audit_action enum (sms_sent, document_uploaded,
--     document_deleted, login, logout, export, bulk_upload,
--     status_changed, user_created, user_updated, user_deactivated)
--   • Immutability: INSERT-only RLS (no UPDATE / DELETE)
--   • Indexes for fast querying
-- ============================================================

-- ─── 1. EXTEND audit_action ENUM ─────────────────────────────────────────────
-- PostgreSQL does not support IF NOT EXISTS for ALTER TYPE ADD VALUE,
-- so we guard each addition with a DO block.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'sms_sent'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'sms_sent';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'document_uploaded'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'document_uploaded';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'document_deleted'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'document_deleted';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'login'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'login';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'logout'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'logout';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'export'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'export';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'bulk_upload'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'bulk_upload';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'user_created'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'user_created';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'user_updated'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'user_updated';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'user_deactivated'
      AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'audit_action' AND typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public'))
  ) THEN
    ALTER TYPE public.audit_action ADD VALUE 'user_deactivated';
  END IF;
END $$;

-- ─── 2. ADD reason COLUMN ────────────────────────────────────────────────────

ALTER TABLE public.audit_logs
  ADD COLUMN IF NOT EXISTS reason TEXT DEFAULT NULL;

-- reason: free-text explanation of WHY the action was taken
-- e.g. "Approved after legal review", "Released per customer request"

-- ─── 3. INDEXES ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_collateral_id ON public.audit_logs(collateral_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_reason        ON public.audit_logs(reason) WHERE reason IS NOT NULL;

-- ─── 4. IMMUTABILITY — INSERT-ONLY RLS ───────────────────────────────────────
-- Drop any existing permissive write policies and replace with insert-only.

-- Remove old broad policies if they exist
DROP POLICY IF EXISTS "audit_logs_all_authenticated"   ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_insert_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_select_authenticated" ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_update_deny"          ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_delete_deny"          ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_immutable_insert"     ON public.audit_logs;
DROP POLICY IF EXISTS "audit_logs_immutable_select"     ON public.audit_logs;

-- Authenticated users can read all audit logs
CREATE POLICY "audit_logs_immutable_select"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (true);

-- Authenticated users can INSERT new audit entries
CREATE POLICY "audit_logs_immutable_insert"
  ON public.audit_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- No UPDATE policy → updates are silently blocked by RLS
-- No DELETE policy → deletes are silently blocked by RLS

-- ─── 5. SAMPLE AUDIT ENTRIES FOR NEW ACTION TYPES ────────────────────────────

DO $$
DECLARE
  v_user_id   UUID;
  v_user_name TEXT;
  v_col_id    UUID;
  v_col_ref   TEXT;
BEGIN
  -- Fetch an existing user
  SELECT id, full_name INTO v_user_id, v_user_name
  FROM public.user_profiles
  LIMIT 1;

  -- Fetch an existing collateral record
  SELECT id, collateral_id INTO v_col_id, v_col_ref
  FROM public.collateral_records
  LIMIT 1;

  IF v_user_id IS NOT NULL THEN

    -- sms_sent
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      collateral_record_id, collateral_id,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'sms_alert', 'sms_sent',
      'SMS alert dispatched to borrower',
      'FRAUD_DETECTION alert sent via Twilio to +255 7XX XXX XXX',
      'Triggered by AI fraud score exceeding threshold',
      v_user_id, COALESCE(v_user_name, 'System'),
      'sms',
      v_col_id, v_col_ref,
      jsonb_build_array(
        jsonb_build_object('field','alert_type','label','Alert Type','old_value','','new_value','FRAUD_DETECTION'),
        jsonb_build_object('field','status','label','Delivery Status','old_value','PENDING','new_value','SENT')
      ),
      NOW() - INTERVAL '30 minutes'
    ) ON CONFLICT (id) DO NOTHING;

    -- document_uploaded
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      collateral_record_id, collateral_id,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'document', 'document_uploaded',
      'Document uploaded: Title Deed',
      'File: title_deed_v2.pdf (2.4 MB)',
      'Updated title deed after registry confirmation',
      v_user_id, COALESCE(v_user_name, 'System'),
      'document',
      v_col_id, v_col_ref,
      jsonb_build_array(
        jsonb_build_object('field','document_type','label','Document Type','old_value','','new_value','Title Deed'),
        jsonb_build_object('field','version','label','Version','old_value','1','new_value','2')
      ),
      NOW() - INTERVAL '2 hours'
    ) ON CONFLICT (id) DO NOTHING;

    -- document_deleted
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      collateral_record_id, collateral_id,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'document', 'document_deleted',
      'Document deleted: Insurance Certificate',
      'File: insurance_cert_expired.pdf removed',
      'Expired certificate replaced with renewed version',
      v_user_id, COALESCE(v_user_name, 'System'),
      'document',
      v_col_id, v_col_ref,
      jsonb_build_array(
        jsonb_build_object('field','document_type','label','Document Type','old_value','Insurance Certificate','new_value',''),
        jsonb_build_object('field','file_name','label','File Name','old_value','insurance_cert_expired.pdf','new_value','')
      ),
      NOW() - INTERVAL '3 hours'
    ) ON CONFLICT (id) DO NOTHING;

    -- login
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      ip_address, created_at
    ) VALUES (
      gen_random_uuid(), 'system', 'login',
      'User authenticated successfully',
      'Session started via web browser',
      NULL,
      v_user_id, COALESCE(v_user_name, 'System'),
      'login',
      '196.216.10.45',
      NOW() - INTERVAL '4 hours'
    ) ON CONFLICT (id) DO NOTHING;

    -- logout
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      ip_address, created_at
    ) VALUES (
      gen_random_uuid(), 'system', 'logout',
      'User session ended',
      'User logged out after 2h 15m session',
      NULL,
      v_user_id, COALESCE(v_user_name, 'System'),
      'login',
      '196.216.10.45',
      NOW() - INTERVAL '1 hour 45 minutes'
    ) ON CONFLICT (id) DO NOTHING;

    -- export
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      created_at
    ) VALUES (
      gen_random_uuid(), 'system', 'export',
      'Collateral registry exported to CSV',
      'Exported 47 records — all collateral types',
      'Monthly compliance reporting',
      v_user_id, COALESCE(v_user_name, 'System'),
      'export',
      NOW() - INTERVAL '5 hours'
    ) ON CONFLICT (id) DO NOTHING;

    -- bulk_upload
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'collateral', 'bulk_upload',
      'Bulk upload completed: 12 collateral records imported',
      'File: collateral_batch_april2026.xlsx — 12 created, 0 failed',
      'Quarterly batch import from branch offices',
      v_user_id, COALESCE(v_user_name, 'System'),
      'batch_operation',
      jsonb_build_array(
        jsonb_build_object('field','records_created','label','Records Created','old_value','0','new_value','12'),
        jsonb_build_object('field','records_failed','label','Records Failed','old_value','0','new_value','0')
      ),
      NOW() - INTERVAL '6 hours'
    ) ON CONFLICT (id) DO NOTHING;

    -- user_created
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'user', 'user_created',
      'New user account created',
      'User: Lisa Alkado (credit_officer) onboarded',
      'New hire onboarding — Dar es Salaam branch',
      v_user_id, COALESCE(v_user_name, 'System'),
      'user_management',
      jsonb_build_array(
        jsonb_build_object('field','role','label','Role','old_value','','new_value','credit_officer'),
        jsonb_build_object('field','is_active','label','Active','old_value','','new_value','true')
      ),
      NOW() - INTERVAL '1 day'
    ) ON CONFLICT (id) DO NOTHING;

    -- user_updated
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'user', 'user_updated',
      'User profile updated',
      'User: Cornel Mangulu — role changed',
      'Promotion to legal_officer after certification',
      v_user_id, COALESCE(v_user_name, 'System'),
      'user_management',
      jsonb_build_array(
        jsonb_build_object('field','role','label','Role','old_value','credit_officer','new_value','legal_officer')
      ),
      NOW() - INTERVAL '2 days'
    ) ON CONFLICT (id) DO NOTHING;

    -- user_deactivated
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'user', 'user_deactivated',
      'User account deactivated',
      'User: B. Osei — account suspended',
      'Staff resignation — access revoked per HR policy',
      v_user_id, COALESCE(v_user_name, 'System'),
      'user_management',
      jsonb_build_array(
        jsonb_build_object('field','is_active','label','Active','old_value','true','new_value','false')
      ),
      NOW() - INTERVAL '3 days'
    ) ON CONFLICT (id) DO NOTHING;

    -- status_changed (with reason)
    INSERT INTO public.audit_logs (
      id, entity_type, action, message, detail, reason,
      performed_by, performed_by_name, event_category,
      collateral_record_id, collateral_id,
      field_changes, created_at
    ) VALUES (
      gen_random_uuid(), 'collateral', 'status_changed',
      'Collateral status changed: Under Review → Released',
      'Facility fully repaid — lien discharged at Lands Registry',
      'Customer loan fully settled — discharge certificate received',
      v_user_id, COALESCE(v_user_name, 'System'),
      'status_transition',
      v_col_id, v_col_ref,
      jsonb_build_array(
        jsonb_build_object('field','status','label','Status','old_value','Under Review','new_value','Released'),
        jsonb_build_object('field','discharge_date','label','Discharge Date','old_value','','new_value',to_char(NOW(),'DD Mon YYYY'))
      ),
      NOW() - INTERVAL '7 hours'
    ) ON CONFLICT (id) DO NOTHING;

  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Comprehensive audit log seed skipped: %', SQLERRM;
END $$;
