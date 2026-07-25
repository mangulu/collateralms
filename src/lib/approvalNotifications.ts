/**
 * Approval Queue Notification Utilities
 *
 * Handles:
 *  - Browser desktop notifications (Web Notifications API)
 *  - Optional SMS alerts via the existing /api/sms/send-alert route
 */

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? '';

// ─── Desktop Notifications ────────────────────────────────────────────────────

/**
 * Request browser notification permission.
 * Returns the resulting permission state.
 */
export async function requestDesktopPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return Notification.requestPermission();
}

/**
 * Show a browser desktop notification.
 * Silently no-ops if permission is not granted or API is unavailable.
 */
export function showDesktopNotification(
  title: string,
  options?: { body?: string; icon?: string; tag?: string; url?: string }
): void {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const n = new Notification(title, {
    body: options?.body,
    icon: options?.icon ?? '/favicon.ico',
    tag: options?.tag,
  });

  if (options?.url) {
    n.onclick = () => {
      window.focus();
      window.open(options.url, '_blank');
    };
  }
}

// ─── Approval-specific notification builders ─────────────────────────────────

export interface PerfectionAlertPayload {
  requestId: string;
  collateralId: string;
  obligor: string;
  status: string;
  priority?: string;
}

export interface ReleaseAlertPayload {
  collateralId: string;
  obligor?: string;
  newStatus: string;
}

/**
 * Fire a desktop notification for a new/updated perfection request.
 */
export function notifyPerfectionRequest(payload: PerfectionAlertPayload): void {
  const isNew = payload.status === 'Submitted';
  const title = isNew
    ? `New Perfection Request — ${payload.collateralId}`
    : `Perfection Request Updated — ${payload.collateralId}`;
  const body = isNew
    ? `${payload.obligor} submitted a perfection request${payload.priority === 'High' ? ' (HIGH PRIORITY)' : ''}. Action required.`
    : `Status changed to "${payload.status}" for ${payload.obligor}.`;

  showDesktopNotification(title, {
    body,
    tag: `perfection-${payload.requestId}`,
    url: `${APP_URL}/approval-inbox`,
  });
}

/**
 * Fire a desktop notification for a collateral release/discharge status change.
 */
export function notifyReleaseRequest(payload: ReleaseAlertPayload): void {
  const title = `Release Request — ${payload.collateralId}`;
  const body = `Collateral ${payload.collateralId}${payload.obligor ? ` (${payload.obligor})` : ''} status changed to "${payload.newStatus}".`;

  showDesktopNotification(title, {
    body,
    tag: `release-${payload.collateralId}`,
    url: `${APP_URL}/release-approval`,
  });
}

// ─── SMS Alert Triggers ───────────────────────────────────────────────────────

export interface SmsTriggerOptions {
  /** Phone number to send to (E.164 format, e.g. +255712345678) */
  phone: string;
  recipientName?: string;
}

/**
 * Send an SMS alert for a new perfection request via the existing API route.
 * Returns silently on error — SMS is optional and must not block the UI.
 */
export async function sendPerfectionSmsAlert(
  payload: PerfectionAlertPayload,
  smsOptions: SmsTriggerOptions
): Promise<void> {
  try {
    const message = `[CollateralMS] Approval required: Perfection request for ${payload.collateralId} (${payload.obligor}) is ${payload.status}${payload.priority === 'High' ? ' — HIGH PRIORITY' : ''}. Review: ${APP_URL}/approval-inbox`;

    await fetch('/api/sms/send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: smsOptions.phone,
        message,
        alertType: 'APPROVAL_REQUEST',
        collateralId: payload.collateralId,
        recipientName: smsOptions.recipientName,
        actionUrl: `${APP_URL}/approval-inbox`,
      }),
    });
  } catch {
    // SMS is optional — swallow errors silently
  }
}

/**
 * Send an SMS alert for a collateral release/discharge event.
 */
export async function sendReleaseSmsAlert(
  payload: ReleaseAlertPayload,
  smsOptions: SmsTriggerOptions
): Promise<void> {
  try {
    const message = `[CollateralMS] Release request update: Collateral ${payload.collateralId} status changed to "${payload.newStatus}". Review: ${APP_URL}/release-approval`;

    await fetch('/api/sms/send-alert', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: smsOptions.phone,
        message,
        alertType: 'APPROVAL_REQUEST',
        collateralId: payload.collateralId,
        recipientName: smsOptions.recipientName,
        actionUrl: `${APP_URL}/release-approval`,
      }),
    });
  } catch {
    // SMS is optional — swallow errors silently
  }
}
