'use client';

import { createClient } from '@/lib/supabase/client';
import { createRegistrySubmissionTask } from '@/lib/supabase/workflowTaskBridge';

// ─── Types ────────────────────────────────────────────────────────────────────

export type RegistrySubmissionStatus =
  | 'Pending' |'Submitted' |'Acknowledged' |'Registered' |'Rejected';

export type PerfectionRegistryName =
  | 'BRELA' |'Lands Registry' |'TRA' |'DSE/CSDR' |'Tanzania Shipping' |'Other';

export const REGISTRY_NAMES: PerfectionRegistryName[] = [
  'BRELA',
  'Lands Registry',
  'TRA',
  'DSE/CSDR',
  'Tanzania Shipping',
  'Other',
];

export const REGISTRY_STATUS_FLOW: RegistrySubmissionStatus[] = [
  'Pending',
  'Submitted',
  'Acknowledged',
  'Registered',
  'Rejected',
];

export interface RegistrySubmission {
  id: string;
  collateralRecordId: string;
  registryName: PerfectionRegistryName;
  submissionStatus: RegistrySubmissionStatus;
  submissionRef: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  submittedByName?: string;
  acknowledgedAt: string | null;
  acknowledgedBy: string | null;
  acknowledgedByName?: string;
  acknowledgementRef: string | null;
  registeredAt: string | null;
  registeredBy: string | null;
  registeredByName?: string;
  registrationRef: string | null;
  rejectedAt: string | null;
  rejectedBy: string | null;
  rejectedByName?: string;
  rejectionReason: string | null;
  notes: string | null;
  documentPaths: string[];
  createdBy: string | null;
  createdByName?: string;
  createdAt: string;
  updatedAt: string;
}

export interface RegistrySubmissionAudit {
  id: string;
  submissionId: string;
  fromStatus: RegistrySubmissionStatus | null;
  toStatus: RegistrySubmissionStatus;
  changedBy: string | null;
  changedByName: string | null;
  notes: string | null;
  createdAt: string;
}

function rowToSubmission(row: any): RegistrySubmission {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id,
    registryName: row.registry_name,
    submissionStatus: row.submission_status,
    submissionRef: row.submission_ref,
    submittedAt: row.submitted_at,
    submittedBy: row.submitted_by,
    submittedByName: row.submitted_by_profile?.full_name,
    acknowledgedAt: row.acknowledged_at,
    acknowledgedBy: row.acknowledged_by,
    acknowledgedByName: row.acknowledged_by_profile?.full_name,
    acknowledgementRef: row.acknowledgement_ref,
    registeredAt: row.registered_at,
    registeredBy: row.registered_by,
    registeredByName: row.registered_by_profile?.full_name,
    registrationRef: row.registration_ref,
    rejectedAt: row.rejected_at,
    rejectedBy: row.rejected_by,
    rejectedByName: row.rejected_by_profile?.full_name,
    rejectionReason: row.rejection_reason,
    notes: row.notes,
    documentPaths: row.document_paths ?? [],
    createdBy: row.created_by,
    createdByName: row.created_by_profile?.full_name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToAudit(row: any): RegistrySubmissionAudit {
  return {
    id: row.id,
    submissionId: row.submission_id,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    changedBy: row.changed_by,
    changedByName: row.changed_by_name,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const registrySubmissionTrackerService = {
  async listByCollateral(collateralRecordId: string): Promise<RegistrySubmission[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('registry_submission_tracker')
      .select(`
        *,
        submitted_by_profile:user_profiles!submitted_by(full_name),
        acknowledged_by_profile:user_profiles!acknowledged_by(full_name),
        registered_by_profile:user_profiles!registered_by(full_name),
        rejected_by_profile:user_profiles!rejected_by(full_name),
        created_by_profile:user_profiles!created_by(full_name)
      `)
      .eq('collateral_record_id', collateralRecordId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToSubmission);
  },

  async listAll(filters?: {
    registryName?: PerfectionRegistryName;
    status?: RegistrySubmissionStatus;
    fromDate?: string;
    toDate?: string;
  }): Promise<RegistrySubmission[]> {
    const supabase = createClient();
    let query = supabase
      .from('registry_submission_tracker')
      .select(`
        *,
        submitted_by_profile:user_profiles!submitted_by(full_name),
        acknowledged_by_profile:user_profiles!acknowledged_by(full_name),
        registered_by_profile:user_profiles!registered_by(full_name),
        rejected_by_profile:user_profiles!rejected_by(full_name),
        created_by_profile:user_profiles!created_by(full_name)
      `)
      .order('created_at', { ascending: false });

    if (filters?.registryName) {
      query = query.eq('registry_name', filters.registryName);
    }
    if (filters?.status) {
      query = query.eq('submission_status', filters.status);
    }
    if (filters?.fromDate) {
      query = query.gte('created_at', filters.fromDate);
    }
    if (filters?.toDate) {
      query = query.lte('created_at', filters.toDate);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(rowToSubmission);
  },

  async bulkUpdateStatus(payload: {
    ids: string[];
    newStatus: RegistrySubmissionStatus;
    userId?: string;
    userName?: string;
    notes?: string;
  }): Promise<void> {
    const supabase = createClient();
    const now = new Date().toISOString();

    // Fetch current statuses for audit
    const { data: currents } = await supabase
      .from('registry_submission_tracker')
      .select('id, submission_status')
      .in('id', payload.ids);

    const updatePayload: Record<string, any> = {
      submission_status: payload.newStatus,
      updated_at: now,
    };
    if (payload.newStatus === 'Submitted') {
      updatePayload.submitted_at = now;
      updatePayload.submitted_by = payload.userId ?? null;
    } else if (payload.newStatus === 'Acknowledged') {
      updatePayload.acknowledged_at = now;
      updatePayload.acknowledged_by = payload.userId ?? null;
    } else if (payload.newStatus === 'Registered') {
      updatePayload.registered_at = now;
      updatePayload.registered_by = payload.userId ?? null;
    }

    const { error } = await supabase
      .from('registry_submission_tracker')
      .update(updatePayload)
      .in('id', payload.ids);
    if (error) throw error;

    // Audit trail for each
    const auditRows = payload.ids.map((id) => {
      const current = (currents ?? []).find((c: any) => c.id === id);
      return {
        submission_id: id,
        from_status: current?.submission_status ?? null,
        to_status: payload.newStatus,
        changed_by: payload.userId ?? null,
        changed_by_name: payload.userName ?? null,
        notes: payload.notes ?? 'Bulk status update',
      };
    });
    await supabase.from('registry_submission_audit').insert(auditRows);
  },

  async create(payload: {
    collateralRecordId: string;
    registryName: PerfectionRegistryName;
    notes?: string;
    createdBy?: string;
    createdByName?: string;
  }): Promise<RegistrySubmission> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('registry_submission_tracker')
      .insert({
        collateral_record_id: payload.collateralRecordId,
        registry_name: payload.registryName,
        submission_status: 'Pending',
        notes: payload.notes ?? null,
        created_by: payload.createdBy ?? null,
      })
      .select()
      .single();
    if (error) throw error;

    // Log audit trail
    await supabase.from('registry_submission_audit').insert({
      submission_id: data.id,
      from_status: null,
      to_status: 'Pending',
      changed_by: payload.createdBy ?? null,
      changed_by_name: payload.createdByName ?? null,
      notes: 'Submission created',
    });

    // ── Notify approver via user_tasks (non-blocking) ──────────────────────
    try {
      const { data: approvers } = await supabase
        .from('user_profiles')
        .select('id, full_name, email, phone')
        .eq('role', 'legal_officer')
        .eq('is_active', true)
        .limit(1);

      const approver = approvers?.[0];
      if (approver) {
        createRegistrySubmissionTask({
          assignedTo: approver.id,
          collateralId: payload.collateralRecordId,
          instanceId: data.id,
          assignedBy: payload.createdBy,
          assignedByName: payload.createdByName,
          notify: approver.email
            ? { assigneeName: approver.full_name ?? 'Approver', assigneeEmail: approver.email, assigneePhone: approver.phone ?? undefined }
            : undefined,
        }).catch(() => {/* non-blocking */});
      }
    } catch {
      // non-blocking
    }

    return rowToSubmission(data);
  },

  async updateStatus(payload: {
    id: string;
    newStatus: RegistrySubmissionStatus;
    userId?: string;
    userName?: string;
    submissionRef?: string;
    acknowledgementRef?: string;
    registrationRef?: string;
    rejectionReason?: string;
    notes?: string;
  }): Promise<RegistrySubmission> {
    const supabase = createClient();

    // Fetch current status for audit
    const { data: current } = await supabase
      .from('registry_submission_tracker')
      .select('submission_status')
      .eq('id', payload.id)
      .single();

    const now = new Date().toISOString();
    const updatePayload: Record<string, any> = {
      submission_status: payload.newStatus,
      updated_at: now,
    };

    if (payload.newStatus === 'Submitted') {
      updatePayload.submitted_at = now;
      updatePayload.submitted_by = payload.userId ?? null;
      if (payload.submissionRef) updatePayload.submission_ref = payload.submissionRef;
    } else if (payload.newStatus === 'Acknowledged') {
      updatePayload.acknowledged_at = now;
      updatePayload.acknowledged_by = payload.userId ?? null;
      if (payload.acknowledgementRef) updatePayload.acknowledgement_ref = payload.acknowledgementRef;
    } else if (payload.newStatus === 'Registered') {
      updatePayload.registered_at = now;
      updatePayload.registered_by = payload.userId ?? null;
      if (payload.registrationRef) updatePayload.registration_ref = payload.registrationRef;
    } else if (payload.newStatus === 'Rejected') {
      updatePayload.rejected_at = now;
      updatePayload.rejected_by = payload.userId ?? null;
      updatePayload.rejection_reason = payload.rejectionReason ?? null;
    }

    if (payload.notes) updatePayload.notes = payload.notes;

    const { data, error } = await supabase
      .from('registry_submission_tracker')
      .update(updatePayload)
      .eq('id', payload.id)
      .select()
      .single();
    if (error) throw error;

    // Audit trail
    await supabase.from('registry_submission_audit').insert({
      submission_id: payload.id,
      from_status: current?.submission_status ?? null,
      to_status: payload.newStatus,
      changed_by: payload.userId ?? null,
      changed_by_name: payload.userName ?? null,
      notes: payload.notes ?? null,
    });

    return rowToSubmission(data);
  },

  async attachDocument(id: string, filePath: string): Promise<void> {
    const supabase = createClient();
    const { data: current } = await supabase
      .from('registry_submission_tracker')
      .select('document_paths')
      .eq('id', id)
      .single();
    const existing: string[] = current?.document_paths ?? [];
    const { error } = await supabase
      .from('registry_submission_tracker')
      .update({ document_paths: [...existing, filePath], updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async removeDocument(id: string, filePath: string): Promise<void> {
    const supabase = createClient();
    const { data: current } = await supabase
      .from('registry_submission_tracker')
      .select('document_paths')
      .eq('id', id)
      .single();
    const existing: string[] = current?.document_paths ?? [];
    const { error } = await supabase
      .from('registry_submission_tracker')
      .update({ document_paths: existing.filter((p) => p !== filePath), updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
  },

  async getAuditTrail(submissionId: string): Promise<RegistrySubmissionAudit[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('registry_submission_audit')
      .select('*')
      .eq('submission_id', submissionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data ?? []).map(rowToAudit);
  },

  async uploadDocument(
    submissionId: string,
    file: File,
    collateralId: string
  ): Promise<string> {
    const supabase = createClient();
    const ext = file.name.split('.').pop();
    const path = `registry-submissions/${collateralId}/${submissionId}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from('collateral-documents')
      .upload(path, file, { upsert: false });
    if (uploadError) throw uploadError;
    await registrySubmissionTrackerService.attachDocument(submissionId, path);
    return path;
  },

  async getDocumentUrl(path: string): Promise<string> {
    const supabase = createClient();
    const { data } = await supabase.storage
      .from('collateral-documents')
      .createSignedUrl(path, 3600);
    return data?.signedUrl ?? '';
  },

  async delete(id: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('registry_submission_tracker')
      .delete()
      .eq('id', id);
    if (error) throw error;
  },
};
