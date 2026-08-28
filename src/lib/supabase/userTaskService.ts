'use client';

import { createClient } from '@/lib/supabase/client';

export type TaskType = 'document_upload' | 'workflow_step' | 'approval' | 'perfection' | 'valuation' | 'insurance' | 'general';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed' | 'cancelled';

export interface UserTask {
  id: string;
  assignedTo: string | null;
  collateralRecordId: string | null;
  collateralId: string;
  taskType: TaskType;
  title: string;
  description: string;
  actionUrl: string | null;
  actionLabel: string | null;
  priority: TaskPriority;
  taskStatus: TaskStatus;
  dueDate: string | null;
  completedAt: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  // Extended workspace fields
  workflowName: string | null;
  instanceId: string | null;
  taskName: string | null;
  assignedBy: string | null;
  assignedByName: string | null;
  assignedDate: string | null;
  deadline: string | null;
  dateAttended: string | null;
  attendedBy: string | null;
  attendedByName: string | null;
  comments: string | null;
  deepLink: string | null;
}

export interface CreateTaskInput {
  assignedTo: string;
  collateralRecordId?: string;
  collateralId?: string;
  taskType: TaskType;
  title: string;
  description?: string;
  actionUrl?: string;
  actionLabel?: string;
  priority?: TaskPriority;
  dueDate?: string;
  createdBy?: string;
  // Extended workspace fields
  workflowName?: string;
  instanceId?: string;
  taskName?: string;
  assignedBy?: string;
  assignedByName?: string;
  assignedDate?: string;
  deadline?: string;
  comments?: string;
  deepLink?: string;
}

export interface WorkspaceFilters {
  status?: TaskStatus | 'all' | 'overdue';
  assignedTo?: string;
  workflowName?: string;
  overdue?: boolean;
  search?: string;
}

function rowToTask(row: any): UserTask {
  return {
    id: row.id,
    assignedTo: row.assigned_to,
    collateralRecordId: row.collateral_record_id,
    collateralId: row.collateral_id ?? '',
    taskType: row.task_type as TaskType,
    title: row.title,
    description: row.description ?? '',
    actionUrl: row.action_url ?? null,
    actionLabel: row.action_label ?? null,
    priority: row.priority as TaskPriority,
    taskStatus: row.task_status as TaskStatus,
    dueDate: row.due_date ?? null,
    completedAt: row.completed_at ?? null,
    createdBy: row.created_by ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    workflowName: row.workflow_name ?? null,
    instanceId: row.instance_id ?? null,
    taskName: row.task_name ?? null,
    assignedBy: row.assigned_by ?? null,
    assignedByName: row.assigned_by_name ?? null,
    assignedDate: row.assigned_date ?? null,
    deadline: row.deadline ?? null,
    dateAttended: row.date_attended ?? null,
    attendedBy: row.attended_by ?? null,
    attendedByName: row.attended_by_name ?? null,
    comments: row.comments ?? null,
    deepLink: row.deep_link ?? null,
  };
}

export const userTaskService = {
  async getMyTasks(userId: string): Promise<UserTask[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_tasks')
      .select('*')
      .eq('assigned_to', userId)
      .neq('task_status', 'dismissed')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToTask);
  },

  async getAllTasks(filters?: WorkspaceFilters): Promise<UserTask[]> {
    const supabase = createClient();
    let query = supabase
      .from('user_tasks')
      .select('*')
      .neq('task_status', 'dismissed')
      .order('assigned_date', { ascending: false });

    if (filters?.status && filters.status !== 'all' && filters.status !== 'overdue') {
      query = query.eq('task_status', filters.status);
    }
    if (filters?.assignedTo) {
      query = query.eq('assigned_to', filters.assignedTo);
    }
    if (filters?.workflowName) {
      query = query.eq('workflow_name', filters.workflowName);
    }
    if (filters?.overdue || filters?.status === 'overdue') {
      const now = new Date().toISOString();
      query = query
        .lt('deadline', now)
        .not('deadline', 'is', null)
        .in('task_status', ['pending', 'in_progress']);
    }

    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(rowToTask);
  },

  async getPendingCount(userId: string): Promise<number> {
    const supabase = createClient();
    const { count, error } = await supabase
      .from('user_tasks')
      .select('*', { count: 'exact', head: true })
      .eq('assigned_to', userId)
      .in('task_status', ['pending', 'in_progress']);
    if (error) return 0;
    return count ?? 0;
  },

  async create(input: CreateTaskInput): Promise<UserTask> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_tasks')
      .insert({
        assigned_to: input.assignedTo,
        collateral_record_id: input.collateralRecordId ?? null,
        collateral_id: input.collateralId ?? '',
        task_type: input.taskType,
        title: input.title,
        description: input.description ?? '',
        action_url: input.actionUrl ?? null,
        action_label: input.actionLabel ?? null,
        priority: input.priority ?? 'normal',
        due_date: input.dueDate ?? null,
        created_by: input.createdBy ?? null,
        workflow_name: input.workflowName ?? null,
        instance_id: input.instanceId ?? null,
        task_name: input.taskName ?? null,
        assigned_by: input.assignedBy ?? null,
        assigned_by_name: input.assignedByName ?? null,
        assigned_date: input.assignedDate ?? new Date().toISOString(),
        deadline: input.deadline ?? null,
        comments: input.comments ?? null,
        deep_link: input.deepLink ?? null,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToTask(data);
  },

  async createMany(inputs: CreateTaskInput[]): Promise<void> {
    if (!inputs.length) return;
    const supabase = createClient();
    const rows = inputs.map((input) => ({
      assigned_to: input.assignedTo,
      collateral_record_id: input.collateralRecordId ?? null,
      collateral_id: input.collateralId ?? '',
      task_type: input.taskType,
      title: input.title,
      description: input.description ?? '',
      action_url: input.actionUrl ?? null,
      action_label: input.actionLabel ?? null,
      priority: input.priority ?? 'normal',
      due_date: input.dueDate ?? null,
      created_by: input.createdBy ?? null,
      workflow_name: input.workflowName ?? null,
      instance_id: input.instanceId ?? null,
      task_name: input.taskName ?? null,
      assigned_by: input.assignedBy ?? null,
      assigned_by_name: input.assignedByName ?? null,
      assigned_date: input.assignedDate ?? new Date().toISOString(),
      deadline: input.deadline ?? null,
      comments: input.comments ?? null,
      deep_link: input.deepLink ?? null,
    }));
    const { error } = await supabase.from('user_tasks').insert(rows);
    if (error) throw error;
  },

  async markComplete(taskId: string, attendedByName?: string): Promise<void> {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { error } = await supabase
      .from('user_tasks')
      .update({
        task_status: 'completed',
        completed_at: new Date().toISOString(),
        date_attended: new Date().toISOString(),
        attended_by: user?.id ?? null,
        attended_by_name: attendedByName ?? null,
      })
      .eq('id', taskId);
    if (error) throw error;
  },

  async markInProgress(taskId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_tasks')
      .update({ task_status: 'in_progress' })
      .eq('id', taskId);
    if (error) throw error;
  },

  async dismiss(taskId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_tasks')
      .update({ task_status: 'dismissed' })
      .eq('id', taskId);
    if (error) throw error;
  },

  async cancel(taskId: string, comments?: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_tasks')
      .update({ task_status: 'cancelled', comments })
      .eq('id', taskId);
    if (error) throw error;
  },

  async updateComments(taskId: string, comments: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_tasks')
      .update({ comments })
      .eq('id', taskId);
    if (error) throw error;
  },

  async getDistinctWorkflowNames(): Promise<string[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('user_tasks')
      .select('workflow_name')
      .not('workflow_name', 'is', null)
      .neq('task_status', 'dismissed');
    if (error) return [];
    const names = Array.from(new Set((data ?? []).map((r: any) => r.workflow_name).filter(Boolean)));
    return names as string[];
  },
};

// ─── Task Notification Service ────────────────────────────────────────────────

export interface TaskNotificationPayload {
  assigneeName: string;
  assigneeEmail: string;
  assigneePhone?: string;
  taskTitle: string;
  workflowName: string;
  assignedByName: string;
  deadline?: string;
  deepLink?: string;
  collateralId?: string;
}

export async function sendTaskAssignmentNotification(payload: TaskNotificationPayload): Promise<void> {
  try {
    // Email via Resend edge function
    await fetch('/api/task-notifications/send-assignment-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking
  }

  if (payload.assigneePhone) {
    try {
      const smsBody = `[ContentPro] Task assigned: "${payload.taskTitle}" (${payload.workflowName}) by ${payload.assignedByName}.${payload.deadline ? ` Deadline: ${new Date(payload.deadline).toLocaleDateString()}` : ''} ${payload.deepLink ? `Action: ${payload.deepLink}` : ''}`;
      await fetch('/api/sms/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.assigneePhone,
          message: smsBody,
          alertType: 'TASK_ASSIGNMENT',
          recipientName: payload.assigneeName,
          actionUrl: payload.deepLink,
        }),
      });
    } catch {
      // Non-blocking
    }
  }
}

export async function sendDeadlineApproachNotification(payload: TaskNotificationPayload): Promise<void> {
  try {
    await fetch('/api/task-notifications/send-deadline-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {
    // Non-blocking
  }

  if (payload.assigneePhone) {
    try {
      const smsBody = `[ContentPro] DEADLINE APPROACHING: "${payload.taskTitle}" (${payload.workflowName}) is due ${payload.deadline ? new Date(payload.deadline).toLocaleDateString() : 'soon'}. ${payload.deepLink ? `Action: ${payload.deepLink}` : ''}`;
      await fetch('/api/sms/send-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: payload.assigneePhone,
          message: smsBody,
          alertType: 'TASK_DEADLINE',
          recipientName: payload.assigneeName,
          actionUrl: payload.deepLink,
        }),
      });
    } catch {
      // Non-blocking
    }
  }
}
