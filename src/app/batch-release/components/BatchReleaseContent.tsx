'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { CheckSquare, Square, Unlock, FileText, AlertTriangle, CheckCircle2, XCircle, ChevronDown, ChevronUp, Download, RefreshCw, Filter, Search, DollarSign, Shield, Loader2, ClipboardList, ArrowRight, Info,  } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { collateralLinkService } from '@/lib/supabase/collateralLinkService';
import { useAuth } from '@/contexts/AuthContext';
import { usePermissions, PERMISSIONS } from '@/lib/rbac';
import AccessDenied from '@/components/AccessDenied';

// ─── Types ────────────────────────────────────────────────────────────────────

type ReleaseStatus = 'PENDING' | 'PROCESSING' | 'RELEASED' | 'FAILED';
type RegistryType = 'BRELA' | 'LANDS' | 'TRA' | 'OTHER';

interface ClosedLoanItem {
  linkId: string;
  loanAccountId: string;
  beneficiaryName: string;
  beneficiaryId: string;
  collateralId: string;
  collateralRecordId: string;
  collateralDescription: string;
  chargeRank: number;
  allocatedAmount: number;
  startDate: string;
  loanClosedDate: string;
  registryName: RegistryType;
  registrationNumber: string;
  chargeRegistryId: string | null;
  releaseStatus: ReleaseStatus;
  dischargeNumber: string;
  dischargeDate: string;
  errorMessage?: string;
}

interface DischargeTemplate {
  id: string;
  registryType: RegistryType;
  label: string;
  fields: string[];
}

const DISCHARGE_TEMPLATES: DischargeTemplate[] = [
  {
    id: 'brela-standard',
    registryType: 'BRELA',
    label: 'BRELA – Discharge of Charge (Form 97)',
    fields: ['Charge Registration Number', 'Date of Original Registration', 'Discharge Number', 'Discharge Date', 'Authorized Signatory'],
  },
  {
    id: 'lands-standard',
    registryType: 'LANDS',
    label: 'Lands Registry – Release of Mortgage',
    fields: ['Title Deed Number', 'Mortgage Registration Number', 'Release Number', 'Release Date', 'Commissioner for Oaths'],
  },
  {
    id: 'tra-standard',
    registryType: 'TRA',
    label: 'TRA – Vehicle Charge Discharge',
    fields: ['Vehicle Registration Number', 'Charge Reference', 'Discharge Reference', 'Discharge Date'],
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number) {
  return 'TZS ' + n.toLocaleString('en-TZ', { minimumFractionDigits: 0 });
}

function rankLabel(rank: number) {
  if (rank === 1) return '1st';
  if (rank === 2) return '2nd';
  if (rank === 3) return '3rd';
  return `${rank}th`;
}

function statusBadge(status: ReleaseStatus) {
  const map: Record<ReleaseStatus, { bg: string; text: string; label: string }> = {
    PENDING: { bg: 'bg-slate-100', text: 'text-slate-600', label: 'Pending' },
    PROCESSING: { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Processing…' },
    RELEASED: { bg: 'bg-green-100', text: 'text-green-700', label: 'Released' },
    FAILED: { bg: 'bg-red-100', text: 'text-red-700', label: 'Failed' },
  };
  const s = map[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${s.bg} ${s.text}`}>
      {status === 'RELEASED' && <CheckCircle2 className="w-3 h-3" />}
      {status === 'FAILED' && <XCircle className="w-3 h-3" />}
      {status === 'PROCESSING' && <Loader2 className="w-3 h-3 animate-spin" />}
      {s.label}
    </span>
  );
}

// ─── Discharge Template Preview Modal ────────────────────────────────────────

function DischargeTemplateModal({
  item,
  onClose,
}: {
  item: ClosedLoanItem;
  onClose: () => void;
}) {
  const template = DISCHARGE_TEMPLATES.find((t) => t.registryType === item.registryName) ?? DISCHARGE_TEMPLATES[0];
  const today = new Date().toISOString().slice(0, 10);

  const [fields, setFields] = useState<Record<string, string>>({
    'Charge Registration Number': item.registrationNumber,
    'Date of Original Registration': item.startDate,
    'Discharge Number': item.dischargeNumber || `DIS-${item.registryName}-${Date.now().toString().slice(-6)}`,
    'Discharge Date': item.dischargeDate || today,
    'Authorized Signatory': '',
    'Title Deed Number': item.collateralId,
    'Mortgage Registration Number': item.registrationNumber,
    'Release Number': item.dischargeNumber || `REL-${Date.now().toString().slice(-6)}`,
    'Release Date': item.dischargeDate || today,
    'Commissioner for Oaths': '',
    'Vehicle Registration Number': item.collateralId,
    'Charge Reference': item.registrationNumber,
    'Discharge Reference': item.dischargeNumber || `DIS-TRA-${Date.now().toString().slice(-6)}`,
  });

  function handlePrint() {
    window.print();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <FileText className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm text-foreground">{template.label}</p>
              <p className="text-xs text-muted-foreground">Loan: {item.loanAccountId} · {item.beneficiaryName}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <XCircle className="w-5 h-5" />
          </button>
        </div>

        {/* Form body */}
        <div className="px-6 py-5 space-y-4">
          {/* Bank header */}
          <div className="text-center border-b border-dashed border-border pb-4">
            <p className="text-base font-bold text-foreground">EXIM BANK TANZANIA LIMITED</p>
            <p className="text-sm text-muted-foreground mt-0.5">{template.label.toUpperCase()}</p>
            <p className="text-xs text-muted-foreground mt-1">Reference: {item.loanAccountId} | Collateral: {item.collateralId}</p>
          </div>

          {/* Disclosure block for 2nd+ charges */}
          {item.chargeRank > 1 && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-xs text-amber-800">
              <p className="font-semibold mb-1">⚠ Disclosure of Prior Charges</p>
              <p>
                This property is subject to {item.chargeRank - 1} prior charge(s) registered in favour of EXIM Bank Tanzania.
                This discharge applies to the <strong>{rankLabel(item.chargeRank)} charge</strong> only.
                Prior charges remain in effect until separately discharged.
              </p>
            </div>
          )}

          {/* Dynamic fields */}
          <div className="grid grid-cols-2 gap-4">
            {template.fields.map((field) => (
              <div key={field} className="col-span-1">
                <label className="block text-xs font-medium text-muted-foreground mb-1">{field}</label>
                <input
                  type="text"
                  value={fields[field] ?? ''}
                  onChange={(e) => setFields((prev) => ({ ...prev, [field]: e.target.value }))}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  placeholder={`Enter ${field}`}
                />
              </div>
            ))}
          </div>

          {/* Collateral summary */}
          <div className="bg-slate-50 rounded-lg p-4 text-xs space-y-1.5 border border-border">
            <p className="font-semibold text-foreground mb-2">Collateral Summary</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <span className="text-muted-foreground">Collateral ID</span><span className="font-medium">{item.collateralId}</span>
              <span className="text-muted-foreground">Charge Rank</span><span className="font-medium">{rankLabel(item.chargeRank)} Charge</span>
              <span className="text-muted-foreground">Allocated Amount</span><span className="font-medium">{fmt(item.allocatedAmount)}</span>
              <span className="text-muted-foreground">Beneficiary</span><span className="font-medium">{item.beneficiaryName}</span>
              <span className="text-muted-foreground">Loan Closed</span><span className="font-medium">{item.loanClosedDate}</span>
              <span className="text-muted-foreground">Registry</span><span className="font-medium">{item.registryName}</span>
            </div>
          </div>

          {/* Signature block */}
          <div className="grid grid-cols-2 gap-6 pt-2">
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Authorized Officer Signature</p>
              <p className="text-xs text-muted-foreground mt-4">Date: _______________</p>
            </div>
            <div className="border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">Registry Officer Stamp</p>
              <p className="text-xs text-muted-foreground mt-4">Date: _______________</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-slate-50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            Close
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors"
          >
            <Download className="w-4 h-4" />
            Print / Download
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Batch Release Row ────────────────────────────────────────────────────────

function ReleaseRow({
  item,
  selected,
  onToggle,
  onViewTemplate,
  onUpdateItem,
}: {
  item: ClosedLoanItem;
  selected: boolean;
  onToggle: () => void;
  onViewTemplate: () => void;
  onUpdateItem: (updates: Partial<ClosedLoanItem>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`border rounded-xl transition-all ${selected ? 'border-primary/40 bg-primary/5' : 'border-border bg-white'} ${item.releaseStatus === 'RELEASED' ? 'opacity-60' : ''}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 px-4 py-3">
        {/* Checkbox */}
        <button
          onClick={onToggle}
          disabled={item.releaseStatus === 'RELEASED' || item.releaseStatus === 'PROCESSING'}
          className="shrink-0 text-primary disabled:opacity-40"
        >
          {selected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5 text-muted-foreground" />}
        </button>

        {/* Info */}
        <div className="flex-1 min-w-0 grid grid-cols-5 gap-3 items-center">
          <div className="col-span-2 min-w-0">
            <p className="text-sm font-semibold text-foreground truncate">{item.loanAccountId}</p>
            <p className="text-xs text-muted-foreground truncate">{item.beneficiaryName}</p>
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Collateral</p>
            <p className="text-xs font-medium truncate">{item.collateralId}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Charge</p>
            <p className="text-xs font-medium">{rankLabel(item.chargeRank)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Amount</p>
            <p className="text-xs font-medium">{fmt(item.allocatedAmount)}</p>
          </div>
        </div>

        {/* Status + actions */}
        <div className="flex items-center gap-2 shrink-0">
          {statusBadge(item.releaseStatus)}
          <button
            onClick={onViewTemplate}
            title="View discharge template"
            className="p-1.5 rounded-lg hover:bg-slate-100 text-muted-foreground hover:text-primary transition-colors"
          >
            <FileText className="w-4 h-4" />
          </button>
          <button
            onClick={() => setExpanded((v) => !v)}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-muted-foreground transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* Expanded discharge details */}
      {expanded && (
        <div className="px-4 pb-4 pt-1 border-t border-border/60 bg-slate-50/50 rounded-b-xl">
          <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wide">Discharge Filing Details</p>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Registry</label>
              <select
                value={item.registryName}
                onChange={(e) => onUpdateItem({ registryName: e.target.value as RegistryType })}
                disabled={item.releaseStatus === 'RELEASED'}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 bg-white disabled:opacity-50"
              >
                <option value="BRELA">BRELA</option>
                <option value="LANDS">Lands Registry</option>
                <option value="TRA">TRA</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Discharge Number</label>
              <input
                type="text"
                value={item.dischargeNumber}
                onChange={(e) => onUpdateItem({ dischargeNumber: e.target.value })}
                disabled={item.releaseStatus === 'RELEASED'}
                placeholder="e.g. DIS-BR-2024-001"
                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground mb-1">Discharge Date</label>
              <input
                type="date"
                value={item.dischargeDate}
                onChange={(e) => onUpdateItem({ dischargeDate: e.target.value })}
                disabled={item.releaseStatus === 'RELEASED'}
                className="w-full border border-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50"
              />
            </div>
          </div>
          {item.errorMessage && (
            <p className="mt-2 text-xs text-red-600 flex items-center gap-1">
              <XCircle className="w-3 h-3" /> {item.errorMessage}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Content ─────────────────────────────────────────────────────────────

export default function BatchReleaseContent() {
  const { user } = useAuth();
  const { hasPermission, loading: permsLoading } = usePermissions();

  const [items, setItems] = useState<ClosedLoanItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');
  const [filterRegistry, setFilterRegistry] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('PENDING');
  const [processing, setProcessing] = useState(false);
  const [templateItem, setTemplateItem] = useState<ClosedLoanItem | null>(null);
  const [batchResult, setBatchResult] = useState<{ released: number; failed: number } | null>(null);

  // ── Load closed-loan links ─────────────────────────────────────────────────
  const loadItems = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();

      // Fetch all ACTIVE collateral_loan_links where the loan has been closed
      // We simulate "closed loans" by fetching ACTIVE links that have an end_date set
      // or by fetching all ACTIVE links (in production these would be filtered by core banking)
      const { data: links, error } = await supabase
        .from('collateral_loan_links')
        .select(`
          id,
          collateral_id,
          loan_account_id,
          beneficiary_id,
          beneficiary_name,
          charge_rank,
          allocated_amount,
          start_date,
          end_date,
          status,
          release_date
        `)
        .eq('status', 'ACTIVE')
        .order('charge_rank', { ascending: true });

      if (error || !links) {
        setItems([]);
        setLoading(false);
        return;
      }

      // Fetch charge registry entries
      const { data: chargeRegs } = await supabase
        .from('charge_registry')
        .select('id, collateral_id, loan_account_id, charge_rank, registry_name, registration_number, status')
        .eq('status', 'ACTIVE');

      const chargeMap = new Map<string, any>();
      (chargeRegs ?? []).forEach((cr: any) => {
        chargeMap.set(`${cr.collateral_id}:${cr.loan_account_id}`, cr);
      });

      // Fetch collateral records for descriptions
      const collateralIds = [...new Set(links.map((l: any) => l.collateral_id))];
      const { data: collaterals } = await supabase
        .from('collateral_records')
        .select('id, collateral_id, collateral_type, description')
        .in('id', collateralIds);

      const colMap = new Map<string, any>();
      (collaterals ?? []).forEach((c: any) => colMap.set(c.id, c));

      const today = new Date().toISOString().slice(0, 10);

      const mapped: ClosedLoanItem[] = links.map((l: any) => {
        const col = colMap.get(l.collateral_id);
        const cr = chargeMap.get(`${l.collateral_id}:${l.loan_account_id}`);
        return {
          linkId: l.id,
          loanAccountId: l.loan_account_id,
          beneficiaryName: l.beneficiary_name ?? 'Unknown',
          beneficiaryId: l.beneficiary_id,
          collateralId: col?.collateral_id ?? l.collateral_id,
          collateralRecordId: l.collateral_id,
          collateralDescription: col?.description ?? col?.collateral_type ?? 'Collateral',
          chargeRank: l.charge_rank,
          allocatedAmount: parseFloat(l.allocated_amount) || 0,
          startDate: l.start_date ?? '',
          loanClosedDate: l.end_date ?? today,
          registryName: (cr?.registry_name as RegistryType) ?? 'BRELA',
          registrationNumber: cr?.registration_number ?? '',
          chargeRegistryId: cr?.id ?? null,
          releaseStatus: 'PENDING',
          dischargeNumber: '',
          dischargeDate: today,
        };
      });

      setItems(mapped);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadItems();
  }, [loadItems]);

  // ── Filtering ──────────────────────────────────────────────────────────────
  const filtered = items.filter((item) => {
    const matchSearch =
      !search ||
      item.loanAccountId.toLowerCase().includes(search.toLowerCase()) ||
      item.beneficiaryName.toLowerCase().includes(search.toLowerCase()) ||
      item.collateralId.toLowerCase().includes(search.toLowerCase());
    const matchRegistry = filterRegistry === 'ALL' || item.registryName === filterRegistry;
    const matchStatus = filterStatus === 'ALL' || item.releaseStatus === filterStatus;
    return matchSearch && matchRegistry && matchStatus;
  });

  const pendingItems = filtered.filter((i) => i.releaseStatus === 'PENDING');
  const releasedItems = filtered.filter((i) => i.releaseStatus === 'RELEASED');

  // ── Selection ──────────────────────────────────────────────────────────────
  function toggleItem(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    const pendingIds = pendingItems.map((i) => i.linkId);
    if (selectedIds.size === pendingIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(pendingIds));
    }
  }

  function updateItem(linkId: string, updates: Partial<ClosedLoanItem>) {
    setItems((prev) => prev.map((i) => (i.linkId === linkId ? { ...i, ...updates } : i)));
  }

  // ── Batch Release ──────────────────────────────────────────────────────────
  async function handleBatchRelease() {
    if (!user || selectedIds.size === 0) return;
    setProcessing(true);
    setBatchResult(null);

    const toRelease = items.filter((i) => selectedIds.has(i.linkId));
    let released = 0;
    let failed = 0;

    // Mark all as processing
    setItems((prev) =>
      prev.map((i) =>
        selectedIds.has(i.linkId) ? { ...i, releaseStatus: 'PROCESSING' } : i
      )
    );

    for (const item of toRelease) {
      try {
        const result = await collateralLinkService.releaseLink(item.linkId, {
          releaseReason: 'LOAN_FULLY_REPAID',
          releaseDate: item.loanClosedDate,
          dischargeRegistryNumber: item.dischargeNumber || undefined,
        });

        if (result.success) {
          // Record discharge if discharge number provided
          if (item.dischargeNumber && item.chargeRegistryId) {
            await collateralLinkService.recordDischarge(
              item.collateralRecordId,
              item.chargeRank,
              {
                registryName: item.registryName,
                dischargeNumber: item.dischargeNumber,
                dischargeDate: item.dischargeDate,
              },
              user.id
            );
          }
          setItems((prev) =>
            prev.map((i) => (i.linkId === item.linkId ? { ...i, releaseStatus: 'RELEASED' } : i))
          );
          released++;
        } else {
          setItems((prev) =>
            prev.map((i) =>
              i.linkId === item.linkId
                ? { ...i, releaseStatus: 'FAILED', errorMessage: result.error }
                : i
            )
          );
          failed++;
        }
      } catch (err: any) {
        setItems((prev) =>
          prev.map((i) =>
            i.linkId === item.linkId
              ? { ...i, releaseStatus: 'FAILED', errorMessage: err.message }
              : i
          )
        );
        failed++;
      }
    }

    setSelectedIds(new Set());
    setBatchResult({ released, failed });
    setProcessing(false);
  }

  // ── Permission guard ───────────────────────────────────────────────────────
  if (!permsLoading && !hasPermission(PERMISSIONS.COLLATERAL_EDIT)) {
    return <AccessDenied />;
  }

  // ── Stats ──────────────────────────────────────────────────────────────────
  const totalPending = items.filter((i) => i.releaseStatus === 'PENDING').length;
  const totalReleased = items.filter((i) => i.releaseStatus === 'RELEASED').length;
  const totalFailed = items.filter((i) => i.releaseStatus === 'FAILED').length;
  const totalAllocated = items
    .filter((i) => selectedIds.has(i.linkId))
    .reduce((s, i) => s + i.allocatedAmount, 0);

  return (
    <div className="flex flex-col gap-6 p-6 max-w-6xl mx-auto">
      {/* Page header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Batch Collateral Release</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Release collateral allocations for closed loans and generate discharge filing templates for BRELA / Lands Registry submission.
          </p>
        </div>
        <button
          onClick={loadItems}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-border rounded-lg hover:bg-slate-50 transition-colors text-muted-foreground"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Pending Release', value: totalPending, icon: ClipboardList, color: 'text-amber-600', bg: 'bg-amber-50 border-amber-200' },
          { label: 'Released', value: totalReleased, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50 border-green-200' },
          { label: 'Failed', value: totalFailed, icon: XCircle, color: 'text-red-600', bg: 'bg-red-50 border-red-200' },
          { label: 'Selected Equity', value: fmt(totalAllocated), icon: DollarSign, color: 'text-primary', bg: 'bg-primary/5 border-primary/20' },
        ].map((kpi) => (
          <div key={kpi.label} className={`flex items-center gap-3 p-4 rounded-xl border ${kpi.bg}`}>
            <kpi.icon className={`w-6 h-6 ${kpi.color} shrink-0`} />
            <div>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
              <p className={`text-lg font-bold ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Batch result banner */}
      {batchResult && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border ${batchResult.failed === 0 ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'}`}>
          {batchResult.failed === 0 ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          )}
          <p className="text-sm font-medium">
            Batch complete — <span className="text-green-700">{batchResult.released} released</span>
            {batchResult.failed > 0 && <span className="text-red-700">, {batchResult.failed} failed</span>}.
          </p>
          <button onClick={() => setBatchResult(null)} className="ml-auto text-muted-foreground hover:text-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Workflow steps */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground bg-slate-50 border border-border rounded-xl px-4 py-3">
        <Info className="w-4 h-4 shrink-0 text-primary" />
        <span className="font-medium text-foreground">Workflow:</span>
        {['Select closed loans', 'Fill discharge details', 'Preview filing template', 'Batch release'].map((step, i, arr) => (
          <React.Fragment key={step}>
            <span>{step}</span>
            {i < arr.length - 1 && <ArrowRight className="w-3 h-3" />}
          </React.Fragment>
        ))}
      </div>

      {/* Filters + actions bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search loan, beneficiary, collateral…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <select
            value={filterRegistry}
            onChange={(e) => setFilterRegistry(e.target.value)}
            className="border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">All Registries</option>
            <option value="BRELA">BRELA</option>
            <option value="LANDS">Lands Registry</option>
            <option value="TRA">TRA</option>
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <option value="ALL">All Statuses</option>
            <option value="PENDING">Pending</option>
            <option value="RELEASED">Released</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>

        {/* Select all + batch release */}
        <div className="flex items-center gap-2 ml-auto">
          {pendingItems.length > 0 && (
            <button
              onClick={toggleAll}
              className="flex items-center gap-1.5 px-3 py-2 text-sm border border-border rounded-lg hover:bg-slate-50 transition-colors"
            >
              {selectedIds.size === pendingItems.length ? (
                <CheckSquare className="w-4 h-4 text-primary" />
              ) : (
                <Square className="w-4 h-4 text-muted-foreground" />
              )}
              {selectedIds.size === pendingItems.length ? 'Deselect All' : 'Select All'}
            </button>
          )}
          <button
            onClick={handleBatchRelease}
            disabled={selectedIds.size === 0 || processing}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white text-sm rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {processing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Unlock className="w-4 h-4" />
            )}
            {processing ? 'Processing…' : `Release Selected (${selectedIds.size})`}
          </button>
        </div>
      </div>

      {/* Items list */}
      {loading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <p className="text-sm">Loading active collateral links…</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3 border border-dashed border-border rounded-xl">
          <Shield className="w-10 h-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No items match your filters</p>
          <p className="text-xs">Try adjusting your search or filter criteria</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((item) => (
            <ReleaseRow
              key={item.linkId}
              item={item}
              selected={selectedIds.has(item.linkId)}
              onToggle={() => toggleItem(item.linkId)}
              onViewTemplate={() => setTemplateItem(item)}
              onUpdateItem={(updates) => updateItem(item.linkId, updates)}
            />
          ))}
        </div>
      )}

      {/* Discharge template modal */}
      {templateItem && (
        <DischargeTemplateModal
          item={templateItem}
          onClose={() => setTemplateItem(null)}
        />
      )}
    </div>
  );
}
