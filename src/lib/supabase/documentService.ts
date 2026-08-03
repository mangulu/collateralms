'use client';

import { createClient } from '@/lib/supabase/client';

export type DocumentType =
  | 'Title Deed' | 'Charge Certificate' | 'Valuation Report' | 'BRELA Confirmation' | 'Insurance Certificate' | 'Board Resolution'
  | 'Deed' | 'Appraisal' | 'Insurance Policy' | 'Other'
  // Motor Vehicle
  | 'Vehicle Registration Certificate (Original)' | 'Logbook (Original)' | 'TRA Encumbrance Search Certificate'
  | 'Comprehensive Insurance Policy' | 'Hire Purchase / Charge Agreement'
  // Mortgage
  | 'Title Deed (Original)' | 'Valuation Report (Certified)' | 'Land Rent Clearance Certificate'
  | 'Mortgage Deed / Charge Instrument' | 'Lands Registry Search Certificate' | 'Survey Plan / Plot Map'
  | 'Building Permit (if applicable)'
  // Debenture
  | 'Debenture Deed (Executed)' | 'Certificate of Incorporation' | 'Board Resolution (Authorising Charge)'
  | 'BRELA Registration Certificate'| 'Memorandum & Articles of Association' |'Audited Financial Statements (Latest)' | 'Asset Schedule / Inventory List'
  // Shares (DSE)
  | 'Share Certificate(s) (Original)' | 'DSE Pledge Confirmation Letter' | 'CDS Account Statement'
  | 'Board Resolution (Authorising Pledge)' | 'Share Transfer Form (Blank, Signed)' | 'DSE Registry Search'
  // FDR
  | 'Fixed Deposit Receipt (Original)' | 'Bank Lien Letter / Pledge Confirmation' | 'Account Statement'
  | 'Deed of Assignment'
  // Guarantee
  | 'Guarantee Deed (Executed)' | 'Guarantor Financial Statements' | 'Board Resolution (if Corporate Guarantor)'
  | 'Certificate of Incorporation (if Corporate)' | 'Guarantor ID / KYC Documents'
  // Ship/Vessel
  | 'Ship Registration Certificate (TASAC)' | 'Mortgage of Ship Deed' | 'TASAC Encumbrance Search'
  | 'Hull & Machinery Insurance Policy' | 'Valuation / Survey Report' | 'Classification Society Certificate'
  | 'Crew & Manning Certificate';

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
  workflowStage?: string;
  signedUrl?: string;
  isRollback?: boolean;
  rolledBackFromVersion?: number | null;
  rolledBackByName?: string | null;
  rolledBackAt?: string | null;
}

export interface DocumentVersionAudit {
  id: string;
  collateralRecordId: string;
  collateralId: string;
  documentId: string;
  fileName: string;
  action: 'upload' | 'rollback' | 'delete';
  fromVersion: number | null;
  toVersion: number;
  filePath: string;
  fileSize: number;
  notes: string;
  performedBy: string | null;
  performedByName: string;
  performedAt: string;
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
    workflowStage: row.workflow_stage ?? undefined,
    isRollback: row.is_rollback ?? false,
    rolledBackFromVersion: row.rolled_back_from_version ?? null,
    rolledBackByName: row.rolled_back_by_name ?? null,
    rolledBackAt: row.rolled_back_at ?? null,
  };
}

function rowToAudit(row: any): DocumentVersionAudit {
  return {
    id: row.id,
    collateralRecordId: row.collateral_record_id,
    collateralId: row.collateral_id,
    documentId: row.document_id,
    fileName: row.file_name,
    action: row.action,
    fromVersion: row.from_version ?? null,
    toVersion: row.to_version,
    filePath: row.file_path,
    fileSize: row.file_size,
    notes: row.notes ?? '',
    performedBy: row.performed_by ?? null,
    performedByName: row.performed_by_name ?? '',
    performedAt: row.performed_at,
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

  async getAll(): Promise<CollateralDocument[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch all documents error:', error.message);
        return [];
      }

      const docs = (data ?? []).map(rowToDocument);

      // Generate signed URLs in parallel
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
      console.error('Document getAll failed:', err.message);
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
  ): Promise<{ doc: CollateralDocument; error?: never } | { doc?: never; error: string }> {
    const supabase = createClient();
    try {
      if (!collateralRecordId) {
        return { error: 'No collateral record selected. Please select a collateral record first.' };
      }
      if (!userId) {
        return { error: 'You must be logged in to upload documents.' };
      }

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
      const safeCollateralId = (collateralId || collateralRecordId).replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `${safeCollateralId}/${timestamp}_v${version}_${safeFileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('collateral-documents')
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        console.error('Storage upload error:', uploadError.message);
        if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('Unauthorized')) {
          return { error: 'Permission denied. You do not have access to upload documents.' };
        }
        if (uploadError.message?.includes('Duplicate')) {
          return { error: 'A file with this name already exists. Please rename the file and try again.' };
        }
        return { error: `Upload failed: ${uploadError.message}` };
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
          is_rollback: false,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Document record insert error:', insertError.message);
        // Attempt to clean up uploaded file
        await supabase.storage.from('collateral-documents').remove([filePath]);
        if (insertError.message?.includes('row-level security') || insertError.message?.includes('permission denied')) {
          return { error: 'Permission denied. You do not have access to save document records.' };
        }
        return { error: `Failed to save document record: ${insertError.message}` };
      }

      const doc = data ? rowToDocument(data) : rowToDocument({
        id: '', collateral_record_id: collateralRecordId, collateral_id: collateralId,
        file_name: file.name, file_path: filePath, file_size: file.size,
        mime_type: file.type, document_type: documentType, version, notes,
        uploaded_by: userId, uploaded_by_name: userName, created_at: new Date().toISOString(),
        is_rollback: false,
      });

      // Write audit log entry
      if (doc.id) {
        await supabase.from('document_version_audit').insert({
          collateral_record_id: collateralRecordId,
          collateral_id: collateralId,
          document_id: doc.id,
          file_name: file.name,
          action: 'upload',
          from_version: version > 1 ? version - 1 : null,
          to_version: version,
          file_path: filePath,
          file_size: file.size,
          notes,
          performed_by: userId,
          performed_by_name: userName,
          performed_at: new Date().toISOString(),
        }).then(() => {}).catch(() => {});
      }

      return { doc };
    } catch (err: any) {
      console.error('Document upload failed:', err.message);
      return { error: err.message || 'An unexpected error occurred during upload.' };
    }
  },

  /**
   * Rollback: creates a new document record pointing to the old version's file path,
   * increments the version counter, and writes an audit entry.
   */
  async rollback(
    targetDoc: CollateralDocument,
    currentVersion: number,
    userId: string,
    userName: string
  ): Promise<{ doc: CollateralDocument; error?: never } | { doc?: never; error: string }> {
    const supabase = createClient();
    try {
      if (!userId) {
        return { error: 'You must be logged in to perform a rollback.' };
      }

      const newVersion = currentVersion + 1;
      const now = new Date().toISOString();

      // Insert a new document record that re-uses the old file path
      const { data, error: insertError } = await supabase
        .from('collateral_documents')
        .insert({
          collateral_record_id: targetDoc.collateralRecordId,
          collateral_id: targetDoc.collateralId,
          file_name: targetDoc.fileName,
          file_path: targetDoc.filePath,
          file_size: targetDoc.fileSize,
          mime_type: targetDoc.mimeType,
          document_type: targetDoc.documentType,
          version: newVersion,
          notes: `Rolled back to v${targetDoc.version} by ${userName}`,
          uploaded_by: userId,
          uploaded_by_name: userName,
          is_rollback: true,
          rolled_back_from_version: targetDoc.version,
          rolled_back_by: userId,
          rolled_back_by_name: userName,
          rolled_back_at: now,
        })
        .select()
        .single();

      if (insertError) {
        console.error('Rollback insert error:', insertError.message);
        return { error: `Rollback failed: ${insertError.message}` };
      }

      const doc = rowToDocument(data);

      // Write audit log entry
      await supabase.from('document_version_audit').insert({
        collateral_record_id: targetDoc.collateralRecordId,
        collateral_id: targetDoc.collateralId,
        document_id: doc.id,
        file_name: targetDoc.fileName,
        action: 'rollback',
        from_version: currentVersion,
        to_version: newVersion,
        file_path: targetDoc.filePath,
        file_size: targetDoc.fileSize,
        notes: `Rolled back to v${targetDoc.version}`,
        performed_by: userId,
        performed_by_name: userName,
        performed_at: now,
      }).then(() => {}).catch(() => {});

      return { doc };
    } catch (err: any) {
      console.error('Rollback failed:', err.message);
      return { error: err.message || 'An unexpected error occurred during rollback.' };
    }
  },

  /**
   * Fetch the full version audit trail for a specific file within a collateral record.
   */
  async getVersionAudit(collateralRecordId: string, fileName: string): Promise<DocumentVersionAudit[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('document_version_audit')
        .select('*')
        .eq('collateral_record_id', collateralRecordId)
        .eq('file_name', fileName)
        .order('performed_at', { ascending: false });

      if (error) {
        console.error('Fetch version audit error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToAudit);
    } catch (err: any) {
      console.error('Version audit fetch failed:', err.message);
      return [];
    }
  },

  /**
   * Fetch the full version audit trail across ALL collateral records.
   * Used for the global audit trail tab in CollateralDocumentsContent.
   */
  async getAllVersionAudit(limit = 200): Promise<DocumentVersionAudit[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('document_version_audit')
        .select('*')
        .order('performed_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Fetch all version audit error:', error.message);
        return [];
      }
      return (data ?? []).map(rowToAudit);
    } catch (err: any) {
      console.error('getAllVersionAudit failed:', err.message);
      return [];
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
