'use client';

import { createClient } from '@/lib/supabase/client';

export interface Obligor {
  id: string;
  obligorCode: string;
  fullName: string;
  entityType: 'individual' | 'company';
  idNumber?: string | null;
  registrationNumber?: string | null;
  taxId?: string | null;
  // Address
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  postalCode?: string | null;
  // Contacts
  phonePrimary?: string | null;
  phoneSecondary?: string | null;
  email?: string | null;
  contactPerson?: string | null;
  // Risk
  riskRating?: 'LOW' | 'MEDIUM' | 'HIGH' | null;
  creditLimit?: number | null;
  // Meta
  notes?: string | null;
  isActive?: boolean;
  createdBy?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

function rowToObligor(row: any): Obligor {
  return {
    id: row.id,
    obligorCode: row.obligor_code,
    fullName: row.full_name,
    entityType: row.entity_type as 'individual' | 'company',
    idNumber: row.id_number,
    registrationNumber: row.registration_number,
    taxId: row.tax_id,
    addressLine1: row.address_line1,
    addressLine2: row.address_line2,
    city: row.city,
    region: row.region,
    country: row.country,
    postalCode: row.postal_code,
    phonePrimary: row.phone_primary,
    phoneSecondary: row.phone_secondary,
    email: row.email,
    contactPerson: row.contact_person,
    riskRating: row.risk_rating as 'LOW' | 'MEDIUM' | 'HIGH' | null,
    creditLimit: row.credit_limit != null ? parseFloat(row.credit_limit) : null,
    notes: row.notes,
    isActive: row.is_active,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function obligorToRow(data: Partial<Obligor>): any {
  const row: any = {};
  if (data.obligorCode !== undefined) row.obligor_code = data.obligorCode;
  if (data.fullName !== undefined) row.full_name = data.fullName;
  if (data.entityType !== undefined) row.entity_type = data.entityType;
  if (data.idNumber !== undefined) row.id_number = data.idNumber;
  if (data.registrationNumber !== undefined) row.registration_number = data.registrationNumber;
  if (data.taxId !== undefined) row.tax_id = data.taxId;
  if (data.addressLine1 !== undefined) row.address_line1 = data.addressLine1;
  if (data.addressLine2 !== undefined) row.address_line2 = data.addressLine2;
  if (data.city !== undefined) row.city = data.city;
  if (data.region !== undefined) row.region = data.region;
  if (data.country !== undefined) row.country = data.country;
  if (data.postalCode !== undefined) row.postal_code = data.postalCode;
  if (data.phonePrimary !== undefined) row.phone_primary = data.phonePrimary;
  if (data.phoneSecondary !== undefined) row.phone_secondary = data.phoneSecondary;
  if (data.email !== undefined) row.email = data.email;
  if (data.contactPerson !== undefined) row.contact_person = data.contactPerson;
  if (data.riskRating !== undefined) row.risk_rating = data.riskRating;
  if (data.creditLimit !== undefined) row.credit_limit = data.creditLimit;
  if (data.notes !== undefined) row.notes = data.notes;
  if (data.isActive !== undefined) row.is_active = data.isActive;
  if (data.createdBy !== undefined) row.created_by = data.createdBy;
  return row;
}

export const obligorService = {
  async getAll(): Promise<Obligor[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('obligors')
      .select('*')
      .order('full_name', { ascending: true });
    if (error) { console.error('obligorService.getAll:', error.message); return []; }
    return (data ?? []).map(rowToObligor);
  },

  async getById(id: string): Promise<Obligor | null> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('obligors')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) { console.error('obligorService.getById:', error.message); return null; }
    return data ? rowToObligor(data) : null;
  },

  async search(query: string): Promise<Obligor[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('obligors')
      .select('*')
      .or(`full_name.ilike.%${query}%,obligor_code.ilike.%${query}%,email.ilike.%${query}%`)
      .eq('is_active', true)
      .order('full_name', { ascending: true })
      .limit(20);
    if (error) { console.error('obligorService.search:', error.message); return []; }
    return (data ?? []).map(rowToObligor);
  },

  async create(data: Partial<Obligor>, userId: string): Promise<Obligor | null> {
    const supabase = createClient();
    const row = obligorToRow({ ...data, createdBy: userId });
    const { data: created, error } = await supabase
      .from('obligors')
      .insert(row)
      .select()
      .single();
    if (error) { console.error('obligorService.create:', error.message); return null; }
    return created ? rowToObligor(created) : null;
  },

  async update(id: string, data: Partial<Obligor>): Promise<Obligor | null> {
    const supabase = createClient();
    const row = obligorToRow(data);
    const { data: updated, error } = await supabase
      .from('obligors')
      .update(row)
      .eq('id', id)
      .select()
      .single();
    if (error) { console.error('obligorService.update:', error.message); return null; }
    return updated ? rowToObligor(updated) : null;
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    const { error } = await supabase.from('obligors').delete().eq('id', id);
    if (error) { console.error('obligorService.delete:', error.message); return false; }
    return true;
  },

  async getLinkedCollaterals(obligorId: string): Promise<any[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('collateral_records')
      .select('id, collateral_id, collateral_type, description, value_tsh, status, facility_id, registration_date')
      .eq('obligor_ref_id', obligorId)
      .order('created_at', { ascending: false });
    if (error) { console.error('obligorService.getLinkedCollaterals:', error.message); return []; }
    return data ?? [];
  },

  async generateCode(): Promise<string> {
    const supabase = createClient();
    const { count } = await supabase
      .from('obligors')
      .select('*', { count: 'exact', head: true });
    const next = ((count ?? 0) + 1).toString().padStart(4, '0');
    const year = new Date().getFullYear();
    return `OBL-${year}-${next}`;
  },
};
