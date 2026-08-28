'use client';

/**
 * workflowTaskBridge.ts
 * 
 * Centralised helper that all workflows call to write a task to user_tasks
 * and optionally fire email + SMS notifications.
 * 
 * Usage:
 *   import { createWorkflowTask } from '@/lib/supabase/workflowTaskBridge';
 *   await createWorkflowTask({ ... });
 */

import { userTaskService, CreateTaskInput, sendTaskAssignmentNotification } from '@/lib/supabase/userTaskService';

export type WorkflowTaskInput = {
  // Required
  assignedTo: string;           // UUID of the assignee
  workflowName: string;         // e.g. 'Perfection', 'Valuation', 'Document Approval'
  taskName: string;             // Short task name
  title: string;                // Full display title
  // Optional
  instanceId?: string;
  collateralId?: string;
  collateralRecordId?: string;
  assignedBy?: string;          // UUID of assigner
  assignedByName?: string;
  deadline?: string;            // ISO date string
  deepLink?: string;            // URL to the action page
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  comments?: string;
  // Notification
  notify?: {
    assigneeName: string;
    assigneeEmail: string;
    assigneePhone?: string;
  };
};

export async function createWorkflowTask(input: WorkflowTaskInput): Promise<void> {
  const taskInput: CreateTaskInput = {
    assignedTo: input.assignedTo,
    collateralRecordId: input.collateralRecordId,
    collateralId: input.collateralId ?? '',
    taskType: 'workflow_step',
    title: input.title,
    description: input.description ?? '',
    actionUrl: input.deepLink ?? null,
    actionLabel: 'Open Task',
    priority: input.priority ?? 'normal',
    dueDate: input.deadline ? input.deadline.split('T')[0] : undefined,
    createdBy: input.assignedBy,
    workflowName: input.workflowName,
    instanceId: input.instanceId,
    taskName: input.taskName,
    assignedBy: input.assignedBy,
    assignedByName: input.assignedByName,
    assignedDate: new Date().toISOString(),
    deadline: input.deadline,
    comments: input.comments,
    deepLink: input.deepLink,
  };

  try {
    await userTaskService.create(taskInput);
  } catch (err) {
    console.error('[workflowTaskBridge] Failed to create task:', err);
    return;
  }

  // Fire notification (non-blocking)
  if (input.notify?.assigneeEmail) {
    sendTaskAssignmentNotification({
      assigneeName: input.notify.assigneeName,
      assigneeEmail: input.notify.assigneeEmail,
      assigneePhone: input.notify.assigneePhone,
      taskTitle: input.title,
      workflowName: input.workflowName,
      assignedByName: input.assignedByName ?? 'System',
      deadline: input.deadline,
      deepLink: input.deepLink,
      collateralId: input.collateralId,
    }).catch(() => {/* non-blocking */});
  }
}

// ─── Workflow-specific convenience wrappers ───────────────────────────────────

export async function createPerfectionTask(params: {
  assignedTo: string;
  collateralId: string;
  collateralRecordId?: string;
  instanceId?: string;
  assignedBy?: string;
  assignedByName?: string;
  deadline?: string;
  notify?: WorkflowTaskInput['notify'];
}): Promise<void> {
  return createWorkflowTask({
    ...params,
    workflowName: 'Perfection',
    taskName: 'Perfection Review',
    title: `Perfection review required for ${params.collateralId}`,
    deepLink: `/perfection-workflow`,
    priority: 'high',
  });
}

export async function createValuationTask(params: {
  assignedTo: string;
  collateralId: string;
  collateralRecordId?: string;
  instanceId?: string;
  assignedBy?: string;
  assignedByName?: string;
  deadline?: string;
  notify?: WorkflowTaskInput['notify'];
}): Promise<void> {
  return createWorkflowTask({
    ...params,
    workflowName: 'Valuation',
    taskName: 'Valuation Assignment',
    title: `Valuation required for ${params.collateralId}`,
    deepLink: `/valuation-workflow`,
    priority: 'normal',
  });
}

export async function createDocumentApprovalTask(params: {
  assignedTo: string;
  collateralId: string;
  collateralRecordId?: string;
  documentType?: string;
  instanceId?: string;
  assignedBy?: string;
  assignedByName?: string;
  deadline?: string;
  notify?: WorkflowTaskInput['notify'];
}): Promise<void> {
  return createWorkflowTask({
    ...params,
    workflowName: 'Document Approval',
    taskName: 'Document Review',
    title: `Document approval required${params.documentType ? ` — ${params.documentType}` : ''} for ${params.collateralId}`,
    deepLink: `/document-approval`,
    priority: 'normal',
  });
}

export async function createSubstitutionTask(params: {
  assignedTo: string;
  collateralId: string;
  instanceId?: string;
  assignedBy?: string;
  assignedByName?: string;
  deadline?: string;
  notify?: WorkflowTaskInput['notify'];
}): Promise<void> {
  return createWorkflowTask({
    ...params,
    workflowName: 'Collateral Substitution',
    taskName: 'Substitution Review',
    title: `Substitution request review for ${params.collateralId}`,
    deepLink: `/collateral-substitution`,
    priority: 'normal',
  });
}

export async function createReleaseApprovalTask(params: {
  assignedTo: string;
  collateralId: string;
  instanceId?: string;
  assignedBy?: string;
  assignedByName?: string;
  deadline?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  notify?: WorkflowTaskInput['notify'];
}): Promise<void> {
  return createWorkflowTask({
    ...params,
    workflowName: 'Release Approval',
    taskName: 'Release Review',
    title: `Release approval required for ${params.collateralId}`,
    deepLink: `/release-approval`,
    priority: params.priority ?? 'high',
  });
}

export async function createRegistrySubmissionTask(params: {
  assignedTo: string;
  collateralId: string;
  instanceId?: string;
  assignedBy?: string;
  assignedByName?: string;
  deadline?: string;
  notify?: WorkflowTaskInput['notify'];
}): Promise<void> {
  return createWorkflowTask({
    ...params,
    workflowName: 'Registry Submission',
    taskName: 'Registry Filing',
    title: `Registry submission required for ${params.collateralId}`,
    deepLink: `/workflows/registry-submissions`,
    priority: 'normal',
  });
}

export async function createArchiveRequestTask(params: {
  assignedTo: string;
  collateralId: string;
  instanceId?: string;
  assignedBy?: string;
  assignedByName?: string;
  deadline?: string;
  notify?: WorkflowTaskInput['notify'];
}): Promise<void> {
  return createWorkflowTask({
    ...params,
    workflowName: 'Archive Request',
    taskName: 'Archive Processing',
    title: `Archive request processing for ${params.collateralId}`,
    deepLink: `/archive/access-requests`,
    priority: 'low',
  });
}
