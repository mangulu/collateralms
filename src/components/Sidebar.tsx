'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from './ui/AppLogo';
import { LayoutDashboard, FolderOpen, Settings, Users, ChevronLeft, ChevronRight, LogOut, ClipboardList, BarChart2, GitBranch, ScrollText, Download, Bell, ShieldCheck, ShieldAlert, Activity, Zap, Map, Scale, BookOpen, UserCheck, Inbox, Files, ScanSearch, PieChart, Unlock, Upload, CalendarClock, SendHorizonal, Radio, LayoutGrid, GitMerge, TrendingUp, Target, AlarmClock, DatabaseZap, LineChart, Sliders, KeyRound } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import Icon from '@/components/ui/AppIcon';


interface SidebarProps {
  collapsed: boolean;
  onToggle: () => void;
  currentPath?: string;
}

// Each nav item can optionally require a permission key
const navGroups = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Executive Dashboard',
        icon: TrendingUp,
        href: '/executive-dashboard',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
      {
        label: 'Dashboard',
        icon: LayoutDashboard,
        href: '/collateral-dashboard',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
      {
        label: 'Portfolio Monitoring',
        icon: Activity,
        href: '/portfolio-monitoring',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
      {
        label: 'Cohort Analytics',
        icon: LineChart,
        href: '/cohort-analytics',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
    ],
  },
  {
    label: 'Collateral',
    items: [
      {
        label: 'Collateral Registry',
        icon: FolderOpen,
        href: '/collateral-management',
        badge: '3',
        permission: PERMISSIONS.COLLATERAL_VIEW,
      },
      {
        label: 'Loan–Collateral Map',
        icon: GitMerge,
        href: '/collateral-loan-visualization',
        badge: null,
        permission: PERMISSIONS.COLLATERAL_VIEW,
      },
      {
        label: 'Approval Workflow',
        icon: GitBranch,
        href: '/perfection-workflow',
        badge: null,
        permission: PERMISSIONS.PERFECTION_VIEW,
      },
      {
        label: 'Collateral Documents',
        icon: Files,
        href: '/collateral-documents',
        badge: null,
        permission: PERMISSIONS.COLLATERAL_VIEW,
      },
      {
        label: 'Batch Release',
        icon: Unlock,
        href: '/batch-release',
        badge: null,
        permission: PERMISSIONS.COLLATERAL_EDIT,
      },
      {
        label: 'Bulk Upload',
        icon: Upload,
        href: '/bulk-upload',
        badge: null,
        permission: PERMISSIONS.COLLATERAL_EDIT,
      },
      {
        label: 'Scheduled Jobs',
        icon: CalendarClock,
        href: '/scheduled-jobs',
        badge: null,
        permission: PERMISSIONS.COLLATERAL_EDIT,
      },
    ],
  },
  {
    label: 'Intelligence',
    items: [
      {
        label: 'AI Fraud Prevention',
        icon: ShieldAlert,
        href: '/fraud-prevention',
        badge: '3',
        badgeVariant: 'danger' as const,
        permission: PERMISSIONS.COMPLIANCE_VIEW,
      },
      {
        label: 'AI Risk Assessment',
        icon: ScanSearch,
        href: '/risk-assessment',
        badge: null,
        permission: PERMISSIONS.COMPLIANCE_VIEW,
      },
      {
        label: 'Deadline Predictions',
        icon: Target,
        href: '/deadline-predictions',
        badge: null,
        permission: PERMISSIONS.COMPLIANCE_VIEW,
      },
      {
        label: 'Fast Track',
        icon: Zap,
        href: '/fast-track',
        badge: null,
        permission: PERMISSIONS.COLLATERAL_VIEW,
      },
      {
        label: 'Geomapping',
        icon: Map,
        href: '/geomapping',
        badge: null,
        permission: PERMISSIONS.COLLATERAL_VIEW,
      },
    ],
  },
  {
    label: 'Alerts & Notifications',
    items: [
      {
        label: 'Notifications Hub',
        icon: Bell,
        href: '/notifications-hub',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
      {
        label: 'Alerts Inbox',
        icon: Inbox,
        href: '/alerts-inbox',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
      {
        label: 'Deadline Reminders',
        icon: AlarmClock,
        href: '/deadline-reminders',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
      {
        label: 'Alert Delivery Log',
        icon: SendHorizonal,
        href: '/alerts-delivery',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
    ],
  },
  {
    label: 'Audits & Compliance',
    items: [
      {
        label: 'Live Activity Stream',
        icon: Radio,
        href: '/live-activity',
        badge: null,
        permission: PERMISSIONS.AUDIT_LOG_VIEW,
      },
      {
        label: 'Audit Center',
        icon: DatabaseZap,
        href: '/audit-center',
        badge: null,
        permission: PERMISSIONS.AUDIT_LOG_VIEW,
      },
      {
        label: 'Security & Compliance Trail',
        icon: ClipboardList,
        href: '/audit-trail',
        badge: null,
        permission: PERMISSIONS.AUDIT_LOG_VIEW,
      },
      {
        label: 'Change History',
        icon: ScrollText,
        href: '/audit-log',
        badge: null,
        permission: PERMISSIONS.AUDIT_LOG_VIEW,
      },
      {
        label: 'Activity Log',
        icon: UserCheck,
        href: '/activity-log',
        badge: null,
        permission: PERMISSIONS.AUDIT_LOG_VIEW,
      },
      {
        label: 'Audit Report',
        icon: BookOpen,
        href: '/audit-report',
        badge: null,
        permission: PERMISSIONS.AUDIT_LOG_VIEW,
      },
      {
        label: 'Compliance Rules',
        icon: Scale,
        href: '/compliance-rules',
        badge: null,
        permission: PERMISSIONS.COMPLIANCE_VIEW,
      },
      {
        label: 'Compliance Audit',
        icon: ShieldCheck,
        href: '/compliance-audit',
        badge: null,
        permission: PERMISSIONS.COMPLIANCE_VIEW,
      },
    ],
  },
  {
    label: 'Reports',
    items: [
      {
        label: 'Reports',
        icon: BarChart2,
        href: '/reports',
        badge: null,
        permission: PERMISSIONS.REPORTS_VIEW,
      },
      {
        label: 'Regulatory Reports',
        icon: LayoutGrid,
        href: '/reports-dashboard',
        badge: null,
        permission: PERMISSIONS.REPORTS_VIEW,
      },
      {
        label: 'Utilization Report',
        icon: PieChart,
        href: '/reports?tab=utilization',
        badge: null,
        permission: PERMISSIONS.REPORTS_VIEW,
      },
      {
        label: 'Custom Reports',
        icon: Sliders,
        href: '/custom-reports',
        badge: null,
        permission: PERMISSIONS.REPORTS_VIEW,
      },
      {
        label: 'Export',
        icon: Download,
        href: '/export',
        badge: null,
        permission: PERMISSIONS.REPORTS_VIEW,
      },
    ],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Admin Console',
        icon: ShieldCheck,
        href: '/admin',
        badge: null,
        permission: PERMISSIONS.USER_MANAGEMENT_VIEW,
      },
      {
        label: 'User Management',
        icon: Users,
        href: '/user-management',
        badge: null,
        permission: PERMISSIONS.USER_MANAGEMENT_VIEW,
      },
      {
        label: 'Officer Permissions',
        icon: KeyRound,
        href: '/officer-permissions',
        badge: null,
        permission: PERMISSIONS.USER_MANAGEMENT_MANAGE,
      },
      {
        label: 'System Settings',
        icon: Settings,
        href: '/settings',
        badge: null,
        permission: PERMISSIONS.SETTINGS_VIEW,
      },
      {
        label: 'User Guide',
        icon: BookOpen,
        href: '/user-guide',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
    ],
  },
];

const badgeVariantClasses: Record<string, string> = {
  default: 'bg-blue-500/20 text-blue-300',
  danger: 'bg-red-500/20 text-red-300',
  warning: 'bg-amber-500/20 text-amber-300',
};

export default function Sidebar({ collapsed, onToggle, currentPath }: SidebarProps) {
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);
  const { userProfile, signOut } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();

  const initials = userProfile?.initials ||
    (userProfile?.full_name
      ? userProfile.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
      : 'U');

  const displayName = userProfile?.full_name || userProfile?.email || 'User';
  const displayRole = userProfile?.role
    ? userProfile.role.replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
    : '';

  return (
    <aside
      className="relative flex flex-col h-full shrink-0 sidebar-transition z-20"
      style={{ width: collapsed ? '64px' : '240px', backgroundColor: '#DBEAFE', borderRight: '1px solid rgba(0,0,0,0.08)' }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-3 shrink-0 overflow-hidden" style={{ borderBottom: '1px solid rgba(0,0,0,0.08)' }}>
        <div className="flex items-center gap-2 min-w-0">
          <AppLogo size={32} />
          {!collapsed && (
            <div className="min-w-0 fade-in">
              <p className="text-sm font-semibold truncate leading-tight" style={{ color: '#1E40AF' }}>
                CollateralMS
              </p>
              <p className="text-xs truncate leading-tight" style={{ color: '#3B82F6' }}>
                EXIM Bank Tanzania
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        {navGroups.map((group) => {
          // Filter items by permission (skip filtering while loading to avoid flicker)
          const visibleItems = permsLoading
            ? group.items
            : group.items.filter((item) => !item.permission || hasPermission(item.permission));

          if (visibleItems.length === 0) return null;

          return (
            <div key={`group-${group.label}`} className="mb-4">
              {!collapsed && (
                <p className="text-xs font-600 tracking-wider uppercase px-2 mb-1" style={{ color: '#1D4ED8' }}>
                  {group.label}
                </p>
              )}
              {collapsed && <div className="mx-1 mb-2" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }} />}
              {visibleItems.map((item) => {
                const Icon = item.icon;
                const isActive = currentPath === item.href;
                const isHovered = hoveredItem === item.label;
                const badgeClass =
                  badgeVariantClasses[item.badgeVariant ?? 'default'];

                return (
                  <div key={`nav-${item.label}`} className="relative">
                    <Link
                      href={item.href}
                      onMouseEnter={() => setHoveredItem(item.label)}
                      onMouseLeave={() => setHoveredItem(null)}
                      className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-150 group mb-0.5`}
                      style={
                        isActive
                          ? { backgroundColor: '#2563EB', color: '#FFFFFF' }
                          : { color: '#1E3A8A' }
                      }
                      onMouseOver={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)';
                          (e.currentTarget as HTMLElement).style.color = '#1E3A8A';
                        }
                      }}
                      onMouseOut={(e) => {
                        if (!isActive) {
                          (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                          (e.currentTarget as HTMLElement).style.color = '#1E3A8A';
                        }
                      }}
                    >
                      <Icon
                        size={18}
                        className="shrink-0"
                      />
                      {!collapsed && (
                        <span className="flex-1 truncate">{item.label}</span>
                      )}
                      {!collapsed && item.badge && (
                        <span
                          className={`text-xs font-600 px-1.5 py-0.5 rounded-full ${badgeClass}`}
                        >
                          {item.badge}
                        </span>
                      )}
                      {collapsed && item.badge && (
                        <span
                          className={`absolute top-1 right-1 text-xs font-600 px-1 py-0 rounded-full text-[10px] ${badgeClass}`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </Link>
                    {/* Collapsed tooltip */}
                    {collapsed && isHovered && (
                      <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 z-50 pointer-events-none">
                        <div className="text-white text-xs px-2 py-1 rounded shadow-dropdown whitespace-nowrap" style={{ backgroundColor: '#1E293B' }}>
                          {item.label}
                          {item.badge && (
                            <span className="ml-1 opacity-75">({item.badge})</span>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* User Profile */}
      <div className="p-2 shrink-0" style={{ borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2 py-2 rounded-md cursor-pointer transition-colors group"
            onClick={() => signOut?.()}
            title="Sign out"
            onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'rgba(37,99,235,0.12)'; }}
            onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'; }}
          >
            <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: '#2563EB' }}>
              <span className="text-white text-xs font-600">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-500 truncate" style={{ color: '#1E3A8A' }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: '#3B82F6' }}>
                {displayRole}
              </p>
            </div>
            <LogOut size={15} className="shrink-0 transition-colors group-hover:text-red-500" style={{ color: '#1D4ED8' }} />
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center cursor-pointer transition-colors"
              style={{ backgroundColor: '#2563EB' }}
              onClick={() => signOut?.()}
              title="Sign out"
            >
              <span className="text-white text-xs font-600">{initials}</span>
            </div>
          </div>
        )}
      </div>

      {/* Collapse Toggle */}
      <button
        onClick={onToggle}
        className="absolute -right-3 top-20 w-6 h-6 rounded-full flex items-center justify-center shadow-card transition-colors z-30"
        style={{ backgroundColor: '#BFDBFE', border: '1px solid rgba(37,99,235,0.3)' }}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight size={12} style={{ color: '#1E40AF' }} />
        ) : (
          <ChevronLeft size={12} style={{ color: '#1E40AF' }} />
        )}
      </button>
    </aside>
  );
}