'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Clock, FileUp, GitBranch, ShieldCheck, RefreshCw, X, ChevronRight, Loader2, ClipboardList, CheckCheck, Filter, LayoutGrid } from 'lucide-react';
import Link from 'next/link';
import { userTaskService, UserTask, TaskType, TaskStatus } from '@/lib/supabase/userTaskService';
import { useAuth } from '@/contexts/AuthContext';

const TASK_TYPE_META: Record<TaskType, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  document_upload: {
    label: 'Document Upload',
    icon: <FileUp size={15} />,
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  workflow_step: {
    label: 'Workflow Step',
    icon: <GitBranch size={15} />,
    color: 'text-violet-600',
    bg: 'bg-violet-50',
  },
  approval: {
    label: 'Approval',
    icon: <ShieldCheck size={15} />,
    color: 'text-emerald-600',
    bg: 'bg-emerald-50',
  },
  perfection: {
    label: 'Perfection',
    icon: <CheckCircle2 size={15} />,
    color: 'text-teal-600',
    bg: 'bg-teal-50',
  },
  valuation: {
    label: 'Valuation',
    icon: <RefreshCw size={15} />,
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  insurance: {
    label: 'Insurance',
    icon: <ShieldCheck size={15} />,
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
  general: {
    label: 'General',
    icon: <ClipboardList size={15} />,
    color: 'text-slate-600',
    bg: 'bg-slate-50',
  },
};

const PRIORITY_META = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
  high: { label: 'High', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  normal: { label: 'Normal', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  low: { label: 'Low', cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

const STATUS_FILTERS: { value: 'all' | TaskStatus; label: string }[] = [
  { value: 'all', label: 'All Tasks' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'completed', label: 'Completed' },
];

export default function MyTasksContent() {
  const { user } = useAuth();
  const router = useRouter();
  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | TaskStatus>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | TaskType>('all');

  const fetchTasks = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await userTaskService.getMyTasks(user.id);
      setTasks(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleMarkComplete = async (task: UserTask) => {
    setActionLoading(task.id);
    try {
      await userTaskService.markComplete(task.id);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, taskStatus: 'completed', completedAt: new Date().toISOString() } : t));
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (task: UserTask) => {
    setActionLoading(task.id + '_dismiss');
    try {
      await userTaskService.dismiss(task.id);
      setTasks((prev) => prev.filter((t) => t.id !== task.id));
    } finally {
      setActionLoading(null);
    }
  };

  const handleAction = async (task: UserTask) => {
    if (task.taskStatus === 'pending') {
      await userTaskService.markInProgress(task.id);
      setTasks((prev) => prev.map((t) => t.id === task.id ? { ...t, taskStatus: 'in_progress' } : t));
    }
    if (task.actionUrl) {
      router.push(task.actionUrl);
    }
  };

  const filtered = tasks.filter((t) => {
    const matchStatus = statusFilter === 'all' || t.taskStatus === statusFilter;
    const matchType = typeFilter === 'all' || t.taskType === typeFilter;
    return matchStatus && matchType;
  });

  const pendingCount = tasks.filter((t) => t.taskStatus === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.taskStatus === 'in_progress').length;
  const completedCount = tasks.filter((t) => t.taskStatus === 'completed').length;

  const uniqueTypes = Array.from(new Set(tasks.map((t) => t.taskType)));

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 sm:py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Link href="/workflows" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <LayoutGrid size={11} /> Workflows
            </Link>
            <ChevronRight size={11} className="text-muted-foreground" />
            <span className="text-xs text-foreground font-medium">My Tasks</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-700 text-foreground">My Tasks</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Your assigned workflow steps, document uploads, and pending actions
          </p>
        </div>
        <button
          onClick={fetchTasks}
          className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors self-start sm:self-auto"
        >
          <RefreshCw size={13} />
          Refresh
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Pending</p>
          <p className="text-2xl font-700" style={{ color: 'var(--izou-primary)' }}>{pendingCount}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">In Progress</p>
          <p className="text-2xl font-700 text-amber-600">{inProgressCount}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <p className="text-xs text-muted-foreground mb-1">Completed</p>
          <p className="text-2xl font-700 text-emerald-600">{completedCount}</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex items-center gap-1.5 mr-1">
          <Filter size={13} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground font-500">Filter:</span>
        </div>
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setStatusFilter(f.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-500 border transition-colors ${
              statusFilter === f.value
                ? 'bg-primary text-white border-primary' :'bg-white border-border text-muted-foreground hover:bg-muted'
            }`}
          >
            {f.label}
          </button>
        ))}
        {uniqueTypes.length > 1 && (
          <>
            <div className="w-px bg-border mx-1" />
            <button
              onClick={() => setTypeFilter('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-500 border transition-colors ${
                typeFilter === 'all' ?'bg-primary text-white border-primary' :'bg-white border-border text-muted-foreground hover:bg-muted'
              }`}
            >
              All Types
            </button>
            {uniqueTypes.map((type) => {
              const meta = TASK_TYPE_META[type];
              return (
                <button
                  key={type}
                  onClick={() => setTypeFilter(type)}
                  className={`px-3 py-1.5 rounded-full text-xs font-500 border transition-colors ${
                    typeFilter === type
                      ? 'bg-primary text-white border-primary' :'bg-white border-border text-muted-foreground hover:bg-muted'
                  }`}
                >
                  {meta.label}
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Task List */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading your tasks...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCheck size={24} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-600 text-foreground">
              {statusFilter === 'all' && typeFilter === 'all' ? 'No tasks assigned' : 'No tasks match your filters'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {statusFilter === 'all' && typeFilter === 'all' ?'Tasks will appear here when collaterals are registered or workflow steps are assigned to you.' :'Try adjusting your filters to see more tasks.'}
            </p>
          </div>
          {(statusFilter !== 'all' || typeFilter !== 'all') && (
            <button
              onClick={() => { setStatusFilter('all'); setTypeFilter('all'); }}
              className="text-sm text-primary hover:underline"
            >
              Clear filters
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((task) => {
            const typeMeta = TASK_TYPE_META[task.taskType];
            const priorityMeta = PRIORITY_META[task.priority];
            const isCompleted = task.taskStatus === 'completed';
            const isActioning = actionLoading === task.id;
            const isDismissing = actionLoading === task.id + '_dismiss';

            return (
              <div
                key={task.id}
                className={`bg-white border rounded-xl p-4 transition-all ${
                  isCompleted ? 'opacity-60 border-border' : 'border-border hover:border-primary/30 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Type Icon */}
                  <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${typeMeta.bg} ${typeMeta.color}`}>
                    {typeMeta.icon}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className={`text-sm font-600 ${isCompleted ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                          {task.title}
                        </p>
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-500 ${priorityMeta.cls}`}>
                          {priorityMeta.label}
                        </span>
                        {task.taskStatus === 'in_progress' && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 border border-amber-200 font-500">
                            In Progress
                          </span>
                        )}
                        {isCompleted && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200 font-500">
                            Done
                          </span>
                        )}
                      </div>
                      {/* Dismiss */}
                      {!isCompleted && (
                        <button
                          onClick={() => handleDismiss(task)}
                          disabled={isDismissing}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors shrink-0"
                          title="Dismiss task"
                        >
                          {isDismissing ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                        </button>
                      )}
                    </div>

                    {task.description && (
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{task.description}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {/* Collateral ref */}
                      {task.collateralId && (
                        <span className="text-xs text-muted-foreground font-mono bg-muted px-1.5 py-0.5 rounded">
                          {task.collateralId}
                        </span>
                      )}
                      {/* Type badge */}
                      <span className={`text-xs font-500 ${typeMeta.color}`}>{typeMeta.label}</span>
                      {/* Due date */}
                      {task.dueDate && (
                        <span className={`flex items-center gap-1 text-xs ${
                          new Date(task.dueDate) < new Date() && !isCompleted
                            ? 'text-red-500' :'text-muted-foreground'
                        }`}>
                          <Clock size={11} />
                          Due {new Date(task.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      )}
                      {/* Completed at */}
                      {isCompleted && task.completedAt && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle2 size={11} />
                          Completed {new Date(task.completedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  {!isCompleted && (
                    <div className="flex items-center gap-2 shrink-0 ml-2">
                      {task.actionUrl && (
                        <button
                          onClick={() => handleAction(task)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-600 hover:bg-primary/90 transition-all active:scale-95"
                        >
                          {task.actionLabel ?? 'Open'}
                          <ChevronRight size={12} />
                        </button>
                      )}
                      <button
                        onClick={() => handleMarkComplete(task)}
                        disabled={isActioning}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg text-xs font-600 hover:bg-emerald-100 transition-colors"
                        title="Mark as complete"
                      >
                        {isActioning ? (
                          <Loader2 size={12} className="animate-spin" />
                        ) : (
                          <CheckCircle2 size={12} />
                        )}
                        Done
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
