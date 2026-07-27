'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Users,
  Plus,
  Search,
  Edit2,
  RefreshCw,
  Shield,
  UserCheck,
  UserX,
  X,
  Save,
  AlertCircle,
  CheckCircle2,
  Eye,
  FileEdit,
  ArrowUpCircle,
  BadgeCheck,
  Calendar,
  ChevronDown,
  Activity,
  Filter,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type OfficerRole = 'legal_officer' | 'supervisor' | 'system_admin';

interface OfficerPermissions {
  canView: boolean;
  canEdit: boolean;
  canEscalate: boolean;
  canApprove: boolean;
}

interface Officer {
  id: string;
  email: string;
  fullName: string;
  role: OfficerRole;
  initials: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  permissions: OfficerPermissions;
}

interface OfficerFormData {
  email: string;
  fullName: string;
  role: OfficerRole;
  password: string;
  permissions: OfficerPermissions;
}

interface AuditEntry {
  id: string;
  officerName: string;
  officerEmail: string;
  action: string;
  module: string;
  details: string;
  createdAt: string;
  ipAddress?: string;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<OfficerRole, { label: string; color: string; bg: string; border: string }> = {
  legal_officer: { label: 'Legal Officer', color: 'text-purple-700', bg: 'bg-purple-50', border: 'border-purple-200' },
  supervisor: { label: 'Supervisor', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
  system_admin: { label: 'Admin', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
};

const DEFAULT_PERMISSIONS_BY_ROLE: Record<OfficerRole, OfficerPermissions> = {
  legal_officer: { canView: true, canEdit: false, canEscalate: true, canApprove: false },
  supervisor: { canView: true, canEdit: true, canEscalate: true, canApprove: false },
  system_admin: { canView: true, canEdit: true, canEscalate: true, canApprove: true },
};

const PERMISSION_DEFS = [
  {
    key: 'canView' as keyof OfficerPermissions,
    label: 'View',
    description: 'Access records, reports, and audit trails',
    icon: Eye,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    key: 'canEdit' as keyof OfficerPermissions,
    label: 'Edit',
    description: 'Create and modify collateral records and documents',
    icon: FileEdit,
    color: 'text-green-600',
    bg: 'bg-green-50',
    border: 'border-green-200',
  },
  {
    key: 'canEscalate' as keyof OfficerPermissions,
    label: 'Escalate',
    description: 'Escalate cases and flag items for senior review',
    icon: ArrowUpCircle,
    color: 'text-orange-600',
    bg: 'bg-orange-50',
    border: 'border-orange-200',
  },
  {
    key: 'canApprove' as keyof OfficerPermissions,
    label: 'Approve',
    description: 'Approve workflows, releases, and document sign-offs',
    icon: BadgeCheck,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Officer Form Modal ───────────────────────────────────────────────────────

interface OfficerFormModalProps {
  officer: Officer | null;
  onClose: () => void;
  onSaved: () => void;
  showToast: (msg: string, type: 'success' | 'error') => void;
}

function OfficerFormModal({ officer, onClose, onSaved, showToast }: OfficerFormModalProps) {
  const supabase = createClient();
  const isEdit = !!officer;

  const [formData, setFormData] = useState<OfficerFormData>({
    email: officer?.email ?? '',
    fullName: officer?.fullName ?? '',
    role: officer?.role ?? 'legal_officer',
    password: '',
    permissions: officer?.permissions ?? DEFAULT_PERMISSIONS_BY_ROLE['legal_officer'],
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function handleRoleChange(role: OfficerRole) {
    setFormData((prev) => ({
      ...prev,
      role,
      permissions: DEFAULT_PERMISSIONS_BY_ROLE[role],
    }));
  }

  function togglePermission(key: keyof OfficerPermissions) {
    setFormData((prev) => ({
      ...prev,
      permissions: { ...prev.permissions, [key]: !prev.permissions[key] },
    }));
  }

  async function handleSave() {
    setFormError(null);
    if (!formData.fullName.trim()) { setFormError('Full name is required.'); return; }
    if (!formData.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setFormError('A valid email address is required.'); return;
    }
    if (!isEdit && !formData.password.trim()) { setFormError('Password is required for new officers.'); return; }
    if (!isEdit && formData.password.length < 8) { setFormError('Password must be at least 8 characters.'); return; }

    setSaving(true);
    try {
      if (isEdit) {
        const { error } = await supabase
          .from('user_profiles')
          .update({
            full_name: formData.fullName.trim(),
            role: formData.role,
            initials: getInitials(formData.fullName),
            officer_permissions: formData.permissions,
            updated_at: new Date().toISOString(),
          })
          .eq('id', officer!.id);
        if (error) { setFormError('Failed to update officer: ' + error.message); return; }
        showToast('Officer updated successfully.', 'success');
      } else {
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email: formData.email.trim(),
          password: formData.password,
          options: { data: { full_name: formData.fullName.trim() } },
        });
        if (signUpError) { setFormError('Failed to create officer: ' + signUpError.message); return; }
        const newUserId = signUpData?.user?.id;
        if (newUserId) {
          await supabase.from('user_profiles').upsert(
            {
              id: newUserId,
              email: formData.email.trim(),
              full_name: formData.fullName.trim(),
              role: formData.role,
              initials: getInitials(formData.fullName),
              is_active: true,
              officer_permissions: formData.permissions,
            },
            { onConflict: 'id' }
          );
        }
        showToast('Officer created successfully.', 'success');
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setFormError('Unexpected error: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-lg z-10 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users size={16} className="text-primary" />
            </div>
            <div>
              <p className="text-sm font-700 text-foreground">{isEdit ? 'Edit Officer' : 'Create Officer'}</p>
              <p className="text-xs text-muted-foreground">{isEdit ? `Editing ${officer!.fullName}` : 'Add a new officer to the system'}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Basic Info */}
          <div className="space-y-3">
            <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Officer Details</p>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Full Name *</label>
              <input
                type="text"
                value={formData.fullName}
                onChange={(e) => setFormData((p) => ({ ...p, fullName: e.target.value }))}
                placeholder="e.g. Jane Mwangi"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-600 text-foreground mb-1">Email Address *</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                disabled={isEdit}
                placeholder="officer@bank.co.tz"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white disabled:bg-muted disabled:text-muted-foreground"
              />
            </div>
            {!isEdit && (
              <div>
                <label className="block text-xs font-600 text-foreground mb-1">Password *</label>
                <input
                  type="password"
                  value={formData.password}
                  onChange={(e) => setFormData((p) => ({ ...p, password: e.target.value }))}
                  placeholder="Min. 8 characters"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                />
              </div>
            )}
          </div>

          {/* Role Assignment */}
          <div className="space-y-2">
            <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Assign Role</p>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(ROLE_CONFIG) as OfficerRole[]).map((role) => {
                const cfg = ROLE_CONFIG[role];
                const selected = formData.role === role;
                return (
                  <button
                    key={role}
                    onClick={() => handleRoleChange(role)}
                    className={`px-3 py-2.5 rounded-lg border text-xs font-600 transition-all text-center ${
                      selected
                        ? `${cfg.bg} ${cfg.border} ${cfg.color} ring-2 ring-offset-1 ring-current/30`
                        : 'bg-white border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Permissions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-700 text-muted-foreground uppercase tracking-wider">Role Permissions</p>
              <span className="text-xs text-muted-foreground">Defaults auto-applied by role</span>
            </div>
            <div className="bg-muted/30 rounded-lg border border-border divide-y divide-border">
              {PERMISSION_DEFS.map((perm) => {
                const PermIcon = perm.icon;
                const enabled = formData.permissions[perm.key];
                return (
                  <label
                    key={perm.key}
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center ${perm.bg} ${perm.border} border`}>
                        <PermIcon size={13} className={perm.color} />
                      </div>
                      <div>
                        <p className="text-sm font-500 text-foreground">{perm.label}</p>
                        <p className="text-xs text-muted-foreground">{perm.description}</p>
                      </div>
                    </div>
                    <div
                      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ml-3 cursor-pointer ${enabled ? 'bg-primary' : 'bg-border'}`}
                      onClick={() => togglePermission(perm.key)}
                    >
                      <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${enabled ? 'translate-x-4' : 'translate-x-0.5'}`} />
                    </div>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Error */}
          {formError && (
            <div className="flex items-center gap-2 px-3 py-2.5 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
              <AlertCircle size={13} className="shrink-0" />
              {formError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border shrink-0">
          <button
            onClick={onClose}
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
            {isEdit ? 'Save Changes' : 'Create Officer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

type ActiveTab = 'officers' | 'audit';

export default function OfficerManagementContent() {
  const supabase = createClient();

  const [activeTab, setActiveTab] = useState<ActiveTab>('officers');
  const [officers, setOfficers] = useState<Officer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<OfficerRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<Officer | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  // Audit tab state
  const [auditEntries, setAuditEntries] = useState<AuditEntry[]>([]);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditDateFrom, setAuditDateFrom] = useState('');
  const [auditDateTo, setAuditDateTo] = useState('');
  const [auditOfficerFilter, setAuditOfficerFilter] = useState('all');

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchOfficers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) { showToast('Failed to load officers: ' + error.message, 'error'); return; }

      const mapped: Officer[] = (data || []).map((row) => {
        const role = (row.role === 'supervisor' ? 'supervisor' : row.role === 'system_admin' ? 'system_admin' : 'legal_officer') as OfficerRole;
        const storedPerms = row.officer_permissions as OfficerPermissions | null;
        return {
          id: row.id,
          email: row.email,
          fullName: row.full_name || row.email,
          role,
          initials: row.initials || getInitials(row.full_name || row.email),
          isActive: row.is_active ?? true,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          permissions: storedPerms ?? DEFAULT_PERMISSIONS_BY_ROLE[role],
        };
      });
      setOfficers(mapped);
    } catch {
      showToast('Unexpected error loading officers', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const fetchAuditEntries = useCallback(async () => {
    setAuditLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('id, user_id, user_email, action, module, details, created_at, ip_address')
        .order('created_at', { ascending: false })
        .limit(200);

      if (auditDateFrom) query = query.gte('created_at', auditDateFrom + 'T00:00:00');
      if (auditDateTo) query = query.lte('created_at', auditDateTo + 'T23:59:59');

      const { data, error } = await query;
      if (error) { showToast('Failed to load audit log: ' + error.message, 'error'); return; }

      const mapped: AuditEntry[] = (data || []).map((row) => {
        const officer = officers.find((o) => o.id === row.user_id || o.email === row.user_email);
        return {
          id: row.id,
          officerName: officer?.fullName || row.user_email || 'Unknown',
          officerEmail: row.user_email || '',
          action: row.action || '',
          module: row.module || '',
          details: typeof row.details === 'string' ? row.details : JSON.stringify(row.details || ''),
          createdAt: row.created_at,
          ipAddress: row.ip_address,
        };
      });
      setAuditEntries(mapped);
    } catch {
      showToast('Unexpected error loading audit log', 'error');
    } finally {
      setAuditLoading(false);
    }
  }, [officers, auditDateFrom, auditDateTo]);

  useEffect(() => { fetchOfficers(); }, [fetchOfficers]);

  useEffect(() => {
    if (activeTab === 'audit') fetchAuditEntries();
  }, [activeTab, fetchAuditEntries]);

  // ─── Toast ──────────────────────────────────────────────────────────────────

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Toggle Status ──────────────────────────────────────────────────────────

  async function handleToggleStatus(officer: Officer) {
    const newStatus = !officer.isActive;
    setTogglingId(officer.id);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', officer.id);
      if (error) { showToast('Failed to update status: ' + error.message, 'error'); return; }
      setOfficers((prev) => prev.map((o) => o.id === officer.id ? { ...o, isActive: newStatus } : o));
      showToast(`${officer.fullName} has been ${newStatus ? 'activated' : 'deactivated'}.`, 'success');
    } catch {
      showToast('Unexpected error updating status', 'error');
    } finally {
      setTogglingId(null);
    }
  }

  // ─── Filtered Officers ──────────────────────────────────────────────────────

  const filteredOfficers = officers.filter((o) => {
    const matchesSearch = !searchQuery ||
      o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || o.role === roleFilter;
    const matchesStatus = statusFilter === 'all' || (statusFilter === 'active' ? o.isActive : !o.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // ─── Filtered Audit ─────────────────────────────────────────────────────────

  const filteredAudit = auditEntries.filter((e) => {
    const matchesSearch = !auditSearch ||
      e.officerName.toLowerCase().includes(auditSearch.toLowerCase()) ||
      e.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      e.module.toLowerCase().includes(auditSearch.toLowerCase());
    const matchesOfficer = auditOfficerFilter === 'all' || e.officerEmail === auditOfficerFilter;
    return matchesSearch && matchesOfficer;
  });

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const totalOfficers = officers.length;
  const activeOfficers = officers.filter((o) => o.isActive).length;
  const adminCount = officers.filter((o) => o.role === 'system_admin').length;
  const legalCount = officers.filter((o) => o.role === 'legal_officer').length;

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-800' : 'bg-red-50 border border-red-200 text-red-800'
        }`}>
          {toast.type === 'success' ? <CheckCircle2 size={16} className="shrink-0 text-green-600" /> : <AlertCircle size={16} className="shrink-0 text-red-600" />}
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-700 text-foreground">Officer Management</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Create, manage, and audit officers — assign roles and configure permissions</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => fetchOfficers(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={() => { setEditingOfficer(null); setModalOpen(true); }}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Plus size={14} />
            Add Officer
          </button>
        </div>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: 'Total Officers', value: totalOfficers, icon: Users, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
          { label: 'Active', value: activeOfficers, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50', border: 'border-green-100' },
          { label: 'Admins', value: adminCount, icon: Shield, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
          { label: 'Legal Officers', value: legalCount, icon: BadgeCheck, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-100' },
        ].map((stat) => {
          const StatIcon = stat.icon;
          return (
            <div key={stat.label} className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${stat.border} ${stat.bg}`}>
              <div className={`w-8 h-8 rounded-lg bg-white flex items-center justify-center shadow-sm`}>
                <StatIcon size={16} className={stat.color} />
              </div>
              <div>
                <p className="text-lg font-700 text-foreground leading-none">{stat.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border">
        {([
          { id: 'officers', label: 'Officers', icon: Users },
          { id: 'audit', label: 'Activity Audit', icon: ClipboardList },
        ] as { id: ActiveTab; label: string; icon: React.ElementType }[]).map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Officers Tab */}
      {activeTab === 'officers' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search officers..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              />
            </div>
            <div className="relative">
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as OfficerRole | 'all')}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-foreground"
              >
                <option value="all">All Roles</option>
                <option value="legal_officer">Legal Officer</option>
                <option value="supervisor">Supervisor</option>
                <option value="system_admin">Admin</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'active' | 'inactive')}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-foreground"
              >
                <option value="all">All Status</option>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
              <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            </div>
          </div>

          {/* Officers Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {loading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-14 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredOfficers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <Users size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-600 text-foreground">No officers found</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting your filters or add a new officer</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Officer</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Role</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Permissions</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Status</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Added</th>
                      <th className="text-right px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredOfficers.map((officer) => {
                      const roleCfg = ROLE_CONFIG[officer.role];
                      const activePerms = PERMISSION_DEFS.filter((p) => officer.permissions[p.key]);
                      return (
                        <tr key={officer.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-700 ${officer.isActive ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                                {officer.initials}
                              </div>
                              <div>
                                <p className="text-sm font-600 text-foreground">{officer.fullName}</p>
                                <p className="text-xs text-muted-foreground">{officer.email}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-600 border ${roleCfg.bg} ${roleCfg.border} ${roleCfg.color}`}>
                              {roleCfg.label}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-1 flex-wrap">
                              {activePerms.length === 0 ? (
                                <span className="text-xs text-muted-foreground">None</span>
                              ) : (
                                activePerms.map((p) => {
                                  const PermIcon = p.icon;
                                  return (
                                    <span key={p.key} title={p.label} className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-500 ${p.bg} ${p.color} border ${p.border}`}>
                                      <PermIcon size={10} />
                                      {p.label}
                                    </span>
                                  );
                                })
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 ${officer.isActive ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'}`}>
                              {officer.isActive ? <UserCheck size={10} /> : <UserX size={10} />}
                              {officer.isActive ? 'Active' : 'Inactive'}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground">{formatDate(officer.createdAt)}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                onClick={() => { setEditingOfficer(officer); setModalOpen(true); }}
                                className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                                title="Edit officer"
                              >
                                <Edit2 size={14} />
                              </button>
                              <button
                                onClick={() => handleToggleStatus(officer)}
                                disabled={togglingId === officer.id}
                                className={`p-1.5 rounded-md transition-colors ${
                                  officer.isActive
                                    ? 'hover:bg-red-50 text-muted-foreground hover:text-red-600'
                                    : 'hover:bg-green-50 text-muted-foreground hover:text-green-600'
                                }`}
                                title={officer.isActive ? 'Deactivate officer' : 'Activate officer'}
                              >
                                {togglingId === officer.id ? (
                                  <RefreshCw size={14} className="animate-spin" />
                                ) : officer.isActive ? (
                                  <ToggleRight size={14} />
                                ) : (
                                  <ToggleLeft size={14} />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!loading && filteredOfficers.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredOfficers.length} of {officers.length} officers
            </p>
          )}
        </div>
      )}

      {/* Audit Tab */}
      {activeTab === 'audit' && (
        <div className="space-y-4">
          {/* Audit Filters */}
          <div className="bg-white rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-3">
              <Filter size={14} className="text-muted-foreground" />
              <p className="text-sm font-600 text-foreground">Filter Activity</p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search by officer, action, module..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
                />
              </div>
              <div className="relative">
                <select
                  value={auditOfficerFilter}
                  onChange={(e) => setAuditOfficerFilter(e.target.value)}
                  className="appearance-none pl-3 pr-8 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-foreground"
                >
                  <option value="all">All Officers</option>
                  {officers.map((o) => (
                    <option key={o.id} value={o.email}>{o.fullName}</option>
                  ))}
                </select>
                <ChevronDown size={12} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={14} className="text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={auditDateFrom}
                  onChange={(e) => setAuditDateFrom(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-foreground"
                />
                <span className="text-xs text-muted-foreground">to</span>
                <input
                  type="date"
                  value={auditDateTo}
                  onChange={(e) => setAuditDateTo(e.target.value)}
                  className="px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white text-foreground"
                />
              </div>
              <button
                onClick={fetchAuditEntries}
                disabled={auditLoading}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                {auditLoading ? <RefreshCw size={14} className="animate-spin" /> : <Activity size={14} />}
                Apply
              </button>
            </div>
          </div>

          {/* Audit Table */}
          <div className="bg-white rounded-xl border border-border overflow-hidden">
            {auditLoading ? (
              <div className="p-6 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
                ))}
              </div>
            ) : filteredAudit.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                  <ClipboardList size={20} className="text-muted-foreground" />
                </div>
                <p className="text-sm font-600 text-foreground">No activity found</p>
                <p className="text-xs text-muted-foreground mt-1">Try adjusting the date range or filters</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Officer</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Action</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Module</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Details</th>
                      <th className="text-left px-4 py-3 text-xs font-700 text-muted-foreground uppercase tracking-wider">Timestamp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filteredAudit.map((entry) => {
                      const officer = officers.find((o) => o.email === entry.officerEmail);
                      const roleCfg = officer ? ROLE_CONFIG[officer.role] : null;
                      return (
                        <tr key={entry.id} className="hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 ${officer?.isActive !== false ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                                {officer?.initials || entry.officerName.slice(0, 2).toUpperCase()}
                              </div>
                              <div>
                                <p className="text-xs font-600 text-foreground">{entry.officerName}</p>
                                {roleCfg && (
                                  <span className={`text-xs ${roleCfg.color}`}>{roleCfg.label}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-600 bg-muted text-foreground border border-border">
                              {entry.action}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground capitalize">{entry.module || '—'}</span>
                          </td>
                          <td className="px-4 py-3 max-w-xs">
                            <p className="text-xs text-muted-foreground truncate" title={entry.details}>{entry.details || '—'}</p>
                          </td>
                          <td className="px-4 py-3">
                            <span className="text-xs text-muted-foreground whitespace-nowrap">{formatDateTime(entry.createdAt)}</span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          {!auditLoading && filteredAudit.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Showing {filteredAudit.length} activity records
            </p>
          )}
        </div>
      )}

      {/* Officer Form Modal */}
      {modalOpen && (
        <OfficerFormModal
          officer={editingOfficer}
          onClose={() => { setModalOpen(false); setEditingOfficer(null); }}
          onSaved={() => fetchOfficers(true)}
          showToast={showToast}
        />
      )}
    </div>
  );
}
