'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, Building2, User, MapPin, Phone, Mail, Shield, Edit2, AlertTriangle, CheckCircle2, Loader2, RefreshCw, FileText, CreditCard, ExternalLink, Hash, Globe, UserCheck, AlertCircle,  } from 'lucide-react';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import ObligorFormModal from '../components/ObligorFormModal';
import Icon from '@/components/ui/AppIcon';


interface Props { id: string; }

const riskConfig = {
  LOW: { color: 'text-green-700', bg: 'bg-green-100', border: 'border-green-200', icon: CheckCircle2 },
  MEDIUM: { color: 'text-amber-700', bg: 'bg-amber-100', border: 'border-amber-200', icon: AlertTriangle },
  HIGH: { color: 'text-red-700', bg: 'bg-red-100', border: 'border-red-200', icon: AlertTriangle },
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

export default function ObligorProfileContent({ id }: Props) {
  const [obligor, setObligor] = useState<Obligor | null>(null);
  const [collaterals, setCollaterals] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showEdit, setShowEdit] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [obl, cols] = await Promise.all([
        obligorService.getById(id),
        obligorService.getLinkedCollaterals(id),
      ]);
      if (!obl) { setError('Obligor not found.'); }
      else { setObligor(obl); }
      setCollaterals(cols);
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

        {/* Right: Linked Collaterals */}
        <div className="lg:col-span-2">
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
          <div className="mt-4 bg-white rounded-xl border border-border shadow-sm p-5">
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
