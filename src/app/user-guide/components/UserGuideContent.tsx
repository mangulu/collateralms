'use client';
import React, { useState } from 'react';
import { BookOpen, ChevronDown, ChevronRight, Shield, Users, Scale, Briefcase, LayoutDashboard, FolderOpen, GitBranch, Files, Upload, Bell, BarChart2, ShieldCheck, Settings, CheckCircle, Eye, Edit, Download, AlertTriangle, Zap, Map, ClipboardList, ScrollText, UserCheck, Lock, Info, Search, Radio, Inbox, SendHorizonal, ScanSearch, ShieldAlert, CalendarClock, Unlock, Activity,  } from 'lucide-react';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

type RoleKey = 'credit_officer' | 'legal_officer' | 'legal_manager' | 'system_admin';

interface WorkflowStep {
  step: number;
  title: string;
  description: string;
}

interface ScreenAccess {
  screen: string;
  icon: React.ElementType;
  actions: string[];
  notes?: string;
}

interface GuideSection {
  id: string;
  title: string;
  content: string | React.ReactNode;
}

interface RoleGuide {
  key: RoleKey;
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  borderColor: string;
  badgeColor: string;
  description: string;
  responsibilities: string[];
  screens: ScreenAccess[];
  workflows: WorkflowStep[];
  tips: string[];
  restrictions: string[];
}

// ─── Role Data ────────────────────────────────────────────────────────────────

const ROLE_GUIDES: RoleGuide[] = [
  {
    key: 'credit_officer',
    label: 'Credit Officer',
    icon: Briefcase,
    color: 'text-blue-700',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeColor: 'bg-blue-100 text-blue-700',
    description:
      'Credit Officers are responsible for registering, managing, and monitoring collateral assets. They initiate the collateral perfection workflow and handle day-to-day collateral operations.',
    responsibilities: [
      'Register new collateral assets in the system',
      'Upload supporting documents for each collateral',
      'Submit collateral for legal review and perfection',
      'Monitor collateral status and expiry dates',
      'Run bulk uploads for multiple collateral records',
      'View portfolio health and overdue alerts',
      'Use Fast Track for urgent collateral processing',
      'Perform geomapping for physical asset verification',
    ],
    screens: [
      { screen: 'Collateral Dashboard', icon: LayoutDashboard, actions: ['View', 'Monitor KPIs', 'View Alerts'], notes: 'Primary landing screen — shows portfolio overview, overdue alerts, and recent activity.' },
      { screen: 'Portfolio Monitoring', icon: Activity, actions: ['View', 'Filter', 'Export'], notes: 'Track portfolio-wide collateral health and trends.' },
      { screen: 'Collateral Registry', icon: FolderOpen, actions: ['View', 'Create', 'Edit'], notes: 'Add and manage individual collateral records. Cannot delete records.' },
      { screen: 'Approval Workflow', icon: GitBranch, actions: ['View', 'Submit'], notes: 'Submit collateral for legal review. Cannot approve or reject.' },
      { screen: 'Collateral Documents', icon: Files, actions: ['View', 'Upload'], notes: 'Attach documents to collateral records.' },
      { screen: 'Bulk Upload', icon: Upload, actions: ['Upload', 'View Results'], notes: 'Import multiple collateral records via CSV template.' },
      { screen: 'Scheduled Jobs', icon: CalendarClock, actions: ['View'], notes: 'Monitor automated background jobs.' },
      { screen: 'Fast Track', icon: Zap, actions: ['View', 'Submit'], notes: 'Expedite urgent collateral processing requests.' },
      { screen: 'Geomapping', icon: Map, actions: ['View', 'Search'], notes: 'Visualise physical collateral locations on a map.' },
      { screen: 'Notifications Hub', icon: Bell, actions: ['View', 'Manage'], notes: 'Receive and manage system notifications.' },
      { screen: 'Alerts Inbox', icon: Inbox, actions: ['View'], notes: 'View incoming alerts for assigned collateral.' },
      { screen: 'Reports', icon: BarChart2, actions: ['View', 'Export'], notes: 'Access standard collateral reports.' },
    ],
    workflows: [
      { step: 1, title: 'Register Collateral', description: 'Navigate to Collateral Registry → click "Add Collateral". Fill in asset details: type, value, borrower, loan reference, and expiry date.' },
      { step: 2, title: 'Upload Documents', description: 'Open the collateral record → go to the Documents tab → upload title deeds, valuations, or insurance certificates.' },
      { step: 3, title: 'Submit for Perfection', description: 'In the Approval Workflow screen, locate the collateral and click "Submit for Review". Add any notes for the legal team.' },
      { step: 4, title: 'Monitor Status', description: 'Track the collateral status on the Dashboard (Pending → Under Review → Perfected). You will receive a notification when the status changes.' },
      { step: 5, title: 'Handle Overdue Alerts', description: 'Check the Overdue Alerts panel on the Dashboard daily. Click an alert to view the collateral and take corrective action.' },
    ],
    tips: [
      'Use the Bulk Upload feature to import multiple collateral records at once — download the CSV template first.',
      'Set expiry reminders by ensuring the "Expiry Date" field is always populated when registering collateral.',
      'Use Fast Track only for genuinely urgent cases — it bypasses standard SLA queues.',
      'Always attach at least one document before submitting for legal review to avoid rejection.',
      'Use the Geomapping screen to verify physical asset locations match the registered address.',
    ],
    restrictions: [
      'Cannot approve or reject collateral in the workflow — that is a Legal Officer/Manager function.',
      'Cannot delete collateral records — contact System Admin if a record needs removal.',
      'Cannot access User Management, Admin Console, or System Settings.',
      'Cannot view or modify compliance rules.',
      'Cannot access the Audit Trail or Change History screens.',
    ],
  },
  {
    key: 'legal_officer',
    label: 'Legal Officer',
    icon: Scale,
    color: 'text-purple-700',
    bgColor: 'bg-purple-50',
    borderColor: 'border-purple-200',
    badgeColor: 'bg-purple-100 text-purple-700',
    description:
      'Legal Officers review and process collateral submitted by Credit Officers. They verify legal documentation, assess compliance, and either approve, return, or escalate collateral for further review.',
    responsibilities: [
      'Review collateral submissions from Credit Officers',
      'Verify legal documents (title deeds, charges, valuations)',
      'Approve, return, or escalate collateral in the workflow',
      'Check AI fraud and risk assessment flags',
      'Ensure compliance with regulatory rules',
      'Manage the Security Pocket for perfected collateral',
      'Review and respond to compliance audit findings',
      'Monitor alerts and notifications for assigned cases',
    ],
    screens: [
      { screen: 'Collateral Dashboard', icon: LayoutDashboard, actions: ['View', 'Monitor'], notes: 'Overview of all collateral in the review queue.' },
      { screen: 'Approval Workflow', icon: GitBranch, actions: ['View', 'Review', 'Approve', 'Return', 'Reject'], notes: 'Core working screen — process all submitted collateral here.' },
      { screen: 'Collateral Documents', icon: Files, actions: ['View', 'Upload', 'Manage Security Pocket'], notes: 'Review attached documents and manage the Security Pocket.' },
      { screen: 'AI Fraud Prevention', icon: ShieldAlert, actions: ['View', 'Investigate'], notes: 'Review AI-generated fraud flags before approving collateral.' },
      { screen: 'AI Risk Assessment', icon: ScanSearch, actions: ['View'], notes: 'View risk scores and recommendations for each collateral.' },
      { screen: 'Compliance Rules', icon: Scale, actions: ['View'], notes: 'Reference compliance rules during review.' },
      { screen: 'Compliance Audit', icon: ClipboardList, actions: ['View', 'Respond'], notes: 'Review compliance audit findings and add responses.' },
      { screen: 'Notifications Hub', icon: Bell, actions: ['View', 'Manage'], notes: 'Receive workflow notifications and alerts.' },
      { screen: 'Alerts Inbox', icon: Inbox, actions: ['View'], notes: 'View alerts for collateral under review.' },
      { screen: 'Alert Delivery Log', icon: SendHorizonal, actions: ['View'], notes: 'Verify that SMS/email alerts were delivered.' },
      { screen: 'Reports', icon: BarChart2, actions: ['View', 'Export'], notes: 'Access legal review performance reports.' },
      { screen: 'Geomapping', icon: Map, actions: ['View'], notes: 'Verify physical asset locations.' },
    ],
    workflows: [
      { step: 1, title: 'Open Review Queue', description: 'Navigate to Approval Workflow. Filter by status "Submitted" to see all collateral awaiting your review.' },
      { step: 2, title: 'Check AI Flags', description: 'Before reviewing documents, check the AI Fraud Prevention and AI Risk Assessment screens for any flags on the collateral.' },
      { step: 3, title: 'Review Documents', description: 'Open the collateral record → Documents tab. Verify all required documents are present and valid (title deed, valuation, charge form).' },
      { step: 4, title: 'Make a Decision', description: 'In the Approval Workflow, select the collateral and choose: Approve (moves to Perfected), Return (sends back to Credit Officer with notes), or Reject (permanently declined).' },
      { step: 5, title: 'Manage Security Pocket', description: 'For approved collateral, go to Collateral Documents → Security Pocket tab to record the physical custody location of original documents.' },
    ],
    tips: [
      'Always check AI Fraud Prevention flags before approving — a flagged collateral should be investigated thoroughly.',
      'Use the "Return" action (not "Reject") when documents are incomplete — this allows the Credit Officer to resubmit.',
      'Add detailed notes when returning or rejecting collateral so the Credit Officer knows exactly what to fix.',
      'Use the Compliance Rules screen as a reference checklist during document review.',
      'Check the Alert Delivery Log to confirm that SMS notifications were sent to borrowers after status changes.',
    ],
    restrictions: [
      'Cannot create or edit collateral records — that is a Credit Officer function.',
      'Cannot access User Management, Admin Console, or System Settings.',
      'Cannot modify compliance rules — read-only access.',
      'Cannot access the Audit Trail, Change History, or Activity Log screens.',
      'Cannot perform bulk uploads or batch releases.',
    ],
  },
  {
    key: 'legal_manager',
    label: 'Legal Manager',
    icon: Shield,
    color: 'text-amber-700',
    bgColor: 'bg-amber-50',
    borderColor: 'border-amber-200',
    badgeColor: 'bg-amber-100 text-amber-700',
    description:
      'Legal Managers oversee the entire collateral lifecycle. They have all Legal Officer permissions plus the ability to manage compliance rules, run batch operations, access full audit trails, and generate executive reports.',
    responsibilities: [
      'Oversee and manage the collateral perfection workflow',
      'Approve high-value or escalated collateral submissions',
      'Define and update compliance rules',
      'Run batch release operations for multiple collateral',
      'Access full audit trails and change history',
      'Generate and export executive-level reports',
      'Monitor live activity streams for real-time oversight',
      'Manage document management policies',
      'Review fraud prevention and risk assessment summaries',
    ],
    screens: [
      { screen: 'Collateral Dashboard', icon: LayoutDashboard, actions: ['View', 'Monitor', 'Export'], notes: 'Full dashboard access including all KPIs and trend charts.' },
      { screen: 'Portfolio Monitoring', icon: Activity, actions: ['View', 'Filter', 'Export'], notes: 'Portfolio-wide health monitoring and trend analysis.' },
      { screen: 'Collateral Registry', icon: FolderOpen, actions: ['View', 'Edit'], notes: 'View and edit all collateral records.' },
      { screen: 'Approval Workflow', icon: GitBranch, actions: ['View', 'Review', 'Approve', 'Return', 'Reject', 'Escalate'], notes: 'Full workflow management including escalated cases.' },
      { screen: 'Collateral Documents', icon: Files, actions: ['View', 'Upload', 'Manage', 'Security Pocket'], notes: 'Full document management access.' },
      { screen: 'Batch Release', icon: Unlock, actions: ['View', 'Execute'], notes: 'Release multiple collateral records simultaneously.' },
      { screen: 'AI Fraud Prevention', icon: ShieldAlert, actions: ['View', 'Investigate', 'Override'], notes: 'Full fraud investigation and override capability.' },
      { screen: 'AI Risk Assessment', icon: ScanSearch, actions: ['View', 'Export'], notes: 'Full risk assessment access with export.' },
      { screen: 'Fast Track', icon: Zap, actions: ['View', 'Approve'], notes: 'Approve fast-track requests submitted by Credit Officers.' },
      { screen: 'Geomapping', icon: Map, actions: ['View', 'Export'], notes: 'Full geomapping access.' },
      { screen: 'Compliance Rules', icon: Scale, actions: ['View', 'Create', 'Edit', 'Delete'], notes: 'Full compliance rule management.' },
      { screen: 'Compliance Audit', icon: ClipboardList, actions: ['View', 'Manage', 'Export'], notes: 'Full compliance audit management.' },
      { screen: 'Live Activity Stream', icon: Radio, actions: ['View', 'Filter'], notes: 'Real-time activity monitoring across all users.' },
      { screen: 'Security & Compliance Trail', icon: ClipboardList, actions: ['View', 'Export'], notes: 'Full audit trail access.' },
      { screen: 'Change History', icon: ScrollText, actions: ['View', 'Export'], notes: 'Detailed change history for all records.' },
      { screen: 'Activity Log', icon: UserCheck, actions: ['View', 'Export'], notes: 'User activity log access.' },
      { screen: 'Audit Report', icon: BookOpen, actions: ['View', 'Generate', 'Export'], notes: 'Generate and export formal audit reports.' },
      { screen: 'Reports', icon: BarChart2, actions: ['View', 'Generate', 'Export'], notes: 'Full reporting suite access.' },
      { screen: 'Export', icon: Download, actions: ['Export All Formats'], notes: 'Export data in CSV, Excel, or PDF formats.' },
      { screen: 'Document Management', icon: Files, actions: ['View', 'Manage'], notes: 'Manage document templates and policies.' },
    ],
    workflows: [
      { step: 1, title: 'Daily Oversight Review', description: 'Start each day on the Live Activity Stream to review overnight activity. Check the Dashboard for any overdue or high-risk collateral.' },
      { step: 2, title: 'Handle Escalations', description: 'In the Approval Workflow, filter by "Escalated" status to review cases that Legal Officers have escalated for management decision.' },
      { step: 3, title: 'Batch Release Operations', description: 'Navigate to Batch Release to process multiple collateral releases simultaneously. Review the list, confirm, and execute the batch.' },
      { step: 4, title: 'Compliance Rule Management', description: 'Go to Compliance Rules to add, edit, or deactivate rules. Changes take effect immediately for all new collateral submissions.' },
      { step: 5, title: 'Generate Executive Reports', description: 'Use the Audit Report screen to generate formal reports. Use the Export screen to download data in the required format for board presentations.' },
    ],
    tips: [
      'Use the Live Activity Stream for real-time oversight — set auto-refresh to 30 seconds during busy periods.',
      'Before running a Batch Release, always export the list first as an audit record.',
      'Compliance Rule changes are logged in the Audit Trail — add a clear reason when making changes.',
      'Use the Portfolio Monitoring screen for monthly portfolio health reviews.',
      'The Audit Report screen generates PDF reports suitable for regulatory submissions.',
    ],
    restrictions: [
      'Cannot create new user accounts — that is a System Admin function.',
      'Cannot modify role permissions or system settings.',
      'Cannot access the Admin Console or User Management screens.',
      'Cannot delete collateral records directly — submit a request to System Admin.',
    ],
  },
  {
    key: 'system_admin',
    label: 'System Admin',
    icon: ShieldCheck,
    color: 'text-rose-700',
    bgColor: 'bg-rose-50',
    borderColor: 'border-rose-200',
    badgeColor: 'bg-rose-100 text-rose-700',
    description:
      'System Administrators have full access to all system functions. They manage users, roles, permissions, system settings, and have unrestricted access to all screens and data.',
    responsibilities: [
      'Create, edit, and deactivate user accounts',
      'Manage roles and assign permissions',
      'Configure system settings and email providers',
      'Manage notification preferences and alert rules',
      'Monitor all audit trails and activity logs',
      'Perform system-level data exports and backups',
      'Configure screen access rules per role',
      'Manage scheduled jobs and automation',
      'Oversee fraud prevention and compliance systems',
      'Handle all escalated issues from other roles',
    ],
    screens: [
      { screen: 'Admin Console', icon: ShieldCheck, actions: ['Full Access'], notes: 'Central administration hub — manage system-wide settings.' },
      { screen: 'User Management', icon: Users, actions: ['View', 'Create', 'Edit', 'Deactivate', 'Screen Access'], notes: 'Full user lifecycle management including screen access matrix.' },
      { screen: 'System Settings', icon: Settings, actions: ['View', 'Configure'], notes: 'Email provider, notification, and registry settings.' },
      { screen: 'All Collateral Screens', icon: FolderOpen, actions: ['Full Access'], notes: 'Unrestricted access to all collateral management screens.' },
      { screen: 'All Workflow Screens', icon: GitBranch, actions: ['Full Access'], notes: 'Full workflow management including all approval actions.' },
      { screen: 'All Audit Screens', icon: ClipboardList, actions: ['Full Access'], notes: 'Complete audit trail, change history, and activity log access.' },
      { screen: 'All Report Screens', icon: BarChart2, actions: ['Full Access'], notes: 'All reporting and export capabilities.' },
      { screen: 'All Intelligence Screens', icon: ShieldAlert, actions: ['Full Access'], notes: 'AI fraud prevention, risk assessment, and compliance.' },
      { screen: 'Scheduled Jobs', icon: CalendarClock, actions: ['View', 'Manage', 'Trigger'], notes: 'Manage and manually trigger automated background jobs.' },
      { screen: 'Live Activity Stream', icon: Radio, actions: ['Full Access'], notes: 'Real-time monitoring of all system activity.' },
    ],
    workflows: [
      { step: 1, title: 'Create a New User', description: 'Go to User Management → click "Add User". Enter name, email, and assign a role. The user will receive an email invitation to set their password.' },
      { step: 2, title: 'Assign Role Permissions', description: 'Navigate to User Management → Roles tab. Select a role and use the permissions matrix to grant or revoke specific permissions.' },
      { step: 3, title: 'Configure Screen Access', description: 'In User Management → Screen Access tab, use the matrix to control which screens each role can access and what actions they can perform.' },
      { step: 4, title: 'Configure Email Provider', description: 'Go to System Settings → Email Provider tab. Enter SMTP credentials or API keys for the notification email provider.' },
      { step: 5, title: 'Monitor System Health', description: 'Use the Live Activity Stream and Scheduled Jobs screens to monitor system health. Check the Audit Trail for any suspicious activity.' },
      { step: 6, title: 'Deactivate a User', description: 'In User Management, find the user → click the action menu → select "Deactivate". The user\'s session will be terminated immediately.' },
    ],
    tips: [
      'Always use the Screen Access matrix to fine-tune permissions beyond the default role settings.',
      'Regularly review the Live Activity Stream for unusual login patterns or bulk operations.',
      'Before deactivating a user, check if they have any pending workflow items that need reassignment.',
      'Use the Scheduled Jobs screen to verify that automated alerts and reports are running correctly.',
      'Export the Audit Trail monthly as a compliance record — store it in a secure location.',
      'Test email provider settings using the "Send Test Email" button before saving changes.',
    ],
    restrictions: [
      'System Admin actions are fully logged in the immutable Audit Trail — all changes are traceable.',
      'Cannot modify the audit trail records — they are insert-only for compliance.',
      'Role deletions for system roles (credit_officer, legal_officer, system_admin) are restricted.',
    ],
  },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PermissionBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
      <CheckCircle className="w-3 h-3 text-green-500" />
      {label}
    </span>
  );
}

function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
      <div className="flex items-center gap-2 px-5 py-3.5 border-b border-slate-100 bg-slate-50">
        <Icon className="w-4 h-4 text-slate-500" />
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function ScreenAccessRow({ item, index }: { item: ScreenAccess; index: number }) {
  const [expanded, setExpanded] = useState(false);
  const IconComp = item.icon;
  return (
    <div className={`border border-slate-200 rounded-lg overflow-hidden ${index > 0 ? 'mt-2' : ''}`}>
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-white hover:bg-slate-50 transition-colors text-left"
      >
        <IconComp className="w-4 h-4 text-slate-400 flex-shrink-0" />
        <span className="flex-1 text-sm font-medium text-slate-700">{item.screen}</span>
        <div className="flex flex-wrap gap-1 mr-2">
          {item.actions.map((a) => (
            <span key={a} className="px-1.5 py-0.5 rounded text-xs bg-slate-100 text-slate-600 font-medium">{a}</span>
          ))}
        </div>
        {item.notes && (
          expanded ? <ChevronDown className="w-4 h-4 text-slate-400 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-slate-400 flex-shrink-0" />
        )}
      </button>
      {expanded && item.notes && (
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-start gap-2">
          <Info className="w-3.5 h-3.5 text-blue-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-slate-600">{item.notes}</p>
        </div>
      )}
    </div>
  );
}

function WorkflowSteps({ steps }: { steps: WorkflowStep[] }) {
  return (
    <div className="space-y-3">
      {steps.map((step) => (
        <div key={step.step} className="flex gap-4">
          <div className="flex-shrink-0 w-7 h-7 rounded-full bg-slate-800 text-white flex items-center justify-center text-xs font-bold">
            {step.step}
          </div>
          <div className="flex-1 pb-3 border-b border-slate-100 last:border-0">
            <p className="text-sm font-semibold text-slate-800 mb-0.5">{step.title}</p>
            <p className="text-sm text-slate-600 leading-relaxed">{step.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function UserGuideContent() {
  const [activeRole, setActiveRole] = useState<RoleKey>('credit_officer');
  const [searchQuery, setSearchQuery] = useState('');

  const guide = ROLE_GUIDES.find((r) => r.key === activeRole)!;
  const RoleIcon = guide.icon;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-slate-800 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">User Guide</h1>
              <p className="text-sm text-slate-500">Role-specific workflows, screen access, and tips</p>
            </div>
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search guide…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 text-sm border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-300 w-56"
            />
          </div>
        </div>
      </div>

      <div className="flex gap-0 h-[calc(100vh-89px)]">
        {/* Role Selector Sidebar */}
        <aside className="w-56 flex-shrink-0 bg-white border-r border-slate-200 flex flex-col">
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Select Role</p>
          </div>
          <nav className="flex-1 overflow-y-auto py-2">
            {ROLE_GUIDES.map((r) => {
              const RIcon = r.icon;
              const isActive = r.key === activeRole;
              return (
                <button
                  key={r.key}
                  onClick={() => setActiveRole(r.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                    isActive
                      ? `${r.bgColor} ${r.color} border-r-2 ${r.borderColor.replace('border-', 'border-r-')}`
                      : 'text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <RIcon className={`w-4 h-4 flex-shrink-0 ${isActive ? r.color : 'text-slate-400'}`} />
                  <span className="text-sm font-medium">{r.label}</span>
                </button>
              );
            })}
          </nav>
          <div className="px-4 py-3 border-t border-slate-100 bg-slate-50">
            <p className="text-xs text-slate-400 leading-relaxed">
              Click a role to view its guide, screens, and workflows.
            </p>
          </div>
        </aside>

        {/* Guide Content */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-5 max-w-4xl">
            {/* Role Header */}
            <div className={`rounded-xl border ${guide.borderColor} ${guide.bgColor} p-5 flex items-start gap-4`}>
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${guide.bgColor} border ${guide.borderColor}`}>
                <RoleIcon className={`w-6 h-6 ${guide.color}`} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className={`text-lg font-bold ${guide.color}`}>{guide.label}</h2>
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${guide.badgeColor}`}>Role Guide</span>
                </div>
                <p className="text-sm text-slate-600 leading-relaxed">{guide.description}</p>
              </div>
            </div>

            {/* Responsibilities */}
            <SectionCard title="Key Responsibilities" icon={CheckCircle}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {guide.responsibilities
                  .filter((r) => !searchQuery || r.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((resp, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <span className="text-sm text-slate-700">{resp}</span>
                    </div>
                  ))}
              </div>
            </SectionCard>

            {/* Screen Access */}
            <SectionCard title="Screen Access & Permissions" icon={Eye}>
              <p className="text-xs text-slate-500 mb-3">Click any row to see screen-specific notes. Actions shown are what this role can perform.</p>
              <div>
                {guide.screens
                  .filter((s) => !searchQuery || s.screen.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map((item, i) => (
                    <ScreenAccessRow key={item.screen} item={item} index={i} />
                  ))}
              </div>
            </SectionCard>

            {/* Workflows */}
            <SectionCard title="Key Workflows" icon={GitBranch}>
              <WorkflowSteps steps={guide.workflows} />
            </SectionCard>

            {/* Tips */}
            <SectionCard title="Tips & Best Practices" icon={Zap}>
              <div className="space-y-2.5">
                {guide.tips.map((tip, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <Zap className="w-4 h-4 text-amber-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700">{tip}</p>
                  </div>
                ))}
              </div>
            </SectionCard>

            {/* Restrictions */}
            <SectionCard title="Restrictions & Limitations" icon={Lock}>
              <div className="space-y-2">
                {guide.restrictions.map((r, i) => (
                  <div key={i} className="flex items-start gap-2.5 p-3 rounded-lg bg-red-50 border border-red-100">
                    <AlertTriangle className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-slate-700">{r}</p>
                  </div>
                ))}
              </div>
            </SectionCard>
          </div>
        </main>
      </div>
    </div>
  );
}
