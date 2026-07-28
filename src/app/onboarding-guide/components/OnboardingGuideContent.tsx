'use client';
import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  FolderOpen, Users, CheckSquare, Brain, Bell, BarChart2, ShieldCheck, Settings, Archive,
  ChevronRight, ChevronDown, Zap, Map, ShieldAlert, ScanSearch, Target, LineChart, TrendingUp,
  Flame, LayoutDashboard, Activity, GitMerge, Files, Unlock, Upload, CalendarClock, MailCheck,
  GitBranch, BadgeCheck, Inbox, AlarmClock, SendHorizonal, ScrollText, Download, Radio,
  DatabaseZap, ClipboardList, BookOpen, FileStack, Scale, KeyRound, Landmark, SlidersHorizontal,
  Building2, MapPin, Library, FolderArchive, ClipboardCheck, Eye, BookMarked, Lightbulb,
  ArrowRight, Play, Star, Route,
} from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface QuickShortcut {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

interface UserJourney {
  title: string;
  role: string;
  steps: { action: string; where: string; href: string }[];
}

interface ModuleFeature {
  label: string;
  href: string;
  icon: React.ElementType;
  description: string;
}

interface ModuleGuide {
  id: string;
  title: string;
  tagline: string;
  purpose: string;
  icon: React.ElementType;
  color: string;
  bgGradient: string;
  iconBg: string;
  textColor: string;
  features: ModuleFeature[];
  journeys: UserJourney[];
  shortcuts: QuickShortcut[];
}

// ─── Module Data ──────────────────────────────────────────────────────────────

const MODULES: ModuleGuide[] = [
  {
    id: 'collaterals',
    title: 'Collaterals',
    tagline: 'The core registry for all collateral assets',
    purpose: 'Register, track, and manage every collateral asset across its full lifecycle — from initial registration through perfection, monitoring, and eventual release. This is the operational heart of the system.',
    icon: FolderOpen,
    color: '#1D4ED8',
    bgGradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 60%, #BFDBFE 100%)',
    iconBg: '#2563EB',
    textColor: '#1D4ED8',
    features: [
      { label: 'Collateral Dashboard', href: '/collateral-dashboard', icon: LayoutDashboard, description: 'KPI overview, overdue alerts, portfolio health bar, and recent activity feed.' },
      { label: 'Portfolio Monitoring', href: '/portfolio-monitoring', icon: Activity, description: 'Portfolio-wide health trends, concentration analysis, and risk distribution.' },
      { label: 'Collateral Registry', href: '/collateral-management', icon: FolderOpen, description: 'Add, edit, and search all collateral records. The primary data entry point.' },
      { label: 'Loan–Collateral Map', href: '/collateral-loan-visualization', icon: GitMerge, description: 'Visual network map linking loans to their collateral assets.' },
      { label: 'Collateral Documents', href: '/collateral-documents', icon: Files, description: 'Manage documents attached to collateral, including the Security Pocket.' },
      { label: 'Batch Release', href: '/batch-release', icon: Unlock, description: 'Release multiple collateral records simultaneously in a single operation.' },
      { label: 'Bulk Upload', href: '/bulk-upload', icon: Upload, description: 'Import hundreds of collateral records at once via CSV template.' },
      { label: 'Scheduled Jobs', href: '/scheduled-jobs', icon: CalendarClock, description: 'Monitor automated background tasks like expiry checks and notifications.' },
    ],
    journeys: [
      {
        title: 'Register new collateral',
        role: 'Credit Officer',
        steps: [
          { action: 'Open the registry', where: 'Collateral Registry', href: '/collateral-management' },
          { action: 'Click "Add Collateral" and fill in asset details', where: 'Collateral Registry', href: '/collateral-management' },
          { action: 'Upload title deed and valuation documents', where: 'Collateral Documents', href: '/collateral-documents' },
          { action: 'Submit for legal review via Approvals', where: 'Approval Inbox', href: '/approval-inbox' },
        ],
      },
      {
        title: 'Import multiple records',
        role: 'Credit Officer',
        steps: [
          { action: 'Download the CSV template', where: 'Bulk Upload', href: '/bulk-upload' },
          { action: 'Fill in asset data and upload the file', where: 'Bulk Upload', href: '/bulk-upload' },
          { action: 'Review import results and fix any errors', where: 'Bulk Upload', href: '/bulk-upload' },
          { action: 'Verify imported records appear in the registry', where: 'Collateral Registry', href: '/collateral-management' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Add Collateral', href: '/collateral-management', icon: FolderOpen, description: 'Register a new asset' },
      { label: 'View Dashboard', href: '/collateral-dashboard', icon: LayoutDashboard, description: 'Portfolio overview' },
      { label: 'Bulk Upload', href: '/bulk-upload', icon: Upload, description: 'Import via CSV' },
      { label: 'Loan Map', href: '/collateral-loan-visualization', icon: GitMerge, description: 'Visual loan links' },
    ],
  },
  {
    id: 'obligors',
    title: 'Obligors',
    tagline: 'Borrower profiles with credit risk intelligence',
    purpose: 'Maintain a complete profile for every borrower (obligor), including their credit risk score, exposure metrics, and approval trend history. Surfaces high-risk obligors directly in approval workflows.',
    icon: Users,
    color: '#0F766E',
    bgGradient: 'linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 60%, #99F6E4 100%)',
    iconBg: '#0D9488',
    textColor: '#0F766E',
    features: [
      { label: 'Obligors List', href: '/obligors', icon: Users, description: 'Full directory of all obligors with search, filter, and risk-level indicators.' },
      { label: 'Obligor Profile', href: '/obligors', icon: BookMarked, description: 'Individual profile with credit risk score gauge, exposure metrics, and approval trend summary.' },
    ],
    journeys: [
      {
        title: 'Review a high-risk obligor',
        role: 'Legal Officer',
        steps: [
          { action: 'Open the obligors directory', where: 'Obligors', href: '/obligors' },
          { action: 'Filter by "High Risk" to surface flagged borrowers', where: 'Obligors', href: '/obligors' },
          { action: 'Open the obligor profile to review credit score and exposure', where: 'Obligor Profile', href: '/obligors' },
          { action: 'Cross-reference with pending approvals', where: 'Approval Inbox', href: '/approval-inbox' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Obligors Directory', href: '/obligors', icon: Users, description: 'All borrower profiles' },
    ],
  },
  {
    id: 'approvals',
    title: 'Approvals',
    tagline: 'Centralised workflow for all approval decisions',
    purpose: 'A dedicated hub for every approval decision in the system — perfection approvals, document sign-offs, and collateral releases. Keeps all pending work in one place so nothing falls through the cracks.',
    icon: CheckSquare,
    color: '#1D4ED8',
    bgGradient: 'linear-gradient(135deg, #EFF6FF 0%, #DBEAFE 60%, #BFDBFE 100%)',
    iconBg: '#3B82F6',
    textColor: '#1D4ED8',
    features: [
      { label: 'Approval Inbox', href: '/approval-inbox', icon: MailCheck, description: 'Unified inbox showing all items awaiting your approval decision.' },
      { label: 'Perfection Approval', href: '/perfection-workflow', icon: GitBranch, description: 'Step-by-step workflow for approving or returning collateral perfection submissions.' },
      { label: 'Document Approval', href: '/document-approval', icon: BadgeCheck, description: 'Review and approve document submissions attached to collateral records.' },
      { label: 'Release Approval', href: '/release-approval', icon: Unlock, description: 'Authorise the release of perfected collateral back to the borrower.' },
    ],
    journeys: [
      {
        title: 'Process a perfection submission',
        role: 'Legal Officer',
        steps: [
          { action: 'Check the inbox for new submissions', where: 'Approval Inbox', href: '/approval-inbox' },
          { action: 'Open the submission and review attached documents', where: 'Perfection Approval', href: '/perfection-workflow' },
          { action: 'Check AI fraud and risk flags', where: 'AI Fraud Prevention', href: '/fraud-prevention' },
          { action: 'Approve, return with notes, or escalate', where: 'Perfection Approval', href: '/perfection-workflow' },
        ],
      },
      {
        title: 'Approve a collateral release',
        role: 'Legal Manager',
        steps: [
          { action: 'Open the release queue', where: 'Release Approval', href: '/release-approval' },
          { action: 'Verify loan closure and outstanding balance', where: 'Release Approval', href: '/release-approval' },
          { action: 'Approve the release and confirm', where: 'Release Approval', href: '/release-approval' },
          { action: 'System notifies the Credit Officer automatically', where: 'Notifications Hub', href: '/notifications-hub' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Approval Inbox', href: '/approval-inbox', icon: MailCheck, description: 'Pending decisions' },
      { label: 'Perfection Queue', href: '/perfection-workflow', icon: GitBranch, description: 'Review submissions' },
      { label: 'Release Queue', href: '/release-approval', icon: Unlock, description: 'Authorise releases' },
      { label: 'Document Review', href: '/document-approval', icon: BadgeCheck, description: 'Sign off documents' },
    ],
  },
  {
    id: 'intelligence',
    title: 'Intelligence',
    tagline: 'AI-powered analytics and risk tools',
    purpose: 'Harness AI and advanced analytics to detect fraud, assess risk, predict deadlines, and visualise portfolio health. Turns raw collateral data into actionable intelligence for smarter decisions.',
    icon: Brain,
    color: '#7C3AED',
    bgGradient: 'linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 60%, #DDD6FE 100%)',
    iconBg: '#7C3AED',
    textColor: '#7C3AED',
    features: [
      { label: 'Executive Dashboard', href: '/executive-dashboard', icon: TrendingUp, description: 'C-suite level KPIs, trend charts, and portfolio performance summary.' },
      { label: 'Cohort Analytics', href: '/cohort-analytics', icon: LineChart, description: 'Segment and compare collateral cohorts by type, region, or time period.' },
      { label: 'Deadline Predictions', href: '/deadline-predictions', icon: Target, description: 'AI-predicted expiry and perfection deadlines based on historical patterns.' },
      { label: 'AI Fraud Prevention', href: '/fraud-prevention', icon: ShieldAlert, description: 'Real-time fraud flag detection on collateral submissions with investigation tools.' },
      { label: 'AI Risk Assessment', href: '/risk-assessment', icon: ScanSearch, description: 'Automated risk scoring for each collateral asset with narrative explanations.' },
      { label: 'Fast Track', href: '/fast-track', icon: Zap, description: 'AI-assisted expedited processing for urgent collateral cases.' },
      { label: 'Geomapping', href: '/geomapping', icon: Map, description: 'Interactive map showing physical locations of all collateral assets.' },
      { label: 'Portfolio Heatmap', href: '/portfolio-heatmap', icon: Flame, description: 'Visual heatmap of portfolio concentration, risk density, and geographic spread.' },
    ],
    journeys: [
      {
        title: 'Investigate a fraud flag',
        role: 'Legal Officer',
        steps: [
          { action: 'Open AI Fraud Prevention — check flagged items', where: 'AI Fraud Prevention', href: '/fraud-prevention' },
          { action: 'Review the fraud narrative and evidence', where: 'AI Fraud Prevention', href: '/fraud-prevention' },
          { action: 'Cross-check the collateral record details', where: 'Collateral Registry', href: '/collateral-management' },
          { action: 'Return the submission with investigation notes', where: 'Perfection Approval', href: '/perfection-workflow' },
        ],
      },
      {
        title: 'Monthly portfolio review',
        role: 'Legal Manager',
        steps: [
          { action: 'Open the Executive Dashboard for top-level KPIs', where: 'Executive Dashboard', href: '/executive-dashboard' },
          { action: 'Review the Portfolio Heatmap for concentration risk', where: 'Portfolio Heatmap', href: '/portfolio-heatmap' },
          { action: 'Run Cohort Analytics for segment comparison', where: 'Cohort Analytics', href: '/cohort-analytics' },
          { action: 'Export the summary for board reporting', where: 'Reports Hub', href: '/reports' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Fraud Alerts', href: '/fraud-prevention', icon: ShieldAlert, description: 'Active fraud flags' },
      { label: 'Risk Scores', href: '/risk-assessment', icon: ScanSearch, description: 'AI risk assessment' },
      { label: 'Geomapping', href: '/geomapping', icon: Map, description: 'Asset locations' },
      { label: 'Heatmap', href: '/portfolio-heatmap', icon: Flame, description: 'Portfolio density' },
    ],
  },
  {
    id: 'alerts',
    title: 'Alerts & Notifications',
    tagline: 'Stay informed on every deadline and event',
    purpose: 'Proactively surface deadlines, workflow events, and system alerts so nothing is missed. Covers in-app notifications, SMS/email delivery tracking, and deadline reminder management.',
    icon: Bell,
    color: '#B45309',
    bgGradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 60%, #FDE68A 100%)',
    iconBg: '#D97706',
    textColor: '#B45309',
    features: [
      { label: 'Notifications Hub', href: '/notifications-hub', icon: Bell, description: 'Central inbox for all in-app system notifications and workflow updates.' },
      { label: 'Alerts Inbox', href: '/alerts-inbox', icon: Inbox, description: 'Operational alerts for collateral events, overdue items, and threshold breaches.' },
      { label: 'Deadline Reminders', href: '/deadline-reminders', icon: AlarmClock, description: 'Manage and track upcoming collateral expiry and perfection deadlines.' },
      { label: 'Alert Delivery Log', href: '/alerts-delivery', icon: SendHorizonal, description: 'Audit trail of all SMS and email alerts sent — verify delivery status.' },
    ],
    journeys: [
      {
        title: 'Handle an overdue deadline',
        role: 'Credit Officer',
        steps: [
          { action: 'Check Deadline Reminders for upcoming expirations', where: 'Deadline Reminders', href: '/deadline-reminders' },
          { action: 'Open the flagged collateral record', where: 'Collateral Registry', href: '/collateral-management' },
          { action: 'Update the valuation or document and resubmit', where: 'Collateral Documents', href: '/collateral-documents' },
          { action: 'Confirm the alert clears after resubmission', where: 'Alerts Inbox', href: '/alerts-inbox' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Notifications', href: '/notifications-hub', icon: Bell, description: 'System notifications' },
      { label: 'Alerts Inbox', href: '/alerts-inbox', icon: Inbox, description: 'Operational alerts' },
      { label: 'Deadlines', href: '/deadline-reminders', icon: AlarmClock, description: 'Upcoming expirations' },
      { label: 'Delivery Log', href: '/alerts-delivery', icon: SendHorizonal, description: 'SMS/email audit' },
    ],
  },
  {
    id: 'reports',
    title: 'Reports',
    tagline: 'Data-driven reporting and export tools',
    purpose: 'Generate regulatory reports, utilization summaries, and custom analytics. Export data in multiple formats for board presentations, regulatory submissions, and internal reviews.',
    icon: BarChart2,
    color: '#065F46',
    bgGradient: 'linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 60%, #A7F3D0 100%)',
    iconBg: '#059669',
    textColor: '#065F46',
    features: [
      { label: 'Reports Hub', href: '/reports', icon: BarChart2, description: 'Tabbed hub with Regulatory, Utilization, and Collateral report views in one place.' },
      { label: 'Custom Reports', href: '/custom-reports', icon: ScrollText, description: 'Build and save custom report templates with your own filters and columns.' },
      { label: 'Export', href: '/export', icon: Download, description: 'Export any dataset as CSV, Excel, or PDF with configurable date ranges.' },
    ],
    journeys: [
      {
        title: 'Generate a regulatory report',
        role: 'Legal Manager',
        steps: [
          { action: 'Open Reports Hub and select the Regulatory tab', where: 'Reports Hub', href: '/reports' },
          { action: 'Set the reporting period and filters', where: 'Reports Hub', href: '/reports' },
          { action: 'Preview the report and verify data accuracy', where: 'Reports Hub', href: '/reports' },
          { action: 'Export as PDF for submission', where: 'Export', href: '/export' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Reports Hub', href: '/reports', icon: BarChart2, description: 'All standard reports' },
      { label: 'Custom Reports', href: '/custom-reports', icon: ScrollText, description: 'Build your own' },
      { label: 'Export Data', href: '/export', icon: Download, description: 'CSV / Excel / PDF' },
    ],
  },
  {
    id: 'audit',
    title: 'Audit & Compliance',
    tagline: 'Full transparency and regulatory compliance',
    purpose: 'Maintain a tamper-proof record of every action in the system. Supports regulatory audits, internal compliance reviews, and real-time activity monitoring across all users and modules.',
    icon: ShieldCheck,
    color: '#9D174D',
    bgGradient: 'linear-gradient(135deg, #FFF1F2 0%, #FFE4E6 60%, #FECDD3 100%)',
    iconBg: '#E11D48',
    textColor: '#9D174D',
    features: [
      { label: 'Live Activity Stream', href: '/live-activity', icon: Radio, description: 'Real-time feed of all user actions across the system — auto-refreshes every 30 seconds.' },
      { label: 'Audit Center', href: '/audit-center', icon: DatabaseZap, description: 'Searchable audit database with advanced filters by user, action, date, and module.' },
      { label: 'Security & Compliance Trail', href: '/audit-trail', icon: ClipboardList, description: 'Immutable compliance trail for regulatory submissions and internal audits.' },
      { label: 'Audit Report', href: '/audit-report', icon: BookOpen, description: 'Generate formal PDF audit reports for specific periods or events.' },
      { label: 'Archive Audit Log', href: '/archive/audit-log', icon: FileStack, description: 'Dedicated audit log for all archive module operations.' },
      { label: 'Compliance Rules', href: '/compliance-rules', icon: Scale, description: 'Define and manage the compliance rules that govern collateral submissions.' },
      { label: 'Compliance Audit', href: '/compliance-audit', icon: ShieldCheck, description: 'Run compliance audits against active rules and review findings.' },
    ],
    journeys: [
      {
        title: 'Prepare for a regulatory audit',
        role: 'Legal Manager',
        steps: [
          { action: 'Open the Audit Center and set the audit period', where: 'Audit Center', href: '/audit-center' },
          { action: 'Filter by relevant actions and export the trail', where: 'Security & Compliance Trail', href: '/audit-trail' },
          { action: 'Generate a formal audit report PDF', where: 'Audit Report', href: '/audit-report' },
          { action: 'Review compliance rule adherence', where: 'Compliance Audit', href: '/compliance-audit' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Live Activity', href: '/live-activity', icon: Radio, description: 'Real-time stream' },
      { label: 'Audit Center', href: '/audit-center', icon: DatabaseZap, description: 'Search all events' },
      { label: 'Compliance Trail', href: '/audit-trail', icon: ClipboardList, description: 'Regulatory trail' },
      { label: 'Audit Report', href: '/audit-report', icon: BookOpen, description: 'Generate PDF report' },
    ],
  },
  {
    id: 'administration',
    title: 'Administration',
    tagline: 'System configuration and user governance',
    purpose: 'Control who can access what, configure system behaviour, and manage all platform settings. Restricted to System Administrators — the control centre for the entire platform.',
    icon: Settings,
    color: '#374151',
    bgGradient: 'linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 60%, #E5E7EB 100%)',
    iconBg: '#4B5563',
    textColor: '#374151',
    features: [
      { label: 'User Management', href: '/user-management', icon: Users, description: 'Create, edit, and deactivate user accounts. Manage screen access per user.' },
      { label: 'Officer Permissions', href: '/officer-permissions', icon: KeyRound, description: 'Fine-grained permission matrix — control exactly what each officer can do.' },
      { label: 'Client Bank Accounts', href: '/client-bank-accounts', icon: Landmark, description: 'Manage client bank account records linked to collateral and loan data.' },
      { label: 'System Settings', href: '/settings', icon: Settings, description: 'Configure email providers, document types, notification preferences, and registries.' },
      { label: 'Alert Thresholds', href: '/alert-thresholds', icon: SlidersHorizontal, description: 'Set numeric thresholds that trigger automated alerts (e.g. LTV > 80%).' },
      { label: 'System Config', href: '/system-config', icon: Settings, description: 'Advanced system configuration — brand kit, feature flags, and integrations.' },
    ],
    journeys: [
      {
        title: 'Onboard a new user',
        role: 'System Admin',
        steps: [
          { action: 'Open User Management and click "Add User"', where: 'User Management', href: '/user-management' },
          { action: 'Assign role and set initial permissions', where: 'Officer Permissions', href: '/officer-permissions' },
          { action: 'Configure screen access for the user', where: 'User Management', href: '/user-management' },
          { action: 'User receives login credentials via email', where: 'System Settings', href: '/settings' },
        ],
      },
    ],
    shortcuts: [
      { label: 'User Management', href: '/user-management', icon: Users, description: 'Manage accounts' },
      { label: 'Permissions', href: '/officer-permissions', icon: KeyRound, description: 'Role permissions' },
      { label: 'System Settings', href: '/settings', icon: Settings, description: 'Platform config' },
      { label: 'Alert Thresholds', href: '/alert-thresholds', icon: SlidersHorizontal, description: 'Trigger rules' },
    ],
  },
  {
    id: 'archive',
    title: 'Archive',
    tagline: 'Physical vault and document custody management',
    purpose: 'Track the physical custody of original collateral documents — from vault placement to loan file workflows and custody handoffs. Bridges the digital record with the physical document lifecycle.',
    icon: Archive,
    color: '#92400E',
    bgGradient: 'linear-gradient(135deg, #FFFBEB 0%, #FEF3C7 60%, #FDE68A 100%)',
    iconBg: '#D97706',
    textColor: '#92400E',
    features: [
      { label: 'Vault Management', href: '/archive/vault-management', icon: Building2, description: 'Manage physical vault locations, capacity, and document placement records.' },
      { label: 'Collateral Placement', href: '/archive/collateral-placement', icon: MapPin, description: 'Record and track where each original document is physically stored.' },
      { label: 'Documents Library', href: '/archive/documents-library', icon: Library, description: 'Searchable library of all archived documents with version history.' },
      { label: 'Document Management', href: '/document-management', icon: FolderArchive, description: 'Manage document templates, policies, and classification rules.' },
      { label: 'Request Workflow', href: '/archive/request-workflow', icon: ClipboardCheck, description: 'Handle requests to retrieve, loan out, or return archived documents.' },
      { label: 'Custody Tracker', href: '/archive/custody-tracker', icon: Eye, description: 'Real-time tracker showing the current custody status of every document.' },
    ],
    journeys: [
      {
        title: 'Place a document in the vault',
        role: 'Legal Officer',
        steps: [
          { action: 'Open Vault Management and select the target vault', where: 'Vault Management', href: '/archive/vault-management' },
          { action: 'Record the document placement with location details', where: 'Collateral Placement', href: '/archive/collateral-placement' },
          { action: 'Update the custody status in the tracker', where: 'Custody Tracker', href: '/archive/custody-tracker' },
          { action: 'Verify the document appears in the Documents Library', where: 'Documents Library', href: '/archive/documents-library' },
        ],
      },
    ],
    shortcuts: [
      { label: 'Vault Management', href: '/archive/vault-management', icon: Building2, description: 'Physical vaults' },
      { label: 'Custody Tracker', href: '/archive/custody-tracker', icon: Eye, description: 'Document custody' },
      { label: 'Documents Library', href: '/archive/documents-library', icon: Library, description: 'Archived docs' },
      { label: 'Request Workflow', href: '/archive/request-workflow', icon: ClipboardCheck, description: 'Retrieval requests' },
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function JourneyCard({ journey, moduleColor }: { journey: UserJourney; moduleColor: string }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="rounded-xl border overflow-hidden" style={{ borderColor: 'rgba(0,0,0,0.08)' }}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-left transition-colors hover:bg-black/[0.02]"
        style={{ backgroundColor: 'rgba(255,255,255,0.7)' }}
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0" style={{ backgroundColor: moduleColor + '18' }}>
            <Route size={13} style={{ color: moduleColor }} />
          </div>
          <div>
            <p className="text-sm font-semibold" style={{ color: '#1E293B' }}>{journey.title}</p>
            <p className="text-xs" style={{ color: '#64748B' }}>Typical journey for {journey.role}</p>
          </div>
        </div>
        <ChevronDown
          size={16}
          style={{ color: moduleColor, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }}
        />
      </button>
      {expanded && (
        <div className="px-4 pb-4 pt-2" style={{ backgroundColor: 'rgba(255,255,255,0.5)' }}>
          <div className="space-y-2">
            {journey.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3">
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 text-xs font-bold"
                  style={{ backgroundColor: moduleColor, color: '#fff', fontSize: '10px' }}
                >
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs" style={{ color: '#374151' }}>{step.action}</p>
                  <Link
                    href={step.href}
                    className="inline-flex items-center gap-1 text-xs font-medium mt-0.5 hover:underline"
                    style={{ color: moduleColor }}
                  >
                    <ArrowRight size={10} />
                    {step.where}
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModulePanel({ module, isActive, onToggle }: { module: ModuleGuide; isActive: boolean; onToggle: () => void }) {
  const [activeTab, setActiveTab] = useState<'features' | 'journeys' | 'shortcuts'>('features');
  const Icon = module.icon;

  return (
    <div
      className="rounded-2xl overflow-hidden transition-all duration-300"
      style={{
        border: isActive ? `2px solid ${module.color}` : '2px solid rgba(0,0,0,0.07)',
        boxShadow: isActive ? `0 8px 32px ${module.color}22` : '0 2px 8px rgba(0,0,0,0.05)',
      }}
    >
      {/* Header */}
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-4 p-5 text-left transition-all duration-200"
        style={{ background: isActive ? module.bgGradient : '#FFFFFF' }}
      >
        <div
          className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          style={{ backgroundColor: module.iconBg }}
        >
          <Icon size={22} color="#fff" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-base font-bold" style={{ color: '#1E293B', fontFamily: 'DM Sans, sans-serif' }}>
              {module.title}
            </h3>
            <span
              className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ backgroundColor: module.color + '18', color: module.color }}
            >
              {module.features.length} features
            </span>
          </div>
          <p className="text-xs mt-0.5 truncate" style={{ color: '#64748B' }}>{module.tagline}</p>
        </div>
        <ChevronDown
          size={18}
          style={{
            color: module.color,
            transform: isActive ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.25s',
            flexShrink: 0,
          }}
        />
      </button>

      {/* Expanded Content */}
      {isActive && (
        <div style={{ backgroundColor: '#FAFBFC' }}>
          {/* Purpose */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-start gap-2.5 p-3 rounded-xl" style={{ backgroundColor: module.color + '0D' }}>
              <Lightbulb size={15} style={{ color: module.color, marginTop: 1, flexShrink: 0 }} />
              <p className="text-sm leading-relaxed" style={{ color: '#374151' }}>{module.purpose}</p>
            </div>
          </div>

          {/* Tabs */}
          <div className="px-5 pb-2">
            <div className="flex gap-1 p-1 rounded-lg" style={{ backgroundColor: '#F1F5F9' }}>
              {(['features', 'journeys', 'shortcuts'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className="flex-1 py-1.5 px-2 rounded-md text-xs font-semibold transition-all duration-150 capitalize"
                  style={
                    activeTab === tab
                      ? { backgroundColor: '#FFFFFF', color: module.color, boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                      : { color: '#64748B' }
                  }
                >
                  {tab === 'features' ? 'Features' : tab === 'journeys' ? 'User Journeys' : 'Quick Access'}
                </button>
              ))}
            </div>
          </div>

          {/* Tab Content */}
          <div className="px-5 pb-5">
            {activeTab === 'features' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                {module.features.map((feat) => {
                  const FeatIcon = feat.icon;
                  return (
                    <Link
                      key={feat.href + feat.label}
                      href={feat.href}
                      className="flex items-start gap-3 p-3 rounded-xl transition-all duration-150 group"
                      style={{ backgroundColor: '#FFFFFF', border: '1px solid rgba(0,0,0,0.06)' }}
                      onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.borderColor = module.color + '40'; }}
                      onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(0,0,0,0.06)'; }}
                    >
                      <div
                        className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
                        style={{ backgroundColor: module.color + '15' }}
                      >
                        <FeatIcon size={14} style={{ color: module.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold flex items-center gap-1" style={{ color: '#1E293B' }}>
                          {feat.label}
                          <ChevronRight size={11} className="opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: module.color }} />
                        </p>
                        <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>{feat.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            {activeTab === 'journeys' && (
              <div className="space-y-2 mt-2">
                {module.journeys.length > 0 ? (
                  module.journeys.map((journey, i) => (
                    <JourneyCard key={i} journey={journey} moduleColor={module.color} />
                  ))
                ) : (
                  <p className="text-sm text-center py-6" style={{ color: '#94A3B8' }}>No journeys defined for this module.</p>
                )}
              </div>
            )}

            {activeTab === 'shortcuts' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2">
                {module.shortcuts.map((sc) => {
                  const ScIcon = sc.icon;
                  return (
                    <Link
                      key={sc.href + sc.label}
                      href={sc.href}
                      className="flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all duration-150 hover:-translate-y-0.5"
                      style={{
                        backgroundColor: '#FFFFFF',
                        border: `1px solid ${module.color}25`,
                        boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
                      }}
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ backgroundColor: module.color + '18' }}
                      >
                        <ScIcon size={17} style={{ color: module.color }} />
                      </div>
                      <div>
                        <p className="text-xs font-semibold leading-tight" style={{ color: '#1E293B' }}>{sc.label}</p>
                        <p className="text-xs mt-0.5" style={{ color: '#94A3B8' }}>{sc.description}</p>
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function OnboardingGuideContent() {
  const searchParams = useSearchParams();
  const moduleParam = searchParams?.get('module');

  const [activeModule, setActiveModule] = useState<string | null>('collaterals');
  const [search, setSearch] = useState('');

  // Deep-link: if ?module=xxx is provided, open that module panel
  useEffect(() => {
    if (moduleParam) {
      const found = MODULES.find((m) => m.id === moduleParam);
      if (found) {
        setActiveModule(found.id);
        // Scroll to the module panel after a short delay for render
        setTimeout(() => {
          const el = document.getElementById(`module-panel-${found.id}`);
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 200);
      }
    }
  }, [moduleParam]);

  const filtered = search.trim()
    ? MODULES.filter(
        (m) =>
          m.title.toLowerCase().includes(search.toLowerCase()) ||
          m.tagline.toLowerCase().includes(search.toLowerCase()) ||
          m.features.some((f) => f.label.toLowerCase().includes(search.toLowerCase()))
      )
    : MODULES;

  const toggleModule = (id: string) => {
    setActiveModule((prev) => (prev === id ? null : id));
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#F0F7FF' }}>
      {/* Page Header */}
      <div
        className="px-6 py-8"
        style={{
          background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #2563EB 100%)',
        }}
      >
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}>
              <BookMarked size={16} color="#fff" />
            </div>
            <span className="text-blue-200 text-sm font-medium">Onboarding Guide</span>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2" style={{ fontFamily: 'DM Sans, sans-serif' }}>
            Welcome to CollateralMS
          </h1>
          <p className="text-blue-200 text-sm max-w-2xl leading-relaxed">
            This guide explains all 9 modules, their purpose, typical user journeys, and quick-access shortcuts. Click any module to explore its features.
          </p>

          {/* Stats row */}
          <div className="flex flex-wrap gap-4 mt-5">
            {[
              { label: '9 Modules', icon: Star },
              { label: 'Role-based journeys', icon: Route },
              { label: 'Quick-access shortcuts', icon: Zap },
              { label: 'Step-by-step workflows', icon: Play },
            ].map(({ label, icon: StatIcon }) => (
              <div key={label} className="flex items-center gap-1.5">
                {React.createElement(StatIcon, { size: 13, className: "text-blue-300" })}
                <span className="text-blue-100 text-xs font-medium">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Search + Module List */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
        {/* Search */}
        <div className="relative mb-5">
          <input
            type="text"
            placeholder="Search modules or features…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
            style={{
              backgroundColor: '#FFFFFF',
              border: '1.5px solid #E2E8F0',
              color: '#1E293B',
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = '#2563EB'; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; }}
          />
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2"
            width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="#94A3B8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
          >
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
        </div>

        {/* Module Accordion */}
        <div className="space-y-3">
          {filtered.length === 0 ? (
            <div className="text-center py-12" style={{ color: '#94A3B8' }}>
              <p className="text-sm">No modules match your search.</p>
            </div>
          ) : (
            filtered.map((mod) => (
              <div key={mod.id} id={`module-panel-${mod.id}`}>
                <ModulePanel
                  module={mod}
                  isActive={activeModule === mod.id}
                  onToggle={() => toggleModule(mod.id)}
                />
              </div>
            ))
          )}
        </div>

        {/* Footer tip */}
        <div
          className="mt-6 flex items-start gap-3 p-4 rounded-xl"
          style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
        >
          <Lightbulb size={16} style={{ color: '#2563EB', marginTop: 1, flexShrink: 0 }} />
          <p className="text-xs leading-relaxed" style={{ color: '#1D4ED8' }}>
            <strong>Tip:</strong> Click any feature link or shortcut to navigate directly to that screen. Use the User Journeys tab to follow step-by-step workflows for common tasks in your role.
          </p>
        </div>
      </div>
    </div>
  );
}
