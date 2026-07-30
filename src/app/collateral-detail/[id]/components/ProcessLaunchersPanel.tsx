'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Workflow,
  Unlock,
  FolderOpen,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Loader2,
  X,
  Send,
  CalendarClock,
  Scale,
  ArrowLeftRight,
  Shield,
} from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { perfectionService } from '@/lib/supabase/perfectionService';
import { archiveRequestService } from '@/lib/supabase/archiveService';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface ProcessLaunchersProps {
  collateral: CollateralRecord;
  onProcessStarted?: () => void;
}

type ProcessType = 'perfection' | 'release' | 'record-request' | null;

// ─── Confirm Modal ────────────────────────────────────────────────────────────

interface ConfirmModalProps {
  processType: ProcessType;
  collateral: CollateralRecord;
  onConfirm: () => void;
  onClose: () => void;
  submitting: boolean;
}

function ConfirmModal({ processType, collateral, onConfirm, onClose, submitting }: ConfirmModalProps) {
  const [notes, setNotes] = useState('');

  const config = {
    perfection: {
      title: 'Start Perfection Process',
      icon: Workflow,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
      btnBg: 'bg-blue-600 hover:bg-blue-700',
      description: `Submit ${collateral.collateralId} to the Perfection Workflow for review and registry registration at ${collateral.registry}.`,
      notesLabel: 'Submission notes (optional)',
      confirmLabel: 'Submit for Perfection',
    },
    release: {
      title: 'Initiate Release Process',
      icon: Unlock,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
      btnBg: 'bg-amber-600 hover:bg-amber-700',
      description: `Initiate a release/discharge process for ${collateral.collateralId}. This will route to the Batch Release module for approval.`,
      notesLabel: 'Release reason / notes',
      confirmLabel: 'Initiate Release',
    },
    'record-request': {
      title: 'Raise Record Request',
      icon: FolderOpen,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
      btnBg: 'bg-purple-600 hover:bg-purple-700',
      description: `Request physical file retrieval for ${collateral.collateralId} from the archive vault.`,
      notesLabel: 'Purpose / reason for retrieval',
      confirmLabel: 'Raise Request',
    },
  };

  if (!processType) return null;
  const cfg = config[processType];
  const Icon = cfg.icon;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-lg ${cfg.iconBg} flex items-center justify-center`}>
              <Icon size={18} className={cfg.iconColor} />
            </div>
            <h2 className="text-base font-700 text-foreground">{cfg.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {/* Collateral summary */}
          <div className="rounded-lg bg-muted/40 border border-border/60 px-4 py-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Collateral ID</span>
              <span className="text-xs font-700 font-mono text-foreground">{collateral.collateralId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Obligor</span>
              <span className="text-xs font-500 text-foreground">{collateral.obligor}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Type</span>
              <span className="text-xs font-500 text-foreground">{collateral.type}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Registry</span>
              <span className="text-xs font-500 text-foreground">{collateral.registry}</span>
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed">{cfg.description}</p>

          <div>
            <label className="block text-xs font-600 text-foreground mb-1.5">
              {cfg.notesLabel}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Add context or instructions…"
              className="w-full border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-500 text-foreground hover:bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={() => onConfirm()}
            disabled={submitting}
            className={`flex items-center gap-2 px-4 py-2 text-sm font-600 text-white rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${cfg.btnBg}`}
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            {submitting ? 'Processing…' : cfg.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ProcessLaunchersPanel({ collateral, onProcessStarted }: ProcessLaunchersProps) {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const [activeModal, setActiveModal] = useState<ProcessType>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!activeModal || !user) return;
    setSubmitting(true);

    try {
      if (activeModal === 'perfection') {
        await perfectionService.create(
          {
            collateralRecordId: collateral.id,
            collateralId: collateral.collateralId,
            obligor: collateral.obligor,
            collateralType: collateral.type,
            registry: collateral.registry,
            perfectionDeadline: collateral.perfectionDeadline ?? '',
            priority: 'Normal',
          },
          user.id,
          userProfile?.full_name ?? user.email ?? 'Unknown'
        );
        toast.success('Perfection request submitted — redirecting to workflow');
        setActiveModal(null);
        onProcessStarted?.();
        router.push('/perfection-workflow');
      } else if (activeModal === 'release') {
        toast.success('Redirecting to Release module');
        setActiveModal(null);
        router.push(`/batch-release?collateral=${encodeURIComponent(collateral.collateralId)}`);
      } else if (activeModal === 'record-request') {
        await archiveRequestService.create({
          collateralId: collateral.id,
          requestedBy: user.id,
          purpose: 'Record retrieval from collateral profile',
          expectedReturnDate: undefined,
        });
        toast.success('Record request raised — check Archive › Request Workflow');
        setActiveModal(null);
        onProcessStarted?.();
      }
    } catch (err: any) {
      toast.error(err?.message ?? 'Failed to start process. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Determine process availability
  const canPerfect =
    collateral.requiresPerfection &&
    !['Perfected', 'Released'].includes(collateral.status);

  const canRelease = ['Perfected', 'Monitoring'].includes(collateral.status);

  const processes = [
    {
      key: 'perfection' as ProcessType,
      label: 'Start Perfection',
      sublabel: canPerfect ? `Submit to ${collateral.registry}` : 'Not applicable',
      icon: Workflow,
      iconBg: 'bg-blue-50',
      iconColor: 'text-blue-600',
      borderColor: 'border-blue-200',
      hoverBg: 'hover:bg-blue-50/80',
      available: canPerfect,
      statusIcon: canPerfect
        ? <Clock size={11} className="text-amber-500" />
        : <CheckCircle2 size={11} className="text-green-500" />,
      statusText: canPerfect ? 'Pending' : collateral.status,
      onClick: () => setActiveModal('perfection'),
    },
    {
      key: 'release' as ProcessType,
      label: 'Initiate Release',
      sublabel: canRelease ? 'Discharge & release collateral' : 'Requires Perfected status',
      icon: Unlock,
      iconBg: 'bg-amber-50',
      iconColor: 'text-amber-600',
      borderColor: 'border-amber-200',
      hoverBg: 'hover:bg-amber-50/80',
      available: canRelease,
      statusIcon: canRelease
        ? <AlertTriangle size={11} className="text-amber-500" />
        : <Clock size={11} className="text-muted-foreground" />,
      statusText: canRelease ? 'Ready' : 'Locked',
      onClick: () => setActiveModal('release'),
    },
    {
      key: 'record-request' as ProcessType,
      label: 'Record Request',
      sublabel: 'Request physical file from archive',
      icon: FolderOpen,
      iconBg: 'bg-purple-50',
      iconColor: 'text-purple-600',
      borderColor: 'border-purple-200',
      hoverBg: 'hover:bg-purple-50/80',
      available: true,
      statusIcon: <CheckCircle2 size={11} className="text-green-500" />,
      statusText: 'Available',
      onClick: () => setActiveModal('record-request'),
    },
  ];

  // Contextual workflow launchers — navigate with collateral pre-filled
  const workflowLaunchers = [
    {
      label: 'Schedule Valuation',
      icon: CalendarClock,
      iconBg: 'bg-indigo-50',
      iconColor: 'text-indigo-600',
      borderColor: 'border-indigo-200',
      hoverBg: 'hover:bg-indigo-50/80',
      href: `/valuation-workflow?collateralId=${encodeURIComponent(collateral.id)}`,
    },
    {
      label: 'Add Covenant',
      icon: Scale,
      iconBg: 'bg-teal-50',
      iconColor: 'text-teal-600',
      borderColor: 'border-teal-200',
      hoverBg: 'hover:bg-teal-50/80',
      href: `/covenant-tracking?facilityId=${encodeURIComponent(collateral.facilityId)}`,
    },
    {
      label: 'New Substitution',
      icon: ArrowLeftRight,
      iconBg: 'bg-orange-50',
      iconColor: 'text-orange-600',
      borderColor: 'border-orange-200',
      hoverBg: 'hover:bg-orange-50/80',
      href: `/collateral-substitution?collateralId=${encodeURIComponent(collateral.id)}&facilityId=${encodeURIComponent(collateral.facilityId)}`,
    },
    {
      label: 'Add Policy',
      icon: Shield,
      iconBg: 'bg-green-50',
      iconColor: 'text-green-600',
      borderColor: 'border-green-200',
      hoverBg: 'hover:bg-green-50/80',
      href: `/insurance-tracking?collateralId=${encodeURIComponent(collateral.id)}`,
    },
  ];

  return (
    <>
      <div className="bg-white rounded-xl border border-border shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2 px-5 py-4 border-b border-border bg-gradient-to-r from-primary/5 to-primary/10">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <Workflow size={14} className="text-primary" />
          </div>
          <h3 className="text-xs font-700 text-foreground uppercase tracking-wider">Processes</h3>
        </div>

        <div className="p-4 space-y-2.5">
          {processes.map((proc) => {
            const ProcIcon = proc.icon;
            return (
              <button
                key={proc.key}
                onClick={() => proc.available && proc.onClick()}
                disabled={!proc.available}
                className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                  proc.available
                    ? `${proc.borderColor} ${proc.hoverBg} cursor-pointer`
                    : 'border-border bg-muted/20 cursor-not-allowed opacity-60'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg ${proc.available ? proc.iconBg : 'bg-muted'} flex items-center justify-center shrink-0`}
                >
                  <ProcIcon size={15} className={proc.available ? proc.iconColor : 'text-muted-foreground'} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-600 text-foreground">{proc.label}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{proc.sublabel}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {proc.statusIcon}
                  <span className="text-[10px] font-500 text-muted-foreground">{proc.statusText}</span>
                  {proc.available && <ChevronRight size={12} className="text-muted-foreground ml-0.5" />}
                </div>
              </button>
            );
          })}
        </div>

        {/* Workflow Launchers Section */}
        <div className="border-t border-border">
          <div className="px-5 py-3 bg-gray-50/60">
            <p className="text-[10px] font-700 text-muted-foreground uppercase tracking-wider">Initiate Workflows</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-2">
            {workflowLaunchers.map((wf) => {
              const WfIcon = wf.icon;
              return (
                <button
                  key={wf.label}
                  onClick={() => router.push(wf.href)}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-left transition-all cursor-pointer ${wf.borderColor} ${wf.hoverBg}`}
                >
                  <div className={`w-7 h-7 rounded-md ${wf.iconBg} flex items-center justify-center shrink-0`}>
                    <WfIcon size={13} className={wf.iconColor} />
                  </div>
                  <span className="text-xs font-600 text-foreground leading-tight">{wf.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Confirm Modal */}
      {activeModal && (
        <ConfirmModal
          processType={activeModal}
          collateral={collateral}
          onConfirm={handleConfirm}
          onClose={() => setActiveModal(null)}
          submitting={submitting}
        />
      )}
    </>
  );
}
