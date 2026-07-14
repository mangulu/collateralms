'use client';
import { createClient } from '@/lib/supabase/client';

const supabase = createClient();

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClientBankAccount {
  id: string;
  bankName: string;
  bankCode: string;
  contactEmail: string | null;
  contactPhone: string | null;
  country: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string;
  tagline: string | null;
  appUrl: string | null;
  supabaseUrl: string | null;
  supabaseAnonKey: string | null;
  adminEmail: string | null;
  isActive: boolean;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ClientBankAccountFormData {
  bankName: string;
  bankCode: string;
  contactEmail: string;
  contactPhone: string;
  country: string;
  logoUrl: string;
  primaryColor: string;
  accentColor: string;
  tagline: string;
  appUrl: string;
  supabaseUrl: string;
  supabaseAnonKey: string;
  adminEmail: string;
  isActive: boolean;
  notes: string;
}

// ─── Mapper ───────────────────────────────────────────────────────────────────

function mapRow(row: Record<string, unknown>): ClientBankAccount {
  return {
    id: row.id as string,
    bankName: row.bank_name as string,
    bankCode: row.bank_code as string,
    contactEmail: (row.contact_email as string) ?? null,
    contactPhone: (row.contact_phone as string) ?? null,
    country: (row.country as string) ?? 'Tanzania',
    logoUrl: (row.logo_url as string) ?? null,
    primaryColor: (row.primary_color as string) ?? '#2563EB',
    accentColor: (row.accent_color as string) ?? '#10B981',
    tagline: (row.tagline as string) ?? null,
    appUrl: (row.app_url as string) ?? null,
    supabaseUrl: (row.supabase_url as string) ?? null,
    supabaseAnonKey: (row.supabase_anon_key as string) ?? null,
    adminEmail: (row.admin_email as string) ?? null,
    isActive: row.is_active as boolean,
    notes: (row.notes as string) ?? null,
    createdBy: (row.created_by as string) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export async function fetchClientBankAccounts(): Promise<ClientBankAccount[]> {
  const { data, error } = await supabase
    .from('client_bank_accounts')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []).map(mapRow);
}

export async function createClientBankAccount(
  form: ClientBankAccountFormData,
  createdBy: string
): Promise<ClientBankAccount> {
  const { data, error } = await supabase
    .from('client_bank_accounts')
    .insert({
      bank_name: form.bankName,
      bank_code: form.bankCode.toUpperCase().trim(),
      contact_email: form.contactEmail || null,
      contact_phone: form.contactPhone || null,
      country: form.country || 'Tanzania',
      logo_url: form.logoUrl || null,
      primary_color: form.primaryColor || '#2563EB',
      accent_color: form.accentColor || '#10B981',
      tagline: form.tagline || null,
      app_url: form.appUrl || null,
      supabase_url: form.supabaseUrl || null,
      supabase_anon_key: form.supabaseAnonKey || null,
      admin_email: form.adminEmail || null,
      is_active: form.isActive,
      notes: form.notes || null,
      created_by: createdBy,
    })
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function updateClientBankAccount(
  id: string,
  form: ClientBankAccountFormData
): Promise<ClientBankAccount> {
  const { data, error } = await supabase
    .from('client_bank_accounts')
    .update({
      bank_name: form.bankName,
      bank_code: form.bankCode.toUpperCase().trim(),
      contact_email: form.contactEmail || null,
      contact_phone: form.contactPhone || null,
      country: form.country || 'Tanzania',
      logo_url: form.logoUrl || null,
      primary_color: form.primaryColor || '#2563EB',
      accent_color: form.accentColor || '#10B981',
      tagline: form.tagline || null,
      app_url: form.appUrl || null,
      supabase_url: form.supabaseUrl || null,
      supabase_anon_key: form.supabaseAnonKey || null,
      admin_email: form.adminEmail || null,
      is_active: form.isActive,
      notes: form.notes || null,
    })
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function toggleClientBankAccountStatus(
  id: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('client_bank_accounts')
    .update({ is_active: isActive })
    .eq('id', id);

  if (error) throw error;
}

export async function deleteClientBankAccount(id: string): Promise<void> {
  const { error } = await supabase
    .from('client_bank_accounts')
    .delete()
    .eq('id', id);

  if (error) throw error;
}
