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

  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, string[]>>({});
  const [loadingPerms, setLoadingPerms] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [formName, setFormName] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formDescription, setFormDescription] = useState('');
  const [formColor, setFormColor] = useState('blue');
  const [formPermissions, setFormPermissions] = useState<string[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

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

  // ─── Expand role ──────────────────────────────────────────────────────────

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
          <h1 className="text-2xl font-700 text-foreground">Roles &amp; Permissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Define roles and control which permissions each role has.
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
      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-16 bg-muted rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {roles.map((role) => {
            const colors = getRoleColorClasses(role.color);
            const isExpanded = expandedRole === role.name;
            const perms = rolePermissions[role.name] ?? [];

            return (
              <div key={role.name} className="border border-border rounded-xl overflow-hidden bg-white">
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg ${colors.bg} flex items-center justify-center shrink-0`}>
                      <Shield size={15} className={colors.text} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-600 text-foreground">{role.label}</p>
                        {role.isSystem && (
                          <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground border border-border rounded px-1.5 py-0.5">
                            <Lock size={9} /> System
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{role.description}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
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
                      onClick={() => toggleExpand(role.name)}
                      className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                    </button>
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-border px-4 py-3 bg-muted/20">
                    {loadingPerms === role.name ? (
                      <div className="h-8 bg-muted rounded animate-pulse w-48" />
                    ) : perms.length === 0 ? (
                      <p className="text-xs text-muted-foreground italic">No permissions assigned.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {perms.map((key) => {
                          const pDef = permissions.find((p) => p.key === key);
                          return (
                            <span
                              key={key}
                              className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-primary/10 text-primary font-500"
                            >
                              {pDef?.label ?? key}
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
      )}

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg z-10 max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
              <h2 className="text-base font-700 text-foreground">
                {editingRole ? `Edit Permissions — ${editingRole.label}` : 'Create New Role'}
              </h2>
              <button onClick={closeModal} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors">
                <X size={16} />
              </button>
            </div>

            <div className="px-5 py-4 space-y-4 overflow-y-auto flex-1">
              {!editingRole && (
                <>
                  <div>
                    <label className="block text-xs font-600 text-foreground mb-1.5">
                      Role Identifier <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formName}
                      onChange={(e) => setFormName(e.target.value)}
                      placeholder="e.g. branch_manager"
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
                      placeholder="e.g. Branch Manager"
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
                    <label className="block text-xs font-600 text-foreground mb-1.5">Color</label>
                    <div className="flex gap-2 flex-wrap">
                      {(ROLE_COLOR_OPTIONS || []).map((opt: { value: string; label: string }) => {
                        const c = getRoleColorClasses(opt.value);
                        return (
                          <button
                            key={opt.value}
                            type="button"
                            onClick={() => setFormColor(opt.value)}
                            className={`px-3 py-1 rounded-full text-xs font-600 border-2 transition-all ${c.bg} ${c.text} ${
                              formColor === opt.value ? 'border-primary' : 'border-transparent'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              )}

              {/* Permissions */}
              <div>
                <label className="block text-xs font-600 text-foreground mb-2">Permissions</label>
                <div className="space-y-3">
                  {Object.entries(permissionsByModule).map(([module, perms]) => (
                    <div key={module}>
                      <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide mb-1.5">{module}</p>
                      <div className="space-y-1">
                        {perms.map((p) => (
                          <label key={p.key} className="flex items-start gap-2.5 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={formPermissions.includes(p.key)}
                              onChange={() => toggleFormPermission(p.key)}
                              className="mt-0.5 w-3.5 h-3.5 accent-primary rounded"
                            />
                            <div>
                              <p className="text-xs font-500 text-foreground group-hover:text-primary transition-colors">{p.label}</p>
                              <p className="text-[10px] text-muted-foreground">{p.description}</p>
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
                <p className="text-sm font-700 text-foreground">Delete Role</p>
                <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-5">
              Are you sure you want to delete the <strong>{deleteTarget.label}</strong> role? All associated permissions will be removed.
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
