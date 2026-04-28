'use client';
import React, { useState } from 'react';
import { Zap, Star, RefreshCw, User, Search, Copy, CheckCircle2, AlertCircle, ArrowRight,  } from 'lucide-react';

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

// ─── Mock Data ────────────────────────────────────────────────────────────────

const mockCustomers: Customer[] = [
  {
    id: 'CUST-001',
    name: 'Tanzanian Steel Industries Ltd',
    tier: 'PREMIER',
    tierEffectiveDate: '2023-01-15',
    reason: 'High net worth, 8 years relationship, zero defaults',
    relationshipYears: 8,
    totalLoans: 12,
    defaultCount: 0,
    lastCollateralType: 'Land & Property',
    lastValuation: '2,500,000,000',
  },
  {
    id: 'CUST-002',
    name: 'Kilimanjaro Coffee Exporters',
    tier: 'PREMIER',
    tierEffectiveDate: '2022-06-01',
    reason: 'High net worth, 6 years relationship, zero defaults',
    relationshipYears: 6,
    totalLoans: 8,
    defaultCount: 0,
    lastCollateralType: 'Equipment',
    lastValuation: '850,000,000',
  },
  {
    id: 'CUST-003',
    name: 'Dar es Salaam Logistics Co.',
    tier: 'REPEAT',
    tierEffectiveDate: '2024-03-10',
    reason: 'Previous successful loan with same collateral type',
    relationshipYears: 3,
    totalLoans: 4,
    defaultCount: 0,
    lastCollateralType: 'Motor Vehicles',
    lastValuation: '320,000,000',
  },
  {
    id: 'CUST-004',
    name: 'Mwanza Fish Processing Ltd',
    tier: 'REPEAT',
    tierEffectiveDate: '2024-01-20',
    reason: 'Repeat borrower with clean repayment history',
    relationshipYears: 2,
    totalLoans: 3,
    defaultCount: 0,
    lastCollateralType: 'Equipment',
    lastValuation: '180,000,000',
  },
  {
    id: 'CUST-005',
    name: 'Arusha New Ventures Ltd',
    tier: 'STANDARD',
    tierEffectiveDate: '2024-06-01',
    reason: 'New customer, first-time borrower',
    relationshipYears: 0,
    totalLoans: 0,
    defaultCount: 0,
  },
];

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

// ─── Main Component ───────────────────────────────────────────────────────────

export default function FastTrackContent() {
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(mockCustomers[0]);
  const [cloneSuccess, setCloneSuccess] = useState(false);
  const [activeTab, setActiveTab] = useState<'tiers' | 'workflow' | 'form'>('tiers');

  const filtered = mockCustomers.filter((c) =>
    !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.id.toLowerCase().includes(search.toLowerCase())
  );

  const handleClone = () => {
    setCloneSuccess(true);
    setTimeout(() => setCloneSuccess(false), 3000);
  };

  const isFastTrack = selectedCustomer && selectedCustomer.tier !== 'STANDARD';
  const conf = selectedCustomer ? tierConfig[selectedCustomer.tier] : null;

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
          const count = mockCustomers.filter((cu) => cu.tier === tier).length;
          return (
            <div key={tier} className={`rounded-xl p-5 border shadow-card ${c.bg} ${c.border}`}>
              <div className="flex items-center gap-2 mb-3">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${c.bg}`}>
                  <TierIcon size={16} className={c.color} />
                </div>
                <div>
                  <p className={`text-sm font-700 ${c.color}`}>{c.label}</p>
                  <p className="text-xs text-muted-foreground">{count} customers</p>
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
              {filtered.map((c) => (
                <CustomerCard key={c.id} customer={c} onSelect={setSelectedCustomer} selected={selectedCustomer?.id === c.id} />
              ))}
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
                  {isFastTrack && selectedCustomer.lastCollateralType && (
                    <button
                      onClick={handleClone}
                      className={`flex items-center gap-1.5 px-3 py-2 text-sm font-600 rounded-lg transition-colors ${
                        cloneSuccess
                          ? 'bg-green-100 text-green-700 border border-green-200' :'bg-white border border-border text-foreground hover:bg-muted'
                      }`}
                    >
                      {cloneSuccess ? <CheckCircle2 size={14} /> : <Copy size={14} />}
                      {cloneSuccess ? 'Cloned!' : 'Clone Previous Collateral'}
                    </button>
                  )}
                </div>

                {selectedCustomer.lastCollateralType && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4 pt-4 border-t border-border/50">
                    <div>
                      <p className="text-xs text-muted-foreground">Last Collateral Type</p>
                      <p className="text-sm font-600 text-foreground">{selectedCustomer.lastCollateralType}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Last Valuation (TZS)</p>
                      <p className="text-sm font-600 text-foreground">{selectedCustomer.lastValuation}</p>
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
          ) : (
            <div className="flex items-center justify-center h-64 text-muted-foreground">
              <div className="text-center">
                <User size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Select a customer to view fast track options</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
