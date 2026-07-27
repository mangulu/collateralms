'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, User, MapPin, Phone, Mail, Shield, Edit2, AlertTriangle, CheckCircle2, Loader2, RefreshCw, FileText, CreditCard, ExternalLink, Hash, Globe, UserCheck, AlertCircle, TrendingUp, TrendingDown, BarChart2, Activity, Target, Percent, Clock, XCircle,  } from 'lucide-react';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import { loanService, Loan } from '@/lib/supabase/loanService';
import ObligorFormModal from '../components/ObligorFormModal';
import Icon from '@/components/ui/AppIcon';
import PledgeDocumentsPanel from './PledgeDocumentsPanel';


interface Props { id: string; }

const riskConfig = {
  LOW: { color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200', icon: CheckCircle2, score: 82 },
  MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200', icon: AlertTriangle, score: 55 },
  HIGH: { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', icon: AlertTriangle, score: 28 },
};

const statusColors: Record<string, string> = {
  Draft: 'bg-gray-100 text-gray-600',
  Submitted: 'bg-purple-100 text-purple-700',
  'Under Review': 'bg-blue-100 text-blue-700',
  Perfected: 'bg-green-100 text-green-700',
  Monitoring: 'bg-teal-100 text-teal-700',
  Released: 'bg-slate-100 text-slate-600',
  Overdue: 'bg-red-100 text-red-700',
  Rejected: 'bg-rose-100 text-rose-700',
};

function DetailRow({ label, value, icon: Icon }: { label: string; value: React.ReactNode; icon?: React.ElementType }) {
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/60 last:border-0">
      {Icon && (
        <div className="w-6 h-6 rounded-md bg-muted flex items-center justify-center shrink-0 mt-0.5">
          <Icon size={12} className="text-muted-foreground" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide mb-0.5">{label}</p>
        <div className="text-sm text-foreground">{value || <span className="text-muted-foreground">—</span>}</div>
      </div>
    </div>
  );
}

function ScoreGauge({ score }: { score: number }) {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color = clampedScore >= 70 ? '#16a34a' : clampedScore >= 40 ? '#d97706' : '#dc2626';
  const label = clampedScore >= 70 ? 'Good Standing' : clampedScore >= 40 ? 'Moderate Risk' : 'High Risk';
  const radius = 36;
  const circumference = Math.PI * radius;
  const offset = circumference - (clampedScore / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-24 h-14 overflow-hidden">
        <svg width="96" height="56" viewBox="0 0 96 56" className="absolute top-0 left-0">
          <path
            d="M 12 48 A 36 36 0 0 1 84 48"
            fill="none"
            stroke="#e5e7eb"
            strokeWidth="8"
            strokeLinecap="round"
          />
          <path
            d="M 12 48 A 36 36 0 0 1 84 48"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.6s ease' }}
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex flex-col items-center">
          <span className="text-xl font-800 leading-none" style={{ color }}>{clampedScore}</span>
        </div>
      </div>
      <span className="text-[10px] font-600 uppercase tracking-wide" style={{ color }}>{label}</span>
    </div>
  );
}

export default function ObligorProfileContent({ id }: Props) {
  const [obligor, setObligor] = useState<Obligor | null>(null);
  const [collaterals, setCollaterals] = useState<any[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [obl, cols, lns] = await Promise.all([
        obligorService.getById(id),
        obligorService.getLinkedCollaterals(id),
        loanService.getByObligorId(id),
      ]);
      if (!obl) { setError('Obligor not found.'); }
      else { setObligor(obl); }
      setCollaterals(cols);
      setLoans(lns);
    } catch {
      setError('Failed to load obligor profile.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] gap-2 text-muted-foreground">
        <Loader2 size={20} className="animate-spin" />
        <span className="text-sm">Loading obligor profile…</span>
      </div>
    );
  }

  if (error || !obligor) {
    return (
      <div className="p-6">
        <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          <AlertCircle size={15} />
          {error ?? 'Obligor not found.'}
        </div>
        <Link href="/obligors" className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:underline">
          <ArrowLeft size={14} /> Back to Obligors
        </Link>
      </div>
    );
  }

  const risk = riskConfig[obligor.riskRating ?? 'MEDIUM'];
  const RiskIcon = risk.icon;

  const totalCollateralValue = collaterals.reduce((sum, c) => {
    const v = parseFloat((c.value_tsh ?? '0').replace(/,/g, ''));
    return sum + (isNaN(v) ? 0 : v);
  }, 0);

  const perfectedCount = collaterals.filter((c) => c.status === 'Perfected').length;
  const overdueCount = collaterals.filter((c) => c.status === 'Overdue').length;

  // ── Portfolio LTV ──────────────────────────────────────────────────────────
  const totalOutstanding = loans.reduce((s, l) => s + (l.outstandingBalance ?? 0), 0);
  const avgLtv = totalCollateralValue > 0 && totalOutstanding > 0
    ? Math.min(200, (totalOutstanding / totalCollateralValue) * 100)
    : null;

  // Status breakdown for portfolio cards
  const statusBreakdown = [
    { label: 'Perfected', count: collaterals.filter((c) => c.status === 'Perfected').length, color: 'bg-green-500' },
    { label: 'Monitoring', count: collaterals.filter((c) => c.status === 'Monitoring').length, color: 'bg-teal-500' },
    { label: 'Under Review', count: collaterals.filter((c) => c.status === 'Under Review').length, color: 'bg-blue-500' },
    { label: 'Overdue', count: collaterals.filter((c) => c.status === 'Overdue').length, color: 'bg-red-500' },
    { label: 'Draft', count: collaterals.filter((c) => c.status === 'Draft').length, color: 'bg-gray-400' },
    { label: 'Released', count: collaterals.filter((c) => c.status === 'Released').length, color: 'bg-slate-300' },
  ].filter((s) => s.count > 0);

  // ── Credit Risk Score ──────────────────────────────────────────────────────
  const baseScore = riskConfig[obligor.riskRating ?? 'MEDIUM'].score;
  const overdueDeduction = Math.min(overdueCount * 8, 30);
  const perfectionBonus = Math.min(perfectedCount * 3, 15);
  const creditRiskScore = Math.max(5, Math.min(100, baseScore - overdueDeduction + perfectionBonus));

  // ── Exposure Metrics ───────────────────────────────────────────────────────
  const creditLimit = obligor.creditLimit ?? 0;
  const utilizationRate = creditLimit > 0 ? Math.min(100, (totalCollateralValue / creditLimit) * 100) : null;
  const activeCollaterals = collaterals.filter((c) => !['Released', 'Rejected'].includes(c.status));
  const avgCollateralValue = activeCollaterals.length > 0 ? totalCollateralValue / activeCollaterals.length : 0;
  const releasedValue = collaterals
    .filter((c) => c.status === 'Released')
    .reduce((sum, c) => {
      const v = parseFloat((c.value_tsh ?? '0').replace(/,/g, ''));
      return sum + (isNaN(v) ? 0 : v);
    }, 0);

  // ── Approval Trend Summary ─────────────────────────────────────────────────
  const approvedCount = collaterals.filter((c) => ['Perfected', 'Monitoring'].includes(c.status)).length;
  const rejectedCount = collaterals.filter((c) => c.status === 'Rejected').length;
  const pendingCount = collaterals.filter((c) => ['Draft', 'Submitted', 'Under Review'].includes(c.status)).length;
  const totalDecided = approvedCount + rejectedCount;
  const approvalRate = totalDecided > 0 ? Math.round((approvedCount / totalDecided) * 100) : null;

  const formatTsh = (val: number) => {
    if (val >= 1e9) return `TSh ${(val / 1e9).toFixed(1)}B`;
    if (val >= 1e6) return `TSh ${(val / 1e6).toFixed(1)}M`;
    if (val >= 1e3) return `TSh ${(val / 1e3).toFixed(0)}K`;
    return val > 0 ? `TSh ${val.toFixed(0)}` : '—';
  };

  return (
    <div className="p-6 space-y-6">
      {/* Back + Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Link href="/obligors" className="p-2 rounded-lg hover:bg-muted transition-colors mt-0.5">
            <ArrowLeft size={16} className="text-muted-foreground" />
          </Link>
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${obligor.entityType === 'company' ? 'bg-blue-100' : 'bg-purple-100'}`}>
              {obligor.entityType === 'company'
                ? <Building2 size={22} className="text-blue-600" />
                : <User size={22} className="text-purple-600" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-700 text-foreground">{obligor.fullName}</h1>
                <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-600 border ${risk.bg} ${risk.color} ${risk.border}`}>
                  <RiskIcon size={11} />
                  {obligor.riskRating ?? 'MEDIUM'} Risk
                </span>
                {!obligor.isActive && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-600 bg-gray-100 text-gray-600 border border-gray-200">Inactive</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground font-mono">{obligor.obligorCode}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowEdit(true)}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors shrink-0"
        >
          <Edit2 size={14} />
          Edit Profile
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Total Collaterals', value: collaterals.length, icon: FileText, color: 'text-primary', bg: 'bg-primary/5' },
          { label: 'Perfected', value: perfectedCount, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Overdue', value: overdueCount, icon: AlertTriangle, color: 'text-red-600', bg: 'bg-red-50' },
          {
            label: 'Total Value (TSh)',
            value: totalCollateralValue > 0
              ? totalCollateralValue >= 1e9
                ? `${(totalCollateralValue / 1e9).toFixed(1)}B`
                : `${(totalCollateralValue / 1e6).toFixed(0)}M`
              : '—',
            icon: CreditCard,
            color: 'text-blue-600',
            bg: 'bg-blue-50',
          },
        ].map((kpi) => (
          <div key={kpi.label} className={`flex items-center gap-3 p-4 rounded-xl border border-border ${kpi.bg}`}>
            <div className="w-9 h-9 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
              <kpi.icon size={16} className={kpi.color} />
            </div>
            <div>
              <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-lg font-700 ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Portfolio Summary Cards ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Collateral Value */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
              <CreditCard size={15} className="text-blue-600" />
            </div>
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Total Collateral Value</p>
          </div>
          <p className="text-2xl font-800 text-blue-700">
            {totalCollateralValue >= 1e9
              ? `TSh ${(totalCollateralValue / 1e9).toFixed(1)}B`
              : totalCollateralValue >= 1e6
              ? `TSh ${(totalCollateralValue / 1e6).toFixed(1)}M`
              : totalCollateralValue > 0
              ? `TSh ${totalCollateralValue.toLocaleString()}`
              : '—'}
          </p>
          <p className="text-xs text-muted-foreground mt-1">Across {collaterals.length} pledge{collaterals.length !== 1 ? 's' : ''}</p>
        </div>

        {/* Collateral Count */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Shield size={15} className="text-primary" />
            </div>
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Collateral Count</p>
          </div>
          <p className="text-2xl font-800 text-foreground">{collaterals.length}</p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span className="text-[10px] text-green-700 font-600">{perfectedCount} perfected</span>
            {overdueCount > 0 && <span className="text-[10px] text-red-700 font-600">{overdueCount} overdue</span>}
          </div>
        </div>

        {/* Status Breakdown */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center">
              <BarChart2 size={15} className="text-purple-600" />
            </div>
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Status Breakdown</p>
          </div>
          {statusBreakdown.length > 0 ? (
            <>
              <div className="flex h-2 rounded-full overflow-hidden gap-0.5 mb-2">
                {statusBreakdown.map((s) => (
                  <div
                    key={s.label}
                    className={`${s.color} transition-all`}
                    style={{ width: `${(s.count / collaterals.length) * 100}%` }}
                    title={`${s.label}: ${s.count}`}
                  />
                ))}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {statusBreakdown.map((s) => (
                  <div key={s.label} className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-sm ${s.color}`} />
                    <span className="text-[10px] text-muted-foreground">{s.label} ({s.count})</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">No collaterals yet</p>
          )}
        </div>

        {/* Average LTV */}
        <div className="bg-white rounded-xl border border-border shadow-sm p-4">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center">
              <Percent size={15} className="text-amber-600" />
            </div>
            <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Avg. LTV Ratio</p>
          </div>
          {avgLtv !== null ? (
            <>
              <p className={`text-2xl font-800 ${avgLtv >= 80 ? 'text-red-700' : avgLtv >= 60 ? 'text-amber-700' : 'text-green-700'}`}>
                {avgLtv.toFixed(1)}%
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${Math.min(avgLtv, 100)}%`,
                    background: avgLtv >= 80 ? '#dc2626' : avgLtv >= 60 ? '#d97706' : '#16a34a',
                  }}
                />
              </div>
              <p className="text-[10px] text-muted-foreground mt-1">Outstanding vs. collateral value</p>
            </>
          ) : (
            <>
              <p className="text-2xl font-800 text-muted-foreground">—</p>
              <p className="text-[10px] text-muted-foreground mt-1">No outstanding loan data</p>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Profile Details */}
        <div className="lg:col-span-1 space-y-4">
          {/* Personal / Company Info */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                {obligor.entityType === 'company' ? <Building2 size={14} className="text-primary" /> : <User size={14} className="text-primary" />}
              </div>
              <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">
                {obligor.entityType === 'company' ? 'Company Info' : 'Personal Info'}
              </h2>
            </div>
            <DetailRow label="Full Name" value={obligor.fullName} icon={UserCheck} />
            {obligor.entityType === 'individual' && obligor.idNumber && (
              <DetailRow label="National ID" value={obligor.idNumber} icon={Hash} />
            )}
            {obligor.entityType === 'company' && obligor.registrationNumber && (
              <DetailRow label="Registration No." value={obligor.registrationNumber} icon={Hash} />
            )}
            {obligor.taxId && <DetailRow label="TIN / Tax ID" value={obligor.taxId} icon={Hash} />}
            <DetailRow label="Entity Type" value={
              <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-600 ${obligor.entityType === 'company' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                {obligor.entityType === 'company' ? <Building2 size={11} /> : <User size={11} />}
                {obligor.entityType === 'company' ? 'Company' : 'Individual'}
              </span>
            } />
            {obligor.creditLimit && (
              <DetailRow label="Credit Limit" value={`TSh ${obligor.creditLimit.toLocaleString()}`} icon={CreditCard} />
            )}
          </div>

          {/* Address */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <MapPin size={14} className="text-primary" />
              </div>
              <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Address</h2>
            </div>
            {obligor.addressLine1 && <DetailRow label="Address" value={[obligor.addressLine1, obligor.addressLine2].filter(Boolean).join(', ')} icon={MapPin} />}
            {obligor.city && <DetailRow label="City" value={obligor.city} />}
            {obligor.region && <DetailRow label="Region" value={obligor.region} />}
            <DetailRow label="Country" value={obligor.country ?? 'Tanzania'} icon={Globe} />
            {obligor.postalCode && <DetailRow label="Postal Code" value={obligor.postalCode} />}
            {!obligor.addressLine1 && !obligor.city && (
              <p className="text-xs text-muted-foreground text-center py-4">No address on file</p>
            )}
          </div>

          {/* Contacts */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Phone size={14} className="text-primary" />
              </div>
              <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Contacts</h2>
            </div>
            {obligor.contactPerson && <DetailRow label="Contact Person" value={obligor.contactPerson} icon={UserCheck} />}
            {obligor.phonePrimary && <DetailRow label="Primary Phone" value={<a href={`tel:${obligor.phonePrimary}`} className="text-primary hover:underline">{obligor.phonePrimary}</a>} icon={Phone} />}
            {obligor.phoneSecondary && <DetailRow label="Secondary Phone" value={<a href={`tel:${obligor.phoneSecondary}`} className="text-primary hover:underline">{obligor.phoneSecondary}</a>} icon={Phone} />}
            {obligor.email && <DetailRow label="Email" value={<a href={`mailto:${obligor.email}`} className="text-primary hover:underline">{obligor.email}</a>} icon={Mail} />}
            {!obligor.phonePrimary && !obligor.email && (
              <p className="text-xs text-muted-foreground text-center py-4">No contact info on file</p>
            )}
          </div>

          {/* Notes */}
          {obligor.notes && (
            <div className="bg-white rounded-xl border border-border shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FileText size={14} className="text-primary" />
                </div>
                <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Notes</h2>
              </div>
              <p className="text-sm text-foreground leading-relaxed">{obligor.notes}</p>
            </div>
          )}
        </div>

        {/* Right: Linked Collaterals + Risk Panels */}
        <div className="lg:col-span-2 space-y-4">

          {/* ── Credit Risk Score ─────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Target size={14} className="text-primary" />
              </div>
              <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Credit Risk Score</h2>
              {(obligor.riskRating === 'HIGH' || creditRiskScore < 40) && (
                <span className="ml-auto flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-700 bg-red-100 text-red-700 border border-red-200">
                  <AlertTriangle size={10} /> High-Risk Obligor
                </span>
              )}
            </div>
            <div className="flex items-center gap-6">
              <ScoreGauge score={creditRiskScore} />
              <div className="flex-1 grid grid-cols-2 gap-3">
                {[
                  {
                    label: 'Base Rating',
                    value: obligor.riskRating ?? 'MEDIUM',
                    color: risk.color,
                    bg: risk.bg,
                    icon: Shield,
                  },
                  {
                    label: 'Overdue Penalty',
                    value: overdueDeduction > 0 ? `-${overdueDeduction} pts` : 'None',
                    color: overdueDeduction > 0 ? 'text-red-700' : 'text-green-700',
                    bg: overdueDeduction > 0 ? 'bg-red-50' : 'bg-green-50',
                    icon: TrendingDown,
                  },
                  {
                    label: 'Perfection Bonus',
                    value: perfectionBonus > 0 ? `+${perfectionBonus} pts` : 'None',
                    color: perfectionBonus > 0 ? 'text-green-700' : 'text-muted-foreground',
                    bg: perfectionBonus > 0 ? 'bg-green-50' : 'bg-muted/30',
                    icon: TrendingUp,
                  },
                  {
                    label: 'Final Score',
                    value: `${creditRiskScore} / 100`,
                    color: creditRiskScore >= 70 ? 'text-green-700' : creditRiskScore >= 40 ? 'text-amber-700' : 'text-red-700',
                    bg: creditRiskScore >= 70 ? 'bg-green-50' : creditRiskScore >= 40 ? 'bg-amber-50' : 'bg-red-50',
                    icon: Activity,
                  },
                ].map((item) => (
                  <div key={item.label} className={`p-3 rounded-lg border border-border ${item.bg}`}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <item.icon size={11} className="text-muted-foreground" />
                      <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{item.label}</p>
                    </div>
                    <p className={`text-sm font-700 ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>
            </div>
            {/* Score bar */}
            <div className="mt-4">
              <div className="flex justify-between text-[10px] text-muted-foreground mb-1">
                <span>0 — Critical</span>
                <span>40 — Moderate</span>
                <span>70 — Good</span>
                <span>100</span>
              </div>
              <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${creditRiskScore}%`,
                    background: creditRiskScore >= 70
                      ? '#16a34a'
                      : creditRiskScore >= 40
                      ? '#d97706' :'#dc2626',
                  }}
                />
              </div>
            </div>
          </div>

          {/* ── Exposure Metrics ──────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                <BarChart2 size={14} className="text-blue-600" />
              </div>
              <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Exposure Metrics</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
              {[
                {
                  label: 'Total Exposure',
                  value: formatTsh(totalCollateralValue),
                  sub: `${activeCollaterals.length} active items`,
                  icon: CreditCard,
                  color: 'text-blue-700',
                  bg: 'bg-blue-50',
                },
                {
                  label: 'Avg. Collateral Value',
                  value: formatTsh(avgCollateralValue),
                  sub: 'per active collateral',
                  icon: TrendingUp,
                  color: 'text-indigo-700',
                  bg: 'bg-indigo-50',
                },
                {
                  label: 'Released Exposure',
                  value: formatTsh(releasedValue),
                  sub: `${collaterals.filter((c) => c.status === 'Released').length} released`,
                  icon: CheckCircle2,
                  color: 'text-slate-600',
                  bg: 'bg-slate-50',
                },
              ].map((m) => (
                <div key={m.label} className={`p-3 rounded-lg border border-border ${m.bg}`}>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <m.icon size={12} className={m.color} />
                    <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{m.label}</p>
                  </div>
                  <p className={`text-base font-700 ${m.color}`}>{m.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{m.sub}</p>
                </div>
              ))}
            </div>
            {/* Utilization bar */}
            {utilizationRate !== null ? (
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <Percent size={12} className="text-muted-foreground" />
                    <span className="text-xs font-600 text-foreground">Credit Limit Utilization</span>
                  </div>
                  <span className={`text-xs font-700 ${utilizationRate >= 90 ? 'text-red-700' : utilizationRate >= 70 ? 'text-amber-700' : 'text-green-700'}`}>
                    {utilizationRate.toFixed(1)}%
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{
                      width: `${Math.min(utilizationRate, 100)}%`,
                      background: utilizationRate >= 90 ? '#dc2626' : utilizationRate >= 70 ? '#d97706' : '#2563eb',
                    }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
                  <span>Limit: {formatTsh(creditLimit)}</span>
                  <span>Used: {formatTsh(totalCollateralValue)}</span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 border border-border">
                <AlertCircle size={13} className="text-muted-foreground shrink-0" />
                <p className="text-xs text-muted-foreground">No credit limit set — utilization rate unavailable</p>
              </div>
            )}
          </div>

          {/* ── Approval Trend Summary ────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                <Activity size={14} className="text-purple-600" />
              </div>
              <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Approval Trend Summary</h2>
              {approvalRate !== null && (
                <span className={`ml-auto px-2 py-0.5 rounded-full text-[10px] font-700 border ${approvalRate >= 70 ? 'bg-green-100 text-green-700 border-green-200' : approvalRate >= 40 ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-red-100 text-red-700 border-red-200'}`}>
                  {approvalRate}% Approval Rate
                </span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                {
                  label: 'Approved',
                  value: approvedCount,
                  icon: CheckCircle2,
                  color: 'text-green-700',
                  bg: 'bg-green-50',
                  border: 'border-green-200',
                  desc: 'Perfected + Monitoring',
                },
                {
                  label: 'Pending',
                  value: pendingCount,
                  icon: Clock,
                  color: 'text-amber-700',
                  bg: 'bg-amber-50',
                  border: 'border-amber-200',
                  desc: 'Draft / Submitted / Review',
                },
                {
                  label: 'Rejected',
                  value: rejectedCount,
                  icon: XCircle,
                  color: 'text-red-700',
                  bg: 'bg-red-50',
                  border: 'border-red-200',
                  desc: 'Rejected collaterals',
                },
              ].map((item) => (
                <div key={item.label} className={`p-4 rounded-lg border ${item.border} ${item.bg} flex flex-col items-center text-center gap-1`}>
                  <item.icon size={18} className={item.color} />
                  <p className={`text-2xl font-800 ${item.color}`}>{item.value}</p>
                  <p className="text-xs font-600 text-foreground">{item.label}</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">{item.desc}</p>
                </div>
              ))}
            </div>
            {/* Stacked progress bar */}
            {collaterals.length > 0 && (
              <div>
                <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                  {approvedCount > 0 && (
                    <div
                      className="bg-green-500 transition-all duration-700"
                      style={{ width: `${(approvedCount / collaterals.length) * 100}%` }}
                      title={`Approved: ${approvedCount}`}
                    />
                  )}
                  {pendingCount > 0 && (
                    <div
                      className="bg-amber-400 transition-all duration-700"
                      style={{ width: `${(pendingCount / collaterals.length) * 100}%` }}
                      title={`Pending: ${pendingCount}`}
                    />
                  )}
                  {overdueCount > 0 && (
                    <div
                      className="bg-orange-500 transition-all duration-700"
                      style={{ width: `${(overdueCount / collaterals.length) * 100}%` }}
                      title={`Overdue: ${overdueCount}`}
                    />
                  )}
                  {rejectedCount > 0 && (
                    <div
                      className="bg-red-500 transition-all duration-700"
                      style={{ width: `${(rejectedCount / collaterals.length) * 100}%` }}
                      title={`Rejected: ${rejectedCount}`}
                    />
                  )}
                  {collaterals.filter((c) => c.status === 'Released').length > 0 && (
                    <div
                      className="bg-slate-300 transition-all duration-700"
                      style={{ width: `${(collaterals.filter((c) => c.status === 'Released').length / collaterals.length) * 100}%` }}
                      title={`Released: ${collaterals.filter((c) => c.status === 'Released').length}`}
                    />
                  )}
                </div>
                <div className="flex flex-wrap gap-3 mt-2">
                  {[
                    { label: 'Approved', color: 'bg-green-500', count: approvedCount },
                    { label: 'Pending', color: 'bg-amber-400', count: pendingCount },
                    { label: 'Overdue', color: 'bg-orange-500', count: overdueCount },
                    { label: 'Rejected', color: 'bg-red-500', count: rejectedCount },
                    { label: 'Released', color: 'bg-slate-300', count: collaterals.filter((c) => c.status === 'Released').length },
                  ].filter((l) => l.count > 0).map((l) => (
                    <div key={l.label} className="flex items-center gap-1.5">
                      <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                      <span className="text-[10px] text-muted-foreground">{l.label} ({l.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {collaterals.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-2">No collateral workflow data available</p>
            )}
          </div>

          {/* Linked Collaterals */}
          <div className="bg-white rounded-xl border border-border shadow-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Shield size={14} className="text-primary" />
                </div>
                <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Linked Collaterals</h2>
                <span className="px-2 py-0.5 rounded-full text-xs font-600 bg-muted text-muted-foreground">{collaterals.length}</span>
              </div>
              <button onClick={load} className="p-1.5 rounded-md hover:bg-muted transition-colors" title="Refresh">
                <RefreshCw size={13} className="text-muted-foreground" />
              </button>
            </div>

            {collaterals.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3 text-center px-6">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
                  <Shield size={18} className="text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-600 text-foreground">No linked collaterals</p>
                  <p className="text-xs text-muted-foreground mt-1">Collaterals linked to this obligor will appear here</p>
                </div>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {collaterals.map((c) => (
                  <div key={c.id} className="flex items-center gap-4 px-5 py-4 hover:bg-muted/20 transition-colors">
                    <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                      <Shield size={16} className="text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-600 text-foreground font-mono">{c.collateral_id}</p>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-600 ${statusColors[c.status] ?? 'bg-gray-100 text-gray-600'}`}>
                          {c.status}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.description}</p>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-xs text-muted-foreground">{c.collateral_type}</span>
                        {c.facility_id && (
                          <span className="text-xs text-muted-foreground font-mono">Facility: {c.facility_id}</span>
                        )}
                        {c.value_tsh && (
                          <span className="text-xs font-600 text-foreground">TSh {c.value_tsh}</span>
                        )}
                      </div>
                    </div>
                    <Link
                      href={`/collateral-detail/${c.id}`}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-primary shrink-0"
                      title="View Collateral"
                    >
                      <ExternalLink size={14} />
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Risk Summary */}
          <div className="bg-white rounded-xl border border-border shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                <Shield size={14} className="text-primary" />
              </div>
              <h2 className="text-sm font-700 text-foreground uppercase tracking-wider">Risk Summary</h2>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Risk Rating', value: obligor.riskRating ?? 'MEDIUM', color: risk.color, bg: risk.bg },
                { label: 'Active Collaterals', value: collaterals.filter((c) => !['Released', 'Rejected'].includes(c.status)).length, color: 'text-foreground', bg: 'bg-muted/30' },
                { label: 'Perfected', value: perfectedCount, color: 'text-green-700', bg: 'bg-green-50' },
                { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? 'text-red-700' : 'text-foreground', bg: overdueCount > 0 ? 'bg-red-50' : 'bg-muted/30' },
              ].map((item) => (
                <div key={item.label} className={`p-3 rounded-lg border border-border ${item.bg}`}>
                  <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide mb-1">{item.label}</p>
                  <p className={`text-base font-700 ${item.color}`}>{item.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Pledge Documents */}
          <PledgeDocumentsPanel obligorId={id} />
        </div>
      </div>

      {showEdit && (
        <ObligorFormModal
          editItem={obligor}
          onClose={() => setShowEdit(false)}
          onSaved={(saved) => { setObligor(saved); setShowEdit(false); }}
        />
      )}
    </div>
  );
}
