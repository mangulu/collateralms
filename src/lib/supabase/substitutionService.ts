'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SubstitutionStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected' | 'Completed';

export interface CollateralSubstitution {
  id: string;
  facilityId: string;
  loanId: string | null;
  outgoingCollateralId: string | null;
  incomingCollateralId: string | null;
  reason: string;
  substitutionStatus: SubstitutionStatus;
  requestedBy: string | null;
  requestedAt: string;
  reviewedBy: string | null;
  reviewedAt: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  effectiveDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  // joined
  outgoingDescription?: string;
  outgoingType?: string;
  incomingDescription?: string;
  incomingType?: string;
  requestedByName?: string;
  approvedByName?: string;
}

export interface SubstitutionAuditEntry {
  id: string;
  substitutionId: string;
  action: string;
  performedBy: string | null;
  performedByName: string | null;
  oldStatus: string | null;
  newStatus: string | null;
  notes: string | null;
  createdAt: string;
}

function rowToSubstitution(row: any): CollateralSubstitution {
  return {
    id: row.id,
    facilityId: row.facility_id,
    loanId: row.loan_id,
    outgoingCollateralId: row.outgoing_collateral_id,
    incomingCollateralId: row.incoming_collateral_id,
    reason: row.reason,
    substitutionStatus: row.substitution_status,
    requestedBy: row.requested_by,
    requestedAt: row.requested_at,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    approvedBy: row.approved_by,
    approvedAt: row.approved_at,
    rejectionReason: row.rejection_reason,
    effectiveDate: row.effective_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    outgoingDescription: row.outgoing?.description,
    outgoingType: row.outgoing?.collateral_type,
    incomingDescription: row.incoming?.description,
    incomingType: row.incoming?.collateral_type,
    requestedByName: row.requester?.full_name,
    approvedByName: row.approver?.full_name,
  };
}

// ─── Service Functions ────────────────────────────────────────────────────────

export async function listSubstitutions(filters?: {
  status?: SubstitutionStatus;
}): Promise<CollateralSubstitution[]> {
  const supabase = createClient();
  let query = supabase
    .from('collateral_substitutions')
    .select(`
      *,
      outgoing:collateral_records!outgoing_collateral_id(description, collateral_type),
      incoming:collateral_records!incoming_collateral_id(description, collateral_type),
      requester:user_profiles!requested_by(full_name),
      approver:user_profiles!approved_by(full_name)
    `)
    .order('requested_at', { ascending: false });

  if (filters?.status) query = query.eq('substitution_status', filters.status);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []).map(rowToSubstitution);
}

export async function createSubstitution(payload: {
  facilityId: string;
  loanId?: string;
  outgoingCollateralId?: string;
  incomingCollateralId?: string;
  reason: string;
  notes?: string;
  requestedBy?: string;
}): Promise<CollateralSubstitution> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_substitutions')
    .insert({
      facility_id: payload.facilityId,
      loan_id: payload.loanId,
      outgoing_collateral_id: payload.outgoingCollateralId,
      incoming_collateral_id: payload.incomingCollateralId,
      reason: payload.reason,
      notes: payload.notes,
      requested_by: payload.requestedBy,
      substitution_status: 'Pending',
    })
    .select('*')
    .single();
  if (error) throw error;
  return rowToSubstitution(data);
}

export async function updateSubstitutionStatus(
  id: string,
  newStatus: SubstitutionStatus,
  userId: string,
  userName: string,
  oldStatus: string,
  notes?: string,
  rejectionReason?: string,
  effectiveDate?: string,
  userRole?: string,
): Promise<void> {
  const supabase = createClient();

  // Fetch substitution for collateral IDs
  const { data: substitution } = await supabase
    .from('collateral_substitutions')
    .select('outgoing_collateral_id, incoming_collateral_id')
    .eq('id', id)
    .maybeSingle();

  const updatePayload: any = { substitution_status: newStatus };
  if (newStatus === 'Approved') {
    updatePayload.approved_by = userId;
    updatePayload.approved_at = new Date().toISOString();
    if (effectiveDate) updatePayload.effective_date = effectiveDate;
  } else if (newStatus === 'Under Review') {
    updatePayload.reviewed_by = userId;
    updatePayload.reviewed_at = new Date().toISOString();
  } else if (newStatus === 'Rejected') {
    updatePayload.rejection_reason = rejectionReason;
  }

  const { error: updateError } = await supabase
    .from('collateral_substitutions')
    .update(updatePayload)
    .eq('id', id);
  if (updateError) throw updateError;

  // ── Write back collateral_records.status on Approve ──────────────────────
  if (newStatus === 'Approved') {
    const outgoingId = substitution?.outgoing_collateral_id ?? null;
    const incomingId = substitution?.incoming_collateral_id ?? null;

    if (outgoingId) {
      await supabase
        .from('collateral_records')
        .update({ status: 'Released' })
        .eq('id', outgoingId)
        .then(() => {})
        .catch((e) => console.warn('[substitution] outgoing collateral status write-back failed:', e.message));
    }
    if (incomingId) {
      await supabase
        .from('collateral_records')
        .update({ status: 'Monitoring' })
        .eq('id', incomingId)
        .then(() => {})
        .catch((e) => console.warn('[substitution] incoming collateral status write-back failed:', e.message));
    }
  }

  // Append substitution-specific audit trail
  await supabase.from('substitution_audit_trail').insert({
    substitution_id: id,
    action: `Status changed to ${newStatus}`,
    performed_by: userId,
    performed_by_name: userName,
    old_status: oldStatus,
    new_status: newStatus,
    notes,
  });

  // ── Write to global audit_logs ─────────────────────────────────────────────
  const actionLabel = newStatus === 'Approved' ? 'approved' : newStatus === 'Rejected' ? 'rejected' : 'status_changed';
  await supabase.from('audit_logs').insert({
    entity_type: 'collateral_substitution',
    action: actionLabel,
    message: `Collateral substitution ${actionLabel}: ${id}`,
    detail: `Status changed from ${oldStatus} to ${newStatus}${notes ? `. Notes: ${notes}` : ''}${rejectionReason ? `. Reason: ${rejectionReason}` : ''}`,
    reason: rejectionReason ?? notes ?? null,
    performed_by: userId,
    performed_by_name: userName,
    event_category: 'status_transition',
    field_changes: [
      { field: 'substitution_status', label: 'Status', old_value: oldStatus, new_value: newStatus },
    ],
  }).then(() => {}).catch((e) => console.warn('[substitution] audit log failed:', e.message));

  // ── Sync workflow_instances if a linked instance exists ────────────────────
  if (newStatus === 'Approved' || newStatus === 'Rejected') {
    try {
      const { data: instances } = await supabase
        .from('workflow_instances')
        .select('id, instance_status')
        .eq('reference_id', id)
        .eq('reference_type', 'collateral_substitution')
        .in('instance_status', ['active', 'escalated'])
        .limit(1);

      const instance = instances?.[0];
      if (instance) {
        const wfAction = newStatus === 'Approved' ? 'approve' : 'reject';
        const { data: currentStep } = await supabase
          .from('workflow_instance_steps')
          .select('id, step_id')
          .eq('instance_id', instance.id)
          .eq('step_status', 'active')
          .maybeSingle();

        const now = new Date().toISOString();
        if (currentStep) {
          await supabase.from('workflow_instance_steps').update({
            step_status: wfAction === 'approve' ? 'completed' : 'rejected',
            completed_at: now,
            completed_by: userId,
            action_taken: wfAction,
            notes: notes ?? rejectionReason ?? null,
          }).eq('id', currentStep.id);
        }

        await supabase.from('workflow_instances').update({
          instance_status: wfAction === 'approve' ? 'completed' : 'cancelled',
          current_step_id: null,
          completed_by: userId,
          completed_at: now,
        }).eq('id', instance.id);

        await supabase.from('workflow_transition_log').insert({
          instance_id: instance.id,
          instance_step_id: currentStep?.id ?? null,
          from_step_id: currentStep?.step_id ?? null,
          to_step_id: null,
          action: wfAction,
          performed_by: userId,
          performed_by_name: userName,
          performed_by_role: userRole ?? null,
          comment: notes ?? rejectionReason ?? null,
        }).then(() => {}).catch((e) => console.warn('[substitution] workflow transition log failed:', e.message));
      }
    } catch (err) {
      console.warn('[substitution] workflow instance sync failed:', err);
    }
  }
}

export async function getSubstitutionAuditTrail(
  substitutionId: string
): Promise<SubstitutionAuditEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('substitution_audit_trail')
    .select('*')
    .eq('substitution_id', substitutionId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    substitutionId: row.substitution_id,
    action: row.action,
    performedBy: row.performed_by,
    performedByName: row.performed_by_name,
    oldStatus: row.old_status,
    newStatus: row.new_status,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function getSubstitutionStats(): Promise<{
  total: number;
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
}> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('collateral_substitutions')
    .select('substitution_status');
  if (error) throw error;
  const rows = data ?? [];
  return {
    total: rows.length,
    pending: rows.filter((r) => r.substitution_status === 'Pending').length,
    underReview: rows.filter((r) => r.substitution_status === 'Under Review').length,
    approved: rows.filter((r) => r.substitution_status === 'Approved').length,
    rejected: rows.filter((r) => r.substitution_status === 'Rejected').length,
  };
}
