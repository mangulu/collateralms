'use client';
import React from 'react';
import { useRouter } from 'next/navigation';
import { X, CheckCircle2, FileUp, GitBranch, ShieldCheck, RefreshCw, ChevronRight, Sparkles } from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';

interface NextStepsBannerProps {
  collateral: CollateralRecord;
  onDismiss: () => void;
}

interface NextStep {
  icon: React.ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  href: string;
  color: string;
  bg: string;
  border: string;
}

export default function NextStepsBanner({ collateral, onDismiss }: NextStepsBannerProps) {
  const router = useRouter();

  const steps: NextStep[] = [
    {
      icon: <FileUp size={16} />,
      title: 'Attach Required Documents',
      description: 'Upload title deed, valuation report, and other mandatory documents.',
      actionLabel: 'Upload Docs',
      href: `/collateral-management`,
      color: 'text-blue-700',
      bg: 'bg-blue-50',
      border: 'border-blue-200',
    },
    ...(collateral.requiresPerfection ? [{
      icon: <GitBranch size={16} />,
      title: 'Submit for Perfection',
      description: `Perfection deadline: ${collateral.perfectionDeadline || 'not set'}. Submit the perfection request now.`,
      actionLabel: 'Start Perfection',
      href: '/perfection-workflow',
      color: 'text-violet-700',
      bg: 'bg-violet-50',
      border: 'border-violet-200',
    }] : []),
    {
      icon: <ShieldCheck size={16} />,
      title: 'Request Document Approval',
      description: 'Once documents are uploaded, route them for officer review and approval.',
      actionLabel: 'Go to Approvals',
      href: '/document-approval',
      color: 'text-emerald-700',
      bg: 'bg-emerald-50',
      border: 'border-emerald-200',
    },
    {
      icon: <RefreshCw size={16} />,
      title: 'Schedule Valuation',
      description: 'Initiate a valuation workflow to confirm the collateral market value.',
      actionLabel: 'Valuation Workflow',
      href: '/valuation-workflow',
      color: 'text-amber-700',
      bg: 'bg-amber-50',
      border: 'border-amber-200',
    },
  ];

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4 sm:p-6" style={{ backgroundColor: 'rgba(0,0,0,0.45)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden" style={{ border: '1px solid var(--izou-border)' }}>
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-5 pb-4" style={{ borderBottom: '1px solid var(--izou-border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 100%)' }}>
              <Sparkles size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">Collateral Registered!</h2>
              <p className="text-xs text-muted-foreground mt-0.5">
                <span className="font-mono font-600">{collateral.collateralId}</span> · {collateral.type} · {collateral.obligor}
              </p>
            </div>
          </div>
          <button
            onClick={onDismiss}
            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={14} className="text-emerald-500" />
            <p className="text-sm font-600 text-foreground">Here are your required next steps:</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {steps.map((step, idx) => (
              <div
                key={idx}
                className={`flex items-start gap-3 p-3.5 rounded-xl border ${step.bg} ${step.border} cursor-pointer hover:opacity-90 transition-opacity group`}
                onClick={() => { onDismiss(); router.push(step.href); }}
              >
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-white shadow-sm ${step.color}`}>
                  {step.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-xs font-700 ${step.color}`}>{step.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{step.description}</p>
                </div>
                <ChevronRight size={14} className={`shrink-0 mt-1 ${step.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5" style={{ borderTop: '1px solid var(--izou-border)', background: '#f8fafc' }}>
          <p className="text-xs text-muted-foreground">Tasks have been added to your <strong>My Tasks</strong> queue.</p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { onDismiss(); router.push('/my-tasks'); }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-600 hover:bg-primary/90 transition-all active:scale-95"
            >
              View My Tasks
              <ChevronRight size={12} />
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 border border-border rounded-lg text-xs font-500 text-muted-foreground hover:bg-muted transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
