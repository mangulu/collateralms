'use client';
import React, { useState, useEffect, useCallback } from 'react';
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
  TrendingUp,
  Sparkles,
  History,
  Files,
  Download,
  FileImage,
  FileType2,
  File,
  RefreshCw,
} from 'lucide-react';
import Modal from '@/components/ui/Modal';
import Badge from '@/components/ui/Badge';
import { CollateralRecord as Collateral, CollateralStatus } from '@/lib/supabase/collateralService';
import Icon from '@/components/ui/AppIcon';
import ValuationHistoryTimeline from './ValuationHistoryTimeline';
import AIRiskNarrative from './AIRiskNarrative';
import { documentService, CollateralDocument } from '@/lib/supabase/documentService';


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

function getFileIcon(mimeType: string) {
  if (mimeType?.includes('pdf')) return <FileType2 size={16} className="text-red-500" />;
  if (mimeType?.includes('image')) return <FileImage size={16} className="text-blue-500" />;
  if (mimeType?.includes('word') || mimeType?.includes('document')) return <File size={16} className="text-indigo-500" />;
  return <FileText size={16} className="text-slate-500" />;
}

function DocumentsTab({ collateral }: { collateral: Collateral }) {
  const [docs, setDocs] = useState<CollateralDocument[]>([]);
  const [loading, setLoading] = useState(true);

  const loadDocs = useCallback(async () => {
    setLoading(true);
    const data = await documentService.getByCollateralId(collateral.id);
    setDocs(data);
    setLoading(false);
  }, [collateral.id]);

  useEffect(() => { loadDocs(); }, [loadDocs]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw size={18} className="animate-spin text-primary" />
      </div>
    );
  }

  if (docs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
          <Files size={20} className="text-muted-foreground" />
        </div>
        <p className="text-sm font-500 text-foreground">No documents uploaded</p>
        <p className="text-xs text-muted-foreground mt-1">
          Documents can be uploaded from the Collateral Detail page.
        </p>
      </div>
    );
  }

  // Group by document type
  const docsByType = docs.reduce<Record<string, CollateralDocument[]>>((acc, doc) => {
    const key = doc.documentType ?? 'Other';
    if (!acc[key]) acc[key] = [];
    acc[key].push(doc);
    return acc;
  }, {});

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-muted-foreground">{docs.length} document{docs.length !== 1 ? 's' : ''} attached</p>
      </div>
      {Object.entries(docsByType).map(([docType, typeDocs]) => (
        <div key={docType} className="rounded-lg border border-border/60 overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
            <FileText size={13} className="text-primary" />
            <span className="text-xs font-600 text-foreground">{docType}</span>
            <span className="ml-auto text-xs text-muted-foreground">{typeDocs.length} file{typeDocs.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="divide-y divide-border/40">
            {typeDocs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-3 py-2.5 bg-white hover:bg-muted/10 transition-colors">
                <div className="w-7 h-7 rounded flex items-center justify-center shrink-0">
                  {getFileIcon(doc.mimeType ?? '')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-500 text-foreground truncate">{doc.fileName}</p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">v{doc.version}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">{documentService.formatFileSize(doc.fileSize)}</span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground">{new Date(doc.createdAt).toLocaleDateString()}</span>
                    {doc.uploadedByName && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">{doc.uploadedByName}</span>
                      </>
                    )}
                  </div>
                  {doc.notes && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">{doc.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {doc.signedUrl ? (
                    <>
                      <a
                        href={doc.signedUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-primary bg-primary/5 hover:bg-primary/15 transition-colors"
                        title="View document"
                      >
                        <ExternalLink size={11} />
                        View
                      </a>
                      <a
                        href={doc.signedUrl}
                        download={doc.fileName}
                        className="flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium text-muted-foreground bg-muted/40 hover:bg-muted hover:text-foreground transition-colors"
                        title="Download document"
                      >
                        <Download size={11} />
                        Download
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground/50 italic">Unavailable</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function CollateralDetailModal({
  open,
  item,
  onClose,
  onEdit,
  onStatusChange,
}: CollateralDetailModalProps) {
  const [activeTab, setActiveTab] = useState<'details' | 'documents' | 'valuation' | 'ai-risk'>('details');

  if (!item) return null;

  const isOverdue =
    item.status === 'Overdue' ||
    (item.daysToDeadline !== null && item.daysToDeadline < 0);
  const isApproaching =
    item.daysToDeadline !== null &&
    item.daysToDeadline >= 0 &&
    item.daysToDeadline <= 7;

  const registryUrl = registryLinks[item.registry];

  // Financial health derived values
  const valuation = item.valuationAmount ?? null;
  const ltv = item.ltvRatio ?? null;
  const maxSecurable = item.maxSecurableAmount ?? (valuation && ltv ? valuation * ltv : null);
  const equity = item.availableEquity ?? null;
  const hasFinancialData = valuation != null || maxSecurable != null || equity != null;

  const ltvPct = ltv != null ? Math.round(ltv * 100) : null;
  const ltvColor =
    ltvPct == null ? 'text-muted-foreground' :
    ltvPct >= 80 ? 'text-red-600' :
    ltvPct >= 65 ? 'text-amber-600' : 'text-green-600';
  const ltvBg =
    ltvPct == null ? 'bg-muted/40' :
    ltvPct >= 80 ? 'bg-red-50 border-red-200' :
    ltvPct >= 65 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200';

  const equityPct = maxSecurable && maxSecurable > 0 && equity != null
    ? Math.round((equity / maxSecurable) * 100)
    : null;

  function fmtTSh(n: number | null | undefined) {
    if (n == null) return '—';
    if (n >= 1_000_000_000) return `TSh ${(n / 1_000_000_000).toFixed(2)}B`;
    if (n >= 1_000_000) return `TSh ${(n / 1_000_000).toFixed(2)}M`;
    return `TSh ${n.toLocaleString()}`;
  }

  const tabs = [
    { id: 'details', label: 'Details', icon: FileText },
    { id: 'documents', label: 'Documents', icon: Files },
    { id: 'valuation', label: 'Valuation History', icon: History },
    { id: 'ai-risk', label: 'AI Risk', icon: Sparkles },
  ] as const;

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
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-500">
            This collateral is overdue for perfection. Immediate action required —{' '}
            {item.daysToDeadline !== null && Math.abs(item.daysToDeadline)} days past the submission deadline.
          </p>
        </div>
      )}
      {isApproaching && !isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <Clock size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-500">
            Perfection deadline approaching — {item.daysToDeadline} days remaining to submit to {item.registry}.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-5 border-b border-border overflow-x-auto">
        {tabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-primary text-primary' :'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              <TabIcon size={13} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Details */}
      {activeTab === 'details' && (
        <>
          {/* Financial Health Assessment */}
          {hasFinancialData && (
            <div className="mb-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp size={14} className="text-primary" />
                <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider">
                  Financial Health Assessment
                </h4>
              </div>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-muted/30 border border-border rounded-lg p-3">
                  <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Collateral Valuation</p>
                  <p className="text-sm font-700 text-foreground font-mono leading-tight">{fmtTSh(valuation)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Appraised value</p>
                </div>
                <div className={`border rounded-lg p-3 ${ltvBg}`}>
                  <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">LTV Ratio</p>
                  <p className={`text-sm font-700 font-mono leading-tight ${ltvColor}`}>{ltvPct != null ? `${ltvPct}%` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{ltvPct == null ? 'Not set' : ltvPct >= 80 ? 'High risk' : ltvPct >= 65 ? 'Moderate' : 'Healthy'}</p>
                </div>
                <div className="bg-muted/30 border border-border rounded-lg p-3">
                  <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Max Securable</p>
                  <p className="text-sm font-700 text-foreground font-mono leading-tight">{fmtTSh(maxSecurable)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">Valuation × LTV</p>
                </div>
                <div className={`border rounded-lg p-3 ${equity == null ? 'bg-muted/30 border-border' : equity <= 0 ? 'bg-red-50 border-red-200' : equityPct != null && equityPct < 20 ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
                  <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide mb-1">Available Equity</p>
                  <p className={`text-sm font-700 font-mono leading-tight ${equity == null ? 'text-muted-foreground' : equity <= 0 ? 'text-red-600' : equityPct != null && equityPct < 20 ? 'text-amber-600' : 'text-green-600'}`}>{fmtTSh(equity)}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{equity == null ? 'Not calculated' : equity <= 0 ? 'Fully utilised' : equityPct != null ? `${equityPct}% free` : 'Remaining capacity'}</p>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left column */}
            <div>
              <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-2">Collateral Information</h4>
              <div className="bg-muted/30 rounded-lg px-3 py-1">
                <DetailRow label="Collateral ID" value={<span className="font-mono font-600 text-primary">{item.collateralId}</span>} icon={Shield} />
                <DetailRow label="Obligor" value={<div><p className="font-500">{item.obligor}</p><p className="text-xs text-muted-foreground font-mono">{item.obligorId}</p></div>} icon={Building2} />
                <DetailRow label="Collateral Type" value={item.type} icon={FileText} />
                <DetailRow label="Asset Description" value={<p className="text-xs leading-relaxed">{item.description}</p>} icon={FileText} />
                <DetailRow label="Collateral Value" value={<span className="font-mono font-600 text-base">TSh {item.valueTSh}</span>} icon={Building2} />
                <DetailRow label="Facility ID" value={<span className="font-mono text-xs">{item.facilityId}</span>} icon={FileText} />
                <DetailRow label="Assigned Officer" value={item.assignedOfficer} icon={User} />
              </div>
            </div>

            {/* Right column */}
            <div>
              <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-2">Perfection & Registry Status</h4>
              <div className="bg-muted/30 rounded-lg px-3 py-1 mb-4">
                <DetailRow label="Perfection Status" value={<Badge variant={statusBadgeMap[item.status]} label={item.status} />} icon={Shield} />
                <DetailRow label="Target Registry" value={item.registry !== 'N/A' && registryUrl ? (<a href={registryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-500">{item.registry}<ExternalLink size={11} /></a>) : (<span className="text-muted-foreground">{item.registry}</span>)} icon={Building2} />
                <DetailRow label="Execution Date" value={item.registrationDate || '—'} icon={Calendar} />
                <DetailRow label="Perfection Deadline" value={item.perfectionDeadline ? (<div className="flex items-center gap-2"><span className={isOverdue ? 'text-red-600 font-500' : isApproaching ? 'text-amber-600 font-500' : 'text-foreground'}>{item.perfectionDeadline}</span>{item.daysToDeadline !== null && (<span className={`text-xs px-1.5 py-0.5 rounded font-500 ${isOverdue ? 'bg-red-100 text-red-700' : isApproaching ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>{isOverdue ? `${Math.abs(item.daysToDeadline)}d overdue` : `${item.daysToDeadline}d remaining`}</span>)}</div>) : (<span className="text-muted-foreground text-xs">Not required</span>)} icon={Clock} />
                <DetailRow label="Requires Perfection" value={item.requiresPerfection ? (<span className="flex items-center gap-1 text-foreground"><CheckCircle2 size={13} className="text-green-600" /> Yes</span>) : (<span className="text-muted-foreground">No</span>)} icon={Shield} />
              </div>

              <h4 className="text-xs font-700 text-muted-foreground uppercase tracking-wider mb-2">Perfection Workflow</h4>
              <div className="space-y-2">
                {perfectionTimeline.map((step, idx) => (
                  <div key={`timeline-step-${idx}`} className="flex items-center gap-2.5">
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-green-100 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                      {step.done ? <CheckCircle2 size={12} /> : <span className="text-[10px] font-700">{idx + 1}</span>}
                    </div>
                    <p className={`text-xs ${step.done ? 'text-foreground font-500' : 'text-muted-foreground'}`}>{step.step}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <DocumentsTab collateral={item} />
      )}

      {/* Tab: Valuation History */}
      {activeTab === 'valuation' && (
        <ValuationHistoryTimeline
          collateralRecordId={item.id}
          collateralId={item.collateralId}
          currentValue={item.valuationAmount}
        />
      )}

      {/* Tab: AI Risk */}
      {activeTab === 'ai-risk' && (
        <AIRiskNarrative collateral={item} />
      )}

      {/* Footer Actions */}
      <div className="flex items-center justify-between pt-5 mt-5 border-t border-border">
        <p className="text-xs text-muted-foreground">
          Last modified: {item.updatedAt ? new Date(item.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'}
        </p>
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="px-4 py-2 border border-border rounded-md text-sm font-500 hover:bg-muted transition-colors">Close</button>
          <button onClick={() => onEdit(item)} className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95">
            <Pencil size={13} />
            Edit Record
          </button>
        </div>
      </div>
    </Modal>
  );
}