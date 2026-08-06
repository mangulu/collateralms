'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ShieldCheck, CheckSquare, GitBranch, TrendingUp, ArrowLeftRight, FolderArchive, Clock, AlertTriangle, ChevronRight, RefreshCw, Loader2, CheckCircle2, XCircle, BarChart3, Zap, Activity, Layers, BookText } from 'lucide-react';
import { collateralApprovalService } from '@/lib/supabase/collateralApprovalService';
import { perfectionService } from '@/lib/supabase/perfectionService';
import { userTaskService } from '@/lib/supabase/userTaskService';
import { getValuationStats } from '@/lib/supabase/valuationService';
import { getSubstitutionStats } from '@/lib/supabase/substitutionService';
import { workflowInstanceService } from '@/lib/supabase/workflowEngineService';
import { archiveRequestService } from '@/lib/supabase/archiveService';
import { registrySubmissionTrackerService } from '@/lib/supabase/registrySubmissionTrackerService';
import { useAuth } from '@/contexts/AuthContext';

interface WorkflowCard {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  count: number | null;
  urgentCount?: number;
  loading: boolean;
  badge?: string;
}

function StatPill({ count, label, color }: { count: number; label: string; color: string }) {
  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${color}`}>
      <span>{count}</span>
      <span className="font-normal opacity-80">{label}</span>
    </div>
  );
}

function WorkflowCardItem({ card }: { card: WorkflowCard }) {
  return (
    <Link
      href={card.href}
      className={`group relative flex flex-col gap-4 p-5 rounded-2xl border-2 ${card.borderColor} ${card.bgColor} hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer`}
    >
      {/* Urgency indicator */}
      {(card.urgentCount ?? 0) > 0 && (
        <span className="absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500 text-white text-[10px] font-bold">
          <AlertTriangle size={9} />
          {card.urgentCount} urgent
        </span>
      )}

      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.accentColor} shrink-0`}>
          {card.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-700 text-foreground leading-tight">{card.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{card.description}</p>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {card.loading ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          ) : (
            <span className="text-2xl font-800 text-foreground">
              {card.count ?? '—'}
            </span>
          )}
          {!card.loading && card.count !== null && (
            <span className="text-xs text-muted-foreground">active</span>
          )}
        </div>
        <div className={`flex items-center gap-1 text-xs font-600 ${card.accentColor.replace('bg-', 'text-').replace('-100', '-700').replace('-50', '-600')} group-hover:gap-2 transition-all`}>
          View all <ChevronRight size={13} />
        </div>
      </div>
    </Link>
  );
}

export default function WorkflowsDashboardContent() {
  const { user } = useAuth();
  const [approvalCount, setApprovalCount] = useState<number | null>(null);
  const [approvalUrgent, setApprovalUrgent] = useState(0);
  const [taskCount, setTaskCount] = useState<number | null>(null);
  const [taskUrgent, setTaskUrgent] = useState(0);
  const [perfectionCount, setPerfectionCount] = useState<number | null>(null);
  const [valuationCount, setValuationCount] = useState<number | null>(null);
  const [valuationUrgent, setValuationUrgent] = useState(0);
  const [substitutionCount, setSubstitutionCount] = useState<number | null>(null);
  const [archiveCount, setArchiveCount] = useState<number | null>(null);
  const [archiveUrgent, setArchiveUrgent] = useState(0);
  const [engineStats, setEngineStats] = useState<{ active: number; escalated: number } | null>(null);
  const [registryCount, setRegistryCount] = useState<number | null>(null);
  const [registryUrgent, setRegistryUrgent] = useState(0);
  const [loadingStates, setLoadingStates] = useState({
    approvals: true, tasks: true, perfection: true, valuation: true, substitution: true, engine: true, archive: true, registry: true,
  });
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

  const loadAll = useCallback(async (silent = false) => {
    if (!silent) setLoadingStates({ approvals: true, tasks: true, perfection: true, valuation: true, substitution: true, engine: true, archive: true, registry: true });
    else setRefreshing(true);

    await Promise.allSettled([
      // Approvals
      collateralApprovalService.getAll().then((items) => {
        const active = items.filter((i) => i.status === 'Pending' || i.status === 'Under Review');
        setApprovalCount(active.length);
        setApprovalUrgent(active.filter((i) => i.priority === 'High').length);
        setLoadingStates((p) => ({ ...p, approvals: false }));
      }).catch(() => { setApprovalCount(0); setLoadingStates((p) => ({ ...p, approvals: false })); }),

      // My Tasks
      user?.id ? userTaskService.getMyTasks(user.id).then((tasks) => {
        const active = tasks.filter((t) => t.taskStatus !== 'completed');
        setTaskCount(active.length);
        setTaskUrgent(active.filter((t) => t.priority === 'urgent').length);
        setLoadingStates((p) => ({ ...p, tasks: false }));
      }).catch(() => { setTaskCount(0); setLoadingStates((p) => ({ ...p, tasks: false })); }) :
      Promise.resolve().then(() => { setTaskCount(0); setLoadingStates((p) => ({ ...p, tasks: false })); }),

      // Perfection
      perfectionService.getAll().then((items) => {
        const active = items.filter((i) => i.status === 'Submitted' || i.status === 'Under Review');
        setPerfectionCount(active.length);
        setLoadingStates((p) => ({ ...p, perfection: false }));
      }).catch(() => { setPerfectionCount(0); setLoadingStates((p) => ({ ...p, perfection: false })); }),

      // Valuation
      getValuationStats().then((stats) => {
        setValuationCount(stats.scheduled + stats.pendingApproval);
        setValuationUrgent(stats.overdue);
        setLoadingStates((p) => ({ ...p, valuation: false }));
      }).catch(() => { setValuationCount(0); setLoadingStates((p) => ({ ...p, valuation: false })); }),

      // Substitution
      getSubstitutionStats().then((stats) => {
        setSubstitutionCount(stats.pending + stats.underReview);
        setLoadingStates((p) => ({ ...p, substitution: false }));
      }).catch(() => { setSubstitutionCount(0); setLoadingStates((p) => ({ ...p, substitution: false })); }),

      // Archive Requests
      archiveRequestService.getAll().then((requests) => {
        const active = requests.filter((r) => r.requestStatus === 'pending' || r.requestStatus === 'approved');
        setArchiveCount(active.length);
        setArchiveUrgent(requests.filter((r) => r.requestStatus === 'checked_out').length);
        setLoadingStates((p) => ({ ...p, archive: false }));
      }).catch(() => { setArchiveCount(0); setLoadingStates((p) => ({ ...p, archive: false })); }),

      // Workflow Engine instances
      workflowInstanceService.getStats().then((stats) => {
        setEngineStats({ active: stats.active, escalated: stats.escalated });
        setLoadingStates((p) => ({ ...p, engine: false }));
      }).catch(() => { setEngineStats(null); setLoadingStates((p) => ({ ...p, engine: false })); }),

      // Registry Submissions
      registrySubmissionTrackerService.listAll().then((submissions) => {
        const active = submissions.filter((s) => s.submissionStatus !== 'Registered' && s.submissionStatus !== 'Rejected');
        setRegistryCount(active.length);
        // Overdue = Submitted for > 7 days
        const overdue = submissions.filter((s) => {
          if (s.submissionStatus !== 'Submitted' || !s.submittedAt) return false;
          return (Date.now() - new Date(s.submittedAt).getTime()) / (1000 * 60 * 60 * 24) > 7;
        });
        setRegistryUrgent(overdue.length);
        setLoadingStates((p) => ({ ...p, registry: false }));
      }).catch(() => { setRegistryCount(0); setLoadingStates((p) => ({ ...p, registry: false })); }),
    ]);

    setLastRefreshed(new Date());
    setRefreshing(false);
  }, [user?.id]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const totalActive =
    (approvalCount ?? 0) + (taskCount ?? 0) + (perfectionCount ?? 0) +
    (valuationCount ?? 0) + (substitutionCount ?? 0);
  const totalUrgent = approvalUrgent + taskUrgent + valuationUrgent;

  const cards: WorkflowCard[] = [
    {
      id: 'approvals',
      title: 'Approvals',
      description: 'Collateral approval requests awaiting your review or decision',
      href: '/approvals',
      icon: <ShieldCheck size={20} className="text-indigo-600" />,
      accentColor: 'bg-indigo-50',
      bgColor: 'bg-white',
      borderColor: 'border-indigo-100 hover:border-indigo-300',
      count: approvalCount,
      urgentCount: approvalUrgent,
      loading: loadingStates.approvals,
    },
    {
      id: 'tasks',
      title: 'My Tasks',
      description: 'Assigned workflow steps, document uploads, and pending actions',
      href: '/workflows/tasks',
      icon: <CheckSquare size={20} className="text-teal-600" />,
      accentColor: 'bg-teal-50',
      bgColor: 'bg-white',
      borderColor: 'border-teal-100 hover:border-teal-300',
      count: taskCount,
      urgentCount: taskUrgent,
      loading: loadingStates.tasks,
    },
    {
      id: 'perfection',
      title: 'Perfection Queue',
      description: 'Collateral perfection requests submitted for review and sign-off',
      href: '/approval-inbox',
      icon: <GitBranch size={20} className="text-violet-600" />,
      accentColor: 'bg-violet-50',
      bgColor: 'bg-white',
      borderColor: 'border-violet-100 hover:border-violet-300',
      count: perfectionCount,
      loading: loadingStates.perfection,
    },
    {
      id: 'valuation',
      title: 'Valuation Reviews',
      description: 'Scheduled and pending collateral valuations requiring action',
      href: '/workflows/valuation',
      icon: <TrendingUp size={20} className="text-amber-600" />,
      accentColor: 'bg-amber-50',
      bgColor: 'bg-white',
      borderColor: 'border-amber-100 hover:border-amber-300',
      count: valuationCount,
      urgentCount: valuationUrgent,
      loading: loadingStates.valuation,
    },
    {
      id: 'substitution',
      title: 'Substitution Requests',
      description: 'Collateral substitution requests under review or pending approval',
      href: '/workflows/substitution',
      icon: <ArrowLeftRight size={20} className="text-rose-600" />,
      accentColor: 'bg-rose-50',
      bgColor: 'bg-white',
      borderColor: 'border-rose-100 hover:border-rose-300',
      count: substitutionCount,
      loading: loadingStates.substitution,
    },
    {
      id: 'registry',
      title: 'Registry Submissions',
      description: 'Cross-collateral perfection submissions across BRELA, Lands Registry, TRA and more',
      href: '/workflows/registry-submissions',
      icon: <BookText size={20} className="text-cyan-600" />,
      accentColor: 'bg-cyan-50',
      bgColor: 'bg-white',
      borderColor: 'border-cyan-100 hover:border-cyan-300',
      count: registryCount,
      urgentCount: registryUrgent,
      loading: loadingStates.registry,
    },
    {
      id: 'archive',
      title: 'Archive Requests',
      description: 'Physical document archive and retrieval requests in progress',
      href: '/archive/request-workflow',
      icon: <FolderArchive size={20} className="text-slate-600" />,
      accentColor: 'bg-slate-50',
      bgColor: 'bg-white',
      borderColor: 'border-slate-100 hover:border-slate-300',
      count: archiveCount,
      urgentCount: archiveUrgent,
      loading: loadingStates.archive,
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Zap size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-800 text-foreground">Workflows</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            All assigned tasks, approvals, and workflow processes in one place
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => loadAll(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={13} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* Summary Strip */}
      <div className="flex flex-wrap items-center gap-3 mb-8 p-4 bg-gradient-to-r from-indigo-50 to-violet-50 rounded-2xl border border-indigo-100">
        <div className="flex items-center gap-2">
          <BarChart3 size={16} className="text-indigo-600" />
          <span className="text-sm font-600 text-indigo-800">Workload Summary</span>
        </div>
        <div className="w-px h-4 bg-indigo-200 hidden sm:block" />
        <div className="flex flex-wrap gap-2">
          <StatPill count={totalActive} label="total active" color="bg-indigo-100 text-indigo-700" />
          {totalUrgent > 0 && (
            <StatPill count={totalUrgent} label="urgent" color="bg-red-100 text-red-700" />
          )}
          <StatPill count={(approvalCount ?? 0) + (perfectionCount ?? 0)} label="pending approvals" color="bg-violet-100 text-violet-700" />
          <StatPill count={taskCount ?? 0} label="my tasks" color="bg-teal-100 text-teal-700" />
          {engineStats !== null && (
            <StatPill count={engineStats.active} label="engine instances" color="bg-blue-100 text-blue-700" />
          )}
          {(engineStats?.escalated ?? 0) > 0 && (
            <StatPill count={engineStats!.escalated} label="escalated" color="bg-orange-100 text-orange-700" />
          )}
        </div>
        <div className="ml-auto text-xs text-muted-foreground hidden sm:block">
          <Clock size={11} className="inline mr-1" />
          Updated {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>

      {/* Workflow Engine Instances Banner — shown when there are active instances */}
      {engineStats !== null && engineStats.active > 0 && (
        <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 flex items-center justify-center shrink-0">
              <Activity size={18} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-700 text-blue-900">
                {engineStats.active} Active Workflow Instance{engineStats.active !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-blue-700">
                {engineStats.escalated > 0
                  ? `${engineStats.escalated} escalated — requires attention`
                  : 'Running through configured workflow templates'}
              </p>
            </div>
          </div>
          <Link
            href="/workflows/instances"
            className="shrink-0 flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-600 rounded-lg transition-colors"
          >
            View Instances <ChevronRight size={12} />
          </Link>
        </div>
      )}

      {/* Workflow Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {cards.map((card) => (
          <WorkflowCardItem key={card.id} card={card} />
        ))}
      </div>

      {/* Engine Section */}
      <div className="border border-indigo-100 bg-gradient-to-br from-indigo-50/60 to-violet-50/40 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-6 h-6 rounded-lg bg-indigo-600 flex items-center justify-center">
            <Zap size={12} className="text-white" />
          </div>
          <h2 className="text-sm font-700 text-foreground">Workflow Engine</h2>
          <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-700 border border-indigo-200">Admin</span>
        </div>
        <p className="text-xs text-muted-foreground mb-4">
          Configure workflow templates, define steps and actors, set visual conditions, and monitor live instances.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Link
            href="/workflows/templates"
            className="flex items-center gap-3 p-4 bg-white border border-indigo-100 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
              <Layers size={16} className="text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 text-foreground">Workflow Templates</p>
              <p className="text-xs text-muted-foreground">Define steps, actors, and rules</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-indigo-600 transition-colors" />
          </Link>
          <Link
            href="/workflows/instances"
            className="flex items-center gap-3 p-4 bg-white border border-indigo-100 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
              <Activity size={16} className="text-violet-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 text-foreground">Active Instances</p>
              <p className="text-xs text-muted-foreground">Monitor and act on live workflows</p>
              {engineStats !== null && (
                <p className="text-[10px] font-700 text-violet-700 mt-0.5">{engineStats.active} active{engineStats.escalated > 0 ? ` · ${engineStats.escalated} escalated` : ''}</p>
              )}
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-violet-600 transition-colors" />
          </Link>
          <Link
            href="/workflows-admin"
            className="flex items-center gap-3 p-4 bg-white border border-indigo-100 rounded-xl hover:border-indigo-300 hover:shadow-sm transition-all group"
          >
            <div className="w-9 h-9 rounded-xl bg-amber-50 flex items-center justify-center shrink-0">
              <Zap size={16} className="text-amber-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-600 text-foreground">Admin Console</p>
              <p className="text-xs text-muted-foreground">Triggers, escalations, KPIs</p>
            </div>
            <ChevronRight size={14} className="text-muted-foreground group-hover:text-amber-600 transition-colors" />
          </Link>
        </div>
      </div>

      {/* Quick Links */}
      <div className="border border-border rounded-2xl overflow-hidden">
        <div className="px-5 py-3.5 bg-muted/40 border-b border-border">
          <h2 className="text-sm font-600 text-foreground">Quick Access</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 divide-x divide-y divide-border">
          {[
            { label: 'Perfection Workflow', href: '/perfection-workflow', icon: <GitBranch size={14} /> },
            { label: 'Document Approval', href: '/document-approval', icon: <CheckCircle2 size={14} /> },
            { label: 'Release Approval', href: '/release-approval', icon: <XCircle size={14} /> },
            { label: 'Archive Requests', href: '/archive/request-workflow', icon: <FolderArchive size={14} /> },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-2 px-4 py-3.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            >
              <span className="text-muted-foreground">{link.icon}</span>
              {link.label}
              <ChevronRight size={12} className="ml-auto opacity-50" />
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
