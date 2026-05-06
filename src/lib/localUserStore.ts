'use client';

/**
 * Local User Store
 * ─────────────────────────────────────────────────────────────────────────────
 * Manages users, roles, permissions, and screen-access rules entirely in
 * memory (with localStorage persistence).  No Supabase Auth is used here.
 *
 * This module is the single source of truth for all user/role/permission data
 * until Supabase Auth is wired up in a later phase.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = 'credit_officer' | 'legal_officer' | 'system_admin';

export interface LocalUser {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  initials: string;
  isActive: boolean;
  password: string; // stored plaintext for demo only
  createdAt: string;
  updatedAt: string;
}

export interface LocalRole {
  id: string;
  name: string;
  label: string;
  description: string;
  isSystem: boolean;
  color: string;
  createdAt: string;
}

export interface LocalPermission {
  id: string;
  key: string;
  label: string;
  description: string;
  module: string;
}

export interface LocalRolePermission {
  roleName: string;
  permissionKey: string;
}

// Key: `${screenId}:${roleName}:${actionKey}` → boolean
export type ScreenAccessMatrix = Record<string, boolean>;

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  USERS: 'cms_local_users',
  ROLES: 'cms_local_roles',
  ROLE_PERMISSIONS: 'cms_local_role_permissions',
  SCREEN_ACCESS: 'cms_local_screen_access',
};

// ─── Seed Data ────────────────────────────────────────────────────────────────

const SEED_USERS: LocalUser[] = [
  {
    id: 'usr-001',
    email: 'j.kamau@eximbank.co.tz',
    fullName: 'James Kamau',
    role: 'credit_officer',
    initials: 'JK',
    isActive: true,
    password: 'CreditOfficer@2026',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'usr-002',
    email: 'a.mwangi@eximbank.co.tz',
    fullName: 'Amina Mwangi',
    role: 'legal_officer',
    initials: 'AM',
    isActive: true,
    password: 'LegalOfficer@2026',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  },
  {
    id: 'usr-003',
    email: 'admin@eximbank.co.tz',
    fullName: 'System Administrator',
    role: 'system_admin',
    initials: 'SA',
    isActive: true,
    password: 'SysAdmin@2026',
    createdAt: '2026-01-10T08:00:00.000Z',
    updatedAt: '2026-01-10T08:00:00.000Z',
  },
];

const SEED_ROLES: LocalRole[] = [
  {
    id: 'role-001',
    name: 'credit_officer',
    label: 'Credit Officer',
    description: 'Creates and edits collateral records, submits perfection requests.',
    isSystem: true,
    color: 'blue',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role-002',
    name: 'legal_officer',
    label: 'Legal Officer',
    description: 'Reviews and approves perfection workflows, manages legal documents.',
    isSystem: true,
    color: 'purple',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 'role-003',
    name: 'system_admin',
    label: 'System Admin',
    description: 'Full system access including user management, settings, and audit logs.',
    isSystem: true,
    color: 'amber',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const ALL_PERMISSION_KEYS = [
  'dashboard.view',
  'collateral.view',
  'collateral.create',
  'collateral.edit',
  'collateral.delete',
  'perfection.view',
  'perfection.submit',
  'perfection.review',
  'compliance.view',
  'audit_log.view',
  'reports.view',
  'user_management.view',
  'user_management.manage',
  'settings.view',
  'settings.manage',
  'roles.view',
  'roles.manage',
];

const SEED_PERMISSIONS: LocalPermission[] = [
  { id: 'p-01', key: 'dashboard.view', label: 'View Dashboard', description: 'Access the main dashboard', module: 'Dashboard' },
  { id: 'p-02', key: 'collateral.view', label: 'View Collateral', description: 'View collateral records', module: 'Collateral' },
  { id: 'p-03', key: 'collateral.create', label: 'Create Collateral', description: 'Create new collateral records', module: 'Collateral' },
  { id: 'p-04', key: 'collateral.edit', label: 'Edit Collateral', description: 'Edit existing collateral records', module: 'Collateral' },
  { id: 'p-05', key: 'collateral.delete', label: 'Delete Collateral', description: 'Delete collateral records', module: 'Collateral' },
  { id: 'p-06', key: 'perfection.view', label: 'View Perfection', description: 'View perfection workflows', module: 'Perfection' },
  { id: 'p-07', key: 'perfection.submit', label: 'Submit Perfection', description: 'Submit perfection requests', module: 'Perfection' },
  { id: 'p-08', key: 'perfection.review', label: 'Review Perfection', description: 'Review and approve perfection requests', module: 'Perfection' },
  { id: 'p-09', key: 'compliance.view', label: 'View Compliance', description: 'Access compliance and fraud modules', module: 'Compliance' },
  { id: 'p-10', key: 'audit_log.view', label: 'View Audit Logs', description: 'Access audit trail and activity logs', module: 'Audit' },
  { id: 'p-11', key: 'reports.view', label: 'View Reports', description: 'Access reports and export features', module: 'Reports' },
  { id: 'p-12', key: 'user_management.view', label: 'View Users', description: 'View user accounts', module: 'Administration' },
  { id: 'p-13', key: 'user_management.manage', label: 'Manage Users', description: 'Create, edit, and deactivate users', module: 'Administration' },
  { id: 'p-14', key: 'settings.view', label: 'View Settings', description: 'Access system settings', module: 'Administration' },
  { id: 'p-15', key: 'settings.manage', label: 'Manage Settings', description: 'Modify system settings', module: 'Administration' },
  { id: 'p-16', key: 'roles.view', label: 'View Roles', description: 'View roles and permissions', module: 'Administration' },
  { id: 'p-17', key: 'roles.manage', label: 'Manage Roles', description: 'Create and edit roles and permissions', module: 'Administration' },
];

const SEED_ROLE_PERMISSIONS: LocalRolePermission[] = [
  // Credit Officer
  { roleName: 'credit_officer', permissionKey: 'dashboard.view' },
  { roleName: 'credit_officer', permissionKey: 'collateral.view' },
  { roleName: 'credit_officer', permissionKey: 'collateral.create' },
  { roleName: 'credit_officer', permissionKey: 'collateral.edit' },
  { roleName: 'credit_officer', permissionKey: 'perfection.view' },
  { roleName: 'credit_officer', permissionKey: 'perfection.submit' },
  { roleName: 'credit_officer', permissionKey: 'compliance.view' },
  { roleName: 'credit_officer', permissionKey: 'reports.view' },
  { roleName: 'credit_officer', permissionKey: 'settings.view' },
  // Legal Officer
  { roleName: 'legal_officer', permissionKey: 'dashboard.view' },
  { roleName: 'legal_officer', permissionKey: 'collateral.view' },
  { roleName: 'legal_officer', permissionKey: 'collateral.edit' },
  { roleName: 'legal_officer', permissionKey: 'collateral.delete' },
  { roleName: 'legal_officer', permissionKey: 'perfection.view' },
  { roleName: 'legal_officer', permissionKey: 'perfection.review' },
  { roleName: 'legal_officer', permissionKey: 'compliance.view' },
  { roleName: 'legal_officer', permissionKey: 'audit_log.view' },
  { roleName: 'legal_officer', permissionKey: 'reports.view' },
  { roleName: 'legal_officer', permissionKey: 'settings.view' },
  // System Admin — all permissions
  ...ALL_PERMISSION_KEYS.map((key) => ({ roleName: 'system_admin', permissionKey: key })),
];

// ─── localStorage helpers ─────────────────────────────────────────────────────

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

function load<T>(key: string, seed: T): T {
  if (!isBrowser()) return seed;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return seed;
    return JSON.parse(raw) as T;
  } catch {
    return seed;
  }
}

function save<T>(key: string, value: T): void {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // ignore quota errors
  }
}

// ─── Initialise store (call once on app start) ────────────────────────────────

export function initLocalStore(): void {
  if (!isBrowser()) return;
  if (!localStorage.getItem(KEYS.USERS)) save(KEYS.USERS, SEED_USERS);
  if (!localStorage.getItem(KEYS.ROLES)) save(KEYS.ROLES, SEED_ROLES);
  if (!localStorage.getItem(KEYS.ROLE_PERMISSIONS)) save(KEYS.ROLE_PERMISSIONS, SEED_ROLE_PERMISSIONS);
}

// ─── Users ────────────────────────────────────────────────────────────────────

export function getUsers(): LocalUser[] {
  return load<LocalUser[]>(KEYS.USERS, SEED_USERS);
}

export function getUserByEmail(email: string): LocalUser | undefined {
  return getUsers().find((u) => u.email.toLowerCase() === email.toLowerCase());
}

export function getUserById(id: string): LocalUser | undefined {
  return getUsers().find((u) => u.id === id);
}

export function createUser(data: Omit<LocalUser, 'id' | 'createdAt' | 'updatedAt'>): LocalUser {
  const users = getUsers();
  const now = new Date().toISOString();
  const newUser: LocalUser = {
    ...data,
    id: `usr-${Date.now()}`,
    createdAt: now,
    updatedAt: now,
  };
  save(KEYS.USERS, [...users, newUser]);
  return newUser;
}

export function updateUser(id: string, patch: Partial<Omit<LocalUser, 'id' | 'createdAt'>>): void {
  const users = getUsers().map((u) =>
    u.id === id ? { ...u, ...patch, updatedAt: new Date().toISOString() } : u
  );
  save(KEYS.USERS, users);
}

export function deleteUser(id: string): void {
  save(KEYS.USERS, getUsers().filter((u) => u.id !== id));
}

// ─── Roles ────────────────────────────────────────────────────────────────────

export function getRoles(): LocalRole[] {
  return load<LocalRole[]>(KEYS.ROLES, SEED_ROLES);
}

export function createLocalRole(role: Omit<LocalRole, 'id' | 'createdAt'>): LocalRole {
  const roles = getRoles();
  const newRole: LocalRole = {
    ...role,
    id: `role-${Date.now()}`,
    createdAt: new Date().toISOString(),
  };
  save(KEYS.ROLES, [...roles, newRole]);
  return newRole;
}

export function deleteLocalRole(roleName: string): void {
  save(KEYS.ROLES, getRoles().filter((r) => r.name !== roleName));
  // Also remove associated permissions
  save(
    KEYS.ROLE_PERMISSIONS,
    getRolePermissions().filter((rp) => rp.roleName !== roleName)
  );
}

// ─── Permissions ──────────────────────────────────────────────────────────────

export function getPermissions(): LocalPermission[] {
  return SEED_PERMISSIONS; // permissions list is static
}

// ─── Role Permissions ─────────────────────────────────────────────────────────

export function getRolePermissions(): LocalRolePermission[] {
  return load<LocalRolePermission[]>(KEYS.ROLE_PERMISSIONS, SEED_ROLE_PERMISSIONS);
}

export function getPermissionsForRole(roleName: string): string[] {
  return getRolePermissions()
    .filter((rp) => rp.roleName === roleName)
    .map((rp) => rp.permissionKey);
}

export function setRolePermissions(roleName: string, permissionKeys: string[]): void {
  const others = getRolePermissions().filter((rp) => rp.roleName !== roleName);
  const newEntries: LocalRolePermission[] = permissionKeys.map((key) => ({
    roleName,
    permissionKey: key,
  }));
  save(KEYS.ROLE_PERMISSIONS, [...others, ...newEntries]);
}

// ─── Screen Access ────────────────────────────────────────────────────────────

export function getScreenAccessMatrix(): ScreenAccessMatrix {
  return load<ScreenAccessMatrix>(KEYS.SCREEN_ACCESS, {});
}

export function saveScreenAccessMatrix(matrix: ScreenAccessMatrix): void {
  save(KEYS.SCREEN_ACCESS, matrix);
}

// ─── Auth helper ──────────────────────────────────────────────────────────────

export function authenticateUser(email: string, password: string): LocalUser | null {
  const user = getUserByEmail(email);
  if (!user) return null;
  if (!user.isActive) return null;
  if (user.password !== password) return null;
  return user;
}

// ─── Session (localStorage + cookie for middleware) ───────────────────────────

const SESSION_KEY = 'cms_local_session';
const SESSION_COOKIE = 'cms_local_session_cookie';

export interface LocalSession {
  userId: string;
  email: string;
  role: UserRole;
  fullName: string;
  initials: string;
  loggedInAt: string;
}

export function getLocalSession(): LocalSession | null {
  if (!isBrowser()) return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    return raw ? (JSON.parse(raw) as LocalSession) : null;
  } catch {
    return null;
  }
}

export function setLocalSession(user: LocalUser): void {
  const session: LocalSession = {
    userId: user.id,
    email: user.email,
    role: user.role,
    fullName: user.fullName,
    initials: user.initials,
    loggedInAt: new Date().toISOString(),
  };
  save(SESSION_KEY, session);
  // Also write a cookie so the middleware (server-side) can read the session
  if (isBrowser()) {
    document.cookie = `${SESSION_COOKIE}=${encodeURIComponent(JSON.stringify(session))}; path=/; SameSite=Lax`;
  }
}

export function clearLocalSession(): void {
  if (!isBrowser()) return;
  localStorage.removeItem(SESSION_KEY);
  // Expire the cookie
  document.cookie = `${SESSION_COOKIE}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`;
}
