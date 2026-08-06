'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import { userTaskService } from '@/lib/supabase/userTaskService';
import { FolderOpen, Brain, Bell, BarChart2, ShieldCheck, Settings, LogOut, ChevronRight, Layers, Archive, Users, CheckSquare, BookOpen, HelpCircle, AlertTriangle, Clock, TrendingUp, ArrowRight, Calendar, Activity, Zap, FileText, Plus, Eye, Search, ChevronDown, FlaskConical,  } from 'lucide-react';
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
  category:
    | 'collateral' |'workflow' |'archive' |'intelligence' |'alerts' |'reports' |'audit' |'admin';
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
  workflow: '#D97706',
  archive: '#059669',
  intelligence: '#7C3AED',
  alerts: '#DC2626',
  reports: '#065F46',
  audit: '#9D174D',
  admin: '#374151',
};

const CATEGORY_BG: Record<string, string> = {
  collateral: 'rgba(0,124,179,0.06)',
  workflow: 'rgba(217,119,6,0.06)',
  archive: 'rgba(5,150,105,0.06)',
  intelligence: 'rgba(124,58,237,0.06)',
  alerts: 'rgba(220,38,38,0.06)',
  reports: 'rgba(6,95,70,0.06)',
  audit: 'rgba(157,23,77,0.06)',
  admin: 'rgba(55,65,81,0.06)',
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
    description:
      'Manage obligor profiles, credit risk scores, exposure metrics, and approval trends.',
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
    description:
      'Centralised approval inbox for perfection, document, release, and archive request workflows. Design templates, configure auto-triggers, manage escalations, and monitor workflow KPIs.',
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
    id: 'intelligence',
    title: 'Analytics & Intelligence',
    description:
      'AI-powered risk assessment, fraud prevention, deadline predictions, and analytics.',
    icon: Brain,
    href: '/executive-dashboard',
    borderColor: CATEGORY_BORDER.intelligence,
    iconBg: '#7C3AED',
    category: 'intelligence',
    quickActions: [
      { label: 'Executive Dashboard', href: '/executive-dashboard', icon: TrendingUp },
      { label: 'AI Risk & Fraud', href: '/ai-risk-fraud', icon: ShieldCheck },
      { label: 'Cohort Analytics', href: '/cohort-analytics', icon: AlertTriangle },
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
    description:
      'Reports Hub with regulatory and utilization views, custom reports, and unified export.',
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
    description:
      'Full audit trails, archive audit log, compliance rules, live activity streams, and audit reports.',
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
    description:
      'User management, officer permissions, system settings, alert thresholds, and client bank accounts.',
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
    description:
      'Physical vault management, collateral placement, document management, file loan workflow, and custody tracking.',
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

// ─── KPI data per module ──────────────────────────────────────────────────────

interface ModuleKPI {
  primary: string;
  secondary: string;
  status: 'ok' | 'warn' | 'critical';
}

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

const ModuleSkeleton = () => (
  <div className="rounded-xl p-4 border border-gray-100 bg-white animate-pulse">
    <div className="flex items-start gap-3">
      <div className="w-9 h-9 rounded-lg bg-gray-200" />
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div className="h-4 bg-gray-200 rounded w-1/2" />
          <div className="w-1.5 h-1.5 rounded-full bg-gray-200" />
        </div>
        <div className="h-3 bg-gray-200 rounded w-full mt-1.5" />
        <div className="h-3 bg-gray-200 rounded w-2/3 mt-1" />
        <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
          <div className="flex items-center gap-2">
            <div className="h-3 bg-gray-200 rounded w-12" />
            <div className="h-2 bg-gray-200 rounded w-16" />
          </div>
          <div className="flex gap-1">
            <div className="w-6 h-5 bg-gray-200 rounded" />
            <div className="w-6 h-5 bg-gray-200 rounded" />
          </div>
        </div>
      </div>
    </div>
  </div>
);

// ─── Component ────────────────────────────────────────────────────────────────

export default function ModuleHubPage() {
  const router = useRouter();
  const { userProfile, signOut } = useAuth();
  const { hasPermission, isSystemAdmin, loading } = usePermissions();

  const [todayStr, setTodayStr] = useState('');
  const [greeting, setGreeting] = useState('');
  const [summaryStats, setSummaryStats] = useState<SummaryStats>({
    totalCollateral: 0,
    activeWorkflows: 0,
    pendingActions: 0,
    overdueItems: 0,
  });
  const [priorityItems, setPriorityItems] = useState<PriorityItem[]>([]);
  const [moduleKPIs, setModuleKPIs] = useState<Record<string, ModuleKPI>>({});
  const [statsLoading, setStatsLoading] = useState(true);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [recentModules, setRecentModules] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDismissed, setShowDismissed] = useState(false);

  // ─── Additional sub-label stats ───────────────────────────────────────────
  const [subStats, setSubStats] = useState({
    perfectedCount: 0,
    collateralOverdueCount: 0,
    escalatedCount: 0,
    dueTodayCount: 0,
    highPriorityCount: 0,
  });

  const displayName = userProfile?.full_name || userProfile?.email || 'User';
  const firstName = displayName.split(' ')[0];
  const displayRole = userProfile?.role
    ? userProfile.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : '';
  const initials = userProfile?.full_name
    ? userProfile.full_name
        .split(' ')
        .map((n: string) => n[0])
        .join('')
        .toUpperCase()
        .slice(0, 2)
    : 'U';

  // ─── Compute visible modules (merged Workflows Admin into Workflows for admins) ──
  const visibleModules = useMemo(() => {
    if (loading) return modules;
    return modules
      .filter((m) => {
        if (m.adminOnly && !isSystemAdmin) return false;
        if (m.requiredPermission && !isSystemAdmin && !hasPermission(m.requiredPermission))
          return false;
        return true;
      })
      .map((m) => {
        // Merge Workflows Admin quick actions into Workflows card for admins
        if (m.id === 'approvals' && isSystemAdmin) {
          return {
            ...m,
            quickActions: [
              ...m.quickActions,
              { label: 'Templates', href: '/workflows-admin/templates', icon: FileText },
              { label: 'Trigger Rules', href: '/workflows-admin/trigger-rules', icon: Zap },
              { label: 'KPIs', href: '/workflows-admin/kpis', icon: TrendingUp },
            ],
          };
        }
        return m;
      });
  }, [loading, isSystemAdmin, hasPermission]);

  // Filter modules based on search
  const filteredModules = useMemo(() => {
    if (!searchQuery) return visibleModules;
    return visibleModules.filter(
      (m) =>
        m.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        m.description.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [visibleModules, searchQuery]);

  // ─── Effects ──────────────────────────────────────────────────────────────

  useEffect(() => {
    const d = new Date();
    setTodayStr(
      d.toLocaleDateString('en-GB', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    );
    setGreeting(getGreeting());
  }, []);

  useEffect(() => {
    const recent = JSON.parse(localStorage.getItem('recentModules') || '[]');
    setRecentModules(recent);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
      if ((e.metaKey || e.ctrlKey) && /^[1-9]$/.test(e.key)) {
        const index = parseInt(e.key) - 1;
        if (filteredModules[index]) {
          handleModuleClick(filteredModules[index].id, filteredModules[index].href);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filteredModules]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [collateralCountRes, collateralDataRes, workflowRes, tasksRes] = await Promise.all([
          supabase.from('collateral_records').select('*', { count: 'exact', head: true }),
          supabase.from('collateral_records').select('id, status'),
          supabase
            .from('workflow_instances')
            .select('id, status', { count: 'exact', head: false })
            .in('status', ['active', 'pending', 'in_progress']),
          supabase
            .from('user_tasks')
            .select('id, status, due_date, priority')
            .eq('status', 'pending'),
        ]);

        const totalCollateral = collateralCountRes.count ?? collateralDataRes.data?.length ?? 0;
        const activeWorkflows = workflowRes.count ?? workflowRes.data?.length ?? 0;

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

        const collateralData = collateralDataRes.data ?? [];
        const perfectedCount = collateralData.filter((c) => c.status === 'Perfected').length;
        const overdueCount = collateralData.filter((c) => c.status === 'Overdue').length;
        const pendingReviewCount = collateralData.filter(
          (c) => c.status === 'Submitted' || c.status === 'Under Review'
        ).length;

        const escalatedCount = escalatedRes.data?.length ?? 0;
        const highPriorityCount = tasks.filter((t) => t.priority === 'high').length;

        setSubStats({
          perfectedCount,
          collateralOverdueCount: overdueCount,
          escalatedCount,
          dueTodayCount: dueTodayTasks.length,
          highPriorityCount,
        });

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
        // Silently fail
      } finally {
        setStatsLoading(false);
      }
    }
    fetchStats();
  }, []);

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

  // ─── Helper functions ──────────────────────────────────────────────────────

  const priorityTypeConfig = {
    overdue: {
      color: '#DC2626',
      bg: 'rgba(220,38,38,0.08)',
      label: 'OVERDUE',
      icon: AlertTriangle,
    },
    escalated: { color: '#D97706', bg: 'rgba(217,119,6,0.08)', label: 'ESCALATED', icon: Zap },
    'due-today': { color: '#007CB3', bg: 'rgba(0,124,179,0.08)', label: 'DUE TODAY', icon: Clock },
  };

  const statusDot = (status: 'ok' | 'warn' | 'critical') => {
    const map = { ok: '#10B981', warn: '#F59E0B', critical: '#EF4444' };
    return map[status];
  };

  const handleModuleClick = (modId: string, href: string) => {
    const recent = JSON.parse(localStorage.getItem('recentModules') || '[]');
    const updated = [modId, ...recent.filter((id: string) => id !== modId)].slice(0, 4);
    localStorage.setItem('recentModules', JSON.stringify(updated));
    setRecentModules(updated);
    router.push(href);
  };

  const handleDismissPriority = (id: string) => {
    const dismissed = JSON.parse(localStorage.getItem('dismissedPriority') || '[]');
    localStorage.setItem('dismissedPriority', JSON.stringify([...dismissed, id]));
    setPriorityItems(priorityItems.filter((item) => item.id !== id));
  };

  const handleDismissAll = () => {
    const dismissed = JSON.parse(localStorage.getItem('dismissedPriority') || '[]');
    const allIds = priorityItems.map((item) => item.id);
    localStorage.setItem('dismissedPriority', JSON.stringify([...dismissed, ...allIds]));
    setPriorityItems([]);
  };

  // ─── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="min-h-screen flex flex-col relative overflow-x-hidden"
      style={{
        background: 'linear-gradient(145deg, #F8F7F5 0%, #F0EFEC 100%)',
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
            <pattern
              id="mesh-grid"
              x="0"
              y="0"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 48 0 L 0 0 0 48"
                fill="none"
                stroke="#007CB3"
                strokeWidth="0.5"
                opacity="0.12"
              />
            </pattern>
            <pattern
              id="mesh-dots"
              x="0"
              y="0"
              width="48"
              height="48"
              patternUnits="userSpaceOnUse"
            >
              <circle cx="0" cy="0" r="1.2" fill="#007CB3" opacity="0.1" />
              <circle cx="48" cy="0" r="1.2" fill="#007CB3" opacity="0.1" />
              <circle cx="0" cy="48" r="1.2" fill="#007CB3" opacity="0.1" />
              <circle cx="48" cy="48" r="1.2" fill="#007CB3" opacity="0.1" />
              <circle cx="24" cy="24" r="1" fill="#00A9E0" opacity="0.08" />
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
            border: '2px solid rgba(0,124,179,0.08)',
            boxShadow: '0 0 0 12px rgba(0,124,179,0.03), 0 0 80px 20px rgba(0,169,224,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,124,179,0.01)',
          }}
        >
          <img
            src="/assets/app_logo_shield.svg"
            alt=""
            style={{
              width: '340px',
              height: '340px',
              objectFit: 'contain',
              opacity: 0.04,
              filter:
                'invert(27%) sepia(80%) saturate(600%) hue-rotate(175deg) brightness(85%) contrast(90%)',
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
        <div className="flex items-center gap-4">
          <AppLogo size={32} />
          <div>
            <p className="text-sm font-bold leading-tight" style={{ color: '#111827' }}>
              CollateralMS
            </p>
            <p className="text-xs leading-tight" style={{ color: '#6B7280' }}>
              Module Hub
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="hidden md:flex flex-1 max-w-md mx-6">
          <div className="relative w-full">
            <input
              type="search"
              placeholder="Search modules, collateral, obligors... (⌘K)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 pl-10 rounded-lg text-sm transition-all"
              style={{
                backgroundColor: 'rgba(0,0,0,0.04)',
                border: '1px solid rgba(0,0,0,0.06)',
                color: '#111827',
              }}
              onFocus={(e) => {
                e.currentTarget.style.backgroundColor = '#fff';
                e.currentTarget.style.borderColor = '#007CB3';
                e.currentTarget.style.boxShadow = '0 0 0 3px rgba(0,124,179,0.1)';
              }}
              onBlur={(e) => {
                e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)';
                e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            />
            <Search size={16} className="absolute left-3 top-2.5" style={{ color: '#9CA3AF' }} />
            <kbd
              className="absolute right-3 top-2.5 text-xs px-1.5 py-0.5 rounded"
              style={{
                color: '#9CA3AF',
                backgroundColor: 'rgba(0,0,0,0.06)',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              ⌘K
            </kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: '#6B7280' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => router.push('/notifications')}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {taskCount !== null && taskCount > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white text-[10px] font-bold leading-none min-w-[18px] h-[18px] px-1"
                style={{ backgroundColor: '#EF4444' }}
              >
                {taskCount > 9 ? '9+' : taskCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/onboarding-guide')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              color: '#374151',
              border: '1px solid rgba(0,0,0,0.12)',
              backgroundColor: 'rgba(0,0,0,0.04)',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.08)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)';
            }}
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">Onboarding</span>
          </button>

          <button
            onClick={() => router.push('/guides/testing')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{
              color: '#374151',
              border: '1px solid rgba(0,0,0,0.12)',
              backgroundColor: 'rgba(0,0,0,0.04)',
            }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.08)';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)';
            }}
          >
            <FlaskConical size={14} />
            <span className="hidden sm:inline">Testing</span>
          </button>

          {/* Profile */}
          <div className="relative group">
            <button
              className="flex items-center gap-2.5 pl-2 border-l border-r border-transparent hover:border-gray-200 transition-colors"
              style={{ borderColor: 'rgba(0,0,0,0.1)' }}
            >
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'var(--izou-primary)' }}
              >
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold leading-tight" style={{ color: '#111827' }}>
                  {displayName}
                </p>
                <p className="text-xs leading-tight" style={{ color: '#6B7280' }}>
                  {displayRole}
                </p>
              </div>
              <ChevronDown size={14} className="hidden sm:block" style={{ color: '#9CA3AF' }} />
            </button>
          </div>

          <button
            onClick={() => signOut?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ml-1"
            style={{ color: '#6B7280' }}
            onMouseOver={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = '#FEE2E2';
              (e.currentTarget as HTMLElement).style.color = '#DC2626';
            }}
            onMouseOut={(e) => {
              (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
              (e.currentTarget as HTMLElement).style.color = '#6B7280';
            }}
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
              style={{
                backgroundColor: 'var(--izou-primary)',
                color: '#fff',
                boxShadow: '0 4px 14px rgba(0,124,179,0.3)',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '0.9';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.opacity = '1';
              }}
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

          {/* Quick Stats Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div
              className="bg-white rounded-xl p-4 transition-all hover:shadow-md"
              style={{ border: '1px solid rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    Total Collateral
                  </p>
                  <p className="text-2xl font-bold" style={{ color: '#111827' }}>
                    {summaryStats.totalCollateral}
                  </p>
                  {!statsLoading && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                      <span style={{ color: '#10B981' }}>{subStats.perfectedCount} Perfected</span>
                      {' · '}
                      <span style={{ color: subStats.collateralOverdueCount > 0 ? '#DC2626' : '#9CA3AF' }}>
                        {subStats.collateralOverdueCount} Overdue
                      </span>
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(0,124,179,0.08)' }}>
                  <FolderOpen size={16} style={{ color: '#007CB3' }} />
                </div>
              </div>
            </div>
            <div
              className="bg-white rounded-xl p-4 transition-all hover:shadow-md"
              style={{ border: '1px solid rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    Active Workflows
                  </p>
                  <p className="text-2xl font-bold" style={{ color: '#111827' }}>
                    {summaryStats.activeWorkflows}
                  </p>
                  {!statsLoading && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                      <span style={{ color: subStats.escalatedCount > 0 ? '#D97706' : '#9CA3AF' }}>
                        {subStats.escalatedCount} Escalated
                      </span>
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(217,119,6,0.08)' }}>
                  <Activity size={16} style={{ color: '#D97706' }} />
                </div>
              </div>
            </div>
            <div
              className="bg-white rounded-xl p-4 transition-all hover:shadow-md"
              style={{ border: '1px solid rgba(0,0,0,0.05)' }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    Pending Actions
                  </p>
                  <p className="text-2xl font-bold" style={{ color: '#111827' }}>
                    {summaryStats.pendingActions}
                  </p>
                  {!statsLoading && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                      <span style={{ color: subStats.dueTodayCount > 0 ? '#007CB3' : '#9CA3AF' }}>
                        {subStats.dueTodayCount} Due Today
                      </span>
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(124,58,237,0.08)' }}>
                  <CheckSquare size={16} style={{ color: '#7C3AED' }} />
                </div>
              </div>
            </div>
            <div
              className="bg-white rounded-xl p-4 transition-all hover:shadow-md cursor-pointer"
              style={{ border: '1px solid rgba(0,0,0,0.05)' }}
              onClick={() => router.push('/my-tasks?filter=overdue')}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: '#6B7280' }}>
                    Overdue
                  </p>
                  <p
                    className="text-2xl font-bold"
                    style={{ color: summaryStats.overdueItems > 0 ? '#DC2626' : '#111827' }}
                  >
                    {summaryStats.overdueItems}
                  </p>
                  {!statsLoading && (
                    <p className="text-[11px] mt-0.5" style={{ color: '#9CA3AF' }}>
                      <span style={{ color: subStats.highPriorityCount > 0 ? '#DC2626' : '#9CA3AF' }}>
                        {subStats.highPriorityCount} High Priority
                      </span>
                    </p>
                  )}
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: 'rgba(220,38,38,0.08)' }}>
                  <AlertTriangle size={16} style={{ color: '#DC2626' }} />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Priority Tray ────────────────────────────────────────────────────── */}
      {!statsLoading && priorityItems.length > 0 && !showDismissed && (
        <div
          className="px-6 py-4 relative"
          style={{
            background: 'linear-gradient(135deg, #FEF2F2 0%, #FEF9F9 100%)',
            borderBottom: '2px solid rgba(220,38,38,0.1)',
            zIndex: 1,
          }}
        >
          <div className="max-w-6xl mx-auto">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <div className="p-1 rounded-full bg-red-100 animate-pulse">
                  <AlertTriangle size={14} style={{ color: '#DC2626' }} />
                </div>
                <span className="text-sm font-semibold" style={{ color: '#DC2626' }}>
                  {priorityItems.length} {priorityItems.length === 1 ? 'item' : 'items'} need your
                  attention
                </span>
              </div>
              <button
                onClick={handleDismissAll}
                className="text-xs hover:underline transition-colors"
                style={{ color: '#9CA3AF' }}
              >
                Dismiss all
              </button>
            </div>
            <div className="flex flex-wrap gap-2.5">
              {priorityItems.slice(0, 4).map((item) => {
                const cfg = priorityTypeConfig[item.type];
                const ItemIcon = cfg.icon;
                return (
                  <button
                    key={item.id}
                    onClick={() => router.push(item.href)}
                    className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl text-xs font-medium transition-all group"
                    style={{
                      backgroundColor: '#fff',
                      color: cfg.color,
                      border: `1px solid ${cfg.color}25`,
                      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                    }}
                    onMouseOver={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = cfg.bg;
                      (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)';
                      (e.currentTarget as HTMLElement).style.borderColor = cfg.color;
                    }}
                    onMouseOut={(e) => {
                      (e.currentTarget as HTMLElement).style.backgroundColor = '#fff';
                      (e.currentTarget as HTMLElement).style.transform = 'none';
                      (e.currentTarget as HTMLElement).style.borderColor = `${cfg.color}25`;
                    }}
                  >
                    <ItemIcon size={12} />
                    <span className="font-bold">{cfg.label}</span>
                    <span className="opacity-30">·</span>
                    <span className="max-w-[120px] truncate">{item.detail}</span>
                    <ArrowRight
                      size={10}
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                    />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDismissPriority(item.id);
                      }}
                      className="ml-1 opacity-40 hover:opacity-100 transition-opacity"
                    >
                      ×
                    </button>
                  </button>
                );
              })}
              {priorityItems.length > 4 && (
                <button
                  onClick={() => router.push('/priority-center')}
                  className="px-3.5 py-2 rounded-xl text-xs font-medium transition-colors"
                  style={{
                    color: '#6B7280',
                    backgroundColor: 'rgba(0,0,0,0.03)',
                    border: '1px solid rgba(0,0,0,0.06)',
                  }}
                  onMouseOver={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.06)';
                  }}
                  onMouseOut={(e) => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.03)';
                  }}
                >
                  +{priorityItems.length - 4} more
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Module Grid ──────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-8 relative" style={{ zIndex: 1 }}>
        <div className="max-w-6xl mx-auto">
          {/* Recently Used Modules */}
          {recentModules.length > 0 && !searchQuery && (
            <div className="mb-6">
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: '#9CA3AF' }}
              >
                Recently Used
              </h3>
              <div className="flex flex-wrap gap-2">
                {recentModules.map((id) => {
                  const mod = modules.find((m) => m.id === id);
                  if (!mod) return null;
                  const ModIcon = mod.icon;
                  return (
                    <button
                      key={id}
                      onClick={() => handleModuleClick(id, mod.href)}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm transition-all"
                      style={{
                        backgroundColor: '#ffffff',
                        border: '1px solid rgba(0,0,0,0.06)',
                        color: '#111827',
                      }}
                      onMouseOver={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = mod.iconBg;
                        (e.currentTarget as HTMLElement).style.backgroundColor =
                          'rgba(255,255,255,0.9)';
                      }}
                      onMouseOut={(e) => {
                        (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)';
                        (e.currentTarget as HTMLElement).style.backgroundColor = '#ffffff';
                      }}
                    >
                      <ModIcon size={14} style={{ color: mod.iconBg }} />
                      {mod.title}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Search Results Info */}
          {searchQuery && (
            <div className="mb-4 text-sm" style={{ color: '#6B7280' }}>
              Found {filteredModules.length} {filteredModules.length === 1 ? 'module' : 'modules'} for "
              {searchQuery}"
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => <ModuleSkeleton key={i} />)
            ) : (
              filteredModules.map((mod) => {
                const ModIcon = mod.icon;
                const kpi = moduleKPIs[mod.id];
                const borderColor = CATEGORY_BORDER[mod.category];

                return (
                  <div
                    key={mod.id}
                    className="group relative flex flex-col rounded-2xl overflow-hidden transition-all duration-300 cursor-pointer"
                    style={{
                      backgroundColor: '#ffffff',
                      border: '1px solid rgba(0,0,0,0.05)',
                      boxShadow:
                        '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)',
                      minHeight: '160px',
                    }}
                    onClick={() => handleModuleClick(mod.id, mod.href)}
                    onMouseOver={(e) => {
                      e.currentTarget.style.boxShadow =
                        `0 20px 25px -5px rgba(0,0,0,0.08), 0 10px 10px -5px rgba(0,0,0,0.04)`;
                      e.currentTarget.style.transform = 'translateY(-4px) scale(1.01)';
                      e.currentTarget.style.borderColor = `${borderColor}40`;
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.boxShadow =
                        '0 4px 6px -1px rgba(0,0,0,0.05), 0 2px 4px -1px rgba(0,0,0,0.03)';
                      e.currentTarget.style.transform = 'none';
                      e.currentTarget.style.borderColor = 'rgba(0,0,0,0.05)';
                    }}
                  >
                    {/* Gradient border top */}
                    <div
                      className="absolute top-0 left-0 right-0 h-0.5"
                      style={{
                        background: `linear-gradient(90deg, ${borderColor}80, ${borderColor}20)`,
                        opacity: 0.6,
                      }}
                    />

                    {/* Row 1: Icon + Title + Status */}
                    <div className="p-4 pb-1">
                      <div className="flex items-center gap-3">
                        <div
                          className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110"
                          style={{
                            backgroundColor: mod.iconBg,
                            boxShadow: `0 4px 12px ${mod.iconBg}40`,
                          }}
                        >
                          <ModIcon size={16} color="#fff" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h2 className="text-sm font-bold leading-tight" style={{ color: '#111827' }}>
                              {mod.title}
                            </h2>
                            {kpi && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className="w-1.5 h-1.5 rounded-full"
                                  style={{ backgroundColor: statusDot(kpi.status) }}
                                />
                                <span
                                  className="text-[10px] whitespace-nowrap"
                                  style={{ color: '#9CA3AF' }}
                                >
                                  {kpi.status === 'ok' ?'All clear'
                                    : kpi.status === 'warn' ?'Attention' :'Critical'}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Row 2: Description + KPI + Actions */}
                    <div className="px-4 py-1 flex-1 flex flex-col justify-between">
                      <p className="text-xs leading-relaxed line-clamp-2" style={{ color: '#6B7280' }}>
                        {mod.description}
                      </p>
                      
                      <div className="flex items-center justify-between mt-1.5 pt-1.5 border-t" style={{ borderColor: 'rgba(0,0,0,0.04)' }}>
                        {kpi && (
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-xs font-semibold" style={{ color: borderColor }}>
                              {kpi.primary}
                            </span>
                            <span className="text-[10px] truncate" style={{ color: '#9CA3AF' }}>
                              {kpi.secondary}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          {mod.quickActions.slice(0, 2).map((action) => {
                            const ActionIcon = action.icon;
                            return (
                              <button
                                key={action.label}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  router.push(action.href);
                                }}
                                className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium transition-all"
                                style={{
                                  color: borderColor,
                                  backgroundColor: `${borderColor}12`,
                                  border: `1px solid ${borderColor}25`,
                                }}
                                onMouseOver={(e) => {
                                  (e.currentTarget as HTMLElement).style.backgroundColor =
                                    `${borderColor}25`;
                                }}
                                onMouseOut={(e) => {
                                  (e.currentTarget as HTMLElement).style.backgroundColor =
                                    `${borderColor}12`;
                                }}
                              >
                                <ActionIcon size={8} />
                                <span className="hidden sm:inline">{action.label}</span>
                              </button>
                            );
                          })}
                          <span
                            className="text-[9px] opacity-20 group-hover:opacity-50 transition-opacity ml-0.5"
                            style={{ color: '#6B7280' }}
                          >
                            ⌘{filteredModules.indexOf(mod) + 1}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Empty state */}
          {!loading && filteredModules.length === 0 && (
            <div className="text-center py-20">
              <ShieldCheck
                size={40}
                className="mx-auto mb-3 opacity-20"
                style={{ color: '#6B7280' }}
              />
              <p className="text-sm" style={{ color: '#9CA3AF' }}>
                {searchQuery
                  ? `No modules found for "${searchQuery}"`
                  : 'No modules are available for your current role. Contact your administrator.'}
              </p>
            </div>
          )}

          {/* Onboarding Guide Section */}
          <div
            className="mt-8 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all hover:shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 100%)',
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
                Step-by-step walkthroughs for all modules — from registering collateral to running
                compliance audits.
              </p>
            </div>
            <button
              onClick={() => router.push('/onboarding-guide')}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all"
              style={{
                backgroundColor: '#2563EB',
                color: '#fff',
                boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
              }}
              onMouseOver={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#1D4ED8';
                (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)';
              }}
              onMouseOut={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = '#2563EB';
                (e.currentTarget as HTMLElement).style.transform = 'none';
              }}
            >
              <BookOpen size={13} />
              Open Guide
              <ChevronRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile Bottom Navigation ──────────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50">
        <div className="flex justify-around">
          <button
            className="flex flex-col items-center gap-1 text-xs"
            style={{ color: '#007CB3' }}
            onClick={() => router.push('/module-hub')}
          >
            <Layers size={20} />
            <span>Modules</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-xs"
            style={{ color: '#9CA3AF' }}
            onClick={() => {
              const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
              if (searchInput) searchInput.focus();
            }}
          >
            <Search size={20} />
            <span>Search</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-xs relative"
            style={{ color: '#9CA3AF' }}
            onClick={() => router.push('/notifications')}
          >
            <Bell size={20} />
            {taskCount !== null && taskCount > 0 && (
              <span
                className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center"
                style={{ backgroundColor: '#EF4444' }}
              >
                {taskCount > 9 ? '9+' : taskCount}
              </span>
            )}
            <span>Alerts</span>
          </button>
        </div>
      </div>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="text-center py-4 text-xs relative" style={{ color: '#9CA3AF', zIndex: 1 }}>
        Powered by{' '}
        <a
          href="https://contentpro.co.tz"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold hover:underline transition-colors"
          style={{ color: '#6B7280' }}
          onMouseOver={(e) => (e.currentTarget.style.color = '#007CB3')}
          onMouseOut={(e) => (e.currentTarget.style.color = '#6B7280')}
        >
          Contentpro
        </a>
        <span className="mx-2 opacity-30">·</span>
        <span>v2.0</span>
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