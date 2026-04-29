'use client';
import React, { useState } from 'react';
import Link from 'next/link';
import AppLogo from './ui/AppLogo';
import { LayoutDashboard, FolderOpen, Settings, Users, ChevronLeft, ChevronRight, LogOut, ClipboardList, BarChart2, GitBranch, ScrollText, Download, Bell, ShieldCheck, ShieldAlert, Activity, Zap, Map, Scale, BookOpen, UserCheck, Inbox, Files, ScanSearch, PieChart, Unlock, Upload, CalendarClock, SendHorizonal, Radio } from 'lucide-react';
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
      {
        label: 'Compliance Rules',
        icon: Scale,
        href: '/compliance-rules',
        badge: null,
        permission: PERMISSIONS.COMPLIANCE_VIEW,
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
        label: 'Alert Delivery Log',
        icon: SendHorizonal,
        href: '/alerts-delivery',
        badge: null,
        permission: PERMISSIONS.DASHBOARD_VIEW,
      },
    ],
  },
  {
    label: 'Audit & Reports',
    items: [
      {
        label: 'Live Activity Stream',
        icon: Radio,
        href: '/live-activity',
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
        label: 'Reports',
        icon: BarChart2,
        href: '/reports',
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
        label: 'System Settings',
        icon: Settings,
        href: '/settings',
        badge: null,
        permission: PERMISSIONS.SETTINGS_VIEW,
      },
    ],
  },
];

const badgeVariantClasses: Record<string, string> = {
  default: 'bg-primary/10 text-primary',
  danger: 'bg-red-100 text-red-700',
  warning: 'bg-amber-100 text-amber-700',
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
      className="relative flex flex-col bg-white border-r border-border h-full shrink-0 sidebar-transition z-20"
      style={{ width: collapsed ? '64px' : '240px' }}
    >
      {/* Logo */}
      <div className="flex items-center h-16 px-3 border-b border-border shrink-0 overflow-hidden">
        <div className="flex items-center gap-2 min-w-0">
          <AppLogo size={32} />
          {!collapsed && (
            <div className="min-w-0 fade-in">
              <p className="text-sm font-semibold text-primary truncate leading-tight">
                CollateralMS
              </p>
              <p className="text-xs text-muted-foreground truncate leading-tight">
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
                <p className="text-xs font-600 tracking-wider text-muted-foreground uppercase px-2 mb-1">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="border-t border-border mx-1 mb-2" />}
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
                      className={`flex items-center gap-2.5 px-2 py-2 rounded-md text-sm font-medium transition-all duration-150 group mb-0.5 ${
                        isActive
                          ? 'bg-primary/10 text-primary' :'text-foreground/70 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <Icon
                        size={18}
                        className={`shrink-0 ${isActive ? 'text-primary' : ''}`}
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
                        <div className="bg-foreground text-white text-xs px-2 py-1 rounded shadow-dropdown whitespace-nowrap">
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
      <div className="border-t border-border p-2 shrink-0">
        {!collapsed ? (
          <div className="flex items-center gap-2 px-2 py-2 rounded-md hover:bg-muted cursor-pointer transition-colors group"
            onClick={() => signOut?.()}
            title="Sign out"
          >
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-600">{initials}</span>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-500 text-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-muted-foreground truncate">
                {displayRole}
              </p>
            </div>
            <LogOut size={15} className="text-muted-foreground shrink-0 group-hover:text-red-500 transition-colors" />
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <div
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center cursor-pointer hover:bg-primary/80 transition-colors"
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
        className="absolute -right-3 top-20 w-6 h-6 bg-white border border-border rounded-full flex items-center justify-center shadow-card hover:bg-muted transition-colors z-30"
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {collapsed ? (
          <ChevronRight size={12} className="text-muted-foreground" />
        ) : (
          <ChevronLeft size={12} className="text-muted-foreground" />
        )}
      </button>
    </aside>
  );
}