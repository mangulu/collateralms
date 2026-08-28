'use client';
import React, { useEffect, useState, useCallback, useId } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, AlertTriangle, Filter, RefreshCw, Loader2, CheckCheck, ChevronRight, LayoutGrid, Search, X, ExternalLink, Calendar, User, Workflow, MessageSquare, ChevronDown, ChevronUp,  } from 'lucide-react';
import { userTaskService, UserTask, TaskStatus, WorkspaceFilters } from '@/lib/supabase/userTaskService';
import { useAuth } from '@/contexts/AuthContext';
import { createClient } from '@/lib/supabase/client';

const STATUS_META: Record<string, { label: string; cls: string; dot: string }> = {
  pending:     { label: 'Pending',     cls: 'bg-amber-50 text-amber-700 border-amber-200',   dot: 'bg-amber-400' },
  in_progress: { label: 'In Progress', cls: 'bg-blue-50 text-blue-700 border-blue-200',      dot: 'bg-blue-500' },
  completed:   { label: 'Completed',   cls: 'bg-emerald-50 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  cancelled:   { label: 'Cancelled',   cls: 'bg-slate-100 text-slate-500 border-slate-200',  dot: 'bg-slate-400' },
  dismissed:   { label: 'Dismissed',   cls: 'bg-slate-100 text-slate-400 border-slate-200',  dot: 'bg-slate-300' },
};

const PRIORITY_META: Record<string, { label: string; cls: string }> = {
  urgent: { label: 'Urgent', cls: 'bg-red-100 text-red-700 border-red-200' },
  high:   { label: 'High',   cls: 'bg-amber-100 text-amber-700 border-amber-200' },
  normal: { label: 'Normal', cls: 'bg-blue-50 text-blue-600 border-blue-200' },
  low:    { label: 'Low',    cls: 'bg-slate-100 text-slate-500 border-slate-200' },
};

function isOverdue(task: UserTask): boolean {
  if (!task.deadline) return false;
  if (task.taskStatus === 'completed' || task.taskStatus === 'cancelled') return false;
  return new Date(task.deadline) < new Date();
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

interface UserProfile { id: string; full_name: string; email: string; }

export default function StaffWorkspaceContent() {
  const { user } = useAuth();
  const searchId = useId();

  const [tasks, setTasks] = useState<UserTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [workflowFilter, setWorkflowFilter] = useState<string>('all');
  const [assigneeFilter, setAssigneeFilter] = useState<string>('all');
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  const [workflowNames, setWorkflowNames] = useState<string[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    try {
      const filters: WorkspaceFilters = {};
      if (statusFilter !== 'all') filters.status = statusFilter as TaskStatus;
      if (workflowFilter !== 'all') filters.workflowName = workflowFilter;
      if (assigneeFilter !== 'all') filters.assignedTo = assigneeFilter;
      if (overdueOnly) filters.overdue = true;
      const data = await userTaskService.getAllTasks(filters);
      setTasks(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [statusFilter, workflowFilter, assigneeFilter, overdueOnly]);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  useEffect(() => {
    userTaskService.getDistinctWorkflowNames().then(setWorkflowNames);
    const supabase = createClient();
    supabase.from('user_profiles').select('id, full_name, email').then(({ data }) => {
      if (data) setUsers(data as UserProfile[]);
    });
  }, []);

  const filtered = tasks.filter((t) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      t.title.toLowerCase().includes(q) ||
      (t.workflowName ?? '').toLowerCase().includes(q) ||
      (t.taskName ?? '').toLowerCase().includes(q) ||
      (t.collateralId ?? '').toLowerCase().includes(q) ||
      (t.assignedByName ?? '').toLowerCase().includes(q)
    );
  });

  const pendingCount    = tasks.filter((t) => t.taskStatus === 'pending').length;
  const inProgressCount = tasks.filter((t) => t.taskStatus === 'in_progress').length;
  const completedCount  = tasks.filter((t) => t.taskStatus === 'completed').length;
  const overdueCount    = tasks.filter(isOverdue).length;

  const handleMarkComplete = async (task: UserTask) => {
    setActionLoading(task.id + '_complete');
    try {
      const profile = users.find((u) => u.id === user?.id);
      await userTaskService.markComplete(task.id, profile?.full_name);
      await fetchTasks();
    } finally {
      setActionLoading(null);
    }
  };

  const handleSaveComment = async (task: UserTask) => {
    const comment = commentDraft[task.id] ?? '';
    if (!comment.trim()) return;
    setActionLoading(task.id + '_comment');
    try {
      await userTaskService.updateComments(task.id, comment);
      setCommentDraft((prev) => ({ ...prev, [task.id]: '' }));
      await fetchTasks();
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (task: UserTask) => {
    setActionLoading(task.id + '_cancel');
    try {
      await userTaskService.cancel(task.id, 'Cancelled by manager');
      await fetchTasks();
    } finally {
      setActionLoading(null);
    }
  };

  const clearFilters = () => {
    setStatusFilter('all');
    setWorkflowFilter('all');
    setAssigneeFilter('all');
    setOverdueOnly(false);
    setSearch('');
  };

  const hasActiveFilters = statusFilter !== 'all' || workflowFilter !== 'all' || assigneeFilter !== 'all' || overdueOnly || search;

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 2xl:px-12 py-4 sm:py-6 max-w-screen-2xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-1.5 mb-0.5">
            <Link href="/workflows" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors">
              <LayoutGrid size={11} /> Workflows
            </Link>
            <ChevronRight size={11} className="text-muted-foreground" />
            <span className="text-xs text-foreground font-medium">Staff Workspace</span>
          </div>
          <h1 className="text-xl sm:text-2xl font-700 text-foreground">Staff Workspace</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
            Unified view of all assigned tasks across all workflows
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Clock size={14} className="text-amber-500" />
            <p className="text-xs text-muted-foreground">Pending</p>
          </div>
          <p className="text-2xl font-700 text-amber-600">{pendingCount}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <Workflow size={14} className="text-blue-500" />
            <p className="text-xs text-muted-foreground">In Progress</p>
          </div>
          <p className="text-2xl font-700 text-blue-600">{inProgressCount}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className="text-xs text-muted-foreground">Completed</p>
          </div>
          <p className="text-2xl font-700 text-emerald-600">{completedCount}</p>
        </div>
        <div className="bg-white border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle size={14} className="text-red-500" />
            <p className="text-xs text-muted-foreground">Overdue</p>
          </div>
          <p className="text-2xl font-700 text-red-600">{overdueCount}</p>
        </div>
      </div>

      {/* Search + Filter Bar */}
      <div className="bg-white border border-border rounded-xl p-4 mb-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              id={searchId}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search tasks, workflows, collateral IDs..."
              className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters((p) => !p)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-500 transition-colors ${showFilters || hasActiveFilters ? 'bg-primary text-white border-primary' : 'bg-white border-border text-muted-foreground hover:bg-muted'}`}
          >
            <Filter size={13} />
            Filters
            {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-white/80 inline-block" />}
          </button>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="flex items-center gap-1.5 px-3 py-2 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              <X size={13} /> Clear
            </button>
          )}
        </div>

        {showFilters && (
          <div className="mt-4 pt-4 border-t border-border grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Status */}
            <div>
              <label className="text-xs text-muted-foreground font-500 mb-1.5 block">Status</label>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
            {/* Workflow */}
            <div>
              <label className="text-xs text-muted-foreground font-500 mb-1.5 block">Workflow</label>
              <select
                value={workflowFilter}
                onChange={(e) => setWorkflowFilter(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Workflows</option>
                {workflowNames.map((wf) => (
                  <option key={wf} value={wf}>{wf}</option>
                ))}
              </select>
            </div>
            {/* Assignee */}
            <div>
              <label className="text-xs text-muted-foreground font-500 mb-1.5 block">Assignee</label>
              <select
                value={assigneeFilter}
                onChange={(e) => setAssigneeFilter(e.target.value)}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="all">All Staff</option>
                {users.map((u) => (
                  <option key={u.id} value={u.id}>{u.full_name || u.email}</option>
                ))}
              </select>
            </div>
            {/* Overdue */}
            <div className="flex items-end">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={overdueOnly}
                  onChange={(e) => setOverdueOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-border text-primary focus:ring-primary/20"
                />
                <span className="text-sm text-foreground font-500">Overdue only</span>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Task Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Loading workspace tasks...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 bg-white border border-border rounded-xl">
          <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center">
            <CheckCheck size={24} className="text-emerald-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-600 text-foreground">
              {hasActiveFilters ? 'No tasks match your filters' : 'No tasks found'}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              {hasActiveFilters ? 'Try adjusting your filters.' : 'Tasks will appear here when workflows assign them to staff.'}
            </p>
          </div>
          {hasActiveFilters && (
            <button onClick={clearFilters} className="text-sm text-primary hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-border rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/40 border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Task / Workflow</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Assigned To</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Assigned By</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Assigned Date</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Deadline</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((task) => {
                  const overdue = isOverdue(task);
                  const statusMeta = STATUS_META[task.taskStatus] ?? STATUS_META.pending;
                  const priorityMeta = PRIORITY_META[task.priority] ?? PRIORITY_META.normal;
                  const isExpanded = expandedRow === task.id;
                  const assigneeProfile = users.find((u) => u.id === task.assignedTo);

                  return (
                    <React.Fragment key={task.id}>
                      <tr
                        className={`hover:bg-muted/20 transition-colors cursor-pointer ${overdue ? 'bg-red-50/40' : ''}`}
                        onClick={() => setExpandedRow(isExpanded ? null : task.id)}
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-start gap-2">
                            {overdue && <AlertTriangle size={13} className="text-red-500 mt-0.5 shrink-0" />}
                            <div>
                              <p className="font-500 text-foreground text-sm leading-snug">{task.title}</p>
                              {task.workflowName && (
                                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                                  <Workflow size={10} />
                                  {task.workflowName}
                                </p>
                              )}
                              {task.collateralId && (
                                <p className="text-xs text-muted-foreground font-mono">{task.collateralId}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5">
                            <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                              <User size={11} className="text-primary" />
                            </div>
                            <span className="text-sm text-foreground">
                              {assigneeProfile?.full_name || assigneeProfile?.email || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{task.assignedByName || '—'}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <Calendar size={11} />
                            {formatDate(task.assignedDate)}
                          </div>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          {task.deadline ? (
                            <span className={`text-sm font-500 ${overdue ? 'text-red-600' : 'text-foreground'}`}>
                              {formatDate(task.deadline)}
                            </span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-500 border ${statusMeta.cls}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${statusMeta.dot}`} />
                            {statusMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-500 border ${priorityMeta.cls}`}>
                            {priorityMeta.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                            {task.deepLink && (
                              <Link
                                href={task.deepLink}
                                className="p-1.5 rounded-md hover:bg-primary/10 text-primary transition-colors"
                                title="Open task"
                              >
                                <ExternalLink size={13} />
                              </Link>
                            )}
                            {(task.taskStatus === 'pending' || task.taskStatus === 'in_progress') && (
                              <button
                                onClick={() => handleMarkComplete(task)}
                                disabled={actionLoading === task.id + '_complete'}
                                className="p-1.5 rounded-md hover:bg-emerald-50 text-emerald-600 transition-colors disabled:opacity-50"
                                title="Mark complete"
                              >
                                {actionLoading === task.id + '_complete' ? (
                                  <Loader2 size={13} className="animate-spin" />
                                ) : (
                                  <CheckCircle2 size={13} />
                                )}
                              </button>
                            )}
                            <button
                              onClick={() => setExpandedRow(isExpanded ? null : task.id)}
                              className="p-1.5 rounded-md hover:bg-muted text-muted-foreground transition-colors"
                              title="Details"
                            >
                              {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Expanded Detail Row */}
                      {isExpanded && (
                        <tr className="bg-muted/20">
                          <td colSpan={8} className="px-6 py-4">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                              <div>
                                <p className="text-xs text-muted-foreground font-500 mb-1">Description</p>
                                <p className="text-sm text-foreground">{task.description || '—'}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-500 mb-1">Date Attended</p>
                                <p className="text-sm text-foreground">{formatDate(task.dateAttended)}</p>
                              </div>
                              <div>
                                <p className="text-xs text-muted-foreground font-500 mb-1">Attended By</p>
                                <p className="text-sm text-foreground">{task.attendedByName || '—'}</p>
                              </div>
                            </div>

                            {task.comments && (
                              <div className="mb-4 p-3 bg-white border border-border rounded-lg">
                                <p className="text-xs text-muted-foreground font-500 mb-1 flex items-center gap-1">
                                  <MessageSquare size={11} /> Comments
                                </p>
                                <p className="text-sm text-foreground">{task.comments}</p>
                              </div>
                            )}

                            {/* Add/Update Comment */}
                            {task.taskStatus !== 'completed' && task.taskStatus !== 'cancelled' && (
                              <div className="flex gap-2 mt-2">
                                <input
                                  type="text"
                                  value={commentDraft[task.id] ?? ''}
                                  onChange={(e) => setCommentDraft((prev) => ({ ...prev, [task.id]: e.target.value }))}
                                  placeholder="Add a comment..."
                                  className="flex-1 text-sm border border-border rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <button
                                  onClick={() => handleSaveComment(task)}
                                  disabled={!commentDraft[task.id]?.trim() || actionLoading === task.id + '_comment'}
                                  className="px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                                >
                                  {actionLoading === task.id + '_comment' ? <Loader2 size={13} className="animate-spin" /> : 'Save'}
                                </button>
                                {(task.taskStatus === 'pending' || task.taskStatus === 'in_progress') && (
                                  <button
                                    onClick={() => handleCancel(task)}
                                    disabled={actionLoading === task.id + '_cancel'}
                                    className="px-4 py-2 bg-white border border-border text-muted-foreground text-sm rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-200 disabled:opacity-50 transition-colors"
                                  >
                                    {actionLoading === task.id + '_cancel' ? <Loader2 size={13} className="animate-spin" /> : 'Cancel Task'}
                                  </button>
                                )}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Showing <span className="font-600 text-foreground">{filtered.length}</span> of <span className="font-600 text-foreground">{tasks.length}</span> tasks
            </p>
            {overdueCount > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-red-600 font-500">
                <AlertTriangle size={11} />
                {overdueCount} overdue task{overdueCount !== 1 ? 's' : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
