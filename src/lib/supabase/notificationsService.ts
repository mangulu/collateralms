'use client';

import { createClient } from '@/lib/supabase/client';
import { complianceBreachService } from '@/lib/supabase/complianceBreachService';
import { userTaskService } from '@/lib/supabase/userTaskService';
import { auditLogService, EVENT_CATEGORIES } from '@/lib/supabase/auditLogService';
import { listInsurancePolicies } from '@/lib/supabase/insuranceService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NotificationType = 'brela_deadline' | 'status_change' | 'overdue_action' | 'document_expiry' | 'workflow' | 'system';
export type NotificationPriority = 'high' | 'medium' | 'low';

export interface AppNotification {
  id: string; // stable "source:sourceId" key, also the notification_states.source_key
  type: NotificationType;
  title: string;
  message: string;
  collateralId?: string;
  actionHref?: string;
  actionLabel?: string;
  isRead: boolean;
  createdAt: string;
  priority: NotificationPriority;
}

interface ReadState {
  isRead: boolean;
  isDismissed: boolean;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function loadReadStates(userId: string): Promise<Map<string, ReadState>> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from('notification_states')
    .select('source_key, is_read, is_dismissed')
    .eq('user_id', userId);
  const map = new Map<string, ReadState>();
  if (error) return map;
  (data ?? []).forEach((r: any) => map.set(r.source_key, { isRead: r.is_read, isDismissed: r.is_dismissed }));
  return map;
}

function breachSeverityToPriority(severity: string): NotificationPriority {
  if (severity === 'Critical' || severity === 'High') return 'high';
  if (severity === 'Medium') return 'medium';
  return 'low';
}

function taskPriorityToPriority(priority: string): NotificationPriority {
  if (priority === 'urgent' || priority === 'high') return 'high';
  if (priority === 'normal') return 'medium';
  return 'low';
}

// ─── Service ─────────────────────────────────────────────────────────────────

export const notificationsService = {
  /**
   * Aggregates real notifications from several existing tables —
   * open compliance breaches, this user's pending workflow tasks,
   * recent status-transition audit events, and insurance policies
   * expiring soon — rather than reading a dedicated notifications
   * table (there isn't one; these ARE the real events).
   */
  async getAll(userId: string | undefined): Promise<AppNotification[]> {
    const [breaches, tasks, statusLogs, expiringInsurance, states] = await Promise.all([
      complianceBreachService.list({ status: 'Open' }).catch(() => []),
      userId ? userTaskService.getMyTasks(userId).catch(() => []) : Promise.resolve([]),
      auditLogService.getAll({ eventCategory: EVENT_CATEGORIES.STATUS_TRANSITION }, 30).catch(() => []),
      listInsurancePolicies({ status: 'Expiring Soon' }).catch(() => []),
      userId ? loadReadStates(userId) : Promise.resolve(new Map<string, ReadState>()),
    ]);

    const notifications: AppNotification[] = [];

    for (const b of breaches) {
      const id = `breach:${b.id}`;
      notifications.push({
        id,
        type: b.ruleType === 'DEADLINE' ? 'brela_deadline' : 'overdue_action',
        title: b.ruleName,
        message: b.message || `${b.field} ${b.operator} ${b.thresholdValue} — currently ${b.triggerValue}`,
        collateralId: b.collateralId ?? undefined,
        actionHref: b.collateralRecordId ? `/collateral-detail/${b.collateralRecordId}` : '/compliance-breach-log',
        actionLabel: 'View Details',
        isRead: states.get(id)?.isRead ?? false,
        createdAt: b.breachedAt,
        priority: breachSeverityToPriority(b.severity),
      });
    }

    for (const t of tasks) {
      if (t.taskStatus !== 'pending' && t.taskStatus !== 'in_progress') continue;
      const id = `task:${t.id}`;
      notifications.push({
        id,
        type: 'workflow',
        title: t.taskName || t.title,
        message: t.description || (t.workflowName ? `Assigned via ${t.workflowName}` : 'Task assigned to you'),
        collateralId: t.collateralId || undefined,
        actionHref: t.actionUrl ?? t.deepLink ?? undefined,
        actionLabel: t.actionLabel ?? 'View Task',
        isRead: states.get(id)?.isRead ?? false,
        createdAt: t.assignedDate ?? t.createdAt,
        priority: taskPriorityToPriority(t.priority),
      });
    }

    for (const log of statusLogs) {
      const id = `audit:${log.id}`;
      notifications.push({
        id,
        type: 'status_change',
        title: log.message,
        message: log.detail || '',
        collateralId: log.collateralId,
        actionHref: log.collateralRecordId ? `/collateral-detail/${log.collateralRecordId}` : undefined,
        actionLabel: log.collateralRecordId ? 'View Collateral' : undefined,
        isRead: states.get(id)?.isRead ?? false,
        createdAt: log.createdAt,
        priority: 'medium',
      });
    }

    for (const ins of expiringInsurance) {
      const id = `insurance:${ins.id}`;
      const daysLeft = ins.daysToExpiry;
      notifications.push({
        id,
        type: 'document_expiry',
        title: `Insurance Expiring — ${ins.collateralId}`,
        message: `${ins.coverageType} policy (${ins.policyNumber}) with ${ins.insurerName} expires ${daysLeft != null ? `in ${daysLeft} day${daysLeft === 1 ? '' : 's'}` : 'soon'}.`,
        collateralId: ins.collateralId,
        actionHref: '/insurance-tracking',
        actionLabel: 'Manage Insurance',
        isRead: states.get(id)?.isRead ?? false,
        createdAt: ins.updatedAt,
        priority: daysLeft != null && daysLeft <= 7 ? 'high' : 'medium',
      });
    }

    return notifications
      .filter((n) => !(states.get(n.id)?.isDismissed))
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  },

  async markRead(userId: string, sourceKey: string): Promise<void> {
    const supabase = createClient();
    await supabase.from('notification_states').upsert(
      { user_id: userId, source_key: sourceKey, is_read: true, read_at: new Date().toISOString() },
      { onConflict: 'user_id,source_key' }
    );
  },

  async markManyRead(userId: string, sourceKeys: string[]): Promise<void> {
    if (sourceKeys.length === 0) return;
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from('notification_states').upsert(
      sourceKeys.map((sourceKey) => ({ user_id: userId, source_key: sourceKey, is_read: true, read_at: now })),
      { onConflict: 'user_id,source_key' }
    );
  },

  async dismiss(userId: string, sourceKey: string): Promise<void> {
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from('notification_states').upsert(
      { user_id: userId, source_key: sourceKey, is_read: true, read_at: now, is_dismissed: true, dismissed_at: now },
      { onConflict: 'user_id,source_key' }
    );
  },

  async dismissMany(userId: string, sourceKeys: string[]): Promise<void> {
    if (sourceKeys.length === 0) return;
    const supabase = createClient();
    const now = new Date().toISOString();
    await supabase.from('notification_states').upsert(
      sourceKeys.map((sourceKey) => ({ user_id: userId, source_key: sourceKey, is_read: true, read_at: now, is_dismissed: true, dismissed_at: now })),
      { onConflict: 'user_id,source_key' }
    );
  },
};
