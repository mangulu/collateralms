/**
 * Module navigation definitions.
 * Each module maps to a set of sidebar nav groups shown when inside that module.
 */

import { PERMISSIONS } from '@/lib/rbac';
import { FolderOpen, GitBranch, Files, Unlock, Upload, CalendarClock, GitMerge, ShieldAlert, ScanSearch, Target, Zap, Map, LineChart, TrendingUp, Activity, LayoutDashboard, Bell, Inbox, AlarmClock, SendHorizonal, SlidersHorizontal, BarChart2, Download, DatabaseZap, ClipboardList, ScrollText, BookOpen, ShieldCheck, Radio, Scale, Users, KeyRound, Settings, Landmark, Archive, Building2, Library, ClipboardCheck, Eye, FileStack, BadgeCheck, Flame, FolderArchive, FolderCheck, Thermometer, Link2, ListChecks, UserCog, ArrowLeftRight, Shield, RefreshCw, MessageSquare, Mail, TrendingDown, FileCheck, CheckSquare, LayoutGrid, Workflow, Layers, Settings2, Play, AlertTriangle } from 'lucide-react';
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
      {
        label: 'Loan Operations',
        items: [
          { label: 'Valuation Workflow', icon: RefreshCw, href: '/valuation-workflow', permission: PERMISSIONS.COLLATERAL_EDIT },
          { label: 'Collateral Substitution', icon: ArrowLeftRight, href: '/collateral-substitution', permission: PERMISSIONS.COLLATERAL_EDIT },
          { label: 'Covenant Tracking', icon: Scale, href: '/covenant-tracking', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Insurance Tracking', icon: Shield, href: '/insurance-tracking', permission: PERMISSIONS.COLLATERAL_VIEW },
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
          { label: 'Loan Facilities', icon: Landmark, href: '/loans', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
    ],
  },
  {
    id: 'approvals',
    label: 'Workflows',
    groups: [
      {
        label: 'Overview',
        items: [
          { label: 'Workflows Dashboard', icon: LayoutGrid, href: '/workflows', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Task List', icon: CheckSquare, href: '/workflows/tasks', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
      {
        label: 'Engine',
        items: [
          { label: 'Workflow Templates', icon: Layers, href: '/workflows/templates', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Active Instances', icon: Activity, href: '/workflows/instances', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
      {
        label: 'Approvals',
        items: [
          { label: 'Approvals', icon: ShieldCheck, href: '/approvals', permission: PERMISSIONS.PERFECTION_REVIEW },
          { label: 'Perfection Queue', icon: GitBranch, href: '/approval-inbox', permission: PERMISSIONS.PERFECTION_VIEW },
          { label: 'Perfection Workflow', icon: GitBranch, href: '/perfection-workflow', permission: PERMISSIONS.PERFECTION_VIEW },
          { label: 'Document Approval', icon: BadgeCheck, href: '/document-approval', permission: PERMISSIONS.PERFECTION_VIEW },
          { label: 'Release Approval', icon: Unlock, href: '/release-approval', permission: PERMISSIONS.PERFECTION_VIEW },
        ],
      },
      {
        label: 'Workflow Processes',
        items: [
          { label: 'Valuation Reviews', icon: TrendingUp, href: '/workflows/valuation', permission: PERMISSIONS.COLLATERAL_EDIT },
          { label: 'Substitution Requests', icon: ArrowLeftRight, href: '/workflows/substitution', permission: PERMISSIONS.COLLATERAL_EDIT },
          { label: 'Archive Request Workflow', icon: FolderArchive, href: '/archive/request-workflow', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
    ],
  },
  {
    id: 'workflows-admin',
    label: 'Workflows Administration',
    groups: [
      {
        label: 'Overview',
        items: [
          { label: 'Admin Dashboard', icon: Settings2, href: '/workflows-admin', permission: PERMISSIONS.SETTINGS_VIEW },
        ],
      },
      {
        label: 'Monitoring',
        items: [
          { label: 'Active Instances', icon: Activity, href: '/workflows-admin/instances', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Process Analytics & KPIs', icon: TrendingUp, href: '/workflows-admin/process-analytics', permission: PERMISSIONS.SETTINGS_VIEW },
        ],
      },
      {
        label: 'Configuration',
        items: [
          { label: 'Workflow Templates', icon: Layers, href: '/workflows-admin/templates', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Auto-Trigger Rules', icon: Zap, href: '/workflows-admin/trigger-rules', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Escalation Config', icon: AlertTriangle, href: '/workflows-admin/escalation', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Trigger Processor', icon: Play, href: '/workflows-admin/trigger-processor', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Migration Tool', icon: Settings2, href: '/workflows-admin/migration', permission: PERMISSIONS.SETTINGS_VIEW },
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
          { label: 'SMS Notification Rules', icon: MessageSquare, href: '/sms-notification-rules', permission: PERMISSIONS.SETTINGS_VIEW },
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
      {
        label: 'Reporting & Compliance',
        items: [
          { label: 'Scheduled Report Delivery', icon: Mail, href: '/scheduled-report-delivery', permission: PERMISSIONS.REPORTS_VIEW },
          { label: 'Regulatory Submission Tracking', icon: FileCheck, href: '/regulatory-submission-tracking', permission: PERMISSIONS.REPORTS_VIEW },
          { label: 'LTV Breach Alerts', icon: TrendingDown, href: '/ltv-breach-alerts', permission: PERMISSIONS.REPORTS_VIEW },
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
          { label: 'Activity Log', icon: Activity, href: '/activity-log', permission: PERMISSIONS.AUDIT_LOG_VIEW },
          { label: 'Audit Center', icon: DatabaseZap, href: '/audit-center', permission: PERMISSIONS.AUDIT_LOG_VIEW },
          { label: 'Compliance Trail', icon: ClipboardList, href: '/audit-trail', permission: PERMISSIONS.AUDIT_LOG_VIEW },
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
          { label: 'Officer Management', icon: UserCog, href: '/officer-management', permission: PERMISSIONS.USER_MANAGEMENT_MANAGE },
          { label: 'Officer Permissions', icon: KeyRound, href: '/officer-permissions', permission: PERMISSIONS.USER_MANAGEMENT_MANAGE },
          { label: 'Client Bank Accounts', icon: Landmark, href: '/client-bank-accounts', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'System Settings', icon: Settings, href: '/settings', permission: PERMISSIONS.SETTINGS_VIEW },
          { label: 'Alert Thresholds', icon: SlidersHorizontal, href: '/alert-thresholds', permission: PERMISSIONS.SETTINGS_VIEW },
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
          { label: 'Collateral Filing', icon: FolderCheck, href: '/archive/collateral-placement', permission: PERMISSIONS.COLLATERAL_VIEW },
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
          { label: 'Request Status', icon: ListChecks, href: '/archive/request-status', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Custody Tracker', icon: Eye, href: '/archive/custody-tracker', permission: PERMISSIONS.COLLATERAL_VIEW },
          { label: 'Chain of Custody', icon: Link2, href: '/archive/chain-of-custody', permission: PERMISSIONS.COLLATERAL_VIEW },
        ],
      },
      {
        label: 'Analytics',
        items: [
          { label: 'Occupancy Heatmap', icon: Thermometer, href: '/archive/occupancy-heatmap', permission: PERMISSIONS.COLLATERAL_VIEW },
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
  '/valuation-workflow': 'collaterals',
  '/collateral-substitution': 'collaterals',
  '/covenant-tracking': 'collaterals',
  '/insurance-tracking': 'collaterals',
  '/workflows': 'approvals',
  '/document-management': 'archive',
  '/document-approval': 'approvals',
  '/obligors': 'obligors',
  '/loans': 'obligors',
  '/user-guide': 'administration',
  '/admin': 'administration',
  '/approval-inbox': 'approvals',
  '/perfection-workflow': 'approvals',
  '/release-approval': 'approvals',
  '/performance-export': 'reports',
  '/reports-dashboard': 'reports',
  '/collateral-reports': 'reports',
  '/onboarding-guide': 'administration',
  '/officer-management': 'administration',
  '/user-profile': 'administration',
  '/workflows-admin': 'workflows-admin',
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
