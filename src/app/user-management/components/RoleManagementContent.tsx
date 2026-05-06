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
  Lock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  fetchRoles,
  fetchPermissions,
  fetchRolePermissions,
  createRole,
  updateRolePermissions,
  deleteRole,
  getRoleColorClasses,
  ROLE_COLOR_OPTIONS,
  RoleDefinition,
  PermissionDefinition,
} from '@/lib/rbac';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function RoleManagementContent() {
  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [permissions, setPermissions] = useState<PermissionDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);

  // Expanded role for permission view
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [loadingPerms, setLoadingPerms] = useState<string | null>(null);

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

  // ─── Expand role to show permissions ──────────────────────────────────────

  async function toggleExpand(roleName: string) {
    if (expandedRole === roleName) {
      setExpandedRole(null);
      return;
    }
    setExpandedRole(roleName);
    if (!rolePermissions[roleName]) {
      setLoadingPerms(roleName);
      try {
        const perms = await fetchRolePermissions(roleName);
        setRolePermissions((prev) => ({ ...prev, [roleName]: perms }));
      } catch {
        showToast('Failed to load permissions', 'error');
      } finally {
        setLoadingPerms(null);
      }
    }
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
    // Load current permissions
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

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setFormError(null);

    if (!formLabel.trim()) {
      setFormError('Role label is required.');
      return;
    }

    if (!editingRole) {
      // Validate name
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
        // Invalidate cached permissions for this role
        setRolePermissions((prev) => {
          const next = { ...prev };
          delete next[editingRole.name];
          return next;
        });
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

  // ─── Group permissions by module ──────────────────────────────────────────

  const permissionsByModule = permissions.reduce<Record<string, PermissionDefinition[]>>(
    (acc, p) => {
      if (!acc[p.module]) acc[p.module] = [];
      acc[p.module].push(p);
      return acc;
    },
    {}
  );

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
        <div>
          <h2 className="text-lg font-700 text-foreground">Role Management</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define roles and their permissions. System roles cannot be deleted.
          </p>
        </div>
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

      {/* Roles List */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white border border-border rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-4 w-32 bg-muted rounded" />
                    <div className="h-3 w-48 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))
          : roles.map((role) => {
              const colors = getRoleColorClasses(role.color);
              const isExpanded = expandedRole === role.name;
              const perms = rolePermissions[role.name] || [];

              return (
                <div
                  key={role.id}
                  className="bg-white border border-border rounded-xl overflow-hidden"
                >
                  {/* Role Header Row */}
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div
                      className={`w-9 h-9 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}
                    >
                      <Shield size={16} className={colors.text} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-600 text-foreground text-sm">{role.label}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-500 ${colors.bg} ${colors.text}`}
                        >
                          {role.name}
                        </span>
                        {role.isSystem && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                            <Lock size={10} />
                            System
                          </span>
                        )}
                      </div>
                      {role.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {role.description}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => toggleExpand(role.name)}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-md hover:bg-muted transition-colors"
                      >
                        Permissions
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
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
                    </div>
                  </div>

                  {/* Expanded Permissions */}
                  {isExpanded && (
                    <div className="border-t border-border px-4 py-3 bg-muted/20">
                      {loadingPerms === role.name ? (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <RefreshCw size={13} className="animate-spin" />
                          Loading permissions…
                        </div>
                      ) : perms.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No permissions assigned.</p>
                      ) : (
                        <div className="flex flex-wrap gap-1.5">
                          {perms.map((pk) => {
                            const pDef = permissions.find((p) => p.key === pk);
                            return (
                              <span
                                key={pk}
                                className="text-xs px-2 py-0.5 rounded-full bg-primary/10 text-primary font-500"
                              >
                                {pDef?.label ?? pk}
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg z-10 max-h-[90vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-700 text-foreground">
                {editingRole ? `Edit Permissions — ${editingRole.label}` : 'Create New Role'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            {/* Body */}
            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {/* Name + Label (create only) */}
              {!editingRole && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-600 text-foreground mb-1.5">
                        Role Name (ID) <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                        placeholder="e.g. branch_manager"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Lowercase, underscores only
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs font-600 text-foreground mb-1.5">
                        Display Label <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={formLabel}
                        onChange={(e) => setFormLabel(e.target.value)}
                        placeholder="e.g. Branch Manager"
                        className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-600 text-foreground mb-1.5">
                      Description
                    </label>
                    <input
                      type="text"
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Brief description of this role"
                      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    />
                  </div>

                  {/* Color */}
                  <div>
                    <label className="block text-xs font-600 text-foreground mb-1.5">
                      Badge Color
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {ROLE_COLOR_OPTIONS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => setFormColor(c.value)}
                          className={`w-7 h-7 rounded-full ${c.bg} border-2 transition-all ${
                            formColor === c.value
                              ? 'border-foreground scale-110'
                              : 'border-transparent hover:scale-105'
                          }`}
                          title={c.value}
                        />
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* Permissions by module */}
              <div>
                <label className="block text-xs font-600 text-foreground mb-2">
                  Permissions
                </label>
                <div className="space-y-3">
                  {Object.entries(permissionsByModule).map(([module, perms]) => (
                    <div key={module} className="border border-border rounded-lg overflow-hidden">
                      <div className="px-3 py-2 bg-muted/40 text-xs font-600 text-muted-foreground uppercase tracking-wide">
                        {module}
                      </div>
                      <div className="p-3 grid grid-cols-1 gap-2">
                        {perms.map((perm) => (
                          <label
                            key={perm.key}
                            className="flex items-start gap-2.5 cursor-pointer group"
                          >
                            <input
                              type="checkbox"
                              checked={formPermissions.includes(perm.key)}
                              onChange={() => toggleFormPermission(perm.key)}
                              className="mt-0.5 rounded border-border text-primary focus:ring-primary/20"
                            />
                            <div>
                              <span className="text-sm font-500 text-foreground group-hover:text-primary transition-colors">
                                {perm.label}
                              </span>
                              {perm.description && (
                                <p className="text-xs text-muted-foreground">{perm.description}</p>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {formError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}
            </div>

            {/* Footer */}
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

      {/* Delete Confirm Modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDeleteTarget(null)} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm z-10 p-5">
            <h3 className="text-base font-700 text-foreground mb-2">Delete Role</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Are you sure you want to delete the{' '}
              <span className="font-600 text-foreground">{deleteTarget.label}</span> role? Users
              assigned this role will lose their permissions.
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
