'use client';

import { createClient } from '@/lib/supabase/client';
import { sendCollateralStatusEmail } from '@/lib/supabase/collateralStatusEmailService';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ApprovalRequestStatus =
  | 'Pending' |'Under Review' |'Approved' |'Rejected' |'Escalated' |'Returned';

export type ApprovalRequestType =
  | 'Legal Review' |'Credit Assessment' |'Compliance Check' |'Valuation Approval' |'Release Authorization';

export type ApproverRole =
  | 'Legal Officer' |'Credit Manager' |'Compliance Officer' |'Senior Manager' |'System';

export interface CollateralApprovalRequest {
  id: string;
  collateralRecordId: string | null;
  collateralRef: string;
  collateralType: string;
  obligor: string;
  requestType: ApprovalRequestType;
  requestStatus: ApprovalRequestStatus;
  priority: 'High' | 'Normal' | 'Low';
  routedBy: string | null;
  routedByName: string;
  routedAt: string;
  assignedToRole: ApproverRole;
  assignedTo: string | null;
  assignedToName: string;
  reviewedBy: string | null;
  reviewedByName: string;
  reviewedAt: string | null;
  decision: string | null;
  decisionNotes: string | null;
  complianceAttested: boolean;
  complianceAttestedBy: string | null;
  complianceAttestedAt: string | null;
  pipelineStage: number;
  dueDate: string | null;
  collateralValue: number | null;
  loanRef: string | null;
  supportingNotes: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApprovalComment {
  id: string;
  approvalId: string;
  authorId: string | null;
  authorName: string;
  authorRole: string;
  commentText: string;
  isInternal: boolean;
  createdAt: string;
}

export interface ApprovalPipelineLog {
  id: string;
  approvalId: string;
  fromStage: number | null;
  toStage: number;
  fromStatus: string | null;
  toStatus: string;
  changedBy: string | null;
  changedByName: string;
  changedByRole: string;
  reason: string | null;
  createdAt: string;
}

// ── Row Mappers ────────────────────────────────────────────────────────────────

function rowToRequest(row: any): CollateralApprovalRequest {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id,
    collateralRef: row.collateral_ref,
    collateralType: row.collateral_type,
    obligor: row.obligor,
    requestType: row.request_type as ApprovalRequestType,
    requestStatus: row.request_status as ApprovalRequestStatus,
    priority: row.priority as 'High' | 'Normal' | 'Low',
    routedBy: row.routed_by,
    routedByName: row.routed_by_name ?? '',
    routedAt: row.routed_at,
    assignedToRole: row.assigned_to_role as ApproverRole,
    assignedTo: row.assigned_to,
    assignedToName: row.assigned_to_name ?? '',
    reviewedBy: row.reviewed_by,
    reviewedByName: row.reviewed_by_name ?? '',
    reviewedAt: row.reviewed_at,
    decision: row.decision,
    decisionNotes: row.decision_notes,
    complianceAttested: row.compliance_attested ?? false,
    complianceAttestedBy: row.compliance_attested_by,
    complianceAttestedAt: row.compliance_attested_at,
    pipelineStage: row.pipeline_stage ?? 1,
    dueDate: row.due_date,
    collateralValue: row.collateral_value,
    loanRef: row.loan_ref,
    supportingNotes: row.supporting_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToComment(row: any): ApprovalComment {
  return {
    id: row.id,
    approvalId: row.approval_id,
    authorId: row.author_id,
    authorName: row.author_name ?? '',
    authorRole: row.author_role ?? '',
    commentText: row.comment_text,
    isInternal: row.is_internal ?? false,
    createdAt: row.created_at,
  };
}

function rowToLog(row: any): ApprovalPipelineLog {
  return {
    id: row.id,
    approvalId: row.approval_id,
    fromStage: row.from_stage,
    toStage: row.to_stage,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: row.changed_by,
    changedByName: row.changed_by_name ?? '',
    changedByRole: row.changed_by_role ?? '',
    reason: row.reason,
    createdAt: row.created_at,
  };
}

// ── Service ────────────────────────────────────────────────────────────────────

export const collateralApprovalService = {
  async getAll(): Promise<CollateralApprovalRequest[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('collateral_approval_requests')
      .select('*')
      .order('routed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToRequest);
  },

  async getById(id: string): Promise<CollateralApprovalRequest | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('collateral_approval_requests')
      .select('*')
      .eq('id', id)
      .single();
    if (error) return null;
    return rowToRequest(data);
  },

  async getByStatus(status: ApprovalRequestStatus): Promise<CollateralApprovalRequest[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('collateral_approval_requests')
      .select('*')
      .eq('request_status', status)
      .order('routed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToRequest);
  },

  async updateStatus(
    id: string,
    status: ApprovalRequestStatus,
    reviewedById: string,
    reviewedByName: string,
    decisionNotes?: string,
    complianceAttested?: boolean,
    complianceAttestedById?: string,
    reviewedByRole?: string,
  ): Promise<void> {
    const supabase = createClient();

    // Fetch current record for collateral write-back and workflow sync
    const { data: current } = await supabase
      .from('collateral_approval_requests')
      .select('request_status, collateral_record_id')
      .eq('id', id)
      .maybeSingle();

    const updates: any = {
      request_status: status,
      reviewed_by: reviewedById,
      reviewed_by_name: reviewedByName,
      reviewed_at: new Date().toISOString(),
      decision: status,
      decision_notes: decisionNotes ?? null,
    };
    if (complianceAttested) {
      updates.compliance_attested = true;
      updates.compliance_attested_by = complianceAttestedById ?? reviewedById;
      updates.compliance_attested_at = new Date().toISOString();
    }
    if (status === 'Approved' || status === 'Rejected') {
      updates.pipeline_stage = status === 'Approved' ? 5 : 4;
    } else if (status === 'Under Review') {
      updates.pipeline_stage = 3;
    }
    const { error } = await supabase
      .from('collateral_approval_requests')
      .update(updates)
      .eq('id', id);
    if (error) throw error;

    // ── Write back collateral_records.status ─────────────────────────────────
    const collateralRecordId = current?.collateral_record_id ?? null;
    if (collateralRecordId) {
      let newCollateralStatus: string | null = null;
      if (status === 'Approved') newCollateralStatus = 'Monitoring';
      else if (status === 'Rejected') newCollateralStatus = 'Rejected';
      else if (status === 'Returned') newCollateralStatus = 'Under Review';

      if (newCollateralStatus) {
        await supabase
          .from('collateral_records')
          .update({ status: newCollateralStatus })
          .eq('id', collateralRecordId)
          .then(() => {})
          .catch((e) => console.warn('[approvals] collateral status write-back failed:', e.message));

        // ── Send email alert for Rejected status ────────────────────────────
        if (status === 'Rejected') {
          sendCollateralStatusEmail({
            collateralRecordId,
            newStatus: 'Rejected',
            changedBy: reviewedByName,
            notes: decisionNotes || undefined,
            workflowType: 'Collateral Approval',
          }).catch((e) => console.warn('[approvals] status email failed:', e.message));
        }
      }
    }

    // ── Sync workflow_instances ───────────────────────────────────────────────
    if (status === 'Approved' || status === 'Rejected') {
      try {
        const wfAction = status === 'Approved' ? 'approve' : 'reject';
        const { data: instances } = await supabase
          .from('workflow_instances')
          .select('id, instance_status')
          .eq('reference_id', id)
          .eq('reference_type', 'collateral_approval')
          .in('instance_status', ['active', 'escalated'])
          .limit(1);

        const instance = instances?.[0];
        if (instance) {
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
              completed_by: reviewedById,
              action_taken: wfAction,
              notes: decisionNotes ?? null,
            }).eq('id', currentStep.id);
          }

          await supabase.from('workflow_instances').update({
            instance_status: wfAction === 'approve' ? 'completed' : 'cancelled',
            current_step_id: null,
            completed_by: reviewedById,
            completed_at: now,
          }).eq('id', instance.id);

          await supabase.from('workflow_transition_log').insert({
            instance_id: instance.id,
            instance_step_id: currentStep?.id ?? null,
            from_step_id: currentStep?.step_id ?? null,
            to_step_id: null,
            action: wfAction,
            performed_by: reviewedById,
            performed_by_name: reviewedByName,
            performed_by_role: reviewedByRole ?? null,
            comment: decisionNotes ?? null,
          }).then(() => {}).catch((e) => console.warn('[approvals] workflow transition log failed:', e.message));
        }
      } catch (err) {
        console.warn('[approvals] workflow instance sync failed:', err);
      }
    }
  },

  async advancePipelineStage(id: string, stage: number): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('collateral_approval_requests')
      .update({ pipeline_stage: stage })
      .eq('id', id);
    if (error) throw error;
  },

  async getComments(approvalId: string): Promise<ApprovalComment[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('approval_comments')
      .select('*')
      .eq('approval_id', approvalId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToComment);
  },

  async addComment(
    approvalId: string,
    authorId: string,
    authorName: string,
    authorRole: string,
    commentText: string,
    isInternal = false
  ): Promise<ApprovalComment> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('approval_comments')
      .insert({
        approval_id: approvalId,
        author_id: authorId,
        author_name: authorName,
        author_role: authorRole,
        comment_text: commentText,
        is_internal: isInternal,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToComment(data);
  },

  async getPipelineLog(approvalId: string): Promise<ApprovalPipelineLog[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('approval_pipeline_log')
      .select('*')
      .eq('approval_id', approvalId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToLog);
  },

  async logPipelineChange(
    approvalId: string,
    fromStage: number | null,
    toStage: number,
    fromStatus: string | null,
    toStatus: string,
    changedById: string,
    changedByName: string,
    changedByRole: string,
    reason?: string
  ): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('approval_pipeline_log').insert({
      approval_id: approvalId,
      from_stage: fromStage,
      to_stage: toStage,
      from_status: fromStatus,
      to_status: toStatus,
      changed_by: changedById,
      changed_by_name: changedByName,
      changed_by_role: changedByRole,
      reason: reason ?? null,
    });
    if (error) throw error;
  },
};
