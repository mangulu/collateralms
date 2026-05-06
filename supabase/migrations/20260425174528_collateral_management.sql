-- ============================================================
-- CollateralMS — Full Schema Migration
-- ============================================================

-- 1. ENUM TYPES
DROP TYPE IF EXISTS public.user_role CASCADE;
CREATE TYPE public.user_role AS ENUM ('credit_officer', 'legal_officer', 'system_admin');

DROP TYPE IF EXISTS public.collateral_status CASCADE;
CREATE TYPE public.collateral_status AS ENUM (
  'Draft', 'Submitted', 'Under Review', 'Perfected', 'Monitoring', 'Released', 'Overdue', 'Rejected'
);

DROP TYPE IF EXISTS public.collateral_type CASCADE;
CREATE TYPE public.collateral_type AS ENUM (
  'Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel'
);

DROP TYPE IF EXISTS public.registry_type CASCADE;
CREATE TYPE public.registry_type AS ENUM (
  'BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A'
);

DROP TYPE IF EXISTS public.audit_action CASCADE;
CREATE TYPE public.audit_action AS ENUM (
  'created', 'updated', 'status_changed', 'perfected', 'submitted', 'released', 'overdue', 'deleted'
);

-- 2. CORE TABLES

-- user_profiles (intermediary for auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL DEFAULT '',
  role public.user_role DEFAULT 'credit_officer'::public.user_role,
  initials TEXT DEFAULT '',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- collateral_records
CREATE TABLE IF NOT EXISTS public.collateral_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_id TEXT NOT NULL UNIQUE,
  obligor TEXT NOT NULL,
  obligor_id TEXT NOT NULL,
  collateral_type public.collateral_type NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  value_tsh TEXT NOT NULL DEFAULT '0',
  facility_id TEXT NOT NULL,
  status public.collateral_status DEFAULT 'Draft'::public.collateral_status,
  registry public.registry_type DEFAULT 'N/A'::public.registry_type,
  registration_date TEXT DEFAULT '',
  perfection_deadline TEXT DEFAULT '',
  assigned_officer TEXT DEFAULT '',
  requires_perfection BOOLEAN DEFAULT true,
  days_to_deadline INTEGER,
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Ensure status column exists (guard for partial prior runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collateral_records'
      AND column_name = 'status'
  ) THEN
    ALTER TABLE public.collateral_records
      ADD COLUMN status public.collateral_status DEFAULT 'Draft'::public.collateral_status;
  END IF;
END $$;

-- Ensure collateral_type column exists (guard for DROP TYPE ... CASCADE on partial prior runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collateral_records'
      AND column_name = 'collateral_type'
  ) THEN
    ALTER TABLE public.collateral_records
      ADD COLUMN collateral_type public.collateral_type NOT NULL DEFAULT 'Mortgage'::public.collateral_type;
  END IF;
END $$;

-- Ensure registry column exists (guard for partial prior runs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'collateral_records'
      AND column_name = 'registry'
  ) THEN
    ALTER TABLE public.collateral_records
      ADD COLUMN registry public.registry_type DEFAULT 'N/A'::public.registry_type;
  END IF;
END $$;

-- audit_logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  collateral_record_id UUID REFERENCES public.collateral_records(id) ON DELETE SET NULL,
  collateral_id TEXT,
  action public.audit_action NOT NULL,
  message TEXT NOT NULL,
  detail TEXT DEFAULT '',
  performed_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  performed_by_name TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. INDEXES
CREATE INDEX IF NOT EXISTS idx_collateral_records_status ON public.collateral_records(status);
CREATE INDEX IF NOT EXISTS idx_collateral_records_type ON public.collateral_records(collateral_type);
CREATE INDEX IF NOT EXISTS idx_collateral_records_created_by ON public.collateral_records(created_by);
CREATE INDEX IF NOT EXISTS idx_collateral_records_registry ON public.collateral_records(registry);
CREATE INDEX IF NOT EXISTS idx_audit_logs_collateral_record_id ON public.audit_logs(collateral_record_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON public.user_profiles(email);

-- 4. FUNCTIONS

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$;

-- Auto-create user_profiles on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role, initials)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'credit_officer')::public.user_role,
    COALESCE(NEW.raw_user_meta_data->>'initials', upper(left(split_part(NEW.email, '@', 1), 2)))
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Role check helper (for non-user tables)
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role::TEXT FROM public.user_profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- 5. ENABLE RLS
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collateral_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 6. RLS POLICIES

-- user_profiles: own profile only
DROP POLICY IF EXISTS "users_manage_own_user_profiles" ON public.user_profiles;
CREATE POLICY "users_manage_own_user_profiles"
ON public.user_profiles
FOR ALL
TO authenticated
USING (id = auth.uid())
WITH CHECK (id = auth.uid());

-- user_profiles: allow reading other profiles (for officer assignment display)
DROP POLICY IF EXISTS "users_read_all_profiles" ON public.user_profiles;
CREATE POLICY "users_read_all_profiles"
ON public.user_profiles
FOR SELECT
TO authenticated
USING (true);

-- collateral_records: all authenticated users can read
DROP POLICY IF EXISTS "authenticated_read_collateral" ON public.collateral_records;
CREATE POLICY "authenticated_read_collateral"
ON public.collateral_records
FOR SELECT
TO authenticated
USING (true);

-- collateral_records: authenticated users can insert
DROP POLICY IF EXISTS "authenticated_insert_collateral" ON public.collateral_records;
CREATE POLICY "authenticated_insert_collateral"
ON public.collateral_records
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- collateral_records: authenticated users can update
DROP POLICY IF EXISTS "authenticated_update_collateral" ON public.collateral_records;
CREATE POLICY "authenticated_update_collateral"
ON public.collateral_records
FOR UPDATE
TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- collateral_records: only admins and legal officers can delete
DROP POLICY IF EXISTS "privileged_delete_collateral" ON public.collateral_records;
CREATE POLICY "privileged_delete_collateral"
ON public.collateral_records
FOR DELETE
TO authenticated
USING (public.get_user_role() IN ('system_admin', 'legal_officer'));

-- audit_logs: all authenticated users can read
DROP POLICY IF EXISTS "authenticated_read_audit_logs" ON public.audit_logs;
CREATE POLICY "authenticated_read_audit_logs"
ON public.audit_logs
FOR SELECT
TO authenticated
USING (true);

-- audit_logs: authenticated users can insert
DROP POLICY IF EXISTS "authenticated_insert_audit_logs" ON public.audit_logs;
CREATE POLICY "authenticated_insert_audit_logs"
ON public.audit_logs
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- 7. TRIGGERS
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

DROP TRIGGER IF EXISTS collateral_records_updated_at ON public.collateral_records;
CREATE TRIGGER collateral_records_updated_at
  BEFORE UPDATE ON public.collateral_records
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS user_profiles_updated_at ON public.user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON public.user_profiles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 8. MOCK DATA
DO $$
DECLARE
  admin_uuid UUID := gen_random_uuid();
  credit_uuid UUID := gen_random_uuid();
  legal_uuid UUID := gen_random_uuid();
  officer_uuid UUID := gen_random_uuid();
  col1_uuid UUID := gen_random_uuid();
  col2_uuid UUID := gen_random_uuid();
  col3_uuid UUID := gen_random_uuid();
  col4_uuid UUID := gen_random_uuid();
  col5_uuid UUID := gen_random_uuid();
  col6_uuid UUID := gen_random_uuid();
  col7_uuid UUID := gen_random_uuid();
  col8_uuid UUID := gen_random_uuid();
  col9_uuid UUID := gen_random_uuid();
  col10_uuid UUID := gen_random_uuid();
  col11_uuid UUID := gen_random_uuid();
  col12_uuid UUID := gen_random_uuid();
BEGIN
  -- Create auth users (trigger creates user_profiles automatically)
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    created_at, updated_at, raw_user_meta_data, raw_app_meta_data,
    is_sso_user, is_anonymous, confirmation_token, confirmation_sent_at,
    recovery_token, recovery_sent_at, email_change_token_new, email_change,
    email_change_sent_at, email_change_token_current, email_change_confirm_status,
    reauthentication_token, reauthentication_sent_at, phone, phone_change,
    phone_change_token, phone_change_sent_at
  ) VALUES
    (admin_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'admin@eximbank.co.tz', crypt('SysAdmin@2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Joshua Alkado', 'role', 'system_admin', 'initials', 'JA'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (credit_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'l.alkado@eximbank.co.tz', crypt('CreditOfficer@2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Lisa Alkado', 'role', 'credit_officer', 'initials', 'LA'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (legal_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'c.mangulu@eximbank.co.tz', crypt('LegalOfficer@2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Cornel Mangulu', 'role', 'legal_officer', 'initials', 'CM'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null),
    (officer_uuid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
     'y.frezier@eximbank.co.tz', crypt('CreditOfficer@2026', gen_salt('bf', 10)), now(), now(), now(),
     jsonb_build_object('full_name', 'Yahaya Frezier', 'role', 'credit_officer', 'initials', 'YF'),
     jsonb_build_object('provider', 'email', 'providers', ARRAY['email']::TEXT[]),
     false, false, '', null, '', null, '', '', null, '', 0, '', null, null, '', '', null)
  ON CONFLICT (id) DO NOTHING;

  -- Collateral Records
  INSERT INTO public.collateral_records (
    id, collateral_id, obligor, obligor_id, collateral_type, description,
    value_tsh, facility_id, status, registry, registration_date,
    perfection_deadline, assigned_officer, requires_perfection, days_to_deadline, created_by
  ) VALUES
    (col1_uuid, 'col-0312', 'Coastal Traders Co.', 'OBL-2024-0441', 'Mortgage'::public.collateral_type,
     'Plot 245, Block D, Kinondoni, Dar es Salaam — Title Deed Vol. 18 Folio 99',
     '780,000,000', 'TZ-FAC-2025-0441', 'Under Review'::public.collateral_status,
     'Lands Registry'::public.registry_type, '14 Apr 2026', '26 May 2026', 'Lisa Alkado', true, 31, credit_uuid),
    (col2_uuid, 'col-0311', 'Arusha Coffee Growers', 'OBL-2023-0812', 'FDR'::public.collateral_type,
     'Fixed Deposit Receipt — EXIM Bank, Account No. 0180-003-44821, 12-month tenor',
     '420,000,000', 'TZ-FAC-2025-0388', 'Perfected'::public.collateral_status,
     'N/A'::public.registry_type, '10 Apr 2026', '', 'Godfrey Woiso', false, null, credit_uuid),
    (col3_uuid, 'col-0310', 'Dodoma Real Estate Ltd', 'OBL-2022-0334', 'Mortgage'::public.collateral_type,
     'Plot 88, Chamwino District, Dodoma — Title Deed Vol. 7 Folio 22',
     '1,250,000,000', 'TZ-FAC-2024-1021', 'Perfected'::public.collateral_status,
     'Lands Registry'::public.registry_type, '02 Mar 2026', '13 Apr 2026', 'Cornel Mangulu', true, null, legal_uuid),
    (col4_uuid, 'col-0309', 'Mbeya Mining Corp.', 'OBL-2023-1107', 'Debenture'::public.collateral_type,
     'Fixed & Floating Charge over all assets — registered at BRELA',
     '8,400,000,000', 'TZ-FAC-2024-0771', 'Perfected'::public.collateral_status,
     'BRELA'::public.registry_type, '15 Feb 2026', '29 Mar 2026', 'Cornel Mangulu', true, null, legal_uuid),
    (col5_uuid, 'col-0308', 'Kilimanjaro Logistics', 'OBL-2024-0229', 'Motor Vehicle'::public.collateral_type,
     '2023 Volvo FH16 Truck — Reg. T 112 DXB · Chassis No. YV2RT40A4PA123456',
     '185,000,000', 'TZ-FAC-2024-0889', 'Monitoring'::public.collateral_status,
     'TRA'::public.registry_type, '28 Jan 2026', '11 Mar 2026', 'Yahaya Frezier', true, null, officer_uuid),
    (col6_uuid, 'col-0307', 'DSE Listed Holdings Ltd', 'OBL-2023-0594', 'Shares (DSE)'::public.collateral_type,
     '4,200,000 ordinary shares in CRDB Bank PLC — DSE Listed, pledged in favor of EXIM',
     '2,940,000,000', 'TZ-FAC-2024-0612', 'Submitted'::public.collateral_status,
     'DSE'::public.registry_type, '18 Apr 2026', '30 May 2026', 'Lisa Alkado', true, 35, credit_uuid),
    (col7_uuid, 'col-0306', 'Zanzibar Tourism Group', 'OBL-2022-0878', 'Guarantee'::public.collateral_type,
     'Corporate Guarantee from ZTG Holdings Ltd — unlimited in amount',
     '3,200,000,000', 'TZ-FAC-2024-0503', 'Perfected'::public.collateral_status,
     'N/A'::public.registry_type, '05 Dec 2025', '', 'Godfrey Woiso', false, null, credit_uuid),
    (col8_uuid, 'col-0305', 'Tanga Steel Mills', 'OBL-2023-0712', 'Shares (DSE)'::public.collateral_type,
     '1,800,000 shares in Tanzania Breweries Ltd — DSE pledge lodged',
     '2,100,000,000', 'TZ-FAC-2025-0388', 'Submitted'::public.collateral_status,
     'DSE'::public.registry_type, '20 Apr 2026', '01 Jun 2026', 'Lisa Alkado', true, 37, credit_uuid),
    (col9_uuid, 'col-0103', 'Zanzibar Spice Exports', 'OBL-2024-0099', 'Ship/Vessel'::public.collateral_type,
     'MV Spice Trader — IMO 9812344, 1,200 DWT, registered at TASAC Zanzibar',
     '6,700,000,000', 'TZ-FAC-2025-0211', 'Overdue'::public.collateral_status,
     'TASAC'::public.registry_type, '22 Mar 2026', '22 Apr 2026', 'Godfrey Woiso', true, -3, officer_uuid),
    (col10_uuid, 'col-0091', 'Dar Transport Holdings', 'OBL-2024-0155', 'Motor Vehicle'::public.collateral_type,
     '2022 Mercedes-Benz Actros 2645 · Reg. T 880 CFX · Chassis No. WDB9634031L521987',
     '320,000,000', 'TZ-FAC-2025-0034', 'Overdue'::public.collateral_status,
     'TRA'::public.registry_type, '20 Mar 2026', '20 Apr 2026', 'Lisa Alkado', true, -5, credit_uuid),
    (col11_uuid, 'col-0078', 'Mwanza Fishing Co.', 'OBL-2023-0488', 'Mortgage'::public.collateral_type,
     'Plot 14, Ilemela District, Mwanza — Title Deed Vol. 3 Folio 7',
     '1,800,000,000', 'TZ-FAC-2024-1104', 'Overdue'::public.collateral_status,
     'Lands Registry'::public.registry_type, '18 Mar 2026', '18 Apr 2026', 'Yahaya Frezier', true, -7, officer_uuid),
    (col12_uuid, 'col-0041', 'Karibu Enterprises Ltd', 'OBL-2022-0211', 'Debenture'::public.collateral_type,
     'Fixed Charge over land & buildings + floating charge over all other assets',
     '4,200,000,000', 'TZ-FAC-2024-0892', 'Overdue'::public.collateral_status,
     'BRELA'::public.registry_type, '01 Mar 2026', '13 Apr 2026', 'Lisa Alkado', true, -12, credit_uuid)
  ON CONFLICT (collateral_id) DO NOTHING;

  -- Audit Logs
  INSERT INTO public.audit_logs (
    id, collateral_record_id, collateral_id, action, message, detail, performed_by, performed_by_name
  ) VALUES
    (gen_random_uuid(), col4_uuid, 'col-0289', 'perfected'::public.audit_action,
     'Collateral col-0289 perfected at BRELA', 'Karibu Textiles Ltd · Debenture', legal_uuid, 'Cornel Mangulu'),
    (gen_random_uuid(), col1_uuid, 'col-0312', 'created'::public.audit_action,
     'New collateral registered: col-0312', 'Coastal Traders Co. · Mortgage · TSh 780M', credit_uuid, 'Lisa Alkado'),
    (gen_random_uuid(), col12_uuid, 'col-0041', 'overdue'::public.audit_action,
     'BRELA deadline missed — col-0041', 'Karibu Enterprises Ltd · 12 days overdue', admin_uuid, 'System'),
    (gen_random_uuid(), col3_uuid, 'col-0298', 'submitted'::public.audit_action,
     'Lands Registry submission filed', 'col-0298 · Mwanza Holdings · Mortgage', officer_uuid, 'Yahaya Frezier'),
    (gen_random_uuid(), col10_uuid, 'col-0271', 'perfected'::public.audit_action,
     'TRA registration confirmed: col-0271', 'Dar Transport Holdings · Motor Vehicle', legal_uuid, 'Cornel Mangulu'),
    (gen_random_uuid(), col2_uuid, 'col-0311', 'created'::public.audit_action,
     'New collateral registered: col-0311', 'Arusha Coffee Growers · FDR · TSh 420M', credit_uuid, 'Godfrey Woiso'),
    (gen_random_uuid(), col8_uuid, 'col-0305', 'submitted'::public.audit_action,
     'DSE share pledge registered', 'col-0305 · Tanga Steel Mills · Shares', credit_uuid, 'Lisa Alkado'),
    (gen_random_uuid(), col7_uuid, 'col-0244', 'released'::public.audit_action,
     'Collateral released: col-0244', 'Kilimanjaro Farms Ltd · Mortgage · Facility settled', legal_uuid, 'Cornel Mangulu')
  ON CONFLICT (id) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Mock data insertion failed: %', SQLERRM;
END $$;
