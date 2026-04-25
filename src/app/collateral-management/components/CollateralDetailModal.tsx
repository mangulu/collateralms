'use client';
import React from 'react';
import {
  Pencil,
  ExternalLink,
  Shield,
  FileText,
  Calendar,
  User,
  Building2,
  AlertTriangle,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { CollateralRecord as Collateral, CollateralStatus } from '@/lib/supabase/collateralService';
import Icon from '@/components/ui/AppIcon';


interface CollateralDetailModalProps {
  open: boolean;
  item: Collateral | null;
  onClose: () => void;
  onEdit: (item: Collateral) => void;
  onStatusChange?: (id: string, status: CollateralStatus) => void;
}

const statusBadgeMap: Record<CollateralStatus, 'perfected' | 'pending' | 'overdue' | 'draft' | 'released' | 'monitoring' | 'rejected' | 'under-review' | 'submitted'> = {
  Draft: 'draft',
  Submitted: 'submitted',
  'Under Review': 'under-review',
  Perfected: 'perfected',
  Monitoring: 'monitoring',
  Released: 'released',
  Overdue: 'overdue',
  Rejected: 'rejected',
};

const registryLinks: Record<string, string> = {
  BRELA: 'https://ors.brela.go.tz',
  'Lands Registry': 'https://ardhi.go.tz',
  TRA: 'https://www.tra.go.tz',
  DSE: 'https://www.dse.co.tz',
  TASAC: 'https://www.tasac.go.tz',
};

interface DetailRowProps {
  label: string;
  value: React.ReactNode;
  icon?: React.ElementType;
}

function DetailRow({ label, value, icon: Icon }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-0">
      {Icon && (
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={13} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-500 text-muted-foreground uppercase tracking-wide mb-0.5">
          {label}
        </p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

const perfectionTimeline = [
  { step: 'Security Document Executed', done: true },
  { step: 'Collateral Registered in CMS', done: true },
  { step: 'Legal Review & Approval', done: true },
  { step: 'Registry Submission Filed', done: false },
  { step: 'Registry Confirmation Received', done: false },
  { step: 'Perfection Confirmed', done: false },
];

export default function CollateralDetailModal({
  open,
  item,
  onClose,
  onEdit,
  onStatusChange,
}: CollateralDetailModalProps) {
  if (!item) return null;

  const isOverdue =
    item.status === 'Overdue' ||
    (item.daysToDeadline !== null && item.daysToDeadline < 0);
  const isApproaching =
    item.daysToDeadline !== null &&
    item.daysToDeadline >= 0 &&
    item.daysToDeadline <= 7;

  const registryUrl = registryLinks[item.registry];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Collateral Detail — ${item.collateralId}`}
      subtitle={`${item.obligor} · ${item.type}`}
      size="xl"
    >
      {/* Status Banner */}
      {isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-5">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-500">
            This collateral is overdue for perfection. Immediate action required —{' '}
            {item.daysToDeadline !== null && Math.abs(item.daysToDeadline)} days past the submission deadline.
          </p>
        </div>
      )}
      {isApproaching && !isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-5">
          <Clock size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-500">
            Perfection deadline approaching — {item.daysToDeadline} days remaining to submit to {item.registry}.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left column */}
        <div>
          <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-2">
            Collateral Information
          </h4>
          <div className="bg-muted/30 rounded-lg px-3 py-1">
            <DetailRow
              label="Collateral ID"
              value={<span className="font-mono font-600 text-primary">{item.collateralId}</span>}
              icon={Shield}
            />
            <DetailRow
              label="Obligor"
              value={
                <div>
                  <p className="font-500">{item.obligor}</p>
                  <p className="text-xs text-muted-foreground font-mono">{item.obligorId}</p>
                </div>
              }
              icon={Building2}
            />
            <DetailRow
              label="Collateral Type"
              value={item.type}
              icon={FileText}
            />
            <DetailRow
              label="Asset Description"
              value={<p className="text-xs leading-relaxed">{item.description}</p>}
              icon={FileText}
            />
            <DetailRow
              label="Collateral Value"
              value={
                <span className="font-mono font-600 text-base">
                  TSh {item.valueTSh}
                </span>
              }
              icon={Building2}
            />
            <DetailRow
              label="Facility ID"
              value={<span className="font-mono text-xs">{item.facilityId}</span>}
              icon={FileText}
            />
            <DetailRow
              label="Assigned Officer"
              value={item.assignedOfficer}
              icon={User}
            />
          </div>
        </div>

        {/* Right column */}
        <div>
          <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-2">
            Perfection & Registry Status
          </h4>
          <div className="bg-muted/30 rounded-lg px-3 py-1 mb-4">
            <DetailRow
              label="Perfection Status"
              value={
                <Badge
                  variant={statusBadgeMap[item.status]}
                  label={item.status}
                />
              }
              icon={Shield}
            />
            <DetailRow
              label="Target Registry"
              value={
                item.registry !== 'N/A' && registryUrl ? (
                  <a
                    href={registryUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-primary hover:underline font-500"
                  >
                    {item.registry}
                    <ExternalLink size={11} />
                  </a>
                ) : (
                  <span className="text-muted-foreground">{item.registry}</span>
                )
              }
              icon={Building2}
            />
            <DetailRow
              label="Execution Date"
              value={item.registrationDate || '—'}
              icon={Calendar}
            />
            <DetailRow
              label="Perfection Deadline"
              value={
                item.perfectionDeadline ? (
                  <div className="flex items-center gap-2">
                    <span
                      className={
                        isOverdue
                          ? 'text-red-600 font-500'
                          : isApproaching
                          ? 'text-amber-600 font-500' :'text-foreground'
                      }
                    >
                      {item.perfectionDeadline}
                    </span>
                    {item.daysToDeadline !== null && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded font-500 ${
                          isOverdue
                            ? 'bg-red-100 text-red-700'
                            : isApproaching
                            ? 'bg-amber-100 text-amber-700' :'bg-green-100 text-green-700'
                        }`}
                      >
                        {isOverdue
                          ? `${Math.abs(item.daysToDeadline)}d overdue`
                          : `${item.daysToDeadline}d remaining`}
                      </span>
                    )}
                  </div>
                ) : (
                  <span className="text-muted-foreground text-xs">
                    Not required — no external registry submission needed
                  </span>
                )
              }
              icon={Clock}
            />
            <DetailRow
              label="Requires Perfection"
              value={
                item.requiresPerfection ? (
                  <span className="flex items-center gap-1 text-foreground">
                    <CheckCircle2 size={13} className="text-green-600" /> Yes
                  </span>
                ) : (
                  <span className="text-muted-foreground">No (Guarantee / FDR)</span>
                )
              }
              icon={Shield}
            />
          </div>

          {/* Perfection timeline */}
          <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-2">
            Perfection Workflow
          </h4>
          <div className="space-y-2">
            {perfectionTimeline.map((step, idx) => (
              <div
                key={`timeline-step-${idx}`}
                className="flex items-center gap-2.5"
              >
                <div
                  className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                    step.done
                      ? 'bg-green-100 text-green-600' :'bg-muted text-muted-foreground'
                  }`}
                >
                  {step.done ? (
                    <CheckCircle2 size={12} />
                  ) : (
                    <span className="text-[10px] font-700">{idx + 1}</span>
                  )}
                </div>
                <p
                  className={`text-xs ${
                    step.done ? 'text-foreground font-500' : 'text-muted-foreground'
                  }`}
                >
                  {step.step}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-5 mt-5 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Last modified: 25 Apr 2026, 10:14 AM · by A. Mwangi
        </p>
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-border rounded-md text-sm font-500 hover:bg-muted transition-colors"
          >
            Close
          </button>
          <button
            onClick={() => onEdit(item)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95"
          >
            <Pencil size={13} />
            Edit Record
          </button>
        </div>
      </div>
    </Modal>
  );
}