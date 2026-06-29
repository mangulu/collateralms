/**
 * RBAC — Role-Based Access Control
 *
 * Permissions are seeded in the DB (roles / permissions / role_permissions tables).
 * This file provides:
 *  - Static permission key constants
 *  - Screen-to-permission mapping for UI guards
 *  - A hook to load the current user's permissions from Supabase
 *  - Helper functions used by UI components
 */

import { createClient } from '@/lib/supabase/client';
import { useEffect, useState, useCallback } from 'react';

// ─── Permission Keys ──────────────────────────────────────────────────────────

export const PERMISSIONS = {
  // Dashboard
  DASHBOARD_VIEW: 'dashboard.view',
  // Collateral
  COLLATERAL_VIEW: 'collateral.view',
  COLLATERAL_CREATE: 'collateral.create',
  COLLATERAL_EDIT: 'collateral.edit',
  COLLATERAL_DELETE: 'collateral.delete',
  // Perfection
  PERFECTION_VIEW: 'perfection.view',
  PERFECTION_SUBMIT: 'perfection.submit',
  PERFECTION_REVIEW: 'perfection.review',
  // Compliance
  COMPLIANCE_VIEW: 'compliance.view',
  AUDIT_LOG_VIEW: 'audit_log.view',
  REPORTS_VIEW: 'reports.view',
  // Administration
  USER_MANAGEMENT_VIEW: 'user_management.view',
  USER_MANAGEMENT_MANAGE: 'user_management.manage',
  SETTINGS_VIEW: 'settings.view',
  SETTINGS_MANAGE: 'settings.manage',
  ROLES_VIEW: 'roles.view',
  ROLES_MANAGE: 'roles.manage',
} as const;

export type PermissionKey = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ─── Role Types ───────────────────────────────────────────────────────────────

export type BuiltInRole = 'credit_officer' | 'legal_officer' | 'system_admin';

export interface RoleDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  isSystem: boolean;
  color: string;
  createdAt: string;
}

export interface PermissionDefinition {
  id: string;
  key: string;
  label: string;
  description: string;
  module: string;
}

// ─── Role Display Helpers ─────────────────────────────────────────────────────

export const ROLE_LABELS: Record<string, string> = {
  credit_officer: 'Credit Officer',
  legal_officer: 'Legal Officer',
  system_admin: 'System Admin',
};

export const ROLE_COLORS: Record<string, string> = {
  credit_officer: 'blue',
  legal_officer: 'purple',
  system_admin: 'amber',
};

/** Human-readable label for a role name */
export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

// ─── Screen Permission Map ────────────────────────────────────────────────────
// Maps each screen route to the permission key required to access it.
// Used by page components for client-side access guards.

export const SCREEN_PERMISSIONS: Record<string, PermissionKey> = {
  '/collateral-dashboard': PERMISSIONS.DASHBOARD_VIEW,
  '/portfolio-monitoring': PERMISSIONS.DASHBOARD_VIEW,
  '/collateral-management': PERMISSIONS.COLLATERAL_VIEW,
  '/collateral-detail': PERMISSIONS.COLLATERAL_VIEW,
  '/perfection-workflow': PERMISSIONS.PERFECTION_VIEW,
  '/collateral-documents': PERMISSIONS.COLLATERAL_VIEW,
  '/batch-release': PERMISSIONS.COLLATERAL_EDIT,
  '/bulk-upload': PERMISSIONS.COLLATERAL_EDIT,
  '/scheduled-jobs': PERMISSIONS.COLLATERAL_EDIT,
  '/fraud-prevention': PERMISSIONS.COMPLIANCE_VIEW,
  '/risk-assessment': PERMISSIONS.COMPLIANCE_VIEW,
  '/fast-track': PERMISSIONS.COLLATERAL_VIEW,
  '/geomapping': PERMISSIONS.COLLATERAL_VIEW,
  '/compliance-rules': PERMISSIONS.COMPLIANCE_VIEW,
  '/compliance-audit': PERMISSIONS.COMPLIANCE_VIEW,
  '/notifications-hub': PERMISSIONS.DASHBOARD_VIEW,
  '/alerts-inbox': PERMISSIONS.DASHBOARD_VIEW,
  '/alerts-delivery': PERMISSIONS.DASHBOARD_VIEW,
  '/live-activity': PERMISSIONS.AUDIT_LOG_VIEW,
  '/audit-trail': PERMISSIONS.AUDIT_LOG_VIEW,
  '/audit-log': PERMISSIONS.AUDIT_LOG_VIEW,
  '/activity-log': PERMISSIONS.AUDIT_LOG_VIEW,
  '/audit-report': PERMISSIONS.AUDIT_LOG_VIEW,
  '/reports': PERMISSIONS.REPORTS_VIEW,
  '/reports-dashboard': PERMISSIONS.REPORTS_VIEW,
  '/export': PERMISSIONS.REPORTS_VIEW,
  '/user-management': PERMISSIONS.USER_MANAGEMENT_VIEW,
  '/admin': PERMISSIONS.USER_MANAGEMENT_VIEW,
  '/settings': PERMISSIONS.SETTINGS_VIEW,
};

// ─── Hook: usePermissions ─────────────────────────────────────────────────────

export interface UsePermissionsResult {
  permissions: Set<string>;
  role: string | null;
  loading: boolean;
  hasPermission: (key: string) => boolean;
  isSystemAdmin: boolean;
  isCreditOfficer: boolean;
  isLegalOfficer: boolean;
  canDelete: boolean;
  canReviewPerfection: boolean;
  canSubmitPerfection: boolean;
}

export function usePermissions(): UsePermissionsResult {
  const [permissions, setPermissions] = useState<Set<string>>(new Set());
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const loadPermissions = useCallback(async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setPermissions(new Set());
        setRole(null);
        setLoading(false);
        return;
      }

      // Fetch user role from user_profiles
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (!profile) {
        setLoading(false);
        return;
      }

      const userRole = profile.role as string;
      setRole(userRole);

      // Fetch permissions for this role
      const { data: rolePerms } = await supabase
        .from('role_permissions')
        .select('permission_key')
        .eq('role_name', userRole);

      const permSet = new Set<string>(
        (rolePerms || []).map((rp: { permission_key: string }) => rp.permission_key)
      );
      setPermissions(permSet);
    } catch {
      // Silently fail — no permissions
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      loadPermissions();
    });

    return () => subscription.unsubscribe();
  }, [loadPermissions]);

  const isSystemAdmin = role === 'system_admin';
  const isCreditOfficer = role === 'credit_officer';
  const isLegalOfficer = role === 'legal_officer';

  return {
    permissions,
    role,
    loading,
    hasPermission: (key: string) => permissions.has(key),
    isSystemAdmin,
    isCreditOfficer,
    isLegalOfficer,
    // Derived convenience flags
    canDelete: isSystemAdmin || isLegalOfficer,
    canReviewPerfection: isSystemAdmin || isLegalOfficer,
    canSubmitPerfection: isSystemAdmin || isCreditOfficer,
  };
}

// ─── Role Service ─────────────────────────────────────────────────────────────

export async function fetchRoles(): Promise<RoleDefinition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('roles')
    .select('*')
    .order('is_system', { ascending: false })
    .order('created_at', { ascending: true });

  if (error) throw error;

  return (data || []).map((r) => ({
    id: r.id,
    name: r.name,
    label: r.label,
    description: r.description,
    isSystem: r.is_system,
    color: r.color,
    createdAt: r.created_at,
  }));
}

export async function fetchPermissions(): Promise<PermissionDefinition[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('permissions')
    .select('*')
    .order('module', { ascending: true })
    .order('label', { ascending: true });

  if (error) throw error;

  return (data || []).map((p) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    description: p.description,
    module: p.module,
  }));
}

export async function fetchRolePermissions(roleName: string): Promise<string[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('role_permissions')
    .select('permission_key')
    .eq('role_name', roleName);

  if (error) throw error;
  return (data || []).map((rp) => rp.permission_key);
}

export async function createRole(
  name: string,
  label: string,
  description: string,
  color: string,
  permissionKeys: string[]
): Promise<void> {
  const supabase = createClient();

  const { error: roleError } = await supabase.from('roles').insert({
    name,
    label,
    description,
    color,
    is_system: false,
  });
  if (roleError) throw roleError;

  if (permissionKeys.length > 0) {
    const rows = permissionKeys.map((key) => ({ role_name: name, permission_key: key }));
    const { error: permError } = await supabase.from('role_permissions').insert(rows);
    if (permError) throw permError;
  }
}

export async function updateRolePermissions(
  roleName: string,
  permissionKeys: string[]
): Promise<void> {
  const supabase = createClient();

  // Delete existing
  const { error: delError } = await supabase
    .from('role_permissions')
    .delete()
    .eq('role_name', roleName);
  if (delError) throw delError;

  // Insert new
  if (permissionKeys.length > 0) {
    const rows = permissionKeys.map((key) => ({ role_name: roleName, permission_key: key }));
    const { error: insError } = await supabase.from('role_permissions').insert(rows);
    if (insError) throw insError;
  }
}

export async function deleteRole(roleName: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('roles').delete().eq('name', roleName);
  if (error) throw error;
}

// ─── Color helpers ────────────────────────────────────────────────────────────

export function getRoleColorClass(color: string): string {
  const map: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
  };
  return map[color] ?? 'bg-gray-100 text-gray-700';
}

function getRoleColorClasses(...args: any[]): any {
  // eslint-disable-next-line no-console
  console.warn('Placeholder: getRoleColorClasses is not implemented yet.', args);
  return null;
}

export { getRoleColorClasses };
const ROLE_COLOR_OPTIONS: any = null;

export { ROLE_COLOR_OPTIONS };