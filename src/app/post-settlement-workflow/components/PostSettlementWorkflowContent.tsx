'use client';
import React, { useState, useCallback, useEffect } from 'react';
import { FileCheck2, Users, CalendarClock, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, ClipboardCheck, Send, CalendarDays, Building2, User, Phone, Mail, FileText, RefreshCw, Search, BadgeCheck, XCircle, ArrowRight, Landmark, Package, Truck, MapPin, ShieldCheck, PenLine, Bell, CheckCheck } from 'lucide-react';
import { loanService, Loan } from '@/lib/supabase/loanService';
import { createClient } from '@/lib/supabase/client';
import Icon from '@/components/ui/AppIcon';


// ── Types ─────────────────────────────────────────────────────────────────────

type SignOffStatus = 'Pending' | 'Signed' | 'Rejected' | 'Awaiting Review';
type ConfirmationStatus = 'Pending' | 'Confirmed' | 'Declined' | 'Sent';
type ReturnStatus = 'Scheduled' | 'In Transit' | 'Delivered' | 'Pending Schedule' | 'Overdue';
type OverallStatus = 'In Progress' | 'Completed' | 'Blocked' | 'Pending';

interface DischargeDocument {
  id: string;
  documentName: string;
  documentType: string;
  signedBy?: string;
  signedAt?: string;
  status: SignOffStatus;
  notes?: string;
  dueDate: string;
}

interface StakeholderConfirmation {
  id: string;
  stakeholderName: string;
  role: string;
  organisation: string;
  email: string;
  phone?: string;
  confirmationType: string;
  status: ConfirmationStatus;
  sentAt?: string;
  confirmedAt?: string;
  notes?: string;
}

interface CollateralReturn {
  id: string;
  collateralRef: string;
  collateralType: string;
  description: string;
  currentLocation: string;
  returnTo: string;
  scheduledDate?: string;
  actualReturnDate?: string;
  status: ReturnStatus;
  handlerName?: string;
  trackingRef?: string;
  notes?: string;
}

interface PostSettlementCase {
  id: string;
  loanRef: string;
  obligorName: string;
  facilityType: string;
  settlementDate: string;
  totalFacilityAmount: number;
  currency: string;
  overallStatus: OverallStatus;
  dischargeDocuments: DischargeDocument[];
  stakeholderConfirmations: StakeholderConfirmation[];
  collateralReturns: CollateralReturn[];
  expanded: boolean;
  activeTab: 'discharge' | 'stakeholders' | 'returns';
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'TZS'): string {
  if (!n && n !== 0) return '—';
  if (n >= 1_000_000_000) return `${currency} ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}K`;
  return `${currency} ${n.toLocaleString()}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Derive a PostSettlementCase from a Loan + its linked collaterals ──────────

function deriveOverallStatus(loan: Loan, collaterals: { releaseStatus: string }[]): OverallStatus {
  if (loan.loanStatus === 'Closed') return 'Completed';
  if (loan.loanStatus === 'Defaulted' || loan.loanStatus === 'Written Off') return 'Blocked';
  const hasPending = collaterals.some(c => c.releaseStatus !== 'RELEASED' && c.releaseStatus !== 'Released');
  if (hasPending) return 'In Progress';
  return 'Pending';
}

function buildDischargeDocuments(loan: Loan, collaterals: { collateralRef: string; collateralType: string }[]): DischargeDocument[] {
  return collaterals.map((c, i) => ({
    id: `dd-${loan.id}-${i}`,
    documentName: `Discharge of ${c.collateralType} – ${c.collateralRef}`,
    documentType: `${c.collateralType} Discharge`,
    status: loan.loanStatus === 'Closed' ? 'Signed' : 'Pending',
    dueDate: loan.maturityDate ?? new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
    signedBy: loan.loanStatus === 'Closed' ? 'Legal Officer' : undefined,
    signedAt: loan.loanStatus === 'Closed' ? loan.maturityDate ?? undefined : undefined,
  }));
}

function buildStakeholderConfirmations(loan: Loan): StakeholderConfirmation[] {
  const confirmations: StakeholderConfirmation[] = [];
  if (loan.obligorName) {
    confirmations.push({
      id: `sc-${loan.id}-obligor`,
      stakeholderName: loan.obligorName,
      role: 'Obligor',
      organisation: loan.obligorName,
      email: `${loan.obligorName.toLowerCase().replace(/\s+/g, '.')}@example.co.tz`,
      confirmationType: 'Settlement Acknowledgement',
      status: loan.loanStatus === 'Closed' ? 'Confirmed' : 'Pending',
      sentAt: loan.loanStatus === 'Closed' ? loan.maturityDate ?? undefined : undefined,
      confirmedAt: loan.loanStatus === 'Closed' ? loan.maturityDate ?? undefined : undefined,
    });
  }
  confirmations.push({
    id: `sc-${loan.id}-legal`,
    stakeholderName: 'Legal Counsel',
    role: 'Legal Officer',
    organisation: 'Bank Legal Department',
    email: 'legal@bank.co.tz',
    confirmationType: 'Discharge Sign-Off',
    status: loan.loanStatus === 'Closed' ? 'Confirmed' : 'Pending',
  });
  return confirmations;
}

function buildCollateralReturns(loan: Loan, collaterals: { collateralRef: string; collateralType: string; collateralDescription: string; releaseStatus: string }[]): CollateralReturn[] {
  return collaterals.map((c, i) => {
    const released = c.releaseStatus === 'RELEASED' || c.releaseStatus === 'Released';
    return {
      id: `cr-${loan.id}-${i}`,
      collateralRef: c.collateralRef,
      collateralType: c.collateralType,
      description: c.collateralDescription || c.collateralRef,
      currentLocation: released ? 'Returned to Owner' : 'Bank Custody / Archive Vault',
      returnTo: loan.obligorName ?? 'Obligor',
      scheduledDate: loan.maturityDate ?? undefined,
      actualReturnDate: released ? loan.maturityDate ?? undefined : undefined,
      status: released ? 'Delivered' : loan.loanStatus === 'Closed' ? 'Scheduled' : 'Pending Schedule',
    };
  });
}

async function fetchPostSettlementCases(): Promise<PostSettlementCase[]> {
  const supabase = createClient();

  // Fetch all loans (we'll show all loans that have linked collaterals)
  const loans = await loanService.getAll();
  if (!loans || loans.length === 0) return [];

  // Fetch collateral_loan_links with collateral details
  const { data: links } = await supabase
    .from('collateral_loan_links')
    .select(`
      id,
      loan_id,
      collateral_record_id,
      allocated_amount,
      release_status,
      discharge_date,
      discharge_number,
      collateral_records (
        collateral_id,
        type,
        description,
        registry
      )
    `);

  const linksByLoan: Record<string, typeof links> = {};
  if (links) {
    for (const link of links) {
      if (!linksByLoan[link.loan_id]) linksByLoan[link.loan_id] = [];
      linksByLoan[link.loan_id]!.push(link);
    }
  }

  // Only include loans that have at least one linked collateral
  const cases: PostSettlementCase[] = loans
    .filter(loan => linksByLoan[loan.id] && linksByLoan[loan.id]!.length > 0)
    .map(loan => {
      const loanLinks = linksByLoan[loan.id] ?? [];
      const collaterals = loanLinks.map(l => ({
        collateralRef: (l.collateral_records as any)?.collateral_id ?? l.collateral_record_id,
        collateralType: (l.collateral_records as any)?.type ?? 'Collateral',
        collateralDescription: (l.collateral_records as any)?.description ?? '',
        releaseStatus: l.release_status ?? 'Pending',
        allocatedAmount: l.allocated_amount ?? 0,
        dischargeDate: l.discharge_date,
        dischargeNumber: l.discharge_number,
      }));

      const overallStatus = deriveOverallStatus(loan, collaterals);

      return {
        id: loan.id,
        loanRef: loan.loanNumber,
        obligorName: loan.obligorName ?? 'Unknown Obligor',
        facilityType: loan.facilityType,
        settlementDate: loan.maturityDate ?? loan.disbursementDate ?? new Date().toISOString().split('T')[0],
        totalFacilityAmount: loan.facilityAmount,
        currency: loan.currency,
        overallStatus,
        dischargeDocuments: buildDischargeDocuments(loan, collaterals),
        stakeholderConfirmations: buildStakeholderConfirmations(loan),
        collateralReturns: buildCollateralReturns(loan, collaterals),
        expanded: false,
        activeTab: 'discharge' as const,
      };
    });

  return cases;
}

// ── Status configs ────────────────────────────────────────────────────────────

const signOffStatusConfig: Record<SignOffStatus, { bg: string; text: string; border: string; icon: React.ElementType; dot: string }> = {
  Signed:          { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCircle2, dot: 'bg-emerald-500' },
  Pending:         { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   icon: Clock,        dot: 'bg-slate-400' },
  Rejected:        { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: XCircle,      dot: 'bg-red-500' },
  'Awaiting Review':{ bg: 'bg-amber-50',  text: 'text-amber-700',   border: 'border-amber-200',   icon: AlertTriangle, dot: 'bg-amber-500' },
};

const confirmationStatusConfig: Record<ConfirmationStatus, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  Confirmed: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: BadgeCheck },
  Pending:   { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-slate-200',   icon: Clock },
  Declined:  { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: XCircle },
  Sent:      { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: Send },
};

const returnStatusConfig: Record<ReturnStatus, { bg: string; text: string; border: string; icon: React.ElementType; dot: string }> = {
  Delivered:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: CheckCheck,    dot: 'bg-emerald-500' },
  Scheduled:        { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-blue-200',    icon: CalendarDays,  dot: 'bg-blue-500' },
  'In Transit':     { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200',  icon: Truck,         dot: 'bg-indigo-500' },
  'Pending Schedule':{ bg: 'bg-slate-50',  text: 'text-slate-600',   border: 'border-slate-200',   icon: Clock,         dot: 'bg-slate-400' },
  Overdue:          { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-red-200',     icon: AlertTriangle, dot: 'bg-red-500' },
};

const overallStatusConfig: Record<OverallStatus, { bg: string; text: string; border: string; badgeBg: string }> = {
  'In Progress': { bg: 'bg-blue-50',    text: 'text-blue-700',    border: 'border-l-blue-500',    badgeBg: 'bg-blue-100 text-blue-700' },
  Completed:     { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-l-emerald-500', badgeBg: 'bg-emerald-100 text-emerald-700' },
  Blocked:       { bg: 'bg-red-50',     text: 'text-red-700',     border: 'border-l-red-500',     badgeBg: 'bg-red-100 text-red-700' },
  Pending:       { bg: 'bg-slate-50',   text: 'text-slate-600',   border: 'border-l-slate-400',   badgeBg: 'bg-slate-100 text-slate-600' },
};

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status, config }: { status: string; config: { bg: string; text: string; border: string; icon: React.ElementType } }) {
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${config.bg} ${config.text} ${config.border}`}>
      <Icon className="w-3 h-3" />
      {status}
    </span>
  );
}

function SectionProgress({ items, doneKey }: { items: { status: string }[]; doneKey: string[] }) {
  const done = items.filter(i => doneKey.includes(i.status)).length;
  const pct = items.length ? Math.round((done / items.length) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
      <span className="text-xs text-slate-500 whitespace-nowrap">{done}/{items.length}</span>
    </div>
  );
}

// ── Discharge Documents Tab ───────────────────────────────────────────────────

function DischargeTab({ docs }: { docs: DischargeDocument[] }) {
  return (
    <div className="space-y-3">
      {docs.map(doc => {
        const cfg = signOffStatusConfig[doc.status];
        const Icon = cfg.icon;
        return (
          <div key={doc.id} className={`rounded-xl border ${cfg.border} ${cfg.bg} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{doc.documentName}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{doc.documentType}</p>
                  {doc.notes && (
                    <p className="text-xs text-amber-700 mt-1.5 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">{doc.notes}</p>
                  )}
                </div>
              </div>
              <div className="flex-shrink-0 flex flex-col items-end gap-1.5">
                <StatusBadge status={doc.status} config={cfg} />
                <span className="text-xs text-slate-400">Due {fmtDate(doc.dueDate)}</span>
              </div>
            </div>
            {(doc.signedBy || doc.signedAt) && (
              <div className="mt-3 pt-3 border-t border-slate-200 flex items-center gap-4 text-xs text-slate-500">
                {doc.signedBy && <span className="flex items-center gap-1"><PenLine className="w-3 h-3" />{doc.signedBy}</span>}
                {doc.signedAt && <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />{fmtDate(doc.signedAt)}</span>}
              </div>
            )}
            {doc.status === 'Pending' && (
              <div className="mt-3 flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <Send className="w-3 h-3" /> Send for Sign-Off
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  <FileText className="w-3 h-3" /> View Document
                </button>
              </div>
            )}
            {doc.status === 'Rejected' && (
              <div className="mt-3 flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-xs font-medium rounded-lg hover:bg-red-700 transition-colors">
                  <RefreshCw className="w-3 h-3" /> Resubmit Corrected
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Stakeholder Confirmations Tab ─────────────────────────────────────────────

function StakeholdersTab({ confirmations }: { confirmations: StakeholderConfirmation[] }) {
  return (
    <div className="space-y-3">
      {confirmations.map(sc => {
        const cfg = confirmationStatusConfig[sc.status];
        return (
          <div key={sc.id} className={`rounded-xl border ${cfg.border} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-4 h-4 text-slate-500" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800">{sc.stakeholderName}</p>
                  <p className="text-xs text-slate-500">{sc.role} · {sc.organisation}</p>
                  <p className="text-xs font-medium text-slate-600 mt-1 bg-slate-50 border border-slate-100 rounded px-1.5 py-0.5 inline-block">{sc.confirmationType}</p>
                </div>
              </div>
              <StatusBadge status={sc.status} config={cfg} />
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{sc.email}</span>
              {sc.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{sc.phone}</span>}
              {sc.sentAt && <span className="flex items-center gap-1"><Send className="w-3 h-3" />Sent {fmtDate(sc.sentAt)}</span>}
              {sc.confirmedAt && <span className="flex items-center gap-1 text-emerald-600"><BadgeCheck className="w-3 h-3" />Confirmed {fmtDate(sc.confirmedAt)}</span>}
            </div>
            {sc.notes && (
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">{sc.notes}</p>
            )}
            {(sc.status === 'Pending' || sc.status === 'Sent') && (
              <div className="mt-3 flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <Bell className="w-3 h-3" /> Send Reminder
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  <CheckCircle2 className="w-3 h-3" /> Mark Confirmed
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Collateral Returns Tab ────────────────────────────────────────────────────

function ReturnsTab({ returns }: { returns: CollateralReturn[] }) {
  return (
    <div className="space-y-3">
      {returns.map(cr => {
        const cfg = returnStatusConfig[cr.status];
        const Icon = cfg.icon;
        return (
          <div key={cr.id} className={`rounded-xl border ${cfg.border} p-4`}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <div className={`mt-0.5 w-2 h-2 rounded-full flex-shrink-0 ${cfg.dot}`} />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-800 leading-snug">{cr.description}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{cr.collateralRef} · {cr.collateralType}</p>
                </div>
              </div>
              <StatusBadge status={cr.status} config={cfg} />
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-xs text-slate-600">
              <div className="flex items-start gap-1.5">
                <MapPin className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
                <span><span className="text-slate-400">From:</span> {cr.currentLocation}</span>
              </div>
              <div className="flex items-start gap-1.5">
                <Building2 className="w-3 h-3 mt-0.5 text-slate-400 flex-shrink-0" />
                <span><span className="text-slate-400">To:</span> {cr.returnTo}</span>
              </div>
              {cr.scheduledDate && (
                <div className="flex items-center gap-1.5">
                  <CalendarDays className="w-3 h-3 text-slate-400" />
                  <span><span className="text-slate-400">Scheduled:</span> {fmtDate(cr.scheduledDate)}</span>
                </div>
              )}
              {cr.actualReturnDate && (
                <div className="flex items-center gap-1.5 text-emerald-600">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Returned {fmtDate(cr.actualReturnDate)}</span>
                </div>
              )}
              {cr.handlerName && (
                <div className="flex items-center gap-1.5">
                  <Truck className="w-3 h-3 text-slate-400" />
                  <span>{cr.handlerName}{cr.trackingRef ? ` · ${cr.trackingRef}` : ''}</span>
                </div>
              )}
            </div>
            {cr.notes && (
              <p className="text-xs text-amber-700 mt-2 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1">{cr.notes}</p>
            )}
            {cr.status === 'Pending Schedule' && (
              <div className="mt-3 flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors">
                  <CalendarClock className="w-3 h-3" /> Schedule Return
                </button>
              </div>
            )}
            {cr.status === 'Scheduled' && (
              <div className="mt-3 flex gap-2">
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 text-white text-xs font-medium rounded-lg hover:bg-indigo-700 transition-colors">
                  <Truck className="w-3 h-3" /> Mark In Transit
                </button>
                <button className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 text-slate-600 text-xs font-medium rounded-lg hover:bg-slate-50 transition-colors">
                  <CalendarDays className="w-3 h-3" /> Reschedule
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function PostSettlementWorkflowContent() {
  const [cases, setCases] = useState<PostSettlementCase[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');
  const [finalisingId, setFinalisingId] = useState<string | null>(null);
  const [finaliseError, setFinaliseError] = useState<string | null>(null);

  const loadCases = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await fetchPostSettlementCases();
      setCases(data);
    } catch {
      setError('Failed to load post-settlement cases. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadCases(); }, [loadCases]);

  const toggleExpand = useCallback((id: string) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, expanded: !c.expanded } : c));
  }, []);

  const setTab = useCallback((id: string, tab: PostSettlementCase['activeTab']) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, activeTab: tab } : c));
  }, []);

  const handleFinaliseRelease = useCallback(async (caseId: string) => {
    setFinalisingId(caseId);
    setFinaliseError(null);
    const supabase = createClient();
    try {
      // 1. Set loan status → Closed
      const { error: loanError } = await supabase
        .from('loans')
        .update({ loan_status: 'Closed' })
        .eq('id', caseId);
      if (loanError) throw loanError;

      // 2. Fetch all collateral_loan_links for this loan
      const { data: links, error: linksError } = await supabase
        .from('collateral_loan_links')
        .select('id, collateral_record_id')
        .eq('loan_id', caseId);
      if (linksError) throw linksError;

      if (links && links.length > 0) {
        const collateralRecordIds = links
          .map((l: any) => l.collateral_record_id)
          .filter(Boolean) as string[];

        // 3. Set all linked collateral_records.status → Released
        if (collateralRecordIds.length > 0) {
          await supabase
            .from('collateral_records')
            .update({ status: 'Released' })
            .in('id', collateralRecordIds);
        }

        // 4. Set all loan_collateral_links.release_status → RELEASED
        const linkIds = links.map((l: any) => l.id);
        await supabase
          .from('collateral_loan_links')
          .update({ release_status: 'RELEASED' })
          .in('id', linkIds);
      }

      // Reload cases to reflect updated status
      await loadCases();
    } catch (err: any) {
      console.error('[postSettlement] finalise release failed:', err.message);
      setFinaliseError('Failed to finalise release. Please try again.');
    } finally {
      setFinalisingId(null);
    }
  }, [loadCases]);

  const filtered = cases.filter(c => {
    const matchSearch = !search || c.loanRef.toLowerCase().includes(search.toLowerCase()) || c.obligorName.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'All' || c.overallStatus === filterStatus;
    return matchSearch && matchStatus;
  });

  // KPI summary
  const totalCases = cases.length;
  const completed = cases.filter(c => c.overallStatus === 'Completed').length;
  const blocked = cases.filter(c => c.overallStatus === 'Blocked').length;
  const inProgress = cases.filter(c => c.overallStatus === 'In Progress').length;
  const pendingDischarges = cases.flatMap(c => c.dischargeDocuments).filter(d => d.status === 'Pending' || d.status === 'Awaiting Review').length;
  const pendingReturns = cases.flatMap(c => c.collateralReturns).filter(r => r.status !== 'Delivered').length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="w-5 h-5 text-blue-600" />
              <h1 className="text-xl font-bold text-slate-900" style={{ fontFamily: 'DM Sans, sans-serif' }}>Post-Settlement Workflow</h1>
            </div>
            <p className="text-sm text-slate-500">Manage discharge sign-offs, stakeholder confirmations, and collateral return scheduling before final release</p>
          </div>
          <button
            onClick={loadCases}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-600 text-sm font-medium rounded-xl hover:bg-slate-50 transition-colors shadow-sm"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>

        {/* KPI Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Cases', value: isLoading ? '—' : String(totalCases), color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Completed', value: isLoading ? '—' : String(completed), color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'In Progress', value: isLoading ? '—' : String(inProgress), color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Blocked', value: isLoading ? '—' : String(blocked), color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Pending Discharges', value: isLoading ? '—' : String(pendingDischarges), color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Pending Returns', value: isLoading ? '—' : String(pendingReturns), color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
          ].map(kpi => (
            <div key={kpi.label} className={`rounded-xl border ${kpi.border} ${kpi.bg} px-3 py-2.5`}>
              <p className={`text-xl font-bold ${kpi.color}`}>{kpi.value}</p>
              <p className="text-xs text-slate-500 mt-0.5 leading-tight">{kpi.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="px-6 py-4 flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-48 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search loan ref or obligor…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
          {(['All', 'In Progress', 'Blocked', 'Completed', 'Pending'] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${filterStatus === s ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'}`}
            >
              {s}
            </button>
          ))}
        </div>
        <span className="text-xs text-slate-400 ml-auto">{filtered.length} case{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      {/* Global finalise error */}
      {finaliseError && (
        <div className="mx-6 mb-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          {finaliseError}
          <button onClick={() => setFinaliseError(null)} className="ml-auto text-red-400 hover:text-red-600">✕</button>
        </div>
      )}

      {/* Cases */}
      <div className="px-6 pb-8 space-y-4">
        {isLoading && (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 animate-pulse">
                <div className="h-4 bg-slate-100 rounded w-1/3 mb-3" />
                <div className="h-3 bg-slate-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        )}
        {!isLoading && error && (
          <div className="text-center py-16 text-red-500">
            <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-60" />
            <p className="text-sm font-semibold">{error}</p>
            <button onClick={loadCases} className="mt-3 text-xs text-blue-600 hover:underline">Try again</button>
          </div>
        )}
        {!isLoading && !error && filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">{cases.length === 0 ? 'No loans with linked collateral found.' : 'No cases match your filters.'}</p>
          </div>
        )}
        {!isLoading && !error && filtered.map(c => {
          const osCfg = overallStatusConfig[c.overallStatus];
          const dischargesDone = c.dischargeDocuments.filter(d => d.status === 'Signed').length;
          const confirmsDone = c.stakeholderConfirmations.filter(s => s.status === 'Confirmed').length;
          const returnsDone = c.collateralReturns.filter(r => r.status === 'Delivered').length;
          const isFinalising = finalisingId === c.id;

          return (
            <div key={c.id} className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${osCfg.border} shadow-sm overflow-hidden`}>
              {/* Case Header */}
              <button
                className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(c.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-sm font-bold text-slate-800">{c.obligorName}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-mono text-slate-500">{c.loanRef}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${osCfg.badgeBg}`}>{c.overallStatus}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Landmark className="w-3 h-3" />{c.facilityType}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Maturity {fmtDate(c.settlementDate)}</span>
                      <span className="font-medium text-slate-700">{fmt(c.totalFacilityAmount, c.currency)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <div className="hidden sm:flex items-center gap-4 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <FileCheck2 className="w-3.5 h-3.5 text-blue-500" />
                        <span className={dischargesDone === c.dischargeDocuments.length ? 'text-emerald-600 font-medium' : ''}>{dischargesDone}/{c.dischargeDocuments.length}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-purple-500" />
                        <span className={confirmsDone === c.stakeholderConfirmations.length ? 'text-emerald-600 font-medium' : ''}>{confirmsDone}/{c.stakeholderConfirmations.length}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-amber-500" />
                        <span className={returnsDone === c.collateralReturns.length ? 'text-emerald-600 font-medium' : ''}>{returnsDone}/{c.collateralReturns.length}</span>
                      </span>
                    </div>
                    {c.expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </div>
                </div>

                {/* Progress bars */}
                <div className="mt-3 grid grid-cols-3 gap-3">
                  {[
                    { label: 'Discharge Sign-Offs', items: c.dischargeDocuments, doneKeys: ['Signed'], icon: FileCheck2, color: 'bg-blue-500' },
                    { label: 'Stakeholder Confirmations', items: c.stakeholderConfirmations, doneKeys: ['Confirmed'], icon: Users, color: 'bg-purple-500' },
                    { label: 'Collateral Returns', items: c.collateralReturns, doneKeys: ['Delivered'], icon: Package, color: 'bg-amber-500' },
                  ].map(prog => {
                    const done = prog.items.filter(i => prog.doneKeys.includes(i.status)).length;
                    const pct = prog.items.length ? Math.round((done / prog.items.length) * 100) : 0;
                    return (
                      <div key={prog.label} className="min-w-0">
                        <p className="text-xs text-slate-400 mb-1 truncate">{prog.label}</p>
                        <div className="flex items-center gap-1.5">
                          <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div className={`h-full ${prog.color} rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                          </div>
                          <span className="text-xs text-slate-500 flex-shrink-0">{done}/{prog.items.length}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </button>

              {/* Expanded Panel */}
              {c.expanded && (
                <div className="border-t border-slate-100">
                  {/* Tabs */}
                  <div className="flex border-b border-slate-100 bg-slate-50">
                    {([
                      { key: 'discharge', label: 'Discharge Sign-Offs', icon: FileCheck2, count: c.dischargeDocuments.length, done: dischargesDone },
                      { key: 'stakeholders', label: 'Stakeholder Confirmations', icon: Users, count: c.stakeholderConfirmations.length, done: confirmsDone },
                      { key: 'returns', label: 'Collateral Returns', icon: CalendarClock, count: c.collateralReturns.length, done: returnsDone },
                    ] as const).map(tab => (
                      <button
                        key={tab.key}
                        onClick={() => setTab(c.id, tab.key)}
                        className={`flex items-center gap-2 px-4 py-3 text-xs font-medium border-b-2 transition-colors ${c.activeTab === tab.key ? 'border-blue-600 text-blue-700 bg-white' : 'border-transparent text-slate-500 hover:text-slate-700 hover:bg-white'}`}
                      >
                        <tab.icon className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">{tab.label}</span>
                        <span className={`px-1.5 py-0.5 rounded-full text-xs ${tab.done === tab.count ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                          {tab.done}/{tab.count}
                        </span>
                      </button>
                    ))}
                  </div>

                  {/* Tab Content */}
                  <div className="p-5">
                    {c.activeTab === 'discharge' && <DischargeTab docs={c.dischargeDocuments} />}
                    {c.activeTab === 'stakeholders' && <StakeholdersTab confirmations={c.stakeholderConfirmations} />}
                    {c.activeTab === 'returns' && <ReturnsTab returns={c.collateralReturns} />}
                  </div>

                  {/* Footer actions */}
                  <div className="px-5 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
                    <p className="text-xs text-slate-400">
                      {c.overallStatus === 'Completed' ? '✓ All post-settlement steps completed' : `${c.overallStatus === 'Blocked' ? '⚠ Blocked — resolve issues to proceed' : 'Complete all steps to finalise release'}`}
                    </p>
                    {c.overallStatus !== 'Completed' && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleFinaliseRelease(c.id); }}
                        disabled={c.overallStatus === 'Blocked' || isFinalising}
                        className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {isFinalising ? (
                          <><RefreshCw className="w-3.5 h-3.5 animate-spin" /> Finalising…</>
                        ) : (
                          <><ArrowRight className="w-3.5 h-3.5" /> Finalise Release</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
