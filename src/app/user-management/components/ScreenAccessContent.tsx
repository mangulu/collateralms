'use client';
import React, { useEffect, useState, useCallback } from 'react';
import {
  Monitor,
  RefreshCw,
  Save,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Eye,
  Plus,
  Edit2,
  Trash2,
  Download,
  Upload,
  Settings,
  Shield,
} from 'lucide-react';
import { fetchRoles, getRoleColorClasses, RoleDefinition } from '@/lib/rbac';
import { createClient } from '@/lib/supabase/client';

// ─── Screen Definitions ───────────────────────────────────────────────────────

interface ScreenAction {
  key: string;
  label: string;
  icon: React.ElementType;
}

interface ScreenDefinition {
  id: string;
  label: string;
  path: string;
  group: string;
  actions: ScreenAction[];
}

const SCREEN_ACTIONS: Record<string, ScreenAction> = {
  view: { key: 'view', label: 'View', icon: Eye },
  create: { key: 'create', label: 'Create', icon: Plus },
  edit: { key: 'edit', label: 'Edit', icon: Edit2 },
  delete: { key: 'delete', label: 'Delete', icon: Trash2 },
  export: { key: 'export', label: 'Export', icon: Download },
  upload: { key: 'upload', label: 'Upload', icon: Upload },
  manage: { key: 'manage', label: 'Manage', icon: Settings },
  approve: { key: 'approve', label: 'Approve', icon: Shield },
};

const ALL_SCREENS: ScreenDefinition[] = [
  // Overview
  { id: 'dashboard', label: 'Dashboard', path: '/collateral-dashboard', group: 'Overview', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.export] },
  { id: 'portfolio_monitoring', label: 'Portfolio Monitoring', path: '/portfolio-monitoring', group: 'Overview', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.export] },
  // Collateral
  { id: 'collateral_registry', label: 'Collateral Registry', path: '/collateral-management', group: 'Collateral', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.create, SCREEN_ACTIONS.edit, SCREEN_ACTIONS.delete, SCREEN_ACTIONS.export] },
  { id: 'approval_workflow', label: 'Approval Workflow', path: '/perfection-workflow', group: 'Collateral', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.approve, SCREEN_ACTIONS.edit] },
  { id: 'collateral_documents', label: 'Collateral Documents', path: '/collateral-documents', group: 'Collateral', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.upload, SCREEN_ACTIONS.delete] },
  { id: 'batch_release', label: 'Batch Release', path: '/batch-release', group: 'Collateral', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  { id: 'bulk_upload', label: 'Bulk Upload', path: '/bulk-upload', group: 'Collateral', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.upload] },
  { id: 'scheduled_jobs', label: 'Scheduled Jobs', path: '/scheduled-jobs', group: 'Collateral', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  // Intelligence
  { id: 'fraud_prevention', label: 'AI Fraud Prevention', path: '/fraud-prevention', group: 'Intelligence', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  { id: 'risk_assessment', label: 'AI Risk Assessment', path: '/risk-assessment', group: 'Intelligence', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.export] },
  { id: 'fast_track', label: 'Fast Track', path: '/fast-track', group: 'Intelligence', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  { id: 'geomapping', label: 'Geomapping', path: '/geomapping', group: 'Intelligence', actions: [SCREEN_ACTIONS.view] },
  { id: 'compliance_rules', label: 'Compliance Rules', path: '/compliance-rules', group: 'Intelligence', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.create, SCREEN_ACTIONS.edit, SCREEN_ACTIONS.delete] },
  // Alerts & Notifications
  { id: 'notifications_hub', label: 'Notifications Hub', path: '/notifications-hub', group: 'Alerts & Notifications', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  { id: 'alerts_inbox', label: 'Alerts Inbox', path: '/alerts-inbox', group: 'Alerts & Notifications', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  { id: 'alerts_delivery', label: 'Alert Delivery Log', path: '/alerts-delivery', group: 'Alerts & Notifications', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  // Audit & Reports
  { id: 'audit_trail', label: 'Security & Compliance Trail', path: '/audit-trail', group: 'Audit & Reports', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.export] },
  { id: 'audit_log', label: 'Activity Log', path: '/audit-log', group: 'Audit & Reports', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.export] },
  { id: 'audit_report', label: 'Audit Report', path: '/audit-report', group: 'Audit & Reports', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.export] },
  { id: 'reports', label: 'Reports', path: '/reports', group: 'Audit & Reports', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.export] },
  { id: 'export', label: 'Export', path: '/export', group: 'Audit & Reports', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  // Administration
  { id: 'user_management', label: 'User Management', path: '/user-management', group: 'Administration', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  { id: 'settings', label: 'System Settings', path: '/settings', group: 'Administration', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
  { id: 'admin', label: 'Admin Console', path: '/admin', group: 'Administration', actions: [SCREEN_ACTIONS.view, SCREEN_ACTIONS.manage] },
];

const SCREEN_GROUPS = Array.from(new Set(ALL_SCREENS.map((s) => s.group)));

// ─── Types ────────────────────────────────────────────────────────────────────

// Key: `${screenId}:${roleName}:${actionKey}` → boolean
type AccessMatrix = Record<string, boolean>;

interface ToastState {
  message: string;
  type: 'success' | 'error';
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function matrixKey(screenId: string, roleName: string, actionKey: string): string {
  return `${screenId}:${roleName}:${actionKey}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ScreenAccessContent() {
  const supabase = createClient();

  const [roles, setRoles] = useState<RoleDefinition[]>([]);
  const [matrix, setMatrix] = useState<AccessMatrix>({});
  const [originalMatrix, setOriginalMatrix] = useState<AccessMatrix>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<ToastState | null>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(SCREEN_GROUPS));
  const [hasChanges, setHasChanges] = useState(false);

  // ─── Data Loading ──────────────────────────────────────────────────────────

  const loadData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);

    try {
      const [rolesData, accessResult] = await Promise.all([
        fetchRoles(),
        supabase.from('screen_access_rules').select('*'),
      ]);

      const { data: accessRows, error } = accessResult;

      setRoles(rolesData);

      if (error) {
        // Table may not exist yet — start with empty matrix
        const emptyMatrix: AccessMatrix = {};
        setMatrix(emptyMatrix);
        setOriginalMatrix(emptyMatrix);
        return;
      }

      const built: AccessMatrix = {};
      for (const row of accessRows || []) {
        const key = matrixKey(row.screen_id, row.role_name, row.action_key);
        built[key] = row.is_allowed;
      }
      setMatrix(built);
      setOriginalMatrix(built);
    } catch (err: any) {
      showToast('Failed to load access rules: ' + err.message, 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setHasChanges(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function showToast(message: string, type: 'success' | 'error') {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }

  // ─── Toggle ────────────────────────────────────────────────────────────────

  function toggleCell(screenId: string, roleName: string, actionKey: string) {
    const key = matrixKey(screenId, roleName, actionKey);
    setMatrix((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      // Check if differs from original
      const changed = Object.keys(next).some((k) => next[k] !== (originalMatrix[k] ?? false)) ||
        Object.keys(originalMatrix).some((k) => (next[k] ?? false) !== originalMatrix[k]);
      setHasChanges(changed);
      return next;
    });
  }

  function toggleGroup(group: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group);
      else next.add(group);
      return next;
    });
  }

  // ─── Toggle all actions for a role on a screen ────────────────────────────

  function toggleScreenRole(screen: ScreenDefinition, roleName: string) {
    const allOn = screen.actions.every((a) => matrix[matrixKey(screen.id, roleName, a.key)]);
    setMatrix((prev) => {
      const next = { ...prev };
      for (const action of screen.actions) {
        next[matrixKey(screen.id, roleName, action.key)] = !allOn;
      }
      const changed = Object.keys(next).some((k) => next[k] !== (originalMatrix[k] ?? false)) ||
        Object.keys(originalMatrix).some((k) => (next[k] ?? false) !== originalMatrix[k]);
      setHasChanges(changed);
      return next;
    });
  }

  // ─── Save ──────────────────────────────────────────────────────────────────

  async function handleSave() {
    setSaving(true);
    try {
      // Build upsert rows for all defined cells
      const rows: { screen_id: string; role_name: string; action_key: string; is_allowed: boolean }[] = [];

      for (const screen of ALL_SCREENS) {
        for (const role of roles) {
          for (const action of screen.actions) {
            const key = matrixKey(screen.id, role.name, action.key);
            rows.push({
              screen_id: screen.id,
              role_name: role.name,
              action_key: action.key,
              is_allowed: matrix[key] ?? false,
            });
          }
        }
      }

      const { error } = await supabase
        .from('screen_access_rules')
        .upsert(rows, { onConflict: 'screen_id,role_name,action_key' });

      if (error) throw error;

      setOriginalMatrix({ ...matrix });
      setHasChanges(false);
      showToast('Screen access rules saved successfully.', 'success');
    } catch (err: any) {
      showToast('Failed to save: ' + err.message, 'error');
    } finally {
      setSaving(false);
    }
  }

  function handleDiscard() {
    setMatrix({ ...originalMatrix });
    setHasChanges(false);
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-5">
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

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Monitor size={18} className="text-primary" />
          <div>
            <p className="text-sm font-600 text-foreground">Screen-Level Access Rules</p>
            <p className="text-xs text-muted-foreground">
              Define which roles can access each screen and what actions they may perform.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => loadData(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors disabled:opacity-50"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
          {hasChanges && (
            <>
              <button
                onClick={handleDiscard}
                className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
              >
                <Save size={13} />
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground bg-muted/40 border border-border rounded-lg px-4 py-2.5">
        <span className="font-medium text-foreground">Legend:</span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-primary/20 border-2 border-primary inline-block" />
          Allowed
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-4 rounded bg-muted border border-border inline-block" />
          Denied
        </span>
        <span className="ml-auto italic">Click a cell to toggle. Click a role header on a row to toggle all actions for that role.</span>
      </div>

      {/* Matrix by group */}
      {SCREEN_GROUPS.map((group) => {
        const groupScreens = ALL_SCREENS.filter((s) => s.group === group);
        const isExpanded = expandedGroups.has(group);

        return (
          <div key={group} className="border border-border rounded-xl overflow-hidden">
            {/* Group header */}
            <button
              onClick={() => toggleGroup(group)}
              className="w-full flex items-center justify-between px-4 py-3 bg-muted/50 hover:bg-muted transition-colors text-left"
            >
              <span className="text-sm font-600 text-foreground">{group}</span>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{groupScreens.length} screen{groupScreens.length !== 1 ? 's' : ''}</span>
                {isExpanded ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
              </div>
            </button>

            {isExpanded && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border bg-muted/20">
                      <th className="text-left px-4 py-2.5 font-600 text-muted-foreground w-48 min-w-[180px]">Screen</th>
                      <th className="text-left px-3 py-2.5 font-600 text-muted-foreground w-28 min-w-[100px]">Actions</th>
                      {roles.map((role) => {
                        const colors = getRoleColorClasses(role.color);
                        return (
                          <th key={role.name} className="px-3 py-2.5 text-center min-w-[90px]">
                            <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-600 ${colors.bg} ${colors.text}`}>
                              {role.label}
                            </span>
                          </th>
                        );
                      })}
                    </tr>
                  </thead>
                  <tbody>
                    {groupScreens.map((screen, si) => (
                      screen.actions.map((action, ai) => {
                        const ActionIcon = action.icon;
                        const isFirstRow = ai === 0;
                        const isLastRow = ai === screen.actions.length - 1;
                        const rowBg = si % 2 === 0 ? 'bg-white' : 'bg-muted/10';

                        return (
                          <tr
                            key={`${screen.id}-${action.key}`}
                            className={`${rowBg} ${!isLastRow ? 'border-b border-dashed border-border/50' : 'border-b border-border'} hover:bg-primary/5 transition-colors`}
                          >
                            {/* Screen name — only on first action row */}
                            <td className="px-4 py-2 align-middle">
                              {isFirstRow ? (
                                <div>
                                  <p className="font-600 text-foreground text-xs">{screen.label}</p>
                                  <p className="text-muted-foreground text-[10px] font-mono">{screen.path}</p>
                                </div>
                              ) : null}
                            </td>

                            {/* Action label */}
                            <td className="px-3 py-2 align-middle">
                              <span className="flex items-center gap-1.5 text-muted-foreground">
                                <ActionIcon size={11} />
                                {action.label}
                              </span>
                            </td>

                            {/* Role cells */}
                            {roles.map((role) => {
                              const key = matrixKey(screen.id, role.name, action.key);
                              const allowed = matrix[key] ?? false;
                              return (
                                <td key={role.name} className="px-3 py-2 text-center align-middle">
                                  <button
                                    onClick={() => toggleCell(screen.id, role.name, action.key)}
                                    title={`${allowed ? 'Revoke' : 'Grant'} ${action.label} on ${screen.label} for ${role.label}`}
                                    className={`w-5 h-5 rounded transition-all border-2 mx-auto block ${
                                      allowed
                                        ? 'bg-primary/20 border-primary hover:bg-primary/30' :'bg-transparent border-border hover:border-primary/50 hover:bg-primary/5'
                                    }`}
                                  >
                                    {allowed && (
                                      <svg viewBox="0 0 10 10" className="w-full h-full p-0.5 text-primary" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M1.5 5l2.5 2.5 4.5-4.5" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    )}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        );
      })}

      {/* Sticky save bar */}
      {hasChanges && (
        <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 flex items-center justify-between rounded-b-xl shadow-lg">
          <p className="text-xs text-muted-foreground">You have unsaved changes to screen access rules.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDiscard}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors"
            >
              Discard
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              <Save size={13} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
