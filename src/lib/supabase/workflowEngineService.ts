'use client';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

export type WorkflowTemplateType =
  | 'perfection' | 'release' | 'valuation' | 'substitution' | 'document_approval' | 'custom';

export type WorkflowConditionField =
  | 'collateral_value' | 'collateral_type' | 'loan_amount' | 'ltv_ratio' |'obligor_tier' | 'collateral_status' | 'days_overdue' | 'document_count';

export type WorkflowConditionOperator =
  | 'equals' | 'not_equals' | 'greater_than' | 'less_than' |'greater_than_or_equal'| 'less_than_or_equal' | 'contains' | 'not_contains' |'is_empty' | 'is_not_empty';

export type WorkflowEscalationAction =
  | 'notify_manager' | 'reassign' | 'auto_approve' | 'auto_reject' | 'escalate_to_role'
  | 'hold_payment' | 'notify_and_hold';

export type WorkflowInstanceStatus = 'active' | 'completed' | 'cancelled' | 'on_hold' | 'escalated';
export type WorkflowStepStatus = 'pending' | 'active' | 'completed' | 'skipped' | 'rejected' | 'escalated';

export interface WorkflowStepCondition {
  id: string;
  stepId: string;
  conditionGroup: number;
  field: WorkflowConditionField;
  operator: WorkflowConditionOperator;
  value: string;
  action: string;
}

export interface WorkflowStepActor {
  id: string;
  stepId: string;
  actorRole: string;
  actorLabel: string;
  canApprove: boolean;
  canReject: boolean;
  canReturn: boolean;
  canComment: boolean;
}

export interface WorkflowStep {
  id: string;
  templateId: string;
  stepOrder: number;
  name: string;
  description: string;
  isOptional: boolean;
  requiresAllActors: boolean;
  slaHours: number | null;
  escalationAction: WorkflowEscalationAction | null;
  escalationRole: string | null;
  escalationNotifyRoles: string[];
  notifyOnEnter: boolean;
  notifyOnComplete: boolean;
  notifyRoles: string[];
  actors: WorkflowStepActor[];
  conditions: WorkflowStepCondition[];
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  workflowType: WorkflowTemplateType;
  isActive: boolean;
  isVisible: boolean;
  isBuiltin: boolean;
  version: number;
  createdBy: string | null;
  updatedBy: string | null;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
}

export interface WorkflowInstanceStep {
  id: string;
  instanceId: string;
  stepId: string;
  stepStatus: WorkflowStepStatus;
  assignedTo: string | null;
  assignedRole: string | null;
  startedAt: string | null;
  completedAt: string | null;
  completedBy: string | null;
  actionTaken: string | null;
  dueAt: string | null;
  notes: string | null;
  step?: WorkflowStep;
}

export interface WorkflowInstance {
  id: string;
  templateId: string;
  referenceType: string;
  referenceId: string;
  referenceLabel: string | null;
  currentStepId: string | null;
  instanceStatus: WorkflowInstanceStatus;
  startedBy: string | null;
  completedBy: string | null;
  startedAt: string;
  completedAt: string | null;
  dueAt: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  template?: WorkflowTemplate;
  instanceSteps?: WorkflowInstanceStep[];
}

export interface WorkflowTransitionLog {
  id: string;
  instanceId: string;
  instanceStepId: string | null;
  fromStepId: string | null;
  toStepId: string | null;
  action: string;
  performedBy: string | null;
  performedByName: string | null;
  performedByRole: string | null;
  comment: string | null;
  conditionsEvaluated: unknown[];
  createdAt: string;
}

// ─── Row Mappers ──────────────────────────────────────────────────────────────

function rowToTemplate(row: any, steps: WorkflowStep[] = []): WorkflowTemplate {
  return {
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    workflowType: row.workflow_type,
    isActive: row.is_active,
    isVisible: row.is_visible ?? true,
    isBuiltin: row.is_builtin,
    version: row.version,
    createdBy: row.created_by,
    updatedBy: row.updated_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    steps,
  };
}

function rowToStep(row: any, actors: WorkflowStepActor[] = [], conditions: WorkflowStepCondition[] = []): WorkflowStep {
  return {
    id: row.id,
    templateId: row.template_id,
    stepOrder: row.step_order,
    name: row.name,
    description: row.description ?? '',
    isOptional: row.is_optional,
    requiresAllActors: row.requires_all_actors,
    slaHours: row.sla_hours,
    escalationAction: row.escalation_action,
    escalationRole: row.escalation_role,
    escalationNotifyRoles: row.escalation_notify_roles ?? [],
    notifyOnEnter: row.notify_on_enter,
    notifyOnComplete: row.notify_on_complete,
    notifyRoles: row.notify_roles ?? [],
    actors,
    conditions,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToActor(row: any): WorkflowStepActor {
  return {
    id: row.id,
    stepId: row.step_id,
    actorRole: row.actor_role,
    actorLabel: row.actor_label,
    canApprove: row.can_approve,
    canReject: row.can_reject,
    canReturn: row.can_return,
    canComment: row.can_comment,
  };
}

function rowToCondition(row: any): WorkflowStepCondition {
  return {
    id: row.id,
    stepId: row.step_id,
    conditionGroup: row.condition_group,
    field: row.field,
    operator: row.operator,
    value: row.value,
    action: row.action,
  };
}

function rowToInstance(row: any): WorkflowInstance {
  return {
    id: row.id,
    templateId: row.template_id,
    referenceType: row.reference_type,
    referenceId: row.reference_id,
    referenceLabel: row.reference_label,
    currentStepId: row.current_step_id,
    instanceStatus: row.instance_status,
    startedBy: row.started_by,
    completedBy: row.completed_by,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    dueAt: row.due_at,
    metadata: row.metadata ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToInstanceStep(row: any): WorkflowInstanceStep {
  return {
    id: row.id,
    instanceId: row.instance_id,
    stepId: row.step_id,
    stepStatus: row.step_status,
    assignedTo: row.assigned_to,
    assignedRole: row.assigned_role,
    startedAt: row.started_at,
    completedAt: row.completed_at,
    completedBy: row.completed_by ?? null,
    actionTaken: row.action_taken ?? null,
    dueAt: row.due_at,
    notes: row.notes,
  };
}

function rowToTransitionLog(row: any): WorkflowTransitionLog {
  return {
    id: row.id,
    instanceId: row.instance_id,
    instanceStepId: row.instance_step_id,
    fromStepId: row.from_step_id,
    toStepId: row.to_step_id,
    action: row.action,
    performedBy: row.performed_by,
    performedByName: row.performed_by_name,
    performedByRole: row.performed_by_role,
    comment: row.comment,
    conditionsEvaluated: row.conditions_evaluated ?? [],
    createdAt: row.created_at,
  };
}

// ─── Template Service ─────────────────────────────────────────────────────────

export const workflowTemplateService = {
  async getAll(): Promise<WorkflowTemplate[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .order('workflow_type')
      .order('created_at');
    if (error) throw error;
    const templates = (data ?? []).map((r) => rowToTemplate(r));
    // Load steps for all templates
    const ids = templates.map((t) => t.id);
    if (ids.length === 0) return templates;
    const [stepsRes, actorsRes, conditionsRes] = await Promise.all([
      supabase.from('workflow_steps').select('*').in('template_id', ids).order('step_order'),
      supabase.from('workflow_step_actors').select('*'),
      supabase.from('workflow_step_conditions').select('*'),
    ]);
    const actors = (actorsRes.data ?? []).map(rowToActor);
    const conditions = (conditionsRes.data ?? []).map(rowToCondition);
    const steps = (stepsRes.data ?? []).map((r) =>
      rowToStep(r, actors.filter((a) => a.stepId === r.id), conditions.filter((c) => c.stepId === r.id))
    );
    return templates.map((t) => ({ ...t, steps: steps.filter((s) => s.templateId === t.id) }));
  },

  /** Returns only active + visible templates — for end-user workflow pickers */
  async getVisible(): Promise<WorkflowTemplate[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workflow_templates')
      .select('*')
      .eq('is_active', true)
      .eq('is_visible', true)
      .order('workflow_type')
      .order('created_at');
    if (error) throw error;
    const templates = (data ?? []).map((r) => rowToTemplate(r));
    const ids = templates.map((t) => t.id);
    if (ids.length === 0) return templates;
    const [stepsRes, actorsRes, conditionsRes] = await Promise.all([
      supabase.from('workflow_steps').select('*').in('template_id', ids).order('step_order'),
      supabase.from('workflow_step_actors').select('*'),
      supabase.from('workflow_step_conditions').select('*'),
    ]);
    const actors = (actorsRes.data ?? []).map(rowToActor);
    const conditions = (conditionsRes.data ?? []).map(rowToCondition);
    const steps = (stepsRes.data ?? []).map((r) =>
      rowToStep(r, actors.filter((a) => a.stepId === r.id), conditions.filter((c) => c.stepId === r.id))
    );
    return templates.map((t) => ({ ...t, steps: steps.filter((s) => s.templateId === t.id) }));
  },

  async getById(id: string): Promise<WorkflowTemplate | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('workflow_templates').select('*').eq('id', id).single();
    if (error) return null;
    const [stepsRes, actorsRes, conditionsRes] = await Promise.all([
      supabase.from('workflow_steps').select('*').eq('template_id', id).order('step_order'),
      supabase.from('workflow_step_actors').select('*'),
      supabase.from('workflow_step_conditions').select('*'),
    ]);
    const stepIds = (stepsRes.data ?? []).map((s: any) => s.id);
    const actors = (actorsRes.data ?? []).filter((a: any) => stepIds.includes(a.step_id)).map(rowToActor);
    const conditions = (conditionsRes.data ?? []).filter((c: any) => stepIds.includes(c.step_id)).map(rowToCondition);
    const steps = (stepsRes.data ?? []).map((r: any) =>
      rowToStep(r, actors.filter((a) => a.stepId === r.id), conditions.filter((c) => c.stepId === r.id))
    );
    return rowToTemplate(data, steps);
  },

  async create(payload: {
    name: string;
    description: string;
    workflowType: WorkflowTemplateType;
    createdBy: string;
  }): Promise<WorkflowTemplate> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workflow_templates')
      .insert({
        name: payload.name,
        description: payload.description,
        workflow_type: payload.workflowType,
        created_by: payload.createdBy,
        updated_by: payload.createdBy,
      })
      .select()
      .single();
    if (error) throw error;
    return rowToTemplate(data, []);
  },

  async update(id: string, payload: {
    name?: string;
    description?: string;
    isActive?: boolean;
    isVisible?: boolean;
    updatedBy?: string;
  }): Promise<void> {
    const supabase = createClient();
    const { error } = await supabase.from('workflow_templates').update({
      ...(payload.name !== undefined && { name: payload.name }),
      ...(payload.description !== undefined && { description: payload.description }),
      ...(payload.isActive !== undefined && { is_active: payload.isActive }),
      ...(payload.isVisible !== undefined && { is_visible: payload.isVisible }),
      ...(payload.updatedBy && { updated_by: payload.updatedBy }),
    }).eq('id', id);
    if (error) throw error;

    // When pausing (is_active → false): put all active instances on hold
    if (payload.isActive === false) {
      await supabase.rpc('pause_instances_for_template', { p_template_id: id });
    }
    // When resuming (is_active → true): restore instances that were paused by this template
    if (payload.isActive === true) {
      await supabase.rpc('resume_instances_for_template', { p_template_id: id });
    }
  },

  async saveSteps(templateId: string, steps: Omit<WorkflowStep, 'id' | 'createdAt' | 'updatedAt'>[]): Promise<void> {
    const supabase = createClient();
    // Delete existing steps (cascade deletes actors + conditions)
    await supabase.from('workflow_steps').delete().eq('template_id', templateId);
    if (steps.length === 0) return;
    // Insert steps
    const stepRows = steps.map((s, i) => ({
      template_id: templateId,
      step_order: i + 1,
      name: s.name,
      description: s.description,
      is_optional: s.isOptional,
      requires_all_actors: s.requiresAllActors,
      sla_hours: s.slaHours,
      escalation_action: s.escalationAction,
      escalation_role: s.escalationRole,
      escalation_notify_roles: s.escalationNotifyRoles ?? [],
      notify_on_enter: s.notifyOnEnter,
      notify_on_complete: s.notifyOnComplete,
      notify_roles: s.notifyRoles,
    }));
    const { data: insertedSteps, error: stepsErr } = await supabase
      .from('workflow_steps').insert(stepRows).select();
    if (stepsErr) throw stepsErr;
    // Insert actors and conditions
    const actorRows: any[] = [];
    const conditionRows: any[] = [];
    (insertedSteps ?? []).forEach((dbStep: any, i: number) => {
      const src = steps[i];
      src.actors.forEach((a) => actorRows.push({
        step_id: dbStep.id,
        actor_role: a.actorRole,
        actor_label: a.actorLabel,
        can_approve: a.canApprove,
        can_reject: a.canReject,
        can_return: a.canReturn,
        can_comment: a.canComment,
      }));
      src.conditions.forEach((c) => conditionRows.push({
        step_id: dbStep.id,
        condition_group: c.conditionGroup,
        field: c.field,
        operator: c.operator,
        value: c.value,
        action: c.action,
      }));
    });
    if (actorRows.length > 0) {
      const { error } = await supabase.from('workflow_step_actors').insert(actorRows);
      if (error) throw error;
    }
    if (conditionRows.length > 0) {
      const { error } = await supabase.from('workflow_step_conditions').insert(conditionRows);
      if (error) throw error;
    }
  },
};

// ─── Instance Service ─────────────────────────────────────────────────────────

export const workflowInstanceService = {
  async getAll(filters?: { status?: WorkflowInstanceStatus; templateId?: string }): Promise<WorkflowInstance[]> {
    const supabase = createClient();
    let q = supabase.from('workflow_instances').select('*').order('created_at', { ascending: false });
    if (filters?.status) q = q.eq('instance_status', filters.status);
    if (filters?.templateId) q = q.eq('template_id', filters.templateId);
    const { data, error } = await q;
    if (error) throw error;
    const instances = (data ?? []).map(rowToInstance);

    // Bulk-load all instance steps in one query (avoids N+1)
    if (instances.length === 0) return instances;
    const instanceIds = instances.map((i) => i.id);
    const { data: stepsData } = await supabase
      .from('workflow_instance_steps')
      .select('*')
      .in('instance_id', instanceIds)
      .order('created_at');
    const allSteps = (stepsData ?? []).map(rowToInstanceStep);
    return instances.map((inst) => ({
      ...inst,
      instanceSteps: allSteps.filter((s) => s.instanceId === inst.id),
    }));
  },

  async getById(id: string): Promise<WorkflowInstance | null> {
    const supabase = createClient();
    const { data, error } = await supabase.from('workflow_instances').select('*').eq('id', id).single();
    if (error) return null;
    const instance = rowToInstance(data);
    // Load instance steps
    const { data: stepData } = await supabase
      .from('workflow_instance_steps').select('*').eq('instance_id', id).order('created_at');
    instance.instanceSteps = (stepData ?? []).map(rowToInstanceStep);
    return instance;
  },

  async start(payload: {
    templateId: string;
    referenceType: string;
    referenceId: string;
    referenceLabel: string;
    startedBy: string;
    metadata?: Record<string, unknown>;
  }): Promise<WorkflowInstance> {
    const supabase = createClient();
    // Get template steps with actors
    const { data: steps } = await supabase
      .from('workflow_steps').select('*').eq('template_id', payload.templateId).order('step_order');
    const firstStep = steps?.[0];

    // Get actors for the first step
    let firstStepActors: any[] = [];
    if (firstStep) {
      const { data: actors } = await supabase
        .from('workflow_step_actors')
        .select('*')
        .eq('step_id', firstStep.id);
      firstStepActors = actors ?? [];
    }

    const { data, error } = await supabase
      .from('workflow_instances')
      .insert({
        template_id: payload.templateId,
        reference_type: payload.referenceType,
        reference_id: payload.referenceId,
        reference_label: payload.referenceLabel,
        current_step_id: firstStep?.id ?? null,
        instance_status: 'active',
        started_by: payload.startedBy,
        metadata: payload.metadata ?? {},
        due_at: firstStep?.sla_hours
          ? new Date(Date.now() + firstStep.sla_hours * 3600000).toISOString()
          : null,
      })
      .select().single();
    if (error) throw error;
    const instance = rowToInstance(data);

    // Create instance step records
    if (steps && steps.length > 0) {
      const instanceStepRows = steps.map((s: any, i: number) => ({
        instance_id: instance.id,
        step_id: s.id,
        step_status: i === 0 ? 'active' : 'pending',
        started_at: i === 0 ? new Date().toISOString() : null,
        due_at: i === 0 && s.sla_hours
          ? new Date(Date.now() + s.sla_hours * 3600000).toISOString()
          : null,
      }));
      const { data: createdSteps } = await supabase.from('workflow_instance_steps').insert(instanceStepRows).select();

      // Create user_tasks for actors of the first step
      if (firstStep && firstStepActors.length > 0 && createdSteps) {
        const firstInstanceStep = createdSteps.find((s: any) => s.step_id === firstStep.id);
        await _createTasksForStepActors(supabase, {
          instanceId: instance.id,
          instanceStepId: firstInstanceStep?.id ?? null,
          step: firstStep,
          actors: firstStepActors,
          referenceLabel: payload.referenceLabel,
          referenceType: payload.referenceType,
          referenceId: payload.referenceId,
          dueAt: firstInstanceStep?.due_at ?? null,
        });
      }
    }

    // Log transition
    await supabase.from('workflow_transition_log').insert({
      instance_id: instance.id,
      action: 'started',
      performed_by: payload.startedBy,
      to_step_id: firstStep?.id ?? null,
    });
    return instance;
  },

  async transition(payload: {
    instanceId: string;
    action: 'approve' | 'reject' | 'return' | 'skip' | 'escalate' | 'cancel' | 'hold';
    performedBy: string;
    performedByName: string;
    performedByRole: string;
    comment?: string;
  }): Promise<void> {
    const supabase = createClient();
    const instance = await this.getById(payload.instanceId);
    if (!instance) throw new Error('Instance not found');
    const currentStepId = instance.currentStepId;
    // Get all steps for template
    const { data: allSteps } = await supabase
      .from('workflow_steps').select('*').eq('template_id', instance.templateId).order('step_order');
    const steps = allSteps ?? [];
    const currentIdx = steps.findIndex((s: any) => s.id === currentStepId);
    const nextStep = steps[currentIdx + 1] ?? null;
    let newStatus: WorkflowInstanceStatus = instance.instanceStatus;
    let newStepId: string | null = currentStepId;

    // Look up the current workflow_instance_steps row ID for the transition log
    let currentInstanceStepId: string | null = null;
    if (currentStepId) {
      const { data: currentInstStep } = await supabase
        .from('workflow_instance_steps')
        .select('id')
        .eq('instance_id', payload.instanceId)
        .eq('step_id', currentStepId)
        .maybeSingle();
      currentInstanceStepId = currentInstStep?.id ?? null;
    }

    // Determine new state
    if (payload.action === 'approve' || payload.action === 'skip') {
      if (nextStep) {
        newStepId = nextStep.id;
        // Activate next instance step
        const { data: updatedNextStep } = await supabase.from('workflow_instance_steps')
          .update({ step_status: 'active', started_at: new Date().toISOString() })
          .eq('instance_id', payload.instanceId).eq('step_id', nextStep.id)
          .select().maybeSingle();

        // Create user_tasks for actors of the next step
        const { data: nextActors } = await supabase
          .from('workflow_step_actors')
          .select('*')
          .eq('step_id', nextStep.id);
        if (nextActors && nextActors.length > 0) {
          await _createTasksForStepActors(supabase, {
            instanceId: payload.instanceId,
            instanceStepId: updatedNextStep?.id ?? null,
            step: nextStep,
            actors: nextActors,
            referenceLabel: instance.referenceLabel ?? instance.referenceId,
            referenceType: instance.referenceType,
            referenceId: instance.referenceId,
            dueAt: updatedNextStep?.due_at ?? null,
          });
        }
      } else {
        newStepId = null;
        newStatus = 'completed';
      }
      // Complete current step with performer info
      if (currentStepId) {
        await supabase.from('workflow_instance_steps')
          .update({
            step_status: payload.action === 'skip' ? 'skipped' : 'completed',
            completed_at: new Date().toISOString(),
            completed_by: payload.performedBy,
            action_taken: payload.action,
            notes: payload.comment ?? null,
          })
          .eq('instance_id', payload.instanceId).eq('step_id', currentStepId);
      }
      // Mark any pending user_tasks for the current step as completed
      if (currentInstanceStepId) {
        await supabase.from('user_tasks')
          .update({ task_status: 'completed', completed_at: new Date().toISOString() })
          .eq('collateral_record_id', payload.instanceId)
          .eq('task_status', 'pending');
      }
    } else if (payload.action === 'reject') {
      newStatus = 'cancelled';
      if (currentStepId) {
        await supabase.from('workflow_instance_steps')
          .update({
            step_status: 'rejected',
            completed_at: new Date().toISOString(),
            completed_by: payload.performedBy,
            action_taken: 'reject',
            notes: payload.comment ?? null,
          })
          .eq('instance_id', payload.instanceId).eq('step_id', currentStepId);
      }
    } else if (payload.action === 'return') {
      const prevStep = steps[currentIdx - 1] ?? null;
      if (prevStep) {
        newStepId = prevStep.id;
        const { data: reactivatedStep } = await supabase.from('workflow_instance_steps')
          .update({ step_status: 'active', started_at: new Date().toISOString(), completed_at: null })
          .eq('instance_id', payload.instanceId).eq('step_id', prevStep.id)
          .select().maybeSingle();

        // Re-create user_tasks for actors of the previous step
        const { data: prevActors } = await supabase
          .from('workflow_step_actors')
          .select('*')
          .eq('step_id', prevStep.id);
        if (prevActors && prevActors.length > 0) {
          await _createTasksForStepActors(supabase, {
            instanceId: payload.instanceId,
            instanceStepId: reactivatedStep?.id ?? null,
            step: prevStep,
            actors: prevActors,
            referenceLabel: instance.referenceLabel ?? instance.referenceId,
            referenceType: instance.referenceType,
            referenceId: instance.referenceId,
            dueAt: reactivatedStep?.due_at ?? null,
          });
        }
      }
      // Mark current step as returned
      if (currentStepId) {
        await supabase.from('workflow_instance_steps')
          .update({
            action_taken: 'return',
            notes: payload.comment ?? null,
          })
          .eq('instance_id', payload.instanceId).eq('step_id', currentStepId);
      }
    } else if (payload.action === 'escalate') {
      newStatus = 'escalated';
      if (currentStepId) {
        await supabase.from('workflow_instance_steps')
          .update({
            step_status: 'escalated',
            action_taken: 'escalate',
            notes: payload.comment ?? null,
          })
          .eq('instance_id', payload.instanceId).eq('step_id', currentStepId);
      }
    } else if (payload.action === 'cancel') {
      newStatus = 'cancelled';
    } else if (payload.action === 'hold') {
      newStatus = 'on_hold';
    }
    // Update instance
    await supabase.from('workflow_instances').update({
      current_step_id: newStepId,
      instance_status: newStatus,
      ...(newStatus === 'completed' && { completed_by: payload.performedBy, completed_at: new Date().toISOString() }),
    }).eq('id', payload.instanceId);
    // Log transition with instance_step_id
    await supabase.from('workflow_transition_log').insert({
      instance_id: payload.instanceId,
      instance_step_id: currentInstanceStepId,
      from_step_id: currentStepId,
      to_step_id: newStepId,
      action: payload.action,
      performed_by: payload.performedBy,
      performed_by_name: payload.performedByName,
      performed_by_role: payload.performedByRole,
      comment: payload.comment ?? null,
    });
  },

  async getTransitionLog(instanceId: string): Promise<WorkflowTransitionLog[]> {
    const supabase = createClient();
    const { data, error } = await supabase
      .from('workflow_transition_log')
      .select('*')
      .eq('instance_id', instanceId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data ?? []).map(rowToTransitionLog);
  },

  async getStats(): Promise<{
    active: number; completed: number; escalated: number; onHold: number; cancelled: number;
  }> {
    const supabase = createClient();
    const { data } = await supabase.from('workflow_instances').select('instance_status');
    const rows = data ?? [];
    return {
      active: rows.filter((r: any) => r.instance_status === 'active').length,
      completed: rows.filter((r: any) => r.instance_status === 'completed').length,
      escalated: rows.filter((r: any) => r.instance_status === 'escalated').length,
      onHold: rows.filter((r: any) => r.instance_status === 'on_hold').length,
      cancelled: rows.filter((r: any) => r.instance_status === 'cancelled').length,
    };
  },
};

// ─── Internal helper: create user_tasks for step actors ───────────────────────

async function _createTasksForStepActors(
  supabase: ReturnType<typeof createClient>,
  opts: {
    instanceId: string;
    instanceStepId: string | null;
    step: any;
    actors: any[];
    referenceLabel: string;
    referenceType: string;
    referenceId: string;
    dueAt: string | null;
  }
): Promise<void> {
  try {
    // Look up users by role to assign tasks
    const roles = [...new Set(opts.actors.map((a: any) => a.actor_role).filter(Boolean))];
    if (roles.length === 0) return;

    const { data: usersWithRoles } = await supabase
      .from('user_profiles')
      .select('id, role, full_name')
      .in('role', roles);

    const taskRows: any[] = [];
    for (const actor of opts.actors) {
      const matchingUsers = (usersWithRoles ?? []).filter((u: any) => u.role === actor.actor_role);
      if (matchingUsers.length === 0) {
        // No specific user found — create a generic task with no assignee (will appear in role-based views)
        taskRows.push({
          assigned_to: null,
          collateral_record_id: opts.instanceId, // store instance ID for linking
          collateral_id: opts.referenceId,
          task_type: 'workflow_step',
          title: `${opts.step.name} — ${opts.referenceLabel}`,
          description: opts.step.description
            ? `${opts.step.description} (${opts.referenceType})`
            : `Workflow step action required for ${opts.referenceLabel}`,
          action_url: `/workflows/instances`,
          action_label: 'View Workflow',
          priority: 'normal',
          due_date: opts.dueAt ?? null,
        });
      } else {
        for (const u of matchingUsers) {
          taskRows.push({
            assigned_to: u.id,
            collateral_record_id: opts.instanceId,
            collateral_id: opts.referenceId,
            task_type: 'workflow_step',
            title: `${opts.step.name} — ${opts.referenceLabel}`,
            description: opts.step.description
              ? `${opts.step.description} (${opts.referenceType})`
              : `Workflow step action required for ${opts.referenceLabel}`,
            action_url: `/workflows/instances`,
            action_label: 'View Workflow',
            priority: 'normal',
            due_date: opts.dueAt ?? null,
          });
        }
      }
    }

    if (taskRows.length > 0) {
      await supabase.from('user_tasks').insert(taskRows);
    }
  } catch (err) {
    // Non-blocking — task creation failure should not break the workflow transition
    console.warn('[workflow] Failed to create user_tasks for step actors:', err);
  }
}
