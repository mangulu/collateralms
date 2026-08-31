'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CprApprovalStage =
  | 'Draft' |'Credit Committee Review' |'Risk Management Review' |'Board Audit Committee' |'Full Board Approval' |'Approved';

export type CprBotStatus = 'Pending' | 'Submitted' | 'Acknowledged';
export type CprPriority = 'Low' | 'Medium' | 'High' | 'Critical';

export const APPROVAL_STAGES: CprApprovalStage[] = [
  'Draft',
  'Credit Committee Review',
  'Risk Management Review',
  'Board Audit Committee',
  'Full Board Approval',
  'Approved',
];

export const BOT_STATUS_CONFIG: Record<CprBotStatus, { label: string; color: string; bg: string; border: string }> = {
  Pending:      { label: 'Pending',      color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  Submitted:    { label: 'Submitted',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  Acknowledged: { label: 'Acknowledged', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
};

export const PRIORITY_CONFIG: Record<CprPriority, { color: string; bg: string; border: string }> = {
  Low:      { color: 'text-slate-600',  bg: 'bg-slate-50',  border: 'border-slate-200' },
  Medium:   { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  High:     { color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
  Critical: { color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
};

export const STAGE_CONFIG: Record<CprApprovalStage, { color: string; bg: string; border: string }> = {
  'Draft':                    { color: 'text-slate-600',  bg: 'bg-slate-50',   border: 'border-slate-200' },
  'Credit Committee Review':  { color: 'text-blue-700',   bg: 'bg-blue-50',    border: 'border-blue-200' },
  'Risk Management Review':   { color: 'text-violet-700', bg: 'bg-violet-50',  border: 'border-violet-200' },
  'Board Audit Committee':    { color: 'text-amber-700',  bg: 'bg-amber-50',   border: 'border-amber-200' },
  'Full Board Approval':      { color: 'text-orange-700', bg: 'bg-orange-50',  border: 'border-orange-200' },
  'Approved':                 { color: 'text-green-700',  bg: 'bg-green-50',   border: 'border-green-200' },
};

export interface CreditPolicyReview {
  id: string;
  policyTitle: string;
  policyReference: string;
  reviewYear: number;
  reviewCycle: string;
  description: string | null;
  priority: CprPriority;
  currentStage: CprApprovalStage;
  botStatus: CprBotStatus;
  botSubmissionDate: string | null;
  botAcknowledgementDate: string | null;
  botReferenceNumber: string | null;
  dueDate: string | null;
  completedDate: string | null;
  initiatedBy: string | null;
  assignedTo: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  initiatedByName?: string;
  assignedToName?: string;
}

export interface CprStage {
  id: string;
  reviewId: string;
  stage: CprApprovalStage;
  status: 'Pending' | 'In Progress' | 'Approved' | 'Rejected' | 'Skipped';
  approverId: string | null;
  approvedAt: string | null;
  comments: string | null;
  orderIndex: number;
  createdAt: string;
  updatedAt: string;
  approverName?: string;
}

export interface CreateCprInput {
  policyTitle: string;
  policyReference: string;
  reviewYear: number;
  reviewCycle?: string;
  description?: string;
  priority?: CprPriority;
  dueDate?: string;
  notes?: string;
  initiatedBy?: string;
  assignedTo?: string;
}

export interface UpdateBotStatusInput {
  reviewId: string;
  botStatus: CprBotStatus;
  botSubmissionDate?: string;
  botAcknowledgementDate?: string;
  botReferenceNumber?: string;
}

export interface AdvanceStageInput {
  reviewId: string;
  stageId: string;
  comments?: string;
  approverId?: string;
}

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function rowToReview(row: any): CreditPolicyReview {
  return {
    id: row.id,
    policyTitle: row.policy_title,
    policyReference: row.policy_reference,
    reviewYear: row.review_year,
    reviewCycle: row.review_cycle,
    description: row.description ?? null,
    priority: row.priority as CprPriority,
    currentStage: row.current_stage as CprApprovalStage,
    botStatus: row.bot_status as CprBotStatus,
    botSubmissionDate: row.bot_submission_date ?? null,
    botAcknowledgementDate: row.bot_acknowledgement_date ?? null,
    botReferenceNumber: row.bot_reference_number ?? null,
    dueDate: row.due_date ?? null,
    completedDate: row.completed_date ?? null,
    initiatedBy: row.initiated_by ?? null,
    assignedTo: row.assigned_to ?? null,
    notes: row.notes ?? null,
    isActive: row.is_active ?? true,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    initiatedByName: row.initiator?.full_name,
    assignedToName: row.assignee?.full_name,
  };
}

function rowToStage(row: any): CprStage {
  return {
    id: row.id,
    reviewId: row.review_id,
    stage: row.stage as CprApprovalStage,
    status: row.status,
    approverId: row.approver_id ?? null,
    approvedAt: row.approved_at ?? null,
    comments: row.comments ?? null,
    orderIndex: row.order_index,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    approverName: row.approver?.full_name,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const creditPolicyReviewService = {
  async listReviews(filters?: {
    year?: number;
    stage?: CprApprovalStage;
    botStatus?: CprBotStatus;
    priority?: CprPriority;
  }): Promise<CreditPolicyReview[]> {
    const supabase = createClient();
    let query = supabase
      .from('credit_policy_reviews')
      .select(`
        *,
        initiator:user_profiles!credit_policy_reviews_initiated_by_fkey(full_name),
        assignee:user_profiles!credit_policy_reviews_assigned_to_fkey(full_name)
      `)
      .eq('is_active', true)
      .order('review_year', { ascending: false })
      .order('created_at', { ascending: false });

    if (filters?.year) query = query.eq('review_year', filters.year);
    if (filters?.stage) query = query.eq('current_stage', filters.stage);
    if (filters?.botStatus) query = query.eq('bot_status', filters.botStatus);
    if (filters?.priority) query = query.eq('priority', filters.priority);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(rowToReview);
  },

  async getReview(id: string): Promise<CreditPolicyReview | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('credit_policy_reviews')
      .select(`
        *,
        initiator:user_profiles!credit_policy_reviews_initiated_by_fkey(full_name),
        assignee:user_profiles!credit_policy_reviews_assigned_to_fkey(full_name)
      `)
      .eq('id', id)
      .single();
    if (error) return null;
    return rowToReview(data);
  },

  async getStages(reviewId: string): Promise<CprStage[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('credit_policy_review_stages')
      .select(`*, approver:user_profiles!credit_policy_review_stages_approver_id_fkey(full_name)`)
      .eq('review_id', reviewId)
      .order('order_index', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToStage);
  },

  async createReview(input: CreateCprInput): Promise<CreditPolicyReview> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('credit_policy_reviews')
      .insert({
        policy_title: input.policyTitle,
        policy_reference: input.policyReference,
        review_year: input.reviewYear,
        review_cycle: input.reviewCycle ?? 'Annual',
        description: input.description ?? null,
        priority: input.priority ?? 'Medium',
        due_date: input.dueDate ?? null,
        notes: input.notes ?? null,
        initiated_by: input.initiatedBy ?? null,
        assigned_to: input.assignedTo ?? null,
        current_stage: 'Draft',
        bot_status: 'Pending',
      })
      .select()
      .single();
    if (error) throw error;

    // Create default stage records
    const stages = APPROVAL_STAGES.map((stage, idx) => ({
      review_id: data.id,
      stage,
      status: idx === 0 ? 'In Progress' : 'Pending',
      order_index: idx + 1,
    }));
    await supabase.from('credit_policy_review_stages').insert(stages);

    return rowToReview(data);
  },

  async updateReview(id: string, updates: Partial<CreateCprInput>): Promise<void> {
    const supabase = createClient();
    const payload: any = {};
    if (updates.policyTitle !== undefined) payload.policy_title = updates.policyTitle;
    if (updates.policyReference !== undefined) payload.policy_reference = updates.policyReference;
    if (updates.reviewYear !== undefined) payload.review_year = updates.reviewYear;
    if (updates.description !== undefined) payload.description = updates.description;
    if (updates.priority !== undefined) payload.priority = updates.priority;
    if (updates.dueDate !== undefined) payload.due_date = updates.dueDate;
    if (updates.notes !== undefined) payload.notes = updates.notes;
    if (updates.assignedTo !== undefined) payload.assigned_to = updates.assignedTo;
    const { error } = await supabase.from('credit_policy_reviews').update(payload).eq('id', id);
    if (error) throw error;
  },

  async advanceStage(input: AdvanceStageInput): Promise<void> {
    const supabase = createClient();
    // Mark current stage as Approved
    await supabase
      .from('credit_policy_review_stages')
      .update({
        status: 'Approved',
        approved_at: new Date().toISOString(),
        approver_id: input.approverId ?? null,
        comments: input.comments ?? null,
      })
      .eq('id', input.stageId);

    // Get review to find next stage
    const review = await this.getReview(input.reviewId);
    if (!review) return;

    const currentIdx = APPROVAL_STAGES.indexOf(review.currentStage);
    const nextStage = APPROVAL_STAGES[currentIdx + 1];
    if (!nextStage) return;

    // Update review current stage
    const updatePayload: any = { current_stage: nextStage };
    if (nextStage === 'Approved') {
      updatePayload.completed_date = new Date().toISOString().split('T')[0];
    }
    await supabase.from('credit_policy_reviews').update(updatePayload).eq('id', input.reviewId);

    // Mark next stage as In Progress
    await supabase
      .from('credit_policy_review_stages')
      .update({ status: 'In Progress' })
      .eq('review_id', input.reviewId)
      .eq('stage', nextStage);
  },

  async updateBotStatus(input: UpdateBotStatusInput): Promise<void> {
    const supabase = createClient();
    const payload: any = { bot_status: input.botStatus };
    if (input.botSubmissionDate) payload.bot_submission_date = input.botSubmissionDate;
    if (input.botAcknowledgementDate) payload.bot_acknowledgement_date = input.botAcknowledgementDate;
    if (input.botReferenceNumber) payload.bot_reference_number = input.botReferenceNumber;
    const { error } = await supabase.from('credit_policy_reviews').update(payload).eq('id', input.reviewId);
    if (error) throw error;
  },

  async getStats(): Promise<{
    total: number;
    byStage: Record<string, number>;
    byBotStatus: Record<string, number>;
    byPriority: Record<string, number>;
    pendingBotSubmission: number;
    overdueCount: number;
  }> {
    const supabase = createClient();
    const { data } = await supabase
      .from('credit_policy_reviews')
      .select('current_stage, bot_status, priority, due_date')
      .eq('is_active', true);

    const rows = data ?? [];
    const today = new Date().toISOString().split('T')[0];

    const byStage: Record<string, number> = {};
    const byBotStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    let pendingBotSubmission = 0;
    let overdueCount = 0;

    for (const r of rows) {
      byStage[r.current_stage] = (byStage[r.current_stage] ?? 0) + 1;
      byBotStatus[r.bot_status] = (byBotStatus[r.bot_status] ?? 0) + 1;
      byPriority[r.priority] = (byPriority[r.priority] ?? 0) + 1;
      if (r.bot_status === 'Pending' && r.current_stage === 'Approved') pendingBotSubmission++;
      if (r.due_date && r.due_date < today && r.current_stage !== 'Approved') overdueCount++;
    }

    return { total: rows.length, byStage, byBotStatus, byPriority, pendingBotSubmission, overdueCount };
  },
};
