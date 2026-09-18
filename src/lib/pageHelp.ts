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
      'Click Refresh to recompute every KPI and chart from the latest data',
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
  '/ai-risk-fraud': {
    title: 'AI Risk & Fraud',
    narrative: 'AI Risk & Fraud combines two AI-driven tools in one place: Fraud Prevention, which detects suspicious submission patterns and tracks fraud alerts through to resolution, and Risk Assessment, which runs a full AI risk analysis on any collateral record. Both are also reachable as their own standalone pages (via alert links, SMS, and other pages) — this page just tabs between them.',
    steps: [
      'Use the tab bar to switch between AI Fraud Prevention and AI Risk Assessment — see each one\'s own help for details',
      'Fraud Prevention: click "Run AI Analysis" to screen a submission, then Mark False Positive or Escalate for Investigation on any resulting alert',
      'Risk Assessment: pick a live collateral record or enter details manually, then click Run Assessment for a scored, multi-dimension AI risk analysis',
    ],
  },
  '/fraud-prevention': {
    title: 'AI Fraud Prevention',
    narrative: "AI Fraud Prevention screens collateral submissions for suspicious patterns — duplicate titles, identity mismatches, valuation anomalies, and more — and tracks every resulting alert through to a resolution (false positive, escalated, or resolved). It's also reachable as the Fraud tab inside AI Risk & Fraud.",
    steps: [
      'Click "Run AI Analysis" and fill in the submission details to screen it before it\'s accepted',
      'Review flagged alerts in the list below — expand one for the full detail behind the flag',
      'Mark an alert as a False Positive to clear it, or Escalate for Investigation if it needs follow-up',
      'Use "Send Fraud Alert SMS" to notify the right officer directly about a specific alert',
    ],
  },
  '/risk-assessment': {
    title: 'AI Risk Assessment',
    narrative: "AI Risk Assessment runs a full AI-driven risk analysis on a collateral record — legal, financial, and operational dimensions, an overall score and level, and a plain-language narrative for each — using either a live record from the registry or details you enter manually. It's also reachable as the Risk tab inside AI Risk & Fraud.",
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
