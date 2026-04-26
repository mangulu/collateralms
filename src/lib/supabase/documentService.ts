'use client';

import { createClient } from '@/lib/supabase/client';

export type DocumentType =
  | 'Title Deed' |'Charge Certificate' |'Valuation Report' |'BRELA Confirmation' |'Insurance Certificate' |'Board Resolution' |'Other';

export interface CollateralDocument {
  id: string;
  collateralRecordId: string;
  collateralId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  documentType: DocumentType;
  version: number;
  notes: string;
  uploadedBy?: string;
  uploadedByName: string;
  createdAt: string;
  signedUrl?: string;
}

function rowToDocument(row: any): CollateralDocument {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id,
    collateralId: row.collateral_id,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size,
    mimeType: row.mime_type,
    documentType: row.document_type as DocumentType,
    version: row.version,
    notes: row.notes ?? '',
    uploadedBy: row.uploaded_by,
    uploadedByName: row.uploaded_by_name ?? '',
    createdAt: row.created_at,
  };
}

export const documentService = {
  async getByCollateralId(collateralRecordId: string): Promise<CollateralDocument[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_documents')
        .select('*')
        .eq('collateral_record_id', collateralRecordId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch documents error:', error.message);
        return [];
      }

      const docs = (data ?? []).map(rowToDocument);

      // Generate signed URLs for each document
      const docsWithUrls = await Promise.all(
        docs.map(async (doc) => {
          try {
            const { data: urlData } = await supabase.storage
              .from('collateral-documents')
              .createSignedUrl(doc.filePath, 3600);
            return { ...doc, signedUrl: urlData?.signedUrl };
          } catch {
            return doc;
          }
        })
      );

      return docsWithUrls;
    } catch (err: any) {
      console.error('Document fetch failed:', err.message);
      return [];
    }
  },

  async upload(
    file: File,
    collateralRecordId: string,
    collateralId: string,
    documentType: DocumentType,
    notes: string,
    userId: string,
    userName: string
  ): Promise<CollateralDocument | null> {
    const supabase = createClient();
    try {
      // Get current version count for this collateral + file name
      const { count } = await supabase
        .from('collateral_documents')
        .select('*', { count: 'exact', head: true })
        .eq('collateral_record_id', collateralRecordId)
        .eq('file_name', file.name);

      const version = (count ?? 0) + 1;

      // Build storage path: collateral-id/timestamp-version-filename
      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${collateralId}/${timestamp}_v${version}_${safeFileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('collateral-documents')
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        console.error('Storage upload error:', uploadError.message);
        return null;
      }

      // Insert document record
      const { data, error: insertError } = await supabase
        .from('collateral_documents')
        .insert({
          collateral_record_id: collateralRecordId,
          collateral_id: collateralId,
          file_name: file.name,
          file_path: filePath,
          file_size: file.size,
          mime_type: file.type || 'application/octet-stream',
          document_type: documentType,
          version,
          notes,
          uploaded_by: userId,
          uploaded_by_name: userName,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Document record insert error:', insertError.message);
        // Attempt to clean up uploaded file
        await supabase.storage.from('collateral-documents').remove([filePath]);
        return null;
      }

      return data ? rowToDocument(data) : null;
    } catch (err: any) {
      console.error('Document upload failed:', err.message);
      return null;
    }
  },

  async delete(doc: CollateralDocument): Promise<boolean> {
    const supabase = createClient();
    try {
      // Remove from storage
      await supabase.storage.from('collateral-documents').remove([doc.filePath]);

      // Remove DB record
      const { error } = await supabase
        .from('collateral_documents')
        .delete()
        .eq('id', doc.id);

      if (error) {
        console.error('Document delete error:', error.message);
        return false;
      }
      return true;
    } catch (err: any) {
      console.error('Document delete failed:', err.message);
      return false;
    }
  },

  formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  },
};
