'use client';

import { createClient } from '@/lib/supabase/client';
import { auditLogService } from '@/lib/supabase/auditLogService';
import { createDocumentApprovalTask } from '@/lib/supabase/workflowTaskBridge';

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
  isMandatory?: boolean;
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
    isMandatory: row.is_mandatory ?? false,
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

// ─── Internal helper: check all mandatory docs and update collateral status ───

async function _checkAndUpdateCollateralStatus(
  supabase: ReturnType<typeof createClient>,
  collateralRecordId: string | null,
  collateralId: string,
  triggerAction: 'approve' | 'reject',
): Promise<void> {
  if (!collateralRecordId && !collateralId) return;
  try {
    // Fetch all documents for this collateral
    let query = collateralRecordId
      ? supabase.from('collateral_documents').select('approval_status, is_mandatory').eq('collateral_record_id', collateralRecordId)
      : supabase.from('collateral_documents').select('approval_status, is_mandatory').eq('collateral_id', collateralId);

    const { data: docs } = await query;
    if (!docs || docs.length === 0) return;

    const mandatoryDocs = docs.filter((d: any) => d.is_mandatory === true);

    if (triggerAction === 'reject') {
      // If a mandatory doc is rejected → Under Review
      const hasRejectedMandatory = mandatoryDocs.some((d: any) => d.approval_status === 'rejected');
      if (hasRejectedMandatory) {
        const target = collateralRecordId
          ? supabase.from('collateral_records').update({ status: 'Under Review' }).eq('id', collateralRecordId)
          : supabase.from('collateral_records').update({ status: 'Under Review' }).eq('collateral_id', collateralId);
        await target.then(() => {}).catch((e) => console.warn('[docApproval] collateral status write-back failed:', e.message));
      }
    } else if (triggerAction === 'approve') {
      // If all mandatory docs are approved → Perfected
      if (mandatoryDocs.length > 0 && mandatoryDocs.every((d: any) => d.approval_status === 'approved')) {
        const target = collateralRecordId
          ? supabase.from('collateral_records').update({ status: 'Perfected' }).eq('id', collateralRecordId)
          : supabase.from('collateral_records').update({ status: 'Perfected' }).eq('collateral_id', collateralId);
        await target.then(() => {}).catch((e) => console.warn('[docApproval] collateral status write-back failed:', e.message));
      }
    }
  } catch (err) {
    console.warn('[docApproval] _checkAndUpdateCollateralStatus failed:', err);
  }
}

// ─── Internal helper: sync workflow_instances ─────────────────────────────────

async function _syncDocWorkflowInstance(
  supabase: ReturnType<typeof createClient>,
  collateralRecordId: string | null,
  collateralId: string,
  action: 'approve' | 'reject',
  performedBy: string,
  performedByName: string,
  performedByRole: string,
  notes?: string,
): Promise<void> {
  try {
    const referenceId = collateralRecordId ?? collateralId;
    if (!referenceId) return;

    const { data: instances } = await supabase
      .from('workflow_instances')
      .select('id, instance_status')
      .eq('reference_id', referenceId)
      .eq('reference_type', 'document_approval')
      .in('instance_status', ['active', 'escalated'])
      .limit(1);

    const instance = instances?.[0];
    if (!instance) return;

    const { data: currentStep } = await supabase
      .from('workflow_instance_steps')
      .select('id, step_id')
      .eq('instance_id', instance.id)
      .eq('step_status', 'active')
      .maybeSingle();

    const now = new Date().toISOString();
    if (currentStep) {
      await supabase.from('workflow_instance_steps').update({
        step_status: action === 'approve' ? 'completed' : 'rejected',
        completed_at: now,
        completed_by: performedBy,
        action_taken: action,
        notes: notes ?? null,
      }).eq('id', currentStep.id);
    }

    await supabase.from('workflow_instances').update({
      instance_status: action === 'approve' ? 'completed' : 'cancelled',
      current_step_id: null,
      completed_by: performedBy,
      completed_at: now,
    }).eq('id', instance.id);

    await supabase.from('workflow_transition_log').insert({
      instance_id: instance.id,
      instance_step_id: currentStep?.id ?? null,
      from_step_id: currentStep?.step_id ?? null,
      to_step_id: null,
      action,
      performed_by: performedBy,
      performed_by_name: performedByName,
      performed_by_role: performedByRole,
      comment: notes ?? null,
    }).then(() => {}).catch((e) => console.warn('[docApproval] workflow transition log failed:', e.message));
  } catch (err) {
    console.warn('[docApproval] workflow instance sync failed:', err);
  }
}

// ─── Internal helper: notify approvers via user_tasks ─────────────────────────

async function _notifyDocumentApprovalTask(
  supabase: ReturnType<typeof createClient>,
  documentId: string,
  collateralId: string,
  collateralRecordId: string | null,
  documentType: string,
  submittedBy?: string,
  submittedByName?: string,
): Promise<void> {
  try {
    // Find the legal_officer approver
    const { data: approvers } = await supabase
      .from('user_profiles')
      .select('id, full_name, email, phone')
      .eq('role', 'legal_officer')
      .eq('is_active', true)
      .limit(1);

    const approver = approvers?.[0];
    if (!approver) return;

    await createDocumentApprovalTask({
      assignedTo: approver.id,
      collateralId,
      collateralRecordId: collateralRecordId ?? undefined,
      documentType,
      instanceId: documentId,
      assignedBy: submittedBy,
      assignedByName: submittedByName,
      notify: approver.email
        ? { assigneeName: approver.full_name ?? 'Approver', assigneeEmail: approver.email, assigneePhone: approver.phone ?? undefined }
        : undefined,
    });
  } catch (err) {
    console.warn('[documentApprovalService] _notifyDocumentApprovalTask failed:', err);
  }
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

      await auditLogService.logDocumentApproved(
        collateralRecordId,
        collateralId,
        fileName,
        documentType,
        userId,
        userName,
        notes
      );

      // ── Check if all mandatory docs approved → set collateral Perfected ────
      await _checkAndUpdateCollateralStatus(supabase, collateralRecordId, collateralId, 'approve');

      // ── Sync workflow_instances ────────────────────────────────────────────
      await _syncDocWorkflowInstance(supabase, collateralRecordId, collateralId, 'approve', userId, userName, userRole, notes);

      // ── Mark any pending document approval tasks as completed ──────────────
      await supabase
        .from('user_tasks')
        .update({ task_status: 'completed', completed_at: now, date_attended: now })
        .eq('instance_id', documentId)
        .eq('workflow_name', 'Document Approval')
        .in('task_status', ['pending', 'in_progress'])
        .then(() => {}).catch((e) => console.warn('[docApproval] task complete failed:', e.message));

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

      // ── If mandatory doc rejected → set collateral Under Review ───────────
      await _checkAndUpdateCollateralStatus(supabase, collateralRecordId, collateralId, 'reject');

      // ── Sync workflow_instances ────────────────────────────────────────────
      await _syncDocWorkflowInstance(supabase, collateralRecordId, collateralId, 'reject', userId, userName, userRole, reason);

      // ── Mark any pending document approval tasks as completed ──────────────
      await supabase
        .from('user_tasks')
        .update({ task_status: 'completed', completed_at: now, date_attended: now })
        .eq('instance_id', documentId)
        .eq('workflow_name', 'Document Approval')
        .in('task_status', ['pending', 'in_progress'])
        .then(() => {}).catch((e) => console.warn('[docApproval] task complete failed:', e.message));

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

      // ── Notify approver via user_tasks ─────────────────────────────────────
      _notifyDocumentApprovalTask(
        supabase,
        documentId,
        collateralId,
        collateralRecordId,
        documentType,
        userId,
        userName,
      ).catch(() => {/* non-blocking */});

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
