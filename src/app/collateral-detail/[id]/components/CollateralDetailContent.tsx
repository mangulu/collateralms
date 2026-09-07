'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, ExternalLink, Shield, FileText, Calendar, User, Building2, AlertTriangle, CheckCircle2, Clock, Files, History, ShieldAlert, RefreshCw, Activity, PieChart, TrendingUp, Layers, MapPin, ChevronRight, Banknote, Star, AlertCircle, GitBranch } from 'lucide-react';
import Badge from '@/components/ui/Badge';
import { CollateralRecord, CollateralStatus } from '@/lib/supabase/collateralService';
import { collateralLinkService, CollateralUtilization } from '@/lib/supabase/collateralLinkService';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import { Loan } from '@/lib/supabase/loanService';
import { useAuth } from '@/contexts/AuthContext';
import CollateralUtilizationTab from './CollateralUtilizationTab';
import GeoSection from './GeoSection';
import DocumentsSection from './DocumentsSection';
import LegalSignOffSection from './LegalSignOffSection';
import RiskComplianceSidebarCard from './RiskComplianceSidebarCard';
import HistoryAuditTab from './HistoryAuditTab';
import MandatoryDocumentsCard from './MandatoryDocumentsCard';
import CollateralActionToolbar from './CollateralActionToolbar';
import CollateralActivityTimeline from './CollateralActivityTimeline';
import { ArchiveStatusBadge } from './CollateralActionToolbar';
import RegistrySubmissionsTab from './RegistrySubmissionsTab';
import ActionsPanel from './ActionsPanel';

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

// ─── Next Recommended Action Banner ──────────────────────────────────────────

function NextRecommendedActionBanner({ collateral }: { collateral: CollateralRecord }) {
  const s = collateral.status;
  const isOverdue = s === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 14;

  let recommendation: { text: string; href?: string; linkLabel?: string; color: string; bg: string; border: string; icon: React.ReactNode } | null = null;

  if (s === 'Draft') {
    recommendation = {
      text: 'This collateral is in Draft — upload required documents and submit for perfection to proceed.',
      href: '/perfection-workflow', linkLabel: 'Start Perfection →',
      color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
      icon: <Shield size={14} className="text-blue-500 shrink-0" />,
    };
  } else if (s === 'Submitted' || s === 'Under Review') {
    recommendation = {
      text: 'Perfection is in progress — monitor the workflow for review completion.',
      href: '/perfection-workflow', linkLabel: 'View Workflow →',
      color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200',
      icon: <Activity size={14} className="text-indigo-500 shrink-0" />,
    };
  } else if (isOverdue) {
    recommendation = {
      text: `Perfection deadline has passed by ${Math.abs(collateral.daysToDeadline ?? 0)} days — immediate action required to avoid compliance breach.`,
      href: '/perfection-workflow', linkLabel: 'Start Perfection →',
      color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200',
      icon: <AlertTriangle size={14} className="text-red-500 shrink-0" />,
    };
  } else if (s === 'Perfected' && isApproaching) {
    recommendation = {
      text: `Collateral is Perfected — schedule the next valuation (deadline in ${collateral.daysToDeadline} days).`,
      href: '/valuation-workflow', linkLabel: 'Schedule Valuation →',
      color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200',
      icon: <Clock size={14} className="text-amber-500 shrink-0" />,
    };
  } else if (s === 'Perfected') {
    recommendation = {
      text: 'Collateral is Perfected — schedule the next periodic valuation to maintain compliance.',
      href: '/valuation-workflow', linkLabel: 'Schedule Valuation →',
      color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200',
      icon: <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />,
    };
  } else if (s === 'Monitoring') {
    recommendation = {
      text: 'Collateral is under Monitoring — review LTV alerts and ensure covenant compliance.',
      href: '/ltv-breach-alerts', linkLabel: 'View LTV Alerts →',
      color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200',
      icon: <TrendingUp size={14} className="text-blue-500 shrink-0" />,
    };
  } else if (s === 'Rejected') {
    recommendation = {
      text: 'Collateral was Rejected — review the rejection reason and resubmit with corrections.',
      color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200',
      icon: <AlertCircle size={14} className="text-red-500 shrink-0" />,
    };
  }

  if (!recommendation) return null;

  return (
    <div className={`flex items-center justify-between gap-3 px-4 py-3 rounded-lg border ${recommendation.bg} ${recommendation.border} mb-4`}>
      <div className="flex items-center gap-2 min-w-0">
        {recommendation.icon}
        <p className={`text-sm font-medium ${recommendation.color} leading-snug`}>
          <span className="font-semibold">Next: </span>{recommendation.text}
        </p>
      </div>
      {recommendation.href && recommendation.linkLabel && (
        <Link href={recommendation.href} className={`shrink-0 text-xs font-semibold ${recommendation.color} hover:underline flex items-center gap-1`}>
          {recommendation.linkLabel}
        </Link>
      )}
    </div>
  );
}

// ─── Related Activity Cross-Links ─────────────────────────────────────────────

function RelatedActivityCard({ collateral }: { collateral: CollateralRecord }) {
  const s = collateral.status;
  const isOverdue = s === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);

  const links: { label: string; href: string; icon: React.ReactNode; badge?: string; badgeColor?: string }[] = [];

  if (s === 'Submitted' || s === 'Under Review' || s === 'Draft') {
    links.push({ label: 'Perfection Workflow', href: '/perfection-workflow', icon: <Activity size={13} className="text-blue-500" />, badge: 'Active', badgeColor: 'bg-blue-100 text-blue-700' });
  }
  if (s === 'Perfected' || s === 'Monitoring') {
    links.push({ label: 'Valuation Workflow', href: '/valuation-workflow', icon: <TrendingUp size={13} className="text-indigo-500" /> });
  }
  if (isOverdue || s === 'Monitoring') {
    links.push({ label: 'LTV Breach Alerts', href: '/ltv-breach-alerts', icon: <AlertTriangle size={13} className="text-red-500" />, badge: 'Check', badgeColor: 'bg-red-100 text-red-700' });
  }
  links.push({ label: 'Registry Submissions', href: '#registry-submissions', icon: <CheckCircle2 size={13} className="text-emerald-500" /> });
  links.push({ label: 'Insurance Tracking', href: '/insurance-tracking', icon: <Shield size={13} className="text-purple-500" /> });
  links.push({ label: 'Workflow Instances', href: '/workflows/instances', icon: <GitBranch size={13} className="text-primary" /> });

  return (
    <div className="bg-white rounded-xl border border-border shadow-card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
          <GitBranch size={14} className="text-primary" />
        </div>
        <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">Related Activity</h2>
      </div>
      <div className="space-y-1.5">
        {links.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="flex items-center gap-2.5 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
          >
            <div className="w-7 h-7 rounded-lg bg-muted/60 flex items-center justify-center shrink-0">
              {link.icon}
            </div>
            <span className="text-sm text-foreground group-hover:text-primary transition-colors flex-1">{link.label}</span>
            {link.badge && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${link.badgeColor}`}>{link.badge}</span>
            )}
            <ChevronRight size={13} className="text-muted-foreground group-hover:text-primary transition-colors" />
          </Link>
        ))}
      </div>
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ title, icon: IconComponent }: { title: string; icon: React.ElementType }) {
  return (
    <div className="flex items-center gap-2 mb-4">
      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
        {IconComponent && React.createElement(IconComponent, { size: 14, className: 'text-primary' })}
      </div>
      <h2 className="text-sm font-bold text-foreground uppercase tracking-wider">{title}</h2>
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
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-foreground">{value}</div>
      </div>
    </div>
  );
}

// ─── KPI Strip ────────────────────────────────────────────────────────────────

function KPIStrip({ collateral, utilization }: { collateral: CollateralRecord; utilization: CollateralUtilization | null }) {
  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;

  const deadlineLabel = collateral.daysToDeadline === null ? 'N/A'
    : isOverdue ? `${Math.abs(collateral.daysToDeadline)}d overdue`
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
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
            <p className={`text-sm font-bold truncate ${kpi.color}`}>{kpi.value}</p>
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
  const [activeTab, setActiveTab] = useState<'profile' | 'charges' | 'documents' | 'history-audit' | 'registry-submissions'>('profile');
  const [utilization, setUtilization] = useState<CollateralUtilization | null>(null);
  const [obligorData, setObligorData] = useState<Obligor | null>(null);
  const [loanData, setLoanData] = useState<Loan | null>(null);
  const [docRefreshKey, setDocRefreshKey] = useState(0);
  // Pending counts for tab badges
  const [pendingRegistryCount, setPendingRegistryCount] = useState(0);
  const [pendingDocCount, setPendingDocCount] = useState(0);

  useEffect(() => {
    if (!collateral?.id) return;
    collateralLinkService.getUtilization(collateral.id).then(setUtilization).catch(() => {});
  }, [collateral?.id]);

  useEffect(() => {
    if (!collateral?.obligorRefId) { setObligorData(null); return; }
    obligorService.getById(collateral.obligorRefId).then(setObligorData).catch(() => {});
  }, [collateral?.obligorRefId]);

  useEffect(() => {
    if (!collateral?.facilityId) { setLoanData(null); return; }
    const supabase = (async () => {
      const { createClient } = await import('@/lib/supabase/client');
      const client = createClient();
      const { data } = await client
        .from('loans')
        .select('*, obligors(full_name, obligor_code)')
        .eq('loan_number', collateral.facilityId)
        .maybeSingle();
      if (data) {
        setLoanData({
          id: data.id,
          loanNumber: data.loan_number,
          obligorId: data.obligor_id,
          facilityType: data.facility_type,
          facilityAmount: data.facility_amount != null ? parseFloat(data.facility_amount) : 0,
          outstandingBalance: data.outstanding_balance != null ? parseFloat(data.outstanding_balance) : null,
          currency: data.currency ?? 'TZS',
          interestRate: data.interest_rate != null ? parseFloat(data.interest_rate) : null,
          disbursementDate: data.disbursement_date,
          maturityDate: data.maturity_date,
          repaymentFrequency: data.repayment_frequency ?? 'Monthly',
          loanStatus: data.loan_status ?? 'Active',
          purpose: data.purpose,
          notes: data.notes,
          createdBy: data.created_by,
          createdAt: data.created_at,
          updatedAt: data.updated_at,
          obligorName: data.obligors?.full_name,
          obligorCode: data.obligors?.obligor_code,
        });
      }
    })();
  }, [collateral?.facilityId]);

  // Load pending counts for tab badges
  useEffect(() => {
    if (!collateral?.id) return;
    const loadCounts = async () => {
      try {
        const { createClient } = await import('@/lib/supabase/client');
        const client = createClient();
        // Registry submissions pending
        const { count: regCount } = await client
          .from('registry_submissions')
          .select('*', { count: 'exact', head: true })
          .eq('collateral_record_id', collateral.id)
          .in('status', ['pending', 'submitted', 'in_progress']);
        setPendingRegistryCount(regCount ?? 0);
        // Documents pending (missing required docs)
        const { count: docCount } = await client
          .from('collateral_documents')
          .select('*', { count: 'exact', head: true })
          .eq('collateral_record_id', collateral.id)
          .eq('approval_status', 'pending');
        setPendingDocCount(docCount ?? 0);
      } catch { /* silent */ }
    };
    loadCounts();
  }, [collateral?.id]);

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
            <p className="text-base font-semibold text-foreground">Record Not Found</p>
            <p className="text-sm text-muted-foreground mt-1">{error ?? 'The requested collateral record could not be found.'}</p>
          </div>
          <button onClick={onBack} className="px-4 py-2 bg-primary text-white rounded-md text-sm font-medium hover:bg-primary/90 transition-colors">
            Return to Registry
          </button>
        </div>
      </div>
    );
  }

  const isOverdue = collateral.status === 'Overdue' || (collateral.daysToDeadline !== null && collateral.daysToDeadline < 0);
  const isApproaching = collateral.daysToDeadline !== null && collateral.daysToDeadline >= 0 && collateral.daysToDeadline <= 7;
  const registryUrl = registryLinks[collateral.registry];

  const tabs = [
    { key: 'profile', label: 'Profile', icon: Shield },
    { key: 'charges', label: 'Charges & Loans', icon: PieChart },
    { key: 'documents', label: 'Documents', icon: Files, badge: pendingDocCount > 0 ? pendingDocCount : undefined },
    { key: 'registry-submissions', label: 'Registry Submissions', icon: CheckCircle2, badge: pendingRegistryCount > 0 ? pendingRegistryCount : undefined },
    { key: 'history-audit', label: 'History & Audit', icon: History },
  ];

  return (
    <div className="px-6 lg:px-8 xl:px-10 2xl:px-12 py-6 max-w-screen-2xl mx-auto">
      {/* Breadcrumb + Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
        <div>
          <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-2 transition-colors">
            <ArrowLeft size={14} /> Collateral Registry
          </button>
        </div>
        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          <ArchiveStatusBadge collateral={collateral} />
          <button onClick={onRefresh}
            className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-md text-sm text-muted-foreground hover:bg-muted transition-colors">
            <RefreshCw size={13} /> Refresh
          </button>
          <CollateralActionToolbar collateral={collateral} onRefresh={onRefresh} />
        </div>
      </div>

      {/* Next Recommended Action Banner */}
      <NextRecommendedActionBanner collateral={collateral} />

      {/* Status Banners */}
      {isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-4">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <p className="text-sm text-red-700 font-medium">
            This collateral is overdue for perfection — {collateral.daysToDeadline !== null && Math.abs(collateral.daysToDeadline)} days past the submission deadline. Immediate action required.
          </p>
        </div>
      )}
      {isApproaching && !isOverdue && (
        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg mb-4">
          <Clock size={15} className="text-amber-600 shrink-0" />
          <p className="text-sm text-amber-700 font-medium">
            Perfection deadline approaching — {collateral.daysToDeadline} days remaining to submit to {collateral.registry}.
          </p>
        </div>
      )}

      {/* KPI Strip */}
      <KPIStrip collateral={collateral} utilization={utilization} />

      {/* Tab Navigation */}
      <div className="flex items-center gap-1 mb-6 border-b border-border overflow-x-auto">
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as typeof activeTab)}
            className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px whitespace-nowrap ${activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
          >
            <tab.icon size={13} />
            {tab.label}
            {tab.badge !== undefined && (
              <span className="ml-1 inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold">
                {tab.badge}
              </span>
            )}
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
                    <DetailRow label="Collateral ID" value={<span className="font-mono font-semibold text-primary">{collateral.collateralId}</span>} icon={Shield} />
                    <DetailRow label="Obligor" value={
                      <div>
                        {collateral.obligorRefId ? (
                          <Link href={`/obligors/${collateral.obligorRefId}`} className="font-medium text-primary hover:underline flex items-center gap-1">
                            {collateral.obligor}<ExternalLink size={11} className="shrink-0" />
                          </Link>
                        ) : (
                          <p className="font-medium">{collateral.obligor}</p>
                        )}
                        <p className="text-xs text-muted-foreground font-mono">{collateral.obligorId}</p>
                      </div>
                    } icon={Building2} />
                    <DetailRow label="Collateral Type" value={collateral.type} icon={FileText} />
                    <DetailRow label="Asset Description" value={<p className="text-xs leading-relaxed">{collateral.description}</p>} icon={FileText} />
                    <DetailRow label="Collateral Value" value={<span className="font-mono font-semibold text-base">TSh {collateral.valueTSh}</span>} icon={Building2} />
                    <DetailRow label="Facility ID" value={
                      collateral.facilityId ? (
                        <Link href={`/loans?facility=${encodeURIComponent(collateral.facilityId)}`} className="font-mono text-xs text-primary hover:underline flex items-center gap-1">
                          {collateral.facilityId}<ExternalLink size={11} className="shrink-0" />
                        </Link>
                      ) : (
                        <span className="font-mono text-xs text-muted-foreground">—</span>
                      )
                    } icon={FileText} />
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
                        <a href={registryUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary hover:underline font-medium">
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
                          <span className={isOverdue ? 'text-red-600 font-medium' : isApproaching ? 'text-amber-600 font-medium' : 'text-foreground'}>{collateral.perfectionDeadline}</span>
                          {collateral.daysToDeadline !== null && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${isOverdue ? 'bg-red-100 text-red-700' : isApproaching ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
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
            {/* Consolidated Actions Panel */}
            <ActionsPanel collateral={collateral} onActionComplete={onRefresh} />

            <CollateralActivityTimeline collateral={collateral} />
            <RiskComplianceSidebarCard collateral={collateral} />

            {/* Related Activity Cross-Links */}
            <RelatedActivityCard collateral={collateral} />

            {/* Obligor Context Card */}
            {(obligorData || collateral.obligor) && (
              <div className="bg-white rounded-xl border border-border shadow-card p-5">
                <SectionHeader title="Obligor Context" icon={Building2} />
                <div className="space-y-3">
                  <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                    <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <Building2 size={16} className="text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      {collateral.obligorRefId ? (
                        <Link href={`/obligors/${collateral.obligorRefId}`} className="text-sm font-semibold text-primary hover:underline flex items-center gap-1 truncate">
                          {obligorData?.fullName ?? collateral.obligor}<ExternalLink size={11} className="shrink-0" />
                        </Link>
                      ) : (
                        <p className="text-sm font-semibold text-foreground truncate">{obligorData?.fullName ?? collateral.obligor}</p>
                      )}
                      <p className="text-xs text-muted-foreground font-mono">{obligorData?.obligorCode ?? collateral.obligorId ?? '—'}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Obligor ID</p>
                      <p className="text-xs font-semibold font-mono text-foreground truncate">{obligorData?.obligorCode ?? collateral.obligorId ?? '—'}</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Entity Type</p>
                      <p className="text-xs font-semibold text-foreground capitalize">{obligorData?.entityType ?? '—'}</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded-lg col-span-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-1">Credit Rating</p>
                      {obligorData?.riskRating ? (
                        <span className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                          obligorData.riskRating === 'LOW' ? 'bg-green-100 text-green-700' :
                          obligorData.riskRating === 'MEDIUM' ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                        }`}>
                          <Star size={10} />{obligorData.riskRating} RISK
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Not rated</span>
                      )}
                    </div>
                    {obligorData?.creditLimit != null && (
                      <div className="p-2.5 bg-muted/20 rounded-lg col-span-2">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Credit Limit</p>
                        <p className="text-xs font-semibold font-mono text-foreground">TZS {obligorData.creditLimit.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Linked Facility Summary Card */}
            {collateral.facilityId && (
              <div className="bg-white rounded-xl border border-border shadow-card p-5">
                <SectionHeader title="Linked Facility" icon={Banknote} />
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2 p-3 bg-muted/30 rounded-lg">
                    <div className="min-w-0">
                      <Link href={`/loans?facility=${encodeURIComponent(collateral.facilityId)}`} className="text-sm font-bold font-mono text-primary hover:underline flex items-center gap-1">
                        {collateral.facilityId}<ExternalLink size={11} className="shrink-0" />
                      </Link>
                      {loanData?.facilityType && (
                        <p className="text-xs text-muted-foreground mt-0.5">{loanData.facilityType}</p>
                      )}
                    </div>
                    {loanData?.loanStatus && (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide shrink-0 ${
                        loanData.loanStatus.toLowerCase() === 'active' ? 'bg-green-100 text-green-700' :
                        loanData.loanStatus.toLowerCase() === 'closed' ? 'bg-gray-100 text-gray-600' :
                        loanData.loanStatus.toLowerCase() === 'npl' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {loanData.loanStatus}
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2.5 bg-muted/20 rounded-lg col-span-2">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Facility Amount</p>
                      <p className="text-sm font-bold font-mono text-foreground">
                        {loanData ? `${loanData.currency} ${loanData.facilityAmount.toLocaleString()}` : <span className="text-muted-foreground text-xs">—</span>}
                      </p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Disbursed</p>
                      <p className="text-xs font-semibold text-foreground">{loanData?.disbursementDate ?? '—'}</p>
                    </div>
                    <div className="p-2.5 bg-muted/20 rounded-lg">
                      <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Maturity</p>
                      <p className="text-xs font-semibold text-foreground">{loanData?.maturityDate ?? '—'}</p>
                    </div>
                    {loanData?.outstandingBalance != null && (
                      <div className="p-2.5 bg-muted/20 rounded-lg col-span-2">
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide mb-0.5">Outstanding Balance</p>
                        <p className="text-xs font-semibold font-mono text-foreground">{loanData.currency} {loanData.outstandingBalance.toLocaleString()}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

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

      {/* Tab: Documents */}
      {activeTab === 'documents' && (
        <div className="space-y-6">
          <MandatoryDocumentsCard collateral={collateral} onDocumentUploaded={() => setDocRefreshKey((k) => k + 1)} />
          <DocumentsSection key={docRefreshKey} collateral={collateral} />
          <LegalSignOffSection collateral={collateral} />
        </div>
      )}

      {/* Tab: History & Audit */}
      {activeTab === 'history-audit' && <HistoryAuditTab collateral={collateral} />}

      {/* Tab: Registry Submissions */}
      {activeTab === 'registry-submissions' && <RegistrySubmissionsTab collateral={collateral} />}
    </div>
  );
}