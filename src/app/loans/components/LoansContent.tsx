'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';
import { Plus, Search, X, Loader2, AlertCircle, RefreshCw, Building2, CreditCard, Calendar, CheckCircle2, XCircle, Clock, Edit2, Trash2, BarChart2, CalendarClock, Scale, ArrowLeftRight, ChevronDown, ChevronUp } from 'lucide-react';
import { loanService, Loan } from '@/lib/supabase/loanService';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';

const FACILITY_TYPES = ['Term Loan', 'Overdraft Facility', 'Mortgage', 'Asset Finance', 'Trade Finance', 'Revolving Credit', 'Letter of Credit', 'Other'];
const REPAYMENT_FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Bullet'];
const LOAN_STATUSES = ['Active', 'Closed', 'Defaulted', 'Restructured', 'Written Off'];

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType }> = {
  Active: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2 },
  Closed: { color: 'text-slate-600', bg: 'bg-slate-100', icon: CheckCircle2 },
  Defaulted: { color: 'text-red-700', bg: 'bg-red-100', icon: XCircle },
  Restructured: { color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock },
  'Written Off': { color: 'text-rose-700', bg: 'bg-rose-100', icon: XCircle },
};

interface LoanFormData {
  obligorId: string;
  facilityType: string;
  facilityAmount: string;
  outstandingBalance: string;
  currency: string;
  interestRate: string;
  disbursementDate: string;
  maturityDate: string;
  repaymentFrequency: string;
  loanStatus: string;
  purpose: string;
  notes: string;
}

const emptyForm: LoanFormData = {
  obligorId: '', facilityType: 'Term Loan', facilityAmount: '', outstandingBalance: '',
  currency: 'TZS', interestRate: '', disbursementDate: '', maturityDate: '',
  repaymentFrequency: 'Monthly', loanStatus: 'Active', purpose: '', notes: '',
};

function formatTsh(val: number | null | undefined): string {
  if (val == null || val === 0) return '—';
  if (val >= 1e9) return `TSh ${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `TSh ${(val / 1e6).toFixed(1)}M`;
  if (val >= 1e3) return `TSh ${(val / 1e3).toFixed(0)}K`;
  return `TSh ${val.toFixed(0)}`;
}

export default function LoansContent() {
  const { user } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [obligors, setObligors] = useState<Obligor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [form, setForm] = useState<LoanFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<LoanFormData>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Loan | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [expandedLoanId, setExpandedLoanId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ls, obs] = await Promise.all([loanService.getAll(), obligorService.getAll()]);
      setLoans(ls);
      setObligors(obs);
    } catch {
      setError('Failed to load loans.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  // Pre-filter by facility query param
  useEffect(() => {
    const facility = searchParams.get('facility');
    if (facility) setSearch(facility);
  }, [searchParams]);

  const filtered = loans.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q || l.loanNumber.toLowerCase().includes(q) ||
      (l.obligorName ?? '').toLowerCase().includes(q) ||
      (l.purpose ?? '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || l.loanStatus === statusFilter;
    return matchSearch && matchStatus;
  });

  const openAdd = async () => {
    const loanNumber = await loanService.generateLoanNumber();
    setEditLoan(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (loan: Loan) => {
    setEditLoan(loan);
    setForm({
      obligorId: loan.obligorId,
      facilityType: loan.facilityType,
      facilityAmount: loan.facilityAmount.toString(),
      outstandingBalance: loan.outstandingBalance?.toString() ?? '',
      currency: loan.currency,
      interestRate: loan.interestRate?.toString() ?? '',
      disbursementDate: loan.disbursementDate ?? '',
      maturityDate: loan.maturityDate ?? '',
      repaymentFrequency: loan.repaymentFrequency,
      loanStatus: loan.loanStatus,
      purpose: loan.purpose ?? '',
      notes: loan.notes ?? '',
    });
    setFormErrors({});
    setSaveError(null);
    setModalOpen(true);
  };

  const validate = (): boolean => {
    const errs: Partial<LoanFormData> = {};
    if (!form.obligorId) errs.obligorId = 'Obligor is required';
    if (!form.facilityType) errs.facilityType = 'Facility type is required';
    if (!form.facilityAmount || isNaN(parseFloat(form.facilityAmount))) errs.facilityAmount = 'Valid amount required';
    if (!form.loanStatus) errs.loanStatus = 'Status is required';
    setFormErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSave = async () => {
    if (!validate() || !user) return;
    setSaving(true);
    setSaveError(null);
    try {
      const payload: Partial<Loan> = {
        obligorId: form.obligorId,
        facilityType: form.facilityType,
        facilityAmount: parseFloat(form.facilityAmount),
        outstandingBalance: form.outstandingBalance ? parseFloat(form.outstandingBalance) : null,
        currency: form.currency,
        interestRate: form.interestRate ? parseFloat(form.interestRate) : null,
        disbursementDate: form.disbursementDate || null,
        maturityDate: form.maturityDate || null,
        repaymentFrequency: form.repaymentFrequency,
        loanStatus: form.loanStatus,
        purpose: form.purpose || null,
        notes: form.notes || null,
      };
      if (editLoan) {
        const updated = await loanService.update(editLoan.id, payload);
        if (updated) setLoans((prev) => prev.map((l) => l.id === updated.id ? updated : l));
      } else {
        const loanNumber = await loanService.generateLoanNumber();
        const created = await loanService.create({ ...payload, loanNumber }, user.id);
        if (created) setLoans((prev) => [created, ...prev]);
      }
      setModalOpen(false);
    } catch (err: any) {
      setSaveError(err?.message ?? 'Failed to save loan.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteConfirm) return;
    setDeleting(true);
    const ok = await loanService.delete(deleteConfirm.id);
    if (ok) setLoans((prev) => prev.filter((l) => l.id !== deleteConfirm.id));
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const totalActive = loans.filter((l) => l.loanStatus === 'Active').length;
  const totalFacility = loans.reduce((s, l) => s + l.facilityAmount, 0);
  const totalOutstanding = loans.reduce((s, l) => s + (l.outstandingBalance ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-700 text-foreground">Loan Facilities</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage loan facilities linked to obligors — the middle layer between obligors and collateral pledges</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors shrink-0"
        >
          <Plus size={15} />
          New Loan
        </button>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Active Loans', value: totalActive, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Facility', value: formatTsh(totalFacility), icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Outstanding Balance', value: formatTsh(totalOutstanding), icon: BarChart2, color: 'text-amber-600', bg: 'bg-amber-50' },
        ].map((kpi) => (
          <div key={kpi.label} className={`flex items-center gap-3 p-4 rounded-xl border border-border ${kpi.bg}`}>
            <div className="w-10 h-10 rounded-lg bg-white/70 flex items-center justify-center shrink-0 shadow-sm">
              <kpi.icon size={18} className={kpi.color} />
            </div>
            <div>
              <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
              <p className={`text-xl font-700 ${kpi.color}`}>{kpi.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search by loan number, obligor, purpose…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              <X size={13} />
            </button>
          )}
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          <option value="">All Statuses</option>
          {LOAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <button onClick={load} className="p-2 rounded-lg border border-border bg-white hover:bg-muted transition-colors" title="Refresh">
          <RefreshCw size={14} className="text-muted-foreground" />
        </button>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-border shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 gap-2 text-muted-foreground">
            <Loader2 size={18} className="animate-spin" />
            <span className="text-sm">Loading loans…</span>
          </div>
        ) : error ? (
          <div className="flex items-center gap-2 p-6 text-sm text-red-700">
            <AlertCircle size={15} /> {error}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <CreditCard size={20} className="text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm font-600 text-foreground">No loans found</p>
              <p className="text-xs text-muted-foreground mt-1">{search || statusFilter ? 'Try adjusting your filters' : 'Create the first loan facility'}</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Loan / Obligor</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Facility</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Amount</th>
                  <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Outstanding</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Maturity</th>
                  <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map((loan) => {
                  const sc = statusConfig[loan.loanStatus] ?? statusConfig['Active'];
                  const StatusIcon = sc.icon;
                  const utilPct = loan.facilityAmount > 0 && loan.outstandingBalance != null
                    ? Math.min(100, (loan.outstandingBalance / loan.facilityAmount) * 100)
                    : null;
                  return (
                    <React.Fragment key={loan.id}>
                      <tr className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-3">
                          <p className="font-600 text-foreground font-mono text-xs">{loan.loanNumber}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {loan.obligorName ? (
                              <Link href={`/obligors/${loan.obligorId}`} className="text-xs text-primary hover:underline flex items-center gap-1">
                                <Building2 size={10} />
                                {loan.obligorName}
                              </Link>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                          {loan.purpose && <p className="text-[10px] text-muted-foreground mt-0.5 truncate max-w-[180px]">{loan.purpose}</p>}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-sm text-foreground">{loan.facilityType}</p>
                          <p className="text-xs text-muted-foreground">{loan.repaymentFrequency}</p>
                          {loan.interestRate != null && (
                            <p className="text-xs text-muted-foreground">{loan.interestRate}% p.a.</p>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-600 text-foreground">{formatTsh(loan.facilityAmount)}</p>
                          <p className="text-xs text-muted-foreground">{loan.currency}</p>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <p className="font-600 text-foreground">{formatTsh(loan.outstandingBalance)}</p>
                          {utilPct !== null && (
                            <div className="mt-1">
                              <div className="h-1.5 w-16 ml-auto rounded-full bg-gray-100 overflow-hidden">
                                <div
                                  className="h-full rounded-full"
                                  style={{
                                    width: `${utilPct}%`,
                                    background: utilPct >= 90 ? '#dc2626' : utilPct >= 70 ? '#d97706' : '#2563eb',
                                  }}
                                />
                              </div>
                              <p className="text-[10px] text-muted-foreground text-right mt-0.5">{utilPct.toFixed(0)}%</p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {loan.maturityDate ? (
                            <div className="flex items-center gap-1.5">
                              <Calendar size={12} className="text-muted-foreground" />
                              <span className="text-xs text-foreground">{new Date(loan.maturityDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                          {loan.disbursementDate && (
                            <p className="text-[10px] text-muted-foreground mt-0.5">Disbursed: {new Date(loan.disbursementDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</p>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-600 ${sc.bg} ${sc.color}`}>
                            <StatusIcon size={11} />
                            {loan.loanStatus}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1 justify-end">
                            <button
                              onClick={() => setExpandedLoanId(expandedLoanId === loan.id ? null : loan.id)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                              title="Workflow actions"
                            >
                              {expandedLoanId === loan.id ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                            </button>
                            <button
                              onClick={() => openEdit(loan)}
                              className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
                              title="Edit"
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => setDeleteConfirm(loan)}
                              className="p-1.5 rounded-md hover:bg-red-50 transition-colors text-muted-foreground hover:text-red-600"
                              title="Delete"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {expandedLoanId === loan.id && (
                        <tr>
                          <td colSpan={7} className="px-4 py-3 bg-blue-50/40 border-b border-border">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-700 text-muted-foreground uppercase tracking-wide mr-1">Initiate:</span>
                              <button
                                onClick={() => router.push(`/valuation-workflow?collateralId=&loanId=${encodeURIComponent(loan.id)}`)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-xs font-600 transition-colors"
                              >
                                <CalendarClock size={12} /> Schedule Valuation
                              </button>
                              <button
                                onClick={() => router.push(`/covenant-tracking?loanId=${encodeURIComponent(loan.id)}`)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-teal-200 bg-teal-50 hover:bg-teal-100 text-teal-700 text-xs font-600 transition-colors"
                              >
                                <Scale size={12} /> Add Covenant
                              </button>
                              <button
                                onClick={() => router.push(`/collateral-substitution?loanId=${encodeURIComponent(loan.id)}`)}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-700 text-xs font-600 transition-colors"
                              >
                                <ArrowLeftRight size={12} /> New Substitution
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editLoan ? `Edit Loan — ${editLoan.loanNumber}` : 'Register New Loan Facility'}
        subtitle={editLoan ? 'Update loan facility details' : 'Create a new loan facility linked to an obligor'}
        size="lg"
      >
        <div className="space-y-5">
          {saveError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle size={14} className="text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{saveError}</p>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Obligor */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-500 text-foreground mb-1">Obligor <span className="text-destructive">*</span></label>
              <select
                value={form.obligorId}
                onChange={(e) => setForm((f) => ({ ...f, obligorId: e.target.value }))}
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErrors.obligorId ? 'border-destructive' : 'border-border'}`}
              >
                <option value="">Select obligor…</option>
                {obligors.map((o) => (
                  <option key={o.id} value={o.id}>{o.fullName} ({o.obligorCode})</option>
                ))}
              </select>
              {formErrors.obligorId && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{formErrors.obligorId}</p>}
            </div>

            {/* Facility Type */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Facility Type <span className="text-destructive">*</span></label>
              <select
                value={form.facilityType}
                onChange={(e) => setForm((f) => ({ ...f, facilityType: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {FACILITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Loan Status <span className="text-destructive">*</span></label>
              <select
                value={form.loanStatus}
                onChange={(e) => setForm((f) => ({ ...f, loanStatus: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {LOAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>

            {/* Facility Amount */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Facility Amount (TZS) <span className="text-destructive">*</span></label>
              <input
                type="number"
                placeholder="e.g. 500000000"
                value={form.facilityAmount}
                onChange={(e) => setForm((f) => ({ ...f, facilityAmount: e.target.value }))}
                className={`w-full px-3 py-2.5 rounded-md border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 ${formErrors.facilityAmount ? 'border-destructive' : 'border-border'}`}
              />
              {formErrors.facilityAmount && <p className="mt-1 text-xs text-destructive flex items-center gap-1"><AlertCircle size={11} />{formErrors.facilityAmount}</p>}
            </div>

            {/* Outstanding Balance */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Outstanding Balance (TZS)</label>
              <input
                type="number"
                placeholder="Current outstanding amount"
                value={form.outstandingBalance}
                onChange={(e) => setForm((f) => ({ ...f, outstandingBalance: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Interest Rate */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Interest Rate (% p.a.)</label>
              <input
                type="number"
                step="0.1"
                placeholder="e.g. 14.5"
                value={form.interestRate}
                onChange={(e) => setForm((f) => ({ ...f, interestRate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Repayment Frequency */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Repayment Frequency</label>
              <select
                value={form.repaymentFrequency}
                onChange={(e) => setForm((f) => ({ ...f, repaymentFrequency: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                {REPAYMENT_FREQUENCIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {/* Disbursement Date */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Disbursement Date</label>
              <input
                type="date"
                value={form.disbursementDate}
                onChange={(e) => setForm((f) => ({ ...f, disbursementDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Maturity Date */}
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Maturity Date</label>
              <input
                type="date"
                value={form.maturityDate}
                onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Purpose */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-500 text-foreground mb-1">Loan Purpose</label>
              <input
                type="text"
                placeholder="e.g. Business expansion and working capital"
                value={form.purpose}
                onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>

            {/* Notes */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-500 text-foreground mb-1">Notes</label>
              <textarea
                rows={2}
                placeholder="Additional notes or conditions…"
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2 border-t border-border">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-border text-sm font-500 text-foreground hover:bg-muted transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors disabled:opacity-60"
            >
              {saving && <Loader2 size={14} className="animate-spin" />}
              {editLoan ? 'Save Changes' : 'Create Loan'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Delete Confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-base font-700 text-foreground mb-2">Delete Loan?</h3>
            <p className="text-sm text-muted-foreground mb-5">
              Are you sure you want to delete <span className="font-600 text-foreground">{deleteConfirm.loanNumber}</span>? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="px-4 py-2 rounded-lg border border-border text-sm font-500 hover:bg-muted transition-colors">Cancel</button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-600 hover:bg-red-700 transition-colors disabled:opacity-60"
              >
                {deleting && <Loader2 size={13} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
