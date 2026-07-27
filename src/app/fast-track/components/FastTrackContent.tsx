'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Zap, Star, RefreshCw, User, Search, Copy, CheckCircle2, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { obligorService, type Obligor } from '@/lib/supabase/obligorService';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type CustomerTier = 'PREMIER' | 'REPEAT' | 'STANDARD';

interface Customer {
  id: string;
  name: string;
  tier: CustomerTier;
  tierEffectiveDate: string;
  tierExpiryDate?: string;
  reason: string;
  relationshipYears: number;
  totalLoans: number;
  defaultCount: number;
  lastCollateralType?: string;
  lastValuation?: string;
}

interface WorkflowStep {
  step: string;
  standard: string;
  fastTrack: string;
  skipped: boolean;
}

// ─── Tier persistence helpers ─────────────────────────────────────────────────

async function loadTierMap(): Promise<Record<string, { tier: CustomerTier; since: string; reason: string }>> {
  try {
    const supabase = createClient();
    const { data } = await supabase
      .from('system_config')
      .select('config_value')
      .eq('config_key', 'fast_track_tiers')
      .maybeSingle();
    if (data?.config_value) return JSON.parse(data.config_value as string);
  } catch { /* silent */ }
  return {};
}

async function saveTierMap(map: Record<string, { tier: CustomerTier; since: string; reason: string }>): Promise<void> {
  try {
    const supabase = createClient();
    await supabase
      .from('system_config')
      .upsert({ config_key: 'fast_track_tiers', config_value: JSON.stringify(map) }, { onConflict: 'config_key' });
  } catch { /* silent */ }
}

// ─── Derive customer from obligor + tier map ──────────────────────────────────

function obligorToCustomer(
  o: Obligor,
  tierMap: Record<string, { tier: CustomerTier; since: string; reason: string }>,
  collateralMap: Record<string, { type: string; value: string; count: number }>
): Customer {
  const saved = tierMap[o.id];
  const tier: CustomerTier = saved?.tier ?? (o.riskRating === 'LOW' ? 'PREMIER' : o.riskRating === 'MEDIUM' ? 'REPEAT' : 'STANDARD');
  const since = saved?.since ?? (o.createdAt ? o.createdAt.slice(0, 10) : new Date().toISOString().slice(0, 10));
  const reason = saved?.reason ?? (
    tier === 'PREMIER' ? 'Low risk rating, established relationship' :
    tier === 'REPEAT'? 'Medium risk, repeat borrower' : 'Standard customer — full workflow required'
  );

  const collInfo = collateralMap[o.id];
  const createdYear = o.createdAt ? new Date(o.createdAt).getFullYear() : new Date().getFullYear();
  const relationshipYears = new Date().getFullYear() - createdYear;

  return {
    id: o.obligorCode,
    name: o.fullName,
    tier,
    tierEffectiveDate: since,
    reason,
    relationshipYears: Math.max(0, relationshipYears),
    totalLoans: collInfo?.count ?? 0,
    defaultCount: 0,
    lastCollateralType: collInfo?.type,
    lastValuation: collInfo?.value,
  };
}

// ─── Workflow Steps ───────────────────────────────────────────────────────────

const workflowSteps: WorkflowStep[] = [
  { step: 'Collateral Capture', standard: 'Manual entry of all fields', fastTrack: 'Pre-filled from previous loans', skipped: false },
  { step: 'Valuation', standard: 'Required every time', fastTrack: 'Use previous valuation if <6 months old', skipped: false },
  { step: 'Document Upload', standard: 'All documents required', fastTrack: 'Reuse verified documents', skipped: false },
  { step: 'Legal Review', standard: 'Full review (3–5 days)', fastTrack: 'Simplified review (1 day)', skipped: false },
  { step: 'Credit Approval', standard: 'Full approval committee', fastTrack: 'Single approver for known customers', skipped: false },
  { step: 'Registry Submission', standard: 'Standard queue', fastTrack: 'Priority queue', skipped: false },
  { step: 'Identity Verification', standard: 'Full KYC check', fastTrack: 'Skip — already verified', skipped: true },
  { step: 'Address Verification', standard: 'Required', fastTrack: 'Skip — on file', skipped: true },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const tierConfig: Record<CustomerTier, { label: string; color: string; bg: string; border: string; icon: React.ElementType; benefits: string[] }> = {
  PREMIER: {
    label: 'Premier',
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    icon: Star,
    benefits: ['Pre-filled collateral forms', 'Reduced approval steps', 'Priority registry processing', 'Dedicated relationship manager'],
  },
  REPEAT: {
    label: 'Repeat',
    color: 'text-blue-700',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    icon: RefreshCw,
    benefits: ['Auto-populate collateral details', 'Skip certain validation steps', 'Faster turnaround time'],
  },
  STANDARD: {
    label: 'Standard',
    color: 'text-gray-600',
    bg: 'bg-gray-50',
    border: 'border-gray-200',
    icon: User,
    benefits: ['Full workflow', 'Standard processing time', 'Complete KYC required'],
  },
};

function TierBadge({ tier }: { tier: CustomerTier }) {
  const conf = tierConfig[tier];
  const TierIcon = conf.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-700 px-2 py-1 rounded-full border ${conf.bg} ${conf.color} ${conf.border}`}>
      <TierIcon size={11} />
      {conf.label}
    </span>
  );
}

// ─── Customer Card ────────────────────────────────────────────────────────────

function CustomerCard({ customer, onSelect, selected }: { customer: Customer; onSelect: (c: Customer) => void; selected: boolean }) {
  const conf = tierConfig[customer.tier];
  return (
    <div
      onClick={() => onSelect(customer)}
      className={`p-4 rounded-xl border cursor-pointer transition-all ${
        selected ? 'border-primary bg-primary/5 shadow-md' : 'border-border bg-white hover:border-primary/40 hover:shadow-card'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div>
          <p className="text-sm font-700 text-foreground">{customer.name}</p>
          <p className="text-xs text-muted-foreground">{customer.id}</p>
        </div>
        <TierBadge tier={customer.tier} />
      </div>
      <div className="grid grid-cols-3 gap-2 mt-3">
        <div>
          <p className="text-xs text-muted-foreground">Relationship</p>
          <p className="text-sm font-600 text-foreground">{customer.relationshipYears}y</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Total Loans</p>
          <p className="text-sm font-600 text-foreground">{customer.totalLoans}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">Defaults</p>
          <p className={`text-sm font-600 ${customer.defaultCount === 0 ? 'text-green-600' : 'text-red-600'}`}>{customer.defaultCount}</p>
        </div>
      </div>
    </div>
  );
}

// ─── Tier Edit Modal ──────────────────────────────────────────────────────────

function TierEditModal({
  customer,
  onSave,
  onClose,
}: {
  customer: Customer;
  onSave: (tier: CustomerTier, reason: string) => void;
  onClose: () => void;
}) {
  const [tier, setTier] = useState<CustomerTier>(customer.tier);
  const [reason, setReason] = useState(customer.reason);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm border border-border">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-700 text-foreground">Update Customer Tier</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{customer.name}</p>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-2">Tier</label>
            <div className="space-y-2">
              {(['PREMIER', 'REPEAT', 'STANDARD'] as CustomerTier[]).map((t) => (
                <label key={t} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${tier === t ? `${tierConfig[t].bg} ${tierConfig[t].border}` : 'border-border bg-white hover:bg-muted/30'}`}>
                  <input type="radio" name="tier" value={t} checked={tier === t} onChange={() => setTier(t)} className="accent-primary" />
                  <TierBadge tier={t} />
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-600 text-muted-foreground mb-1">Reason / Notes</label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
              placeholder="Reason for tier assignment..."
            />
          </div>
        </div>
        <div className="flex items-center gap-2 px-5 py-4 border-t border-border">
          <button onClick={() => onSave(tier, reason)} className="flex-1 px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
            Save Tier
          </button>
          <button onClick={onClose} className="px-4 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FastTrackContent() {
  const [search, setSearch] = useState('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [cloneSuccess, setCloneSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'workflow' | 'form'>('workflow');
  const [loading, setLoading] = useState(true);
  const [tierMap, setTierMap] = useState<Record<string, { tier: CustomerTier; since: string; reason: string }>>({});
  const [editingTier, setEditingTier] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [obligors, savedTierMap] = await Promise.all([
        obligorService.getAll(),
        loadTierMap(),
      ]);

      // Load collateral counts per obligor
      const supabase = createClient();
      const { data: collaterals } = await supabase
        .from('collateral_records')
        .select('obligor_ref_id, collateral_type, value_tsh')
        .order('created_at', { ascending: false });

      const collateralMap: Record<string, { type: string; value: string; count: number }> = {};
      (collaterals ?? []).forEach((c: any) => {
        if (!c.obligor_ref_id) return;
        if (!collateralMap[c.obligor_ref_id]) {
          collateralMap[c.obligor_ref_id] = { type: c.collateral_type ?? '', value: c.value_tsh ?? '0', count: 0 };
        }
        collateralMap[c.obligor_ref_id].count++;
      });

      const mapped = obligors.map((o) => obligorToCustomer(o, savedTierMap, collateralMap));
      setTierMap(savedTierMap);
      setCustomers(mapped);
      if (mapped.length > 0) setSelectedCustomer(mapped[0]);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleTierSave = async (tier: CustomerTier, reason: string) => {
    if (!selectedCustomer) return;

    // Find the obligor id from the obligor code
    const supabase = createClient();
    const { data: obligorRow } = await supabase
      .from('obligors')
      .select('id')
      .eq('obligor_code', selectedCustomer.id)
      .maybeSingle();

    const obligorId = obligorRow?.id ?? selectedCustomer.id;
    const newMap = {
      ...tierMap,
      [obligorId]: { tier, since: new Date().toISOString().slice(0, 10), reason },
    };
    setTierMap(newMap);
    await saveTierMap(newMap);

    // Update local customer list
    const updated: Customer = { ...selectedCustomer, tier, reason, tierEffectiveDate: new Date().toISOString().slice(0, 10) };
    setCustomers((prev) => prev.map((c) => c.id === selectedCustomer.id ? updated : c));
    setSelectedCustomer(updated);
    setEditingTier(false);
  };

  const filtered = customers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleClone = () => {
    setCloneSuccess(true);
    setTimeout(() => setCloneSuccess(false), 3000);
  };

  const isFastTrack = selectedCustomer && selectedCustomer.tier !== 'STANDARD';
  const conf = selectedCustomer ? tierConfig[selectedCustomer.tier] : null;

  const tierCounts: Record<CustomerTier, number> = { PREMIER: 0, REPEAT: 0, STANDARD: 0 };
  customers.forEach((c) => { tierCounts[c.tier]++; });

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
          <Zap size={18} className="text-amber-600" />
        </div>
        <div>
          <h1 className="text-xl font-700 text-foreground">Fast Track for Premier & Repeat Customers</h1>
          <p className="text-sm text-muted-foreground">Streamlined collateral registration for high-value and returning customers</p>
        </div>
      </div>

      {/* Tier Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {(['PREMIER', 'REPEAT', 'STANDARD'] as CustomerTier[]).map((tier) => {
          const c = tierConfig[tier];
          const TierIcon = c.icon;
          const count = tierCounts[tier];
          return (
            <div key={tier} className={`rounded-xl p-5 border shadow-card ${c.bg} ${c.border}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg}`}>
                  <TierIcon size={16} className={c.color} />
                </div>
                <div>
                  <p className={`text-sm font-700 ${c.color}`}>{c.label}</p>
                  <p className="text-xs text-muted-foreground">
                    {loading ? '…' : `${count} customer${count !== 1 ? 's' : ''}`}
                  </p>
                </div>
              </div>
              <ul className="space-y-1">
                {c.benefits.map((b) => (
                  <li key={b} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                    <CheckCircle2 size={11} className={`${c.color} mt-0.5 shrink-0`} />
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Customer List */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-xl shadow-card overflow-hidden">
            <div className="p-4 border-b border-border">
              <h2 className="text-sm font-700 text-foreground mb-3">Customer Search</h2>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search customers..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 text-sm border border-border rounded-lg bg-muted/30 focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="p-3 space-y-2 max-h-[500px] overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-10 text-muted-foreground">
                  <Loader2 size={20} className="animate-spin mr-2" />
                  <span className="text-sm">Loading obligors…</span>
                </div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <User size={24} className="mx-auto mb-2 opacity-30" />
                  <p className="text-xs">{search ? 'No customers match your search' : 'No obligors found in database'}</p>
                </div>
              ) : (
                filtered.map((c) => (
                  <CustomerCard key={c.id} customer={c} onSelect={setSelectedCustomer} selected={selectedCustomer?.id === c.id} />
                ))
              )}
            </div>
          </div>
        </div>

        {/* Customer Detail */}
        <div className="lg:col-span-2 space-y-4">
          {selectedCustomer && conf ? (
            <>
              {/* Customer Header */}
              <div className={`rounded-xl p-5 border shadow-card ${conf.bg} ${conf.border}`}>
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <TierBadge tier={selectedCustomer.tier} />
                      {isFastTrack && (
                        <span className="inline-flex items-center gap-1 text-xs font-700 px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                          <Zap size={10} /> Fast Track Eligible
                        </span>
                      )}
                    </div>
                    <h2 className="text-base font-700 text-foreground">{selectedCustomer.name}</h2>
                    <p className="text-xs text-muted-foreground">{selectedCustomer.id} · {selectedCustomer.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setEditingTier(true)}
                      className="flex items-center gap-1.5 px-3 py-2 text-xs font-600 rounded-lg bg-white border border-border text-foreground hover:bg-muted transition-colors"
                    >
                      <Star size={12} />
                      Edit Tier
                    </button>
                    {isFastTrack && selectedCustomer.lastCollateralType && (
                      <button
                        onClick={handleClone}
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-600 rounded-lg transition-colors ${
                          cloneSuccess
                            ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-border text-foreground hover:bg-muted'
                        }`}
                      >
                        {cloneSuccess ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                        {cloneSuccess ? 'Cloned!' : 'Clone Previous Collateral'}
                      </button>
                    )}
                  </div>
                </div>

                {(selectedCustomer.lastCollateralType || selectedCustomer.totalLoans > 0) && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Last Collateral Type</p>
                      <p className="text-sm font-600 text-foreground">{selectedCustomer.lastCollateralType ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Valuation (TZS)</p>
                      <p className="text-sm font-600 text-foreground">{selectedCustomer.lastValuation ?? '—'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Relationship</p>
                      <p className="text-sm font-600 text-foreground">{selectedCustomer.relationshipYears} years</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Tier Since</p>
                      <p className="text-sm font-600 text-foreground">{selectedCustomer.tierEffectiveDate}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Tabs */}
              <div className="bg-white border border-border rounded-xl shadow-card overflow-hidden">
                <div className="flex border-b border-border">
                  {[
                    { key: 'workflow' as const, label: 'Workflow Comparison' },
                    { key: 'form' as const, label: 'Fast Track Form' },
                  ].map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`px-4 py-3 text-sm font-500 border-b-2 transition-colors ${
                        activeTab === tab.key ? 'border-primary text-primary' : 'border-transparent text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                <div className="p-5">
                  {activeTab === 'workflow' && (
                    <div>
                      <p className="text-xs text-muted-foreground mb-4">
                        {isFastTrack ? `Fast Track workflow for ${conf.label} tier customers` : 'Standard workflow — full process required'}
                      </p>
                      <div className="space-y-2">
                        {workflowSteps.map((step, i) => (
                          <div key={step.step} className={`flex items-start gap-3 p-3 rounded-lg border ${
                            isFastTrack && step.skipped ? 'bg-gray-50 border-gray-200 opacity-60' : 'bg-white border-border'
                          }`}>
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-700 shrink-0 mt-0.5 ${
                              isFastTrack && step.skipped ? 'bg-gray-200 text-gray-500' : 'bg-primary/10 text-primary'
                            }`}>
                              {isFastTrack && step.skipped ? '—' : i + 1}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="text-sm font-600 text-foreground">{step.step}</p>
                                {isFastTrack && step.skipped && (
                                  <span className="text-xs font-600 px-1.5 py-0.5 rounded bg-gray-100 text-gray-500">Skipped</span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span className="line-through opacity-60">{step.standard}</span>
                                {isFastTrack && (
                                  <>
                                    <ArrowRight size={11} className="text-primary shrink-0" />
                                    <span className="text-primary font-500">{step.fastTrack}</span>
                                  </>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeTab === 'form' && (
                    <div>
                      <div className={`flex items-start gap-2 p-3 rounded-lg mb-4 ${isFastTrack ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
                        {isFastTrack ? <CheckCircle2 size={15} className="text-green-600 mt-0.5 shrink-0" /> : <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />}
                        <p className="text-xs font-500 text-foreground">
                          {isFastTrack
                            ? `Fast Track active: ${selectedCustomer.lastCollateralType ? 'Previous collateral details pre-filled.' : 'Reduced form fields shown.'} Audit log will record fast track usage.`
                            : 'Standard workflow: All fields required. Complete KYC and full validation.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        {[
                          { label: 'Customer ID', value: selectedCustomer.id, readOnly: true },
                          { label: 'Customer Name', value: selectedCustomer.name, readOnly: true },
                          { label: 'Collateral Type', value: isFastTrack ? selectedCustomer.lastCollateralType || '' : '', readOnly: false, placeholder: 'Select type...' },
                          { label: 'Valuation (TZS)', value: isFastTrack && selectedCustomer.lastValuation ? selectedCustomer.lastValuation : '', readOnly: false, placeholder: 'Enter valuation...' },
                          { label: 'Registry', value: '', readOnly: false, placeholder: 'Select registry...' },
                          { label: 'Title Deed Number', value: '', readOnly: false, placeholder: 'Enter title deed...' },
                        ].map((field) => (
                          <div key={field.label}>
                            <label className="block text-xs font-600 text-muted-foreground uppercase tracking-wider mb-1">{field.label}</label>
                            <input
                              type="text"
                              defaultValue={field.value}
                              readOnly={field.readOnly}
                              placeholder={field.placeholder}
                              className={`w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/20 ${
                                field.readOnly ? 'bg-muted/50 border-border text-muted-foreground' : 'bg-white border-border'
                              }`}
                            />
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-3 mt-5 pt-4 border-t border-border">
                        <button className="flex items-center gap-1.5 px-4 py-2 text-sm font-600 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors">
                          <Zap size={14} />
                          {isFastTrack ? 'Submit Fast Track' : 'Submit Standard'}
                        </button>
                        <button className="px-4 py-2 text-sm font-500 text-muted-foreground bg-white border border-border rounded-lg hover:bg-muted transition-colors">
                          Save Draft
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : !loading ? (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <User size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a customer to view fast track options</p>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* Tier Edit Modal */}
      {editingTier && selectedCustomer && (
        <TierEditModal
          customer={selectedCustomer}
          onSave={handleTierSave}
          onClose={() => setEditingTier(false)}
        />
      )}
    </div>
  );
}
