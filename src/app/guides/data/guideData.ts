import { FolderOpen, Upload, CalendarClock, GitMerge, BarChart2, Unlock, Scale, BadgeCheck, GitBranch, FileText, ShieldCheck, TrendingUp, LineChart, Target, BarChart, Users, KeyRound, Settings, SlidersHorizontal, GitPullRequest, Zap, AlertTriangle, DatabaseZap, ScrollText, Archive, Building2, Library, ClipboardCheck, Eye, LayoutDashboard, Activity, Files, MailCheck, Radio, ShieldAlert, Flame, Map, Settings2, Layers, AlarmClock, SendHorizonal, CheckSquare, RefreshCw, Inbox,  } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GuideTask {
  title: string;
  description: string;
  steps: { action: string; where: string; href: string }[];
}

export interface GuideModule {
  label: string;
  href: string;
  icon: React.ElementType;
  why: string;
}

export interface GuideTip {
  type: 'tip' | 'warning' | 'info';
  text: string;
}

export interface RoleGuide {
  role: string;
  slug: string;
  color: string;
  iconBg: string;
  bg: string;
  icon: React.ElementType;
  summary: string;
  modules: GuideModule[];
  tasks: GuideTask[];
  tips: GuideTip[];
}

// ─── Credit Officer ───────────────────────────────────────────────────────────

export const CREDIT_OFFICER_GUIDE: RoleGuide = {
  role: 'Credit Officer',
  slug: 'credit-officer',
  color: '#1D4ED8',
  iconBg: '#2563EB',
  bg: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #2563EB 100%)',
  icon: BarChart2,
  summary:
    'As a Credit Officer you are the first point of contact for every collateral asset. You register new collateral, upload supporting documents, schedule valuations, initiate substitution requests when assets change, and monitor LTV thresholds to ensure the portfolio stays within risk limits. Your work feeds directly into the legal review and approval pipeline.',
  modules: [
    { label: 'Collateral Registry', href: '/collateral-management', icon: FolderOpen, why: 'Primary screen for registering and editing all collateral records.' },
    { label: 'Collateral Dashboard', href: '/collateral-dashboard', icon: LayoutDashboard, why: 'Daily KPI overview — overdue alerts, portfolio health, and recent activity.' },
    { label: 'Collateral Documents', href: '/collateral-documents', icon: Files, why: 'Upload and manage documents attached to each collateral record.' },
    { label: 'Bulk Upload', href: '/bulk-upload', icon: Upload, why: 'Import multiple collateral records at once via CSV template.' },
    { label: 'Valuation Workflow', href: '/valuation-workflow', icon: CalendarClock, why: 'Schedule and track valuation appointments for collateral assets.' },
    { label: 'Collateral Substitution', href: '/collateral-substitution', icon: RefreshCw, why: 'Initiate requests to swap one collateral asset for another.' },
    { label: 'LTV Breach Alerts', href: '/ltv-breach-alerts', icon: AlertTriangle, why: 'Monitor assets where the loan-to-value ratio has exceeded thresholds.' },
    { label: 'Loan–Collateral Map', href: '/collateral-loan-visualization', icon: GitMerge, why: 'Visual network showing which loans are secured by which assets.' },
    { label: 'Approval Inbox', href: '/approval-inbox', icon: MailCheck, why: 'Track submissions you have sent for legal review and approval.' },
    { label: 'Alerts Inbox', href: '/alerts-inbox', icon: Inbox, why: 'Operational alerts for expiry, LTV breaches, and overdue items.' },
    { label: 'Deadline Reminders', href: '/deadline-reminders', icon: AlarmClock, why: 'Upcoming collateral expiry and perfection deadlines.' },
    { label: 'My Tasks', href: '/my-tasks', icon: CheckSquare, why: 'Tasks assigned to you across all workflows.' },
  ],
  tasks: [
    {
      title: 'Register a new collateral asset',
      description: 'Add a new asset to the registry with all required details and documents before submitting for legal review.',
      steps: [
        { action: 'Open the Collateral Registry and click "Add Collateral"', where: 'Collateral Registry', href: '/collateral-management' },
        { action: 'Fill in asset type, description, estimated value, and obligor', where: 'Collateral Registry', href: '/collateral-management' },
        { action: 'Upload the title deed, valuation certificate, and any supporting documents', where: 'Collateral Documents', href: '/collateral-documents' },
        { action: 'Save the record — it enters "Pending Review" status automatically', where: 'Collateral Registry', href: '/collateral-management' },
        { action: 'Submit for legal review via the Approval Inbox', where: 'Approval Inbox', href: '/approval-inbox' },
      ],
    },
    {
      title: 'Schedule a valuation',
      description: 'Arrange a formal valuation for an asset that is due for revaluation or has a new appointment.',
      steps: [
        { action: 'Open the Valuation Workflow and locate the asset', where: 'Valuation Workflow', href: '/valuation-workflow' },
        { action: 'Click "Schedule Valuation" and set the appointment date and valuer', where: 'Valuation Workflow', href: '/valuation-workflow' },
        { action: 'Upload the completed valuation report once received', where: 'Valuation Workflow', href: '/valuation-workflow' },
        { action: 'Submit the report for Legal Officer review', where: 'Valuation Workflow', href: '/valuation-workflow' },
        { action: 'Confirm the updated value is reflected in the collateral record', where: 'Collateral Registry', href: '/collateral-management' },
      ],
    },
    {
      title: 'Initiate a collateral substitution',
      description: 'Request to replace an existing collateral asset with a new one when the borrower provides a substitute.',
      steps: [
        { action: 'Open Collateral Substitution and click "New Request"', where: 'Collateral Substitution', href: '/collateral-substitution' },
        { action: 'Select the existing collateral to be released', where: 'Collateral Substitution', href: '/collateral-substitution' },
        { action: 'Select or register the replacement asset', where: 'Collateral Substitution', href: '/collateral-substitution' },
        { action: 'Provide justification and upload supporting documents', where: 'Collateral Substitution', href: '/collateral-substitution' },
        { action: 'Submit for manager approval — track status in the drawer', where: 'Collateral Substitution', href: '/collateral-substitution' },
      ],
    },
    {
      title: 'Handle an LTV breach alert',
      description: 'Respond to an alert where a collateral asset\'s loan-to-value ratio has exceeded the configured threshold.',
      steps: [
        { action: 'Open LTV Breach Alerts and identify the flagged asset', where: 'LTV Breach Alerts', href: '/ltv-breach-alerts' },
        { action: 'Review the current valuation and outstanding loan balance', where: 'Collateral Registry', href: '/collateral-management' },
        { action: 'Schedule a fresh valuation or request a top-up collateral', where: 'Valuation Workflow', href: '/valuation-workflow' },
        { action: 'Document the remediation action in the collateral record notes', where: 'Collateral Registry', href: '/collateral-management' },
        { action: 'Confirm the alert clears once the LTV is back within limits', where: 'LTV Breach Alerts', href: '/ltv-breach-alerts' },
      ],
    },
    {
      title: 'Import multiple collateral records',
      description: 'Use the bulk upload tool to import a batch of collateral records from a CSV file.',
      steps: [
        { action: 'Open Bulk Upload and download the CSV template', where: 'Bulk Upload', href: '/bulk-upload' },
        { action: 'Fill in all required fields for each asset in the spreadsheet', where: 'Bulk Upload', href: '/bulk-upload' },
        { action: 'Upload the completed CSV and review the import preview', where: 'Bulk Upload', href: '/bulk-upload' },
        { action: 'Fix any validation errors flagged in the preview', where: 'Bulk Upload', href: '/bulk-upload' },
        { action: 'Confirm the import — records appear in the Collateral Registry', where: 'Collateral Registry', href: '/collateral-management' },
      ],
    },
  ],
  tips: [
    { type: 'tip', text: 'Always upload the title deed before submitting for legal review — missing documents are the most common reason for rejection.' },
    { type: 'warning', text: 'LTV breach alerts auto-escalate to your manager after 24 hours if unacknowledged. Respond promptly.' },
    { type: 'tip', text: 'Use the Loan–Collateral Map to quickly verify which loans are secured by an asset before initiating a substitution.' },
    { type: 'info', text: 'Valuation reports must be dated within 6 months for the system to accept them as current. Older reports trigger a revaluation flag.' },
    { type: 'warning', text: 'Bulk uploads do not auto-submit for review. You must manually submit each imported record from the registry.' },
  ],
};

// ─── Legal Officer ────────────────────────────────────────────────────────────

export const LEGAL_OFFICER_GUIDE: RoleGuide = {
  role: 'Legal Officer',
  slug: 'legal-officer',
  color: '#7C3AED',
  iconBg: '#7C3AED',
  bg: 'linear-gradient(135deg, #4C1D95 0%, #6D28D9 60%, #7C3AED 100%)',
  icon: Scale,
  summary:
    'As a Legal Officer you own the legal lifecycle of every collateral asset. You review and approve perfection submissions, sign off on documents, track covenant compliance, authorise collateral releases, and manage the physical archive. Your approvals are the legal gate that protects the institution\'s security interest in every asset.',
  modules: [
    { label: 'Perfection Workflow', href: '/perfection-workflow', icon: GitBranch, why: 'Review and approve or return perfection submissions from Credit Officers.' },
    { label: 'Document Approval', href: '/document-approval', icon: BadgeCheck, why: 'Sign off on documents attached to collateral records.' },
    { label: 'Release Approval', href: '/release-approval', icon: Unlock, why: 'Authorise the release of perfected collateral back to the borrower.' },
    { label: 'Covenant Tracking', href: '/covenant-tracking', icon: FileText, why: 'Monitor and record covenant compliance for all active facilities.' },
    { label: 'Approval Inbox', href: '/approval-inbox', icon: MailCheck, why: 'Unified inbox for all items awaiting your legal sign-off.' },
    { label: 'Collateral Documents', href: '/collateral-documents', icon: Files, why: 'Review documents and manage the Security Pocket for each asset.' },
    { label: 'Archive — Vault Management', href: '/archive/vault-management', icon: Building2, why: 'Manage physical vault locations and document placements.' },
    { label: 'Archive — Custody Tracker', href: '/archive/custody-tracker', icon: Eye, why: 'Track the physical custody status of every original document.' },
    { label: 'Archive — Request Workflow', href: '/archive/request-workflow', icon: ClipboardCheck, why: 'Handle requests to retrieve or loan out archived documents.' },
    { label: 'AI Fraud Prevention', href: '/fraud-prevention', icon: ShieldAlert, why: 'Review AI fraud flags on collateral submissions before approving.' },
    { label: 'Obligors', href: '/obligors', icon: Users, why: 'Review borrower risk profiles when assessing perfection submissions.' },
    { label: 'My Tasks', href: '/my-tasks', icon: CheckSquare, why: 'Tasks assigned to you across all workflows.' },
  ],
  tasks: [
    {
      title: 'Process a perfection submission',
      description: 'Review a collateral perfection submission from a Credit Officer and make an approval decision.',
      steps: [
        { action: 'Open the Approval Inbox and locate the pending perfection item', where: 'Approval Inbox', href: '/approval-inbox' },
        { action: 'Open the submission in the Perfection Workflow drawer', where: 'Perfection Workflow', href: '/perfection-workflow' },
        { action: 'Review all attached documents and check AI fraud flags', where: 'AI Fraud Prevention', href: '/fraud-prevention' },
        { action: 'Check the obligor risk profile for any red flags', where: 'Obligors', href: '/obligors' },
        { action: 'Approve, return with notes, or escalate to your manager', where: 'Perfection Workflow', href: '/perfection-workflow' },
      ],
    },
    {
      title: 'Sign off on a document submission',
      description: 'Review and approve a document that has been submitted for legal sign-off.',
      steps: [
        { action: 'Open Document Approval and find the pending submission', where: 'Document Approval', href: '/document-approval' },
        { action: 'Open the document in the review drawer and read the content', where: 'Document Approval', href: '/document-approval' },
        { action: 'Verify the document matches the collateral record details', where: 'Collateral Documents', href: '/collateral-documents' },
        { action: 'Approve or return with a reason — the submitter is notified automatically', where: 'Document Approval', href: '/document-approval' },
      ],
    },
    {
      title: 'Authorise a collateral release',
      description: 'Review and approve a request to release perfected collateral back to the borrower.',
      steps: [
        { action: 'Open Release Approval and locate the pending release request', where: 'Release Approval', href: '/release-approval' },
        { action: 'Verify the loan has been fully repaid or the release is justified', where: 'Release Approval', href: '/release-approval' },
        { action: 'Check the collateral record and confirm no outstanding obligations', where: 'Collateral Registry', href: '/collateral-management' },
        { action: 'Approve the release — the system updates the collateral status automatically', where: 'Release Approval', href: '/release-approval' },
        { action: 'Arrange physical document return via the Archive Request Workflow', where: 'Archive — Request Workflow', href: '/archive/request-workflow' },
      ],
    },
    {
      title: 'Record a covenant compliance check',
      description: 'Log the outcome of a covenant compliance review for an active facility.',
      steps: [
        { action: 'Open Covenant Tracking and locate the relevant facility', where: 'Covenant Tracking', href: '/covenant-tracking' },
        { action: 'Review the covenant conditions and the borrower\'s submitted evidence', where: 'Covenant Tracking', href: '/covenant-tracking' },
        { action: 'Mark each covenant as Compliant, Breached, or Waived with notes', where: 'Covenant Tracking', href: '/covenant-tracking' },
        { action: 'If breached, escalate to your manager and log the breach event', where: 'Covenant Tracking', href: '/covenant-tracking' },
      ],
    },
    {
      title: 'Place a document in the vault',
      description: 'Record the physical placement of an original collateral document in the archive vault.',
      steps: [
        { action: 'Open Vault Management and select the target vault location', where: 'Archive — Vault Management', href: '/archive/vault-management' },
        { action: 'Record the document placement with shelf and slot details', where: 'Archive — Vault Management', href: '/archive/vault-management' },
        { action: 'Update the custody status in the Custody Tracker', where: 'Archive — Custody Tracker', href: '/archive/custody-tracker' },
        { action: 'Verify the document appears in the Documents Library', where: 'Archive — Documents Library', href: '/archive/documents-library' },
      ],
    },
  ],
  tips: [
    { type: 'tip', text: 'Always check the AI Fraud Prevention flags before approving a perfection submission — flagged items require documented justification.' },
    { type: 'warning', text: 'Perfection submissions older than 5 business days without action are automatically escalated to your manager.' },
    { type: 'tip', text: 'Use the countdown badge in the workflow drawer to prioritise items closest to their SLA deadline.' },
    { type: 'info', text: 'Covenant breaches must be escalated within 24 hours per regulatory requirements. The system logs the timestamp of your action.' },
    { type: 'warning', text: 'Never approve a release without verifying the loan closure in the Loans module — partial repayments do not qualify.' },
  ],
};

// ─── Legal / Credit Manager ───────────────────────────────────────────────────

export const MANAGER_GUIDE: RoleGuide = {
  role: 'Legal / Credit Manager',
  slug: 'manager',
  color: '#065F46',
  iconBg: '#059669',
  bg: 'linear-gradient(135deg, #064E3B 0%, #065F46 60%, #047857 100%)',
  icon: ShieldCheck,
  summary:
    'As a Legal/Credit Manager you oversee the full approval pipeline across both legal and credit functions. You handle escalations from officers, reassign tasks, monitor workflow SLAs, run portfolio-level analytics, and generate regulatory reports. You are the final decision-maker on escalated items and the primary point of accountability for portfolio governance.',
  modules: [
    { label: 'Executive Dashboard', href: '/executive-dashboard', icon: TrendingUp, why: 'C-suite KPIs, trend charts, and portfolio performance at a glance.' },
    { label: 'Portfolio Monitoring', href: '/portfolio-monitoring', icon: Activity, why: 'Live portfolio health trends and concentration breakdown by collateral type.' },
    { label: 'Workflows Dashboard', href: '/workflows', icon: GitPullRequest, why: 'Overview of all active workflow instances and their current status.' },
    { label: 'Workflow Instances', href: '/workflows/instances', icon: Layers, why: 'Drill into individual workflow instances, reassign tasks, and track SLAs.' },
    { label: 'Approval Inbox', href: '/approval-inbox', icon: MailCheck, why: 'Escalated items and approvals that require manager-level sign-off.' },
    { label: 'Release Approval', href: '/release-approval', icon: Unlock, why: 'Final authorisation for collateral releases escalated from Legal Officers.' },
    { label: 'Cohort Analytics', href: '/cohort-analytics', icon: LineChart, why: 'Segment and compare collateral cohorts for portfolio analysis.' },
    { label: 'Portfolio Heatmap', href: '/portfolio-heatmap', icon: Flame, why: 'Visual heatmap of portfolio concentration and geographic risk density.' },
    { label: 'Reports Hub', href: '/reports', icon: BarChart, why: 'Regulatory, utilisation, and collateral reports for board and regulator submissions.' },
    { label: 'Custom Reports', href: '/custom-reports', icon: ScrollText, why: 'Build and save custom report templates with your own filters.' },
    { label: 'Compliance Audit', href: '/compliance-audit', icon: ShieldCheck, why: 'Run compliance audits against active rules and review findings.' },
    { label: 'Audit Center', href: '/audit-center', icon: DatabaseZap, why: 'Searchable audit database for regulatory reviews and internal investigations.' },
    { label: 'Deadline Predictions', href: '/deadline-predictions', icon: Target, why: 'AI-predicted expiry and perfection deadlines based on historical patterns.' },
    { label: 'Covenant Tracking', href: '/covenant-tracking', icon: FileText, why: 'Monitor covenant compliance across all active facilities.' },
    { label: 'Workflows Admin', href: '/workflows-admin', icon: Settings2, why: 'Manage workflow templates, escalation rules, and KPI thresholds.' },
  ],
  tasks: [
    {
      title: 'Handle an escalated workflow item',
      description: 'Review and resolve an item that has been escalated from a Legal or Credit Officer.',
      steps: [
        { action: 'Open the Approval Inbox and filter by "Escalated" status', where: 'Approval Inbox', href: '/approval-inbox' },
        { action: 'Open the escalated item in the workflow drawer', where: 'Approval Inbox', href: '/approval-inbox' },
        { action: 'Review the escalation reason and the officer\'s notes', where: 'Approval Inbox', href: '/approval-inbox' },
        { action: 'Make the approval decision or reassign to another officer', where: 'Workflow Instances', href: '/workflows/instances' },
        { action: 'Document your decision rationale in the notes field', where: 'Approval Inbox', href: '/approval-inbox' },
      ],
    },
    {
      title: 'Reassign a stalled workflow task',
      description: 'Reassign a task that has been sitting with an officer past its SLA deadline.',
      steps: [
        { action: 'Open Workflow Instances and filter by "Overdue" status', where: 'Workflow Instances', href: '/workflows/instances' },
        { action: 'Identify the stalled task and open its detail view', where: 'Workflow Instances', href: '/workflows/instances' },
        { action: 'Click "Reassign" and select the new assignee', where: 'Workflow Instances', href: '/workflows/instances' },
        { action: 'Add a note explaining the reassignment reason', where: 'Workflow Instances', href: '/workflows/instances' },
        { action: 'Confirm — the new assignee receives an automatic notification', where: 'Workflow Instances', href: '/workflows/instances' },
      ],
    },
    {
      title: 'Run a monthly portfolio review',
      description: 'Conduct the monthly portfolio health review using analytics and reporting tools.',
      steps: [
        { action: 'Open the Executive Dashboard for top-level KPIs and trends', where: 'Executive Dashboard', href: '/executive-dashboard' },
        { action: 'Review the Portfolio Heatmap for concentration and geographic risk', where: 'Portfolio Heatmap', href: '/portfolio-heatmap' },
        { action: 'Run Cohort Analytics to compare segment performance', where: 'Cohort Analytics', href: '/cohort-analytics' },
        { action: 'Check Deadline Predictions for upcoming high-risk expirations', where: 'Deadline Predictions', href: '/deadline-predictions' },
        { action: 'Generate and export the monthly report for board submission', where: 'Reports Hub', href: '/reports' },
      ],
    },
    {
      title: 'Generate a regulatory report',
      description: 'Produce a formal regulatory compliance report for submission to the regulator.',
      steps: [
        { action: 'Open Reports Hub and select the Regulatory tab', where: 'Reports Hub', href: '/reports' },
        { action: 'Set the reporting period and apply required filters', where: 'Reports Hub', href: '/reports' },
        { action: 'Preview the report and verify data accuracy', where: 'Reports Hub', href: '/reports' },
        { action: 'Run a Compliance Audit to confirm rule adherence', where: 'Compliance Audit', href: '/compliance-audit' },
        { action: 'Export as PDF and submit via the regulatory channel', where: 'Reports Hub', href: '/reports' },
      ],
    },
    {
      title: 'Configure workflow escalation rules',
      description: 'Update the escalation conditions that determine when workflow items are automatically escalated.',
      steps: [
        { action: 'Open Workflows Admin and navigate to Escalation Config', where: 'Workflows Admin', href: '/workflows-admin/escalation' },
        { action: 'Review existing escalation conditions and SLA thresholds', where: 'Workflows Admin', href: '/workflows-admin/escalation' },
        { action: 'Add or edit conditions — set hours-to-escalate and target role', where: 'Workflows Admin', href: '/workflows-admin/escalation' },
        { action: 'Save and test the rule using the Trigger Processor', where: 'Workflows Admin', href: '/workflows-admin/trigger-processor' },
      ],
    },
  ],
  tips: [
    { type: 'tip', text: 'The Workflow Instances screen shows a live countdown for every open item — sort by "Time Remaining" to prioritise your day.' },
    { type: 'warning', text: 'Escalated items that remain unresolved for 48 hours are flagged in the Executive Dashboard as SLA breaches.' },
    { type: 'tip', text: 'Use Cohort Analytics to identify which collateral types are generating the most workflow delays — a leading indicator of process risk.' },
    { type: 'info', text: 'Regulatory reports must be generated from the Reports Hub, not exported from individual screens — only the hub applies the correct regulatory formatting.' },
    { type: 'tip', text: 'The Deadline Predictions screen uses AI to surface assets likely to breach their perfection deadline in the next 30 days — review it weekly.' },
  ],
};

// ─── System Admin ─────────────────────────────────────────────────────────────

export const SYSTEM_ADMIN_GUIDE: RoleGuide = {
  role: 'System Admin',
  slug: 'system-admin',
  color: '#374151',
  iconBg: '#4B5563',
  bg: 'linear-gradient(135deg, #111827 0%, #1F2937 60%, #374151 100%)',
  icon: Settings2,
  summary:
    'As a System Admin you control the entire CollateralMS platform. You manage user accounts and role assignments, configure workflow templates and trigger rules, set alert thresholds, manage system settings, and run the migration tool for data operations. You are the only role with access to all modules — use this power carefully and always test configuration changes before applying them to production.',
  modules: [
    { label: 'User Management', href: '/user-management', icon: Users, why: 'Create, edit, and deactivate user accounts. Manage screen access per user.' },
    { label: 'Officer Permissions', href: '/officer-permissions', icon: KeyRound, why: 'Fine-grained permission matrix — control exactly what each officer can do.' },
    { label: 'Workflows Admin', href: '/workflows-admin', icon: Settings2, why: 'Central hub for all workflow engine configuration.' },
    { label: 'Workflow Templates', href: '/workflows-admin/templates', icon: GitPullRequest, why: 'Create and edit workflow templates that define approval stages.' },
    { label: 'Trigger Rules', href: '/workflows-admin/trigger-rules', icon: Zap, why: 'Configure the rules that automatically launch workflows on events.' },
    { label: 'Trigger Processor', href: '/workflows-admin/trigger-processor', icon: Radio, why: 'Manually run the trigger processor to test and debug rule execution.' },
    { label: 'Escalation Config', href: '/workflows-admin/escalation', icon: AlertTriangle, why: 'Set the conditions and SLA thresholds that trigger automatic escalations.' },
    { label: 'Migration Tool', href: '/workflows-admin/migration', icon: DatabaseZap, why: 'Run data migration operations and manage the migration queue.' },
    { label: 'Workflow KPIs', href: '/workflows-admin/kpis', icon: BarChart, why: 'Monitor workflow performance metrics and SLA compliance rates.' },
    { label: 'System Settings', href: '/settings', icon: Settings, why: 'Configure email providers, document types, notification preferences, and registries.' },
    { label: 'Alert Thresholds', href: '/alert-thresholds', icon: SlidersHorizontal, why: 'Set numeric thresholds that trigger automated alerts (e.g. LTV > 80%).' },
    { label: 'System Config', href: '/system-config', icon: Settings2, why: 'Advanced configuration — brand kit, feature flags, and integrations.' },
    { label: 'SMS Notification Rules', href: '/sms-notification-rules', icon: SendHorizonal, why: 'Configure which events trigger SMS alerts and to which roles.' },
    { label: 'Scheduled Jobs', href: '/scheduled-jobs', icon: CalendarClock, why: 'Monitor automated background tasks and their execution status.' },
    { label: 'Audit Center', href: '/audit-center', icon: DatabaseZap, why: 'Full audit database — review any user action across the entire system.' },
    { label: 'Live Activity', href: '/live-activity', icon: Activity, why: 'Real-time feed of all user actions — auto-refreshes every 30 seconds.' },
  ],
  tasks: [
    {
      title: 'Onboard a new user',
      description: 'Create a new user account, assign their role, and configure their screen access.',
      steps: [
        { action: 'Open User Management and click "Add User"', where: 'User Management', href: '/user-management' },
        { action: 'Enter the user\'s name, email, and assign their role', where: 'User Management', href: '/user-management' },
        { action: 'Set their screen access permissions in the Screen Access tab', where: 'User Management', href: '/user-management' },
        { action: 'Configure fine-grained permissions in Officer Permissions', where: 'Officer Permissions', href: '/officer-permissions' },
        { action: 'The user receives login credentials via email automatically', where: 'System Settings', href: '/settings' },
      ],
    },
    {
      title: 'Create a new workflow template',
      description: 'Define a new workflow template that specifies the approval stages for a process.',
      steps: [
        { action: 'Open Workflows Admin and navigate to Templates', where: 'Workflow Templates', href: '/workflows-admin/templates' },
        { action: 'Click "New Template" and define the workflow name and type', where: 'Workflow Templates', href: '/workflows-admin/templates' },
        { action: 'Add stages — specify the role responsible for each stage', where: 'Workflow Templates', href: '/workflows-admin/templates' },
        { action: 'Set SLA hours for each stage and configure escalation conditions', where: 'Escalation Config', href: '/workflows-admin/escalation' },
        { action: 'Save and activate the template — it is now available for trigger rules', where: 'Workflow Templates', href: '/workflows-admin/templates' },
      ],
    },
    {
      title: 'Configure a workflow trigger rule',
      description: 'Set up a rule that automatically launches a workflow when a specific event occurs.',
      steps: [
        { action: 'Open Trigger Rules and click "New Rule"', where: 'Trigger Rules', href: '/workflows-admin/trigger-rules' },
        { action: 'Select the trigger event (e.g. "Collateral Registered", "LTV Breached")', where: 'Trigger Rules', href: '/workflows-admin/trigger-rules' },
        { action: 'Select the workflow template to launch on this event', where: 'Trigger Rules', href: '/workflows-admin/trigger-rules' },
        { action: 'Set any conditions (e.g. only for collateral type = "Land")', where: 'Trigger Rules', href: '/workflows-admin/trigger-rules' },
        { action: 'Test the rule using the Trigger Processor before activating', where: 'Trigger Processor', href: '/workflows-admin/trigger-processor' },
      ],
    },
    {
      title: 'Set alert thresholds',
      description: 'Configure the numeric thresholds that trigger automated alerts across the system.',
      steps: [
        { action: 'Open Alert Thresholds and review existing threshold configurations', where: 'Alert Thresholds', href: '/alert-thresholds' },
        { action: 'Click "Edit" on the threshold you want to change (e.g. LTV limit)', where: 'Alert Thresholds', href: '/alert-thresholds' },
        { action: 'Update the threshold value and the alert severity level', where: 'Alert Thresholds', href: '/alert-thresholds' },
        { action: 'Save — the new threshold applies to all future evaluations immediately', where: 'Alert Thresholds', href: '/alert-thresholds' },
        { action: 'Verify the change is logged in the Audit Center', where: 'Audit Center', href: '/audit-center' },
      ],
    },
    {
      title: 'Run the migration tool',
      description: 'Execute a data migration operation to move or transform records in the system.',
      steps: [
        { action: 'Open the Migration Tool and review the migration queue', where: 'Migration Tool', href: '/workflows-admin/migration' },
        { action: 'Select the migration operation and review the affected records', where: 'Migration Tool', href: '/workflows-admin/migration' },
        { action: 'Run a dry-run first to preview changes without applying them', where: 'Migration Tool', href: '/workflows-admin/migration' },
        { action: 'Review the dry-run output for errors or unexpected changes', where: 'Migration Tool', href: '/workflows-admin/migration' },
        { action: 'Execute the migration and verify results in the Audit Center', where: 'Audit Center', href: '/audit-center' },
      ],
    },
  ],
  tips: [
    { type: 'warning', text: 'Always run a dry-run before executing any migration operation — migrations cannot be automatically reversed.' },
    { type: 'tip', text: 'Test new trigger rules in the Trigger Processor before activating them — a misconfigured rule can flood users with unwanted workflow instances.' },
    { type: 'warning', text: 'Deactivating a user does not cancel their open workflow tasks — reassign their tasks first via Workflow Instances.' },
    { type: 'info', text: 'All admin actions are logged in the Audit Center with your user ID and timestamp — there is no "undo" for configuration changes.' },
    { type: 'tip', text: 'Use the Live Activity stream to monitor the system in real time after deploying configuration changes — watch for unexpected errors.' },
    { type: 'warning', text: 'Changing alert thresholds takes effect immediately for all future evaluations. Notify affected officers before lowering thresholds significantly.' },
  ],
};

// ─── Role → Guide mapping ─────────────────────────────────────────────────────

export const ROLE_GUIDE_MAP: Record<string, string> = {
  credit_officer: '/guides/credit-officer',
  legal_officer: '/guides/legal-officer',
  legal_credit_manager: '/guides/manager',
  manager: '/guides/manager',
  system_admin: '/guides/system-admin',
};

export function getRoleGuideHref(role: string | null | undefined): string {
  if (!role) return '/guides';
  return ROLE_GUIDE_MAP[role] ?? '/guides';
}
