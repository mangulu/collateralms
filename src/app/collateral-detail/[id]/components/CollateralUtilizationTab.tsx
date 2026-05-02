'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Plus, AlertTriangle, CheckCircle2, Link2, Unlink, FileCheck, ChevronDown, ChevronUp, X, Building2, Calendar, DollarSign, Shield } from 'lucide-react';
import { toast } from 'sonner';
import { collateralLinkService, CollateralLoanLink, ChargeRegistry, CollateralUtilization, LinkLoanPayload, ReleaseLinkPayload, DischargeChargePayload } from '@/lib/supabase/collateralLinkService';
import { CollateralRecord } from '@/lib/supabase/collateralService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Utilization Gauge ────────────────────────────────────────────────────────

function UtilizationGauge({ pct, status }: { pct: number; status: string }) {
  const clampedPct = Math.min(100, Math.max(0, pct));
  const color = status === 'RED' ? '#ef4444' : status === 'YELLOW' ? '#f59e0b' : '#22c55e';
  const bgColor = status === 'RED' ? 'bg-red-50 border-red-200' : status === 'YELLOW' ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200';
  const textColor = status === 'RED' ? 'text-red-700' : status === 'YELLOW' ? 'text-amber-700' : 'text-green-700';

  // SVG arc gauge
  const radius = 54;
  const cx = 70;
  const cy = 70;
  const startAngle = -210;
  const endAngle = 30;
  const totalAngle = endAngle - startAngle;
  const fillAngle = startAngle + (totalAngle * clampedPct) / 100;

  function polarToCartesian(angle: number) {
    const rad = (angle * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  const start = polarToCartesian(startAngle);
  const end = polarToCartesian(endAngle);
  const fill = polarToCartesian(fillAngle);
  const largeArcBg = totalAngle > 180 ? 1 : 0;
  const largeArcFill = Math.abs(fillAngle - startAngle) > 180 ? 1 : 0;

  return (
    <div className={`flex flex-col items-center p-4 rounded-xl border ${bgColor}`}>
      <svg width="140" height="100" viewBox="0 0 140 100">
        {/* Background arc */}
        <path
          d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcBg} 1 ${end.x} ${end.y}`}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="12"
          strokeLinecap="round"
        />
        {/* Fill arc */}
        {clampedPct > 0 && (
          <path
            d={`M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFill} 1 ${fill.x} ${fill.y}`}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
          />
        )}
        {/* Center text */}
        <text x={cx} y={cy - 4} textAnchor="middle" fontSize="20" fontWeight="700" fill={color}>
          {clampedPct.toFixed(1)}%
        </text>
        <text x={cx} y={cy + 14} textAnchor="middle" fontSize="9" fill="#6b7280">
          UTILIZATION
        </text>
      </svg>
      <span className={`text-xs font-700 px-2.5 py-0.5 rounded-full ${textColor} ${bgColor} border`}>
        {status === 'GREEN' ? '● On Track' : status === 'YELLOW' ? '● Near Limit' : '● Critical'}
      </span>
    </div>
  );
}

// ─── Link Loan Modal ──────────────────────────────────────────────────────────

function LinkLoanModal({
  collateral,
  availableEquity,
  maxSecurable,
  nextRank,
  onClose,
  onSuccess,
}: {
  collateral: CollateralRecord;
  availableEquity: number;
  maxSecurable: number;
  nextRank: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<LinkLoanPayload>({
    loanAccountId: '',
    beneficiaryId: '',
    beneficiaryName: '',
    allocatedAmount: 0,
    startDate: new Date().toISOString().slice(0, 10),
  });
  const [warning, setWarning] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const newTotal = form.allocatedAmount;
  const newPct = maxSecurable > 0 ? ((collateral as any).total_secured_amount + newTotal) / maxSecurable * 100 : 0;
  const wouldExceed = form.allocatedAmount > availableEquity;
  const wouldWarn = !wouldExceed && newPct >= 90;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (wouldWarn && !acknowledged) { setWarning('Please acknowledge the warning before proceeding.'); return; }
    setSaving(true);
    setError('');
    const result = await collateralLinkService.linkLoan(collateral.id, form, user.id);
    setSaving(false);
    if (result.success) {
      toast.success('Loan linked to collateral successfully');
      onSuccess();
    } else {
      setError(result.error ?? 'Failed to link loan');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Link2 size={15} className="text-primary" />
            </div>
            <div>
              <h2 className="text-sm font-700 text-foreground">Link Loan to Collateral</h2>
              <p className="text-xs text-muted-foreground">{collateral.collateralId} · Charge Rank #{nextRank}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Equity summary */}
        <div className="mx-6 mt-4 p-3 bg-muted/30 rounded-lg border border-border/60 grid grid-cols-3 gap-3 text-center">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Max Securable</p>
            <p className="text-sm font-700 text-foreground">TSh {maxSecurable.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">Available Equity</p>
            <p className="text-sm font-700 text-green-600">TSh {availableEquity.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide">New Charge Rank</p>
            <p className="text-sm font-700 text-primary">#{nextRank}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Loan Account ID *</label>
              <input
                required
                value={form.loanAccountId}
                onChange={e => setForm(f => ({ ...f, loanAccountId: e.target.value }))}
                placeholder="LN-2024-XXXXXX"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Beneficiary ID *</label>
              <input
                required
                value={form.beneficiaryId}
                onChange={e => setForm(f => ({ ...f, beneficiaryId: e.target.value }))}
                placeholder="CUST-XXXXX"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Beneficiary Name *</label>
            <input
              required
              value={form.beneficiaryName}
              onChange={e => setForm(f => ({ ...f, beneficiaryName: e.target.value }))}
              placeholder="Full name of borrower"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Allocated Amount (TSh) *</label>
              <input
                required
                type="number"
                min={1}
                max={availableEquity}
                value={form.allocatedAmount || ''}
                onChange={e => setForm(f => ({ ...f, allocatedAmount: parseFloat(e.target.value) || 0 }))}
                placeholder="0"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {form.allocatedAmount > 0 && (
                <p className={`text-[10px] mt-0.5 ${wouldExceed ? 'text-red-600' : 'text-muted-foreground'}`}>
                  {wouldExceed ? `Exceeds available equity by TSh ${(form.allocatedAmount - availableEquity).toLocaleString()}` : `${((form.allocatedAmount / availableEquity) * 100).toFixed(1)}% of available equity`}
                </p>
              )}
            </div>
            <div>
              <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Start Date *</label>
              <input
                required
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>

          {/* 90% warning */}
          {wouldWarn && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <div className="flex items-start gap-2 mb-2">
                <AlertTriangle size={14} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 font-500">
                  This allocation will push collateral utilization to {newPct.toFixed(1)}%. Proceed with caution. Additional collateral may be required.
                </p>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)} className="rounded" />
                <span className="text-xs text-amber-700">I acknowledge this warning and wish to proceed</span>
              </label>
            </div>
          )}

          {/* 100% block */}
          {wouldExceed && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-600 shrink-0 mt-0.5" />
              <p className="text-xs text-red-700 font-500">
                Cannot link loan. Available equity: TSh {availableEquity.toLocaleString()}. Requested: TSh {form.allocatedAmount.toLocaleString()}
              </p>
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
          {warning && <p className="text-xs text-amber-600">{warning}</p>}

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || wouldExceed || (wouldWarn && !acknowledged)}
              className="px-4 py-2 text-sm font-600 text-white bg-primary rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {saving ? 'Linking…' : 'Link Loan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Release Modal ────────────────────────────────────────────────────────────

function ReleaseLinkModal({
  link,
  onClose,
  onSuccess,
}: {
  link: CollateralLoanLink;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [form, setForm] = useState<ReleaseLinkPayload>({
    releaseReason: 'LOAN_FULLY_REPAID',
    releaseDate: new Date().toISOString().slice(0, 10),
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const result = await collateralLinkService.releaseLink(link.id, form);
    setSaving(false);
    if (result.success) {
      toast.success('Collateral link released. Equity is now available.');
      onSuccess();
    } else {
      toast.error(result.error ?? 'Failed to release link');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center">
              <Unlink size={15} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-sm font-700 text-foreground">Release Collateral Link</h2>
              <p className="text-xs text-muted-foreground">{link.loanAccountId} · Charge #{link.chargeRank}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <p className="text-xs text-amber-700">
              Releasing this link will free <strong>TSh {link.allocatedAmount.toLocaleString()}</strong> of equity back to the collateral pool.
            </p>
          </div>
          <div>
            <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Release Reason</label>
            <select
              value={form.releaseReason}
              onChange={e => setForm(f => ({ ...f, releaseReason: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="LOAN_FULLY_REPAID">Loan Fully Repaid</option>
              <option value="COLLATERAL_SUBSTITUTION">Collateral Substitution</option>
              <option value="LOAN_CANCELLED">Loan Cancelled</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Release Date</label>
            <input
              type="date"
              value={form.releaseDate}
              onChange={e => setForm(f => ({ ...f, releaseDate: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-600 text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-50">
              {saving ? 'Releasing…' : 'Confirm Release'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Discharge Modal ──────────────────────────────────────────────────────────

function DischargeModal({
  collateralId,
  chargeRank,
  onClose,
  onSuccess,
}: {
  collateralId: string;
  chargeRank: number;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { user } = useAuth();
  const [form, setForm] = useState<DischargeChargePayload>({
    registryName: 'BRELA',
    dischargeNumber: '',
    dischargeDate: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    const result = await collateralLinkService.recordDischarge(collateralId, chargeRank, form, user.id);
    setSaving(false);
    if (result.success) {
      toast.success('Charge discharge recorded successfully');
      onSuccess();
    } else {
      toast.error(result.error ?? 'Failed to record discharge');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center">
              <FileCheck size={15} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-sm font-700 text-foreground">Record Charge Discharge</h2>
              <p className="text-xs text-muted-foreground">Charge Rank #{chargeRank}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="px-6 py-4 space-y-3">
          <div>
            <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Registry</label>
            <select
              value={form.registryName}
              onChange={e => setForm(f => ({ ...f, registryName: e.target.value }))}
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option>BRELA</option>
              <option>Lands Registry</option>
              <option>TRA</option>
              <option>DSE</option>
              <option>TASAC</option>
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Discharge Number *</label>
              <input
                required
                value={form.dischargeNumber}
                onChange={e => setForm(f => ({ ...f, dischargeNumber: e.target.value }))}
                placeholder="DIS-BR-2024-XXXXX"
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Discharge Date *</label>
              <input
                required
                type="date"
                value={form.dischargeDate}
                onChange={e => setForm(f => ({ ...f, dischargeDate: e.target.value }))}
                className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-600 text-muted-foreground uppercase tracking-wide block mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={2}
              placeholder="Optional notes about the discharge"
              className="w-full text-sm border border-border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground border border-border rounded-lg hover:bg-muted transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-600 text-white bg-green-600 rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50">
              {saving ? 'Saving…' : 'Record Discharge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  collateral: CollateralRecord;
}

export default function CollateralUtilizationTab({ collateral }: Props) {
  const [util, setUtil] = useState<CollateralUtilization | null>(null);
  const [chargeRegistry, setChargeRegistry] = useState<ChargeRegistry[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLinkModal, setShowLinkModal] = useState(false);
  const [releaseLink, setReleaseLink] = useState<CollateralLoanLink | null>(null);
  const [dischargeCharge, setDischargeCharge] = useState<{ rank: number } | null>(null);
  const [showRegistry, setShowRegistry] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [utilData, registryData] = await Promise.all([
      collateralLinkService.getUtilization(collateral.id),
      collateralLinkService.getChargeRegistry(collateral.id),
    ]);
    setUtil(utilData);
    setChargeRegistry(registryData);
    setLoading(false);
  }, [collateral.id]);

  useEffect(() => { load(); }, [load]);

  const activeLinks = util?.linkedLoans.filter(l => l.status === 'ACTIVE') ?? [];
  const releasedLinks = util?.linkedLoans.filter(l => l.status !== 'ACTIVE') ?? [];
  const nextRank = activeLinks.length > 0 ? Math.max(...activeLinks.map(l => l.chargeRank)) + 1 : 1;

  const statusBadge = (status: string) => {
    if (status === 'ACTIVE') return 'bg-green-100 text-green-700';
    if (status === 'RELEASED') return 'bg-gray-100 text-gray-600';
    if (status === 'DEFAULTED') return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-600';
  };

  const rankBadge = (rank: number) => {
    if (rank === 1) return 'bg-primary/10 text-primary';
    if (rank === 2) return 'bg-purple-100 text-purple-700';
    return 'bg-orange-100 text-orange-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <svg className="animate-spin w-6 h-6 text-primary" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
        </svg>
        <span className="ml-2 text-sm text-muted-foreground">Loading utilization data…</span>
      </div>
    );
  }

  // No valuation data yet
  if (!util || util.valuationAmount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center">
          <DollarSign size={24} className="text-primary" />
        </div>
        <div className="text-center">
          <p className="text-sm font-600 text-foreground">No Valuation Data</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs">
            This collateral does not have a valuation amount set. Valuation data is required to track utilization and link loans.
          </p>
        </div>
        <button
          onClick={() => setShowLinkModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors"
        >
          <Plus size={14} /> Link First Loan
        </button>
        {showLinkModal && (
          <LinkLoanModal
            collateral={collateral}
            availableEquity={0}
            maxSecurable={0}
            nextRank={1}
            onClose={() => setShowLinkModal(false)}
            onSuccess={() => { setShowLinkModal(false); load(); }}
          />
        )}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Summary Cards + Gauge ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <UtilizationGauge pct={util.utilizationPercentage} status={util.utilizationStatus} />

        <div className="md:col-span-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Valuation', value: `TSh ${(util.valuationAmount / 1e6).toFixed(1)}M`, icon: Building2, color: 'text-foreground' },
            { label: 'LTV Ratio', value: `${(util.ltvRatio * 100).toFixed(0)}%`, icon: Shield, color: 'text-primary' },
            { label: 'Max Securable', value: `TSh ${(util.maxSecurableAmount / 1e6).toFixed(1)}M`, icon: DollarSign, color: 'text-foreground' },
            {
              label: 'Available Equity',
              value: `TSh ${(util.availableEquity / 1e6).toFixed(1)}M`,
              icon: CheckCircle2,
              color: util.utilizationStatus === 'RED' ? 'text-red-600' : util.utilizationStatus === 'YELLOW' ? 'text-amber-600' : 'text-green-600',
            },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-xl border border-border p-3 shadow-sm">
              <div className="flex items-center gap-1.5 mb-1.5">
                <card.icon size={12} className="text-muted-foreground" />
                <p className="text-[10px] font-600 text-muted-foreground uppercase tracking-wide">{card.label}</p>
              </div>
              <p className={`text-base font-700 ${card.color}`}>{card.value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Utilization Bar ── */}
      <div className="bg-white rounded-xl border border-border p-4 shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-600 text-muted-foreground uppercase tracking-wide">Collateral Utilization</p>
          <span className="text-xs font-700 text-foreground">{util.utilizationPercentage}%</span>
        </div>
        <div className="h-3 bg-muted rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-700 ${util.utilizationStatus === 'RED' ? 'bg-red-500' : util.utilizationStatus === 'YELLOW' ? 'bg-amber-500' : 'bg-green-500'}`}
            style={{ width: `${Math.min(100, util.utilizationPercentage)}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1.5 text-[10px] text-muted-foreground">
          <span>TSh {(util.totalSecuredAmount / 1e6).toFixed(1)}M secured</span>
          <span>TSh {(util.availableEquity / 1e6).toFixed(1)}M available</span>
        </div>
      </div>

      {/* ── Active Linked Loans ── */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-border">
          <div className="flex items-center gap-2">
            <Link2 size={14} className="text-primary" />
            <h3 className="text-sm font-700 text-foreground">Active Loan Links</h3>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{activeLinks.length}</span>
          </div>
          <button
            onClick={() => setShowLinkModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white rounded-lg text-xs font-600 hover:bg-primary/90 transition-colors"
          >
            <Plus size={12} /> Link New Loan
          </button>
        </div>

        {activeLinks.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Link2 size={28} className="text-muted-foreground/30 mb-2" />
            <p className="text-sm text-muted-foreground">No active loan links</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Link a loan to start tracking utilization</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/30 border-b border-border">
                  <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Rank</th>
                  <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Loan ID</th>
                  <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Beneficiary</th>
                  <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Allocated</th>
                  <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Start Date</th>
                  <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Actions</th>
                </tr>
              </thead>
              <tbody>
                {activeLinks.map(link => (
                  <tr key={link.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${rankBadge(link.chargeRank)}`}>
                        {link.chargeRank === 1 ? '1st' : link.chargeRank === 2 ? '2nd' : `${link.chargeRank}th`} Charge
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{link.loanAccountId}</td>
                    <td className="px-4 py-3">
                      <p className="text-xs font-500 text-foreground">{link.beneficiaryName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">{link.beneficiaryId}</p>
                    </td>
                    <td className="px-4 py-3 text-xs font-600 text-foreground font-mono">TSh {link.allocatedAmount.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">{link.startDate}</td>
                    <td className="px-4 py-3">
                      <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${statusBadge(link.status)}`}>{link.status}</span>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => setReleaseLink(link)}
                        className="flex items-center gap-1 text-xs text-amber-600 hover:text-amber-700 font-500 hover:underline"
                      >
                        <Unlink size={11} /> Release
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Charge Registry ── */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        <button
          onClick={() => setShowRegistry(v => !v)}
          className="w-full flex items-center justify-between px-5 py-3 border-b border-border hover:bg-muted/20 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileCheck size={14} className="text-primary" />
            <h3 className="text-sm font-700 text-foreground">Charge Registry (BRELA / Lands)</h3>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{chargeRegistry.length}</span>
          </div>
          {showRegistry ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
        </button>

        {showRegistry && (
          chargeRegistry.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileCheck size={24} className="text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No charge registry entries</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/30 border-b border-border">
                    <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Rank</th>
                    <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Registry</th>
                    <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Reg. Number</th>
                    <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Reg. Date</th>
                    <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Discharge #</th>
                    <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                    <th className="text-left px-4 py-2.5 text-xs font-600 text-muted-foreground uppercase tracking-wide">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {chargeRegistry.map(entry => (
                    <tr key={entry.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3">
                        <span className={`text-xs font-700 px-2 py-0.5 rounded-full ${rankBadge(entry.chargeRank)}`}>
                          #{entry.chargeRank}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-500 text-foreground">{entry.registryName}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.registrationNumber ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{entry.registrationDate ?? '—'}</td>
                      <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{entry.dischargeNumber ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[10px] font-600 px-2 py-0.5 rounded-full ${entry.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {entry.status === 'ACTIVE' && (
                          <button
                            onClick={() => setDischargeCharge({ rank: entry.chargeRank })}
                            className="flex items-center gap-1 text-xs text-green-600 hover:text-green-700 font-500 hover:underline"
                          >
                            <FileCheck size={11} /> Discharge
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* ── Released Links History ── */}
      {releasedLinks.length > 0 && (
        <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-border">
            <Calendar size={14} className="text-muted-foreground" />
            <h3 className="text-sm font-700 text-foreground">Released Links History</h3>
            <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{releasedLinks.length}</span>
          </div>
          <div className="divide-y divide-border/50">
            {releasedLinks.map(link => (
              <div key={link.id} className="flex items-center gap-4 px-5 py-3 bg-muted/10">
                <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">#{link.chargeRank}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-500 text-foreground">{link.loanAccountId}</p>
                  <p className="text-[10px] text-muted-foreground">{link.beneficiaryName} · TSh {link.allocatedAmount.toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <span className="text-[10px] font-600 px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">RELEASED</span>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{link.releaseDate ?? link.endDate ?? '—'}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Modals ── */}
      {showLinkModal && (
        <LinkLoanModal
          collateral={collateral}
          availableEquity={util.availableEquity}
          maxSecurable={util.maxSecurableAmount}
          nextRank={nextRank}
          onClose={() => setShowLinkModal(false)}
          onSuccess={() => { setShowLinkModal(false); load(); }}
        />
      )}
      {releaseLink && (
        <ReleaseLinkModal
          link={releaseLink}
          onClose={() => setReleaseLink(null)}
          onSuccess={() => { setReleaseLink(null); load(); }}
        />
      )}
      {dischargeCharge && (
        <DischargeModal
          collateralId={collateral.id}
          chargeRank={dischargeCharge.rank}
          onClose={() => setDischargeCharge(null)}
          onSuccess={() => { setDischargeCharge(null); load(); }}
        />
      )}
    </div>
  );
}
