'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronRight, Clock, User, GitBranch, CheckCircle2, XCircle, RefreshCw,
  Loader2, AlertTriangle, ArrowLeft, Calendar, Tag, FileText, History,
  CheckSquare, Shield, MessageSquare, ChevronDown, ChevronUp, Send
} from 'lucide-react';
import { userTaskService, UserTask } from '@/lib/supabase/userTaskService';
import {
  workflowInstanceService,
  WorkflowInstance,
  WorkflowTransitionLog,
  workflowTemplateService,
  WorkflowTemplate,
} from '@/lib/supabase/workflowEngineService';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function isOverdue(iso: string | null | undefined): boolean {
  if (!iso) return false;
  return new Date(iso) < new Date();
}

const PRIORITY_META: Record<string, { label: string; dot: string; cls: string }> = {
  urgent: { label: 'Urgent', dot: 'bg-red-500',    cls: 'bg-red-50 text-red-700 border-red-200' },
  high:   { label: 'High',   dot: 'bg-orange-400', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  High:   { label: 'High',   dot: 'bg-orange-400', cls: 'bg-orange-50 text-orange-700 border-orange-200' },
  normal: { label: 'Normal', dot: 'bg-blue-400',   cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  Normal: { label: 'Normal', dot: 'bg-blue-400',   cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  low:    { label: 'Low',    dot: 'bg-slate-300',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
  Low:    { label: 'Low',    dot: 'bg-slate-300',  cls: 'bg-slate-50 text-slate-500 border-slate-200' },
};

const STATUS_META: Record<string, { color: string; bg: string; border: string }> = {
  pending:     { color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  in_progress: { color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  completed:   { color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  dismissed:   { color: 'text-slate-500',  bg: 'bg-slate-50',  border: 'border-slate-200' },
};

const INSTANCE_STATUS_META: Record<string, { label: string; color: string; bg: string; border: string }> = {
  active:    { label: 'Active',    color: 'text-blue-700',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  completed: { label: 'Completed', color: 'text-green-700',  bg: 'bg-green-50',  border: 'border-green-200' },
  cancelled: { label: 'Cancelled', color: 'text-red-700',    bg: 'bg-red-50',    border: 'border-red-200' },
  on_hold:   { label: 'On Hold',   color: 'text-amber-700',  bg: 'bg-amber-50',  border: 'border-amber-200' },
  escalated: { label: 'Escalated', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200' },
};

const STEP_STATUS_META: Record<string, { color: string; bg: string; icon: React.ReactNode }> = {
  pending:   { color: 'text-slate-500',  bg: 'bg-slate-100',  icon: <Clock size={12} /> },
  active:    { color: 'text-blue-700',   bg: 'bg-blue-100',   icon: <RefreshCw size={12} className="animate-spin" /> },
  completed: { color: 'text-green-700',  bg: 'bg-green-100',  icon: <CheckCircle2 size={12} /> },
  skipped:   { color: 'text-slate-400',  bg: 'bg-slate-50',   icon: <ChevronRight size={12} /> },
  rejected:  { color: 'text-red-700',    bg: 'bg-red-100',    icon: <XCircle size={12} /> },
  escalated: { color: 'text-orange-700', bg: 'bg-orange-100', icon: <AlertTriangle size={12} /> },
};

const ACTION_META: Record<string, { label: string; color: string }> = {
  approve:   { label: 'Approved',   color: 'text-green-700' },
  reject:    { label: 'Rejected',   color: 'text-red-700' },
  return:    { label: 'Returned',   color: 'text-amber-700' },
  skip:      { label: 'Skipped',    color: 'text-slate-500' },
  escalate:  { label: 'Escalated',  color: 'text-orange-700' },
  cancel:    { label: 'Cancelled',  color: 'text-red-700' },
  hold:      { label: 'On Hold',    color: 'text-amber-700' },
  started:   { label: 'Started',    color: 'text-blue-700' },
  reassign:  { label: 'Reassigned', color: 'text-indigo-700' },
};

// ── Reassign Modal ─────────────────────────────────────────────────────────────

interface ReassignModalProps {
  onClose: () => void;
  onConfirm: (userId: string, userName: string) => void;
}

function ReassignModal({ onClose, onConfirm }: ReassignModalProps) {
  const [users, setUsers] = useState<{ id: string; full_name: string; role: string }[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('user_profiles').select('id, full_name, role').then(({ data }) => {
      setUsers(data ?? []);
      setLoading(false);
    });
  }, []);

  const selectedUser = users.find((u) => u.id === selected);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <h3 className="text-base font-700 text-foreground mb-1">Reassign Task</h3>
        <p className="text-xs text-muted-foreground mb-4">Select a user to reassign this task to.</p>
        {loading ? (
          <div className="flex justify-center py-6"><Loader2 size={20} className="animate-spin text-indigo-500" /></div>
        ) : (
          <select
            value={selected}
            onChange={(e) => setSelected(e.target.value)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 mb-4"
          >
            <option value="">— Select a user —</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.full_name} ({u.role})</option>
            ))}
          </select>
        )}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            disabled={!selected}
            onClick={() => selectedUser && onConfirm(selectedUser.id, selectedUser.full_name)}
            className="px-4 py-2 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Reassign
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Action Confirm Modal ───────────────────────────────────────────────────────

interface ActionModalProps {
  action: 'approve' | 'reject';
  onClose: () => void;
  onConfirm: (comment: string) => void;
  loading: boolean;
}

function ActionModal({ action, onClose, onConfirm, loading }: ActionModalProps) {
  const [comment, setComment] = useState('');
  const isApprove = action === 'approve';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
        <div className={`w-10 h-10 rounded-full flex items-center justify-center mb-3 ${isApprove ? 'bg-green-50' : 'bg-red-50'}`}>
          {isApprove ? <CheckCircle2 size={20} className="text-green-600" /> : <XCircle size={20} className="text-red-600" />}
        </div>
        <h3 className="text-base font-700 text-foreground mb-1">
          {isApprove ? 'Approve Task' : 'Reject Task'}
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          {isApprove
            ? 'This will approve the current workflow step and advance to the next.' :'This will reject the workflow step and cancel the instance.'}
        </p>
        <textarea
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder={`Add a comment (${isApprove ? 'optional' : 'recommended'})…`}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-none mb-4"
        />
        <div className="flex justify-end gap-2">
          <button onClick={onClose} disabled={loading} className="px-4 py-2 text-sm border border-border rounded-lg text-muted-foreground hover:bg-muted transition-colors">
            Cancel
          </button>
          <button
            onClick={() => onConfirm(comment)}
            disabled={loading}
            className={`px-4 py-2 text-sm text-white rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
              isApprove ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'
            }`}
          >
            {loading && <Loader2 size={13} className="animate-spin" />}
            {isApprove ? 'Approve' : 'Reject'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TaskDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();

  const [task, setTask] = useState<UserTask | null>(null);
  const [instance, setInstance] = useState<WorkflowInstance | null>(null);
  const [template, setTemplate] = useState<WorkflowTemplate | null>(null);
  const [transitionLog, setTransitionLog] = useState<WorkflowTransitionLog[]>([]);
  const [assignedUserName, setAssignedUserName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSteps, setShowSteps] = useState(true);
  const [activeModal, setActiveModal] = useState<'approve' | 'reject' | 'reassign' | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setError(null);
    try {
      const supabase = createClient();

      // Load task
      const { data: taskData } = await supabase
        .from('user_tasks')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (!taskData) {
        setError('Task not found.');
        setLoading(false);
        return;
      }

      const t: UserTask = {
        id: taskData.id,
        assignedTo: taskData.assigned_to,
        collateralRecordId: taskData.collateral_record_id,
        collateralId: taskData.collateral_id ?? '',
        taskType: taskData.task_type,
        title: taskData.title,
        description: taskData.description ?? '',
        actionUrl: taskData.action_url ?? null,
        actionLabel: taskData.action_label ?? null,
        priority: taskData.priority,
        taskStatus: taskData.task_status,
        dueDate: taskData.due_date ?? null,
        completedAt: taskData.completed_at ?? null,
        createdBy: taskData.created_by ?? null,
        createdAt: taskData.created_at,
        updatedAt: taskData.updated_at,
      };
      setTask(t);

      // Load assigned user name
      if (t.assignedTo) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('full_name, role')
          .eq('id', t.assignedTo)
          .maybeSingle();
        if (profile) setAssignedUserName(`${profile.full_name} (${profile.role})`);
      }

      // Load workflow instance if linked (collateral_record_id stores instance ID for workflow_step tasks)
      if (t.collateralRecordId && t.taskType === 'workflow_step') {
        const [inst, log] = await Promise.all([
          workflowInstanceService.getById(t.collateralRecordId),
          workflowInstanceService.getTransitionLog(t.collateralRecordId),
        ]);
        if (inst) {
          setInstance(inst);
          setTransitionLog(log);
          // Load template
          const tmpl = await workflowTemplateService.getById(inst.templateId);
          if (tmpl) setTemplate(tmpl);
        }
      }
    } catch {
      setError('Failed to load task details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { loadData(); }, [loadData]);

  const handleApproveReject = async (action: 'approve' | 'reject', comment: string) => {
    if (!instance || !user) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle();

      await workflowInstanceService.transition({
        instanceId: instance.id,
        action,
        performedBy: user.id,
        performedByName: profile?.full_name ?? user.email ?? 'Unknown',
        performedByRole: profile?.role ?? 'user',
        comment,
      });

      // Mark task complete
      if (task) await userTaskService.markComplete(task.id);

      setSuccessMsg(action === 'approve' ? 'Step approved successfully.' : 'Step rejected.');
      setActiveModal(null);
      await loadData();
    } catch {
      setError('Action failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleReassign = async (newUserId: string, newUserName: string) => {
    if (!task) return;
    setActionLoading(true);
    try {
      const supabase = createClient();
      await supabase
        .from('user_tasks')
        .update({ assigned_to: newUserId, updated_at: new Date().toISOString() })
        .eq('id', task.id);
      setSuccessMsg(`Task reassigned to ${newUserName}.`);
      setActiveModal(null);
      await loadData();
    } catch {
      setError('Reassignment failed. Please try again.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMarkComplete = async () => {
    if (!task) return;
    setActionLoading(true);
    try {
      await userTaskService.markComplete(task.id);
      setSuccessMsg('Task marked as complete.');
      await loadData();
    } catch {
      setError('Failed to mark task complete.');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={28} className="animate-spin text-indigo-500" />
          <p className="text-sm text-muted-foreground">Loading task details…</p>
        </div>
      </div>
    );
  }

  if (error && !task) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center">
          <AlertTriangle size={24} className="text-red-500" />
        </div>
        <p className="text-base font-600 text-foreground">{error}</p>
        <button onClick={() => router.back()} className="flex items-center gap-1.5 text-sm text-indigo-600 hover:underline">
          <ArrowLeft size={14} /> Go back
        </button>
      </div>
    );
  }

  if (!task) return null;

  const priMeta = PRIORITY_META[task.priority] ?? PRIORITY_META['normal'];
  const statusMeta = STATUS_META[task.taskStatus] ?? { color: 'text-slate-600', bg: 'bg-slate-50', border: 'border-slate-200' };
  const instMeta = instance ? (INSTANCE_STATUS_META[instance.instanceStatus] ?? INSTANCE_STATUS_META['active']) : null;
  const overdueDeadline = isOverdue(task.dueDate) && task.taskStatus !== 'completed';
  const isWorkflowTask = task.taskType === 'workflow_step' && !!instance;
  const canAct = task.taskStatus !== 'completed' && task.taskStatus !== 'dismissed';

  // Current step info
  const currentStep = instance?.instanceSteps?.find((s) => s.stepId === instance.currentStepId);
  const templateStep = template?.steps.find((s) => s.id === instance?.currentStepId);

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 mb-5 text-xs text-muted-foreground">
        <Link href="/workflows" className="hover:text-foreground transition-colors">Workflows</Link>
        <ChevronRight size={12} />
        <Link href="/workflows/tasks" className="hover:text-foreground transition-colors">Task List</Link>
        <ChevronRight size={12} />
        <span className="text-foreground font-500 truncate max-w-[200px]">{task.title}</span>
      </div>

      {/* Success / Error banners */}
      {successMsg && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700">
          <CheckCircle2 size={15} />
          {successMsg}
          <button onClick={() => setSuccessMsg(null)} className="ml-auto text-green-500 hover:text-green-700">✕</button>
        </div>
      )}
      {error && (
        <div className="mb-4 flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <AlertTriangle size={15} />
          {error}
          <button onClick={() => setError(null)} className="ml-auto text-red-500 hover:text-red-700">✕</button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* ── Left / Main Column ─────────────────────────────────────────────── */}
        <div className="xl:col-span-2 space-y-5">

          {/* Task Header Card */}
          <div className="bg-white border border-border rounded-2xl p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap mb-2">
                  <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-600 border ${statusMeta.bg} ${statusMeta.color} ${statusMeta.border}`}>
                    {task.taskStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-600 border ${priMeta.cls}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${priMeta.dot}`} />
                    {priMeta.label}
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-xs font-500 bg-slate-50 text-slate-600 border border-slate-200">
                    {task.taskType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                  </span>
                </div>
                <h1 className="text-xl font-700 text-foreground leading-snug">{task.title}</h1>
                {task.description && (
                  <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{task.description}</p>
                )}
              </div>
              <button
                onClick={loadData}
                className="shrink-0 p-2 rounded-lg border border-border text-muted-foreground hover:bg-muted transition-colors"
                title="Refresh"
              >
                <RefreshCw size={14} />
              </button>
            </div>

            {/* Meta grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-border">
              <div>
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Assigned To</p>
                <div className="flex items-center gap-1.5">
                  <div className="w-5 h-5 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                    <User size={10} className="text-indigo-600" />
                  </div>
                  <span className="text-xs font-500 text-foreground truncate">{assignedUserName || '—'}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Deadline</p>
                <div className={`flex items-center gap-1.5 ${overdueDeadline ? 'text-red-600' : 'text-foreground'}`}>
                  <Calendar size={12} className="shrink-0" />
                  <span className="text-xs font-500">{fmtDate(task.dueDate)}</span>
                  {overdueDeadline && <span className="text-[10px] font-600 text-red-600 bg-red-50 px-1.5 py-0.5 rounded-full border border-red-200">Overdue</span>}
                </div>
              </div>
              <div>
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Created</p>
                <div className="flex items-center gap-1.5 text-foreground">
                  <Clock size={12} className="shrink-0 text-muted-foreground" />
                  <span className="text-xs font-500">{fmtDate(task.createdAt)}</span>
                </div>
              </div>
              <div>
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Collateral</p>
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="shrink-0 text-muted-foreground" />
                  <span className="text-xs font-500 text-foreground truncate">{task.collateralId || '—'}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Inline Action Buttons */}
          {canAct && (
            <div className="bg-white border border-border rounded-2xl p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <Send size={14} className="text-indigo-500" />
                Actions
              </h2>
              <div className="flex flex-wrap gap-2.5">
                {isWorkflowTask && instance?.instanceStatus === 'active' && (
                  <>
                    <button
                      onClick={() => setActiveModal('approve')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-600 rounded-xl hover:bg-green-700 transition-colors shadow-sm"
                    >
                      <CheckCircle2 size={15} />
                      Approve
                    </button>
                    <button
                      onClick={() => setActiveModal('reject')}
                      className="flex items-center gap-2 px-4 py-2.5 bg-red-600 text-white text-sm font-600 rounded-xl hover:bg-red-700 transition-colors shadow-sm"
                    >
                      <XCircle size={15} />
                      Reject
                    </button>
                  </>
                )}
                <button
                  onClick={() => setActiveModal('reassign')}
                  className="flex items-center gap-2 px-4 py-2.5 bg-indigo-50 text-indigo-700 text-sm font-600 rounded-xl hover:bg-indigo-100 border border-indigo-200 transition-colors"
                >
                  <User size={15} />
                  Reassign
                </button>
                {task.taskStatus !== 'completed' && task.taskType !== 'workflow_step' && (
                  <button
                    onClick={handleMarkComplete}
                    disabled={actionLoading}
                    className="flex items-center gap-2 px-4 py-2.5 bg-teal-50 text-teal-700 text-sm font-600 rounded-xl hover:bg-teal-100 border border-teal-200 transition-colors disabled:opacity-50"
                  >
                    {actionLoading ? <Loader2 size={14} className="animate-spin" /> : <CheckSquare size={15} />}
                    Mark Complete
                  </button>
                )}
                {task.actionUrl && (
                  <Link
                    href={task.actionUrl}
                    className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 text-slate-700 text-sm font-600 rounded-xl hover:bg-slate-100 border border-slate-200 transition-colors"
                  >
                    <FileText size={15} />
                    {task.actionLabel ?? 'View Reference'}
                  </Link>
                )}
              </div>
            </div>
          )}

          {/* Workflow Context */}
          {instance && template && (
            <div className="bg-white border border-border rounded-2xl overflow-hidden">
              <button
                onClick={() => setShowSteps(!showSteps)}
                className="w-full flex items-center justify-between px-6 py-4 hover:bg-muted/30 transition-colors"
              >
                <h2 className="text-sm font-700 text-foreground flex items-center gap-2">
                  <GitBranch size={14} className="text-indigo-500" />
                  Workflow Context — {template.name}
                </h2>
                {showSteps ? <ChevronUp size={15} className="text-muted-foreground" /> : <ChevronDown size={15} className="text-muted-foreground" />}
              </button>

              {showSteps && (
                <div className="px-6 pb-5 border-t border-border">
                  {/* Instance summary */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 py-4 mb-4 border-b border-border">
                    <div>
                      <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Instance Status</p>
                      {instMeta && (
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-600 border ${instMeta.bg} ${instMeta.color} ${instMeta.border}`}>
                          {instMeta.label}
                        </span>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Reference</p>
                      <p className="text-xs font-500 text-foreground">{instance.referenceLabel ?? instance.referenceId}</p>
                      <p className="text-[10px] text-muted-foreground">{instance.referenceType}</p>
                    </div>
                    <div>
                      <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Instance Deadline</p>
                      <p className={`text-xs font-500 ${isOverdue(instance.dueAt) && instance.instanceStatus === 'active' ? 'text-red-600' : 'text-foreground'}`}>
                        {fmtDate(instance.dueAt)}
                      </p>
                    </div>
                  </div>

                  {/* Step progress */}
                  <div className="space-y-2">
                    {template.steps.map((step, idx) => {
                      const instStep = instance.instanceSteps?.find((s) => s.stepId === step.id);
                      const stepMeta = STEP_STATUS_META[instStep?.stepStatus ?? 'pending'];
                      const isCurrent = step.id === instance.currentStepId;

                      return (
                        <div
                          key={step.id}
                          className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
                            isCurrent
                              ? 'border-indigo-200 bg-indigo-50/50' :'border-border bg-white'
                          }`}
                        >
                          {/* Step number */}
                          <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-xs font-700 ${stepMeta.bg} ${stepMeta.color}`}>
                            {stepMeta.icon}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-xs font-600 text-foreground">{step.name}</span>
                              {isCurrent && (
                                <span className="text-[10px] font-600 px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full border border-indigo-200">
                                  Current
                                </span>
                              )}
                              <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${stepMeta.bg} ${stepMeta.color}`}>
                                {(instStep?.stepStatus ?? 'pending').replace(/_/g, ' ')}
                              </span>
                            </div>
                            {step.description && (
                              <p className="text-[11px] text-muted-foreground mt-0.5">{step.description}</p>
                            )}
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground flex-wrap">
                              {step.actors.length > 0 && (
                                <span className="flex items-center gap-1">
                                  <Shield size={10} />
                                  {step.actors.map((a) => a.actorLabel).join(', ')}
                                </span>
                              )}
                              {step.slaHours && (
                                <span className="flex items-center gap-1">
                                  <Clock size={10} />
                                  SLA: {step.slaHours}h
                                </span>
                              )}
                              {instStep?.completedAt && (
                                <span className="flex items-center gap-1">
                                  <CheckCircle2 size={10} />
                                  {fmtDateTime(instStep.completedAt)}
                                </span>
                              )}
                            </div>
                          </div>
                          <span className="shrink-0 text-[10px] text-muted-foreground font-500">Step {idx + 1}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Approval / Transition History */}
          {transitionLog.length > 0 && (
            <div className="bg-white border border-border rounded-2xl p-6">
              <h2 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
                <History size={14} className="text-indigo-500" />
                Approval History
              </h2>
              <div className="relative">
                {/* Vertical line */}
                <div className="absolute left-3.5 top-0 bottom-0 w-px bg-border" />
                <div className="space-y-4">
                  {transitionLog.map((log, idx) => {
                    const actionMeta = ACTION_META[log.action] ?? { label: log.action, color: 'text-slate-600' };
                    return (
                      <div key={log.id} className="flex gap-4 relative">
                        <div className={`shrink-0 w-7 h-7 rounded-full border-2 border-white flex items-center justify-center z-10 ${
                          log.action === 'approve' ? 'bg-green-100' :
                          log.action === 'reject' ? 'bg-red-100' :
                          log.action === 'started' ? 'bg-blue-100' : 'bg-slate-100'
                        }`}>
                          {log.action === 'approve' ? <CheckCircle2 size={13} className="text-green-600" /> :
                           log.action === 'reject' ? <XCircle size={13} className="text-red-600" /> :
                           log.action === 'started' ? <GitBranch size={13} className="text-blue-600" /> :
                           <RefreshCw size={13} className="text-slate-500" />}
                        </div>
                        <div className="flex-1 min-w-0 pb-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className={`text-xs font-700 ${actionMeta.color}`}>{actionMeta.label}</span>
                            {log.performedByName && (
                              <span className="text-xs text-muted-foreground">by {log.performedByName}</span>
                            )}
                            {log.performedByRole && (
                              <span className="text-[10px] px-1.5 py-0.5 bg-slate-50 text-slate-500 rounded-full border border-slate-200">
                                {log.performedByRole}
                              </span>
                            )}
                          </div>
                          {log.comment && (
                            <div className="mt-1.5 flex items-start gap-1.5 text-xs text-muted-foreground">
                              <MessageSquare size={11} className="shrink-0 mt-0.5" />
                              <span className="italic">"{log.comment}"</span>
                            </div>
                          )}
                          <p className="text-[10px] text-muted-foreground mt-1">{fmtDateTime(log.createdAt)}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right Sidebar ──────────────────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Task Details Card */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <h2 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
              <FileText size={14} className="text-indigo-500" />
              Task Details
            </h2>
            <dl className="space-y-3">
              {[
                { label: 'Task ID', value: task.id.slice(0, 8) + '…' },
                { label: 'Type', value: task.taskType.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) },
                { label: 'Status', value: task.taskStatus.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) },
                { label: 'Priority', value: priMeta.label },
                { label: 'Created', value: fmtDateTime(task.createdAt) },
                { label: 'Updated', value: fmtDateTime(task.updatedAt) },
                ...(task.completedAt ? [{ label: 'Completed', value: fmtDateTime(task.completedAt) }] : []),
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-2">
                  <dt className="text-[11px] text-muted-foreground font-500 shrink-0">{label}</dt>
                  <dd className="text-[11px] text-foreground font-600 text-right truncate">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Assigned Actor Card */}
          <div className="bg-white border border-border rounded-2xl p-5">
            <h2 className="text-sm font-700 text-foreground mb-4 flex items-center gap-2">
              <User size={14} className="text-indigo-500" />
              Assigned Actor
            </h2>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center shrink-0">
                <User size={18} className="text-indigo-600" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-600 text-foreground truncate">{assignedUserName || 'Unassigned'}</p>
                <p className="text-xs text-muted-foreground">Responsible for this task</p>
              </div>
            </div>
            {templateStep && templateStep.actors.length > 0 && (
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-2">Step Actors</p>
                <div className="space-y-2">
                  {templateStep.actors.map((actor) => (
                    <div key={actor.id} className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <Shield size={11} className="text-indigo-400 shrink-0" />
                        <span className="text-xs text-foreground font-500">{actor.actorLabel}</span>
                      </div>
                      <div className="flex gap-1">
                        {actor.canApprove && <span className="text-[9px] px-1.5 py-0.5 bg-green-50 text-green-700 rounded-full border border-green-200">Approve</span>}
                        {actor.canReject && <span className="text-[9px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded-full border border-red-200">Reject</span>}
                        {actor.canReturn && <span className="text-[9px] px-1.5 py-0.5 bg-amber-50 text-amber-700 rounded-full border border-amber-200">Return</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Deadline Card */}
          <div className={`border rounded-2xl p-5 ${overdueDeadline ? 'bg-red-50 border-red-200' : 'bg-white border-border'}`}>
            <h2 className={`text-sm font-700 mb-3 flex items-center gap-2 ${overdueDeadline ? 'text-red-700' : 'text-foreground'}`}>
              <Calendar size={14} className={overdueDeadline ? 'text-red-500' : 'text-indigo-500'} />
              Deadline
            </h2>
            <p className={`text-2xl font-700 ${overdueDeadline ? 'text-red-700' : 'text-foreground'}`}>
              {fmtDate(task.dueDate)}
            </p>
            {overdueDeadline && (
              <p className="text-xs text-red-600 mt-1 font-500">⚠ This task is past its deadline</p>
            )}
            {!task.dueDate && <p className="text-sm text-muted-foreground">No deadline set</p>}
          </div>

          {/* Workflow Instance Quick Info */}
          {instance && (
            <div className="bg-white border border-border rounded-2xl p-5">
              <h2 className="text-sm font-700 text-foreground mb-3 flex items-center gap-2">
                <GitBranch size={14} className="text-indigo-500" />
                Workflow Instance
              </h2>
              <dl className="space-y-2.5">
                {[
                  { label: 'Template', value: template?.name ?? '—' },
                  { label: 'Type', value: template?.workflowType?.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) ?? '—' },
                  { label: 'Started', value: fmtDate(instance.startedAt) },
                  { label: 'Due', value: fmtDate(instance.dueAt) },
                  { label: 'Steps', value: `${instance.instanceSteps?.filter((s) => s.stepStatus === 'completed').length ?? 0} / ${template?.steps.length ?? 0} completed` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex justify-between gap-2">
                    <dt className="text-[11px] text-muted-foreground font-500 shrink-0">{label}</dt>
                    <dd className="text-[11px] text-foreground font-600 text-right">{value}</dd>
                  </div>
                ))}
              </dl>
              <Link
                href={`/workflows-admin/instances`}
                className="mt-4 flex items-center justify-center gap-1.5 w-full py-2 text-xs font-600 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl border border-indigo-200 transition-colors"
              >
                View All Instances <ChevronRight size={12} />
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {(activeModal === 'approve' || activeModal === 'reject') && (
        <ActionModal
          action={activeModal}
          onClose={() => setActiveModal(null)}
          onConfirm={(comment) => handleApproveReject(activeModal, comment)}
          loading={actionLoading}
        />
      )}
      {activeModal === 'reassign' && (
        <ReassignModal
          onClose={() => setActiveModal(null)}
          onConfirm={handleReassign}
        />
      )}
    </div>
  );
}
