'use client';

import { createClient } from '@/lib/supabase/client';

export type PerfectionRequestStatus =
  | 'Draft' |'Submitted' |'Under Review' |'Approved' |'Perfected' |'Rejected' |'Returned';

export type PerfectionAction =
  | 'submitted' |'reviewed' |'approved' |'rejected' |'returned' |'commented' |'reopened';

export interface PerfectionRequest {
  id: string;
  collateralRecordId: string | null;
  collateralId: string;
  obligor: string;
  collateralType: string;
  registry: string;
  perfectionDeadline: string;
  requestStatus: PerfectionRequestStatus;
  submittedBy: string | null;
  submittedByName: string;
  submittedAt: string | null;
  reviewedBy: string | null;
  reviewedByName: string;
  reviewedAt: string | null;
  decisionNotes: string;
  priority: string;
  createdAt: string;
  updatedAt: string;
}

export interface PerfectionComment {
  id: string;
  perfectionRequestId: string;
  action: PerfectionAction;
  comment: string;
  performedBy: string | null;
  performedByName: string;
  performedByRole: string;
  createdAt: string;
}

export interface PerfectionStatusHistory {
  id: string;
  perfectionRequestId: string;
  fromStatus: string | null;
  toStatus: string;
  reason: string;
  changedBy: string | null;
  changedByName: string;
  changedByRole: string;
  createdAt: string;
}

function rowToRequest(row: any): PerfectionRequest {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id,
    collateralId: row.collateral_id,
    obligor: row.obligor,
    collateralType: row.collateral_type,
    registry: row.registry,
    perfectionDeadline: row.perfection_deadline ?? '',
    requestStatus: row.request_status as PerfectionRequestStatus,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_name ?? '',
    submittedAt: row.submitted_at,
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewed_by_name ?? '',
    reviewedAt: row.reviewed_at,
    decisionNotes: row.decision_notes ?? '',
    priority: row.priority ?? 'Normal',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToComment(row: any): PerfectionComment {
  return {
    id: row.id,
    perfectionRequestId: row.perfection_request_id,
    action: row.action as PerfectionAction,
    comment: row.comment,
    performedBy: row.performed_by,
    performedByName: row.performed_by_name ?? '',
    performedByRole: row.performed_by_role ?? '',
    createdAt: row.created_at,
  };
}

function rowToHistory(row: any): PerfectionStatusHistory {
  return {
    id: row.id,
    perfectionRequestId: row.perfection_request_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    reason: row.reason ?? '',
    changedBy: row.changed_by,
    changedByName: row.changed_by_name ?? '',
    changedByRole: row.changed_by_role ?? '',
    createdAt: row.created_at,
  };
}

export const perfectionService = {
  async getAll(): Promise<PerfectionRequest[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('perfection_requests')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToRequest);
  },

  async getById(id: string): Promise<PerfectionRequest | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('perfection_requests')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) throw error;
    return data ? rowToRequest(data) : null;
  },

  async create(
    payload: {
      collateralRecordId?: string;
      collateralId: string;
      obligor: string;
      collateralType: string;
      registry: string;
      perfectionDeadline: string;
      priority: string;
    },
    userId: string,
    userName: string
  ): Promise<PerfectionRequest | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('perfection_requests')
      .insert({
        collateral_record_id: payload.collateralRecordId ?? null,
        collateral_id: payload.collateralId,
        obligor: payload.obligor,
        collateral_type: payload.collateralType,
        registry: payload.registry,
        perfection_deadline: payload.perfectionDeadline,
        request_status: 'Draft',
        submitted_by: userId,
        submitted_by_name: userName,
        priority: payload.priority,
      })
      .select()
      .single();
    if (error) throw error;
    return data ? rowToRequest(data) : null;
  },

  async submit(
    id: string,
    userId: string,
    userName: string,
    comment: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('perfection_requests')
      .update({
        request_status: 'Submitted',
        submitted_by: userId,
        submitted_by_name: userName,
        submitted_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { error: commentError } = await supabase
      .from('perfection_comments')
      .insert({
        perfection_request_id: id,
        action: 'submitted',
        comment: comment || 'Perfection request submitted for Legal Officer review.',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });
    if (commentError) throw commentError;
    return true;
  },

  async startReview(
    id: string,
    userId: string,
    userName: string,
    comment: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('perfection_requests')
      .update({
        request_status: 'Under Review',
        reviewed_by: userId,
        reviewed_by_name: userName,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { error: commentError } = await supabase
      .from('perfection_comments')
      .insert({
        perfection_request_id: id,
        action: 'reviewed',
        comment: comment || 'Review started.',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });
    if (commentError) throw commentError;
    return true;
  },

  async approve(
    id: string,
    userId: string,
    userName: string,
    decisionNotes: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();

    // Fetch current record for audit trail + workflow instance linking
    const { data: current } = await supabase
      .from('perfection_requests')
      .select('request_status, collateral_id, title')
      .eq('id', id)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from('perfection_requests')
      .update({
        request_status: 'Approved',
        reviewed_by: userId,
        reviewed_by_name: userName,
        reviewed_at: new Date().toISOString(),
        decision_notes: decisionNotes,
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { error: commentError } = await supabase
      .from('perfection_comments')
      .insert({
        perfection_request_id: id,
        action: 'approved',
        comment: decisionNotes || 'Perfection approved.',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });
    if (commentError) throw commentError;

    // ── Write audit trail ────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      collateral_id: current?.collateral_id ?? null,
      entity_type: 'perfection_request',
      action: 'approved',
      message: `Perfection request approved: ${current?.title ?? id}`,
      detail: `Status changed from ${current?.request_status ?? 'Under Review'} to Approved. ${decisionNotes ? `Notes: ${decisionNotes}` : ''}`,
      reason: decisionNotes || null,
      performed_by: userId,
      performed_by_name: userName,
      event_category: 'status_transition',
      field_changes: [
        { field: 'request_status', label: 'Status', old_value: current?.request_status ?? 'Under Review', new_value: 'Approved' },
      ],
    }).then(() => {}).catch((e) => console.warn('[perfection] audit log failed:', e.message));

    // ── Sync workflow_instances ──────────────────────────────────────────────
    await _syncWorkflowInstance(supabase, id, 'perfection_request', 'approve', userId, userName, userRole, decisionNotes);

    return true;
  },

  async reject(
    id: string,
    userId: string,
    userName: string,
    decisionNotes: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();

    const { data: current } = await supabase
      .from('perfection_requests')
      .select('request_status, collateral_id, title')
      .eq('id', id)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from('perfection_requests')
      .update({
        request_status: 'Rejected',
        reviewed_by: userId,
        reviewed_by_name: userName,
        reviewed_at: new Date().toISOString(),
        decision_notes: decisionNotes,
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { error: commentError } = await supabase
      .from('perfection_comments')
      .insert({
        perfection_request_id: id,
        action: 'rejected',
        comment: decisionNotes || 'Perfection rejected.',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });
    if (commentError) throw commentError;

    // ── Write audit trail ────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      collateral_id: current?.collateral_id ?? null,
      entity_type: 'perfection_request',
      action: 'rejected',
      message: `Perfection request rejected: ${current?.title ?? id}`,
      detail: `Status changed from ${current?.request_status ?? 'Under Review'} to Rejected. Reason: ${decisionNotes}`,
      reason: decisionNotes || null,
      performed_by: userId,
      performed_by_name: userName,
      event_category: 'status_transition',
      field_changes: [
        { field: 'request_status', label: 'Status', old_value: current?.request_status ?? 'Under Review', new_value: 'Rejected' },
      ],
    }).then(() => {}).catch((e) => console.warn('[perfection] audit log failed:', e.message));

    // ── Sync workflow_instances ──────────────────────────────────────────────
    await _syncWorkflowInstance(supabase, id, 'perfection_request', 'reject', userId, userName, userRole, decisionNotes);

    return true;
  },

  async returnForRevision(
    id: string,
    userId: string,
    userName: string,
    decisionNotes: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();
    const { error: updateError } = await supabase
      .from('perfection_requests')
      .update({
        request_status: 'Returned',
        reviewed_by: userId,
        reviewed_by_name: userName,
        reviewed_at: new Date().toISOString(),
        decision_notes: decisionNotes,
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { error: commentError } = await supabase
      .from('perfection_comments')
      .insert({
        perfection_request_id: id,
        action: 'returned',
        comment: decisionNotes || 'Returned for revision.',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });
    if (commentError) throw commentError;
    return true;
  },

  async addComment(
    id: string,
    userId: string,
    userName: string,
    comment: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('perfection_comments').insert({
      perfection_request_id: id,
      action: 'commented',
      comment,
      performed_by: userId,
      performed_by_name: userName,
      performed_by_role: userRole,
    });
    if (error) throw error;
    return true;
  },

  async getComments(requestId: string): Promise<PerfectionComment[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('perfection_comments')
      .select('*')
      .eq('perfection_request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToComment);
  },

  async perfected(
    id: string,
    userId: string,
    userName: string,
    decisionNotes: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();

    const { data: current } = await supabase
      .from('perfection_requests')
      .select('request_status, collateral_id, title')
      .eq('id', id)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from('perfection_requests')
      .update({
        request_status: 'Perfected',
        reviewed_by: userId,
        reviewed_by_name: userName,
        reviewed_at: new Date().toISOString(),
        decision_notes: decisionNotes,
      })
      .eq('id', id);
    if (updateError) throw updateError;

    const { error: commentError } = await supabase
      .from('perfection_comments')
      .insert({
        perfection_request_id: id,
        action: 'approved',
        comment: decisionNotes || 'Collateral perfected successfully.',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });
    if (commentError) throw commentError;

    // ── Write audit trail ────────────────────────────────────────────────────
    await supabase.from('audit_logs').insert({
      collateral_id: current?.collateral_id ?? null,
      entity_type: 'perfection_request',
      action: 'perfected',
      message: `Collateral perfected: ${current?.title ?? id}`,
      detail: `Status changed from ${current?.request_status ?? 'Under Review'} to Perfected. ${decisionNotes ? `Notes: ${decisionNotes}` : ''}`,
      reason: decisionNotes || null,
      performed_by: userId,
      performed_by_name: userName,
      event_category: 'status_transition',
      field_changes: [
        { field: 'request_status', label: 'Status', old_value: current?.request_status ?? 'Under Review', new_value: 'Perfected' },
      ],
    }).then(() => {}).catch((e) => console.warn('[perfection] audit log failed:', e.message));

    // ── Sync workflow_instances ──────────────────────────────────────────────
    await _syncWorkflowInstance(supabase, id, 'perfection_request', 'approve', userId, userName, userRole, decisionNotes);

    return true;
  },

  async getStatusHistory(requestId: string): Promise<PerfectionStatusHistory[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('perfection_status_history')
      .select('*')
      .eq('perfection_request_id', requestId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToHistory);
  },
};

// ── Internal helper: sync workflow_instance state on approve/reject ────────────

async function _syncWorkflowInstance(
  supabase: ReturnType<typeof createClient>,
  referenceId: string,
  referenceType: string,
  action: 'approve' | 'reject',
  performedBy: string,
  performedByName: string,
  performedByRole: string,
  comment?: string,
): Promise<void> {
  try {
    const { data: instances } = await supabase
      .from('workflow_instances')
      .select('id, instance_status')
      .eq('reference_id', referenceId)
      .eq('reference_type', referenceType)
      .in('instance_status', ['active', 'escalated'])
      .limit(1);

    const instance = instances?.[0];
    if (!instance) return;

    const { data: currentStep } = await supabase
      .from('workflow_instance_steps')
      .select('id, step_id')
      .eq('instance_id', instance.id)
      .eq('step_status', 'active')
      .maybeSingle();

    const now = new Date().toISOString();
    if (currentStep) {
      await supabase.from('workflow_instance_steps').update({
        step_status: action === 'approve' ? 'completed' : 'rejected',
        completed_at: now,
        completed_by: performedBy,
        action_taken: action,
        notes: comment ?? null,
      }).eq('id', currentStep.id);
    }

    await supabase.from('workflow_instances').update({
      instance_status: action === 'approve' ? 'completed' : 'cancelled',
      current_step_id: null,
      completed_by: performedBy,
      completed_at: now,
    }).eq('id', instance.id);

    await supabase.from('workflow_transition_log').insert({
      instance_id: instance.id,
      instance_step_id: currentStep?.id ?? null,
      from_step_id: currentStep?.step_id ?? null,
      to_step_id: null,
      action,
      performed_by: performedBy,
      performed_by_name: performedByName,
      performed_by_role: performedByRole,
      comment: comment ?? null,
    });
  } catch (err) {
    console.warn('[perfection] workflow instance sync failed:', err);
  }
}
