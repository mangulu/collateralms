'use client';
import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Settings2, Layers, Activity, Zap, BarChart3, ChevronRight, RefreshCw, Loader2, AlertTriangle, Clock, Shield, Play, ArrowRightLeft } from 'lucide-react';
import { workflowInstanceService, workflowTemplateService } from '@/lib/supabase/workflowEngineService';
import { workflowTriggerProcessorService } from '@/lib/supabase/workflowTriggerProcessorService';
import { usePermissions } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

const ADMIN_ROLES = ['system_admin', 'legal_manager', 'credit_manager'];

interface AdminCard {
  id: string;
  title: string;
  description: string;
  href: string;
  icon: React.ReactNode;
  accentColor: string;
  bgColor: string;
  borderColor: string;
  stat: string | number | null;
  statLabel: string;
  loading: boolean;
  badge?: string;
  badgeColor?: string;
}

function AdminCardItem({ card }: { card: AdminCard }) {
  return (
    <Link
      href={card.href}
      className={`group relative flex flex-col gap-4 p-5 rounded-2xl border-2 ${card.borderColor} ${card.bgColor} hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer`}
    >
      {card.badge && (
        <span className={`absolute top-3 right-3 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${card.badgeColor ?? 'bg-blue-500 text-white'}`}>
          {card.badge}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${card.accentColor} shrink-0`}>
          {card.icon}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground leading-tight">{card.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{card.description}</p>
        </div>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {card.loading ? (
            <Loader2 size={14} className="animate-spin text-muted-foreground" />
          ) : (
            <span className="text-2xl font-bold text-foreground">{card.stat ?? '—'}</span>
          )}
          {!card.loading && card.stat !== null && (
            <span className="text-xs text-muted-foreground">{card.statLabel}</span>
          )}
        </div>
        <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 group-hover:gap-2 transition-all">
          Open <ChevronRight size={13} />
        </div>
      </div>
    </Link>
  );
}

export default function WorkflowsAdminDashboardContent() {
  const { role, loading: permsLoading } = usePermissions();

  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [instanceCount, setInstanceCount] = useState<number | null>(null);
  const [escalatedCount, setEscalatedCount] = useState<number | null>(null);
  const [lastJobStatus, setLastJobStatus] = useState<string | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const isAuthorized = !permsLoading && ADMIN_ROLES.includes(role ?? '');

  const loadStats = useCallback(async (silent = false) => {
    if (!silent) setLoadingStats(true);
    else setRefreshing(true);

    await Promise.allSettled([
      workflowTemplateService.getAll().then((t) => setTemplateCount(t.length)).catch(() => setTemplateCount(0)),
      workflowInstanceService.getAll().then((instances) => {
        setInstanceCount(instances.filter((i) => i.instanceStatus === 'active').length);
        setEscalatedCount(instances.filter((i) => i.instanceStatus === 'escalated').length);
      }).catch(() => { setInstanceCount(0); setEscalatedCount(0); }),
      workflowTriggerProcessorService.getRecentLogs(1).then((logs) => {
        if (logs.length > 0) setLastJobStatus(logs[0].status);
      }).catch(() => setLastJobStatus(null)),
    ]);

    setLoadingStats(false);
    setRefreshing(false);
    setLastRefreshed(new Date());
  }, []);

  useEffect(() => {
    if (isAuthorized) loadStats();
  }, [isAuthorized, loadStats]);

  if (permsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthorized) {
    return <AccessDenied />;
  }

  const cards: AdminCard[] = [
    {
      id: 'templates',
      title: 'Workflow Templates',
      description: 'Design and manage workflow templates, steps, actors, and escalation rules',
      href: '/workflows-admin/templates',
      icon: <Layers size={20} className="text-violet-600" />,
      accentColor: 'bg-violet-50',
      bgColor: 'bg-white',
      borderColor: 'border-violet-100 hover:border-violet-300',
      stat: templateCount,
      statLabel: 'templates',
      loading: loadingStats,
    },
    {
      id: 'trigger-rules',
      title: 'Auto-Trigger Rules',
      description: 'Configure conditions that automatically initiate workflow instances',
      href: '/workflows-admin/trigger-rules',
      icon: <Zap size={20} className="text-amber-600" />,
      accentColor: 'bg-amber-50',
      bgColor: 'bg-white',
      borderColor: 'border-amber-100 hover:border-amber-300',
      stat: null,
      statLabel: 'rules',
      loading: false,
    },
    {
      id: 'escalation',
      title: 'Escalation Configuration',
      description: 'Set SLA thresholds, escalation paths, and notification rules for all templates',
      href: '/workflows-admin/escalation',
      icon: <AlertTriangle size={20} className="text-orange-600" />,
      accentColor: 'bg-orange-50',
      bgColor: 'bg-white',
      borderColor: 'border-orange-100 hover:border-orange-300',
      stat: escalatedCount,
      statLabel: 'escalated now',
      loading: loadingStats,
      badge: (escalatedCount ?? 0) > 0 ? `${escalatedCount} escalated` : undefined,
      badgeColor: 'bg-orange-500 text-white',
    },
    {
      id: 'instances',
      title: 'Active Instances',
      description: 'System-wide view of all running workflow instances across all collaterals',
      href: '/workflows-admin/instances',
      icon: <Activity size={20} className="text-blue-600" />,
      accentColor: 'bg-blue-50',
      bgColor: 'bg-white',
      borderColor: 'border-blue-100 hover:border-blue-300',
      stat: instanceCount,
      statLabel: 'active',
      loading: loadingStats,
    },
    {
      id: 'kpis',
      title: 'Efficiency KPIs',
      description: 'Cycle times, SLA compliance rates, bottleneck analysis, and role workload metrics',
      href: '/workflows-admin/kpis',
      icon: <BarChart3 size={20} className="text-emerald-600" />,
      accentColor: 'bg-emerald-50',
      bgColor: 'bg-white',
      borderColor: 'border-emerald-100 hover:border-emerald-300',
      stat: null,
      statLabel: 'metrics',
      loading: false,
    },
    {
      id: 'trigger-processor',
      title: 'Trigger Processor',
      description: 'Run the auto-trigger job, view execution logs, and monitor rule match results',
      href: '/workflows-admin/trigger-processor',
      icon: <Play size={20} className="text-teal-600" />,
      accentColor: 'bg-teal-50',
      bgColor: 'bg-white',
      borderColor: 'border-teal-100 hover:border-teal-300',
      stat: lastJobStatus ? (lastJobStatus === 'success' ? '✓' : '✗') : null,
      statLabel: 'last run',
      loading: false,
      badge: lastJobStatus === 'success' ? 'Last run OK' : lastJobStatus === 'error' ? 'Last run failed' : undefined,
      badgeColor: lastJobStatus === 'success' ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white',
    },
    {
      id: 'migration',
      title: 'Hybrid Migration Tool',
      description: 'Migrate old workflow instances to the new engine — auto-migrate clear ones, review ambiguous ones',
      href: '/workflows-admin/migration',
      icon: <ArrowRightLeft size={20} className="text-indigo-600" />,
      accentColor: 'bg-indigo-50',
      bgColor: 'bg-white',
      borderColor: 'border-indigo-100 hover:border-indigo-300',
      stat: null,
      statLabel: 'pending',
      loading: false,
      badge: 'One-time',
      badgeColor: 'bg-indigo-500 text-white',
    },
  ];

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-8">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center">
              <Settings2 size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Workflows Administration</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Design, configure, and monitor the workflow engine — templates, triggers, escalations, and KPIs
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg text-xs text-slate-600">
            <Shield size={12} />
            Admin access only
          </div>
          <button
            onClick={() => loadStats(true)}
            disabled={refreshing}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Summary KPI strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
        {[
          { label: 'Templates', value: templateCount, icon: <Layers size={14} className="text-violet-500" />, color: 'text-violet-700' },
          { label: 'Active Instances', value: instanceCount, icon: <Activity size={14} className="text-blue-500" />, color: 'text-blue-700' },
          { label: 'Escalated', value: escalatedCount, icon: <AlertTriangle size={14} className="text-orange-500" />, color: 'text-orange-700' },
          { label: 'Last Job', value: lastJobStatus ?? 'N/A', icon: <Clock size={14} className="text-teal-500" />, color: 'text-teal-700' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
              {kpi.icon}
            </div>
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.color}`}>
                {loadingStats ? <Loader2 size={14} className="animate-spin inline" /> : kpi.value ?? '—'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Module Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        {cards.map((card) => (
          <AdminCardItem key={card.id} card={card} />
        ))}
      </div>

      {/* Last refreshed */}
      <p className="text-xs text-muted-foreground text-right">
        Last refreshed: {lastRefreshed.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
      </p>
    </div>
  );
}
