'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  ShieldCheck,
  Search,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  UserCheck,
  UserX,
  ToggleLeft,
  ToggleRight,
  ChevronDown,
  Eye,
  FileText,
  Layers,
  Save,
  X,
  Lock,
  Unlock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserRole = 'credit_officer' | 'legal_officer' | 'system_admin';

interface OfficerProfile {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  initials: string;
  isActive: boolean;
  permissions: OfficerPermissions;
}

interface OfficerPermissions {
  viewAudit: boolean;
  createReports: boolean;
  bulkActions: boolean;
}

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const roleConfig: Record<UserRole, { label: string; color: string; bg: string }> = {
  credit_officer: { label: 'Credit Officer', color: 'text-blue-700', bg: 'bg-blue-100' },
  legal_officer: { label: 'Legal Officer', color: 'text-purple-700', bg: 'bg-purple-100' },
  system_admin: { label: 'System Admin', color: 'text-amber-700', bg: 'bg-amber-100' },
};

const PERMISSION_DEFS = [
  {
    key: 'viewAudit' as keyof OfficerPermissions,
    label: 'View Audit',
    description: 'Access audit trails, activity logs, and compliance records',
    icon: Eye,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
  },
  {
    key: 'createReports' as keyof OfficerPermissions,
    label: 'Create Reports',
    description: 'Generate, save, and schedule custom reports and exports',
    icon: FileText,
    color: 'text-purple-600',
    bg: 'bg-purple-50',
    border: 'border-purple-200',
  },
  {
    key: 'bulkActions' as keyof OfficerPermissions,
    label: 'Bulk Actions',
    description: 'Perform batch operations: bulk upload, batch release, bulk edits',
    icon: Layers,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
  },
];

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

// Default permissions per role
function getDefaultPermissions(role: UserRole): OfficerPermissions {
  if (role === 'system_admin') {
    return { viewAudit: true, createReports: true, bulkActions: true };
  }
  if (role === 'legal_officer') {
    return { viewAudit: true, createReports: true, bulkActions: false };
  }
  // credit_officer
  return { viewAudit: false, createReports: false, bulkActions: false };
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OfficerPermissionsContent() {
  const supabase = createClient();

  const [officers, setOfficers] = useState<OfficerProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [toast, setToast] = useState<ToastState | null>(null);

  // Permission panel state
  const [selectedOfficer, setSelectedOfficer] = useState<OfficerProfile | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<OfficerPermissions | null>(null);
  const [saving, setSaving] = useState(false);
  const [togglingStatus, setTogglingStatus] = useState<string | null>(null);

  // ─── Data Fetching ──────────────────────────────────────────────────────────

  const fetchOfficers = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        showToast('Failed to load officers: ' + error.message, 'error');
        return;
      }

      const mapped: OfficerProfile[] = (data || []).map((row) => {
        const role = row.role as UserRole;
        // Read stored permissions or fall back to role defaults
        const storedPerms = row.officer_permissions as OfficerPermissions | null;
        const permissions: OfficerPermissions = storedPerms ?? getDefaultPermissions(role);
        return {
          id: row.id,
          email: row.email,
          fullName: row.full_name || row.email,
          role,
          initials: row.initials || getInitials(row.full_name || row.email),
          isActive: row.is_active ?? true,
          permissions,
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

  useEffect(() => {
    fetchOfficers();
  }, [fetchOfficers]);

  // ─── Toast ──────────────────────────────────────────────────────────────────

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Select Officer ─────────────────────────────────────────────────────────

  function handleSelectOfficer(officer: OfficerProfile) {
    setSelectedOfficer(officer);
    setDraftPermissions({ ...officer.permissions });
  }

  function handleClosePanel() {
    setSelectedOfficer(null);
    setDraftPermissions(null);
  }

  // ─── Toggle Permission Draft ────────────────────────────────────────────────

  function toggleDraftPermission(key: keyof OfficerPermissions) {
    if (!draftPermissions) return;
    setDraftPermissions((prev) => prev ? { ...prev, [key]: !prev[key] } : prev);
  }

  // ─── Save Permissions ───────────────────────────────────────────────────────

  async function handleSavePermissions() {
    if (!selectedOfficer || !draftPermissions) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({
          officer_permissions: draftPermissions,
          updated_at: new Date().toISOString(),
        })
        .eq('id', selectedOfficer.id);

      if (error) {
        showToast('Failed to save permissions: ' + error.message, 'error');
        return;
      }

      setOfficers((prev) =>
        prev.map((o) =>
          o.id === selectedOfficer.id ? { ...o, permissions: { ...draftPermissions } } : o
        )
      );
      setSelectedOfficer((prev) => prev ? { ...prev, permissions: { ...draftPermissions } } : prev);
      showToast(`Permissions updated for ${selectedOfficer.fullName}.`, 'success');
    } catch {
      showToast('Unexpected error saving permissions', 'error');
    } finally {
      setSaving(false);
    }
  }

  // ─── Toggle Account Status ──────────────────────────────────────────────────

  async function handleToggleStatus(officer: OfficerProfile, e: React.MouseEvent) {
    e.stopPropagation();
    const newStatus = !officer.isActive;
    setTogglingStatus(officer.id);
    try {
      const { error } = await supabase
        .from('user_profiles')
        .update({ is_active: newStatus, updated_at: new Date().toISOString() })
        .eq('id', officer.id);

      if (error) {
        showToast('Failed to update status: ' + error.message, 'error');
        return;
      }

      setOfficers((prev) =>
        prev.map((o) => (o.id === officer.id ? { ...o, isActive: newStatus } : o))
      );
      if (selectedOfficer?.id === officer.id) {
        setSelectedOfficer((prev) => prev ? { ...prev, isActive: newStatus } : prev);
      }
      showToast(
        `${officer.fullName} has been ${newStatus ? 'activated' : 'deactivated'}.`,
        'success'
      );
    } catch {
      showToast('Unexpected error updating status', 'error');
    } finally {
      setTogglingStatus(null);
    }
  }

  // ─── Filtered Officers ──────────────────────────────────────────────────────

  const filteredOfficers = officers.filter((o) => {
    const matchesSearch =
      !searchQuery ||
      o.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || o.role === roleFilter;
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' ? o.isActive : !o.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  // ─── KPI Counts ─────────────────────────────────────────────────────────────

  const totalOfficers = officers.length;
  const activeOfficers = officers.filter((o) => o.isActive).length;
  const withAuditAccess = officers.filter((o) => o.permissions.viewAudit).length;
  const withBulkAccess = officers.filter((o) => o.permissions.bulkActions).length;

  const hasDraftChanges =
    draftPermissions &&
    selectedOfficer &&
    (draftPermissions.viewAudit !== selectedOfficer.permissions.viewAudit ||
      draftPermissions.createReports !== selectedOfficer.permissions.createReports ||
      draftPermissions.bulkActions !== selectedOfficer.permissions.bulkActions);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6 p-6">
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
          <h1 className="text-2xl font-700 text-foreground">Officer Permissions</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Assign granular permissions and manage officer account status
          </p>
        </div>
        <button
          onClick={() => fetchOfficers(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Officers', value: totalOfficers, icon: ShieldCheck, color: 'text-primary', bg: 'bg-primary/10' },
          { label: 'Active Accounts', value: activeOfficers, icon: UserCheck, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Audit Access', value: withAuditAccess, icon: Eye, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Bulk Actions', value: withBulkAccess, icon: Layers, color: 'text-amber-600', bg: 'bg-amber-50' },
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

      {/* Main Content: List + Panel */}
      <div className="flex gap-5 items-start">
        {/* Officer List */}
        <div className="flex-1 min-w-0 space-y-4">
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
                  <option value="credit_officer">Credit Officer</option>
                  <option value="legal_officer">Legal Officer</option>
                  <option value="system_admin">System Admin</option>
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

          {/* Officer Cards */}
          <div className="bg-white border border-border rounded-xl overflow-hidden">
            {loading ? (
              <div className="divide-y divide-border">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-4 px-4 py-4">
                    <div className="w-10 h-10 rounded-full bg-muted animate-pulse shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 w-40 bg-muted rounded animate-pulse" />
                      <div className="h-3 w-56 bg-muted rounded animate-pulse" />
                    </div>
                    <div className="h-5 w-20 bg-muted rounded-full animate-pulse" />
                  </div>
                ))}
              </div>
            ) : filteredOfficers.length === 0 ? (
              <div className="px-4 py-12 text-center text-muted-foreground">
                <ShieldCheck size={32} className="mx-auto mb-2 opacity-30" />
                <p className="font-medium">No officers found</p>
                <p className="text-xs mt-1">Try adjusting your filters.</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filteredOfficers.map((officer) => {
                  const rc = roleConfig[officer.role];
                  const isSelected = selectedOfficer?.id === officer.id;
                  const permCount = Object.values(officer.permissions).filter(Boolean).length;

                  return (
                    <div
                      key={officer.id}
                      onClick={() => handleSelectOfficer(officer)}
                      className={`flex items-center gap-4 px-4 py-4 cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-primary/5 border-l-2 border-l-primary' :'hover:bg-muted/40 border-l-2 border-l-transparent'
                      }`}
                    >
                      {/* Avatar */}
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white text-sm font-600 ${
                          officer.isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                        }`}
                      >
                        {officer.initials}
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-500 text-foreground text-sm truncate">
                            {officer.fullName}
                          </span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${rc.bg} ${rc.color}`}>
                            {rc.label}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{officer.email}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          {PERMISSION_DEFS.map((p) => {
                            const PIcon = p.icon;
                            const granted = officer.permissions[p.key];
                            return (
                              <span
                                key={p.key}
                                className={`inline-flex items-center gap-1 text-xs ${
                                  granted ? p.color : 'text-muted-foreground/50'
                                }`}
                                title={p.label}
                              >
                                <PIcon size={11} />
                                <span className="hidden sm:inline">{p.label}</span>
                              </span>
                            );
                          })}
                          <span className="text-xs text-muted-foreground">
                            {permCount}/{PERMISSION_DEFS.length} permissions
                          </span>
                        </div>
                      </div>

                      {/* Status + Toggle */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-600 ${
                            officer.isActive
                              ? 'bg-green-100 text-green-700' :'bg-red-100 text-red-700'
                          }`}
                        >
                          {officer.isActive ? (
                            <><UserCheck size={11} /> Active</>
                          ) : (
                            <><UserX size={11} /> Inactive</>
                          )}
                        </span>
                        <button
                          onClick={(e) => handleToggleStatus(officer, e)}
                          disabled={togglingStatus === officer.id}
                          className={`p-1.5 rounded-md transition-colors ${
                            officer.isActive
                              ? 'hover:bg-red-50 text-muted-foreground hover:text-red-600'
                              : 'hover:bg-green-50 text-muted-foreground hover:text-green-600'
                          } disabled:opacity-50`}
                          title={officer.isActive ? 'Deactivate account' : 'Activate account'}
                        >
                          {togglingStatus === officer.id ? (
                            <RefreshCw size={16} className="animate-spin" />
                          ) : officer.isActive ? (
                            <ToggleRight size={18} />
                          ) : (
                            <ToggleLeft size={18} />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            {!loading && filteredOfficers.length > 0 && (
              <div className="px-4 py-3 border-t border-border bg-muted/20 text-xs text-muted-foreground">
                Showing {filteredOfficers.length} of {officers.length} officers
              </div>
            )}
          </div>
        </div>

        {/* Permission Panel */}
        {selectedOfficer && draftPermissions ? (
          <div className="w-80 shrink-0 bg-white border border-border rounded-xl overflow-hidden sticky top-4">
            {/* Panel Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/30">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <span className="text-sm font-600 text-foreground">Permissions</span>
              </div>
              <button
                onClick={handleClosePanel}
                className="p-1 rounded-md hover:bg-muted text-muted-foreground transition-colors"
              >
                <X size={14} />
              </button>
            </div>

            {/* Officer Summary */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center gap-3">
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-white text-sm font-600 shrink-0 ${
                    selectedOfficer.isActive ? 'bg-primary' : 'bg-muted-foreground/40'
                  }`}
                >
                  {selectedOfficer.initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-600 text-foreground truncate">{selectedOfficer.fullName}</p>
                  <p className="text-xs text-muted-foreground truncate">{selectedOfficer.email}</p>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-600 ${
                        roleConfig[selectedOfficer.role].bg
                      } ${roleConfig[selectedOfficer.role].color}`}
                    >
                      {roleConfig[selectedOfficer.role].label}
                    </span>
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 ${
                        selectedOfficer.isActive
                          ? 'bg-green-100 text-green-700' :'bg-red-100 text-red-700'
                      }`}
                    >
                      {selectedOfficer.isActive ? (
                        <><Unlock size={10} /> Active</>
                      ) : (
                        <><Lock size={10} /> Inactive</>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Account Status Toggle */}
            <div className="px-4 py-3 border-b border-border">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-600 text-foreground">Account Status</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {selectedOfficer.isActive
                      ? 'Officer can log in and access the system' :'Officer is blocked from logging in'}
                  </p>
                </div>
                <button
                  onClick={(e) => handleToggleStatus(selectedOfficer, e)}
                  disabled={togglingStatus === selectedOfficer.id}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-600 transition-colors disabled:opacity-50 ${
                    selectedOfficer.isActive
                      ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200' :'bg-green-50 text-green-700 hover:bg-green-100 border border-green-200'
                  }`}
                >
                  {togglingStatus === selectedOfficer.id ? (
                    <RefreshCw size={12} className="animate-spin" />
                  ) : selectedOfficer.isActive ? (
                    <><UserX size={12} /> Deactivate</>
                  ) : (
                    <><UserCheck size={12} /> Activate</>
                  )}
                </button>
              </div>
            </div>

            {/* Permission Toggles */}
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs font-600 text-muted-foreground uppercase tracking-wider">
                Granular Permissions
              </p>
              {PERMISSION_DEFS.map((perm) => {
                const PIcon = perm.icon;
                const isGranted = draftPermissions[perm.key];
                return (
                  <div
                    key={perm.key}
                    className={`flex items-start gap-3 p-3 rounded-lg border transition-colors ${
                      isGranted
                        ? `${perm.bg} ${perm.border}`
                        : 'bg-muted/30 border-border'
                    }`}
                  >
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isGranted ? perm.bg : 'bg-muted'
                      }`}
                    >
                      <PIcon size={15} className={isGranted ? perm.color : 'text-muted-foreground'} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-600 ${isGranted ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {perm.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                        {perm.description}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleDraftPermission(perm.key)}
                      className={`shrink-0 mt-0.5 transition-colors ${
                        isGranted ? perm.color : 'text-muted-foreground/40'
                      }`}
                      title={isGranted ? `Revoke ${perm.label}` : `Grant ${perm.label}`}
                    >
                      {isGranted ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Save Button */}
            <div className="px-4 py-3 border-t border-border">
              <button
                onClick={handleSavePermissions}
                disabled={saving || !hasDraftChanges}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-600 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <RefreshCw size={14} className="animate-spin" />
                ) : (
                  <Save size={14} />
                )}
                {saving ? 'Saving…' : hasDraftChanges ? 'Save Permissions' : 'No Changes'}
              </button>
              {hasDraftChanges && (
                <p className="text-xs text-amber-600 text-center mt-2 flex items-center justify-center gap-1">
                  <AlertCircle size={11} />
                  Unsaved changes
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="w-80 shrink-0 bg-white border border-border rounded-xl flex flex-col items-center justify-center py-12 px-6 text-center sticky top-4">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
              <ShieldCheck size={22} className="text-primary" />
            </div>
            <p className="text-sm font-600 text-foreground">Select an Officer</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Click on any officer from the list to view and edit their permissions and account status.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
