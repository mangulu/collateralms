'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, AlertTriangle, TrendingDown, XCircle, CheckCircle2, RefreshCw, Plus, Search, ChevronDown, ChevronUp, Edit2, Loader2, AlertCircle, Info, X,  } from 'lucide-react';
import { loanClassificationService, LoanClassification, BotClassification, BOT_TIERS, QUALITATIVE_FLAGS, QualitativeFlag, computeClassification, getCurrentQuarter,  } from '@/lib/supabase/loanClassificationService';
import { loanService, Loan } from '@/lib/supabase/loanService';
import { obligorService, Obligor } from '@/lib/supabase/obligorService';
import { useAuth } from '@/contexts/AuthContext';
import Modal from '@/components/ui/Modal';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTsh(val: number): string {
  if (!val) return '—';
  if (val >= 1e9) return `TSh ${(val / 1e9).toFixed(2)}B`;
  if (val >= 1e6) return `TSh ${(val / 1e6).toFixed(2)}M`;
  if (val >= 1e3) return `TSh ${(val / 1e3).toFixed(0)}K`;
  return `TSh ${val.toFixed(0)}`;
}

function TierBadge({ tier }: { tier: BotClassification }) {
  const t = BOT_TIERS.find(x => x.key === tier);
  if (!t) return null;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${t.bg} ${t.color} border ${t.border}`}>
      {tier}
    </span>
  );
}

function TierIcon({ tier }: { tier: BotClassification }) {
  if (tier === 'Current') return <CheckCircle2 className="w-4 h-4 text-green-600" />;
  if (tier === 'Especially Mentioned') return <AlertCircle className="w-4 h-4 text-amber-600" />;
  if (tier === 'Substandard') return <AlertTriangle className="w-4 h-4 text-orange-600" />;
  if (tier === 'Doubtful') return <TrendingDown className="w-4 h-4 text-red-600" />;
  return <XCircle className="w-4 h-4 text-rose-700" />;
}

// ─── Classify Modal ───────────────────────────────────────────────────────────

interface ClassifyModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  loans: Loan[];
  obligors: Obligor[];
  editItem?: LoanClassification | null;
  userId?: string;
}

function ClassifyModal({ open, onClose, onSaved, loans, obligors, editItem, userId }: ClassifyModalProps) {
  const [loanId, setLoanId] = useState('');
  const [dpd, setDpd] = useState('0');
  const [balance, setBalance] = useState('');
  const [currency, setCurrency] = useState('TZS');
  const [flags, setFlags] = useState<QualitativeFlag[]>([]);
  const [useOverride, setUseOverride] = useState(false);
  const [overrideTier, setOverrideTier] = useState<BotClassification>('Current');
  const [overrideReason, setOverrideReason] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (editItem) {
      setLoanId(editItem.loanId);
      setDpd(String(editItem.daysPastDue));
      setBalance(String(editItem.outstandingBalance));
      setCurrency(editItem.currency);
      setFlags(editItem.qualitativeFlags);
      setNotes(editItem.notes ?? '');
    } else {
      setLoanId(''); setDpd('0'); setBalance(''); setCurrency('TZS');
      setFlags([]); setUseOverride(false); setOverrideTier('Current');
      setOverrideReason(''); setNotes('');
    }
    setError(null);
  }, [editItem, open]);

  const selectedLoan = loans.find(l => l.id === loanId);
  const selectedObligor = selectedLoan ? obligors.find(o => o.id === selectedLoan.obligorId) : null;

  const preview = computeClassification({
    loanId: loanId || 'preview',
    obligorId: selectedLoan?.obligorId || 'preview',
    daysPastDue: parseInt(dpd) || 0,
    outstandingBalance: parseFloat(balance) || 0,
    currency,
    qualitativeFlags: flags,
    overrideClassification: useOverride ? overrideTier : undefined,
    overrideReason: useOverride ? overrideReason : undefined,
  });

  const toggleFlag = (flag: QualitativeFlag) => {
    setFlags(prev => prev.includes(flag) ? prev.filter(f => f !== flag) : [...prev, flag]);
  };

  const handleSave = async () => {
    if (!loanId) { setError('Please select a loan.'); return; }
    if (!balance || parseFloat(balance) <= 0) { setError('Enter a valid outstanding balance.'); return; }
    if (useOverride && !overrideReason.trim()) { setError('Override reason is required.'); return; }
    setSaving(true); setError(null);
    try {
      if (editItem) {
        await loanClassificationService.update(editItem.id, {
          daysPastDue: parseInt(dpd) || 0,
          outstandingBalance: parseFloat(balance),
          qualitativeFlags: flags,
          overrideReason: useOverride ? overrideReason : undefined,
          notes,
        });
      } else {
        await loanClassificationService.classify({
          loanId,
          obligorId: selectedLoan?.obligorId ?? '',
          daysPastDue: parseInt(dpd) || 0,
          outstandingBalance: parseFloat(balance),
          currency,
          qualitativeFlags: flags,
          overrideClassification: useOverride ? overrideTier : undefined,
          overrideReason: useOverride ? overrideReason : undefined,
          notes,
          classifiedBy: userId,
        });
      }
      onSaved();
      onClose();
    } catch (e: any) {
      setError(e?.message ?? 'Failed to save classification.');
    } finally {
      setSaving(false);
    }
  };

  const previewTier = BOT_TIERS.find(t => t.key === preview.classification);

  return (
    <Modal isOpen={open} onClose={onClose} title={editItem ? 'Edit Classification' : 'Classify Loan — BOT 5-Tier Engine'} size="lg">
      <div className="space-y-5">
        {/* Loan selector */}
        {!editItem && (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Loan Facility <span className="text-red-500">*</span></label>
            <select value={loanId} onChange={e => {
              setLoanId(e.target.value);
              const l = loans.find(x => x.id === e.target.value);
              if (l) { setBalance(String(l.outstandingBalance ?? l.facilityAmount ?? '')); setCurrency(l.currency); }
            }} className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">— Select Loan —</option>
              {loans.map(l => (
                <option key={l.id} value={l.id}>{l.loanNumber} — {l.obligorName} ({l.facilityType})</option>
              ))}
            </select>
          </div>
        )}

        {/* DPD + Balance */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Days Past Due (DPD)</label>
            <input type="number" min="0" value={dpd} onChange={e => setDpd(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <p className="text-xs text-slate-500 mt-1">BOT threshold: 0 / 1–30 / 31–90 / 91–180 / 181+</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Outstanding Balance <span className="text-red-500">*</span></label>
            <div className="flex gap-2">
              <input type="number" min="0" value={balance} onChange={e => setBalance(e.target.value)}
                className="flex-1 border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              <select value={currency} onChange={e => setCurrency(e.target.value)}
                className="border border-slate-300 rounded-lg px-2 py-2 text-sm focus:outline-none">
                <option>TZS</option><option>USD</option><option>EUR</option>
              </select>
            </div>
          </div>
        </div>

        {/* Qualitative Flags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Qualitative Flags (BOT Criteria)</label>
          <div className="grid grid-cols-2 gap-2">
            {QUALITATIVE_FLAGS.map(f => {
              const tier = BOT_TIERS.find(t => t.key === f.tier);
              return (
                <label key={f.key} className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${flags.includes(f.key) ? `${tier?.bg} ${tier?.border}` : 'border-slate-200 hover:bg-slate-50'}`}>
                  <input type="checkbox" checked={flags.includes(f.key)} onChange={() => toggleFlag(f.key)} className="rounded" />
                  <span className="text-xs text-slate-700">{f.label}</span>
                  <span className={`ml-auto text-xs font-medium ${tier?.color}`}>{f.tier}</span>
                </label>
              );
            })}
          </div>
        </div>

        {/* Override */}
        <div className="border border-slate-200 rounded-lg p-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={useOverride} onChange={e => setUseOverride(e.target.checked)} className="rounded" />
            <span className="text-sm font-medium text-slate-700">Manual Override (Credit Committee Decision)</span>
          </label>
          {useOverride && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Override Classification</label>
                <select value={overrideTier} onChange={e => setOverrideTier(e.target.value as BotClassification)}
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  {BOT_TIERS.map(t => <option key={t.key} value={t.key}>{t.key} ({(t.rate * 100).toFixed(0)}%)</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Override Reason <span className="text-red-500">*</span></label>
                <input value={overrideReason} onChange={e => setOverrideReason(e.target.value)}
                  placeholder="Credit committee approval ref..."
                  className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
          )}
        </div>

        {/* Live Preview */}
        {loanId && balance && (
          <div className={`rounded-lg p-4 border-2 ${previewTier?.border} ${previewTier?.bg}`}>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Classification Preview</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <TierIcon tier={preview.classification} />
                <div>
                  <p className={`text-base font-bold ${previewTier?.color}`}>{preview.classification}</p>
                  <p className="text-xs text-slate-500">Trigger: {preview.primaryTrigger.replace(/_/g, ' ')}</p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Provision Rate</p>
                <p className={`text-lg font-bold ${previewTier?.color}`}>{(preview.provisionRate * 100).toFixed(0)}%</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-slate-500">Provision Amount</p>
                <p className="text-base font-bold text-slate-800">{formatTsh(preview.provisionAmount)}</p>
              </div>
            </div>
          </div>
        )}

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none" />
        </div>

        {error && <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>}

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50">Cancel</button>
          <button onClick={handleSave} disabled={saving}
            className="px-5 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {editItem ? 'Update' : 'Classify'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function LoanClassificationContent() {
  const { user } = useAuth();
  const [classifications, setClassifications] = useState<LoanClassification[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [obligors, setObligors] = useState<Obligor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filterTier, setFilterTier] = useState('');
  const [quarter, setQuarter] = useState(getCurrentQuarter());
  const [modalOpen, setModalOpen] = useState(false);
  const [editItem, setEditItem] = useState<LoanClassification | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const [cls, ls, obs] = await Promise.all([
        loanClassificationService.getAll(quarter),
        loanService.getAll(),
        obligorService.getAll(),
      ]);
      setClassifications(cls);
      setLoans(ls);
      setObligors(obs);
    } catch { setError('Failed to load data.'); }
    finally { setLoading(false); }
  }, [quarter]);

  useEffect(() => { load(); }, [load]);

  const filtered = classifications.filter(c => {
    const q = search.toLowerCase();
    const matchSearch = !q || (c.loanNumber ?? '').toLowerCase().includes(q) ||
      (c.obligorName ?? '').toLowerCase().includes(q) || (c.obligorCode ?? '').toLowerCase().includes(q);
    const matchTier = !filterTier || c.classification === filterTier;
    return matchSearch && matchTier;
  });

  // Summary stats
  const totalBalance = filtered.reduce((s, c) => s + c.outstandingBalance, 0);
  const totalProvision = filtered.reduce((s, c) => s + c.provisionAmount, 0);
  const tierCounts = BOT_TIERS.map(t => ({
    ...t,
    count: filtered.filter(c => c.classification === t.key).length,
    balance: filtered.filter(c => c.classification === t.key).reduce((s, c) => s + c.outstandingBalance, 0),
    provision: filtered.filter(c => c.classification === t.key).reduce((s, c) => s + c.provisionAmount, 0),
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Loan Classification</h1>
          <p className="text-sm text-slate-500 mt-0.5">BOT 5-Tier Classification Engine — Risk Assets Regulations 2014</p>
        </div>
        <div className="flex items-center gap-3">
          <select value={quarter} onChange={e => setQuarter(e.target.value)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            {Array.from({ length: 6 }, (_, i) => {
              const d = new Date(); d.setMonth(d.getMonth() - i * 3);
              const q = `${d.getFullYear()}-Q${Math.ceil((d.getMonth() + 1) / 3)}`;
              return <option key={q} value={q}>{q}</option>;
            })}
          </select>
          <button onClick={load} className="p-2 border border-slate-300 rounded-lg hover:bg-slate-50">
            <RefreshCw className="w-4 h-4 text-slate-600" />
          </button>
          <button onClick={() => { setEditItem(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700">
            <Plus className="w-4 h-4" /> Classify Loan
          </button>
        </div>
      </div>

      {/* BOT Rate Schedule Banner */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-blue-800">BOT Provisioning Rate Schedule (Risk Assets Regulations 2014)</p>
            <div className="flex flex-wrap gap-3 mt-2">
              {BOT_TIERS.map(t => (
                <span key={t.key} className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${t.bg} ${t.color} border ${t.border}`}>
                  {t.key}: {(t.rate * 100).toFixed(0)}%
                  <span className="opacity-60">({t.dpd_min === 0 && t.dpd_max === 0 ? '0 DPD' : `${t.dpd_min}–${t.dpd_max === 9999 ? '181+' : t.dpd_max} DPD`})</span>
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Tier Summary Cards */}
      <div className="grid grid-cols-5 gap-3">
        {tierCounts.map(t => (
          <button key={t.key} onClick={() => setFilterTier(filterTier === t.key ? '' : t.key)}
            className={`rounded-xl p-4 border-2 text-left transition-all ${filterTier === t.key ? `${t.bg} ${t.border}` : 'bg-white border-slate-200 hover:border-slate-300'}`}>
            <div className="flex items-center justify-between mb-2">
              <TierIcon tier={t.key as BotClassification} />
              <span className={`text-xs font-bold ${t.color}`}>{(t.rate * 100).toFixed(0)}%</span>
            </div>
            <p className="text-xs font-medium text-slate-500 leading-tight">{t.label}</p>
            <p className="text-xl font-bold text-slate-900 mt-1">{t.count}</p>
            <p className="text-xs text-slate-500 mt-0.5">{formatTsh(t.provision)} prov.</p>
          </button>
        ))}
      </div>

      {/* Portfolio Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Portfolio</p>
          <p className="text-2xl font-bold text-slate-900 mt-1">{formatTsh(totalBalance)}</p>
          <p className="text-xs text-slate-500 mt-1">{filtered.length} classified loans</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">Total Provision Required</p>
          <p className="text-2xl font-bold text-red-700 mt-1">{formatTsh(totalProvision)}</p>
          <p className="text-xs text-slate-500 mt-1">{totalBalance > 0 ? ((totalProvision / totalBalance) * 100).toFixed(2) : '0.00'}% of portfolio</p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs text-slate-500 uppercase tracking-wide">NPL Ratio</p>
          <p className="text-2xl font-bold text-orange-700 mt-1">
            {totalBalance > 0
              ? (((tierCounts.find(t => t.key === 'Substandard')?.balance ?? 0) +
                  (tierCounts.find(t => t.key === 'Doubtful')?.balance ?? 0) +
                  (tierCounts.find(t => t.key === 'Loss')?.balance ?? 0)) / totalBalance * 100).toFixed(2)
              : '0.00'}%
          </p>
          <p className="text-xs text-slate-500 mt-1">Substandard + Doubtful + Loss</p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search loan, obligor..."
            className="w-full pl-9 pr-4 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        {filterTier && (
          <button onClick={() => setFilterTier('')} className="flex items-center gap-1.5 px-3 py-2 text-sm text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100">
            <X className="w-3.5 h-3.5" /> Clear filter
          </button>
        )}
        <p className="text-sm text-slate-500 ml-auto">{filtered.length} records</p>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-3 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700">
          <AlertCircle className="w-5 h-5 shrink-0" /> {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-slate-400">
          <ShieldCheck className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">No classifications found</p>
          <p className="text-sm mt-1">Click "Classify Loan" to run the BOT classification engine</p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Loan / Obligor</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Classification</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">DPD</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Outstanding</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Rate</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Provision</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Trigger</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(c => (
                <React.Fragment key={c.id}>
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{c.loanNumber ?? '—'}</p>
                      <p className="text-xs text-slate-500">{c.obligorName ?? '—'} · {c.facilityType ?? '—'}</p>
                    </td>
                    <td className="px-4 py-3"><TierBadge tier={c.classification} /></td>
                    <td className="px-4 py-3 text-right">
                      <span className={`font-semibold ${c.daysPastDue > 90 ? 'text-red-700' : c.daysPastDue > 30 ? 'text-orange-700' : c.daysPastDue > 0 ? 'text-amber-700' : 'text-green-700'}`}>
                        {c.daysPastDue}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-slate-800">{formatTsh(c.outstandingBalance)}</td>
                    <td className="px-4 py-3 text-right font-semibold text-slate-700">{(c.provisionRate * 100).toFixed(0)}%</td>
                    <td className="px-4 py-3 text-right font-semibold text-red-700">{formatTsh(c.provisionAmount)}</td>
                    <td className="px-4 py-3">
                      <span className="text-xs text-slate-500 capitalize">{c.primaryTrigger.replace(/_/g, ' ')}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.classificationDate}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <button onClick={() => setExpandedId(expandedId === c.id ? null : c.id)}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                          {expandedId === c.id ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                        </button>
                        <button onClick={() => { setEditItem(c); setModalOpen(true); }}
                          className="p-1.5 rounded hover:bg-slate-100 text-slate-400">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                  {expandedId === c.id && (
                    <tr className="bg-slate-50">
                      <td colSpan={9} className="px-4 py-3">
                        <div className="grid grid-cols-3 gap-4 text-sm">
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Qualitative Flags</p>
                            {c.qualitativeFlags.length === 0
                              ? <p className="text-slate-400 text-xs">None</p>
                              : c.qualitativeFlags.map(f => {
                                  const flag = QUALITATIVE_FLAGS.find(x => x.key === f);
                                  return <p key={f} className="text-xs text-slate-700">• {flag?.label ?? f}</p>;
                                })}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Override</p>
                            {c.overrideReason
                              ? <p className="text-xs text-slate-700">{c.overrideReason}</p>
                              : <p className="text-slate-400 text-xs">No override</p>}
                          </div>
                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase mb-1">Review Date</p>
                            <p className="text-xs text-slate-700">{c.reviewDate ?? '—'}</p>
                            {c.notes && <p className="text-xs text-slate-500 mt-1">{c.notes}</p>}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ClassifyModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={load}
        loans={loans}
        obligors={obligors}
        editItem={editItem}
        userId={user?.id}
      />
    </div>
  );
}
