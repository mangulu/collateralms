'use client';
import { createClient } from '@/lib/supabase/client';
import { WorkflowInstance, WorkflowTemplate, WorkflowStep } from './workflowEngineService';

// ─── Types ────────────────────────────────────────────────────────────────────

export type MigrationItemStatus =
  | 'pending_review' |'auto_migrated' |'manually_migrated' |'skipped';

export interface MigrationQueueItem {
  id: string;
  instanceId: string;
  suggestedTemplateId: string | null;
  suggestedStepId: string | null;
  migrationStatus: MigrationItemStatus;
  ambiguityReason: string | null;
  matchConfidence: number;
  reviewedBy: string | null;
  reviewedAt: string | null;
  confirmedTemplateId: string | null;
  confirmedStepId: string | null;
  migrationNotes: string | null;
  createdAt: string;
  updatedAt: string;
  // Joined
  instance?: WorkflowInstance;
  suggestedTemplate?: WorkflowTemplate | null;
  suggestedStep?: WorkflowStep | null;
}

export interface MigrationSummary {
  totalOldInstances: number;
  autoMigrated: number;
  pendingReview: number;
  manuallyMigrated: number;
  skipped: number;
  alreadyMigrated: number;
}

// Status → step order heuristic map
const STATUS_STEP_HEURISTIC: Record<string, number> = {
  pending: 1,
  active: 1,
  initiated: 1,
  under_review: 2,
  in_review: 2,
  review: 2,
  approved: 3,
  approval: 3,
  completed: 99,
  done: 99,
  cancelled: 99,
  rejected: 99,
  on_hold: 1,
  escalated: 2,
};

// ─── Row Mapper ───────────────────────────────────────────────────────────────

function rowToQueueItem(row: any): MigrationQueueItem {
  return {
    id: row.id,
    instanceId: row.instance_id,
    suggestedTemplateId: row.suggested_template_id,
    suggestedStepId: row.suggested_step_id,
    migrationStatus: row.migration_status,
    ambiguityReason: row.ambiguity_reason,
    matchConfidence: parseFloat(row.match_confidence ?? '0'),
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    confirmedTemplateId: row.confirmed_template_id,
    confirmedStepId: row.confirmed_step_id,
    migrationNotes: row.migration_notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const workflowMigrationService = {
  /**
   * Scan all workflow_instances that have no instance_steps records.
   * Auto-migrate clear ones; flag ambiguous ones into the review queue.
   */
  async runMigration(
    templates: WorkflowTemplate[],
    performedBy: string
  ): Promise<MigrationSummary> {
    const supabase = createClient();

    // 1. Get all instances
    const { data: allInstances, error: instErr } = await supabase
      .from('workflow_instances')
      .select('*')
      .order('created_at', { ascending: true });
    if (instErr) throw instErr;

    // 2. Get instances that already have step records (already migrated)
    const { data: migratedSteps } = await supabase
      .from('workflow_instance_steps')
      .select('instance_id');
    const migratedInstanceIds = new Set((migratedSteps ?? []).map((r: any) => r.instance_id));

    // 3. Get existing queue entries to avoid duplicates
    const { data: existingQueue } = await supabase
      .from('workflow_migration_queue')
      .select('instance_id');
    const queuedInstanceIds = new Set((existingQueue ?? []).map((r: any) => r.instance_id));

    const unmigrated = (allInstances ?? []).filter(
      (inst: any) =>
        !migratedInstanceIds.has(inst.id) && !queuedInstanceIds.has(inst.id)
    );

    let autoMigrated = 0;
    let pendingReview = 0;

    for (const instRow of unmigrated) {
      const inst: WorkflowInstance = {
        id: instRow.id,
        templateId: instRow.template_id,
        referenceType: instRow.reference_type,
        referenceId: instRow.reference_id,
        referenceLabel: instRow.reference_label,
        currentStepId: instRow.current_step_id,
        instanceStatus: instRow.instance_status,
        startedBy: instRow.started_by,
        completedBy: instRow.completed_by,
        startedAt: instRow.started_at,
        completedAt: instRow.completed_at,
        dueAt: instRow.due_at,
        metadata: instRow.metadata ?? {},
        createdAt: instRow.created_at,
        updatedAt: instRow.updated_at,
      };

      // Skip terminal instances
      if (inst.instanceStatus === 'completed' || inst.instanceStatus === 'cancelled') {
        continue;
      }

      const result = workflowMigrationService._matchInstance(inst, templates);

      if (result.confidence >= 80 && result.template && result.step) {
        // Auto-migrate
        await workflowMigrationService._applyMigration(
          inst,
          result.template,
          result.step,
          performedBy
        );

        await supabase.from('workflow_migration_queue').insert({
          instance_id: inst.id,
          suggested_template_id: result.template.id,
          suggested_step_id: result.step.id,
          migration_status: 'auto_migrated',
          match_confidence: result.confidence,
          confirmed_template_id: result.template.id,
          confirmed_step_id: result.step.id,
          reviewed_by: performedBy,
          reviewed_at: new Date().toISOString(),
          migration_notes: `Auto-migrated. Reason: ${result.reason}`,
        });
        autoMigrated++;
      } else {
        // Flag for manual review
        await supabase.from('workflow_migration_queue').insert({
          instance_id: inst.id,
          suggested_template_id: result.template?.id ?? null,
          suggested_step_id: result.step?.id ?? null,
          migration_status: 'pending_review',
          match_confidence: result.confidence,
          ambiguity_reason: result.reason,
          migration_notes: null,
        });
        pendingReview++;
      }
    }

    // Fetch summary counts
    const { data: queueRows } = await supabase
      .from('workflow_migration_queue')
      .select('migration_status');
    const counts = (queueRows ?? []).reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.migration_status] = (acc[r.migration_status] ?? 0) + 1;
        return acc;
      },
      {}
    );

    return {
      totalOldInstances: unmigrated.length,
      autoMigrated,
      pendingReview,
      manuallyMigrated: counts['manually_migrated'] ?? 0,
      skipped: counts['skipped'] ?? 0,
      alreadyMigrated: migratedInstanceIds.size,
    };
  },

  /**
   * Match an instance to the best template + step based on heuristics.
   */
  _matchInstance(
    inst: WorkflowInstance,
    templates: WorkflowTemplate[]
  ): { template: WorkflowTemplate | null; step: WorkflowStep | null; confidence: number; reason: string } {
    if (!templates.length) {
      return { template: null, step: null, confidence: 0, reason: 'No templates available' };
    }

    // Try to match by template_id first (instance already has a template_id)
    let matchedTemplate = templates.find((t) => t.id === inst.templateId) ?? null;
    let confidence = matchedTemplate ? 70 : 0;
    let reason = matchedTemplate
      ? `Matched by existing template_id`
      : `No direct template match`;

    // If no direct match, try by workflow_type vs reference_type
    if (!matchedTemplate) {
      const byType = templates.find(
        (t) =>
          t.workflowType === inst.referenceType ||
          inst.referenceType?.includes(t.workflowType)
      );
      if (byType) {
        matchedTemplate = byType;
        confidence = 55;
        reason = `Matched by reference_type "${inst.referenceType}" → template type "${byType.workflowType}"`;
      }
    }

    if (!matchedTemplate) {
      return {
        template: null,
        step: null,
        confidence: 0,
        reason: `Cannot match to any template. reference_type="${inst.referenceType}", template_id="${inst.templateId}"`,
      };
    }

    const steps = matchedTemplate.steps ?? [];
    if (!steps.length) {
      return {
        template: matchedTemplate,
        step: null,
        confidence: 30,
        reason: `Template "${matchedTemplate.name}" has no steps defined`,
      };
    }

    // Determine target step from instance status
    const statusKey = (inst.instanceStatus ?? '').toLowerCase();
    const targetOrder = STATUS_STEP_HEURISTIC[statusKey] ?? 1;

    let targetStep: WorkflowStep | null = null;
    if (targetOrder === 99) {
      // Terminal — use last step
      targetStep = steps[steps.length - 1];
    } else {
      // Find step at or closest to targetOrder
      targetStep =
        steps.find((s) => s.stepOrder === targetOrder) ??
        steps.reduce((prev, curr) =>
          Math.abs(curr.stepOrder - targetOrder) < Math.abs(prev.stepOrder - targetOrder)
            ? curr
            : prev
        );
    }

    // Boost confidence if status clearly maps
    if (STATUS_STEP_HEURISTIC[statusKey] !== undefined) {
      confidence = Math.min(confidence + 20, 95);
      reason += `. Status "${inst.instanceStatus}" → step order ${targetOrder}`;
    } else {
      reason += `. Status "${inst.instanceStatus}" is ambiguous; defaulting to step 1`;
    }

    return { template: matchedTemplate, step: targetStep, confidence, reason };
  },

  /**
   * Apply migration: create instance_steps and log transition.
   */
  async _applyMigration(
    inst: WorkflowInstance,
    template: WorkflowTemplate,
    targetStep: WorkflowStep,
    performedBy: string
  ): Promise<void> {
    const supabase = createClient();
    const steps = template.steps ?? [];

    // Create instance step records
    const instanceStepRows = steps.map((s) => ({
      instance_id: inst.id,
      step_id: s.id,
      step_status:
        s.id === targetStep.id
          ? 'active'
          : s.stepOrder < targetStep.stepOrder
          ? 'completed'
          : 'pending',
      started_at: s.stepOrder <= targetStep.stepOrder ? inst.startedAt : null,
      completed_at:
        s.stepOrder < targetStep.stepOrder ? inst.startedAt : null,
    }));

    await supabase.from('workflow_instance_steps').insert(instanceStepRows);

    // Update instance to point to the correct step
    await supabase
      .from('workflow_instances')
      .update({
        template_id: template.id,
        current_step_id: targetStep.id,
        instance_status: inst.instanceStatus === 'active' ? 'active' : inst.instanceStatus,
      })
      .eq('id', inst.id);

    // Log the migration transition
    await supabase.from('workflow_transition_log').insert({
      instance_id: inst.id,
      to_step_id: targetStep.id,
      action: 'migrated',
      performed_by: performedBy,
      performed_by_name: 'System Migration',
      performed_by_role: 'system_admin',
      comment: `Migrated to engine. Template: "${template.name}", Step: "${targetStep.name}"`,
    });
  },

  /**
   * Get all queue items with optional status filter.
   */
  async getQueue(status?: MigrationItemStatus): Promise<MigrationQueueItem[]> {
    const supabase = createClient();
    let q = supabase
      .from('workflow_migration_queue')
      .select('*')
      .order('created_at', { ascending: false });
    if (status) q = q.eq('migration_status', status);
    const { data, error } = await q;
    if (error) throw error;
    return (data ?? []).map(rowToQueueItem);
  },

  /**
   * Confirm manual migration for a queue item.
   */
  async confirmManualMigration(payload: {
    queueItemId: string;
    instanceId: string;
    templateId: string;
    stepId: string;
    template: WorkflowTemplate;
    step: WorkflowStep;
    reviewedBy: string;
    notes?: string;
  }): Promise<void> {
    const supabase = createClient();

    // Get instance
    const { data: instRow } = await supabase
      .from('workflow_instances')
      .select('*')
      .eq('id', payload.instanceId)
      .single();
    if (!instRow) throw new Error('Instance not found');

    const inst: WorkflowInstance = {
      id: instRow.id,
      templateId: instRow.template_id,
      referenceType: instRow.reference_type,
      referenceId: instRow.reference_id,
      referenceLabel: instRow.reference_label,
      currentStepId: instRow.current_step_id,
      instanceStatus: instRow.instance_status,
      startedBy: instRow.started_by,
      completedBy: instRow.completed_by,
      startedAt: instRow.started_at,
      completedAt: instRow.completed_at,
      dueAt: instRow.due_at,
      metadata: instRow.metadata ?? {},
      createdAt: instRow.created_at,
      updatedAt: instRow.updated_at,
    };

    // Remove any existing instance steps (in case of re-migration)
    await supabase
      .from('workflow_instance_steps')
      .delete()
      .eq('instance_id', payload.instanceId);

    await workflowMigrationService._applyMigration(
      inst,
      payload.template,
      payload.step,
      payload.reviewedBy
    );

    // Update queue item
    await supabase
      .from('workflow_migration_queue')
      .update({
        migration_status: 'manually_migrated',
        confirmed_template_id: payload.templateId,
        confirmed_step_id: payload.stepId,
        reviewed_by: payload.reviewedBy,
        reviewed_at: new Date().toISOString(),
        migration_notes: payload.notes ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', payload.queueItemId);
  },

  /**
   * Skip a queue item (mark as skipped, no migration applied).
   */
  async skipItem(queueItemId: string, reviewedBy: string, notes?: string): Promise<void> {
    const supabase = createClient();
    await supabase
      .from('workflow_migration_queue')
      .update({
        migration_status: 'skipped',
        reviewed_by: reviewedBy,
        reviewed_at: new Date().toISOString(),
        migration_notes: notes ?? 'Skipped by admin',
        updated_at: new Date().toISOString(),
      })
      .eq('id', queueItemId);
  },

  /**
   * Get summary counts for the migration dashboard.
   */
  async getSummary(): Promise<MigrationSummary> {
    const supabase = createClient();
    const [instancesRes, stepsRes, queueRes] = await Promise.all([
      supabase.from('workflow_instances').select('id, instance_status'),
      supabase.from('workflow_instance_steps').select('instance_id'),
      supabase.from('workflow_migration_queue').select('migration_status'),
    ]);

    const migratedIds = new Set(
      (stepsRes.data ?? []).map((r: any) => r.instance_id)
    );
    const counts = (queueRes.data ?? []).reduce(
      (acc: Record<string, number>, r: any) => {
        acc[r.migration_status] = (acc[r.migration_status] ?? 0) + 1;
        return acc;
      },
      {}
    );

    return {
      totalOldInstances: (instancesRes.data ?? []).length,
      autoMigrated: counts['auto_migrated'] ?? 0,
      pendingReview: counts['pending_review'] ?? 0,
      manuallyMigrated: counts['manually_migrated'] ?? 0,
      skipped: counts['skipped'] ?? 0,
      alreadyMigrated: migratedIds.size,
    };
  },
};
