'use client';
import { createClient } from '@/lib/supabase/client';

export interface SystemConfigRecord {
  id: string;
  configKey: string;
  configValue: Record<string, unknown>;
  category: string;
  label: string;
  description: string | null;
  updatedBy: string | null;
  updatedAt: string;
}

const supabase = createClient();

export async function fetchSystemConfig(): Promise<SystemConfigRecord[]> {
  const { data, error } = await supabase
    .from('system_config')
    .select('*')
    .order('category', { ascending: true });

  if (error) throw error;

  return (data || []).map((row) => ({
    id: row.id,
    configKey: row.config_key,
    configValue: row.config_value,
    category: row.category,
    label: row.label,
    description: row.description,
    updatedBy: row.updated_by,
    updatedAt: row.updated_at,
  }));
}

export async function fetchConfigByKey(key: string): Promise<Record<string, unknown> | null> {
  const { data, error } = await supabase
    .from('system_config')
    .select('config_value')
    .eq('config_key', key)
    .single();

  if (error) return null;
  return data?.config_value ?? null;
}

export async function updateSystemConfig(
  configKey: string,
  configValue: Record<string, unknown>,
  updatedBy: string
): Promise<void> {
  const { error } = await supabase
    .from('system_config')
    .update({
      config_value: configValue,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq('config_key', configKey);

  if (error) throw error;
}
