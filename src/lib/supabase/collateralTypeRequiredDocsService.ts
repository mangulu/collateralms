'use client';

import { createClient } from '@/lib/supabase/client';

export interface CollateralTypeRequiredDoc {
  id: string;
  collateralTypeName: string;
  documentName: string;
  description: string;
  isMandatory: boolean;
  allowMultiple: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

function rowToDoc(row: any): CollateralTypeRequiredDoc {
  return {
    id: row.id,
    collateralTypeName: row.collateral_type_name,
    documentName: row.document_name,
    description: row.description ?? '',
    isMandatory: row.is_mandatory ?? true,
    allowMultiple: row.allow_multiple ?? true,
    sortOrder: row.sort_order ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export const collateralTypeRequiredDocsService = {
  async getByType(collateralTypeName: string): Promise<CollateralTypeRequiredDoc[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_type_required_documents')
        .select('*')
        .eq('collateral_type_name', collateralTypeName)
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('Fetch required docs error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToDoc);
    } catch (err: any) {
      console.error('Fetch required docs failed:', err.message);
      return [];
    }
  },

  async getAllGrouped(): Promise<Record<string, CollateralTypeRequiredDoc[]>> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_type_required_documents')
        .select('*')
        .order('collateral_type_name', { ascending: true })
        .order('sort_order', { ascending: true });
      if (error) {
        console.error('Fetch all required docs error:', error.message);
        return {};
      }
      const grouped: Record<string, CollateralTypeRequiredDoc[]> = {};
      for (const row of data ?? []) {
        const doc = rowToDoc(row);
        if (!grouped[doc.collateralTypeName]) grouped[doc.collateralTypeName] = [];
        grouped[doc.collateralTypeName].push(doc);
      }
      return grouped;
    } catch (err: any) {
      console.error('Fetch all required docs failed:', err.message);
      return {};
    }
  },

  async getDistinctTypes(): Promise<string[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_type_required_documents')
        .select('collateral_type_name')
        .order('collateral_type_name', { ascending: true });
      if (error) return [];
      const unique = Array.from(new Set((data ?? []).map((r: any) => r.collateral_type_name)));
      return unique;
    } catch {
      return [];
    }
  },

  /** Returns the allow_multiple flag for a specific doc type within a collateral type. */
  async getAllowMultiple(collateralTypeName: string, documentName: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { data } = await supabase
        .from('collateral_type_required_documents')
        .select('allow_multiple')
        .eq('collateral_type_name', collateralTypeName)
        .eq('document_name', documentName)
        .single();
      return data?.allow_multiple ?? true;
    } catch {
      return true;
    }
  },

  async create(
    doc: Omit<CollateralTypeRequiredDoc, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<CollateralTypeRequiredDoc | null> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_type_required_documents')
        .insert({
          collateral_type_name: doc.collateralTypeName,
          document_name: doc.documentName,
          description: doc.description,
          is_mandatory: doc.isMandatory,
          allow_multiple: doc.allowMultiple,
          sort_order: doc.sortOrder,
        })
        .select()
        .single();
      if (error) {
        console.error('Create required doc error:', error.message);
        return null;
      }
      return data ? rowToDoc(data) : null;
    } catch (err: any) {
      console.error('Create required doc failed:', err.message);
      return null;
    }
  },

  async update(
    id: string,
    doc: Partial<Omit<CollateralTypeRequiredDoc, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<CollateralTypeRequiredDoc | null> {
    const supabase = createClient();
    try {
      const row: any = { updated_at: new Date().toISOString() };
      if (doc.collateralTypeName !== undefined) row.collateral_type_name = doc.collateralTypeName;
      if (doc.documentName !== undefined) row.document_name = doc.documentName;
      if (doc.description !== undefined) row.description = doc.description;
      if (doc.isMandatory !== undefined) row.is_mandatory = doc.isMandatory;
      if (doc.allowMultiple !== undefined) row.allow_multiple = doc.allowMultiple;
      if (doc.sortOrder !== undefined) row.sort_order = doc.sortOrder;

      const { data, error } = await supabase
        .from('collateral_type_required_documents')
        .update(row)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        console.error('Update required doc error:', error.message);
        return null;
      }
      return data ? rowToDoc(data) : null;
    } catch (err: any) {
      console.error('Update required doc failed:', err.message);
      return null;
    }
  },

  async delete(id: string): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('collateral_type_required_documents')
        .delete()
        .eq('id', id);
      if (error) {
        console.error('Delete required doc error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('Delete required doc failed:', err.message);
      return false;
    }
  },
};
