'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Shield,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Check,
  Minus,
} from 'lucide-react';
import {
  fetchRoles,
  fetchPermissions,
  fetchRolePermissions,
  createRole,
  updateRolePermissions,
  deleteRole,
  RoleDefinition,
  PermissionDefinition,
} from '@/lib/rbac';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Access Matrix ────────────────────────────────────────────────────────────

// Key modules for the access control matrix
const ACCESS_MODULES = [
  { key: 'Collateral', label: 'Collateral', description: 'View, create, edit, delete collateral records' },
  { key: 'Perfection', label: 'Perfection', description: 'Submit and review perfection workflows' },
  { key: 'Compliance', label: 'Compliance & Audit', description: 'View compliance audits and audit logs' },
  { key: 'Administration', label: 'Administration', description: 'User management, settings, roles' },
  { key: 'Dashboard', label: 'Dashboard', description: 'Access the main dashboard' },
];

interface AccessMatrixProps {
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  rolePermissionsMap: Record<string, string[]>;
  loadingRoles: Set<string>;
}

function AccessMatrix({ roles, permissions, rolePermissionsMap, loadingRoles }: AccessMatrixProps) {
  return (
    <div className="bg-white border border-border rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border bg-muted/30">
        <h3 className="text-sm font-700 text-foreground">Access Control Matrix</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Overview of module access per role. Use the Roles tab to modify permissions.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="text-left px-4 py-3 font-600 text-muted-foreground w-48">Module</th>
              {roles.map((role) => (
                <th key={role.name} className="text-center px-4 py-3 font-600 text-muted-foreground min-w-[120px]">
                  <div className="flex flex-col items-center gap-1">
                    <span>{role.label}</span>
                    {role.isSystem && (
                      <span className="text-[10px] font-500 text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
                        System
                      </span>
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ACCESS_MODULES.map((mod) => {
              const modulePerms = permissions.filter((p) => p.module === mod.key);
              return (
                <tr key={mod.key} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-500 text-foreground">{mod.label}</p>
                    <p className="text-xs text-muted-foreground">{mod.description}</p>
                  </td>
                  {roles.map((role) => {
                    if (loadingRoles.has(role.name)) {
                      return (
                        <td key={role.name} className="px-4 py-3 text-center">
                          <div className="w-5 h-5 bg-muted rounded animate-pulse mx-auto" />
                        </td>
                      );
                    }
                    const rolePerms = rolePermissionsMap[role.name] || [];
                    const hasAny = modulePerms.some((p) => rolePerms.includes(p.key));
                    const hasAll = modulePerms.length > 0 && modulePerms.every((p) => rolePerms.includes(p.key));
                    const hasPartial = hasAny && !hasAll;

                    return (
                      <td key={role.name} className="px-4 py-3 text-center">
                        {hasAll ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100">
                            <Check size={13} className="text-green-600" />
                          </span>
                        ) : hasPartial ? (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-amber-100">
                            <Minus size={13} className="text-amber-600" />
                          </span>
                        ) : (
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-50">
                            <X size={13} className="text-red-400" />
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-3 border-t border-border bg-muted/10 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-green-100"><Check size={10} className="text-green-600" /></span>
          Full access
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-amber-100"><Minus size={10} className="text-amber-600" /></span>
          Partial access
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-red-50"><X size={10} className="text-red-400" /></span>
          No access
        </span>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminRolesTab() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Role permissions map for matrix
  const [rolePermissionsMap, setRolePermissionsMap] = useState<Record<string, string[]>>({});
  const [loadingRoles, setLoadingRoles] = useState<Set<string>>(new Set());

  // Expanded role
  const [expandedRole, setExpandedRole] = useState<string | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<RoleDefinition | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ─── Data ──────────────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [rolesData, permsData] = await Promise.all([fetchRoles(), fetchPermissions()]);
      setRoles(rolesData);
      setPermissions(permsData);

      // Load all role permissions for matrix
      const newLoadingRoles = new Set(rolesData.map((r) => r.name));
      setLoadingRoles(newLoadingRoles);

      const permMap: Record<string, string[]> = {};
      await Promise.all(
        rolesData.map(async (role) => {
          try {
            const perms = await fetchRolePermissions(role.name);
            permMap[role.name] = perms;
          } catch {
            permMap[role.name] = [];
          }
        })
      );
      setRolePermissionsMap(permMap);
      setLoadingRoles(new Set());
    } catch (err: any) {
      showToast('Failed to load roles: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Modal helpers ─────────────────────────────────────────────────────────

  async function openCreateModal() {
    setEditingRole(null);
    setFormName('');
    setFormLabel('');
    setFormDescription('');
    setFormColor('blue');
    setFormPermissions([]);
    setFormError(null);
    setModalOpen(true);
  }

  async function openEditModal(role: RoleDefinition) {
    setEditingRole(role);
    setFormName(role.name);
    setFormLabel(role.label);
    setFormDescription(role.description);
    setFormColor(role.color);
    setFormError(null);
    try {
      const perms = await fetchRolePermissions(role.name);
      setFormPermissions(perms);
    } catch {
      setFormPermissions([]);
    }
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingRole(null);
    setFormError(null);
  }

  function toggleFormPermission(key: string) {
    setFormPermissions((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  function toggleModulePermissions(modulePerms: PermissionDefinition[]) {
    const keys = modulePerms.map((p) => p.key);
    const allSelected = keys.every((k) => formPermissions.includes(k));
    if (allSelected) {
      setFormPermissions((prev) => prev.filter((k) => !keys.includes(k)));
    } else {
      setFormPermissions((prev) => [...new Set([...prev, ...keys])]);
    }
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setFormError(null);

    if (!formLabel.trim()) {
      setFormError('Role label is required.');
      return;
    }

    if (!editingRole) {
      if (!formName.trim()) {
        setFormError('Role name (identifier) is required.');
        return;
      }
      if (!/^[a-z][a-z0-9_]*$/.test(formName)) {
        setFormError('Role name must be lowercase letters, numbers, and underscores only.');
        return;
      }
      if (roles.some((r) => r.name === formName)) {
        setFormError('A role with this name already exists.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingRole) {
        await updateRolePermissions(editingRole.name, formPermissions);
        showToast(`Permissions for "${editingRole.label}" updated.`, 'success');
        setRolePermissionsMap((prev) => ({ ...prev, [editingRole.name]: formPermissions }));
      } else {
        await createRole(formName, formLabel, formDescription, formColor, formPermissions);
        showToast(`Role "${formLabel}" created successfully.`, 'success');
      }
      closeModal();
      loadData(true);
    } catch (err: any) {
      setFormError(err.message || 'Failed to save role.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteRole(deleteTarget.name);
      showToast(`Role "${deleteTarget.label}" deleted.`, 'success');
      setDeleteTarget(null);
      loadData(true);
    } catch (err: any) {
      showToast('Failed to delete role: ' + err.message, 'error');
    } finally {
      setDeleting(false);
    }
  }

  const permissionsByModule = permissions.reduce<Record<string, PermissionDefinition[]>>(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    },
    {}
  );

  const COLOR_OPTIONS = ['blue', 'purple', 'amber', 'green', 'red', 'gray', 'teal', 'indigo'];
  const colorBgMap: Record<string, string> = {
    blue: 'bg-blue-100 text-blue-700',
    purple: 'bg-purple-100 text-purple-700',
    amber: 'bg-amber-100 text-amber-700',
    green: 'bg-green-100 text-green-700',
    red: 'bg-red-100 text-red-700',
    gray: 'bg-gray-100 text-gray-700',
    teal: 'bg-teal-100 text-teal-700',
    indigo: 'bg-indigo-100 text-indigo-700',
  };

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ?'bg-green-50 border border-green-200 text-green-800' :'bg-red-50 border border-red-200 text-red-800'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={16} className="shrink-0 text-green-600" />
          ) : (
            <AlertCircle size={16} className="shrink-0 text-red-600" />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Define roles and control access to collateral, exports, and audit functions
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={16} />
            New Role
          </button>
        </div>
      </div>

      {/* Access Matrix */}
      {!loading && (
        <AccessMatrix
          roles={roles}
          permissions={permissions}
          rolePermissionsMap={rolePermissionsMap}
          loadingRoles={loadingRoles}
        />
      )}

      {/* Roles List */}
      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-20 bg-muted rounded-xl animate-pulse" />
          ))
        ) : roles.length === 0 ? (
          <div className="bg-white border border-border rounded-xl px-4 py-12 text-center text-muted-foreground">
            <Shield size={32} className="mx-auto mb-2 opacity-30" />
            <p className="font-medium">No roles defined</p>
          </div>
        ) : (
          roles.map((role) => {
            const colorClass = colorBgMap[role.color] || colorBgMap['gray'];
            const isExpanded = expandedRole === role.name;
            const rolePerms = rolePermissionsMap[role.name] || [];

            return (
              <div key={role.id} className="bg-white border border-border rounded-xl overflow-hidden">
                {/* Role Header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colorClass}`}>
                      <Shield size={15} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-700 text-foreground">{role.label}</p>
                        {role.isSystem && (
                          <span className="text-[10px] font-600 px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                            System
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground hidden sm:block">
                      {rolePerms.length} permission{rolePerms.length !== 1 ? 's' : ''}
                    </span>
                    <button
                      onClick={() => openEditModal(role)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                      title="Edit permissions"
                    >
                      <Edit2 size={14} />
                    </button>
                    {!role.isSystem && (
                      <button
                        onClick={() => setDeleteTarget(role)}
                        className="p-1.5 rounded-md hover:bg-red-50 text-muted-foreground hover:text-red-600 transition-colors"
                        title="Delete role"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                    <button
                      onClick={() => setExpandedRole(isExpanded ? null : role.name)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {/* Expanded Permissions */}
                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-muted/20">
                    {loadingRoles.has(role.name) ? (
                      <div className="h-8 bg-muted rounded animate-pulse" />
                    ) : rolePerms.length === 0 ? (
                      <p className="text-xs text-muted-foreground">No permissions assigned to this role.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {rolePerms.map((key) => {
                          const perm = permissions.find((p) => p.key === key);
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-500 bg-primary/10 text-primary"
                            >
                              {perm?.label || key}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg z-10 flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-700 text-foreground">
                {editingRole ? `Edit Permissions — ${editingRole.label}` : 'Create New Role'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {!editingRole && (
                <>
                  <div>
                    <label className="block text-xs font-600 text-foreground mb-1.5">
                      Role Identifier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                      placeholder="e.g. compliance_officer"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary font-mono"
                    />
                    <p className="text-xs text-muted-foreground mt-1">Lowercase letters, numbers, underscores only.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-600 text-foreground mb-1.5">
                      Display Label <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formLabel}
                      onChange={(e) => setFormLabel(e.target.value)}
                      placeholder="e.g. Compliance Officer"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-600 text-foreground mb-1.5">Description</label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief description of this role"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-600 text-foreground mb-1.5">Badge Color</label>
                    <div className="flex flex-wrap gap-2">
                      {COLOR_OPTIONS.map((c) => (
                        <button
                          key={c}
                          onClick={() => setFormColor(c)}
                          className={`px-3 py-1 rounded-full text-xs font-600 transition-all ${colorBgMap[c]} ${
                            formColor === c ? 'ring-2 ring-offset-1 ring-primary' : ''
                          }`}
                        >
                          {c}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Permissions */}
              <div>
                <label className="block text-xs font-600 text-foreground mb-2">
                  Permissions
                </label>
                <div className="space-y-3">
                  {Object.entries(permissionsByModule).map(([module, perms]) => {
                    const allSelected = perms.every((p) => formPermissions.includes(p.key));
                    const someSelected = perms.some((p) => formPermissions.includes(p.key));
                    return (
                      <div key={module} className="border border-border rounded-lg overflow-hidden">
                        <div
                          className="flex items-center justify-between px-3 py-2 bg-muted/30 cursor-pointer"
                          onClick={() => toggleModulePermissions(perms)}
                        >
                          <p className="text-xs font-700 text-foreground uppercase tracking-wider">{module}</p>
                          <div
                            className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                              allSelected
                                ? 'bg-primary border-primary'
                                : someSelected
                                ? 'bg-primary/30 border-primary/50' :'border-border bg-white'
                            }`}
                          >
                            {allSelected && <Check size={10} className="text-white" />}
                            {someSelected && !allSelected && <Minus size={10} className="text-primary" />}
                          </div>
                        </div>
                        <div className="divide-y divide-border">
                          {perms.map((p) => {
                            const checked = formPermissions.includes(p.key);
                            return (
                              <label
                                key={p.key}
                                className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-muted/30 transition-colors"
                              >
                                <div>
                                  <p className="text-sm font-500 text-foreground">{p.label}</p>
                                  <p className="text-xs text-muted-foreground">{p.description}</p>
                                </div>
                                <input
                                  type="checkbox"
                                  checked={checked}
                                  onChange={() => toggleFormPermission(p.key)}
                                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20 ml-3 shrink-0"
                                />
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
              <button
                onClick={closeModal}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
                {editingRole ? 'Save Permissions' : 'Create Role'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm z-10 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <Trash2 size={18} className="text-red-600" />
              </div>
              <div>
                <h3 className="text-sm font-700 text-foreground">Delete Role</h3>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-5">
              Are you sure you want to delete the <strong>{deleteTarget.label}</strong> role? Users with this role will lose their permissions.
            </p>
            <div className="flex items-center justify-end gap-2">
              <button
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete Role
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
