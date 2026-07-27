'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  ArrowLeft, Pencil, ExternalLink, Shield, FileText, Calendar, User, Building2,
  AlertTriangle, CheckCircle2, Clock, Files, History, ShieldAlert, RefreshCw,
  Activity, PieChart, BookOpen, TrendingUp, Layers, MapPin, ChevronRight,
} from 'lucide-react';
import { toast } from 'sonner';
import Badge from '@/components/ui/Badge';
import { CollateralRecord, CollateralStatus, auditService, collateralService } from '@/lib/supabase/collateralService';
import { collateralLinkService, CollateralUtilization } from '@/lib/supabase/collateralLinkService';
import AddEditCollateralModal from '@/app/collateral-management/components/AddEditCollateralModal';
import { useAuth } from '@/contexts/AuthContext';
import CollateralUtilizationTab from './CollateralUtilizationTab';
import QuickActionsPanel from './QuickActionsPanel';
import CollateralHistoryTab from './CollateralHistoryTab';
import GeoSection from './GeoSection';
import DocumentsSection from './DocumentsSection';
import AuditTrailSection from './AuditTrailSection';
import LegalSignOffSection from './LegalSignOffSection';
import RiskComplianceSidebarCard from './RiskComplianceSidebarCard';

// ─── Types ────────────────────────────────────────────────────────────────────

interface CollateralDetailContentProps {
  collateral: CollateralRecord | null;
  isLoading: boolean;
  error: string | null;
  onBack: () => void;
  onRefresh: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

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

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon: IconComponent }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        {IconComponent && React.createElement(IconComponent, { size: 14, className: 'text-primary' })}
      </div>
      <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">{title}</h2>
    </div>
  );
}

function DetailRow({ label, value, icon: RowIcon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-0">
      {RowIcon && (
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          {React.createElement(RowIcon, { size: 13, className: 'text-muted-foreground' })}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-500 text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KPIStrip({ collateral, utilization }: { collateral: CollateralRecord; utilization: CollateralUtilization | null }) {
  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;

  const deadlineLabel = collateral.daysToDeadline === null
    ? 'N/A'
    : isOverdue
      ? `${Math.abs(collateral.daysToDeadline)}d overdue`
      : `${collateral.daysToDeadline}d left`;

  const deadlineColor = isOverdue ? 'text-red-600' : isApproaching ? 'text-amber-600' : 'text-green-600';
  const activeCharges = utilization ? utilization.linkedLoans.filter(l => l.status === 'ACTIVE').length : null;
  const utilizationPct = utilization ? utilization.utilizationPercentage : null;

  const kpis = [
    { label: 'Collateral Value', value: collateral.valueTSh ? `TSh ${collateral.valueTSh}` : '—', icon: TrendingUp, color: 'text-primary', bg: 'bg-primary/5' },
    { label: 'Utilization', value: utilizationPct != null ? `${utilizationPct.toFixed(1)}%` : '—', icon: PieChart, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Active Charges', value: activeCharges != null ? String(activeCharges) : '—', icon: Layers, color: 'text-purple-600', bg: 'bg-purple-50' },
    { label: 'Days to Deadline', value: deadlineLabel, icon: Clock, color: deadlineColor, bg: isOverdue ? 'bg-red-50' : isApproaching ? 'bg-amber-50' : 'bg-green-50' },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
      {kpis.map((kpi) => (
        <div key={kpi.label} className={`flex items-center gap-3 p-4 rounded-xl border border-border ${kpi.bg}`}>
          <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
            <kpi.icon size={16} className={kpi.color} />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-sm font-700 truncate ${kpi.color}`}>{kpi.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CollateralDetailContent({
  collateral,
  isLoading,
  error,
  onBack,
  onRefresh,
}: CollateralDetailContentProps) {
  const { user } = useAuth();
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'charges' | 'documents' | 'history'>('profile');
  const [utilization, setUtilization] = useState<CollateralUtilization | null>(null);

  useEffect(() => {
    if (!collateral?.id) return;
    collateralLinkService.getUtilization(collateral.id).then(setUtilization).catch(() => {});
  }, [collateral?.id]);

  const handleSave = async (data: Partial<CollateralRecord>) => {
    if (!collateral) return;
    setSaving(true);
    try {
      const updated = await collateralService.update(collateral.id, data);
      if (updated) {
        await auditService.log({
          collateralRecordId: collateral.id,
          collateralId: collateral.collateralId,
          action: 'updated',
          message: `Collateral ${collateral.collateralId} updated`,
          detail: `${collateral.obligor} · ${collateral.type}`,
          performedBy: user?.id,
          performedByName: user?.email ?? '',
        });
        toast.success('Collateral record updated');
        setEditOpen(false);
        onRefresh();
      }
    } catch {
      toast.error('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
        <div className="flex items-center justify-center py-32">
          <div className="flex flex-col items-center gap-3">
            <svg className="animate-spin w-8 h-8 text-primary" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <p className="text-sm text-muted-foreground">Loading collateral record…</p>
          </div>
        </div>
      </div>
    );
  }

  // ── Error ──
  if (error || !collateral) {
    return (
      <div className="px-6 lg:px-8 xl:px-10 py-6 max-w-screen-2xl mx-auto">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors">
          <ArrowLeft size={15} /> Back to Collateral Registry
        </button>
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle size={24} className="text-red-500" />
          </div>
          <div className="text-center">
            <p className="text-base font-600 text-foreground">Record Not Found</p>
            <p className="text-sm text-muted-foreground mt-1">{error ?? 'The requested collateral record could not be found.'}</p>
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded-md text-sm font-500 hover:bg-primary/90 transition-colors">
            Return to Registry
          </button>
        </div>
      </div>
    );
  }

  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;
  const registryUrl = registryLinks[collateral.registry];

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft size={14} /> Collateral Registry
          </button>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-700 text-foreground font-mono">{collateral.collateralId}</h1>
            <Badge variant={statusBadgeMap[collateral.status]} label={collateral.status} />
          </div>
          <p className="text-sm text-muted-foreground mt-1">{collateral.obligor} · {collateral.type} · {collateral.registry}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <Link href={`/collateral-library/${collateral.id}`}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">
            <BookOpen size={13} /> View in Library
          </Link>
          <button onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={() => setEditOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-md text-sm font-600 hover:bg-primary/90 transition-all active:scale-95">
            <Pencil size={13} /> Edit Record
          </button>
        </div>
      </div>

      {/* Status Banners */}
      {isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-500">
            This collateral is overdue for perfection — {collateral.daysToDeadline !== null && Math.abs(collateral.daysToDeadline)} days past the submission deadline. Immediate action required.
          </p>
        </div>
      )}
      {isApproaching && !isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <Clock size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-500">
            Perfection deadline approaching — {collateral.daysToDeadline} days remaining to submit to {collateral.registry}.
          </p>
        </div>
      )}

      {/* KPI Strip */}
      <KPIStrip collateral={collateral} utilization={utilization} />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border">
        {[
          { key: 'profile', label: 'Profile', icon: Shield },
          { key: 'charges', label: 'Charges & Loans', icon: PieChart },
          { key: 'documents', label: 'Documents & History', icon: Files },
          { key: 'history', label: 'History', icon: History },
        ].map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key as 'profile' | 'charges' | 'documents' | 'history')}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-500 border-b-2 transition-colors -mb-px ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}>
            <tab.icon size={13} /> {tab.label}
          </button>
        ))}
      </div>

      {/* Tab: Profile */}
      {activeTab === 'profile' && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <SectionHeader title="Collateral Information" icon={Shield} />
                  <div className="bg-muted/30 rounded-lg px-3 py-1">
                    <DetailRow label="Collateral ID" value={<span className="font-mono font-600 text-primary">{collateral.collateralId}</span>} icon={Shield} />
                    <DetailRow label="Obligor" value={
                      <div>
                        {collateral.obligorRefId ? (
                          <Link
                            href={`/obligors/${collateral.obligorRefId}`}
                            className="font-500 text-primary hover:underline flex items-center gap-1"
                          >
                            {collateral.obligor}
                            <ExternalLink size={11} className="shrink-0" />
                          </Link>
                        ) : (
                          <p className="font-500">{collateral.obligor}</p>
                        )}
                        <p className="text-xs text-muted-foreground font-mono">{collateral.obligorId}</p>
                      </div>
                    } icon={Building2} />
                    <DetailRow label="Collateral Type" value={collateral.type} icon={FileText} />
                    <DetailRow label="Asset Description" value={<p className="text-xs leading-relaxed">{collateral.description}</p>} icon={FileText} />
                    <DetailRow label="Collateral Value" value={<span className="font-mono font-600 text-base">TSh {collateral.valueTSh}</span>} icon={Building2} />
                    <DetailRow label="Facility ID" value={<span className="font-mono text-xs">{collateral.facilityId}</span>} icon={FileText} />
                    <DetailRow label="Assigned Officer" value={collateral.assignedOfficer} icon={User} />
                  </div>
                </div>
                <div>
                  <SectionHeader title="Perfection & Registry" icon={CheckCircle2} />
                  <div className="bg-muted/30 rounded-lg px-3 py-1">
                    <DetailRow label="Perfection Status" value={<Badge variant={statusBadgeMap[collateral.status]} label={collateral.status} />} icon={Shield} />
                    <DetailRow
                      label="Target Registry"
                      value={collateral.registry !== 'N/A' && registryUrl ? (
                        <a href={registryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-500">
                          {collateral.registry} <ExternalLink size={11} />
                        </a>
                      ) : <span className="text-muted-foreground">{collateral.registry}</span>}
                      icon={Building2}
                    />
                    <DetailRow label="Execution Date" value={collateral.registrationDate || '—'} icon={Calendar} />
                    <DetailRow
                      label="Perfection Deadline"
                      value={collateral.perfectionDeadline ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={isOverdue ? 'text-red-600 font-500' : isApproaching ? 'text-amber-600 font-500' : 'text-foreground'}>{collateral.perfectionDeadline}</span>
                          {collateral.daysToDeadline !== null && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-500 ${isOverdue ? 'bg-red-100 text-red-700' : isApproaching ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                              {isOverdue ? `${Math.abs(collateral.daysToDeadline)}d overdue` : `${collateral.daysToDeadline}d remaining`}
                            </span>
                          )}
                        </div>
                      ) : <span className="text-muted-foreground text-xs">Not required</span>}
                      icon={Clock}
                    />
                    <DetailRow
                      label="Requires Perfection"
                      value={collateral.requiresPerfection ? (
                        <span className="flex items-center gap-1 text-foreground"><CheckCircle2 size={13} className="text-green-600" /> Yes</span>
                      ) : <span className="text-muted-foreground">No (Guarantee / FDR)</span>}
                      icon={Shield}
                    />
                    <DetailRow label="Created" value={collateral.createdAt ? new Date(collateral.createdAt).toLocaleString() : '—'} icon={Calendar} />
                    <DetailRow label="Last Updated" value={collateral.updatedAt ? new Date(collateral.updatedAt).toLocaleString() : '—'} icon={Calendar} />
                  </div>
                </div>
              </div>
            </div>
            <GeoSection collateral={collateral} />
          </div>

          <div className="space-y-6">
            <QuickActionsPanel collateral={collateral} onSignOffComplete={onRefresh} />
            <RiskComplianceSidebarCard collateral={collateral} />
            <div className="bg-white rounded-xl border border-border shadow-card p-5">
              <SectionHeader title="Quick Links" icon={ExternalLink} />
              <div className="space-y-2">
                {[
                  { label: 'Collateral Documents', href: '/collateral-documents', icon: Files },
                  { label: 'Perfection Workflow', href: '/perfection-workflow', icon: Activity },
                  { label: 'Fraud Prevention', href: '/fraud-prevention', icon: ShieldAlert },
                  { label: 'Security & Compliance Trail', href: '/audit-trail', icon: History },
                  { label: 'Geomapping', href: '/geomapping', icon: MapPin },
                ].map((link) => (
                  <Link key={link.href} href={link.href} className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <link.icon size={13} className="text-primary" />
                    </div>
                    <span className="text-sm text-foreground group-hover:text-primary transition-colors">{link.label}</span>
                    <ChevronRight size={13} className="ml-auto text-muted-foreground group-hover:text-primary transition-colors" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tab: Charges & Loans */}
      {activeTab === 'charges' && <CollateralUtilizationTab collateral={collateral} />}

      {/* Tab: Documents & History */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <DocumentsSection collateral={collateral} />
          <LegalSignOffSection collateral={collateral} />
          <AuditTrailSection collateral={collateral} />
        </div>
      )}

      {/* Tab: History */}
      {activeTab === 'history' && <CollateralHistoryTab collateral={collateral} />}

      {/* Edit Modal */}
      <AddEditCollateralModal
        open={editOpen}
        editItem={collateral}
        onClose={() => setEditOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}