'use client';
import React, { useState, useCallback } from 'react';
import { FileCheck2, Users, CalendarClock, CheckCircle2, Clock, AlertTriangle, ChevronDown, ChevronUp, ClipboardCheck, Send, CalendarDays, Building2, User, Phone, Mail, FileText, RefreshCw, Search, BadgeCheck, XCircle, ArrowRight, Landmark, Package, Truck, MapPin, ShieldCheck, PenLine, Bell, CheckCheck } from 'lucide-react';
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

// ── Mock Data ─────────────────────────────────────────────────────────────────

const MOCK_CASES: Omit<PostSettlementCase, 'expanded' | 'activeTab'>[] = [
  {
    id: 'psc-001',
    loanRef: 'LN-2024-0041',
    obligorName: 'Karibu Enterprises Ltd',
    facilityType: 'Term Loan',
    settlementDate: '2026-07-15',
    totalFacilityAmount: 850_000_000,
    currency: 'TZS',
    overallStatus: 'In Progress',
    dischargeDocuments: [
      { id: 'dd-001', documentName: 'Discharge of Mortgage – Plot 45 Msasani', documentType: 'Mortgage Discharge', signedBy: 'Adv. Fatuma Mwanga', signedAt: '2026-07-18', status: 'Signed', dueDate: '2026-07-20' },
      { id: 'dd-002', documentName: 'Release of Debenture – Karibu Enterprises', documentType: 'Debenture Release', status: 'Awaiting Review', dueDate: '2026-07-25', notes: 'Pending legal review by head office' },
      { id: 'dd-003', documentName: 'Vehicle Log Book Return – TZN 4521', documentType: 'Vehicle Title', status: 'Pending', dueDate: '2026-07-30' },
    ],
    stakeholderConfirmations: [
      { id: 'sc-001', stakeholderName: 'Juma Rashid', role: 'Obligor Director', organisation: 'Karibu Enterprises Ltd', email: 'juma@karibu.co.tz', phone: '+255 712 345 678', confirmationType: 'Settlement Acknowledgement', status: 'Confirmed', sentAt: '2026-07-16', confirmedAt: '2026-07-17' },
      { id: 'sc-002', stakeholderName: 'Adv. Fatuma Mwanga', role: 'Legal Counsel', organisation: 'Mwanga & Associates', email: 'fatuma@mwangalaw.co.tz', confirmationType: 'Discharge Sign-Off', status: 'Confirmed', sentAt: '2026-07-16', confirmedAt: '2026-07-18' },
      { id: 'sc-003', stakeholderName: 'BRELA Registry Office', role: 'Regulatory Body', organisation: 'BRELA', email: 'registry@brela.go.tz', confirmationType: 'Debenture Cancellation Notice', status: 'Sent', sentAt: '2026-07-19', notes: 'Awaiting official acknowledgement from BRELA' },
    ],
    collateralReturns: [
      { id: 'cr-001', collateralRef: 'COL-2024-0089', collateralType: 'Motor Vehicle', description: 'Toyota Land Cruiser V8 – TZN 4521', currentLocation: 'Bank Custody – Dar es Salaam Branch', returnTo: 'Karibu Enterprises Ltd, Plot 12 Mikocheni', scheduledDate: '2026-07-28', status: 'Scheduled', handlerName: 'Baraka Logistics', trackingRef: 'BL-20260728-001' },
      { id: 'cr-002', collateralRef: 'COL-2024-0090', collateralType: 'Title Deed', description: 'Certificate of Title – Plot 45 Msasani Peninsula', currentLocation: 'Archive Vault – Shelf B-12', returnTo: 'Karibu Enterprises Ltd via Adv. Fatuma Mwanga', scheduledDate: '2026-07-30', status: 'Pending Schedule', notes: 'Awaiting discharge document completion before scheduling' },
    ],
  },
  {
    id: 'psc-002',
    loanRef: 'LN-2023-0187',
    obligorName: 'Simba Holdings PLC',
    facilityType: 'Revolving Credit Facility',
    settlementDate: '2026-07-01',
    totalFacilityAmount: 2_400_000_000,
    currency: 'TZS',
    overallStatus: 'Completed',
    dischargeDocuments: [
      { id: 'dd-004', documentName: 'Discharge of Fixed Charge – Factory Premises', documentType: 'Fixed Charge Discharge', signedBy: 'Adv. Peter Kimaro', signedAt: '2026-07-05', status: 'Signed', dueDate: '2026-07-08' },
      { id: 'dd-005', documentName: 'Release of Floating Charge – All Assets', documentType: 'Floating Charge Release', signedBy: 'Adv. Peter Kimaro', signedAt: '2026-07-05', status: 'Signed', dueDate: '2026-07-08' },
      { id: 'dd-006', documentName: 'Share Certificate Return – 500,000 Ordinary Shares', documentType: 'Share Certificate', signedBy: 'Adv. Peter Kimaro', signedAt: '2026-07-06', status: 'Signed', dueDate: '2026-07-10' },
    ],
    stakeholderConfirmations: [
      { id: 'sc-004', stakeholderName: 'Grace Mwangi', role: 'CFO', organisation: 'Simba Holdings PLC', email: 'g.mwangi@simba.co.tz', confirmationType: 'Settlement Acknowledgement', status: 'Confirmed', sentAt: '2026-07-02', confirmedAt: '2026-07-03' },
      { id: 'sc-005', stakeholderName: 'Adv. Peter Kimaro', role: 'Legal Counsel', organisation: 'Kimaro Legal', email: 'pkimaro@kimarolegal.co.tz', confirmationType: 'Discharge Sign-Off', status: 'Confirmed', sentAt: '2026-07-02', confirmedAt: '2026-07-05' },
      { id: 'sc-006', stakeholderName: 'DSE Registrar', role: 'Regulatory Body', organisation: 'Dar es Salaam Stock Exchange', email: 'registrar@dse.co.tz', confirmationType: 'Share Release Notification', status: 'Confirmed', sentAt: '2026-07-06', confirmedAt: '2026-07-08' },
    ],
    collateralReturns: [
      { id: 'cr-003', collateralRef: 'COL-2023-0201', collateralType: 'Share Certificate', description: '500,000 Ordinary Shares – Simba Holdings PLC', currentLocation: 'Security Pocket – SP-0042', returnTo: 'Simba Holdings PLC Board Secretary', scheduledDate: '2026-07-10', actualReturnDate: '2026-07-10', status: 'Delivered', handlerName: 'Internal Courier', trackingRef: 'INT-20260710-003' },
      { id: 'cr-004', collateralRef: 'COL-2023-0202', collateralType: 'Property Title', description: 'Title Deed – Factory Premises, Ubungo Industrial Area', currentLocation: 'Archive Vault – Shelf A-04', returnTo: 'Simba Holdings PLC via Adv. Peter Kimaro', scheduledDate: '2026-07-12', actualReturnDate: '2026-07-12', status: 'Delivered', handlerName: 'Internal Courier', trackingRef: 'INT-20260712-001' },
    ],
  },
  {
    id: 'psc-003',
    loanRef: 'LN-2025-0012',
    obligorName: 'Mwanga Agri-Business Co.',
    facilityType: 'Agricultural Loan',
    settlementDate: '2026-07-20',
    totalFacilityAmount: 320_000_000,
    currency: 'TZS',
    overallStatus: 'Blocked',
    dischargeDocuments: [
      { id: 'dd-007', documentName: 'Discharge of Chattel Mortgage – Farm Equipment', documentType: 'Chattel Mortgage Discharge', status: 'Rejected', dueDate: '2026-07-27', notes: 'Rejected — equipment serial numbers mismatch. Requires correction.' },
      { id: 'dd-008', documentName: 'Land Charge Release – Moshi Farm Plot', documentType: 'Land Charge Release', status: 'Pending', dueDate: '2026-07-30' },
    ],
    stakeholderConfirmations: [
      { id: 'sc-007', stakeholderName: 'Hassan Mwanga', role: 'Obligor', organisation: 'Mwanga Agri-Business Co.', email: 'hassan@mwangaagri.co.tz', phone: '+255 754 987 321', confirmationType: 'Settlement Acknowledgement', status: 'Pending', notes: 'SMS and email sent, no response yet' },
      { id: 'sc-008', stakeholderName: 'Ministry of Agriculture', role: 'Regulatory Body', organisation: 'MoA – Land Registry', email: 'landregistry@moa.go.tz', confirmationType: 'Land Charge Cancellation', status: 'Pending' },
    ],
    collateralReturns: [
      { id: 'cr-005', collateralRef: 'COL-2025-0031', collateralType: 'Farm Equipment', description: 'John Deere Tractor 5075E + Attachments', currentLocation: 'Bank Custody – Moshi Branch', returnTo: 'Mwanga Agri-Business Co., Moshi Farm', status: 'Overdue', notes: 'Return blocked pending discharge document correction', scheduledDate: '2026-07-28' },
    ],
  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, currency = 'TZS'): string {
  if (n >= 1_000_000_000) return `${currency} ${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `${currency} ${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${currency} ${(n / 1_000).toFixed(0)}K`;
  return `${currency} ${n.toLocaleString()}`;
}

function fmtDate(d?: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

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
  const [cases, setCases] = useState<PostSettlementCase[]>(
    MOCK_CASES.map(c => ({ ...c, expanded: false, activeTab: 'discharge' as const }))
  );
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('All');

  const toggleExpand = useCallback((id: string) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, expanded: !c.expanded } : c));
  }, []);

  const setTab = useCallback((id: string, tab: PostSettlementCase['activeTab']) => {
    setCases(prev => prev.map(c => c.id === id ? { ...c, activeTab: tab } : c));
  }, []);

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
  const pendingConfirmations = cases.flatMap(c => c.stakeholderConfirmations).filter(s => s.status === 'Pending' || s.status === 'Sent').length;
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
          <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-xl hover:bg-blue-700 transition-colors shadow-sm">
            <ClipboardCheck className="w-4 h-4" /> New Case
          </button>
        </div>

        {/* KPI Strip */}
        <div className="mt-5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Cases', value: totalCases, color: 'text-slate-700', bg: 'bg-slate-50', border: 'border-slate-200' },
            { label: 'Completed', value: completed, color: 'text-emerald-700', bg: 'bg-emerald-50', border: 'border-emerald-200' },
            { label: 'In Progress', value: inProgress, color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200' },
            { label: 'Blocked', value: blocked, color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200' },
            { label: 'Pending Discharges', value: pendingDischarges, color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200' },
            { label: 'Pending Returns', value: pendingReturns, color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200' },
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

      {/* Cases */}
      <div className="px-6 pb-8 space-y-4">
        {filtered.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <ClipboardCheck className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="text-sm">No cases match your filters</p>
          </div>
        )}
        {filtered.map(c => {
          const osCfg = overallStatusConfig[c.overallStatus];
          const dischargesDone = c.dischargeDocuments.filter(d => d.status === 'Signed').length;
          const confirmsDone = c.stakeholderConfirmations.filter(s => s.status === 'Confirmed').length;
          const returnsDone = c.collateralReturns.filter(r => r.status === 'Delivered').length;

          return (
            <div key={c.id} className={`bg-white rounded-2xl border border-slate-200 border-l-4 ${osCfg.border} shadow-sm overflow-hidden`}>
              {/* Case Header */}
              <button
                className="w-full text-left px-5 py-4 hover:bg-slate-50 transition-colors"
                onClick={() => toggleExpand(c.id)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-bold text-slate-800">{c.obligorName}</span>
                      <span className="text-xs text-slate-400">·</span>
                      <span className="text-xs font-mono text-slate-500">{c.loanRef}</span>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${osCfg.badgeBg}`}>{c.overallStatus}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-slate-500 flex-wrap">
                      <span className="flex items-center gap-1"><Landmark className="w-3 h-3" />{c.facilityType}</span>
                      <span className="flex items-center gap-1"><CalendarDays className="w-3 h-3" />Settled {fmtDate(c.settlementDate)}</span>
                      <span className="font-medium text-slate-700">{fmt(c.totalFacilityAmount, c.currency)}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    {/* Progress mini-summary */}
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
                      <button className="flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white text-xs font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50" disabled={c.overallStatus === 'Blocked'}>
                        <ArrowRight className="w-3.5 h-3.5" /> Finalise Release
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
