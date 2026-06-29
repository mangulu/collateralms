'use client';

import { createClient } from '@/lib/supabase/client';

export interface LegalSignOff {
  id: string;
  collateralRecordId: string | null;
  collateralId: string;
  signedBy: string | null;
  signedByName: string;
  signedByRole: string;
  signedAt: string;
  notes: string | null;
  status: 'signed' | 'revoked';
  revokedByName: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  ipAddress: string | null;
  createdAt: string;
}

function rowToSignOff(row: any): LegalSignOff {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id ?? null,
    collateralId: row.collateral_id,
    signedBy: row.signed_by ?? null,
    signedByName: row.signed_by_name,
    signedByRole: row.signed_by_role,
    signedAt: row.signed_at,
    notes: row.notes ?? null,
    status: row.status as 'signed' | 'revoked',
    revokedByName: row.revoked_by_name ?? null,
    revokedAt: row.revoked_at ?? null,
    revocationReason: row.revocation_reason ?? null,
    ipAddress: row.ip_address ?? null,
    createdAt: row.created_at,
  };
}

export const legalSignOffService = {
  async getByCollateral(collateralRecordId: string): Promise<LegalSignOff[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('legal_signoffs')
      .select('*')
      .eq('collateral_record_id', collateralRecordId)
      .order('signed_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToSignOff);
  },

  async create(payload: {
    collateralRecordId: string;
    collateralId: string;
    signedBy: string;
    signedByName: string;
    signedByRole: string;
    notes?: string;
  }): Promise<LegalSignOff | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('legal_signoffs')
      .insert({
        collateral_record_id: payload.collateralRecordId,
        collateral_id: payload.collateralId,
        signed_by: payload.signedBy,
        signed_by_name: payload.signedByName,
        signed_by_role: payload.signedByRole,
        notes: payload.notes ?? null,
        status: 'signed',
        signed_at: new Date().toISOString(),
      })
      .select()
      .single();
    if (error) throw error;
    return data ? rowToSignOff(data) : null;
  },

  async revoke(
    id: string,
    revokedBy: string,
    revokedByName: string,
    reason: string
  ): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase
      .from('legal_signoffs')
      .update({
        status: 'revoked',
        revoked_by: revokedBy,
        revoked_by_name: revokedByName,
        revoked_at: new Date().toISOString(),
        revocation_reason: reason,
      })
      .eq('id', id);
    return !error;
  },
};
