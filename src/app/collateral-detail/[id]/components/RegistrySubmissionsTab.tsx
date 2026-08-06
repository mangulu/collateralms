'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircle2, Clock, ArrowRight, XCircle, AlertTriangle, Loader2, RefreshCw, ExternalLink } from 'lucide-react';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import {
  registrySubmissionTrackerService,
  RegistrySubmission,
  RegistrySubmissionStatus,
} from '@/lib/supabase/registrySubmissionTrackerService';
import Icon from '@/components/ui/AppIcon';


// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  collateral: CollateralRecord;
}

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<RegistrySubmissionStatus, {
  label: string; color: string; bg: string; border: string; icon: React.ElementType;
}> = {
  Pending:      { label: 'Pending',      color: 'text-gray-600',  bg: 'bg-gray-100',  border: 'border-gray-300',  icon: Clock },
  Submitted:    { label: 'Submitted',    color: 'text-blue-700',  bg: 'bg-blue-50',   border: 'border-blue-300',  icon: ArrowRight },
  Acknowledged: { label: 'Acknowledged', color: 'text-amber-700', bg: 'bg-amber-50',  border: 'border-amber-300', icon: CheckCircle2 },
  Registered:   { label: 'Registered',   color: 'text-green-700', bg: 'bg-green-50',  border: 'border-green-300', icon: CheckCircle2 },
  Rejected:     { label: 'Rejected',     color: 'text-red-700',   bg: 'bg-red-50',    border: 'border-red-300',   icon: XCircle },
};

function StatusBadge({ status }: { status: RegistrySubmissionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color} ${cfg.border}`}>
      <Icon size={11} />
      {cfg.label}
    </span>
  );
}

// ─── Submission Status Card (read-only) ───────────────────────────────────────

function SubmissionStatusCard({ submission, collateralId }: { submission: RegistrySubmission; collateralId: string }) {
  return (
    <div className={`bg-white rounded-xl border shadow-sm p-4 ${
      submission.submissionStatus === 'Registered' ? 'border-green-200' :
      submission.submissionStatus === 'Rejected' ? 'border-red-200' : 'border-border'
    }`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-700 text-foreground">{submission.registryName}</span>
            <StatusBadge status={submission.submissionStatus} />
          </div>

          {/* Key dates */}
          <div className="mt-2 space-y-1">
            {submission.submittedAt && (
              <p className="text-xs text-muted-foreground">
                Submitted: <span className="text-foreground font-500">{new Date(submission.submittedAt).toLocaleDateString()}</span>
                {submission.submissionRef && (
                  <span className="ml-2 font-mono text-primary text-[11px]">Ref: {submission.submissionRef}</span>
                )}
              </p>
            )}
            {submission.acknowledgedAt && (
              <p className="text-xs text-muted-foreground">
                Acknowledged: <span className="text-foreground font-500">{new Date(submission.acknowledgedAt).toLocaleDateString()}</span>
                {submission.acknowledgementRef && (
                  <span className="ml-2 font-mono text-primary text-[11px]">Ref: {submission.acknowledgementRef}</span>
                )}
              </p>
            )}
            {submission.registeredAt && (
              <p className="text-xs text-muted-foreground">
                Registered: <span className="text-green-700 font-600">{new Date(submission.registeredAt).toLocaleDateString()}</span>
                {submission.registrationRef && (
                  <span className="ml-2 font-mono text-green-700 text-[11px]">Reg: {submission.registrationRef}</span>
                )}
              </p>
            )}
            {submission.rejectedAt && submission.rejectionReason && (
              <p className="text-xs text-red-600 mt-1 italic">{submission.rejectionReason}</p>
            )}
          </div>
        </div>

        {/* Link to full submission */}
        <Link
          href={`/workflows/registry-submissions`}
          className="shrink-0 flex items-center gap-1 text-xs text-primary hover:underline font-500 mt-0.5"
        >
          Full details <ExternalLink size={11} />
        </Link>
      </div>
    </div>
  );
}

// ─── Main Tab Component ───────────────────────────────────────────────────────

export default function RegistrySubmissionsTab({ collateral }: Props) {
  const [submissions, setSubmissions] = useState<RegistrySubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!collateral.id) return;
    setLoading(true);
    setError('');
    try {
      const data = await registrySubmissionTrackerService.listByCollateral(collateral.id);
      setSubmissions(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load submissions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [collateral.id]);

  const counts = {
    total: submissions.length,
    registered: submissions.filter((s) => s.submissionStatus === 'Registered').length,
    inProgress: submissions.filter((s) => s.submissionStatus !== 'Registered' && s.submissionStatus !== 'Rejected').length,
    rejected: submissions.filter((s) => s.submissionStatus === 'Rejected').length,
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Registry Submissions</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Current submission status for this collateral
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <RefreshCw size={12} /> Refresh
          </button>
          <Link
            href="/workflows/registry-submissions"
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 text-primary rounded-lg text-xs font-600 hover:bg-primary/20 transition-colors"
          >
            <ExternalLink size={12} /> Manage All Submissions
          </Link>
        </div>
      </div>

      {/* KPI Strip */}
      {submissions.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: counts.total, color: 'text-foreground', bg: 'bg-muted/30' },
            { label: 'Registered', value: counts.registered, color: 'text-green-700', bg: 'bg-green-50' },
            { label: 'In Progress', value: counts.inProgress, color: 'text-blue-700', bg: 'bg-blue-50' },
            { label: 'Rejected', value: counts.rejected, color: 'text-red-700', bg: 'bg-red-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`p-3 rounded-xl border border-border ${kpi.bg}`}>
              <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-xl font-800 ${kpi.color}`}>{kpi.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 size={20} className="animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {!loading && error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
          <AlertTriangle size={14} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Empty State */}
      {!loading && !error && submissions.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
          <div className="w-10 h-10 rounded-full bg-muted/50 flex items-center justify-center">
            <Clock size={18} className="text-muted-foreground" />
          </div>
          <div>
            <p className="text-sm font-600 text-foreground">No registry submissions yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Use <span className="font-600">Initiate Workflow → New Submission</span> in the toolbar above to create one.
            </p>
          </div>
          <Link
            href="/workflows/registry-submissions"
            className="flex items-center gap-1.5 text-xs text-primary hover:underline font-500"
          >
            View all submissions <ExternalLink size={11} />
          </Link>
        </div>
      )}

      {/* Submission Status Cards */}
      {!loading && !error && submissions.length > 0 && (
        <div className="space-y-3">
          {submissions.map((sub) => (
            <SubmissionStatusCard
              key={sub.id}
              submission={sub}
              collateralId={collateral.collateralId}
            />
          ))}
        </div>
      )}

      {/* Perfection notice */}
      {counts.registered > 0 && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
          <CheckCircle2 size={15} className="text-green-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-600 text-green-800">
              {counts.registered} of {counts.total} submission{counts.total !== 1 ? 's' : ''} reached Registered status
            </p>
            <p className="text-xs text-green-700 mt-0.5">
              Perfection Workflow can now be initiated for this collateral.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
