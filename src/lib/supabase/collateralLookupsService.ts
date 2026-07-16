'use client';

import { createClient } from '@/lib/supabase/client';

export interface CollateralTypeLookup {
  id: string;
  name: string;
  description: string | null;
  registryCode: string | null;
  perfectionDeadlineDays: number | null;
  active: boolean;
}

export interface RegistryLookup {
  id: string;
  code: string;
  name: string;
  fullName: string | null;
  country: string;
  assetClass: string | null;
  active: boolean;
}

/** Hardcoded fallbacks used when the DB tables are not yet available */
const FALLBACK_COLLATERAL_TYPES: string[] = [
  'Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel',
];

const FALLBACK_REGISTRIES: string[] = [
  'BRELA', 'Lands Registry', 'TRA', 'DSE', 'TASAC', 'N/A',
];

export const collateralLookupsService = {
  /** Returns active collateral type names ordered by sort_order */
  async getCollateralTypeNames(): Promise<string[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_types')
        .select('name')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) return FALLBACK_COLLATERAL_TYPES;
      return data.map((r: { name: string }) => r.name);
    } catch {
      return FALLBACK_COLLATERAL_TYPES;
    }
  },

  /** Returns active registry names (code field) ordered by sort_order */
  async getRegistryNames(): Promise<string[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('registries')
        .select('code')
        .eq('active', true)
        .order('sort_order', { ascending: true });

      if (error || !data || data.length === 0) return FALLBACK_REGISTRIES;
      return data.map((r: { code: string }) => r.code);
    } catch {
      return FALLBACK_REGISTRIES;
    }
  },

  /** Returns active officer full names from user_profiles */
  async getOfficerNames(): Promise<string[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('full_name')
        .eq('is_active', true)
        .order('full_name', { ascending: true });

      if (error || !data) return [];
      return data
        .map((u: { full_name: string | null }) => u.full_name)
        .filter((n): n is string => !!n && n.trim().length > 0);
    } catch {
      return [];
    }
  },
};
