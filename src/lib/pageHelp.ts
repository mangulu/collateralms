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
      'Delete an alert once you\'re done with it — select multiple and use the bulk Delete button to clear several at once',
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
      'Attach a scanned document (PDF, JPG, PNG, DOCX) while filing — optional, but recommended',
      'A physical reference (PHY-YYYYMMDD-XXXX) is auto-generated for each filing but can be edited',
    ],
  },
  '/archive/documents-library': {
    title: 'Documents Library',
    narrative: "Documents Library is a read-only reference library of every collateral-linked document uploaded across the system, with full version history. To upload or manage documents, use Document Management instead — this page is for browsing and downloading only.",
    steps: [
      'Use the search box or the type filter to narrow down by file name, owner, or document type',
      'Click "History" on a document to see all its prior versions and roll back if needed',
      'Click "Download" to open the current version in a new tab',
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
    narrative: 'Occupancy Heatmap shows real-time room, shelf, and slot occupancy across every vault, with capacity alerts and filing/retrieval trends drawn from the archive audit log.',
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
