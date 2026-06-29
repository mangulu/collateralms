'use client';

import { createClient } from '@/lib/supabase/client';

export interface DocumentTypeSetting {
  id: string;
  name: string;
  description: string;
  required: boolean;
  expiryTracked: boolean;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function rowToSetting(row: any): DocumentTypeSetting {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    required: row.required,
    expiryTracked: row.expiry_tracked,
    isActive: row.is_active,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const documentTypeSettingsService = {
  async getAll(): Promise<DocumentTypeSetting[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('document_type_settings')
        .select('*')
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Fetch document type settings error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToSetting);
    } catch (err: any) {
      console.error('Document type settings fetch failed:', err.message);
      return [];
    }
  },

  async getRequired(): Promise<DocumentTypeSetting[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('document_type_settings')
        .select('*')
        .eq('required', true)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (error) {
        console.error('Fetch required document types error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToSetting);
    } catch (err: any) {
      console.error('Required document types fetch failed:', err.message);
      return [];
    }
  },

  async create(setting: Omit<DocumentTypeSetting, 'id' | 'createdAt' | 'updatedAt'>): Promise<DocumentTypeSetting | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('document_type_settings')
        .insert({
          name: setting.name,
          description: setting.description,
          required: setting.required,
          expiry_tracked: setting.expiryTracked,
          is_active: setting.isActive,
          sort_order: setting.sortOrder,
        })
        .select()
        .single();

      if (error) {
        console.error('Create document type setting error:', error.message);
        return null;
      }
      return data ? rowToSetting(data) : null;
    } catch (err: any) {
      console.error('Create document type setting failed:', err.message);
      return null;
    }
  },

  async update(id: string, setting: Partial<Omit<DocumentTypeSetting, 'id' | 'createdAt' | 'updatedAt'>>): Promise<DocumentTypeSetting | null> {
    const supabase = createClient();
    try {
      const row: any = {};
      if (setting.name !== undefined) row.name = setting.name;
      if (setting.description !== undefined) row.description = setting.description;
      if (setting.required !== undefined) row.required = setting.required;
      if (setting.expiryTracked !== undefined) row.expiry_tracked = setting.expiryTracked;
      if (setting.isActive !== undefined) row.is_active = setting.isActive;
      if (setting.sortOrder !== undefined) row.sort_order = setting.sortOrder;
      row.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('document_type_settings')
        .update(row)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Update document type setting error:', error.message);
        return null;
      }
      return data ? rowToSetting(data) : null;
    } catch (err: any) {
      console.error('Update document type setting failed:', err.message);
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('document_type_settings')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('Delete document type setting error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('Delete document type setting failed:', err.message);
      return false;
    }
  },
};
