'use client';
import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  Play,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  SkipForward,
  ChevronDown,
  ChevronUp,
  Loader2,
  Info,
  Layers,
  Activity,
  XCircle,
  Check,
} from 'lucide-react';
import {
  workflowMigrationService,
  MigrationQueueItem,
  MigrationSummary,
} from '@/lib/supabase/workflowMigrationService';
import { workflowTemplateService, WorkflowTemplate } from '@/lib/supabase/workflowEngineService';
import { usePermissions } from '@/lib/rbac';
import { useAuth } from '@/contexts/AuthContext';
import AccessDenied from '@/components/AccessDenied';

const ADMIN_ROLES = ['system_admin', 'legal_manager', 'credit_manager'];

// ─── Status Badge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    pending_review: { label: 'Pending Review', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    auto_migrated: { label: 'Auto-Migrated', cls: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
    manually_migrated: { label: 'Manually Migrated', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
    skipped: { label: 'Skipped', cls: 'bg-slate-100 text-slate-600 border-slate-200' },
  };
  const s = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${s.cls}`}>
      {s.label}
    </span>
  );
}

// ─── Confidence Bar ───────────────────────────────────────────────────────────

function ConfidenceBar({ value }: { value: number }) {
  const color = value >= 80 ? 'bg-emerald-500' : value >= 50 ? 'bg-amber-500' : 'bg-red-400';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.min(value, 100)}%` }} />
      </div>
      <span className="text-xs font-medium text-muted-foreground w-8 text-right">{value.toFixed(0)}%</span>
    </div>
  );
}

// ─── Summary KPI Strip ────────────────────────────────────────────────────────

function SummaryStrip({ summary, loading }: { summary: MigrationSummary | null; loading: boolean }) {
  const kpis = [
    { label: 'Total Instances', value: summary?.totalOldInstances, icon: <Layers size={14} className="text-slate-500" />, color: 'text-slate-700' },
    { label: 'Already Migrated', value: summary?.alreadyMigrated, icon: <CheckCircle2 size={14} className="text-emerald-500" />, color: 'text-emerald-700' },
    { label: 'Auto-Migrated', value: summary?.autoMigrated, icon: <Activity size={14} className="text-blue-500" />, color: 'text-blue-700' },
    { label: 'Pending Review', value: summary?.pendingReview, icon: <AlertTriangle size={14} className="text-amber-500" />, color: 'text-amber-700' },
    { label: 'Manually Done', value: summary?.manuallyMigrated, icon: <Check size={14} className="text-violet-500" />, color: 'text-violet-700' },
    { label: 'Skipped', value: summary?.skipped, icon: <SkipForward size={14} className="text-slate-400" />, color: 'text-slate-600' },
  ];
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
      {kpis.map((k) => (
        <div key={k.label} className="bg-white border border-border rounded-xl px-4 py-3 flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">{k.icon}</div>
          <div>
            <p className="text-[11px] text-muted-foreground leading-tight">{k.label}</p>
            <p className={`text-lg font-bold ${k.color}`}>
              {loading ? <Loader2 size={13} className="animate-spin inline" /> : (k.value ?? 0)}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Review Row ───────────────────────────────────────────────────────────────

interface ReviewRowProps {
  item: MigrationQueueItem;
  templates: WorkflowTemplate[];
  onConfirm: (item: MigrationQueueItem, templateId: string, stepId: string, notes: string) => Promise<void>;
  onSkip: (item: MigrationQueueItem, notes: string) => Promise<void>;
}

function ReviewRow({ item, templates, onConfirm, onSkip }: ReviewRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState(item.suggestedTemplateId ?? '');
  const [selectedStepId, setSelectedStepId] = useState(item.suggestedStepId ?? '');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;
  const steps = selectedTemplate?.steps ?? [];

  // Reset step when template changes
  useEffect(() => {
    if (selectedTemplateId !== item.suggestedTemplateId) {
      setSelectedStepId(steps[0]?.id ?? '');
    }
  }, [selectedTemplateId]);

  const handleConfirm = async () => {
    if (!selectedTemplateId || !selectedStepId) return;
    setSaving(true);
    try {
      await onConfirm(item, selectedTemplateId, selectedStepId, notes);
    } finally {
      setSaving(false);
    }
  };

  const handleSkip = async () => {
    setSaving(true);
    try {
      await onSkip(item, notes || 'Skipped by admin');
    } finally {
      setSaving(false);
    }
  };

  const isDone =
    item.migrationStatus === 'auto_migrated' ||
    item.migrationStatus === 'manually_migrated' ||
    item.migrationStatus === 'skipped';

  return (
    <div className={`border rounded-xl overflow-hidden transition-all ${isDone ? 'border-slate-100 bg-slate-50/50' : 'border-amber-100 bg-white'}`}>
      {/* Row header */}
      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-muted/30 transition-colors"
        onClick={() => !isDone && setExpanded((v) => !v)}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">
              {item.instance?.referenceLabel ?? item.instanceId.slice(0, 8) + '…'}
            </span>
            <StatusBadge status={item.migrationStatus} />
          </div>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Instance ID: {item.instanceId} · Type: {item.instance?.referenceType ?? '—'}
          </p>
        </div>
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-28 hidden sm:block">
            <ConfidenceBar value={item.matchConfidence} />
          </div>
          {!isDone && (
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
          {isDone && <CheckCircle2 size={16} className="text-emerald-500" />}
        </div>
      </div>

      {/* Expanded review panel */}
      {expanded && !isDone && (
        <div className="border-t border-amber-100 px-4 py-4 bg-amber-50/30 space-y-4">
          {/* Ambiguity reason */}
          {item.ambiguityReason && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
              <Info size={13} className="mt-0.5 shrink-0" />
              <span>{item.ambiguityReason}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Template selector */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Select Template <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">— Choose template —</option>
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.workflowType})
                  </option>
                ))}
              </select>
            </div>

            {/* Step selector */}
            <div>
              <label className="block text-xs font-medium text-foreground mb-1.5">
                Place at Step <span className="text-red-500">*</span>
              </label>
              <select
                value={selectedStepId}
                onChange={(e) => setSelectedStepId(e.target.value)}
                disabled={!selectedTemplateId || steps.length === 0}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
              >
                <option value="">— Choose step —</option>
                {steps.map((s) => (
                  <option key={s.id} value={s.id}>
                    Step {s.stepOrder}: {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-medium text-foreground mb-1.5">Migration Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Add context about this migration decision…"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 justify-end">
            <button
              onClick={handleSkip}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-slate-600 border border-border rounded-lg hover:bg-slate-50 transition-colors disabled:opacity-50"
            >
              <SkipForward size={14} />
              Skip
            </button>
            <button
              onClick={handleConfirm}
              disabled={saving || !selectedTemplateId || !selectedStepId}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
              Confirm Migration
            </button>
          </div>
        </div>
      )}

      {/* Done summary */}
      {isDone && (item.confirmedTemplateId || item.migrationNotes) && (
        <div className="border-t border-slate-100 px-4 py-2.5 flex items-center gap-2 text-xs text-muted-foreground">
          <Info size={12} />
          {item.migrationNotes ?? `Migrated to template ${item.confirmedTemplateId?.slice(0, 8)}…`}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function MigrationToolContent() {
  const { role, loading: permsLoading } = usePermissions();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [queueItems, setQueueItems] = useState<MigrationQueueItem[]>([]);
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [runningMigration, setRunningMigration] = useState(false);
  const [migrationResult, setMigrationResult] = useState<{ autoMigrated: number; pendingReview: number; totalOldInstances: number } | null>(null);
  const [activeTab, setActiveTab] = useState<'all' | 'pending_review' | 'auto_migrated' | 'manually_migrated' | 'skipped'>('pending_review');
  const [error, setError] = useState<string | null>(null);

  const isAuthorized = !permsLoading && ADMIN_ROLES.includes(role ?? '');

  const loadData = useCallback(async () => {
    setLoadingData(true);
    setError(null);
    try {
      const [tmpl, queue, summ] = await Promise.all([
        workflowTemplateService.getAll(),
        workflowMigrationService.getQueue(),
        workflowMigrationService.getSummary(),
      ]);
      setTemplates(tmpl);

      // Enrich queue items with instance data (basic join via queue)
      setQueueItems(queue);
      setSummary(summ);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load migration data');
    } finally {
      setLoadingData(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthorized) loadData();
  }, [isAuthorized, loadData]);

  const handleRunMigration = async () => {
    if (!userId) return;
    setRunningMigration(true);
    setError(null);
    setMigrationResult(null);
    try {
      const result = await workflowMigrationService.runMigration(templates, userId);
      setMigrationResult({
        autoMigrated: result.autoMigrated,
        pendingReview: result.pendingReview,
        totalOldInstances: result.totalOldInstances,
      });
      await loadData();
    } catch (e: any) {
      setError(e.message ?? 'Migration run failed');
    } finally {
      setRunningMigration(false);
    }
  };

  const handleConfirm = async (
    item: MigrationQueueItem,
    templateId: string,
    stepId: string,
    notes: string
  ) => {
    if (!userId) return;
    const template = templates.find((t) => t.id === templateId);
    const step = template?.steps.find((s) => s.id === stepId);
    if (!template || !step) return;
    await workflowMigrationService.confirmManualMigration({
      queueItemId: item.id,
      instanceId: item.instanceId,
      templateId,
      stepId,
      template,
      step,
      reviewedBy: userId,
      notes,
    });
    await loadData();
  };

  const handleSkip = async (item: MigrationQueueItem, notes: string) => {
    if (!userId) return;
    await workflowMigrationService.skipItem(item.id, userId, notes);
    await loadData();
  };

  const filteredItems =
    activeTab === 'all'
      ? queueItems
      : queueItems.filter((i) => i.migrationStatus === activeTab);

  const tabs: { key: typeof activeTab; label: string; count: number }[] = [
    { key: 'pending_review', label: 'Pending Review', count: queueItems.filter((i) => i.migrationStatus === 'pending_review').length },
    { key: 'auto_migrated', label: 'Auto-Migrated', count: queueItems.filter((i) => i.migrationStatus === 'auto_migrated').length },
    { key: 'manually_migrated', label: 'Manually Done', count: queueItems.filter((i) => i.migrationStatus === 'manually_migrated').length },
    { key: 'skipped', label: 'Skipped', count: queueItems.filter((i) => i.migrationStatus === 'skipped').length },
    { key: 'all', label: 'All', count: queueItems.length },
  ];

  if (permsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 size={24} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isAuthorized) return <AccessDenied />;

  return (
    <div className="px-4 sm:px-6 lg:px-8 xl:px-10 py-6 max-w-screen-xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <ArrowRightLeft size={16} className="text-white" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">Hybrid Migration Tool</h1>
          </div>
          <p className="text-sm text-muted-foreground max-w-2xl">
            Auto-migrate old workflow instances to the new engine. Clear-status instances are migrated automatically;
            ambiguous ones are flagged here for manual review.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={loadData}
            disabled={loadingData}
            className="flex items-center gap-1.5 px-3 py-2 bg-white border border-border rounded-lg text-sm text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={14} className={loadingData ? 'animate-spin' : ''} />
            Refresh
          </button>
          <button
            onClick={handleRunMigration}
            disabled={runningMigration || loadingData || templates.length === 0}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
          >
            {runningMigration ? (
              <Loader2 size={15} className="animate-spin" />
            ) : (
              <Play size={15} />
            )}
            {runningMigration ? 'Running…' : 'Run Migration'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <XCircle size={15} />
          {error}
        </div>
      )}

      {/* Migration result banner */}
      {migrationResult && (
        <div className="flex items-start gap-3 p-4 mb-5 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 size={18} className="text-emerald-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-emerald-800">Migration run complete</p>
            <p className="text-xs text-emerald-700 mt-0.5">
              Scanned <strong>{migrationResult.totalOldInstances}</strong> unmigrated instances —{' '}
              <strong>{migrationResult.autoMigrated}</strong> auto-migrated,{' '}
              <strong>{migrationResult.pendingReview}</strong> flagged for review.
            </p>
          </div>
          <button onClick={() => setMigrationResult(null)} className="ml-auto text-emerald-500 hover:text-emerald-700">
            <XCircle size={15} />
          </button>
        </div>
      )}

      {/* Summary KPIs */}
      <SummaryStrip summary={summary} loading={loadingData} />

      {/* How it works info box */}
      {queueItems.length === 0 && !loadingData && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6">
          <div className="flex items-start gap-3">
            <Info size={18} className="text-blue-500 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-blue-800 mb-1">How the hybrid migration works</p>
              <ul className="text-xs text-blue-700 space-y-1 list-disc list-inside">
                <li>Click <strong>Run Migration</strong> to scan all workflow instances that have no step records.</li>
                <li>Instances with a clear status (e.g. <em>pending → Step 1</em>, <em>under_review → Step 2</em>) are auto-migrated with ≥80% confidence.</li>
                <li>Ambiguous instances (low confidence or no matching template) are placed in the review queue below.</li>
                <li>For each flagged instance, select the correct template and step, then confirm migration.</li>
                <li>You can also skip instances that should not be migrated.</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Queue tabs + list */}
      {queueItems.length > 0 && (
        <div className="bg-white border border-border rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex items-center gap-0 border-b border-border overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-indigo-600 text-indigo-600' :'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
                {tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                      activeTab === tab.key ? 'bg-indigo-100 text-indigo-700' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* List */}
          <div className="p-4 space-y-3">
            {loadingData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 size={22} className="animate-spin text-muted-foreground" />
              </div>
            ) : filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Clock size={32} className="text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">No items in this category</p>
              </div>
            ) : (
              filteredItems.map((item) => (
                <ReviewRow
                  key={item.id}
                  item={item}
                  templates={templates}
                  onConfirm={handleConfirm}
                  onSkip={handleSkip}
                />
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty state when no queue and not loading */}
      {queueItems.length === 0 && !loadingData && summary && summary.totalOldInstances === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle2 size={40} className="text-emerald-400 mb-3" />
          <p className="text-base font-semibold text-foreground">All instances are migrated</p>
          <p className="text-sm text-muted-foreground mt-1">No old workflow instances found that need migration.</p>
        </div>
      )}
    </div>
  );
}
