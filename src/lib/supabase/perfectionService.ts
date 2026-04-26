'use client';

import { createClient } from '@/lib/supabase/client';

export type PerfectionRequestStatus =
  | 'Draft' |'Submitted' |'Under Review' |'Approved' |'Rejected' |'Returned';

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
};
