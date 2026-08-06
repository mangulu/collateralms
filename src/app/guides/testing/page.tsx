'use client';
import React, { useState } from 'react';
import AppLayout from '@/components/AppLayout';
import Link from 'next/link';
import { ArrowLeft, CheckSquare, ChevronDown, AlertTriangle, Info, Lightbulb, ClipboardList, FlaskConical, Database, Eye, User, ShieldCheck, ArrowRight, CheckCircle2, Circle, BookOpen,  } from 'lucide-react';



// ─── Types ────────────────────────────────────────────────────────────────────

interface TestStep {
  step: number;
  action: string;
  where: string;
  href: string;
  expect: string;
}

interface TestPhase {
  id: string;
  title: string;
  description: string;
  steps: TestStep[];
}

interface ChecklistItem {
  label: string;
  href: string;
}

interface ModuleChecklist {
  module: string;
  color: string;
  items: ChecklistItem[];
}

interface TestDataEntry {
  label: string;
  value: string;
  note?: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const PREREQUISITES = [
  {
    category: 'Test Accounts',
    icon: User,
    color: '#1D4ED8',
    items: [
      { label: 'Credit Officer account', detail: 'Role: credit_officer — used for collateral intake, valuation, and substitution steps' },
      { label: 'Legal Officer account', detail: 'Role: legal_officer — used for perfection review, document sign-off, and release approval' },
      { label: 'Manager account', detail: 'Role: manager — used for escalation handling, portfolio review, and final approvals' },
      { label: 'System Admin account', detail: 'Role: system_admin — used for user setup, workflow config, and admin tasks' },
    ],
  },
  {
    category: 'Environment Checklist',
    icon: ShieldCheck,
    color: '#059669',
    items: [
      { label: 'Supabase connection active', detail: 'Verify NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in .env' },
      { label: 'OpenAI API key configured', detail: 'Required for AI Risk Assessment, Fraud Prevention, and AI narrative features' },
      { label: 'Seeded collateral records present', detail: 'Run seed migrations or verify at least 5 collateral records exist in collateral_records table' },
      { label: 'At least one obligor record', detail: 'Required to link collateral to a borrower during registration' },
      { label: 'Workflow templates configured', detail: 'At least one active Perfection workflow template must exist in Workflows Admin → Templates' },
    ],
  },
  {
    category: 'What to Have Open',
    icon: Eye,
    color: '#7C3AED',
    items: [
      { label: 'Two browser windows or profiles', detail: 'Log in as Credit Officer in one, Legal Officer in the other — to test handoffs in real time' },
      { label: 'Supabase Table Editor (optional)', detail: 'Useful to confirm DB writes after each step — check collateral_records, workflow_instances, audit_logs' },
      { label: 'This guide open in a third tab', detail: 'Keep the checklist visible while you work through the flow' },
    ],
  },
];

const TEST_PHASES: TestPhase[] = [
  {
    id: 'phase-1',
    title: 'Phase 1 — Obligor & Collateral Registration',
    description: 'Create the borrower profile and register the first collateral asset. This is the entry point for the entire lifecycle.',
    steps: [
      { step: 1, action: 'Log in as Credit Officer', where: 'Sign In', href: '/sign-up-login-screen', expect: 'Redirected to Collateral Dashboard. KPI cards load without errors.' },
      { step: 2, action: 'Navigate to Obligors and create a new obligor', where: 'Obligors', href: '/obligors', expect: 'Obligor saved to DB. Appears in the obligors list with status "Active".' },
      { step: 3, action: 'Open Collateral Registry and click "Add Collateral"', where: 'Collateral Registry', href: '/collateral-management', expect: 'Add/Edit modal opens. Obligor picker shows the obligor just created.' },
      { step: 4, action: 'Fill in asset type, description, estimated value, and link to the obligor', where: 'Collateral Registry', href: '/collateral-management', expect: 'Form validates without errors. All required fields accept input.' },
      { step: 5, action: 'Upload a title deed document and save the record', where: 'Collateral Documents', href: '/collateral-documents', expect: 'Record saved with status "Pending Review". Document appears in the Security Pocket.' },
      { step: 6, action: 'Verify the new record appears in the Collateral Dashboard KPIs', where: 'Collateral Dashboard', href: '/collateral-dashboard', expect: 'Total Collateral count increments by 1. Recent Activity feed shows the new record.' },
      { step: 7, action: 'Switch to the Portfolio Monitoring tab on the Collateral Dashboard', where: 'Collateral Dashboard', href: '/collateral-dashboard', expect: 'Portfolio Monitoring tab loads with daily volume chart and concentration breakdown by collateral type.' },
    ],
  },
  {
    id: 'phase-2',
    title: 'Phase 2 — Loan Linking',
    description: 'Create a loan facility and link the registered collateral to it.',
    steps: [
      { step: 1, action: 'Open Loan Registry and create a new loan facility', where: 'Loan Registry', href: '/loan-registry', expect: 'Loan saved. Appears in the loans list with status "Active".' },
      { step: 2, action: 'Open the loan detail and navigate to Linked Collaterals', where: 'Loan Registry', href: '/loan-registry', expect: 'Linked Collaterals panel loads without column errors.' },
      { step: 3, action: 'Link the collateral registered in Phase 1 to this loan', where: 'Loan Registry', href: '/loan-registry', expect: 'Collateral appears in the Linked Collaterals panel. LTV is calculated and displayed.' },
      { step: 4, action: 'Open the Collateral–Loan Visualization to verify the link', where: 'Collateral–Loan Map', href: '/collateral-loan-visualization', expect: 'Network graph shows the loan node connected to the collateral node.' },
    ],
  },
  {
    id: 'phase-3',
    title: 'Phase 3 — Perfection Workflow',
    description: 'Initiate the perfection workflow as Credit Officer and process it as Legal Officer.',
    steps: [
      { step: 1, action: 'As Credit Officer, open the collateral record and click "Initiate Perfection"', where: 'Collateral Registry', href: '/collateral-management', expect: 'Workflow instance created. Status changes to "Perfection In Progress".' },
      { step: 2, action: 'Switch to Legal Officer account. Open Approval Inbox', where: 'Approval Inbox', href: '/approval-inbox', expect: 'Perfection submission appears in the inbox with correct collateral details.' },
      { step: 3, action: 'Open the submission in the Perfection Workflow drawer', where: 'Perfection Workflow', href: '/perfection-workflow', expect: 'Drawer shows all documents, obligor details, and AI fraud flag status.' },
      { step: 4, action: 'Open AI Risk & Fraud and check both the Fraud Prevention and Risk Assessment tabs', where: 'AI Risk & Fraud', href: '/ai-risk-fraud', expect: 'Both tabs load. Fraud scan and risk scores are displayed for the test collateral — not a blank screen.' },
      { step: 5, action: 'Approve the perfection submission', where: 'Perfection Workflow', href: '/perfection-workflow', expect: 'Status updates to "Perfected". Credit Officer receives a notification. Audit log entry created.' },
      { step: 6, action: 'Verify the collateral status in the registry', where: 'Collateral Registry', href: '/collateral-management', expect: 'Collateral status shows "Perfected". Perfection date is recorded.' },
    ],
  },
  {
    id: 'phase-4',
    title: 'Phase 4 — Registry Submission',
    description: 'Submit a registry filing for the perfected collateral and track its status.',
    steps: [
      { step: 1, action: 'As Credit Officer, open Registry Submissions and click "New Submission"', where: 'Registry Submissions', href: '/workflows/registry-submissions', expect: 'New submission form opens. Collateral picker shows the perfected collateral.' },
      { step: 2, action: 'Select the collateral, choose the target registry, and upload the filing document', where: 'Registry Submissions', href: '/workflows/registry-submissions', expect: 'Document uploads successfully. Submission is saved with status "Pending".' },
      { step: 3, action: 'As Legal Officer, open Registry Submissions and review the pending submission', where: 'Registry Submissions', href: '/workflows/registry-submissions', expect: 'Submission appears in the list. Filing documents are accessible.' },
      { step: 4, action: 'Update the submission status to "Submitted" and add a reference number', where: 'Registry Submissions', href: '/workflows/registry-submissions', expect: 'Status updates to "Submitted". Reference number is saved and visible in the list.' },
      { step: 5, action: 'Mark the submission as "Registered" once the registry confirms', where: 'Registry Submissions', href: '/workflows/registry-submissions', expect: 'Status updates to "Registered". The collateral record reflects the registry confirmation.' },
    ],
  },
  {
    id: 'phase-5',
    title: 'Phase 5 — Valuation Workflow',
    description: 'Schedule a valuation, upload the report, and get it signed off.',
    steps: [
      { step: 1, action: 'As Credit Officer, open Valuation Workflow and schedule a valuation', where: 'Valuation Workflow', href: '/valuation-workflow', expect: 'Valuation appointment created. Status shows "Scheduled".' },
      { step: 2, action: 'Upload a valuation report document', where: 'Valuation Workflow', href: '/valuation-workflow', expect: 'Document uploads successfully. Status changes to "Report Submitted".' },
      { step: 3, action: 'As Legal Officer, open Document Approval and find the valuation report', where: 'Document Approval', href: '/document-approval', expect: 'Report appears in the pending approvals list.' },
      { step: 4, action: 'Approve the valuation report', where: 'Document Approval', href: '/document-approval', expect: 'Status updates to "Approved". Collateral record reflects the new valuation value.' },
      { step: 5, action: 'Verify the updated value appears in the collateral record', where: 'Collateral Registry', href: '/collateral-management', expect: 'Estimated value updated. Valuation history timeline shows the new entry.' },
    ],
  },
  {
    id: 'phase-6',
    title: 'Phase 6 — Archive Vault',
    description: 'File the original collateral documents in the physical archive vault.',
    steps: [
      { step: 1, action: 'As Legal Officer, open Vault Management and select a vault location', where: 'Archive — Vault Management', href: '/archive/vault-management', expect: 'Vault slots are displayed. Available slots are shown in green.' },
      { step: 2, action: 'Record the placement of the title deed in a vault slot', where: 'Archive — Vault Management', href: '/archive/vault-management', expect: 'Slot status changes to "Occupied". Document is linked to the slot.' },
      { step: 3, action: 'Update the custody status in the Archive Custody screen', where: 'Archive — Custody', href: '/archive/custody', expect: 'Custody record shows "In Vault" with the correct slot reference.' },
      { step: 4, action: 'Raise an access request to retrieve the document', where: 'Archive — Access Requests', href: '/archive/access-requests', expect: 'Access request created with status "Pending Approval".' },
      { step: 5, action: 'As Manager, approve the access request', where: 'Archive — Access Requests', href: '/archive/access-requests', expect: 'Request status changes to "Approved". Requestor is notified.' },
    ],
  },
  {
    id: 'phase-7',
    title: 'Phase 7 — Release Approval',
    description: 'Trigger the collateral release workflow after loan repayment.',
    steps: [
      { step: 1, action: 'As Credit Officer, open the collateral record and initiate a release request', where: 'Collateral Registry', href: '/collateral-management', expect: 'Release request created. Status changes to "Release Pending".' },
      { step: 2, action: 'As Legal Officer, open Release Approvals and find the request', where: 'Release Approvals', href: '/release-approval', expect: 'Release request appears with loan details and collateral summary.' },
      { step: 3, action: 'Verify the loan is fully repaid in the Loan Registry', where: 'Loan Registry', href: '/loan-registry', expect: 'Loan status shows "Closed" or outstanding balance is zero.' },
      { step: 4, action: 'Approve the release', where: 'Release Approvals', href: '/release-approval', expect: 'Collateral status updates to "Released". Audit log entry created.' },
      { step: 5, action: 'Trigger the Post-Settlement Workflow', where: 'Post-Settlement Workflow', href: '/post-settlement-workflow', expect: 'Post-settlement tasks are created and assigned to the relevant officers.' },
    ],
  },
  {
    id: 'phase-8',
    title: 'Phase 8 — Analytics & Intelligence Module',
    description: 'Verify the AI and analytics features are working correctly.',
    steps: [
      { step: 1, action: 'Open Executive Dashboard and verify KPI cards load live data', where: 'Executive Dashboard', href: '/executive-dashboard', expect: 'All KPI cards show non-zero values. Trend chart renders with real data points.' },
      { step: 2, action: 'Open Deadline Predictions and verify AI risk scores', where: 'Deadline Predictions', href: '/deadline-predictions', expect: 'Collateral records are scored and sorted by risk. No "undefined" values.' },
      { step: 3, action: 'Open AI Risk & Fraud — test the Risk Assessment tab', where: 'AI Risk & Fraud', href: '/ai-risk-fraud', expect: 'OpenAI returns a risk score. Results display in the UI within 10 seconds.' },
      { step: 4, action: 'Switch to the Fraud Prevention tab and trigger a fraud scan', where: 'AI Risk & Fraud', href: '/ai-risk-fraud', expect: 'Scan completes. Alerts (or "No flags") are displayed and persisted to Supabase.' },
      { step: 5, action: 'Open Cohort Analytics — verify charts render on the main tab', where: 'Cohort Analytics', href: '/cohort-analytics', expect: 'Perfection trend chart and officer leaderboard load. No blank charts.' },
      { step: 6, action: 'Switch to the Portfolio Heatmap tab inside Cohort Analytics', where: 'Cohort Analytics', href: '/cohort-analytics', expect: 'Heatmap tab renders. If "Sample Data" badge is visible, fewer than 3 geo-tagged regions exist — expected on a fresh environment.' },
    ],
  },
  {
    id: 'phase-9',
    title: 'Phase 9 — Admin Tasks',
    description: 'Verify system administration features as System Admin.',
    steps: [
      { step: 1, action: 'Log in as System Admin. Open User Management', where: 'User Management', href: '/user-management', expect: 'All users are listed. Role badges are correct.' },
      { step: 2, action: 'Create a new test user and assign the Credit Officer role', where: 'User Management', href: '/user-management', expect: 'User created. Invite email sent (if email provider is configured).' },
      { step: 3, action: 'Open Workflows Admin → Templates and verify templates exist', where: 'Workflow Templates', href: '/workflows-admin/templates', expect: 'At least one active workflow template is listed.' },
      { step: 4, action: 'Open Auto-Trigger Rules and verify at least one rule is active', where: 'Auto-Trigger Rules', href: '/workflows-admin/trigger-rules', expect: 'Active trigger rules are listed with their event types and target templates.' },
      { step: 5, action: 'Open Process Analytics & KPIs and verify metrics load', where: 'Process Analytics & KPIs', href: '/workflows-admin/process-analytics', expect: 'Cycle time charts and SLA compliance metrics render with data.' },
      { step: 6, action: 'Open Audit Center and search for actions from today', where: 'Audit Center', href: '/audit-center', expect: 'All actions performed during this test session appear in the audit log.' },
      { step: 7, action: 'Open Live Activity and verify the real-time feed is updating', where: 'Live Activity', href: '/live-activity', expect: 'Activity feed shows recent events. Auto-refresh is working.' },
    ],
  },
];

const MODULE_CHECKLISTS: ModuleChecklist[] = [
  {
    module: 'Collateral Management',
    color: '#1D4ED8',
    items: [
      { label: 'Add new collateral record', href: '/collateral-management' },
      { label: 'Edit existing collateral', href: '/collateral-management' },
      { label: 'Upload documents to Security Pocket', href: '/collateral-documents' },
      { label: 'Bulk upload via CSV', href: '/bulk-upload' },
      { label: 'View collateral detail page', href: '/collateral-management' },
      { label: 'Initiate perfection workflow', href: '/collateral-management' },
      { label: 'Initiate substitution request', href: '/collateral-substitution' },
      { label: 'Collateral Dashboard — Portfolio Monitoring tab loads', href: '/collateral-dashboard' },
    ],
  },
  {
    module: 'Workflows',
    color: '#7C3AED',
    items: [
      { label: 'Perfection workflow — submit and approve', href: '/perfection-workflow' },
      { label: 'Valuation workflow — schedule and sign off', href: '/valuation-workflow' },
      { label: 'Document approval — submit and approve', href: '/document-approval' },
      { label: 'Release approval — submit and approve', href: '/release-approval' },
      { label: 'Registry Submissions — create and update status', href: '/workflows/registry-submissions' },
      { label: 'Fast Track — assign priority tier to collateral', href: '/fast-track' },
      { label: 'Workflow instances list loads correctly', href: '/workflows/instances' },
      { label: 'Task list shows assigned tasks', href: '/workflows/tasks' },
      { label: 'Escalation triggers after SLA breach', href: '/workflows-admin/escalation' },
    ],
  },
  {
    module: 'Archive',
    color: '#065F46',
    items: [
      { label: 'Place document in vault slot', href: '/archive/vault-management' },
      { label: 'Custody screen shows correct status', href: '/archive/custody' },
      { label: 'Raise and approve access request', href: '/archive/access-requests' },
      { label: 'Documents library lists all archived docs', href: '/archive/documents-library' },
      { label: 'Chain of custody log is accurate', href: '/archive/chain-of-custody' },
      { label: 'Occupancy heatmap renders', href: '/archive/occupancy-heatmap' },
    ],
  },
  {
    module: 'Analytics & Intelligence',
    color: '#B45309',
    items: [
      { label: 'Executive Dashboard KPIs load live data', href: '/executive-dashboard' },
      { label: 'AI Risk & Fraud — Risk Assessment tab returns scores', href: '/ai-risk-fraud' },
      { label: 'AI Risk & Fraud — Fraud Prevention scan completes', href: '/ai-risk-fraud' },
      { label: 'Deadline Predictions list loads', href: '/deadline-predictions' },
      { label: 'Cohort Analytics charts render', href: '/cohort-analytics' },
      { label: 'Cohort Analytics — Portfolio Heatmap tab renders', href: '/cohort-analytics' },
    ],
  },
  {
    module: 'Loans & Obligors',
    color: '#0E7490',
    items: [
      { label: 'Create new loan facility', href: '/loan-registry' },
      { label: 'Link collateral to loan', href: '/loan-registry' },
      { label: 'Linked Collaterals panel loads without errors', href: '/loan-registry' },
      { label: 'Create new obligor', href: '/obligors' },
      { label: 'Obligor profile page loads', href: '/obligors' },
      { label: 'Pledge documents panel works', href: '/obligors' },
    ],
  },
  {
    module: 'Admin & Settings',
    color: '#374151',
    items: [
      { label: 'Create and deactivate a user', href: '/user-management' },
      { label: 'Assign and change user role', href: '/user-management' },
      { label: 'Configure screen access per user', href: '/user-management' },
      { label: 'Create workflow template', href: '/workflows-admin/templates' },
      { label: 'Configure auto-trigger rule', href: '/workflows-admin/trigger-rules' },
      { label: 'Process Analytics & KPIs load', href: '/workflows-admin/process-analytics' },
      { label: 'Workflow KPIs page renders', href: '/workflows-admin/kpis' },
      { label: 'Set alert threshold', href: '/alert-thresholds' },
      { label: 'Audit Center shows all test actions', href: '/audit-center' },
    ],
  },
];

const TEST_DATA: TestDataEntry[] = [
  { label: 'Seeded Obligor', value: 'Cornery Mangulu', note: 'Created via seed migration. Use this obligor for initial collateral registration tests.' },
  { label: 'Seeded Collateral Records', value: '5–10 records', note: 'Seeded via 20260628160000_seed_collateral_records.sql. Check collateral_records table to confirm.' },
  { label: 'Test Collateral Type', value: 'Land / Real Estate', note: 'Most complete document requirements. Best for testing the full perfection flow.' },
  { label: 'Test Loan Amount', value: 'TZS 50,000,000', note: 'Use this value to keep LTV calculations predictable during testing.' },
  { label: 'Test Collateral Value', value: 'TZS 75,000,000', note: 'Gives an LTV of ~67% — within normal limits, no breach alert triggered.' },
  { label: 'LTV Breach Threshold', value: '80%', note: 'Default threshold. To test breach alerts, set collateral value below loan amount × 1.25.' },
  { label: 'Admin Login', value: 'See .env / Supabase Auth', note: 'Admin user seeded via 20260506170000_create_admin_user.sql migration.' },
  { label: 'Workflow Template', value: 'Standard Perfection', note: 'Must exist in Workflows Admin → Templates before testing Phase 3.' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function PrerequisiteCard({ category, icon: IconComp, color, items }: typeof PREREQUISITES[0]) {
  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: '#FFFFFF', border: `1.5px solid ${color}20`, boxShadow: '0 2px 8px rgba(0,0,0,0.05)' }}
    >
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + '15' }}>
          {React.createElement(IconComp, { size: 16, style: { color } })}
        </div>
        <h3 className="text-sm font-bold" style={{ color: '#1E293B', fontFamily: 'DM Sans, sans-serif' }}>{category}</h3>
      </div>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={i} className="flex items-start gap-2.5">
            <CheckCircle2 size={14} style={{ color, marginTop: 1, flexShrink: 0 }} />
            <div>
              <p className="text-xs font-semibold" style={{ color: '#1E293B' }}>{item.label}</p>
              <p className="text-xs mt-0.5 leading-relaxed" style={{ color: '#64748B' }}>{item.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhaseAccordion({ phase }: { phase: TestPhase }) {
  const [open, setOpen] = useState(false);
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (step: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(step)) next.delete(step); else next.add(step);
      return next;
    });
  };

  const allDone = checked.size === phase.steps.length;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ border: `1.5px solid ${allDone ? '#059669' : '#E2E8F0'}`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-5 py-4 text-left transition-colors"
        style={{ backgroundColor: open ? '#F8FAFC' : '#FFFFFF' }}
      >
        <div className="flex items-start gap-3">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5"
            style={{ backgroundColor: allDone ? '#DCFCE7' : '#EFF6FF' }}
          >
            {allDone
              ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
              : <FlaskConical size={16} style={{ color: '#1D4ED8' }} />
            }
          </div>
          <div>
            <p className="text-sm font-bold" style={{ color: '#1E293B', fontFamily: 'DM Sans, sans-serif' }}>{phase.title}</p>
            <p className="text-xs mt-0.5" style={{ color: '#64748B' }}>{phase.description}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 ml-3">
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: allDone ? '#DCFCE7' : '#EFF6FF', color: allDone ? '#059669' : '#1D4ED8' }}>
            {checked.size}/{phase.steps.length}
          </span>
          <ChevronDown size={16} style={{ color: '#94A3B8', transform: open ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
        </div>
      </button>

      {open && (
        <div className="px-5 pb-5 pt-1" style={{ backgroundColor: '#FAFBFC', borderTop: '1px solid #E2E8F0' }}>
          <div className="space-y-3 mt-3">
            {phase.steps.map((s) => (
              <div
                key={s.step}
                className="flex items-start gap-3 p-3.5 rounded-xl cursor-pointer transition-colors"
                style={{
                  backgroundColor: checked.has(s.step) ? '#F0FDF4' : '#FFFFFF',
                  border: `1px solid ${checked.has(s.step) ? '#BBF7D0' : '#E2E8F0'}`,
                }}
                onClick={() => toggle(s.step)}
              >
                <div className="shrink-0 mt-0.5">
                  {checked.has(s.step)
                    ? <CheckCircle2 size={16} style={{ color: '#059669' }} />
                    : <Circle size={16} style={{ color: '#CBD5E1' }} />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-xs font-semibold" style={{ color: checked.has(s.step) ? '#065F46' : '#1E293B' }}>
                      Step {s.step}: {s.action}
                    </p>
                    <Link
                      href={s.href}
                      onClick={e => e.stopPropagation()}
                      className="shrink-0 flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-lg transition-colors"
                      style={{ color: '#1D4ED8', backgroundColor: '#EFF6FF', whiteSpace: 'nowrap' }}
                    >
                      {s.where} <ArrowRight size={10} />
                    </Link>
                  </div>
                  <div className="flex items-start gap-1.5 mt-1.5">
                    <Eye size={11} style={{ color: '#94A3B8', marginTop: 1, flexShrink: 0 }} />
                    <p className="text-xs leading-relaxed" style={{ color: '#64748B' }}>
                      <span className="font-medium" style={{ color: '#475569' }}>Expect: </span>{s.expect}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistCard({ checklist }: { checklist: ModuleChecklist }) {
  const [checked, setChecked] = useState<Set<number>>(new Set());

  const toggle = (i: number) => {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(i)) next.delete(i); else next.add(i);
      return next;
    });
  };

  return (
    <div
      className="rounded-xl p-5"
      style={{ backgroundColor: '#FFFFFF', border: `1.5px solid ${checklist.color}18`, boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold" style={{ color: '#1E293B', fontFamily: 'DM Sans, sans-serif' }}>{checklist.module}</h3>
        <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: checklist.color + '15', color: checklist.color }}>
          {checked.size}/{checklist.items.length}
        </span>
      </div>
      <div className="space-y-2">
        {checklist.items.map((item, i) => (
          <div
            key={i}
            className="flex items-center gap-2.5 p-2.5 rounded-lg cursor-pointer transition-colors"
            style={{ backgroundColor: checked.has(i) ? checklist.color + '08' : 'transparent' }}
            onClick={() => toggle(i)}
          >
            {checked.has(i)
              ? <CheckCircle2 size={14} style={{ color: checklist.color, flexShrink: 0 }} />
              : <Circle size={14} style={{ color: '#CBD5E1', flexShrink: 0 }} />
            }
            <Link
              href={item.href}
              onClick={e => e.stopPropagation()}
              className="text-xs hover:underline flex-1"
              style={{ color: checked.has(i) ? checklist.color : '#374151' }}
            >
              {item.label}
            </Link>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Section = 'prerequisites' | 'flow' | 'checklists' | 'testdata';

export default function TestingGuidePage() {
  const [activeSection, setActiveSection] = useState<Section>('prerequisites');

  const tabs: { key: Section; label: string; icon: React.ElementType }[] = [
    { key: 'prerequisites', label: 'Prerequisites', icon: ClipboardList },
    { key: 'flow', label: 'E2E Test Flow', icon: FlaskConical },
    { key: 'checklists', label: 'Feature Checklists', icon: CheckSquare },
    { key: 'testdata', label: 'Test Data', icon: Database },
  ];

  return (
    <AppLayout>
      <div className="min-h-screen" style={{ backgroundColor: '#F0F7FF' }}>
        {/* Header */}
        <div
          className="px-6 py-10"
          style={{ background: 'linear-gradient(135deg, #1E3A8A 0%, #1D4ED8 60%, #2563EB 100%)' }}
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex items-center gap-2 mb-5">
              <Link
                href="/guides"
                className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-80"
                style={{ color: 'rgba(255,255,255,0.7)' }}
              >
                <ArrowLeft size={13} />
                All Guides
              </Link>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>/</span>
              <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.9)' }}>Testing & Training Guide</span>
            </div>

            <div className="flex items-start gap-4">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: 'rgba(255,255,255,0.15)' }}
              >
                <FlaskConical size={28} color="#fff" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: 'rgba(255,255,255,0.15)', color: 'rgba(255,255,255,0.9)' }}>
                    Testing & Training
                  </span>
                </div>
                <h1 className="text-2xl font-bold text-white" style={{ fontFamily: 'DM Sans, sans-serif' }}>
                  End-to-End Testing Guide
                </h1>
              </div>
            </div>

            <div
              className="mt-5 p-4 rounded-xl"
              style={{ backgroundColor: 'rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}
            >
              <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.9)' }}>
                This guide walks testers and trainers through the full collateral lifecycle — from obligor creation to registry submissions and release approval — with step-by-step instructions, expected outcomes, per-module feature checklists, and known test data references. Work through the phases in order for a complete end-to-end test run.
              </p>
            </div>

            <div className="flex flex-wrap gap-5 mt-5">
              {[
                { label: '9 test phases', icon: FlaskConical },
                { label: '6 module checklists', icon: CheckSquare },
                { label: '8 test data references', icon: Database },
              ].map(({ label, icon: IconComponent }) => (
                <div key={label} className="flex items-center gap-1.5">
                  {React.createElement(IconComponent, { size: 13, style: { color: 'rgba(255,255,255,0.6)' } })}
                  <span className="text-xs font-medium" style={{ color: 'rgba(255,255,255,0.8)' }}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6">
          {/* Tabs */}
          <div className="flex gap-1 p-1 rounded-xl mb-6 overflow-x-auto" style={{ backgroundColor: '#E2E8F0' }}>
            {tabs.map((tab) => {
              const TabIcon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => setActiveSection(tab.key)}
                  className="flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-semibold transition-all duration-150 whitespace-nowrap"
                  style={
                    activeSection === tab.key
                      ? { backgroundColor: '#FFFFFF', color: '#1D4ED8', boxShadow: '0 1px 4px rgba(0,0,0,0.1)' }
                      : { color: '#64748B' }
                  }
                >
                  <TabIcon size={13} />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Prerequisites */}
          {activeSection === 'prerequisites' && (
            <div>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: '#64748B' }}>
                Complete all prerequisites before starting the E2E test flow. Missing any of these will cause steps to fail.
              </p>
              <div className="grid grid-cols-1 gap-4">
                {PREREQUISITES.map((p) => (
                  <PrerequisiteCard key={p.category} {...p} />
                ))}
              </div>
              <div
                className="mt-6 flex items-start gap-3 p-4 rounded-xl"
                style={{ backgroundColor: '#FFF7ED', border: '1px solid #FED7AA' }}
              >
                <AlertTriangle size={15} style={{ color: '#D97706', marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: '#92400E' }}>
                  <strong>Before you start:</strong> Open two browser windows — one logged in as Credit Officer, one as Legal Officer. This lets you test workflow handoffs without logging out and back in.
                </p>
              </div>
            </div>
          )}

          {/* E2E Test Flow */}
          {activeSection === 'flow' && (
            <div>
              <div
                className="flex items-start gap-3 p-4 rounded-xl mb-5"
                style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
              >
                <Info size={15} style={{ color: '#2563EB', marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: '#1D4ED8' }}>
                  <strong>How to use this flow:</strong> Work through the phases in order. Click each step to mark it complete. Each step shows the exact screen to use and what a successful outcome looks like.
                </p>
              </div>
              <div className="space-y-3">
                {TEST_PHASES.map((phase) => (
                  <PhaseAccordion key={phase.id} phase={phase} />
                ))}
              </div>
            </div>
          )}

          {/* Feature Checklists */}
          {activeSection === 'checklists' && (
            <div>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: '#64748B' }}>
                Use these per-module checklists to track feature coverage. Click each item to mark it tested. Click the feature name to navigate directly to that screen.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {MODULE_CHECKLISTS.map((c) => (
                  <ChecklistCard key={c.module} checklist={c} />
                ))}
              </div>
            </div>
          )}

          {/* Test Data */}
          {activeSection === 'testdata' && (
            <div>
              <p className="text-xs mb-5 leading-relaxed" style={{ color: '#64748B' }}>
                Reference values and seeded records to use during testing. These ensure consistent, predictable outcomes across test runs.
              </p>
              <div className="space-y-3">
                {TEST_DATA.map((entry, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-4 p-4 rounded-xl"
                    style={{ backgroundColor: '#FFFFFF', border: '1.5px solid #E2E8F0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
                  >
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: '#EFF6FF' }}>
                      <Database size={14} style={{ color: '#1D4ED8' }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <p className="text-xs font-bold" style={{ color: '#1E293B' }}>{entry.label}</p>
                        <span
                          className="text-xs font-mono font-semibold px-2.5 py-0.5 rounded-lg"
                          style={{ backgroundColor: '#F1F5F9', color: '#334155', border: '1px solid #E2E8F0' }}
                        >
                          {entry.value}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-xs mt-1.5 leading-relaxed" style={{ color: '#64748B' }}>{entry.note}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div
                className="mt-6 flex items-start gap-3 p-4 rounded-xl"
                style={{ backgroundColor: '#F0FDF4', border: '1px solid #BBF7D0' }}
              >
                <Lightbulb size={15} style={{ color: '#059669', marginTop: 1, flexShrink: 0 }} />
                <p className="text-xs leading-relaxed" style={{ color: '#065F46' }}>
                  <strong>Tip:</strong> After each major test phase, open the Supabase Table Editor and verify the expected rows exist in <code className="font-mono bg-green-100 px-1 rounded">collateral_records</code>, <code className="font-mono bg-green-100 px-1 rounded">workflow_instances</code>, and <code className="font-mono bg-green-100 px-1 rounded">audit_logs</code>. This confirms the UI writes are persisting correctly.
                </p>
              </div>
            </div>
          )}

          {/* Footer nav */}
          <div
            className="mt-8 flex items-start gap-3 p-4 rounded-xl"
            style={{ backgroundColor: '#EFF6FF', border: '1px solid #BFDBFE' }}
          >
            <BookOpen size={15} style={{ color: '#2563EB', marginTop: 1, flexShrink: 0 }} />
            <p className="text-xs leading-relaxed" style={{ color: '#1D4ED8' }}>
              <strong>Also see:</strong>{' '}
              <Link href="/guides" className="underline font-semibold">Role Guides</Link>{' '}
              for role-specific task walkthroughs, or the{' '}
              <Link href="/onboarding-guide" className="underline font-semibold">Onboarding Guide</Link>{' '}
              for a full module overview.
            </p>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
