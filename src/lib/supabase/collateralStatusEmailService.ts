/**
 * Collateral Status Email Service
 *
 * Sends Resend email alerts when a collateral moves to Rejected, Released, or Perfected status.
 * Notifies the loan officer (assigned_officer resolved via user_profiles) and the
 * legal assignee (users with role 'legal_officer' linked to the collateral record).
 *
 * Resolution strategy:
 *  1. Look up the collateral_record by ID to get collateral details + assigned_officer name
 *  2. Resolve the assigned officer's email from user_profiles by full_name match
 *  3. Resolve legal officers from user_profiles by role = 'legal_officer'
 *  4. De-duplicate recipients and send via the edge function
 */

import { createClient } from '@/lib/supabase/client';

export type CollateralAlertStatus = 'Rejected' | 'Released' | 'Perfected';

export interface CollateralStatusEmailPayload {
  /** UUID of the collateral_record */
  collateralRecordId: string;
  /** The new status that triggered the alert */
  newStatus: CollateralAlertStatus;
  /** Name of the user who performed the action */
  changedBy: string;
  /** Optional notes / decision reason */
  notes?: string;
  /** Workflow that triggered the change, e.g. "Perfection Workflow" */
  workflowType?: string;
}

interface Recipient {
  name: string;
  email: string;
}

const ALERT_STATUSES: CollateralAlertStatus[] = ['Rejected', 'Released', 'Perfected'];

/**
 * Resolve email recipients for a collateral status change.
 * Returns the assigned officer + all legal officers, de-duplicated.
 */
async function resolveRecipients(
  supabase: ReturnType<typeof createClient>,
  collateralRecordId: string,
  assignedOfficerName: string | null
): Promise<Recipient[]> {
  const recipientMap = new Map<string, Recipient>();

  // 1. Resolve assigned officer by full_name
  if (assignedOfficerName) {
    const { data: officerRows } = await supabase
      .from('user_profiles')
      .select('full_name, email')
      .ilike('full_name', assignedOfficerName.trim())
      .limit(1);

    const officer = officerRows?.[0];
    if (officer?.email) {
      recipientMap.set(officer.email.toLowerCase(), {
        name: officer.full_name ?? assignedOfficerName,
        email: officer.email,
      });
    }
  }

  // 2. Resolve legal officers by role
  const { data: legalRows } = await supabase
    .from('user_profiles')
    .select('full_name, email')
    .eq('role', 'legal_officer')
    .eq('is_active', true);

  for (const row of legalRows ?? []) {
    if (row.email) {
      recipientMap.set(row.email.toLowerCase(), {
        name: row.full_name ?? row.email,
        email: row.email,
      });
    }
  }

  return Array.from(recipientMap.values());
}

/**
 * Send collateral status change email alerts.
 * Only fires for Rejected, Released, and Perfected statuses.
 * Silently skips for other statuses.
 */
export async function sendCollateralStatusEmail(
  payload: CollateralStatusEmailPayload
): Promise<void> {
  if (!ALERT_STATUSES.includes(payload.newStatus)) return;

  const supabase = createClient();

  // Fetch collateral record details
  const { data: record } = await supabase
    .from('collateral_records')
    .select('collateral_id, description, obligor, collateral_type, assigned_officer')
    .eq('id', payload.collateralRecordId)
    .maybeSingle();

  if (!record) {
    console.warn('[collateralStatusEmail] Collateral record not found:', payload.collateralRecordId);
    return;
  }

  const recipients = await resolveRecipients(
    supabase,
    payload.collateralRecordId,
    record.assigned_officer ?? null
  );

  if (recipients.length === 0) {
    console.warn('[collateralStatusEmail] No recipients found for collateral:', payload.collateralRecordId);
    return;
  }

  try {
    const res = await fetch('/api/collateral/send-status-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        newStatus: payload.newStatus,
        collateralId: record.collateral_id,
        collateralDescription: record.description,
        obligor: record.obligor,
        collateralType: record.collateral_type,
        changedBy: payload.changedBy,
        notes: payload.notes ?? null,
        workflowType: payload.workflowType ?? null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[collateralStatusEmail] Failed to send email:', err);
    }
  } catch (err) {
    console.error('[collateralStatusEmail] Network error sending status email:', err);
  }
}
