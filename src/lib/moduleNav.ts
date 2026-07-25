/**
 * Module navigation definitions.
 * Each module maps to a set of sidebar nav groups shown when inside that module.
 */

import { PERMISSIONS } from '@/lib/rbac';
import { FolderOpen, GitBranch, Files, Unlock, Upload, CalendarClock, GitMerge, Brain, ShieldAlert, ScanSearch, Target, Zap, Map, LineChart, TrendingUp, Activity, LayoutDashboard, Bell, Inbox, AlarmClock, SendHorizonal, SlidersHorizontal, BarChart2, Download, DatabaseZap, ClipboardList, ScrollText, BookOpen, ShieldCheck, Radio, Scale, Users, KeyRound, Settings, Landmark, Archive, Building2, MapPin, Library, ClipboardCheck, Eye, FileStack, MailCheck, BadgeCheck, Flame, FolderArchive,  } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export interface ModuleNavItem {
  label: string;
  icon: LucideIcon;
  href: string;
  badge?: string | null;
  badgeVariant?: 'default' | 'danger' | 'warning';
  permission?: string;
  children?: ModuleNavItem[];
}

export interface ModuleNavGroup {
  label: string;
  items: ModuleNavItem[];
}

export interface ModuleDefinition {
  id: string;
  label: string;
  groups: ModuleNavGroup[];
}

export const MODULE_DEFINITIONS: ModuleDefinition[] = [
  {
    id: 'collaterals',
    label: 'Collaterals',
    groups: [
      {
        label: 'Overview',
        items: [
          { label: 'Dashboard', icon: LayoutDashboard, href: '/collateral-dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
          { label: 'Portfolio Monitoring', icon: Activity, href: '/portfolio-monitoring', permission: PERMISSIONS.DASHBOARD_VIEW },
        ],
      },
      {
        label: 'Registry',
        items: [
          { label: 'Collateral Registry', icon: FolderOpen, href: '/collateral-management', badge: '3', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Loan–Collateral Map', icon: GitMerge, href: '/collateral-loan-visualization', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Collateral Documents', icon: Files, href: '/collateral-documents', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
      {
        label: 'Operations',
        items: [
          { label: 'Batch Release', icon: Unlock, href: '/batch-release', permission: PERMISSIONS.COLLATERAL_EDIT },
          { label: 'Bulk Upload', icon: Upload, href: '/bulk-upload', permission: PERMISSIONS.COLLATERAL_EDIT },
          { label: 'Scheduled Jobs', icon: CalendarClock, href: '/scheduled-jobs', permission: PERMISSIONS.COLLATERAL_EDIT },
        ],
      },
    ],
  },
  {
    id: 'obligors',
    label: 'Obligors',
    groups: [
      {
        label: 'Obligor Management',
        items: [
          { label: 'Obligors', icon: Users, href: '/obligors', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
    ],
  },
  {
    id: 'approvals',
    label: 'Approvals',
    groups: [
      {
        label: 'Approval Workflows',
        items: [
          { label: 'Approval Inbox', icon: MailCheck, href: '/approval-inbox', permission: PERMISSIONS.PERFECTION_VIEW },
          { label: 'Perfection Approval', icon: GitBranch, href: '/perfection-workflow', permission: PERMISSIONS.PERFECTION_VIEW },
          { label: 'Document Approval', icon: BadgeCheck, href: '/document-approval', permission: PERMISSIONS.PERFECTION_VIEW },
          { label: 'Release Approval', icon: Unlock, href: '/release-approval', permission: PERMISSIONS.PERFECTION_VIEW },
        ],
      },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    groups: [
      {
        label: 'Analytics',
        items: [
          { label: 'Executive Dashboard', icon: TrendingUp, href: '/executive-dashboard', permission: PERMISSIONS.DASHBOARD_VIEW },
          { label: 'Cohort Analytics', icon: LineChart, href: '/cohort-analytics', permission: PERMISSIONS.DASHBOARD_VIEW },
          { label: 'Deadline Predictions', icon: Target, href: '/deadline-predictions', permission: PERMISSIONS.COMPLIANCE_VIEW },
        ],
      },
      {
        label: 'AI Tools',
        items: [
          { label: 'AI Fraud Prevention', icon: ShieldAlert, href: '/fraud-prevention', badge: '3', badgeVariant: 'danger', permission: PERMISSIONS.COMPLIANCE_VIEW },
          { label: 'AI Risk Assessment', icon: ScanSearch, href: '/risk-assessment', permission: PERMISSIONS.COMPLIANCE_VIEW },
          { label: 'Fast Track', icon: Zap, href: '/fast-track', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Geomapping', icon: Map, href: '/geomapping', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Portfolio Heatmap', icon: Flame, href: '/portfolio-heatmap', permission: PERMISSIONS.DASHBOARD_VIEW },
        ],
      },
    ],
  },
  {
    id: 'alerts',
    label: 'Alerts & Notifications',
    groups: [
      {
        label: 'Notifications',
        items: [
          { label: 'Notifications Hub', icon: Bell, href: '/notifications-hub', permission: PERMISSIONS.DASHBOARD_VIEW },
          { label: 'Alerts Inbox', icon: Inbox, href: '/alerts-inbox', permission: PERMISSIONS.DASHBOARD_VIEW },
          { label: 'Deadline Reminders', icon: AlarmClock, href: '/deadline-reminders', permission: PERMISSIONS.DASHBOARD_VIEW },
          { label: 'Alert Delivery Log', icon: SendHorizonal, href: '/alerts-delivery', permission: PERMISSIONS.DASHBOARD_VIEW },
        ],
      },
    ],
  },
  {
    id: 'reports',
    label: 'Reports',
    groups: [
      {
        label: 'Reports',
        items: [
          { label: 'Reports Hub', icon: BarChart2, href: '/reports', permission: PERMISSIONS.REPORTS_VIEW },
          { label: 'Custom Reports', icon: ScrollText, href: '/custom-reports', permission: PERMISSIONS.REPORTS_VIEW },
          { label: 'Export', icon: Download, href: '/export', permission: PERMISSIONS.REPORTS_VIEW },
        ],
      },
    ],
  },
  {
    id: 'audit',
    label: 'Audit & Compliance',
    groups: [
      {
        label: 'Audit',
        items: [
          { label: 'Live Activity Stream', icon: Radio, href: '/live-activity', permission: PERMISSIONS.AUDIT_LOG_VIEW },
          { label: 'Audit Center', icon: DatabaseZap, href: '/audit-center', permission: PERMISSIONS.AUDIT_LOG_VIEW },
          { label: 'Security & Compliance Trail', icon: ClipboardList, href: '/audit-trail', permission: PERMISSIONS.AUDIT_LOG_VIEW },
          { label: 'Audit Report', icon: BookOpen, href: '/audit-report', permission: PERMISSIONS.AUDIT_LOG_VIEW },
          { label: 'Archive Audit Log', icon: FileStack, href: '/archive/audit-log', permission: PERMISSIONS.AUDIT_LOG_VIEW },
        ],
      },
      {
        label: 'Compliance',
        items: [
          { label: 'Compliance Rules', icon: Scale, href: '/compliance-rules', permission: PERMISSIONS.COMPLIANCE_VIEW },
          { label: 'Compliance Audit', icon: ShieldCheck, href: '/compliance-audit', permission: PERMISSIONS.COMPLIANCE_VIEW },
        ],
      },
    ],
  },
  {
    id: 'administration',
    label: 'Administration',
    groups: [
      {
        label: 'Administration',
        items: [
          { label: 'User Management', icon: Users, href: '/user-management', permission: PERMISSIONS.USER_MANAGEMENT_VIEW },
          { label: 'Officer Permissions', icon: KeyRound, href: '/officer-permissions', permission: PERMISSIONS.USER_MANAGEMENT_MANAGE },
          { label: 'Client Bank Accounts', icon: Landmark, href: '/client-bank-accounts', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'System Settings', icon: Settings, href: '/settings', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Alert Thresholds', icon: SlidersHorizontal, href: '/alert-thresholds', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'System Config', icon: Brain, href: '/system-config', permission: PERMISSIONS.SETTINGS_MANAGE },
        ],
      },
    ],
  },
  {
    id: 'archive',
    label: 'Archive',
    groups: [
      {
        label: 'Vault',
        items: [
          { label: 'Vault Management', icon: Building2, href: '/archive/vault-management', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Collateral Placement', icon: MapPin, href: '/archive/collateral-placement', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
      {
        label: 'Documents',
        items: [
          { label: 'Documents Library', icon: Library, href: '/archive/documents-library', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Document Management', icon: FolderArchive, href: '/document-management', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
      {
        label: 'Workflow',
        items: [
          { label: 'Request Workflow', icon: ClipboardCheck, href: '/archive/request-workflow', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Custody Tracker', icon: Eye, href: '/archive/custody-tracker', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
    ],
  },
];

/**
 * Secondary paths that are not listed as nav items but belong to a module.
 * Maps path prefixes → module id.
 */
const SECONDARY_PATH_MODULE_MAP: Record<string, string> = {
  '/collateral-detail': 'collaterals',
  '/collateral-record': 'collaterals',
  '/collateral-library': 'collaterals',
  '/collateral-history': 'collaterals',
  '/document-management': 'archive',
  '/document-approval': 'approvals',
  '/obligors': 'obligors',
  '/user-guide': 'administration',
  '/admin': 'administration',
  '/approval-inbox': 'approvals',
  '/perfection-workflow': 'approvals',
  '/release-approval': 'approvals',
  '/audit-log': 'audit',
  '/activity-log': 'audit',
  '/performance-export': 'reports',
  '/reports-dashboard': 'reports',
  '/collateral-reports': 'reports',
};

/**
 * Given a pathname, return the module id it belongs to.
 */
export function getModuleForPath(pathname: string): string | null {
  // First: check exact nav item matches (including sub-paths), including children
  for (const mod of MODULE_DEFINITIONS) {
    for (const group of mod.groups) {
      for (const item of group.items) {
        const itemPath = item.href.split('?')[0];
        if (pathname === itemPath || pathname.startsWith(itemPath + '/')) {
          return mod.id;
        }
        if (item.children) {
          for (const child of item.children) {
            const childPath = child.href.split('?')[0];
            if (pathname === childPath || pathname.startsWith(childPath + '/')) {
              return mod.id;
            }
          }
        }
      }
    }
  }

  // Second: check secondary path map
  for (const [prefix, moduleId] of Object.entries(SECONDARY_PATH_MODULE_MAP)) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      return moduleId;
    }
  }

  return null;
}
