/**
 * RBAC — Role-Based Access Control
 *
 * Permissions are managed locally (localUserStore).
 * This file provides:
 *  - Static permission key constants
 *  - Screen-to-permission mapping for UI guards
 *  - A hook to load the current user's permissions from the local session
 *  - Helper functions used by UI components
 */

import { useEffect, useState, useCallback } from 'react';
import { getLocalSession, getPermissionsForRole, getRoles, getPermissions, createLocalRole, deleteLocalRole, setRolePermissions, LocalRole, LocalPermission,  } from '@/lib/localUserStore';

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

  const loadPermissions = useCallback(() => {
    try {
      const session = getLocalSession();
      if (!session) {
        setPermissions(new Set());
        setRole(null);
        setLoading(false);
        return;
      }
      const userRole = session.role;
      setRole(userRole);
      const permKeys = getPermissionsForRole(userRole);
      setPermissions(new Set(permKeys));
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPermissions();
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
    canDelete: isSystemAdmin || isLegalOfficer,
    canReviewPerfection: isSystemAdmin || isLegalOfficer,
    canSubmitPerfection: isSystemAdmin || isCreditOfficer,
  };
}

// ─── Role Service (local) ─────────────────────────────────────────────────────

export async function fetchRoles(): Promise<RoleDefinition[]> {
  return getRoles().map((r: LocalRole) => ({
    id: r.id,
    name: r.name,
    label: r.label,
    description: r.description,
    isSystem: r.isSystem,
    color: r.color,
    createdAt: r.createdAt,
  }));
}

export async function fetchPermissions(): Promise<PermissionDefinition[]> {
  return getPermissions().map((p: LocalPermission) => ({
    id: p.id,
    key: p.key,
    label: p.label,
    description: p.description,
    module: p.module,
  }));
}

export async function fetchRolePermissions(roleName: string): Promise<string[]> {
  return getPermissionsForRole(roleName);
}

export async function createRole(
  name: string,
  label: string,
  description: string,
  color: string,
  permissionKeys: string[]
): Promise<void> {
  createLocalRole({ name, label, description, color, isSystem: false });
  if (permissionKeys.length > 0) {
    setRolePermissions(name, permissionKeys);
  }
}

export async function updateRolePermissions(
  roleName: string,
  permissionKeys: string[]
): Promise<void> {
  setRolePermissions(roleName, permissionKeys);
}

export async function deleteRole(roleName: string): Promise<void> {
  deleteLocalRole(roleName);
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

export function getRoleColorClasses(color: string): { bg: string; text: string } {
  const map: Record<string, { bg: string; text: string }> = {
    blue: { bg: 'bg-blue-100', text: 'text-blue-700' },
    purple: { bg: 'bg-purple-100', text: 'text-purple-700' },
    amber: { bg: 'bg-amber-100', text: 'text-amber-700' },
    green: { bg: 'bg-green-100', text: 'text-green-700' },
    red: { bg: 'bg-red-100', text: 'text-red-700' },
    gray: { bg: 'bg-gray-100', text: 'text-gray-700' },
  };
  return map[color] ?? { bg: 'bg-gray-100', text: 'text-gray-700' };
}

export const ROLE_COLOR_OPTIONS = [
  { value: 'blue', label: 'Blue' },
  { value: 'purple', label: 'Purple' },
  { value: 'amber', label: 'Amber' },
  { value: 'green', label: 'Green' },
  { value: 'red', label: 'Red' },
  { value: 'gray', label: 'Gray' },
];