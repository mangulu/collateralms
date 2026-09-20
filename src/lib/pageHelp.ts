/**
 * Per-page contextual help content, shown via the Help icon in the
 * topbar (see AppLayout). Add an entry keyed by the exact pathname to
 * make the icon appear on that page — pages with no entry here simply
 * don't show the icon.
 */

export interface PageHelpContent {
  title: string;
  narrative: string;
  /** Either the same steps for everyone, or steps keyed by role (with an optional 'default' fallback for unrecognized/missing roles). */
  steps: string[] | Record<string, string[]>;
}

export const PAGE_HELP: Record<string, PageHelpContent> = {
  '/perfection-workflow': {
    title: 'Perfection Workflow',
    narrative: 'Perfection Workflow manages the full lifecycle of a collateral perfection request — from a Credit Officer submitting it, through Legal Officer review and approval, to final confirmation that the collateral has been legally perfected.',
    steps: {
      credit_officer: [
        'Create a new perfection request using "New Request"',
        'Open a Draft or Returned request and click "Submit to Legal Officer"',
        "Monitor progress — you'll see updates as Legal reviews your request",
      ],
      legal_officer: [
        'Open any "Submitted" request and click "Start Review" to begin',
        'While "Under Review", choose Return or Reject here, or approve it in Pending Approvals',
        'Once "Approved", open the request here and click "Mark as Perfected" to complete it',
        'Add notes when rejecting, returning, or marking as perfected — they are required',
      ],
      system_admin: [
        'You can perform all Credit Officer and Legal Officer actions',
        'Create, submit, review, approve (via Pending Approvals), mark as perfected, return, or reject any request',
      ],
      default: [
        'Ask a Credit Officer, Legal Officer, or System Admin for guidance specific to your role.',
      ],
    },
  },
  '/workflows/tasks': {
    title: 'Unified Task List',
    narrative: 'My Tasks combines three separate item types — assigned tasks, perfection requests you submitted, and approval requests you submitted — into one feed, instead of checking three screens for what needs your attention.',
    steps: [
      'Use Active/All to see only open items, or everything ever assigned to you',
      'Filter by type (My Tasks / Approvals / Perfections) or priority, or search by title',
      '"Mark Complete" only appears on plain tasks — approvals and perfection requests move forward through their own screens instead',
      'Click any item to open its detail page, or jump straight to the record it\'s about',
    ],
  },
  '/approval-inbox': {
    title: 'Perfection Queue',
    narrative: 'Perfection Queue is where a Legal Officer reviews and decides every submitted perfection request — approve, reject, or send back for modification — with a live connection indicator, AI-assisted document classification per request, and optional desktop/SMS alerts for new arrivals.',
    steps: [
      'The Live/Connecting indicator shows whether new requests are arriving in real time; use Refresh if it drops',
      'Turn on desktop notifications or SMS alerts to be notified the moment a new request lands',
      'Expand a request to run AI Document Classification — a confidence-scored read on the supporting documents, not a substitute for review',
      'Approve, Reject (reason required), or Request Modification — these are only available to Legal Officers and System Admins; everyone else sees the queue read-only',
    ],
  },
  '/document-approval': {
    title: 'Document Approval',
    narrative: 'Document Approval is the parallel review queue for uploaded supporting documents rather than whole perfection requests, moving each one through Pending → Under Review → Approved/Rejected.',
    steps: [
      'Use the status cards to filter — All, Pending, Under Review, Approved, or Rejected',
      'Click a document to open its detail drawer with a preview',
      'Approve, Reject, or Mark Under Review — only available if you\'re a Legal Officer; other roles can view but not act',
      'The drawer flags how long a pending document has been waiting, so the oldest ones stand out',
    ],
  },
  '/release-approval': {
    title: 'Release Approval',
    narrative: 'Release Approval mirrors the Perfection Queue for the other end of the lifecycle — reviewing requests to discharge a collateral from its facility once the underlying loan is settled.',
    steps: [
      'Filter by status or search to find a specific request',
      'Approve a release to discharge the collateral from the facility, Reject with a required reason, or mark it Under Review',
      'Click a request to see the full collateral and loan context before deciding',
    ],
  },
  '/workflows/registry-submissions': {
    title: 'Registry Submissions',
    narrative: "Registry Submissions tracks each collateral's registration with an external registry (BRELA, Lands, etc.) across a 5-stage flow — Pending → Submitted → Acknowledged → Registered, or Rejected — and automatically flags anything submitted more than 7 days ago with no acknowledgement as overdue.",
    steps: [
      'Update a single submission\'s status as the registry responds, or select several and use Bulk Update Status',
      'Anything sitting in "Submitted" past 7 days with no acknowledgement is flagged overdue automatically',
      'Add notes on any status change — they\'re kept as part of that submission\'s history',
    ],
  },
  '/workflow-command-center': {
    title: 'Workflow Command Center',
    narrative: 'Command Center pulls perfection, valuation, release, and covenant workflows into one cross-cutting list with a shared SLA and bottleneck view, instead of checking each workflow type separately.',
    steps: [
      'Filter by workflow type, SLA status (ok/warning/critical/overdue), or search',
      '"Bottlenecks only" surfaces items stuck unusually long in their current stage — not just ones that are simply overdue',
      'Each row shows stage progress and days remaining so you can prioritize by how close something is to breaching, not just its type',
      'This is a monitoring view — click through to an item\'s own page to actually approve, reject, or otherwise act on it',
    ],
  },
  '/workflows/instances': {
    title: 'Workflow Instances',
    narrative: 'Workflow Instances is the operational view over every running instance of a custom Workflow Template — approve, reject, return, skip, escalate, hold, or cancel a step, and reassign it to someone else, with a full transition log kept per instance.',
    steps: [
      'Approve & Advance moves the instance to its next step; Return sends it back a step; Skip jumps past it',
      'Escalate is what actually sends the escalation email configured in Escalation Configuration — nothing fires on its own from an SLA timer',
      'Put a step On Hold to pause it, or Reassign it to a different role or person',
      'Every action is written to the instance\'s transition log, visible from its detail view',
    ],
  },
  '/staff-workspace': {
    title: 'Staff Workspace',
    narrative: "Staff Workspace is a manager-level view over every staff member's assigned tasks, not just your own — filter by workflow, assignee, or overdue status to see where the workload actually sits.",
    steps: [
      'Filter by workflow name, a specific assignee, status, or "Overdue only"',
      'Expand a task row to add a comment or mark it complete on someone else\'s behalf',
      'Search across all tasks by title or workflow name',
    ],
  },
  '/workflows-admin/templates': {
    title: 'Workflow Templates',
    narrative: 'Workflow Templates builds the custom multi-step approval workflows that power Workflow Instances — each step gets an assigned role, optional conditions (e.g. only for collateral above a value threshold), and an escalation rule.',
    steps: [
      'Click New Template, then Add Step for each stage in the approval chain — order matters',
      'Escalation only supports two real actions: Notify Manager, and Notify Manager & Flag Payment for Review — the SLA hours field is a reference target only, not automatically enforced',
      'Pausing a template puts its running instances on hold; resuming restores them — it doesn\'t cancel anything',
      'Configure an auto-trigger rule for a template directly from here, or manage all rules together in Auto-Trigger Rules',
    ],
  },
  '/workflows-admin/trigger-rules': {
    title: 'Auto-Trigger Rules',
    narrative: 'Auto-Trigger Rules defines the conditions that automatically start a new workflow instance from a chosen template — e.g. an LTV breach or a value threshold — instead of someone manually starting it.',
    steps: [
      'New Rule: pick the triggering event (status change, days since submission, value threshold, LTV breach, days overdue, or document count change), its condition, and which template it starts',
      'Run Now manually fires rule evaluation immediately and reports per-rule match/creation counts, instead of waiting for the hourly automatic pass',
      'The run log below shows Success/Partial/Failed for every past evaluation, so you can confirm rules are actually firing',
    ],
  },
  '/workflows-admin/escalation': {
    title: 'Escalation Configuration',
    narrative: 'Escalation Configuration sets the reference SLA and escalation action for each step of every active workflow template — but escalation only actually happens when someone clicks "Escalate" on a stuck instance in Workflow Instances; the SLA hours shown here is a target, not a timer.',
    steps: [
      'Expand a template to see and edit each step\'s SLA hours and escalation action',
      'Only two actions actually do anything: Notify Manager, and Notify Manager & Flag Payment for Review',
      'Nothing here starts a clock automatically — treat the SLA hours as guidance shown on the instance, not an automated trigger',
    ],
  },
  '/workflows-admin/kpis': {
    title: 'Analytics & KPIs',
    narrative: 'Analytics & KPIs covers two tabs of workflow performance metrics — Efficiency KPIs (cycle time, SLA compliance, escalation counts) and Process Analytics (role distribution, throughput trends, and per-step bottleneck breakdown) — computed live from actual instance data.',
    steps: [
      'Switch between Efficiency KPIs and Process Analytics',
      'Efficiency KPIs covers total instances, average cycle time, SLA compliance rate, and how many have been escalated',
      'Process Analytics breaks the same data down further — by role, over time, and by which step tends to bottleneck',
    ],
  },
  '/fast-track': {
    title: 'Fast Track Tiers',
    narrative: 'Fast Track assigns a service tier (Premier / Repeat / Standard) to each obligor based on risk rating and relationship history, which pre-fills or shortens certain steps of the standard collateral workflow for trusted, established customers.',
    steps: [
      'Tiers are suggested automatically from risk rating and years of relationship, but can be manually overridden per obligor with a reason',
      'The workflow comparison table shows exactly which steps are shortened or pre-filled for a fast-tracked customer versus the standard flow',
      'Search or browse the obligor list to check or change a specific customer\'s tier',
    ],
  },
  '/workflows-admin/migration': {
    title: 'Hybrid Migration Tool',
    narrative: 'Hybrid Migration Tool moves older workflow-type instances (perfection, release, etc.) that predate the generic Workflow Template engine onto proper templates and steps, so they show up correctly in Workflow Instances instead of being invisible to it.',
    steps: [
      'Click Run Migration to scan every instance that has no step records yet',
      'Anything with a clear, unambiguous status is auto-migrated at ≥80% confidence; anything ambiguous lands in the review queue below',
      'For a flagged instance, pick the correct template and step yourself, then confirm — or Skip it if it shouldn\'t be migrated at all',
      'Use the status tabs to see what\'s Pending Review, Auto-Migrated, Manually Migrated, or Skipped',
    ],
  },
  '/notifications-hub': {
    title: 'Notifications Hub',
    narrative: 'Notifications Hub pulls together everything that needs your attention across the app — open compliance breaches, your pending workflow tasks, recent status-change events, and insurance policies expiring soon — into one real-time feed, instead of requiring you to check each source separately.',
    steps: [
      'Use the type tabs (Overdue, BRELA, Status, Workflow, Documents, System) or the search box to narrow down what you\'re looking at',
      "Click a notification's action link to jump straight to the relevant record",
      'Use "Mark read" on a notification once you\'ve dealt with it, or "Mark all read" to clear the whole unread count at once',
      'Use "Dismiss" on a notification you no longer need to see, or "Clear read" to remove everything you\'ve already read in one go',
      "Click Refresh to pull in anything new since you last loaded the page",
    ],
  },
  '/alerts-inbox': {
    title: 'Alerts Inbox',
    narrative: 'Alerts Inbox is your triage view over the SMS alerts the system has sent you — fraud detection, BRELA deadlines, approval requests, overdue collateral, and status changes — with the full message text and a link to the relevant record for each one. Alert Delivery Log is the separate place to check delivery status and retry failed sends for the same alerts.',
    steps: [
      'Use the type tabs, the read/unread filter, or search to find specific alerts',
      'Click an alert row to expand it and read the full message',
      'Use the eye icon to mark a single alert read/unread, or select several and use the bulk "Mark Read"/"Mark Unread" buttons',
      "Delete an alert once you're done with it — this only clears it from your own inbox, it doesn't affect the alert's delivery record in Alert Delivery Log",
      'Sort by Newest, Oldest, or Priority to change how the list is ordered',
    ],
  },
  '/alerts-delivery': {
    title: 'Alert Delivery Log',
    narrative: "Alert Delivery Log tracks the outcome of every SMS alert the system has attempted to send — Sent, Delivered, Failed, or Pending — with the Twilio message ID and error detail for failures, plus a per-recipient send history. It's the ops view for whether alerts actually went out; Alerts Inbox is where you read the alerts sent to you.",
    steps: [
      'Use the status tabs (Sent, Delivered, Failed, Pending) or the alert-type filter to narrow the delivery history',
      'Click a row to expand it and see the full message, timestamps, Twilio message SID, and — for failures — the error detail',
      "Click Retry on a Failed alert to resend it; the list refreshes with the new attempt once it's done",
      "Switch to the Recipient History tab to see each recipient's total sent/failed counts and success rate",
      'Search by recipient, message text, or collateral ID, and use Refresh to pull the latest state',
    ],
  },
  '/deadline-reminders': {
    title: 'Deadline Reminders',
    narrative: 'Deadline Reminders lets you configure automated SMS reminder rules for approaching (or overdue) perfection deadlines — each rule scans collateral records within its deadline window and texts every officer with the matching role who has a phone number on file.',
    steps: [
      'Click "Add Rule" to define how many days before deadline it triggers, who receives it (by role), and the message template — use {collateralId}, {registry}, and {url} placeholders',
      'Click the play icon to run a rule immediately; it reports how many reminders actually sent versus failed, not just how many were attempted',
      'Use the pause/resume icon to disable a rule without deleting it, or the trash icon to remove it entirely',
      'Each rule card shows when it last ran and its total sent count so you can confirm it\'s actually firing',
    ],
  },
  '/sms-notification-rules': {
    title: 'SMS Notification Rules',
    narrative: 'SMS Notification Rules controls who gets an automatic SMS when a covenant breach, an overdue action, or a collateral status change happens — separate from Deadline Reminders, which you trigger yourself for approaching perfection deadlines. Twilio sends these the moment the event occurs, with no manual step.',
    steps: [
      'Expand an event rule (Covenant Breach, Overdue Action, Status Change) to edit it',
      'Add recipients with name, phone number, and an optional role label — remove one with its trash icon',
      'Choose a minimum severity so low-priority events don\'t page everyone — "All Events", "High & Critical", or "Critical Only"',
      'Toggle the rule on or off, then click "Save Rule" — a rule with no recipients or left disabled sends nothing',
    ],
  },
  '/executive-dashboard': {
    title: 'Executive Dashboard',
    narrative: 'Executive Dashboard is the real-time, portfolio-wide view for leadership — total value, perfection rate, LTV exposure, and overdue/approaching-deadline counts, plus a six-month perfection trend and a collateral-type breakdown, all computed live from current records rather than a periodic snapshot.',
    steps: [
      'The KPI strip covers portfolio value, perfection rate, item counts, average LTV (with a risk badge), overdue actions, and items approaching deadline',
      'The Perfection Trend chart shows perfected/submitted/overdue counts over the last 6 months; the pie chart breaks the portfolio down by collateral type',
      'Click Refresh to recompute every KPI and chart from the latest data, or Export for a PDF summary covering the same 6-month window',
    ],
  },
  '/cohort-analytics': {
    title: 'Cohort Analytics',
    narrative: 'Cohort Analytics tracks perfection performance over time and across officers — perfection-rate trends by collateral type, per-officer completion and turnaround stats, LTV drift patterns, and forecasting alerts that flag developing risk before it becomes a breach — plus AI document analysis and a Portfolio Heatmap tab for geographic concentration.',
    steps: [
      'Forecasting Alerts at the top surface LTV drift, officer slowdowns, or trend reversals worth attention right now',
      'Perfection Rate Trends and Officer Performance Distribution break results down by collateral type and by officer',
      'LTV Drift Patterns tracks how loan-to-value ratios are moving across the portfolio over time',
      'Scroll down to Collateral Document Analysis to run an AI review of a record\'s documents for risk flags, valuation anomalies, and legal exposure',
      'Switch to the Portfolio Heatmap tab for the geographic view — see "Portfolio Heatmap" help for that tab specifically',
      'Use Refresh to recompute everything from the latest data',
    ],
  },
  '/portfolio-heatmap': {
    title: 'Portfolio Heatmap',
    narrative: "Portfolio Heatmap maps collateral concentration, average LTV, and overdue rate by region across Tanzania, so you can spot where risk is geographically concentrated. It's also reachable as a tab inside Cohort Analytics; standalone here it's meant for direct linking from dashboards.",
    steps: [
      'Switch the metric toggle (Concentration / Avg LTV / Overdue Rate) to recolor the map and charts by that measure',
      'Click a region bubble, chart bar, or table row to drill into that region\'s detail panel',
      'The Regional Risk Summary table lists every region with its collateral count, value, LTV, and overdue rate side by side',
      "If fewer than 3 regions have geo-tagged collateral, the page falls back to labeled sample data rather than an empty map — a visible banner tells you when that's happening",
    ],
  },
  '/deadline-predictions': {
    title: 'Smart Deadline Predictions',
    narrative: 'Smart Deadline Predictions scores every non-perfected collateral record by how likely it is to miss its perfection deadline, weighting days remaining, current status, LTV, and whether perfection is still required — surfacing the ones needing attention first instead of waiting for them to actually go overdue.',
    steps: [
      'Each item shows a 0–100 risk score with the specific factors that drove it (e.g. "3d left", "High LTV 82%")',
      'Filter to "High+" or "Critical Only" to focus on the most urgent items, or "All" to see everything monitored',
      'The summary cards give a running count of Critical, High Risk, and Total Monitored items',
      'Click Refresh to rescore against the latest collateral data',
    ],
  },
  '/fraud-prevention': {
    title: 'AI Fraud Prevention',
    narrative: "AI Fraud Prevention screens collateral submissions for suspicious patterns — duplicate titles, identity mismatches, valuation anomalies, and more — and tracks every resulting alert through to a resolution (false positive, escalated, or resolved).",
    steps: [
      'Click "Run AI Analysis" and fill in the submission details to screen it before it\'s accepted',
      'Review flagged alerts in the list below — expand one for the full detail behind the flag',
      'Mark an alert as a False Positive to clear it, or Escalate for Investigation if it needs follow-up',
      'Use "Send Fraud Alert SMS" to notify the right officer directly about a specific alert',
    ],
  },
  '/risk-assessment': {
    title: 'AI Risk Assessment',
    narrative: "AI Risk Assessment runs a full AI-driven risk analysis on a collateral record — legal, financial, and operational dimensions, an overall score and level, and a plain-language narrative for each — using either a live record from the registry or details you enter manually.",
    steps: [
      'Select an existing collateral record from the dropdown, or switch to manual entry and fill in the details yourself',
      'Click "Run Assessment" to get an overall risk score/level plus a breakdown across each risk dimension',
      'Expand a risk dimension for its detailed narrative and contributing factors',
      'Recent Assessments below keeps a running history of what you\'ve scored this session',
    ],
  },
  '/geomapping': {
    title: 'Geomapping',
    narrative: 'Geomapping plots geo-tagged collateral on a map of Tanzania, cross-checks each address against the ID/registry address on file to flag mismatches, and highlights high-risk zones by region — with a geocoding tool for turning a plain address into coordinates.',
    steps: [
      'Map View: filter pins by collateral type, status, or risk zone, search by collateral ID/obligor/region, and toggle the heatmap overlay for risk concentration instead of individual pins',
      'Click a pin (or a row in the High Risk Collateral list) to open its detail panel, or use the geocode search box to look up coordinates for an address via OpenStreetMap',
      'Address Validation tab: see ID-vs-collateral address match scores and flagged mismatches',
      'Risk Zones tab: view collateral grouped by risk zone (Low/Medium/High)',
    ],
  },
  '/obligors': {
    title: 'Obligors',
    narrative: 'Obligors is the borrower registry — search and filter by type and risk level, then open a profile for the full picture: identification, contacts, credit risk score, exposure metrics, linked collaterals, and pledge documents for that obligor.',
    steps: [
      'Search by name or filter by type (Individual/Company) and risk level (Low/Medium/High)',
      'Click an obligor to open their full profile — risk score, exposure metrics, approval trend, and linked collaterals',
      'Use Add/Edit to create or update an obligor record',
      'Deleting an obligor first shows how many loans, pledge documents, and collaterals are linked, so you know the impact before confirming',
      'On a profile, scroll to Pledge Documents to upload, view, or remove that obligor\'s pledge instruments',
    ],
  },
  '/loan-registry': {
    title: 'Loan Registry',
    narrative: 'Loan Registry is the facility-level ledger — every loan/facility with its status, obligor, and outstanding balance, with drill-down into the collaterals securing it and a facility-wide obligor summary.',
    steps: [
      'Search by loan number or obligor, or filter by status and facility type',
      'Click New Loan to register a facility, or Edit/Delete on an existing one',
      'Open a loan to see its Linked Collaterals and the Facility Obligor Summary',
      'Outstanding balance and facility amount here are what LTV Monitoring and Loan Classification use as loan exposure',
    ],
  },
  '/loan-classification': {
    title: 'Loan Classification',
    narrative: 'Loan Classification applies the BOT 5-tier engine (Current / Especially Mentioned / Substandard / Doubtful / Loss) to each loan, driven by days-past-due and qualitative flags (insurance expired, perfection overdue, covenant breach, etc.), with manual override support. Provisioning Reports below apply the matching BOT rate schedule.',
    steps: [
      'Click Classify on a loan, enter days past due and any qualitative flags — the tier and provision amount preview live as you edit',
      'Use the override toggle only when the automatic tier needs a documented manual correction; a reason is required',
      'Classifying a loan retires its previous classification record and creates a new active one — only one is ever active per loan',
      'Switch to Provisioning Reports to generate a quarterly report applying the BOT rate schedule across all classified loans',
    ],
  },
  '/haircut-schedule': {
    title: 'Haircut Schedule Engine',
    narrative: 'Haircut Schedule Engine sets the BOT-aligned haircut rate (0–30%) applied to each asset class before it counts toward LTV, with a live preview of the effect on a sample value.',
    steps: [
      'Haircut Schedule tab: edit a class\'s rate — saving retires the previous active rate for that class and activates the new one',
      'LTV Calculator tab: enter a loan exposure and gross collateral value to see the haircut-adjusted LTV for a given class',
      'Application Log tab: review every time a haircut was actually applied to a real valuation, with the rate and resulting net value used',
    ],
  },
  '/credit-policy-review': {
    title: 'Credit Policy Review Workflow',
    narrative: 'Credit Policy Review Workflow runs each policy through a 6-stage approval pipeline (Draft → Credit Committee Review → Risk Management Review → Board Audit Committee → Full Board Approval → Approved), with BOT submission status tracked alongside it.',
    steps: [
      'Create a policy review, then use Advance Stage to approve the current stage and move it to the next — add comments if needed',
      'Track BOT Submission Status (Pending/Submitted/Acknowledged) with submission date, acknowledgement date, and BOT reference number',
      'Overdue reviews (past their due date) are flagged automatically',
      'Filter by year, stage, BOT status, or priority to find a specific review',
    ],
  },
  '/user-management': {
    title: 'User Management',
    narrative: 'User Management covers the full user lifecycle across four tabs: creating and deactivating accounts, assigning roles, editing what each role is allowed to do, controlling which screens appear in the sidebar per role, and enabling two-factor authentication.',
    steps: [
      'Users tab: add, edit, or deactivate accounts and assign a role — role list is loaded live, not hardcoded',
      'Roles & Permissions tab (requires Roles permission): create custom roles and choose exactly which permissions each role grants — this is what actually gates access throughout the app',
      'Screen Access tab: choose which screens appear in the sidebar for each role via the View column; the other action columns are recorded for reference but don\'t yet gate individual buttons within a screen',
      'Two-Factor Auth tab: enable SMS-based 2FA for your own account',
    ],
  },
  '/scheduled-jobs': {
    title: 'Scheduled Batch Release Jobs',
    narrative: 'This page combines two independent automations. Scheduled Batch Release Jobs releases collateral whose registry charge is already confirmed discharged, on a schedule or on demand. The Workflow Trigger Processor panel above it is a separate system that auto-initiates workflow instances when trigger rule conditions match.',
    steps: [
      'Batch release jobs only release items with a matching charge_registry entry the registry has confirmed discharged — there\'s no reliable "days since loan closure" signal to filter on otherwise, so that criterion was deliberately left out',
      'Click Run Now to validate and immediately run a job — the validation panel shows exactly how many real items are eligible before anything is released',
      'Turning off "Require Discharge Number" releases items with no registry confirmation on file — not recommended',
      'A separate hourly job checks each active schedule\'s configured time and day automatically; Run Now doesn\'t wait for that',
      'Use the Workflow Trigger Processor\'s own Run Now to manually fire trigger-rule evaluation and see per-rule match/creation counts',
    ],
  },
  '/settings': {
    title: 'System Settings',
    narrative: 'System Settings is organized into four groups: Reference Data (document types, required documents, collateral types, registries), Integrations (email provider), Notifications (preferences and templates), and Advanced (bank details, BRELA API config, thresholds, retention policies) — most of Advanced requires Settings Manage permission.',
    steps: [
      'Reference Data controls the dropdown options and requirements used throughout the app — e.g. which documents are mandatory per collateral type',
      'Email Provider stores API credentials for Resend, SendGrid, or Brevo — only Resend is actually wired to send right now, so switching the active provider alone won\'t change what sends email',
      'Notification Preferences and Email Templates control what automated emails say and who gets them',
      'Advanced holds bank identity details, BRELA API endpoint configuration, system-wide alert thresholds, and document retention periods — changes here affect the whole platform',
    ],
  },
  '/archive/disposal-queue': {
    title: 'Disposal Queue',
    narrative: "Disposal Queue lists physical collateral documents whose retention period has elapsed since their collateral was released — each document type's retention period is set in Settings, and the clock starts once a Release Request is approved. Items appear here automatically; nothing is ever deleted without an explicit, reasoned approval.",
    steps: {
      legal_officer: [
        'Review a listed item\'s collateral, slot, and how long it\'s been eligible',
        'Click "Approve Disposal" and enter a reason — this is required and kept in the audit trail',
        'The filing record stays in the system after disposal for compliance history; only its physical document is marked destroyed',
      ],
      system_admin: [
        'You have the same disposal rights as a Legal Officer',
        'Set each document type\'s retention period in Settings → Document Types',
      ],
      default: [
        'You can view the queue, but only a Legal Officer or System Admin can approve a disposal',
      ],
    },
  },
  '/archive/vault-management': {
    title: 'Vault Management',
    narrative: 'Vault Management is the hierarchical structure of your physical storage — Vault → Room → Cabinet → Slot — where every filed collateral document physically lives, with real-time capacity and occupancy tracked at every level.',
    steps: [
      'Click "Add Vault" to create a top-level vault, then use the + button on a Vault or Room to add the next level down',
      "Adding a Cabinet auto-generates its slots from the rows × columns you specify — slots aren't created individually",
      'Click any 📂 Slot to open its detail page and view, move, or remove the files inside',
      "Each row's occupancy bar shows real-time fill level against that level's capacity",
    ],
  },
  '/archive/collateral-placement': {
    title: 'Collateral Filing',
    narrative: 'Collateral Filing is where you assign a physical vault slot to a collateral record — pairing it with a slot, an optional physical reference, and an optional scanned supporting document.',
    steps: [
      'Switch between the "Filed" and "Awaiting Filing" tabs to see what still needs a slot',
      'Click "File Collateral" for a single item, or select several in "Awaiting Filing" and use "Bulk File to Slot"',
      'Attach a scanned document (PDF, JPG, PNG, DOCX) while filing — a physical-only filing above the bank\'s high-value threshold shows a red "No Backup — High Value" badge',
      'Use "Missing Backup Only" in the Filed tab to find and prioritize the highest-value gaps first',
      'A physical reference (PHY-YYYYMMDD-XXXX) is auto-generated for each filing but can be edited',
    ],
  },
  '/document-management': {
    title: 'Document Management',
    narrative: "Document Management is the single place for every collateral-linked document uploaded across the system — upload, classify, version-control, and link supporting documents to collateral records, or browse, search, and download the full archive.",
    steps: [
      'Use the search box or the type filter to narrow down by file name, owner, or document type',
      'Click "History" on a document to see all its prior versions and roll back if needed',
      'Click "Download" to open the current version in a new tab',
      'Use Upload to attach a new document to a collateral record, classified by document type',
    ],
  },
  '/archive/access-requests': {
    title: 'Access Requests',
    narrative: "Access Requests manages borrowing a physical file from the vault — from raising a request, through approval and checkout, to its return. Collateral above the bank's dual-custody threshold needs two different approvers before it can be checked out.",
    steps: [
      "Click \"Raise Request\" to borrow a physical file — the system checks it's actually been filed in the vault first",
      'Switch between "Pending Approvals" and "My Requests" to see what\'s waiting on you vs. what you\'ve raised',
      'Approving a high-value request only gives the first of two required approvals — a different officer must approve again before it\'s actually checked out',
      'Once the file is back, click "Mark Returned" to close the request',
      'Export the current list to CSV, or use search and the status filters to narrow it down',
    ],
  },
  '/archive/file-location-status': {
    title: 'File Location Status',
    narrative: 'File Location Status is a live, read-only view of exactly where every physical collateral file is right now — in the vault, checked out, overdue, or returned — plus any active requests against it, without cross-referencing Custody and Access Requests separately.',
    steps: [
      'Use the status cards or search to filter by current location status',
      'Click "View" to open the drill-down drawer with full detail: vault slot, checkout history, and active requests',
      'Expand a row with active requests to see who raised them and their due dates inline',
    ],
  },
  '/archive/custody': {
    title: 'Custody',
    narrative: 'Custody tracks the live status (in vault, on loan, overdue, returned) of every physical file, and the full chain-of-custody history of handoffs between officers and vault locations.',
    steps: [
      'Use "Current Status" for a live snapshot, or "History" for the full chain-of-custody timeline',
      "Send an SMS reminder directly from an overdue file's row — it goes to whichever officer currently has it checked out",
      'In History, confirm receipt of a handoff assigned to you so the chain stays accurate',
      'Export the chain-of-custody history to CSV from the History tab',
    ],
  },
  '/archive/occupancy-heatmap': {
    title: 'Vault Occupancy Heatmap',
    narrative: 'Occupancy Heatmap shows real-time room, cabinet, and slot occupancy across every vault, with capacity alerts and filing/retrieval trends drawn from the archive audit log.',
    steps: [
      'Switch between the Heatmap, Filing Trends, and Bottlenecks tabs',
      'Click any slot cell to see its exact fill count and a recommendation (redistribute, monitor, or fine)',
      'Filter by a specific vault when you manage more than one',
      'Critical (≥90%) and High (≥75%) slots are called out in the Capacity Alerts banner — prioritize those for redistribution',
    ],
  },
  '/archive/audit-log': {
    title: 'Archive Audit Log',
    narrative: 'Archive Audit Log is the full, timestamped record of every vault movement — filings, moves, checkouts, returns, custody handoffs, and disposals — each attributed to the officer who performed it.',
    steps: [
      'Use the event-type filter or search to narrow down to a specific kind of movement, collateral, or officer',
      'Every entry shows what happened, to which collateral and location, who did it, and exactly when',
    ],
  },
  '/archive/vault-slot': {
    title: 'Vault Slot Detail',
    narrative: "Vault Slot Detail shows everything filed in one specific slot — capacity, current items, and each collateral's filing details — with tools to file new collateral directly into this slot, move items to another slot, or remove them, plus this slot's own movement timeline.",
    steps: [
      'Click "File Collateral" to assign a new collateral directly into this slot',
      'Select one or more items and use "Move to Slot" or "Remove" from the bulk action bar, or use the per-row buttons for a single item',
      "Click an item's name or the folder icon to view its full collateral record",
      "Scroll down to the Movement Timeline Log for this slot's complete history, exportable to CSV",
    ],
  },
  '/archive/reconciliation': {
    title: 'Vault Reconciliation',
    narrative: "Vault Reconciliation is a periodic stock-take: walk a vault, room, or cabinet slot by slot and confirm its physical contents match what the system has on record. Any mismatch becomes a tracked discrepancy — the affected collateral is marked Missing in Custody and logged to the audit trail, instead of silently going unnoticed.",
    steps: {
      credit_officer: [
        'Click "Start New Session" and pick the vault, room, or cabinet you\'re about to walk',
        'For each slot, click "All Present" if its contents match, or "Report Discrepancy" and check off anything not physically found',
        'Once every slot is reviewed, click "Complete Session" — it stays blocked until nothing is left pending',
      ],
      legal_officer: [
        'Click "Start New Session" and pick the vault, room, or cabinet you\'re about to walk',
        'For each slot, click "All Present" if its contents match, or "Report Discrepancy" and check off anything not physically found',
        'Once every slot is reviewed, click "Complete Session" — it stays blocked until nothing is left pending',
      ],
      system_admin: [
        'You have the same reconciliation rights as a Credit or Legal Officer',
        'A session can be resumed later if interrupted, or cancelled if abandoned',
      ],
      default: [
        'You can view sessions and their progress, but only a Credit Officer, Legal Officer, or System Admin can review a slot',
      ],
    },
  },
};

export function getPageHelp(pathname: string): PageHelpContent | null {
  if (PAGE_HELP[pathname]) return PAGE_HELP[pathname];
  // Support a key like '/archive/vault-slot' matching a dynamic route such as '/archive/vault-slot/<id>'.
  const prefixKey = Object.keys(PAGE_HELP).find((key) => pathname.startsWith(`${key}/`));
  return prefixKey ? PAGE_HELP[prefixKey] : null;
}

export function resolvePageHelpSteps(content: PageHelpContent, role: string | null | undefined): string[] {
  if (Array.isArray(content.steps)) return content.steps;
  return content.steps[role ?? ''] ?? content.steps.default ?? [];
}
