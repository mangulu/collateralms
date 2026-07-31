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
  ): Promise<ReleaseRequest | null> {
    const supabase = createClient();
    try {
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
      return rowToRequest(data);
    } catch (err: any) {
      console.log('releaseRequestService.updateStatus caught:', err.message);
      throw err;
    }
  },
};
