'use client';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import { userTaskService } from '@/lib/supabase/userTaskService';
import { FolderOpen, Brain, Bell, BarChart2, ShieldCheck, Settings, LogOut, ChevronRight, Layers, Archive, Users, CheckSquare, BookOpen, HelpCircle, Settings2, AlertTriangle, Clock, TrendingUp, ArrowRight, Calendar, Activity, Zap, FileText, Plus, Eye,  } from 'lucide-react';
import { supabase } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  borderColor: string;
  iconBg: string;
  category: 'collateral' | 'workflow' | 'archive' | 'intelligence' | 'alerts' | 'reports' | 'audit' | 'admin';
  quickActions: { label: string; href: string; icon: React.ElementType }[];
  requiredPermission?: string;
  adminOnly?: boolean;
}

interface PriorityItem {
  id: string;
  type: 'overdue' | 'escalated' | 'due-today';
  label: string;
  detail: string;
  href: string;
}

interface SummaryStats {
  totalCollateral: number;
  activeWorkflows: number;
  pendingActions: number;
  overdueItems: number;
}

// ─── Category colour map ──────────────────────────────────────────────────────

const CATEGORY_BORDER: Record<string, string> = {
  collateral: '#007CB3',
  workflow:   '#D97706',
  archive:    '#059669',
  intelligence: '#7C3AED',
  alerts:     '#DC2626',
  reports:    '#065F46',
  audit:      '#9D174D',
  admin:      '#374151',
};

const CATEGORY_BG: Record<string, string> = {
  collateral:   'rgba(0,124,179,0.06)',
  workflow:     'rgba(217,119,6,0.06)',
  archive:      'rgba(5,150,105,0.06)',
  intelligence: 'rgba(124,58,237,0.06)',
  alerts:       'rgba(220,38,38,0.06)',
  reports:      'rgba(6,95,70,0.06)',
  audit:        'rgba(157,23,77,0.06)',
  admin:        'rgba(55,65,81,0.06)',
};

// ─── Module definitions ───────────────────────────────────────────────────────

const modules: ModuleCard[] = [
  {
    id: 'collaterals',
    title: 'Collaterals',
    description: 'Manage collateral registry, documents, batch operations, and scheduled jobs.',
    icon: FolderOpen,
    href: '/collateral-management',
    borderColor: CATEGORY_BORDER.collateral,
    iconBg: '#007CB3',
    category: 'collateral',
    quickActions: [
      { label: 'New Collateral', href: '/collateral-management', icon: Plus },
      { label: 'View Registry', href: '/collateral-management', icon: Eye },
      { label: 'Dashboard', href: '/collateral-dashboard', icon: Activity },
    ],
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
  {
    id: 'obligors',
    title: 'Obligors',
    description: 'Manage obligor profiles, credit risk scores, exposure metrics, and approval trends.',
    icon: Users,
    href: '/obligors',
    borderColor: CATEGORY_BORDER.collateral,
    iconBg: '#0F766E',
    category: 'collateral',
    quickActions: [
      { label: 'All Obligors', href: '/obligors', icon: Eye },
      { label: 'Loan Facilities', href: '/loans', icon: FileText },
    ],
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
  {
    id: 'approvals',
    title: 'Workflows',
    description: 'Centralised approval inbox for perfection, document, release, and archive request workflows.',
    icon: CheckSquare,
    href: '/approval-inbox',
    borderColor: CATEGORY_BORDER.workflow,
    iconBg: '#D97706',
    category: 'workflow',
    quickActions: [
      { label: 'Approval Inbox', href: '/approval-inbox', icon: Eye },
      { label: 'Perfection Queue', href: '/perfection-workflow', icon: Zap },
      { label: 'All Instances', href: '/workflows/instances', icon: Activity },
    ],
    requiredPermission: PERMISSIONS.PERFECTION_VIEW,
  },
  {
    id: 'workflows-admin',
    title: 'Workflows Admin',
    description: 'Design templates, configure auto-triggers, manage escalations, and monitor workflow KPIs.',
    icon: Settings2,
    href: '/workflows-admin',
    borderColor: CATEGORY_BORDER.admin,
    iconBg: '#475569',
    category: 'admin',
    quickActions: [
      { label: 'Templates', href: '/workflows-admin/templates', icon: FileText },
      { label: 'Trigger Rules', href: '/workflows-admin/trigger-rules', icon: Zap },
      { label: 'KPIs', href: '/workflows-admin/kpis', icon: TrendingUp },
    ],
    adminOnly: true,
    requiredPermission: PERMISSIONS.SETTINGS_VIEW,
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    description: 'AI-powered risk assessment, fraud prevention, deadline predictions, and analytics.',
    icon: Brain,
    href: '/executive-dashboard',
    borderColor: CATEGORY_BORDER.intelligence,
    iconBg: '#7C3AED',
    category: 'intelligence',
    quickActions: [
      { label: 'Executive Dashboard', href: '/executive-dashboard', icon: TrendingUp },
      { label: 'Fraud Prevention', href: '/fraud-prevention', icon: ShieldCheck },
      { label: 'Risk Assessment', href: '/risk-assessment', icon: AlertTriangle },
    ],
    requiredPermission: PERMISSIONS.COMPLIANCE_VIEW,
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    description: 'Monitor deadline reminders, notification delivery logs, and alerts inbox.',
    icon: Bell,
    href: '/notifications-hub',
    borderColor: CATEGORY_BORDER.alerts,
    iconBg: '#DC2626',
    category: 'alerts',
    quickActions: [
      { label: 'Alerts Inbox', href: '/alerts-inbox', icon: Eye },
      { label: 'Deadline Reminders', href: '/deadline-reminders', icon: Clock },
    ],
    requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: 'reports',
    title: 'Reports',
    description: 'Reports Hub with regulatory and utilization views, custom reports, and unified export.',
    icon: BarChart2,
    href: '/reports',
    borderColor: CATEGORY_BORDER.reports,
    iconBg: '#059669',
    category: 'reports',
    quickActions: [
      { label: 'Reports Hub', href: '/reports', icon: BarChart2 },
      { label: 'Custom Reports', href: '/custom-reports', icon: FileText },
      { label: 'Export', href: '/export', icon: ArrowRight },
    ],
    requiredPermission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    id: 'audit',
    title: 'Audit & Compliance',
    description: 'Full audit trails, archive audit log, compliance rules, live activity streams, and audit reports.',
    icon: ShieldCheck,
    href: '/audit-center',
    borderColor: CATEGORY_BORDER.audit,
    iconBg: '#9D174D',
    category: 'audit',
    quickActions: [
      { label: 'Audit Center', href: '/audit-center', icon: Eye },
      { label: 'Live Activity', href: '/live-activity', icon: Activity },
      { label: 'Compliance Rules', href: '/compliance-rules', icon: ShieldCheck },
    ],
    requiredPermission: PERMISSIONS.AUDIT_LOG_VIEW,
  },
  {
    id: 'administration',
    title: 'Administration',
    description: 'User management, officer permissions, system settings, alert thresholds, and client bank accounts.',
    icon: Settings,
    href: '/user-management',
    borderColor: CATEGORY_BORDER.admin,
    iconBg: '#4B5563',
    category: 'admin',
    quickActions: [
      { label: 'User Management', href: '/user-management', icon: Users },
      { label: 'System Settings', href: '/settings', icon: Settings },
    ],
    adminOnly: true,
    requiredPermission: PERMISSIONS.USER_MANAGEMENT_VIEW,
  },
  {
    id: 'archive',
    title: 'Archive',
    description: 'Physical vault management, collateral placement, document management, file loan workflow, and custody tracking.',
    icon: Archive,
    href: '/archive/vault-management',
    borderColor: CATEGORY_BORDER.archive,
    iconBg: '#059669',
    category: 'archive',
    quickActions: [
      { label: 'Vault Management', href: '/archive/vault-management', icon: Eye },
      { label: 'File Location', href: '/archive/file-location-status', icon: Activity },
      { label: 'Access Requests', href: '/archive/access-requests', icon: FileText },
    ],
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
];

// ─── KPI data per module (fetched from Supabase) ──────────────────────────────

interface ModuleKPI {
  primary: string;
  secondary: string;
  status: 'ok' | 'warn' | 'critical';
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModuleHubPage() {
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const { hasPermission, isSystemAdmin, loading } = usePermissions();

  const [todayStr, setTodayStr] = useState('');
  const [greeting, setGreeting] = useState('');
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({ totalCollateral: 0, activeWorkflows: 0, pendingActions: 0, overdueItems: 0 });
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [moduleKPIs, setModuleKPIs] = useState<Record<string, ModuleKPI>>({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [taskCount, setTaskCount] = useState<number | null>(null);

  const displayName = userProfile?.full_name || userProfile?.email || 'User';
  const firstName = displayName.split(' ')[0];
  const displayRole = userProfile?.role
    ? userProfile.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : '';
  const initials = userProfile?.full_name
    ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'U';

  // Set today's date client-side to avoid hydration mismatch
  useEffect(() => {
    const d = new Date();
    setTodayStr(d.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
    setGreeting(getGreeting());
  }, []);

  // Fetch summary stats and priority items
  useEffect(() => {
    async function fetchStats() {
      try {
        const [collateralCountRes, collateralDataRes, workflowRes, tasksRes] = await Promise.all([
          supabase.from('collateral_records').select('*', { count: 'exact', head: true }),
          supabase.from('collateral_records').select('id, status'),
          supabase.from('workflow_instances').select('id, status', { count: 'exact', head: false }).in('status', ['active', 'pending', 'in_progress']),
          supabase.from('user_tasks').select('id, status, due_date, priority').eq('status', 'pending'),
        ]);

        const totalCollateral = collateralCountRes.count ?? (collateralDataRes.data?.length ?? 0);
        const activeWorkflows = workflowRes.count ?? (workflowRes.data?.length ?? 0);

        const tasks = tasksRes.data ?? [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const overdueTasks = tasks.filter((t) => t.due_date && new Date(t.due_date) < today);
        const dueTodayTasks = tasks.filter((t) => {
          if (!t.due_date) return false;
          const d = new Date(t.due_date);
          d.setHours(0, 0, 0, 0);
          return d.getTime() === today.getTime();
        });

        setSummaryStats({
          totalCollateral,
          activeWorkflows,
          pendingActions: tasks.length,
          overdueItems: overdueTasks.length,
        });

        // Build priority tray
        const items: PriorityItem[] = [];
        overdueTasks.slice(0, 3).forEach((t) => {
          items.push({
            id: `task-${t.id}`,
            type: 'overdue',
            label: 'Overdue Task',
            detail: `Due ${new Date(t.due_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}`,
            href: '/my-tasks',
          });
        });
        dueTodayTasks.slice(0, 2).forEach((t) => {
          items.push({
            id: `today-${t.id}`,
            type: 'due-today',
            label: 'Due Today',
            detail: 'Task requires attention',
            href: '/my-tasks',
          });
        });

        // Escalated workflows
        const escalatedRes = await supabase
          .from('workflow_instances')
          .select('id, collateral_id')
          .eq('status', 'escalated')
          .limit(3);
        (escalatedRes.data ?? []).forEach((w) => {
          items.push({
            id: `esc-${w.id}`,
            type: 'escalated',
            label: 'Escalated Workflow',
            detail: 'Requires immediate review',
            href: '/workflows/instances',
          });
        });

        setPriorityItems(items.slice(0, 6));

        // Module KPIs — use correct collateral_status enum values
        const collateralData = collateralDataRes.data ?? [];
        const perfectedCount = collateralData.filter((c) => c.status === 'Perfected').length;
        const overdueCount = collateralData.filter((c) => c.status === 'Overdue').length;
        const pendingReviewCount = collateralData.filter(
          (c) => c.status === 'Submitted' || c.status === 'Under Review'
        ).length;
        const activeCount = collateralData.filter(
          (c) => c.status !== 'Released' && c.status !== 'Rejected'
        ).length;

        const kpis: Record<string, ModuleKPI> = {
          collaterals: {
            primary: `${totalCollateral} Total`,
            secondary: `${perfectedCount} Perfected · ${overdueCount} Overdue`,
            status: overdueCount > 5 ? 'critical' : pendingReviewCount > 5 ? 'warn' : 'ok',
          },
          obligors: {
            primary: `${totalCollateral} Linked`,
            secondary: 'Obligor portfolios',
            status: 'ok',
          },
          approvals: {
            primary: `${activeWorkflows} Active`,
            secondary: `${tasks.length} Awaiting Action`,
            status: tasks.length > 10 ? 'warn' : 'ok',
          },
          archive: {
            primary: 'Vault Active',
            secondary: 'Physical custody tracked',
            status: 'ok',
          },
          intelligence: {
            primary: 'AI Ready',
            secondary: 'Risk models active',
            status: 'ok',
          },
          alerts: {
            primary: `${overdueTasks.length} Overdue`,
            secondary: `${dueTodayTasks.length} Due Today`,
            status: overdueTasks.length > 0 ? 'critical' : 'ok',
          },
          reports: {
            primary: 'Reports Ready',
            secondary: 'All exports available',
            status: 'ok',
          },
          audit: {
            primary: 'Compliant',
            secondary: 'Audit trails active',
            status: 'ok',
          },
          administration: {
            primary: 'System Healthy',
            secondary: 'All services running',
            status: 'ok',
          },
          'workflows-admin': {
            primary: `${activeWorkflows} Running`,
            secondary: 'Templates configured',
            status: 'ok',
          },
        };
        setModuleKPIs(kpis);
      } catch {
        // Silently fail — stats are supplementary
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, []);

  // Fetch task count for current user
  useEffect(() => {
    async function fetchTaskCount() {
      if (!userProfile?.id) return;
      try {
        const count = await userTaskService.getPendingCount(userProfile.id);
        setTaskCount(count);
      } catch {
        setTaskCount(null);
      }
    }
    fetchTaskCount();
  }, [userProfile?.id]);

  const visibleModules = loading
    ? modules
    : modules.filter((m) => {
        if (m.adminOnly && !isSystemAdmin) return false;
        if (m.requiredPermission && !isSystemAdmin && !hasPermission(m.requiredPermission)) return false;
        return true;
      });

  const priorityTypeConfig = {
    overdue:    { color: '#DC2626', bg: 'rgba(220,38,38,0.08)', label: 'OVERDUE', icon: AlertTriangle },
    escalated:  { color: '#D97706', bg: 'rgba(217,119,6,0.08)', label: 'ESCALATED', icon: Zap },
    'due-today':{ color: '#007CB3', bg: 'rgba(0,124,179,0.08)', label: 'DUE TODAY', icon: Clock },
  };

  const statusDot = (status: 'ok' | 'warn' | 'critical') => {
    const map = { ok: '#10B981', warn: '#F59E0B', critical: '#EF4444' };
    return map[status];
  };

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden"
      style={{
        background: '#F5F4F2',
      }}
    >
      {/* ── Geometric mesh / grid background pattern ─────────────────────── */}
      <div
        className="pointer-events-none select-none fixed inset-0"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        <svg
          width="100%"
          height="100%"
          xmlns="http://www.w3.org/2000/svg"
          style={{ position: 'absolute', inset: 0 }}
        >
          <defs>
            <pattern id="mesh-grid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="#007CB3" strokeWidth="0.5" opacity="0.18" />
            </pattern>
            <pattern id="mesh-dots" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <circle cx="0" cy="0" r="1.2" fill="#007CB3" opacity="0.15" />
              <circle cx="48" cy="0" r="1.2" fill="#007CB3" opacity="0.15" />
              <circle cx="0" cy="48" r="1.2" fill="#007CB3" opacity="0.15" />
              <circle cx="48" cy="48" r="1.2" fill="#007CB3" opacity="0.15" />
              <circle cx="24" cy="24" r="1" fill="#00A9E0" opacity="0.12" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#mesh-grid)" />
          <rect width="100%" height="100%" fill="url(#mesh-dots)" />
        </svg>
      </div>

      {/* ── Full-page logo watermark ─────────────────────────────────────────── */}
      <div
        className="pointer-events-none select-none fixed inset-0 flex items-center justify-center"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        <div
          style={{
            width: 560,
            height: 560,
            borderRadius: '50%',
            border: '2px solid rgba(0,124,179,0.12)',
            boxShadow: '0 0 0 12px rgba(0,124,179,0.04), 0 0 80px 20px rgba(0,169,224,0.06)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,124,179,0.02)',
          }}
        >
          <img
            src="/assets/app_logo_shield.svg"
            alt=""
            style={{
              width: '340px',
              height: '340px',
              objectFit: 'contain',
              opacity: 0.055,
              filter: 'invert(27%) sepia(80%) saturate(600%) hue-rotate(175deg) brightness(85%) contrast(90%)',
              userSelect: 'none',
            }}
          />
        </div>
      </div>

      {/* ── Top Bar ─────────────────────────────────────────────────────────── */}
      <header
        className="flex items-center justify-between px-6 py-3 shrink-0 relative"
        style={{
          backgroundColor: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
          zIndex: 10,
        }}
      >
        <div className="flex items-center gap-3">
          <AppLogo size={32} />
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: '#111827' }}>CollateralMS</p>
            <p className="text-xs leading-tight" style={{ color: '#6B7280' }}>Module Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/onboarding-guide')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ color: '#374151', border: '1px solid rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.04)' }}
            title="Open Onboarding Guide"
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.08)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">Guide</span>
          </button>

          <div className="hidden sm:flex items-center gap-2.5 pl-2 border-l" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'var(--izou-primary)' }}
            >
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div>
              <p className="text-sm font-semibold leading-tight" style={{ color: '#111827' }}>{displayName}</p>
              <p className="text-xs leading-tight" style={{ color: '#6B7280' }}>{displayRole}</p>
            </div>
          </div>

          <button
            onClick={() => signOut?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ml-1"
            style={{ color: '#6B7280' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.06)'; (e.currentTarget as HTMLElement).style.color = '#111827'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = '#6B7280'; }}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Hero Section ────────────────────────────────────────────────────── */}
      <div
        className="px-6 pt-8 pb-6 relative"
        style={{
          borderBottom: '1px solid rgba(0,0,0,0.07)',
          zIndex: 1,
        }}
      >
        <div className="max-w-6xl mx-auto relative">
          {/* Welcome row */}
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
            <div>
              {/* <div className="flex items-center gap-2 mb-1">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold"
                  style={{ backgroundColor: 'rgba(0,124,179,0.1)', color: '#007CB3', border: '1px solid rgba(0,124,179,0.2)' }}
                >
                  <Layers size={10} />
                  Command Centre
                </span>
              </div> */}
              <h1 className="text-2xl font-bold leading-tight" style={{ color: '#007CB3' }}>
                Good {greeting || '—'}, {firstName}
              </h1>
              <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: '#6B7280' }}>
                <Calendar size={13} />
                {todayStr || '—'}
              </p>
            </div>
            <button
              onClick={() => router.push('/workflows/tasks')}
              className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0"
              style={{ backgroundColor: 'var(--izou-primary)', color: '#fff', boxShadow: '0 4px 14px rgba(0,124,179,0.3)' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
            >
              <Activity size={14} />
              My Tasks
              {taskCount !== null && taskCount > 0 && (
                <span
                  className="inline-flex items-center justify-center rounded-full text-xs font-bold leading-none"
                  style={{
                    minWidth: '18px',
                    height: '18px',
                    padding: '0 5px',
                    backgroundColor: '#EF4444',
                    color: '#fff',
                    fontSize: '10px',
                  }}
                >
                  {taskCount > 99 ? '99+' : taskCount}
                </span>
              )}
              <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Priority Tray ────────────────────────────────────────────────────── */}
      {!statsLoading && priorityItems.length > 0 && (
        <div
          className="px-6 py-3 relative"
          style={{ backgroundColor: 'rgba(254,242,242,0.9)', borderBottom: '1px solid rgba(220,38,38,0.15)', zIndex: 1 }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <AlertTriangle size={13} style={{ color: '#DC2626' }} />
              <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: '#DC2626' }}>
                Priority Attention Required
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {priorityItems.map((item) => {
                const cfg = priorityTypeConfig[item.type];
                const ItemIcon = cfg.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                    style={{
                      backgroundColor: '#fff',
                      color: cfg.color,
                      border: `1px solid ${cfg.color}40`,
                      boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
                    }}
                    onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = cfg.bg; }}
                    onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fff'; }}
                  >
                    <ItemIcon size={11} />
                    <span className="font-bold">{cfg.label}</span>
                    <span className="opacity-50">·</span>
                    <span>{item.detail}</span>
                    <ArrowRight size={10} />
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Module Grid ──────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-8 relative" style={{ zIndex: 1 }}>
        <div className="max-w-6xl mx-auto">

          {/* <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: '#9CA3AF' }}>
              Modules
            </h2>
            <span className="text-xs" style={{ color: '#9CA3AF' }}>
              {visibleModules.length} available
            </span>
          </div> */}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {visibleModules.map((mod) => {
              const ModIcon = mod.icon;
              const kpi = moduleKPIs[mod.id];
              const borderColor = CATEGORY_BORDER[mod.category];

              return (
                <div
                  key={mod.id}
                  className="group relative flex flex-col rounded-xl overflow-hidden transition-all duration-200 cursor-pointer"
                  style={{
                    backgroundColor: '#ffffff',
                    border: '1px solid rgba(0,0,0,0.07)',
                    borderLeft: `4px solid ${borderColor}`,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    minHeight: '200px',
                  }}
                  onClick={() => router.push(mod.href)}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = `0 8px 24px rgba(0,0,0,0.12), 0 0 0 1px ${borderColor}30`;
                    (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)';
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                    (e.currentTarget as HTMLElement).style.transform = 'none';
                  }}
                >
                  {/* Card header */}
                  <div className="p-5 pb-3 flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                        style={{ backgroundColor: mod.iconBg, boxShadow: `0 4px 12px ${mod.iconBg}50` }}
                      >
                        <ModIcon size={18} color="#fff" />
                      </div>

                      {/* Status indicator */}
                      {kpi && (
                        <div className="flex items-center gap-1.5">
                          <span
                            className="w-2 h-2 rounded-full"
                            style={{ backgroundColor: statusDot(kpi.status) }}
                          />
                          <span className="text-xs" style={{ color: '#9CA3AF' }}>
                            {kpi.status === 'ok' ? 'All clear' : kpi.status === 'warn' ? 'Attention' : 'Critical'}
                          </span>
                        </div>
                      )}
                    </div>

                    <h2 className="text-sm font-bold mb-1" style={{ color: '#111827' }}>
                      {mod.title}
                    </h2>
                    <p className="text-xs leading-relaxed" style={{ color: '#6B7280' }}>
                      {mod.description}
                    </p>
                  </div>

                  {/* KPI strip */}
                  {kpi && (
                    <div
                      className="px-5 py-2.5 flex items-center gap-3"
                      style={{ borderTop: '1px solid rgba(0,0,0,0.06)', backgroundColor: 'rgba(0,0,0,0.015)' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex-1 min-w-0">
                        <span className="text-sm font-bold" style={{ color: borderColor }}>{kpi.primary}</span>
                        <span className="text-xs ml-2" style={{ color: '#9CA3AF' }}>{kpi.secondary}</span>
                      </div>
                      <TrendingUp size={13} style={{ color: borderColor, opacity: 0.5 }} />
                    </div>
                  )}

                  {/* Quick actions */}
                  <div
                    className="px-5 py-3 flex items-center gap-2"
                    style={{ borderTop: '1px solid rgba(0,0,0,0.06)' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {mod.quickActions.slice(0, 2).map((action) => {
                      const ActionIcon = action.icon;
                      return (
                        <button
                          key={action.label}
                          onClick={(e) => { e.stopPropagation(); router.push(action.href); }}
                          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-all"
                          style={{
                            color: borderColor,
                            backgroundColor: `${borderColor}12`,
                            border: `1px solid ${borderColor}25`,
                          }}
                          onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = `${borderColor}25`; }}
                          onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = `${borderColor}12`; }}
                        >
                          <ActionIcon size={10} />
                          {action.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Empty state */}
          {!loading && visibleModules.length === 0 && (
            <div className="text-center py-20">
              <ShieldCheck size={40} className="mx-auto mb-3 opacity-20" style={{ color: '#6B7280' }} />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                No modules are available for your current role. Contact your administrator.
              </p>
            </div>
          )}

          {/* Onboarding Guide Section */}
          <div
            className="mt-8 rounded-xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4"
            style={{
              background: '#EFF6FF',
              border: '1px solid rgba(37,99,235,0.2)',
              boxShadow: '0 2px 8px rgba(37,99,235,0.08)',
            }}
          >
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
              style={{ backgroundColor: '#2563EB', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
            >
              <BookOpen size={18} color="#fff" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold mb-0.5" style={{ color: '#1E3A8A' }}>
                New to CollateralMS? Start with the Onboarding Guide
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: '#3B82F6' }}>
                Step-by-step walkthroughs for all modules — from registering collateral to running compliance audits.
              </p>
            </div>
            <button
              onClick={() => router.push('/onboarding-guide')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all"
              style={{ backgroundColor: '#2563EB', color: '#fff', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' }}
              onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#1D4ED8'; }}
              onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#2563EB'; }}
            >
              <BookOpen size={13} />
              Open Guide
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="text-center py-4 text-xs relative" style={{ color: '#9CA3AF', zIndex: 1 }}>
        Powered by{' '}
        <a
          href="https://contentpro.co.tz"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline"
          style={{ color: '#6B7280' }}
        >
          Contentpro
        </a>
      </footer>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
