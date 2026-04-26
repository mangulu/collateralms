-- ============================================================
-- CollateralMS — Perfection Approval Workflow Migration
-- ============================================================

-- 1. ENUM TYPES

DROP TYPE IF EXISTS public.perfection_request_status CASCADE;
CREATE TYPE public.perfection_request_status AS ENUM (
  'Draft',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected',
  'Returned'
);

DROP TYPE IF EXISTS public.perfection_action CASCADE;
CREATE TYPE public.perfection_action AS ENUM (
  'submitted',
  'reviewed',
  'approved',
  'rejected',
  'returned',
  'commented',
  'reopened'
);

-- 2. TABLES

-- perfection_requests: one per collateral record, tracks the approval lifecycle
CREATE TABLE IF NOT EXISTS public.perfection_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID REFERENCES public.collateral_records(id) ON DELETE CASCADE,
  collateral_id TEXT NOT NULL,
  obligor TEXT NOT NULL DEFAULT '',
  collateral_type TEXT NOT NULL DEFAULT '',
  registry TEXT NOT NULL DEFAULT '',
  perfection_deadline TEXT NOT NULL DEFAULT '',
  request_status public.perfection_request_status DEFAULT 'Draft'::public.perfection_request_status,
  submitted_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  submitted_by_name TEXT DEFAULT '',
  submitted_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  reviewed_by_name TEXT DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  decision_notes TEXT DEFAULT '',
  priority TEXT DEFAULT 'Normal',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- perfection_comments: threaded comments/notes on each request
CREATE TABLE IF NOT EXISTS public.perfection_comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  perfection_request_id UUID REFERENCES public.perfection_requests(id) ON DELETE CASCADE,
  action public.perfection_action NOT NULL,
  comment TEXT NOT NULL DEFAULT '',
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT DEFAULT '',
  performed_by_role TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_perfection_requests_collateral_record_id ON public.perfection_requests(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_perfection_requests_status ON public.perfection_requests(request_status);
CREATE INDEX IF NOT EXISTS idx_perfection_requests_submitted_by ON public.perfection_requests(submitted_by);
CREATE INDEX IF NOT EXISTS idx_perfection_requests_reviewed_by ON public.perfection_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS idx_perfection_comments_request_id ON public.perfection_comments(perfection_request_id);
CREATE INDEX IF NOT EXISTS idx_perfection_comments_created_at ON public.perfection_comments(created_at DESC);

-- 4. FUNCTIONS

-- Updated_at trigger (reuse existing handle_updated_at)
DROP TRIGGER IF EXISTS perfection_requests_updated_at ON public.perfection_requests;
CREATE TRIGGER perfection_requests_updated_at
  BEFORE UPDATE ON public.perfection_requests
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 5. ENABLE RLS
ALTER TABLE public.perfection_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.perfection_comments ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- perfection_requests: all authenticated users can read
DROP POLICY IF EXISTS "authenticated_read_perfection_requests" ON public.perfection_requests;
CREATE POLICY "authenticated_read_perfection_requests"
ON public.perfection_requests
FOR SELECT
TO authenticated
USING (true);

-- perfection_requests: authenticated users can insert
DROP POLICY IF EXISTS "authenticated_insert_perfection_requests" ON public.perfection_requests;
CREATE POLICY "authenticated_insert_perfection_requests"
ON public.perfection_requests
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- perfection_requests: authenticated users can update
DROP POLICY IF EXISTS "authenticated_update_perfection_requests" ON public.perfection_requests;
CREATE POLICY "authenticated_update_perfection_requests"
ON public.perfection_requests
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- perfection_comments: all authenticated users can read
DROP POLICY IF EXISTS "authenticated_read_perfection_comments" ON public.perfection_comments;
CREATE POLICY "authenticated_read_perfection_comments"
ON public.perfection_comments
FOR SELECT
TO authenticated
USING (true);

-- perfection_comments: authenticated users can insert
DROP POLICY IF EXISTS "authenticated_insert_perfection_comments" ON public.perfection_comments;
CREATE POLICY "authenticated_insert_perfection_comments"
ON public.perfection_comments
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 7. MOCK DATA
DO $$
DECLARE
  credit_user_id UUID;
  legal_user_id UUID;
  col1_id UUID;
  col2_id UUID;
  col3_id UUID;
  col4_id UUID;
  req1_uuid UUID := gen_random_uuid();
  req2_uuid UUID := gen_random_uuid();
  req3_uuid UUID := gen_random_uuid();
  req4_uuid UUID := gen_random_uuid();
  req5_uuid UUID := gen_random_uuid();
BEGIN
  -- Get existing users
  SELECT id INTO credit_user_id FROM public.user_profiles WHERE role = 'credit_officer' LIMIT 1;
  SELECT id INTO legal_user_id FROM public.user_profiles WHERE role = 'legal_officer' LIMIT 1;

  -- Get existing collateral records
  SELECT id INTO col1_id FROM public.collateral_records WHERE collateral_id = 'col-0312' LIMIT 1;
  SELECT id INTO col2_id FROM public.collateral_records WHERE collateral_id = 'col-0307' LIMIT 1;
  SELECT id INTO col3_id FROM public.collateral_records WHERE collateral_id = 'col-0309' LIMIT 1;
  SELECT id INTO col4_id FROM public.collateral_records WHERE collateral_id = 'col-0310' LIMIT 1;

  IF credit_user_id IS NOT NULL AND legal_user_id IS NOT NULL THEN

    -- Insert perfection requests
    INSERT INTO public.perfection_requests (
      id, collateral_record_id, collateral_id, obligor, collateral_type, registry,
      perfection_deadline, request_status, submitted_by, submitted_by_name,
      submitted_at, reviewed_by, reviewed_by_name, reviewed_at, decision_notes, priority
    ) VALUES
      (req1_uuid, col1_id, 'col-0312', 'Coastal Traders Co.', 'Mortgage', 'Lands Registry',
       '26 May 2026', 'Under Review'::public.perfection_request_status,
       credit_user_id, 'J. Kamau', now() - interval '2 days',
       legal_user_id, 'A. Mwangi', now() - interval '1 day',
       'Title deed documents need notarization before final approval.', 'High'),

      (req2_uuid, col2_id, 'col-0307', 'Zanzibar Tourism Group', 'Guarantee', 'N/A',
       '', 'Approved'::public.perfection_request_status,
       credit_user_id, 'J. Kamau', now() - interval '10 days',
       legal_user_id, 'A. Mwangi', now() - interval '8 days',
       'Corporate guarantee verified and perfected. All documentation in order.', 'Normal'),

      (req3_uuid, col3_id, 'col-0309', 'Mbeya Mining Corp.', 'Debenture', 'BRELA',
       '29 Mar 2026', 'Rejected'::public.perfection_request_status,
       credit_user_id, 'J. Kamau', now() - interval '15 days',
       legal_user_id, 'A. Mwangi', now() - interval '13 days',
       'BRELA registration certificate missing. Resubmit with complete documentation.', 'High'),

      (req4_uuid, col4_id, 'col-0310', 'Dodoma Real Estate Ltd', 'Mortgage', 'Lands Registry',
       '13 Apr 2026', 'Submitted'::public.perfection_request_status,
       credit_user_id, 'J. Kamau', now() - interval '1 day',
       NULL, '', NULL, '', 'Normal'),

      (req5_uuid, NULL, 'col-0308', 'Kilimanjaro Logistics', 'Motor Vehicle', 'TRA',
       '11 Mar 2026', 'Draft'::public.perfection_request_status,
       credit_user_id, 'P. Ochieng', NULL,
       NULL, '', NULL, '', 'Normal')
    ON CONFLICT (id) DO NOTHING;

    -- Insert comments/activity for requests
    INSERT INTO public.perfection_comments (
      id, perfection_request_id, action, comment, performed_by, performed_by_name, performed_by_role
    ) VALUES
      (gen_random_uuid(), req1_uuid, 'submitted'::public.perfection_action,
       'Perfection request submitted with title deed and valuation report attached.',
       credit_user_id, 'J. Kamau', 'credit_officer'),

      (gen_random_uuid(), req1_uuid, 'reviewed'::public.perfection_action,
       'Documents received. Title deed requires notarization — please resubmit notarized copy.',
       legal_user_id, 'A. Mwangi', 'legal_officer'),

      (gen_random_uuid(), req2_uuid, 'submitted'::public.perfection_action,
       'Corporate guarantee from ZTG Holdings submitted for perfection review.',
       credit_user_id, 'J. Kamau', 'credit_officer'),

      (gen_random_uuid(), req2_uuid, 'approved'::public.perfection_action,
       'Guarantee verified with ZTG Holdings board resolution. Perfection confirmed.',
       legal_user_id, 'A. Mwangi', 'legal_officer'),

      (gen_random_uuid(), req3_uuid, 'submitted'::public.perfection_action,
       'Debenture registration request submitted. BRELA filing in progress.',
       credit_user_id, 'J. Kamau', 'credit_officer'),

      (gen_random_uuid(), req3_uuid, 'rejected'::public.perfection_action,
       'BRELA registration certificate not included. Cannot approve without official confirmation.',
       legal_user_id, 'A. Mwangi', 'legal_officer'),

      (gen_random_uuid(), req4_uuid, 'submitted'::public.perfection_action,
       'Mortgage perfection request submitted. Title deed Vol. 7 Folio 22 attached.',
       credit_user_id, 'J. Kamau', 'credit_officer')
    ON CONFLICT (id) DO NOTHING;

  ELSE
    RAISE NOTICE 'Required users not found. Skipping perfection workflow mock data.';
  END IF;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Perfection workflow mock data failed: %', SQLERRM;
END $$;
