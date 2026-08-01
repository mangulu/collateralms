'use client';
import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, Search, X, Loader2, AlertCircle, RefreshCw, Building2, CreditCard, Calendar, CheckCircle2, XCircle, Clock, Edit2, Trash2, BarChart2, ChevronRight } from 'lucide-react';
import { loanService, Loan } from '@/lib/supabase/loanService';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';
import LinkedCollateralsPanel from './LinkedCollateralsPanel';
import FacilityObligorSummary from './FacilityObligorSummary';

const FACILITY_TYPES = ['Term Loan', 'Overdraft Facility', 'Mortgage', 'Asset Finance', 'Trade Finance', 'Revolving Credit', 'Letter of Credit', 'Other'];
const REPAYMENT_FREQUENCIES = ['Monthly', 'Quarterly', 'Semi-Annual', 'Annual', 'Bullet'];
const LOAN_STATUSES = ['Active', 'Closed', 'Defaulted', 'Restructured', 'Written Off'];

const statusConfig: Record<string, { color: string; bg: string; icon: React.ElementType; dot: string }> = {
  Active: { color: 'text-green-700', bg: 'bg-green-100', icon: CheckCircle2, dot: 'bg-green-500' },
  Closed: { color: 'text-slate-600', bg: 'bg-slate-100', icon: CheckCircle2, dot: 'bg-slate-400' },
  Defaulted: { color: 'text-red-700', bg: 'bg-red-100', icon: XCircle, dot: 'bg-red-500' },
  Restructured: { color: 'text-amber-700', bg: 'bg-amber-100', icon: Clock, dot: 'bg-amber-500' },
  'Written Off': { color: 'text-rose-700', bg: 'bg-rose-100', icon: XCircle, dot: 'bg-rose-500' },
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

export default function LoanRegistryContent() {
  const { user } = useAuth();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [obligors, setObligors] = useState<Obligor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [facilityFilter, setFacilityFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editLoan, setEditLoan] = useState<Loan | null>(null);
  const [form, setForm] = useState<LoanFormData>(emptyForm);
  const [formErrors, setFormErrors] = useState<Partial<LoanFormData>>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Loan | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Selected loan for detail panel
  const [selectedLoan, setSelectedLoan] = useState<Loan | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [ls, obs] = await Promise.all([loanService.getAll(), obligorService.getAll()]);
      setLoans(ls);
      setObligors(obs);
      // Auto-select first loan if none selected
      if (ls.length > 0 && !selectedLoan) setSelectedLoan(ls[0]);
    } catch {
      setError('Failed to load loan registry.');
    } finally {
      setLoading(false);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  const filtered = loans.filter((l) => {
    const q = search.toLowerCase();
    const matchSearch = !q ||
      l.loanNumber.toLowerCase().includes(q) ||
      (l.obligorName ?? '').toLowerCase().includes(q) ||
      (l.purpose ?? '').toLowerCase().includes(q) ||
      (l.obligorCode ?? '').toLowerCase().includes(q);
    const matchStatus = !statusFilter || l.loanStatus === statusFilter;
    const matchFacility = !facilityFilter || l.facilityType === facilityFilter;
    return matchSearch && matchStatus && matchFacility;
  });

  const openAdd = async () => {
    setEditLoan(null);
    setForm({ ...emptyForm });
    setFormErrors({});
    setSaveError(null);
    setModalOpen(true);
  };

  const openEdit = (loan: Loan, e: React.MouseEvent) => {
    e.stopPropagation();
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
        if (updated) {
          setLoans((prev) => prev.map((l) => l.id === updated.id ? updated : l));
          if (selectedLoan?.id === updated.id) setSelectedLoan(updated);
        }
      } else {
        const loanNumber = await loanService.generateLoanNumber();
        const created = await loanService.create({ ...payload, loanNumber }, user.id);
        if (created) {
          setLoans((prev) => [created, ...prev]);
          setSelectedLoan(created);
        }
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
    if (ok) {
      setLoans((prev) => prev.filter((l) => l.id !== deleteConfirm.id));
      if (selectedLoan?.id === deleteConfirm.id) {
        const remaining = loans.filter((l) => l.id !== deleteConfirm.id);
        setSelectedLoan(remaining[0] ?? null);
      }
    }
    setDeleting(false);
    setDeleteConfirm(null);
  };

  const totalActive = loans.filter((l) => l.loanStatus === 'Active').length;
  const totalFacility = loans.reduce((s, l) => s + l.facilityAmount, 0);
  const totalOutstanding = loans.reduce((s, l) => s + (l.outstandingBalance ?? 0), 0);
  const totalDefaulted = loans.filter((l) => l.loanStatus === 'Defaulted').length;

  return (
    <div className="flex flex-col h-full">
      {/* Page Header */}
      <div className="px-6 pt-6 pb-4 border-b border-border bg-white shrink-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-700 text-foreground">Loan Registry</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Dedicated registry for all loan facilities — with linked collateral view and obligor relationship tracking
            </p>
          </div>
          <button
            onClick={openAdd}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-600 hover:bg-primary/90 transition-colors shrink-0"
          >
            <Plus size={14} />
            New Loan
          </button>
        </div>

        {/* KPI Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {[
            { label: 'Total Loans', value: loans.length, icon: CreditCard, color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Active', value: totalActive, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
            { label: 'Total Facility', value: formatTsh(totalFacility), icon: BarChart2, color: 'text-indigo-600', bg: 'bg-indigo-50' },
            { label: 'Defaulted', value: totalDefaulted, icon: XCircle, color: totalDefaulted > 0 ? 'text-red-600' : 'text-slate-500', bg: totalDefaulted > 0 ? 'bg-red-50' : 'bg-slate-50' },
          ].map((kpi) => (
            <div key={kpi.label} className={`flex items-center gap-2.5 p-3 rounded-xl border border-border ${kpi.bg}`}>
              <kpi.icon size={16} className={kpi.color} />
              <div>
                <p className="text-[10px] font-500 text-muted-foreground uppercase tracking-wide">{kpi.label}</p>
                <p className={`text-lg font-700 ${kpi.color} leading-tight`}>{kpi.value}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Content: 3-column layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* LEFT: Loan List */}
        <div className="w-[340px] shrink-0 flex flex-col border-r border-border bg-white overflow-hidden">
          {/* Filters */}
          <div className="p-3 border-b border-border space-y-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search loans, obligors…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-8 pr-7 py-2 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X size={12} />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Statuses</option>
                {LOAN_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
              <select
                value={facilityFilter}
                onChange={(e) => setFacilityFilter(e.target.value)}
                className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="">All Types</option>
                {FACILITY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
              </select>
              <button onClick={load} className="p-1.5 rounded-lg border border-border bg-white hover:bg-muted transition-colors" title="Refresh">
                <RefreshCw size={13} className="text-muted-foreground" />
              </button>
            </div>
          </div>

          {/* Loan List */}
          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-12 gap-2 text-muted-foreground">
                <Loader2 size={16} className="animate-spin" />
                <span className="text-xs">Loading…</span>
              </div>
            ) : error ? (
              <div className="flex items-center gap-2 p-4 text-xs text-red-600">
                <AlertCircle size={13} /> {error}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2 text-center px-4">
                <CreditCard size={24} className="text-muted-foreground/40" />
                <p className="text-xs text-muted-foreground">{search || statusFilter || facilityFilter ? 'No loans match your filters' : 'No loans registered yet'}</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {filtered.map((loan) => {
                  const sc = statusConfig[loan.loanStatus] ?? statusConfig['Active'];
                  const isSelected = selectedLoan?.id === loan.id;
                  const utilPct = loan.facilityAmount > 0 && loan.outstandingBalance != null
                    ? Math.min(100, (loan.outstandingBalance / loan.facilityAmount) * 100)
                    : null;
                  return (
                    <div
                      key={loan.id}
                      onClick={() => setSelectedLoan(loan)}
                      className={`px-3 py-3 cursor-pointer transition-colors group ${isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30 border-l-2 border-l-transparent'}`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sc.dot}`} />
                            <span className="text-xs font-700 text-foreground font-mono">{loan.loanNumber}</span>
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <Building2 size={10} className="text-muted-foreground shrink-0" />
                            <span className="text-[11px] text-muted-foreground truncate">{loan.obligorName ?? '—'}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{loan.facilityType} · {loan.currency}</p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-xs font-700 text-foreground">{formatTsh(loan.facilityAmount)}</p>
                          <span className={`text-[10px] font-600 px-1.5 py-0.5 rounded-full ${sc.bg} ${sc.color}`}>{loan.loanStatus}</span>
                        </div>
                      </div>
                      {utilPct !== null && (
                        <div className="mt-2">
                          <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${utilPct}%`,
                                background: utilPct >= 90 ? '#dc2626' : utilPct >= 70 ? '#d97706' : '#2563eb',
                              }}
                            />
                          </div>
                        </div>
                      )}
                      {/* Row actions */}
                      <div className="flex items-center gap-1 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={(e) => openEdit(loan, e)}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-500 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                        >
                          <Edit2 size={10} /> Edit
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDeleteConfirm(loan); }}
                          className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-500 text-muted-foreground hover:text-red-600 hover:bg-red-50 transition-colors"
                        >
                          <Trash2 size={10} /> Delete
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Footer count */}
          {!loading && filtered.length > 0 && (
            <div className="px-3 py-2 border-t border-border bg-muted/20">
              <p className="text-[10px] text-muted-foreground">{filtered.length} of {loans.length} loans</p>
            </div>
          )}
        </div>

        {/* RIGHT: Detail panels */}
        <div className="flex-1 overflow-y-auto bg-slate-50/50">
          {!selectedLoan ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-center p-8">
              <div className="w-14 h-14 rounded-2xl bg-white border border-border flex items-center justify-center shadow-sm">
                <CreditCard size={24} className="text-muted-foreground/50" />
              </div>
              <div>
                <p className="text-sm font-600 text-foreground">Select a loan</p>
                <p className="text-xs text-muted-foreground mt-1">Click any loan from the list to view linked collaterals and obligor relationship details</p>
              </div>
            </div>
          ) : (
            <div className="p-4 space-y-4">
              {/* Loan Detail Header */}
              <div className="bg-white rounded-xl border border-border shadow-sm p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-base font-700 text-foreground font-mono">{selectedLoan.loanNumber}</span>
                      {(() => {
                        const sc = statusConfig[selectedLoan.loanStatus] ?? statusConfig['Active'];
                        const StatusIcon = sc.icon;
                        return (
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-600 ${sc.bg} ${sc.color}`}>
                            <StatusIcon size={11} />
                            {selectedLoan.loanStatus}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-sm text-muted-foreground mt-0.5">{selectedLoan.facilityType} · {selectedLoan.currency}</p>
                    {selectedLoan.purpose && (
                      <p className="text-xs text-muted-foreground mt-1 italic">"{selectedLoan.purpose}"</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-700 text-foreground">{formatTsh(selectedLoan.facilityAmount)}</p>
                    <p className="text-xs text-muted-foreground">Outstanding: {formatTsh(selectedLoan.outstandingBalance)}</p>
                    {selectedLoan.maturityDate && (
                      <div className="flex items-center gap-1 justify-end mt-1">
                        <Calendar size={11} className="text-muted-foreground" />
                        <span className="text-[11px] text-muted-foreground">
                          {new Date(selectedLoan.maturityDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border">
                  <button
                    onClick={(e) => openEdit(selectedLoan, e)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-500 text-foreground hover:bg-muted transition-colors"
                  >
                    <Edit2 size={12} /> Edit Loan
                  </button>
                  <button
                    onClick={() => setDeleteConfirm(selectedLoan)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 text-xs font-500 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <Link
                    href={`/loans`}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-500 text-muted-foreground hover:bg-muted transition-colors ml-auto"
                  >
                    View in Loans Module <ChevronRight size={11} />
                  </Link>
                </div>
              </div>

              {/* Two-column panels */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                <LinkedCollateralsPanel loanId={selectedLoan.id} loanNumber={selectedLoan.loanNumber} />
                <FacilityObligorSummary loan={selectedLoan} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editLoan ? `Edit — ${editLoan.loanNumber}` : 'Register New Loan Facility'}
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
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Disbursement Date</label>
              <input
                type="date"
                value={form.disbursementDate}
                onChange={(e) => setForm((f) => ({ ...f, disbursementDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="block text-sm font-500 text-foreground mb-1">Maturity Date</label>
              <input
                type="date"
                value={form.maturityDate}
                onChange={(e) => setForm((f) => ({ ...f, maturityDate: e.target.value }))}
                className="w-full px-3 py-2.5 rounded-md border border-border text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
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
              {editLoan ? 'Save Changes' : 'Register Loan'}
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
