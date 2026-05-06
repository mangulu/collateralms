-- Grant settings.view permission to credit_officer role
-- This restores the Settings section visibility in the sidebar for Credit Officers

INSERT INTO public.role_permissions (role_name, permission_key)
VALUES ('credit_officer', 'settings.view')
ON CONFLICT (role_name, permission_key) DO NOTHING;
