'use client';

import { createClient } from '@/lib/supabase/client';

// ── Types ──────────────────────────────────────────────────────────────────────

export type ReleaseRequestStatus = 'Pending' | 'Under Review' | 'Approved' | 'Rejected';
export type ReleaseRequestPriority = 'High' | 'Normal' | 'Low';

export interface ReleaseRequest {
  id: string;
  collateralRef: string;
  collateralType: string;
  clientName: string;
  loanRef: string;
  estimatedValue: number;
  requestedBy: string;
  requestedDate: string;
  releaseReason: string;
  status: ReleaseRequestStatus;
  priority: ReleaseRequestPriority;
  notes?: string;
  reviewedBy?: string | null;
  reviewedAt?: string | null;
  createdBy?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateReleaseRequestPayload {
  collateralRef: string;
  collateralType: string;
  clientName: string;
  loanRef: string;
  estimatedValue: number;
  requestedBy: string;
  requestedDate: string;
  releaseReason: string;
  status?: ReleaseRequestStatus;
  priority?: ReleaseRequestPriority;
  notes?: string;
}

export interface UpdateReleaseRequestPayload {
  status?: ReleaseRequestStatus;
  notes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

// ── Row Mapper ─────────────────────────────────────────────────────────────────

function rowToRequest(row: any): ReleaseRequest {
  return {
    id: row.id,
    collateralRef: row.collateral_ref,
    collateralType: row.collateral_type,
    clientName: row.client_name,
    loanRef: row.loan_ref,
    estimatedValue: Number(row.estimated_value),
    requestedBy: row.requested_by,
    requestedDate: row.requested_date,
    releaseReason: row.release_reason,
    status: row.request_status as ReleaseRequestStatus,
    priority: row.priority as ReleaseRequestPriority,
    notes: row.notes ?? undefined,
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ── Service ────────────────────────────────────────────────────────────────────

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const cls = error.code.substring(0, 2);
    if (cls === '42' || cls === '08') return true;
    if (cls === '23') return false;
  }
  if (error.message) {
    const patterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
      /type.*does not exist/i,
    ];
    return patterns.some((p) => p.test(error.message));
  }
  return false;
}

export const releaseRequestService = {
  async getAll(): Promise<ReleaseRequest[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('release_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        if (isSchemaError(error)) throw error;
        console.log('releaseRequestService.getAll error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToRequest);
    } catch (err: any) {
      console.log('releaseRequestService.getAll caught:', err.message);
      throw err;
    }
  },

  async create(payload: CreateReleaseRequestPayload, userId?: string): Promise<ReleaseRequest | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('release_requests')
        .insert({
          collateral_ref: payload.collateralRef,
          collateral_type: payload.collateralType,
          client_name: payload.clientName,
          loan_ref: payload.loanRef,
          estimated_value: payload.estimatedValue,
          requested_by: payload.requestedBy,
          requested_date: payload.requestedDate,
          release_reason: payload.releaseReason,
          request_status: payload.status ?? 'Pending',
          priority: payload.priority ?? 'Normal',
          notes: payload.notes ?? null,
          created_by: userId ?? null,
        })
        .select()
        .single();

      if (error) {
        if (isSchemaError(error)) throw error;
        console.log('releaseRequestService.create error:', error.message);
        return null;
      }
      return rowToRequest(data);
    } catch (err: any) {
      console.log('releaseRequestService.create caught:', err.message);
      throw err;
    }
  },

  async updateStatus(
    id: string,
    status: ReleaseRequestStatus,
    notes?: string,
    reviewedBy?: string,
    reviewedByName?: string,
    reviewedByRole?: string,
  ): Promise<ReleaseRequest | null> {
    const supabase = createClient();
    try {
      // Fetch current record for audit trail + collateral lookup
      const { data: current } = await supabase
        .from('release_requests')
        .select('request_status, collateral_ref, client_name, collateral_record_id')
        .eq('id', id)
        .maybeSingle();

      const updatePayload: Record<string, any> = {
        request_status: status,
        reviewed_at: new Date().toISOString(),
      };
      if (notes !== undefined) updatePayload.notes = notes || null;
      if (reviewedBy) updatePayload.reviewed_by = reviewedBy;

      const { data, error } = await supabase
        .from('release_requests')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        if (isSchemaError(error)) throw error;
        console.log('releaseRequestService.updateStatus error:', error.message);
        return null;
      }

      // ── Write back collateral_records.status → Released on Approve ─────────
      if (status === 'Approved') {
        // Prefer direct FK if available, otherwise look up by collateral_ref
        const collateralRecordId = (current as any)?.collateral_record_id ?? null;
        if (collateralRecordId) {
          await supabase
            .from('collateral_records')
            .update({ status: 'Released' })
            .eq('id', collateralRecordId)
            .then(() => {})
            .catch((e) => console.warn('[releaseRequest] collateral status write-back failed:', e.message));
        } else if (current?.collateral_ref) {
          // Fallback: look up by collateral_id text field
          await supabase
            .from('collateral_records')
            .update({ status: 'Released' })
            .eq('collateral_id', current.collateral_ref)
            .then(() => {})
            .catch((e) => console.warn('[releaseRequest] collateral status write-back (by ref) failed:', e.message));
        }
      }

      // ── Write audit trail ──────────────────────────────────────────────────
      const oldStatus = current?.request_status ?? 'Pending';
      const collateralRef = current?.collateral_ref ?? id;
      const clientName = current?.client_name ?? '';
      const actionLabel = status === 'Approved' ? 'approved' : status === 'Rejected' ? 'rejected' : 'status_changed';

      await supabase.from('audit_logs').insert({
        entity_type: 'release_request',
        action: actionLabel,
        message: `Release request ${actionLabel}: ${collateralRef}${clientName ? ` — ${clientName}` : ''}`,
        detail: `Status changed from ${oldStatus} to ${status}${notes ? `. Notes: ${notes}` : ''}`,
        reason: notes ?? null,
        performed_by: reviewedBy ?? null,
        performed_by_name: reviewedByName ?? 'System',
        event_category: 'status_transition',
        field_changes: [
          {
            field: 'request_status',
            label: 'Status',
            old_value: oldStatus,
            new_value: status,
          },
        ],
      }).then(() => {}).catch((e) => console.warn('[releaseRequest] audit log failed:', e.message));

      // ── Sync workflow_instances if a linked instance exists ────────────────
      if (reviewedBy && (status === 'Approved' || status === 'Rejected')) {
        const { data: instances } = await supabase
          .from('workflow_instances')
          .select('id, instance_status')
          .eq('reference_id', id)
          .eq('reference_type', 'release_request')
          .in('instance_status', ['active', 'escalated'])
          .limit(1);

        const instance = instances?.[0];
        if (instance) {
          const wfAction = status === 'Approved' ? 'approve' : 'reject';
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
              completed_by: reviewedBy,
              action_taken: wfAction,
              notes: notes ?? null,
            }).eq('id', currentStep.id);
          }

          const newInstanceStatus = wfAction === 'approve' ? 'completed' : 'cancelled';
          await supabase.from('workflow_instances').update({
            instance_status: newInstanceStatus,
            current_step_id: null,
            completed_by: reviewedBy,
            completed_at: now,
          }).eq('id', instance.id);

          await supabase.from('workflow_transition_log').insert({
            instance_id: instance.id,
            instance_step_id: currentStep?.id ?? null,
            from_step_id: currentStep?.step_id ?? null,
            to_step_id: null,
            action: wfAction,
            performed_by: reviewedBy,
            performed_by_name: reviewedByName ?? null,
            performed_by_role: reviewedByRole ?? null,
            comment: notes ?? null,
          }).then(() => {}).catch((e) => console.warn('[releaseRequest] workflow transition log failed:', e.message));
        }
      }

      return rowToRequest(data);
    } catch (err: any) {
      console.log('releaseRequestService.updateStatus caught:', err.message);
      throw err;
    }
  },
};
