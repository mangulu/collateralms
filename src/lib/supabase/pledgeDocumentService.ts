'use client';

import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type PledgeDocumentType =
  | 'Title Deed' |'Valuation Report' |'Insurance Certificate' |'Charge Certificate' |'Board Resolution' |'Mortgage Deed' |'Pledge Agreement' |'Other';

export const PLEDGE_DOCUMENT_TYPES: PledgeDocumentType[] = [
  'Title Deed',
  'Valuation Report',
  'Insurance Certificate',
  'Charge Certificate',
  'Board Resolution',
  'Mortgage Deed',
  'Pledge Agreement',
  'Other',
];

export const DOC_TYPE_META: Record<PledgeDocumentType, { color: string; bg: string; border: string; icon: string }> = {
  'Title Deed':            { color: 'text-blue-700',    bg: 'bg-blue-50',    border: 'border-blue-200',   icon: '🏠' },
  'Valuation Report':      { color: 'text-amber-700',   bg: 'bg-amber-50',   border: 'border-amber-200',  icon: '📊' },
  'Insurance Certificate': { color: 'text-cyan-700',    bg: 'bg-cyan-50',    border: 'border-cyan-200',   icon: '🛡️' },
  'Charge Certificate':    { color: 'text-purple-700',  bg: 'bg-purple-50',  border: 'border-purple-200', icon: '📋' },
  'Board Resolution':      { color: 'text-rose-700',    bg: 'bg-rose-50',    border: 'border-rose-200',   icon: '📝' },
  'Mortgage Deed':         { color: 'text-indigo-700',  bg: 'bg-indigo-50',  border: 'border-indigo-200', icon: '🏦' },
  'Pledge Agreement':      { color: 'text-teal-700',    bg: 'bg-teal-50',    border: 'border-teal-200',   icon: '🤝' },
  'Other':                 { color: 'text-slate-600',   bg: 'bg-slate-100',  border: 'border-slate-200',  icon: '📄' },
};

export interface PledgeDocument {
  id: string;
  obligorId: string;
  collateralId: string | null;
  documentType: PledgeDocumentType;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  notes: string;
  expiryDate: string | null;
  issuedDate: string | null;
  issuer: string;
  referenceNumber: string;
  uploadedBy: string | null;
  uploadedByName: string;
  createdAt: string;
  updatedAt: string;
  signedUrl?: string;
}

export interface PledgeDocumentAccessLog {
  id: string;
  documentId: string;
  obligorId: string;
  action: 'uploaded' | 'viewed' | 'downloaded' | 'deleted' | 'expiry_updated';
  performedBy: string | null;
  performedByName: string;
  ipAddress: string | null;
  notes: string | null;
  createdAt: string;
}

export type ExpiryStatus = 'expired' | 'expiring_soon' | 'valid' | 'no_expiry';

export function getExpiryStatus(expiryDate: string | null): ExpiryStatus {
  if (!expiryDate) return 'no_expiry';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  const daysUntilExpiry = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  if (daysUntilExpiry < 0) return 'expired';
  if (daysUntilExpiry <= 30) return 'expiring_soon';
  return 'valid';
}

export function getDaysUntilExpiry(expiryDate: string | null): number | null {
  if (!expiryDate) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  return Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToDoc(row: any): PledgeDocument {
  return {
    id: row.id,
    obligorId: row.obligor_id,
    collateralId: row.collateral_id ?? null,
    documentType: row.document_type as PledgeDocumentType,
    fileName: row.file_name,
    filePath: row.file_path,
    fileSize: row.file_size ?? 0,
    mimeType: row.mime_type ?? 'application/octet-stream',
    notes: row.notes ?? '',
    expiryDate: row.expiry_date ?? null,
    issuedDate: row.issued_date ?? null,
    issuer: row.issuer ?? '',
    referenceNumber: row.reference_number ?? '',
    uploadedBy: row.uploaded_by ?? null,
    uploadedByName: row.uploaded_by_name ?? 'System',
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToLog(row: any): PledgeDocumentAccessLog {
  return {
    id: row.id,
    documentId: row.document_id,
    obligorId: row.obligor_id,
    action: row.action,
    performedBy: row.performed_by ?? null,
    performedByName: row.performed_by_name ?? 'System',
    ipAddress: row.ip_address ?? null,
    notes: row.notes ?? null,
    createdAt: row.created_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const pledgeDocumentService = {
  // ── Fetch documents for an obligor ────────────────────────────────────────
  async getByObligorId(obligorId: string): Promise<PledgeDocument[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('pledge_documents')
        .select('*')
        .eq('obligor_id', obligorId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch pledge documents error:', error.message);
        return [];
      }

      const docs = (data ?? []).map(rowToDoc);

      // Generate signed URLs
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
      console.error('Pledge document fetch failed:', err.message);
      return [];
    }
  },

  // ── Upload a pledge document ───────────────────────────────────────────────
  async upload(
    file: File,
    obligorId: string,
    documentType: PledgeDocumentType,
    opts: {
      notes?: string;
      expiryDate?: string;
      issuedDate?: string;
      issuer?: string;
      referenceNumber?: string;
      collateralId?: string;
      userId: string;
      userName: string;
    }
  ): Promise<{ doc: PledgeDocument; error?: never } | { doc?: never; error: string }> {
    const supabase = createClient();
    try {
      if (!obligorId) return { error: 'Obligor ID is required.' };
      if (!opts.userId) return { error: 'You must be logged in to upload documents.' };

      const timestamp = Date.now();
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const filePath = `pledge/${obligorId}/${timestamp}_${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from('collateral-documents')
        .upload(filePath, file, { upsert: false });

      if (uploadError) {
        if (uploadError.message?.includes('row-level security') || uploadError.message?.includes('Unauthorized')) {
          return { error: 'Permission denied. You do not have access to upload documents.' };
        }
        return { error: `Upload failed: ${uploadError.message}` };
      }

      const { data, error: insertError } = await supabase
        .from('pledge_documents')
        .insert({
          obligor_id:       obligorId,
          collateral_id:    opts.collateralId ?? null,
          document_type:    documentType,
          file_name:        file.name,
          file_path:        filePath,
          file_size:        file.size,
          mime_type:        file.type || 'application/octet-stream',
          notes:            opts.notes ?? '',
          expiry_date:      opts.expiryDate || null,
          issued_date:      opts.issuedDate || null,
          issuer:           opts.issuer ?? '',
          reference_number: opts.referenceNumber ?? '',
          uploaded_by:      opts.userId,
          uploaded_by_name: opts.userName,
        })
        .select()
        .single();

      if (insertError) {
        await supabase.storage.from('collateral-documents').remove([filePath]);
        return { error: `Failed to save document record: ${insertError.message}` };
      }

      const doc = rowToDoc(data);

      // Write access log
      await pledgeDocumentService.logAccess(doc.id, obligorId, 'uploaded', opts.userId, opts.userName, `Uploaded ${documentType}: ${file.name}`);

      return { doc };
    } catch (err: any) {
      return { error: err.message ?? 'Upload failed.' };
    }
  },

  // ── Log document access ────────────────────────────────────────────────────
  async logAccess(
    documentId: string,
    obligorId: string,
    action: PledgeDocumentAccessLog['action'],
    performedBy: string | null,
    performedByName: string,
    notes?: string
  ): Promise<void> {
    const supabase = createClient();
    try {
      await supabase.from('pledge_document_access_log').insert({
        document_id:       documentId,
        obligor_id:        obligorId,
        action,
        performed_by:      performedBy,
        performed_by_name: performedByName,
        notes:             notes ?? null,
      });
    } catch {
      // Non-critical — don't throw
    }
  },

  // ── Get access log for an obligor ─────────────────────────────────────────
  async getAccessLog(obligorId: string, limit = 100): Promise<PledgeDocumentAccessLog[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('pledge_document_access_log')
        .select('*')
        .eq('obligor_id', obligorId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) return [];
      return (data ?? []).map(rowToLog);
    } catch {
      return [];
    }
  },

  // ── Update expiry date ─────────────────────────────────────────────────────
  async updateExpiry(
    docId: string,
    obligorId: string,
    expiryDate: string,
    userId: string,
    userName: string
  ): Promise<{ error?: string }> {
    const supabase = createClient();
    try {
      const { error } = await supabase
        .from('pledge_documents')
        .update({ expiry_date: expiryDate })
        .eq('id', docId);

      if (error) return { error: error.message };

      await pledgeDocumentService.logAccess(docId, obligorId, 'expiry_updated', userId, userName, `Expiry updated to ${expiryDate}`);
      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },

  // ── Delete a document ──────────────────────────────────────────────────────
  async delete(
    doc: PledgeDocument,
    userId: string,
    userName: string
  ): Promise<{ error?: string }> {
    const supabase = createClient();
    try {
      // Log before deletion so we still have the doc reference
      await pledgeDocumentService.logAccess(doc.id, doc.obligorId, 'deleted', userId, userName, `Deleted ${doc.documentType}: ${doc.fileName}`);

      const { error: dbError } = await supabase
        .from('pledge_documents')
        .delete()
        .eq('id', doc.id);

      if (dbError) return { error: dbError.message };

      // Remove from storage (best effort)
      await supabase.storage.from('collateral-documents').remove([doc.filePath]);

      return {};
    } catch (err: any) {
      return { error: err.message };
    }
  },
};
