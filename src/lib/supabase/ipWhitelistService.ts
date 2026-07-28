import { createClient } from '@/lib/supabase/client';

export interface IpWhitelistConfig {
  id: string;
  label: string;
  ipAddress: string;
  description: string | null;
  appliesTo: string[];
  isActive: boolean;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IpAccessLogEntry {
  id: string;
  userId: string | null;
  ipAddress: string;
  userRole: string | null;
  accessResult: 'allowed' | 'blocked';
  route: string | null;
  createdAt: string;
}

function mapRow(row: any): IpWhitelistConfig {
  return {
    id: row.id,
    label: row.label,
    ipAddress: row.ip_address,
    description: row.description ?? null,
    appliesTo: row.applies_to ?? [],
    isActive: row.is_active,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function fetchIpWhitelistConfigs(): Promise<IpWhitelistConfig[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ip_whitelist_configs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createIpWhitelistConfig(
  payload: Omit<IpWhitelistConfig, 'id' | 'createdAt' | 'updatedAt'>
): Promise<IpWhitelistConfig> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ip_whitelist_configs')
    .insert({
      label: payload.label,
      ip_address: payload.ipAddress,
      description: payload.description,
      applies_to: payload.appliesTo,
      is_active: payload.isActive,
      created_by: payload.createdBy,
    })
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function updateIpWhitelistConfig(
  id: string,
  payload: Partial<Omit<IpWhitelistConfig, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<IpWhitelistConfig> {
  const supabase = createClient();
  const updates: any = { updated_at: new Date().toISOString() };
  if (payload.label !== undefined) updates.label = payload.label;
  if (payload.ipAddress !== undefined) updates.ip_address = payload.ipAddress;
  if (payload.description !== undefined) updates.description = payload.description;
  if (payload.appliesTo !== undefined) updates.applies_to = payload.appliesTo;
  if (payload.isActive !== undefined) updates.is_active = payload.isActive;

  const { data, error } = await supabase
    .from('ip_whitelist_configs')
    .update(updates)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return mapRow(data);
}

export async function deleteIpWhitelistConfig(id: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from('ip_whitelist_configs').delete().eq('id', id);
  if (error) throw error;
}

export async function fetchIpAccessLog(limit = 50): Promise<IpAccessLogEntry[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('ip_access_log')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.id,
    userId: row.user_id ?? null,
    ipAddress: row.ip_address,
    userRole: row.user_role ?? null,
    accessResult: row.access_result,
    route: row.route ?? null,
    createdAt: row.created_at,
  }));
}

/**
 * Check if an IP address matches a CIDR range or exact IP.
 * Used client-side for display purposes only.
 * Server-side enforcement is in middleware.
 */
export function ipMatchesCidr(ip: string, cidr: string): boolean {
  try {
    if (!cidr.includes('/')) return ip === cidr;
    const [network, prefixStr] = cidr.split('/');
    const prefix = parseInt(prefixStr, 10);
    const ipParts = ip.split('.').map(Number);
    const netParts = network.split('.').map(Number);
    if (ipParts.length !== 4 || netParts.length !== 4) return false;
    const ipNum = (ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3];
    const netNum = (netParts[0] << 24) | (netParts[1] << 16) | (netParts[2] << 8) | netParts[3];
    const mask = prefix === 0 ? 0 : (~0 << (32 - prefix)) >>> 0;
    return (ipNum & mask) === (netNum & mask);
  } catch {
    return false;
  }
}
