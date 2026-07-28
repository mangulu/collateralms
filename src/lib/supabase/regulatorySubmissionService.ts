'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | 'Pending Generation' |'Generated' |'Submitted' |'Acknowledged' |'Overdue';

export interface RegulatorySubmission {
  id: string;
  reportName: string;
  reportType: string;
  regulatoryBody: string;
  reportingPeriod: string;
  generatedAt: string | null;
  generatedBy: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  submissionRef: string | null;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgementRef: string | null;
  submissionStatus: SubmissionStatus;
  dueDate: string | null;
  notes: string | null;
  attachments: any[];
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // joined
  generatedByName?: string;
  submittedByName?: string;
  acknowledgedByName?: string;
}

function rowToSubmission(row: any): RegulatorySubmission {
  return {
    id: row.id,
    reportName: row.report_name,
    reportType: row.report_type,
    regulatoryBody: row.regulatory_body,
    reportingPeriod: row.reporting_period,
    generatedAt: row.generated_at,
    generatedBy: row.generated_by,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    submissionRef: row.submission_ref,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    acknowledgementRef: row.acknowledgement_ref,
    submissionStatus: row.submission_status,
    dueDate: row.due_date,
    notes: row.notes,
    attachments: row.attachments ?? [],
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    generatedByName: row.generated_by_profile?.full_name,
    submittedByName: row.submitted_by_profile?.full_name,
    acknowledgedByName: row.acknowledged_by_profile?.full_name,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const regulatorySubmissionService = {
  async list(filters?: {
    status?: SubmissionStatus;
    regulatoryBody?: string;
  }): Promise<RegulatorySubmission[]> {
    const supabase = createClient();
    let query = supabase
      .from('regulatory_submissions')
      .select('*')
      .order('due_date', { ascending: true });

    if (filters?.status) query = query.eq('submission_status', filters.status);
    if (filters?.regulatoryBody) query = query.eq('regulatory_body', filters.regulatoryBody);

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(rowToSubmission);
  },

  async create(payload: {
    reportName: string;
    reportType: string;
    regulatoryBody: string;
    reportingPeriod: string;
    dueDate?: string;
    notes?: string;
    createdBy?: string;
  }): Promise<RegulatorySubmission> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('regulatory_submissions')
      .insert({
        report_name: payload.reportName,
        report_type: payload.reportType,
        regulatory_body: payload.regulatoryBody,
        reporting_period: payload.reportingPeriod,
        due_date: payload.dueDate ?? null,
        notes: payload.notes ?? null,
        submission_status: 'Pending Generation',
        created_by: payload.createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToSubmission(data);
  },

  async markGenerated(id: string, userId: string): Promise<RegulatorySubmission> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('regulatory_submissions')
      .update({
        submission_status: 'Generated',
        generated_at: new Date().toISOString(),
        generated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToSubmission(data);
  },

  async markSubmitted(
    id: string,
    userId: string,
    submissionRef?: string
  ): Promise<RegulatorySubmission> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('regulatory_submissions')
      .update({
        submission_status: 'Submitted',
        submitted_at: new Date().toISOString(),
        submitted_by: userId,
        submission_ref: submissionRef ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToSubmission(data);
  },

  async markAcknowledged(
    id: string,
    userId: string,
    acknowledgementRef?: string
  ): Promise<RegulatorySubmission> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('regulatory_submissions')
      .update({
        submission_status: 'Acknowledged',
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: userId,
        acknowledgement_ref: acknowledgementRef ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    if (error) throw error;
    return rowToSubmission(data);
  },

  async getStats(): Promise<{
    total: number;
    pendingGeneration: number;
    generated: number;
    submitted: number;
    acknowledged: number;
    overdue: number;
  }> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('regulatory_submissions')
      .select('submission_status');
    if (error) throw error;
    const rows = data ?? [];
    return {
      total: rows.length,
      pendingGeneration: rows.filter((r) => r.submission_status === 'Pending Generation').length,
      generated: rows.filter((r) => r.submission_status === 'Generated').length,
      submitted: rows.filter((r) => r.submission_status === 'Submitted').length,
      acknowledged: rows.filter((r) => r.submission_status === 'Acknowledged').length,
      overdue: rows.filter((r) => r.submission_status === 'Overdue').length,
    };
  },
};
