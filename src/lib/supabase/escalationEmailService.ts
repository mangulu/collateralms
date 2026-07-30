/**
 * Escalation Email Service
 *
 * Sends email notifications when workflow escalation actions
 * "notify_manager" or "notify_and_hold" are triggered.
 *
 * Role → email resolution uses the profiles table (email column).
 * If no profiles are found for a role, the call is a no-op (no error thrown).
 */

import { createClient } from '@/lib/supabase/client';
import { WorkflowEscalationAction } from './workflowEngineService';

export interface EscalationEmailPayload {
  escalationAction: WorkflowEscalationAction;
  workflowName: string;
  stepName: string;
  referenceLabel: string | null;
  referenceType: string;
  instanceId: string;
  triggeredBy: string | null;
  slaHours: number | null;
  comment?: string;
  /** Roles to notify (from step.escalationNotifyRoles). Falls back to ['credit_manager'] */
  notifyRoles: string[];
}

interface RecipientEmail {
  name: string;
  email: string;
}

/**
 * Resolve email addresses for a list of roles from the profiles table.
 */
async function resolveRoleEmails(roles: string[]): Promise<RecipientEmail[]> {
  if (roles.length === 0) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from('profiles')
    .select('full_name, email, role')
    .in('role', roles);

  if (error || !data) return [];

  return data
    .filter((p: any) => p.email)
    .map((p: any) => ({ name: p.full_name ?? p.email, email: p.email }));
}

/**
 * Send escalation notification emails.
 * Only fires for notify_manager and notify_and_hold actions.
 * Silently skips for other escalation action types.
 */
export async function sendEscalationEmails(payload: EscalationEmailPayload): Promise<void> {
  const { escalationAction } = payload;

  // Only send emails for notification-based escalation actions
  if (escalationAction !== 'notify_manager' && escalationAction !== 'notify_and_hold') {
    return;
  }

  // Determine roles to notify — use configured roles or fall back to credit_manager
  const rolesToNotify =
    payload.notifyRoles && payload.notifyRoles.length > 0
      ? payload.notifyRoles
      : ['credit_manager'];

  const recipients = await resolveRoleEmails(rolesToNotify);

  if (recipients.length === 0) {
    console.warn('[escalationEmailService] No email recipients found for roles:', rolesToNotify);
    return;
  }

  try {
    const res = await fetch('/api/workflow/send-escalation-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: recipients,
        escalationAction: payload.escalationAction,
        workflowName: payload.workflowName,
        stepName: payload.stepName,
        referenceLabel: payload.referenceLabel,
        referenceType: payload.referenceType,
        instanceId: payload.instanceId,
        triggeredBy: payload.triggeredBy,
        slaHours: payload.slaHours,
        comment: payload.comment ?? null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.error('[escalationEmailService] Failed to send escalation email:', err);
    }
  } catch (err) {
    console.error('[escalationEmailService] Network error sending escalation email:', err);
  }
}
