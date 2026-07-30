'use client';
import React, { useState, useEffect } from 'react';
import { X, Play, ChevronDown, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  workflowTemplateService,
  workflowInstanceService,
  WorkflowTemplate,
} from '@/lib/supabase/workflowEngineService';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';

interface InitiateWorkflowModalProps {
  open: boolean;
  collateral: CollateralRecord | null;
  onClose: () => void;
  onLaunched?: (instanceId: string) => void;
}

const PRIORITY_OPTIONS = [
  { value: 'normal', label: 'Normal' },
  { value: 'high', label: 'High' },
  { value: 'urgent', label: 'Urgent' },
];

export default function InitiateWorkflowModal({
  open,
  collateral,
  onClose,
  onLaunched,
}: InitiateWorkflowModalProps) {
  const { user } = useAuth();
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('normal');
  const [dueDate, setDueDate] = useState('');
  const [launching, setLaunching] = useState(false);
  const [launched, setLaunched] = useState(false);
  const [launchedInstanceId, setLaunchedInstanceId] = useState('');

  // Load active templates on open
  useEffect(() => {
    if (!open) return;
    setLoadingTemplates(true);
    setSelectedTemplateId('');
    setNotes('');
    setPriority('normal');
    setDueDate('');
    setLaunched(false);
    setLaunchedInstanceId('');
    workflowTemplateService
      .getAll()
      .then((all) => setTemplates(all.filter((t) => t.isActive)))
      .catch(() => toast.error('Failed to load workflow templates'))
      .finally(() => setLoadingTemplates(false));
  }, [open]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  const handleLaunch = async () => {
    if (!selectedTemplateId || !collateral || !user) return;
    setLaunching(true);
    try {
      const instance = await workflowInstanceService.start({
        templateId: selectedTemplateId,
        referenceType: 'collateral',
        referenceId: collateral.id,
        referenceLabel: `${collateral.collateralId} – ${collateral.obligor}`,
        startedBy: user.id,
        metadata: {
          collateralId: collateral.collateralId,
          collateralType: collateral.type,
          obligor: collateral.obligor,
          valueTSh: collateral.valueTSh,
          priority,
          notes: notes.trim() || null,
          dueDate: dueDate || null,
          initiatedFrom: 'collateral_management',
        },
      });
      setLaunchedInstanceId(instance.id);
      setLaunched(true);
      toast.success('Workflow instance launched successfully');
      onLaunched?.(instance.id);
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to launch workflow');
    } finally {
      setLaunching(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="text-base font-700 text-foreground">Initiate Workflow</h2>
            {collateral && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {collateral.collateralId} · {collateral.obligor}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
          {launched ? (
            /* Success state */
            <div className="flex flex-col items-center justify-center py-8 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <div>
                <p className="text-base font-700 text-foreground">Workflow Launched</p>
                <p className="text-sm text-muted-foreground mt-1">
                  {selectedTemplate?.name} has been started for{' '}
                  <span className="font-600">{collateral?.collateralId}</span>.
                </p>
              </div>
              <a
                href="/workflows/instances"
                className="text-sm text-primary hover:underline font-500"
              >
                View in Workflow Instances →
              </a>
            </div>
          ) : (
            <>
              {/* Collateral summary */}
              {collateral && (
                <div className="bg-muted/50 rounded-lg px-4 py-3 text-sm space-y-1">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Collateral</span>
                    <span className="font-600 text-foreground">{collateral.collateralId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Type</span>
                    <span className="text-foreground">{collateral.type}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Obligor</span>
                    <span className="text-foreground">{collateral.obligor}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Value</span>
                    <span className="text-foreground">
                      TSh {Number(collateral.valueTSh).toLocaleString()}
                    </span>
                  </div>
                </div>
              )}

              {/* Template selector */}
              <div className="space-y-1.5">
                <label className="block text-sm font-600 text-foreground">
                  Workflow Template <span className="text-red-500">*</span>
                </label>
                {loadingTemplates ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                    <Loader2 size={14} className="animate-spin" />
                    Loading templates…
                  </div>
                ) : templates.length === 0 ? (
                  <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
                    <AlertCircle size={14} />
                    No active workflow templates found. Enable a template in Workflow Settings.
                  </div>
                ) : (
                  <div className="relative">
                    <select
                      value={selectedTemplateId}
                      onChange={(e) => setSelectedTemplateId(e.target.value)}
                      className="w-full appearance-none border border-border rounded-md px-3 py-2 pr-8 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 text-foreground"
                    >
                      <option value="">— Select a template —</option>
                      {templates.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </select>
                    <ChevronDown
                      size={14}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                    />
                  </div>
                )}

                {/* Template description + steps preview */}
                {selectedTemplate && (
                  <div className="mt-2 bg-primary/5 border border-primary/15 rounded-lg px-4 py-3 space-y-2">
                    <p className="text-xs text-muted-foreground">{selectedTemplate.description}</p>
                    {selectedTemplate.steps.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-xs font-600 text-foreground">
                          Steps ({selectedTemplate.steps.length})
                        </p>
                        <ol className="space-y-1">
                          {selectedTemplate.steps.map((s, i) => (
                            <li key={s.id} className="flex items-start gap-2 text-xs text-muted-foreground">
                              <span className="w-4 h-4 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[10px] font-700 shrink-0 mt-0.5">
                                {i + 1}
                              </span>
                              <span>
                                <span className="font-500 text-foreground">{s.name}</span>
                                {s.actors.length > 0 && (
                                  <span className="text-muted-foreground">
                                    {' '}· {s.actors.map((a) => a.actorLabel).join(', ')}
                                  </span>
                                )}
                                {s.slaHours && (
                                  <span className="text-muted-foreground"> · {s.slaHours}h SLA</span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Priority */}
              <div className="space-y-1.5">
                <label className="block text-sm font-600 text-foreground">Priority</label>
                <div className="flex gap-2">
                  {PRIORITY_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setPriority(opt.value)}
                      className={`flex-1 py-2 rounded-md text-sm font-500 border transition-colors ${
                        priority === opt.value
                          ? opt.value === 'urgent' ?'bg-red-500 text-white border-red-500'
                            : opt.value === 'high' ?'bg-amber-500 text-white border-amber-500' :'bg-primary text-white border-primary' :'bg-white text-muted-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due date */}
              <div className="space-y-1.5">
                <label className="block text-sm font-600 text-foreground">
                  Target Due Date <span className="text-muted-foreground font-400">(optional)</span>
                </label>
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="block text-sm font-600 text-foreground">
                  Initial Notes <span className="text-muted-foreground font-400">(optional)</span>
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  placeholder="Add any context or instructions for the first step actor…"
                  className="w-full border border-border rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
                />
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-border bg-muted/30">
          {launched ? (
            <button
              onClick={onClose}
              className="px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-colors"
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleLaunch}
                disabled={!selectedTemplateId || launching || loadingTemplates}
                className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {launching ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Launching…
                  </>
                ) : (
                  <>
                    <Play size={14} />
                    Launch Workflow
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
