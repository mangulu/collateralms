'use client';

import { createClient } from '@/lib/supabase/client';

export type TaskType = 'document_upload' | 'workflow_step' | 'approval' | 'perfection' | 'valuation' | 'insurance' | 'general';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'dismissed';

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
    }));
    const { error } = await supabase.from('user_tasks').insert(rows);
    if (error) throw error;
  },

  async markComplete(taskId: string): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase
      .from('user_tasks')
      .update({ task_status: 'completed', completed_at: new Date().toISOString() })
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
};
