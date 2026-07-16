'use client';

import { createClient } from '@/lib/supabase/client';
import { auditLogService } from '@/lib/supabase/auditLogService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type DocumentApprovalStatus = 'pending' | 'approved' | 'rejected' | 'under_review';

export interface DocumentApprovalRecord {
  id: string;
  documentId: string;
  collateralRecordId: string | null;
  collateralId: string;
  documentType: string;
  fileName: string;
  fileSize: number;
  mimeType: string;
  uploadedByName: string;
  uploadedAt: string;
  approvalStatus: DocumentApprovalStatus;
  approvalNotes: string | null;
  approvedByName: string | null;
  approvedAt: string | null;
  signedUrl?: string;
  filePath: string;
  version: number;
  notes: string;
}

export interface DocumentApprovalAuditEntry {
  id: string;
  documentId: string;
  collateralId: string;
  documentType: string;
  fileName: string;
  action: DocumentApprovalStatus;
  notes: string;
  performedByName: string;
  performedByRole: string;
  createdAt: string;
}

export interface ApprovalStats {
  pending: number;
  underReview: number;
  approved: number;
  rejected: number;
  total: number;
}

// ─── Row mappers ──────────────────────────────────────────────────────────────

function rowToApprovalRecord(row: any): DocumentApprovalRecord {
  return {
    id: row.id,
    documentId: row.id,
    collateralRecordId: row.collateral_record_id ?? null,
    collateralId: row.collateral_id ?? '',
    documentType: row.document_type ?? 'Other',
    fileName: row.file_name ?? '',
    fileSize: row.file_size ?? 0,
    mimeType: row.mime_type ?? 'application/octet-stream',
    uploadedByName: row.uploaded_by_name ?? '',
    uploadedAt: row.created_at,
    approvalStatus: (row.approval_status ?? 'pending') as DocumentApprovalStatus,
    approvalNotes: row.approval_notes ?? null,
    approvedByName: row.approved_by_name ?? null,
    approvedAt: row.approved_at ?? null,
    filePath: row.file_path ?? '',
    version: row.version ?? 1,
    notes: row.notes ?? '',
  };
}

function rowToAuditEntry(row: any): DocumentApprovalAuditEntry {
  return {
    id: row.id,
    documentId: row.document_id,
    collateralId: row.collateral_id ?? '',
    documentType: row.document_type ?? '',
    fileName: row.file_name ?? '',
    action: row.action as DocumentApprovalStatus,
    notes: row.notes ?? '',
    performedByName: row.performed_by_name ?? '',
    performedByRole: row.performed_by_role ?? '',
    createdAt: row.created_at,
  };
}

// ─── documentApprovalService ──────────────────────────────────────────────────

export const documentApprovalService = {

  // Fetch all documents pending/under-review for Legal Officer approval queue
  async getPendingDocuments(statusFilter?: DocumentApprovalStatus | 'all'): Promise<DocumentApprovalRecord[]> {
    const supabase = createClient();
    try {
      let query = supabase
        .from('collateral_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (!statusFilter || statusFilter === 'all') {
        // default: show pending + under_review
        query = query.in('approval_status', ['pending', 'under_review']);
      } else {
        query = query.eq('approval_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Fetch pending documents error:', error.message);
        return [];
      }

      const docs = (data ?? []).map(rowToApprovalRecord);

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
      console.error('documentApprovalService.getPendingDocuments failed:', err.message);
      return [];
    }
  },

  // Fetch all documents with any approval status (for history view)
  async getAllDocuments(statusFilter?: DocumentApprovalStatus | 'all'): Promise<DocumentApprovalRecord[]> {
    const supabase = createClient();
    try {
      let query = supabase
        .from('collateral_documents')
        .select('*')
        .order('created_at', { ascending: false });

      if (statusFilter && statusFilter !== 'all') {
        query = query.eq('approval_status', statusFilter);
      }

      const { data, error } = await query;
      if (error) {
        console.error('Fetch all documents error:', error.message);
        return [];
      }

      const docs = (data ?? []).map(rowToApprovalRecord);

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
      console.error('documentApprovalService.getAllDocuments failed:', err.message);
      return [];
    }
  },

  // Approve a document
  async approveDocument(
    documentId: string,
    collateralId: string,
    collateralRecordId: string | null,
    documentType: string,
    fileName: string,
    notes: string,
    userId: string,
    userName: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();
    try {
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('collateral_documents')
        .update({
          approval_status: 'approved',
          approval_notes: notes || null,
          approved_by: userId,
          approved_by_name: userName,
          approved_at: now,
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('Approve document error:', updateError.message);
        return false;
      }

      // Insert approval audit record
      await supabase.from('document_approvals').insert({
        document_id: documentId,
        collateral_record_id: collateralRecordId,
        collateral_id: collateralId,
        document_type: documentType,
        file_name: fileName,
        action: 'approved',
        notes: notes || '',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });

      // Write to main audit log
      await auditLogService.logDocumentApproved(
        collateralRecordId,
        collateralId,
        fileName,
        documentType,
        userId,
        userName,
        notes
      );

      return true;
    } catch (err: any) {
      console.error('documentApprovalService.approveDocument failed:', err.message);
      return false;
    }
  },

  // Reject a document
  async rejectDocument(
    documentId: string,
    collateralId: string,
    collateralRecordId: string | null,
    documentType: string,
    fileName: string,
    reason: string,
    userId: string,
    userName: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();
    try {
      const now = new Date().toISOString();

      const { error: updateError } = await supabase
        .from('collateral_documents')
        .update({
          approval_status: 'rejected',
          approval_notes: reason,
          approved_by: userId,
          approved_by_name: userName,
          approved_at: now,
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('Reject document error:', updateError.message);
        return false;
      }

      await supabase.from('document_approvals').insert({
        document_id: documentId,
        collateral_record_id: collateralRecordId,
        collateral_id: collateralId,
        document_type: documentType,
        file_name: fileName,
        action: 'rejected',
        notes: reason,
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });

      await auditLogService.logDocumentRejected(
        collateralRecordId,
        collateralId,
        fileName,
        documentType,
        userId,
        userName,
        reason
      );

      return true;
    } catch (err: any) {
      console.error('documentApprovalService.rejectDocument failed:', err.message);
      return false;
    }
  },

  // Mark document as under review
  async markUnderReview(
    documentId: string,
    collateralId: string,
    collateralRecordId: string | null,
    documentType: string,
    fileName: string,
    notes: string,
    userId: string,
    userName: string,
    userRole: string
  ): Promise<boolean> {
    const supabase = createClient();
    try {
      const { error: updateError } = await supabase
        .from('collateral_documents')
        .update({
          approval_status: 'under_review',
          approval_notes: notes || null,
        })
        .eq('id', documentId);

      if (updateError) {
        console.error('Mark under review error:', updateError.message);
        return false;
      }

      await supabase.from('document_approvals').insert({
        document_id: documentId,
        collateral_record_id: collateralRecordId,
        collateral_id: collateralId,
        document_type: documentType,
        file_name: fileName,
        action: 'under_review',
        notes: notes || '',
        performed_by: userId,
        performed_by_name: userName,
        performed_by_role: userRole,
      });

      return true;
    } catch (err: any) {
      console.error('documentApprovalService.markUnderReview failed:', err.message);
      return false;
    }
  },

  // Get approval audit trail for a specific document
  async getDocumentAuditTrail(documentId: string): Promise<DocumentApprovalAuditEntry[]> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('document_approvals')
        .select('*')
        .eq('document_id', documentId)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch document audit trail error:', error.message);
        return [];
      }

      return (data ?? []).map(rowToAuditEntry);
    } catch (err: any) {
      console.error('documentApprovalService.getDocumentAuditTrail failed:', err.message);
      return [];
    }
  },

  // Get approval stats
  async getApprovalStats(): Promise<ApprovalStats> {
    const supabase = createClient();
    try {
      const { data, error } = await supabase
        .from('collateral_documents')
        .select('approval_status');

      if (error || !data) {
        return { pending: 0, underReview: 0, approved: 0, rejected: 0, total: 0 };
      }

      const stats = data.reduce(
        (acc, row) => {
          const s = row.approval_status ?? 'pending';
          if (s === 'pending') acc.pending++;
          else if (s === 'under_review') acc.underReview++;
          else if (s === 'approved') acc.approved++;
          else if (s === 'rejected') acc.rejected++;
          acc.total++;
          return acc;
        },
        { pending: 0, underReview: 0, approved: 0, rejected: 0, total: 0 }
      );

      return stats;
    } catch {
      return { pending: 0, underReview: 0, approved: 0, rejected: 0, total: 0 };
    }
  },
};
