-- ============================================================
-- CollateralMS — Fix RBAC Seed & Admin Role
-- Re-seeds roles, permissions, role_permissions tables
-- and ensures admin user has system_admin role
-- ============================================================

-- Step 1: Re-seed built-in roles (idempotent)
INSERT INTO public.roles (name, label, description, is_system, color)
VALUES
  ('credit_officer', 'Credit Officer', 'Manages collateral records and submissions', true, 'blue'),
  ('legal_officer',  'Legal Officer',  'Reviews and approves perfection workflows',  true, 'purple'),
  ('system_admin',   'System Admin',   'Full system access and administration',       true, 'amber')
ON CONFLICT (name) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      is_system   = EXCLUDED.is_system,
      color       = EXCLUDED.color;

-- Step 2: Re-seed permissions (idempotent)
INSERT INTO public.permissions (key, label, description, module)
VALUES
  ('dashboard.view',          'View Dashboard',           'Access the main collateral dashboard',    'Dashboard'),
  ('collateral.view',         'View Collateral',          'View collateral records',                 'Collateral'),
  ('collateral.create',       'Create Collateral',        'Add new collateral records',              'Collateral'),
  ('collateral.edit',         'Edit Collateral',          'Modify existing collateral records',      'Collateral'),
  ('collateral.delete',       'Delete Collateral',        'Remove collateral records',               'Collateral'),
  ('perfection.view',         'View Perfection Workflow', 'Access perfection workflow screen',       'Perfection'),
  ('perfection.submit',       'Submit Perfection Request','Submit new perfection requests',          'Perfection'),
  ('perfection.review',       'Review Perfection Request','Approve or reject perfection requests',   'Perfection'),
  ('compliance.view',         'View Compliance Audit',    'Access compliance audit screen',          'Compliance'),
  ('audit_log.view',          'View Audit Log',           'Access the audit log',                    'Compliance'),
  ('reports.view',            'View Reports',             'Access reports and analytics',            'Compliance'),
  ('reports.create',          'Create Reports',           'Generate and export reports',             'Compliance'),
  ('user_management.view',    'View User Management',     'Access user management screen',           'Administration'),
  ('user_management.manage',  'Manage Users',             'Create, edit, and deactivate users',      'Administration'),
  ('settings.view',           'View Settings',            'Access system settings',                  'Administration'),
  ('settings.manage',         'Manage Settings',          'Modify system settings',                  'Administration'),
  ('roles.view',              'View Roles',               'View role definitions',                   'Administration'),
  ('roles.manage',            'Manage Roles',             'Create and edit custom roles',            'Administration')
ON CONFLICT (key) DO UPDATE
  SET label       = EXCLUDED.label,
      description = EXCLUDED.description,
      module      = EXCLUDED.module;

-- Step 3: Seed role_permissions for credit_officer
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

-- Step 4: Seed role_permissions for legal_officer
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

-- Step 5: Seed role_permissions for system_admin (all permissions)
INSERT INTO public.role_permissions (role_name, permission_key)
SELECT 'system_admin', key FROM public.permissions
ON CONFLICT (role_name, permission_key) DO NOTHING;

-- Step 6: Fix admin user profile role to system_admin
DO $$
BEGIN
  -- Fix by email (covers all cases regardless of UUID)
  UPDATE public.user_profiles
  SET role      = 'system_admin'::public.user_role,
      updated_at = CURRENT_TIMESTAMP
  WHERE email = 'admin@collateralms.com'
    AND role != 'system_admin'::public.user_role;

  IF FOUND THEN
    RAISE NOTICE 'Admin user role corrected to system_admin.';
  ELSE
    RAISE NOTICE 'Admin user already has system_admin role or does not exist.';
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Admin role fix failed: %', SQLERRM;
END $$;
