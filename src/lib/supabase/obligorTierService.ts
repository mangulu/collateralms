'use client';

import { createClient } from '@/lib/supabase/client';

export type ObligorTier = 'PREMIER' | 'REPEAT' | 'STANDARD';

export interface ObligorServiceTier {
  obligorId: string;
  tier: ObligorTier;
  effectiveDate: string;
  reason: string;
}

function rowToTier(row: any): ObligorServiceTier {
  return {
    obligorId: row.obligor_id,
    tier: row.tier,
    effectiveDate: row.effective_date,
    reason: row.reason ?? '',
  };
}

export const obligorTierService = {
  async getAll(): Promise<ObligorServiceTier[]> {
    const supabase = createClient();
    const { data, error } = await supabase.from('obligor_service_tiers').select('*');
    if (error) {
      console.error('obligorTierService.getAll:', error.message);
      return [];
    }
    return (data ?? []).map(rowToTier);
  },

  async setTier(obligorId: string, tier: ObligorTier, reason: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('obligor_service_tiers').upsert(
      {
        obligor_id: obligorId,
        tier,
        reason,
        effective_date: new Date().toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'obligor_id' }
    );
    if (error) throw error;
  },
};
