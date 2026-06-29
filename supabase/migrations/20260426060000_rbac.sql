-- ============================================================
-- CollateralMS — Role-Based Access Control (RBAC)
-- ============================================================

-- 1. CUSTOM ROLES TABLE
-- Stores both built-in and admin-created roles
CREATE TABLE IF NOT EXISTS public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_system BOOLEAN DEFAULT false,  -- true = built-in, cannot be deleted
  color TEXT DEFAULT 'gray',
  created_by UUID REFERENCES public.user_profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 2. PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  module TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 3. ROLE_PERMISSIONS JUNCTION TABLE
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_name TEXT NOT NULL REFERENCES public.roles(name) ON DELETE CASCADE,
  permission_key TEXT NOT NULL REFERENCES public.permissions(key) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_name, permission_key)
);

-- 4. INDEXES
CREATE INDEX IF NOT EXISTS idx_roles_name ON public.roles(name);
CREATE INDEX IF NOT EXISTS idx_permissions_module ON public.permissions(module);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_name ON public.role_permissions(role_name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_permission_key ON public.role_permissions(permission_key);

-- 5. FUNCTIONS

-- Get all permissions for a given role name
CREATE OR REPLACE FUNCTION public.get_role_permissions(p_role_name TEXT)
RETURNS TABLE(permission_key TEXT)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT rp.permission_key
  FROM public.role_permissions rp
  WHERE rp.role_name = p_role_name;
$$;

-- Check if current user has a specific permission
CREATE OR REPLACE FUNCTION public.user_has_permission(p_permission_key TEXT)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_profiles up
    JOIN public.role_permissions rp ON rp.role_name = up.role::TEXT
    WHERE up.id = auth.uid()
      AND rp.permission_key = p_permission_key
  );
$$;

-- 6. ENABLE RLS
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- 7. RLS POLICIES

-- roles: all authenticated users can read
DROP POLICY IF EXISTS "authenticated_read_roles" ON public.roles;
CREATE POLICY "authenticated_read_roles"
ON public.roles FOR SELECT TO authenticated USING (true);

-- roles: only system_admin can insert/update/delete
DROP POLICY IF EXISTS "admin_manage_roles" ON public.roles;
CREATE POLICY "admin_manage_roles"
ON public.roles FOR ALL TO authenticated
USING (public.get_user_role() = 'system_admin')
WITH CHECK (public.get_user_role() = 'system_admin');

-- permissions: all authenticated users can read
DROP POLICY IF EXISTS "authenticated_read_permissions" ON public.permissions;
CREATE POLICY "authenticated_read_permissions"
ON public.permissions FOR SELECT TO authenticated USING (true);

-- permissions: only system_admin can manage
DROP POLICY IF EXISTS "admin_manage_permissions" ON public.permissions;
CREATE POLICY "admin_manage_permissions"
ON public.permissions FOR ALL TO authenticated
USING (public.get_user_role() = 'system_admin')
WITH CHECK (public.get_user_role() = 'system_admin');

-- role_permissions: all authenticated users can read
DROP POLICY IF EXISTS "authenticated_read_role_permissions" ON public.role_permissions;
CREATE POLICY "authenticated_read_role_permissions"
ON public.role_permissions FOR SELECT TO authenticated USING (true);

-- role_permissions: only system_admin can manage
DROP POLICY IF EXISTS "admin_manage_role_permissions" ON public.role_permissions;
CREATE POLICY "admin_manage_role_permissions"
ON public.role_permissions FOR ALL TO authenticated
USING (public.get_user_role() = 'system_admin')
WITH CHECK (public.get_user_role() = 'system_admin');

-- 8. TRIGGERS
DROP TRIGGER IF EXISTS roles_updated_at ON public.roles;
CREATE TRIGGER roles_updated_at
  BEFORE UPDATE ON public.roles
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- 9. SEED DATA — built-in roles and permissions

DO $$
BEGIN
  -- ── Seed built-in roles ──────────────────────────────────────────────────
  INSERT INTO public.roles (name, label, description, is_system, color)
  VALUES
    ('credit_officer', 'Credit Officer', 'Manages collateral records and submissions', true, 'blue'),
    ('legal_officer',  'Legal Officer',  'Reviews and approves perfection workflows', true, 'purple'),
    ('system_admin',   'System Admin',   'Full system access and administration',      true, 'amber')
  ON CONFLICT (name) DO UPDATE
    SET label       = EXCLUDED.label,
        description = EXCLUDED.description,
        is_system   = EXCLUDED.is_system,
        color       = EXCLUDED.color;

  -- ── Seed permissions ─────────────────────────────────────────────────────
  INSERT INTO public.permissions (key, label, description, module)
  VALUES
    -- Dashboard
    ('dashboard.view',                'View Dashboard',              'Access the main collateral dashboard',         'Dashboard'),
    -- Collateral
    ('collateral.view',               'View Collateral',             'View collateral records',                      'Collateral'),
    ('collateral.create',             'Create Collateral',           'Add new collateral records',                   'Collateral'),
    ('collateral.edit',               'Edit Collateral',             'Modify existing collateral records',           'Collateral'),
    ('collateral.delete',             'Delete Collateral',           'Remove collateral records',                    'Collateral'),
    -- Perfection Workflow
    ('perfection.view',               'View Perfection Workflow',    'Access perfection workflow screen',            'Perfection'),
    ('perfection.submit',             'Submit Perfection Request',   'Submit new perfection requests',               'Perfection'),
    ('perfection.review',             'Review Perfection Request',   'Approve or reject perfection requests',        'Perfection'),
    -- Compliance & Audit
    ('compliance.view',               'View Compliance Audit',       'Access compliance audit screen',               'Compliance'),
    ('audit_log.view',                'View Audit Log',              'Access the audit log',                         'Compliance'),
    ('reports.view',                  'View Reports',                'Access reports and analytics',                 'Compliance'),
    -- Administration
    ('user_management.view',          'View User Management',        'Access user management screen',                'Administration'),
    ('user_management.manage',        'Manage Users',                'Create, edit, and deactivate users',           'Administration'),
    ('settings.view',                 'View Settings',               'Access system settings',                       'Administration'),
    ('settings.manage',               'Manage Settings',             'Modify system settings',                       'Administration'),
    ('roles.view',                    'View Roles',                  'View role definitions',                        'Administration'),
    ('roles.manage',                  'Manage Roles',                'Create and edit custom roles',                 'Administration')
  ON CONFLICT (key) DO UPDATE
    SET label       = EXCLUDED.label,
        description = EXCLUDED.description,
        module      = EXCLUDED.module;

  -- ── Seed role_permissions for credit_officer ─────────────────────────────
  INSERT INTO public.role_permissions (role_name, permission_key)
  VALUES
    ('credit_officer', 'dashboard.view'),
    ('credit_officer', 'collateral.view'),
    ('credit_officer', 'collateral.create'),
    ('credit_officer', 'collateral.edit'),
    ('credit_officer', 'perfection.view'),
    ('credit_officer', 'perfection.submit'),
    ('credit_officer', 'compliance.view'),
    ('credit_officer', 'audit_log.view'),
    ('credit_officer', 'reports.view'),
    ('credit_officer', 'settings.view')
  ON CONFLICT (role_name, permission_key) DO NOTHING;

  -- ── Seed role_permissions for legal_officer ──────────────────────────────
  INSERT INTO public.role_permissions (role_name, permission_key)
  VALUES
    ('legal_officer', 'dashboard.view'),
    ('legal_officer', 'collateral.view'),
    ('legal_officer', 'collateral.create'),
    ('legal_officer', 'collateral.edit'),
    ('legal_officer', 'collateral.delete'),
    ('legal_officer', 'perfection.view'),
    ('legal_officer', 'perfection.submit'),
    ('legal_officer', 'perfection.review'),
    ('legal_officer', 'compliance.view'),
    ('legal_officer', 'audit_log.view'),
    ('legal_officer', 'reports.view'),
    ('legal_officer', 'settings.view')
  ON CONFLICT (role_name, permission_key) DO NOTHING;

  -- ── Seed role_permissions for system_admin (all permissions) ─────────────
  INSERT INTO public.role_permissions (role_name, permission_key)
  SELECT 'system_admin', key FROM public.permissions
  ON CONFLICT (role_name, permission_key) DO NOTHING;

EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'RBAC seed failed: %', SQLERRM;
END $$;
