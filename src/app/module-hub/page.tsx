'use client';
import React, { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import { useAuth } from '@/contexts/AuthContext';
import AppLogo from '@/components/ui/AppLogo';
import { userTaskService } from '@/lib/supabase/userTaskService';
import CollateralLifecycleMap from './components/CollateralLifecycleMap';
import { FolderOpen, Brain, Bell, BarChart2, ShieldCheck, Settings, LogOut, ChevronRight, Layers, Archive, Users, CheckSquare, BookOpen, HelpCircle, AlertTriangle, Clock, ArrowRight, Calendar, Activity, Zap, Search, ChevronDown, FlaskConical } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ModuleCard {
  id: string;
  title: string;
  description: string;
  icon: React.ElementType;
  href: string;
  iconBg: string;
  category:
    | 'collateral' |'workflow' |'archive' |'intelligence' |'alerts' |'reports' |'audit' |'admin';
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

// ─── Module definitions ───────────────────────────────────────────────────────

const modules: ModuleCard[] = [
  {
    id: 'collaterals',
    title: 'Collaterals',
    description: 'Manage collateral registry, documents, batch operations, and scheduled jobs.',
    icon: FolderOpen,
    href: '/collateral-management',
    iconBg: 'var(--izou-secondary)',
    category: 'collateral',
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
  {
    id: 'obligors',
    title: 'Obligors',
    description:
      'Manage obligor profiles, credit risk scores, exposure metrics, and approval trends.',
    icon: Users,
    href: '/obligors',
    iconBg: 'var(--izou-secondary-mid)',
    category: 'collateral',
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
  {
    id: 'approvals',
    title: 'Workflows',
    description:
      'Centralised approval inbox for perfection, document, release, and archive request workflows. Design templates, configure auto-triggers, manage escalations, and monitor workflow KPIs.',
    icon: CheckSquare,
    href: '/approval-inbox',
    iconBg: 'var(--izou-warning)',
    category: 'workflow',
    requiredPermission: PERMISSIONS.PERFECTION_VIEW,
  },
  {
    id: 'intelligence',
    title: 'Analytics & Intelligence',
    description:
      'AI-powered risk assessment, fraud prevention, deadline predictions, and analytics.',
    icon: Brain,
    href: '/executive-dashboard',
    iconBg: 'var(--izou-highlight)',
    category: 'intelligence',
    requiredPermission: PERMISSIONS.COMPLIANCE_VIEW,
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    description: 'Monitor deadline reminders, notification delivery logs, and alerts inbox.',
    icon: Bell,
    href: '/notifications-hub',
    iconBg: 'var(--izou-primary)',
    category: 'alerts',
    requiredPermission: PERMISSIONS.DASHBOARD_VIEW,
  },
  {
    id: 'reports',
    title: 'Reports',
    description:
      'Reports Hub with regulatory and utilization views, custom reports, and unified export.',
    icon: BarChart2,
    href: '/reports',
    iconBg: 'var(--izou-success)',
    category: 'reports',
    requiredPermission: PERMISSIONS.REPORTS_VIEW,
  },
  {
    id: 'audit',
    title: 'Audit & Compliance',
    description:
      'Full audit trails, archive audit log, compliance rules, live activity streams, and audit reports.',
    icon: ShieldCheck,
    href: '/audit-trail',
    iconBg: 'var(--izou-neutral)',
    category: 'audit',
    requiredPermission: PERMISSIONS.AUDIT_LOG_VIEW,
  },
  {
    id: 'administration',
    title: 'Administration',
    description:
      'User management, officer permissions, system settings, alert thresholds, and client bank accounts.',
    icon: Settings,
    href: '/user-management',
    iconBg: 'var(--izou-danger)',
    category: 'admin',
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
    iconBg: 'var(--izou-success)',
    category: 'archive',
    requiredPermission: PERMISSIONS.COLLATERAL_VIEW,
  },
];

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
  const [statsLoading, setStatsLoading] = useState(true);
  const [taskCount, setTaskCount] = useState<number | null>(null);
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

  // ─── Compute visible modules ──────────────────────────────────────────────
  const visibleModules = useMemo(() => {
    if (loading) return modules;
    return modules.filter((m) => {
      if (m.adminOnly && !isSystemAdmin) return false;
      if (m.requiredPermission && !isSystemAdmin && !hasPermission(m.requiredPermission))
        return false;
      return true;
    });
  }, [loading, isSystemAdmin, hasPermission]);

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
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement;
        if (searchInput) searchInput.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    async function fetchStats() {
      try {
        const supabase = createClient();
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

        const escalatedCount = escalatedRes.data?.length ?? 0;
        const highPriorityCount = tasks.filter((t) => t.priority === 'high').length;

        setSubStats({
          perfectedCount,
          collateralOverdueCount: overdueCount,
          escalatedCount,
          dueTodayCount: dueTodayTasks.length,
          highPriorityCount,
        });

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

  // Note: `color` stays a literal hex (not a CSS var) because it's alpha-suffixed
  // below (`${cfg.color}25`) to derive a translucent border — var(--x)25 isn't valid CSS.
  const priorityTypeConfig = {
    overdue: {
      color: '#B91C1C',
      bg: 'var(--izou-danger-light)',
      label: 'OVERDUE',
      icon: AlertTriangle,
    },
    escalated: { color: '#B45309', bg: 'var(--izou-warning-light)', label: 'ESCALATED', icon: Zap },
    'due-today': { color: '#12213C', bg: 'var(--izou-secondary-light)', label: 'DUE TODAY', icon: Clock },
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
      style={{ background: 'linear-gradient(145deg, #F8F7F5 0%, #F0EFEC 100%)' }}
    >
      {/* ── Geometric mesh / grid background pattern ─────────────────────── */}
      <div
        className="pointer-events-none select-none fixed inset-0"
        aria-hidden="true"
        style={{ zIndex: 0 }}
      >
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute', inset: 0 }}>
          <defs>
            <pattern id="mesh-grid" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <path d="M 48 0 L 0 0 0 48" fill="none" stroke="var(--izou-secondary)" strokeWidth="0.5" opacity="0.12" />
            </pattern>
            <pattern id="mesh-dots" x="0" y="0" width="48" height="48" patternUnits="userSpaceOnUse">
              <circle cx="0" cy="0" r="1.2" fill="var(--izou-secondary)" opacity="0.1" />
              <circle cx="48" cy="0" r="1.2" fill="var(--izou-secondary)" opacity="0.1" />
              <circle cx="0" cy="48" r="1.2" fill="var(--izou-secondary)" opacity="0.1" />
              <circle cx="48" cy="48" r="1.2" fill="var(--izou-secondary)" opacity="0.1" />
              <circle cx="24" cy="24" r="1" fill="var(--izou-primary)" opacity="0.08" />
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
            width: 560, height: 560, borderRadius: '50%',
            border: '2px solid rgba(18,33,60,0.08)',
            boxShadow: '0 0 0 12px rgba(18,33,60,0.03), 0 0 80px 20px rgba(236,30,39,0.04)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(18,33,60,0.01)',
          }}
        >
          <img
            src="/assets/app_logo_shield.svg"
            alt=""
            style={{
              width: '340px', height: '340px', objectFit: 'contain', opacity: 0.05,
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
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--izou-text)' }}>CollateralMS</p>
            <p className="text-xs leading-tight" style={{ color: 'var(--izou-muted)' }}>Module Hub</p>
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
              style={{ backgroundColor: 'rgba(0,0,0,0.04)', border: '1px solid rgba(0,0,0,0.06)', color: 'var(--izou-text)' }}
              onFocus={(e) => { e.currentTarget.style.backgroundColor = '#fff'; e.currentTarget.style.borderColor = 'var(--izou-primary)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--izou-primary-tint)'; }}
              onBlur={(e) => { e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.04)'; e.currentTarget.style.borderColor = 'rgba(0,0,0,0.06)'; e.currentTarget.style.boxShadow = 'none'; }}
            />
            <Search size={16} className="absolute left-3 top-2.5" style={{ color: 'var(--izou-muted)' }} />
            <kbd className="absolute right-3 top-2.5 text-xs px-1.5 py-0.5 rounded" style={{ color: 'var(--izou-muted)', backgroundColor: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.08)' }}>⌘K</kbd>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Notification Bell */}
          <button
            className="relative p-2 rounded-lg transition-colors"
            style={{ color: 'var(--izou-muted)' }}
            onMouseOver={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0,0,0,0.06)')}
            onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            onClick={() => router.push('/notifications')}
            aria-label="Notifications"
          >
            <Bell size={18} />
            {taskCount !== null && taskCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 flex items-center justify-center rounded-full text-white text-[10px] font-bold leading-none min-w-[18px] h-[18px] px-1" style={{ backgroundColor: 'var(--izou-danger)' }}>
                {taskCount > 9 ? '9+' : taskCount}
              </span>
            )}
          </button>

          <button
            onClick={() => router.push('/onboarding-guide')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ color: 'var(--izou-muted)', border: '1px solid rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.04)' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.08)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
          >
            <HelpCircle size={14} />
            <span className="hidden sm:inline">Onboarding</span>
          </button>

          <button
            onClick={() => router.push('/guides/testing')}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
            style={{ color: 'var(--izou-muted)', border: '1px solid rgba(0,0,0,0.12)', backgroundColor: 'rgba(0,0,0,0.04)' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.08)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.04)'; }}
          >
            <FlaskConical size={14} />
            <span className="hidden sm:inline">Testing</span>
          </button>

          {/* Profile */}
          <div className="relative group">
            <button className="flex items-center gap-2.5 pl-2 border-l border-r border-transparent hover:border-gray-200 transition-colors" style={{ borderColor: 'rgba(0,0,0,0.1)' }}>
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ background: 'var(--izou-primary)' }}>
                <span className="text-white text-xs font-bold">{initials}</span>
              </div>
              <div className="hidden sm:block text-left">
                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--izou-text)' }}>{displayName}</p>
                <p className="text-xs leading-tight" style={{ color: 'var(--izou-muted)' }}>{displayRole}</p>
              </div>
              <ChevronDown size={14} className="hidden sm:block" style={{ color: 'var(--izou-muted)' }} />
            </button>
          </div>

          <button
            onClick={() => signOut?.()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-colors ml-1"
            style={{ color: 'var(--izou-muted)' }}
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-danger-light)'; (e.currentTarget as HTMLElement).style.color = 'var(--izou-danger)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--izou-muted)'; }}
          >
            <LogOut size={14} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      {/* ── Body ──────────────────────────────────────────────────────────────── */}
      <div className="flex flex-1 relative" style={{ zIndex: 1 }}>

        <main className="flex-1 flex flex-col min-w-0 overflow-x-hidden">

          {/* ── Hero / Welcome Section ─────────────────────────────────────── */}
          <div
            className="px-6 pt-8 pb-6 relative"
            style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}
          >
            <div className="max-w-[1400px] mx-auto">
              {/* Welcome row */}
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
                <div>
                  <h1 className="text-2xl font-bold leading-tight" style={{ color: 'var(--izou-primary)' }}>
                    Good {greeting || '—'}, {firstName}
                  </h1>
                  <p className="text-sm mt-0.5 flex items-center gap-1.5" style={{ color: 'var(--izou-secondary)' }}>
                    <Calendar size={13} />
                    {todayStr || '—'}
                  </p>
                </div>
                <button
                  onClick={() => router.push('/workflows/tasks')}
                  className="relative flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all shrink-0"
                  style={{ backgroundColor: 'var(--izou-primary)', color: '#fff', boxShadow: '0 4px 14px var(--izou-primary-shadow)' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                >
                  <Activity size={14} />
                  My Tasks
                  {taskCount !== null && taskCount > 0 && (
                    <span className="inline-flex items-center justify-center rounded-full text-xs font-bold leading-none" style={{ minWidth: '18px', height: '18px', padding: '0 5px', backgroundColor: 'var(--izou-danger)', color: '#fff', fontSize: '10px' }}>
                      {taskCount > 99 ? '99+' : taskCount}
                    </span>
                  )}
                  <ChevronRight size={14} />
                </button>
              </div>

              {/* Quick Stats Row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-white rounded-xl p-4 transition-all hover:shadow-md" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>Total Collateral</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--izou-text)' }}>{summaryStats.totalCollateral}</p>
                      {!statsLoading && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--izou-muted)' }}>
                          <span style={{ color: 'var(--izou-success)' }}>{subStats.perfectedCount} Perfected</span>
                          {' · '}
                          <span style={{ color: subStats.collateralOverdueCount > 0 ? 'var(--izou-danger)' : 'var(--izou-muted)' }}>{subStats.collateralOverdueCount} Overdue</span>
                        </p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--izou-secondary-light)' }}>
                      <FolderOpen size={16} style={{ color: 'var(--izou-secondary)' }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 transition-all hover:shadow-md" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>Active Workflows</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--izou-text)' }}>{summaryStats.activeWorkflows}</p>
                      {!statsLoading && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--izou-muted)' }}>
                          <span style={{ color: subStats.escalatedCount > 0 ? 'var(--izou-warning)' : 'var(--izou-muted)' }}>{subStats.escalatedCount} Escalated</span>
                        </p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--izou-warning-light)' }}>
                      <Activity size={16} style={{ color: 'var(--izou-warning)' }} />
                    </div>
                  </div>
                </div>
                <div className="bg-white rounded-xl p-4 transition-all hover:shadow-md" style={{ border: '1px solid rgba(0,0,0,0.05)' }}>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>Pending Actions</p>
                      <p className="text-2xl font-bold" style={{ color: 'var(--izou-text)' }}>{summaryStats.pendingActions}</p>
                      {!statsLoading && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--izou-muted)' }}>
                          <span style={{ color: subStats.dueTodayCount > 0 ? 'var(--izou-secondary)' : 'var(--izou-muted)' }}>{subStats.dueTodayCount} Due Today</span>
                        </p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--izou-highlight-light)' }}>
                      <CheckSquare size={16} style={{ color: 'var(--izou-highlight)' }} />
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
                      <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>Overdue</p>
                      <p className="text-2xl font-bold" style={{ color: summaryStats.overdueItems > 0 ? 'var(--izou-danger)' : 'var(--izou-text)' }}>{summaryStats.overdueItems}</p>
                      {!statsLoading && (
                        <p className="text-[11px] mt-0.5" style={{ color: 'var(--izou-muted)' }}>
                          <span style={{ color: subStats.highPriorityCount > 0 ? 'var(--izou-danger)' : 'var(--izou-muted)' }}>{subStats.highPriorityCount} High Priority</span>
                        </p>
                      )}
                    </div>
                    <div className="p-2 rounded-lg" style={{ backgroundColor: 'var(--izou-danger-light)' }}>
                      <AlertTriangle size={16} style={{ color: 'var(--izou-danger)' }} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* ── Priority Tray ──────────────────────────────────────────────── */}
          {!statsLoading && priorityItems.length > 0 && !showDismissed && (
            <div
              className="px-6 py-4"
              style={{ background: 'linear-gradient(135deg, var(--izou-danger-light) 0%, var(--izou-card) 100%)', borderBottom: '2px solid rgba(185,28,28,0.15)' }}
            >
              <div className="max-w-[1400px] mx-auto">
                <div className="flex items-center justify-between mb-2.5">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-full bg-red-100 animate-pulse">
                      <AlertTriangle size={14} style={{ color: 'var(--izou-danger)' }} />
                    </div>
                    <span className="text-sm font-semibold" style={{ color: 'var(--izou-danger)' }}>
                      {priorityItems.length} {priorityItems.length === 1 ? 'item' : 'items'} need your attention
                    </span>
                  </div>
                  <button onClick={handleDismissAll} className="text-xs hover:underline transition-colors" style={{ color: 'var(--izou-muted)' }}>
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
                        style={{ backgroundColor: '#fff', color: cfg.color, border: `1px solid ${cfg.color}25`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}
                        onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = cfg.bg; (e.currentTarget as HTMLElement).style.transform = 'scale(1.02)'; (e.currentTarget as HTMLElement).style.borderColor = cfg.color; }}
                        onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = '#fff'; (e.currentTarget as HTMLElement).style.transform = 'none'; (e.currentTarget as HTMLElement).style.borderColor = `${cfg.color}25`; }}
                      >
                        <ItemIcon size={12} />
                        <span className="font-bold">{cfg.label}</span>
                        <span className="opacity-30">·</span>
                        <span className="max-w-[120px] truncate">{item.detail}</span>
                        <ArrowRight size={10} className="opacity-0 group-hover:opacity-100 transition-opacity" />
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDismissPriority(item.id); }}
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
                      style={{ color: 'var(--izou-muted)', backgroundColor: 'rgba(0,0,0,0.03)', border: '1px solid rgba(0,0,0,0.06)' }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.06)'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(0,0,0,0.03)'; }}
                    >
                      +{priorityItems.length - 4} more
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ── Collateral Lifecycle Map ──────────────────────────────────── */}
          <div className="flex-1 px-6 py-8">
            <div className="max-w-[1400px] mx-auto">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {Array.from({ length: 3 }).map((_, i) => <ModuleSkeleton key={i} />)}
                </div>
              ) : (
                <CollateralLifecycleMap visibleModules={visibleModules} searchQuery={searchQuery} />
              )}

              {/* Onboarding Guide Section */}
              <div
                className="mt-8 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 transition-all hover:shadow-lg"
                style={{ background: 'linear-gradient(135deg, var(--izou-primary-light) 0%, var(--izou-card) 100%)', border: '1px solid var(--izou-primary-tint)', boxShadow: '0 2px 8px var(--izou-primary-tint)' }}
              >
                <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: 'var(--izou-primary)', boxShadow: '0 4px 12px var(--izou-primary-shadow)' }}>
                  <BookOpen size={18} color="#fff" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold mb-0.5" style={{ color: 'var(--izou-primary-dark)' }}>New to CollateralMS? Start with the Onboarding Guide</h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--izou-muted)' }}>
                    Step-by-step walkthroughs for all modules — from registering collateral to running compliance audits.
                  </p>
                </div>
                <button
                  onClick={() => router.push('/onboarding-guide')}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold shrink-0 transition-all"
                  style={{ backgroundColor: 'var(--izou-primary)', color: '#fff', boxShadow: '0 4px 12px var(--izou-primary-shadow)' }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary-dark)'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'var(--izou-primary)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}
                >
                  <BookOpen size={13} />
                  Open Guide
                  <ChevronRight size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* ── Footer ──────────────────────────────────────────────────────── */}
          <footer className="text-center py-4 text-xs" style={{ color: 'var(--izou-muted)' }}>
            Powered by{' '}
            <a
              href="https://contentpro.co.tz"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold hover:underline transition-colors"
              style={{ color: 'var(--izou-muted)' }}
              onMouseOver={(e) => (e.currentTarget.style.color = 'var(--izou-primary)')}
              onMouseOut={(e) => (e.currentTarget.style.color = 'var(--izou-muted)')}
            >
              Contentpro
            </a>
            <span className="mx-2 opacity-30">·</span>
            <span>v2.0</span>
          </footer>
        </main>
      </div>

      {/* ── Mobile Bottom Navigation ──────────────────────────────────────── */}
      <div className="sm:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 px-4 py-3 z-50">
        <div className="flex justify-around">
          <button className="flex flex-col items-center gap-1 text-xs" style={{ color: 'var(--izou-primary)' }} onClick={() => router.push('/module-hub')}>
            <Layers size={20} />
            <span>Modules</span>
          </button>
          <button
            className="flex flex-col items-center gap-1 text-xs"
            style={{ color: 'var(--izou-muted)' }}
            onClick={() => { const searchInput = document.querySelector('input[type="search"]') as HTMLInputElement; if (searchInput) searchInput.focus(); }}
          >
            <Search size={20} />
            <span>Search</span>
          </button>
          <button className="flex flex-col items-center gap-1 text-xs relative" style={{ color: 'var(--izou-muted)' }} onClick={() => router.push('/notifications')}>
            <Bell size={20} />
            {taskCount !== null && taskCount > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-white text-[10px] flex items-center justify-center" style={{ backgroundColor: 'var(--izou-danger)' }}>
                {taskCount > 9 ? '9+' : taskCount}
              </span>
            )}
            <span>Alerts</span>
          </button>
        </div>
      </div>
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