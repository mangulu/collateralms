'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Shield,
  UserCheck,
  UserX,
  ChevronDown,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import {
  getUsers,
  createUser,
  updateUser,
  UserRole,
  LocalUser,
} from '@/lib/localUserStore';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  initials: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

interface UserFormData {
  email: string;
  fullName: string;
  role: UserRole;
  password: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

const roleConfig: Record<UserRole, { label: string; color: string; bg: string }> = {
  credit_officer: {
    label: 'Credit Officer',
    color: 'text-blue-700',
    bg: 'bg-blue-100',
  },
  legal_officer: {
    label: 'Legal Officer',
    color: 'text-purple-700',
    bg: 'bg-purple-100',
  },
  system_admin: {
    label: 'System Admin',
    color: 'text-amber-700',
    bg: 'bg-amber-100',
  },
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'credit_officer', label: 'Credit Officer' },
  { value: 'legal_officer', label: 'Legal Officer' },
  { value: 'system_admin', label: 'System Admin' },
];

// ─── Toast ────────────────────────────────────────────────────────────────────

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapUser(u: LocalUser): UserProfile {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName,
    role: u.role,
    initials: u.initials || getInitials(u.fullName || u.email),
    isActive: u.isActive,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserManagementContent() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toast, setToast] = useState<ToastState | null>(null);

  // Modal state
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [formData, setFormData] = useState<UserFormData>({
    email: '',
    fullName: '',
    role: 'credit_officer',
    password: '',
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchUsers = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const data = getUsers();
      setUsers(data.map(mapUser));
    } catch {
      showToast('Failed to load users', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  // ─── Toast ──────────────────────────────────────────────────────────────────

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Modal Helpers ──────────────────────────────────────────────────────────

  function openCreateModal() {
    setEditingUser(null);
    setFormData({ email: '', fullName: '', role: 'credit_officer', password: '' });
    setFormError(null);
    setModalOpen(true);
  }

  function openEditModal(user: UserProfile) {
    setEditingUser(user);
    setFormData({ email: user.email, fullName: user.fullName, role: user.role, password: '' });
    setFormError(null);
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditingUser(null);
    setFormError(null);
  }

  // ─── Save User ──────────────────────────────────────────────────────────────

  function handleSave() {
    setFormError(null);

    if (!formData.fullName.trim()) {
      setFormError('Full name is required.');
      return;
    }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormError('A valid email address is required.');
      return;
    }
    if (!editingUser && !formData.password.trim()) {
      setFormError('Password is required for new users.');
      return;
    }
    if (!editingUser && formData.password.length < 8) {
      setFormError('Password must be at least 8 characters.');
      return;
    }

    setSaving(true);
    try {
      if (editingUser) {
        const initials = getInitials(formData.fullName);
        updateUser(editingUser.id, {
          fullName: formData.fullName.trim(),
          role: formData.role,
          initials,
        });
        showToast('User updated successfully.', 'success');
      } else {
        // Check for duplicate email
        const existing = getUsers().find(
          (u) => u.email.toLowerCase() === formData.email.trim().toLowerCase()
        );
        if (existing) {
          setFormError('A user with this email already exists.');
          setSaving(false);
          return;
        }
        const initials = getInitials(formData.fullName);
        createUser({
          email: formData.email.trim(),
          fullName: formData.fullName.trim(),
          role: formData.role,
          initials,
          isActive: true,
          password: formData.password,
        });
        showToast('User created successfully.', 'success');
      }
      closeModal();
      fetchUsers(true);
    } catch (err: any) {
      setFormError('Unexpected error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  // ─── Toggle Status ──────────────────────────────────────────────────────────

  function handleToggleStatus(user: UserProfile) {
    const newStatus = !user.isActive;
    try {
      updateUser(user.id, { isActive: newStatus });
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, isActive: newStatus } : u))
      );
      showToast(
        `${user.fullName} has been ${newStatus ? 'activated' : 'deactivated'}.`,
        'success'
      );
    } catch {
      showToast('Unexpected error updating status', 'error');
    }
  }

  // ─── Filtered Users ─────────────────────────────────────────────────────────

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      !searchQuery ||
      u.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? u.isActive : !u.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // ─── KPI Counts ─────────────────────────────────────────────────────────────

  const totalUsers = users.length;
  const creditOfficers = users.filter((u) => u.role === 'credit_officer').length;
  const legalOfficers = users.filter((u) => u.role === 'legal_officer').length;
  const activeUsers = users.filter((u) => u.isActive).length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium transition-all ${
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
          <h1 className="text-2xl font-700 text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Manage Credit Officers, Legal Officers, and System Admins
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchUsers(true)}
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
            Add User
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: totalUsers, icon: Users, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Credit Officers', value: creditOfficers, icon: UserCheck, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Legal Officers', value: legalOfficers, icon: Shield, color: 'text-purple-600', bg: 'bg-purple-50' },
          { label: 'Active Accounts', value: activeUsers, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
        ].map((kpi) => {
          const KpiIcon = kpi.icon;
          return (
            <div key={kpi.label} className="bg-white border border-border rounded-xl p-4 flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg ${kpi.bg} flex items-center justify-center shrink-0`}>
                <KpiIcon size={18} className={kpi.color} />
              </div>
              <div>
                <p className="text-2xl font-700 text-foreground">{loading ? '—' : kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white border border-border rounded-xl p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
          </div>
          <div className="relative">
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">All Roles</option>
              {ROLE_OPTIONS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
          <div className="relative">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
              className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
            <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-border rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className="text-left px-4 py-3 font-600 text-muted-foreground">User</th>
                <th className="text-left px-4 py-3 font-600 text-muted-foreground">Role</th>
                <th className="text-left px-4 py-3 font-600 text-muted-foreground hidden md:table-cell">Email</th>
                <th className="text-left px-4 py-3 font-600 text-muted-foreground hidden lg:table-cell">Created</th>
                <th className="text-center px-4 py-3 font-600 text-muted-foreground">Status</th>
                <th className="text-right px-4 py-3 font-600 text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                      </div>
                    </td>
                    <td className="px-4 py-3"><div className="h-5 w-24 bg-muted rounded-full animate-pulse" /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><div className="h-4 w-40 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3 hidden lg:table-cell"><div className="h-4 w-20 bg-muted rounded animate-pulse" /></td>
                    <td className="px-4 py-3 text-center"><div className="h-5 w-16 bg-muted rounded-full animate-pulse mx-auto" /></td>
                    <td className="px-4 py-3 text-right"><div className="h-7 w-20 bg-muted rounded animate-pulse ml-auto" /></td>
                  </tr>
                ))
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    <Users size={32} className="mx-auto mb-2 opacity-30" />
                    <p className="font-medium">No users found</p>
                    <p className="text-xs mt-1">Try adjusting your filters or add a new user.</p>
                  </td>
                </tr>
              ) : (
                filteredUsers.map((user) => {
                  const rc = roleConfig[user.role];
                  return (
                    <tr key={user.id} className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
                            <span className="text-white text-xs font-600">{user.initials}</span>
                          </div>
                          <span className="font-500 text-foreground">{user.fullName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-600 ${rc.bg} ${rc.color}`}>
                          {rc.label}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground hidden md:table-cell">{user.email}</td>
                      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{formatDate(user.createdAt)}</td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-600 ${
                            user.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {user.isActive ? (
                            <><UserCheck size={11} /> Active</>
                          ) : (
                            <><UserX size={11} /> Inactive</>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => openEditModal(user)}
                            className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                            title="Edit user"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            onClick={() => handleToggleStatus(user)}
                            className={`p-1.5 rounded-md transition-colors ${
                              user.isActive
                                ? 'hover:bg-red-50 text-muted-foreground hover:text-red-600'
                                : 'hover:bg-green-50 text-muted-foreground hover:text-green-600'
                            }`}
                            title={user.isActive ? 'Deactivate user' : 'Activate user'}
                          >
                            {user.isActive ? <ToggleRight size={16} /> : <ToggleLeft size={16} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!loading && filteredUsers.length > 0 && (
          <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
            Showing {filteredUsers.length} of {users.length} users
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} />
          <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md z-10">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <h2 className="text-base font-700 text-foreground">
                {editingUser ? 'Edit User' : 'Add New User'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              >
                <X size={16} />
              </button>
            </div>
            <div className="px-5 py-4 space-y-4">
              <div>
                <label className="block text-xs font-600 text-foreground mb-1.5">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.fullName}
                  onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                  placeholder="e.g. Lisa Alkado"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                />
              </div>
              <div>
                <label className="block text-xs font-600 text-foreground mb-1.5">
                  Email Address <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                  placeholder="user@eximbank.co.tz"
                  disabled={!!editingUser}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary disabled:bg-muted disabled:text-muted-foreground"
                />
                {editingUser && (
                  <p className="text-xs text-muted-foreground mt-1">Email cannot be changed after account creation.</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-600 text-foreground mb-1.5">
                  Role <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <select
                    value={formData.role}
                    onChange={(e) => setFormData((p) => ({ ...p, role: e.target.value as UserRole }))}
                    className="w-full appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white"
                  >
                    {ROLE_OPTIONS.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                  <ChevronDown size={14} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                </div>
              </div>
              {!editingUser && (
                <div>
                  <label className="block text-xs font-600 text-foreground mb-1.5">
                    Temporary Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                    placeholder="Min. 8 characters"
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    The user will use this password to sign in.
                  </p>
                </div>
              )}
              {formError && (
                <div className="flex items-start gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertCircle size={15} className="shrink-0 mt-0.5" />
                  {formError}
                </div>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border">
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
                {saving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {editingUser ? 'Save Changes' : 'Create User'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
