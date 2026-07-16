import { createClient } from '@/lib/supabase/client';

export interface AlertThresholds {
  ltvBreachPct: number;
  perfectionRateDropPct: number;
  brelaDeadlineDays: number;
}

const DEFAULTS: AlertThresholds = {
  ltvBreachPct: 80,
  perfectionRateDropPct: 10,
  brelaDeadlineDays: 30,
};

function isSchemaError(error: any): boolean {
  if (!error) return false;
  if (error.code && typeof error.code === 'string') {
    const errorClass = error.code.substring(0, 2);
    if (errorClass === '42') return true;
    if (errorClass === '23') return false;
    if (errorClass === '08') return true;
  }
  if (error.message) {
    const schemaErrorPatterns = [
      /relation.*does not exist/i,
      /column.*does not exist/i,
      /function.*does not exist/i,
      /syntax error/i,
      /type.*does not exist/i,
    ];
    return schemaErrorPatterns.some((p) => p.test(error.message));
  }
  return false;
}

export const alertThresholdsService = {
  async load(officerId: string): Promise<AlertThresholds> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('officer_alert_thresholds')
        .select('ltv_breach_pct, perfection_rate_drop_pct, brela_deadline_days')
        .eq('officer_id', officerId)
        .maybeSingle();

      if (error) {
        if (isSchemaError(error)) throw error;
        return { ...DEFAULTS };
      }

      if (!data) return { ...DEFAULTS };

      return {
        ltvBreachPct: data.ltv_breach_pct,
        perfectionRateDropPct: data.perfection_rate_drop_pct,
        brelaDeadlineDays: data.brela_deadline_days,
      };
    } catch (err: any) {
      console.error('alertThresholdsService.load error:', err?.message);
      return { ...DEFAULTS };
    }
  },

  async save(officerId: string, thresholds: AlertThresholds): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('officer_alert_thresholds')
      .upsert(
        {
          officer_id: officerId,
          ltv_breach_pct: thresholds.ltvBreachPct,
          perfection_rate_drop_pct: thresholds.perfectionRateDropPct,
          brela_deadline_days: thresholds.brelaDeadlineDays,
        },
        { onConflict: 'officer_id' }
      );

    if (error) {
      if (isSchemaError(error)) throw error;
      throw new Error(error.message);
    }
  },
};
