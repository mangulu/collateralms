-- ============================================================
-- CollateralMS — Workflow Stages & Status History Migration
-- Adds: Perfected stage, status history table, auto-trigger
-- ============================================================

-- 1. ADD 'Perfected' VALUE TO EXISTING ENUM (if not already present)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumtypid = 'public.perfection_request_status'::regtype
      AND enumlabel = 'Perfected'
  ) THEN
    ALTER TYPE public.perfection_request_status ADD VALUE 'Perfected';
  END IF;
END $$;

-- 2. CREATE STATUS HISTORY TABLE
CREATE TABLE IF NOT EXISTS public.perfection_status_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfection_request_id UUID NOT NULL REFERENCES public.perfection_requests(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  reason TEXT DEFAULT '',
  changed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  changed_by_name TEXT DEFAULT '',
  changed_by_role TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_psh_request_id ON public.perfection_status_history(perfection_request_id);
CREATE INDEX IF NOT EXISTS idx_psh_created_at ON public.perfection_status_history(created_at DESC);

-- 4. TRIGGER FUNCTION: auto-insert history on status change
CREATE OR REPLACE FUNCTION public.handle_perfection_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF (OLD.request_status IS DISTINCT FROM NEW.request_status) THEN
    INSERT INTO public.perfection_status_history (
      perfection_request_id,
      from_status,
      to_status,
      reason,
      changed_by,
      changed_by_name,
      changed_by_role
    ) VALUES (
      NEW.id,
      OLD.request_status::TEXT,
      NEW.request_status::TEXT,
      COALESCE(NEW.decision_notes, ''),
      NEW.reviewed_by,
      COALESCE(NEW.reviewed_by_name, ''),
      ''
    );
  END IF;
  RETURN NEW;
END;
$$;

-- 5. TRIGGER ON perfection_requests
DROP TRIGGER IF EXISTS perfection_status_change_trigger ON public.perfection_requests;
CREATE TRIGGER perfection_status_change_trigger
  AFTER UPDATE ON public.perfection_requests
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_perfection_status_change();

-- 6. ENABLE RLS
ALTER TABLE public.perfection_status_history ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES
DROP POLICY IF EXISTS "authenticated_read_perfection_status_history" ON public.perfection_status_history;
CREATE POLICY "authenticated_read_perfection_status_history"
ON public.perfection_status_history
FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "authenticated_insert_perfection_status_history" ON public.perfection_status_history;
CREATE POLICY "authenticated_insert_perfection_status_history"
ON public.perfection_status_history
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 8. BACKFILL HISTORY FOR EXISTING REQUESTS
DO $$
DECLARE
  req RECORD;
BEGIN
  FOR req IN
    SELECT id, request_status, submitted_by, submitted_by_name, submitted_at,
           reviewed_by, reviewed_by_name, reviewed_at, decision_notes
    FROM public.perfection_requests
    WHERE request_status != 'Draft'
  LOOP
    -- Insert Submitted transition if applicable
    IF req.request_status IN ('Submitted', 'Under Review', 'Approved', 'Perfected', 'Rejected', 'Returned') THEN
      INSERT INTO public.perfection_status_history (
        perfection_request_id, from_status, to_status, reason,
        changed_by, changed_by_name, changed_by_role, created_at
      ) VALUES (
        req.id, 'Draft', 'Submitted', '',
        req.submitted_by, COALESCE(req.submitted_by_name, ''), 'credit_officer',
        COALESCE(req.submitted_at, CURRENT_TIMESTAMP)
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Insert Under Review transition if applicable
    IF req.request_status IN ('Under Review', 'Approved', 'Perfected', 'Rejected', 'Returned') THEN
      INSERT INTO public.perfection_status_history (
        perfection_request_id, from_status, to_status, reason,
        changed_by, changed_by_name, changed_by_role, created_at
      ) VALUES (
        req.id, 'Submitted', 'Under Review', '',
        req.reviewed_by, COALESCE(req.reviewed_by_name, ''), 'legal_officer',
        COALESCE(req.reviewed_at, CURRENT_TIMESTAMP - interval '1 hour')
      )
      ON CONFLICT DO NOTHING;
    END IF;

    -- Insert final status transition
    IF req.request_status IN ('Approved', 'Perfected', 'Rejected', 'Returned') THEN
      INSERT INTO public.perfection_status_history (
        perfection_request_id, from_status, to_status, reason,
        changed_by, changed_by_name, changed_by_role, created_at
      ) VALUES (
        req.id, 'Under Review', req.request_status::TEXT,
        COALESCE(req.decision_notes, ''),
        req.reviewed_by, COALESCE(req.reviewed_by_name, ''), 'legal_officer',
        COALESCE(req.reviewed_at, CURRENT_TIMESTAMP)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Backfill failed: %', SQLERRM;
END $$;
