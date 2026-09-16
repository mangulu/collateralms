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
};

export function getPageHelp(pathname: string): PageHelpContent | null {
  return PAGE_HELP[pathname] ?? null;
}

export function resolvePageHelpSteps(content: PageHelpContent, role: string | null | undefined): string[] {
  if (Array.isArray(content.steps)) return content.steps;
  return content.steps[role ?? ''] ?? content.steps.default ?? [];
}
