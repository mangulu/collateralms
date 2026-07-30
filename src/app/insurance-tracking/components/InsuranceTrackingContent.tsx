'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Shield, AlertTriangle, CheckCircle2, Clock, Plus, RefreshCw, ChevronDown, ChevronUp, Calendar } from 'lucide-react';
import {
  listInsurancePolicies,
  createInsurancePolicy,
  updateInsurancePolicy,
  getInsuranceStats,
  type CollateralInsurance,
  type InsuranceStatus,
} from '@/lib/supabase/insuranceService';
import { useAuth } from '@/contexts/AuthContext';
import { workflowLookupsService, type CollateralOption } from '@/lib/supabase/workflowLookupsService';
import SearchableSelect, { type SelectOption } from '@/components/ui/SearchableSelect';
import { useSearchParams } from 'next/navigation';

const STATUS_COLORS: Record<InsuranceStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  'Expiring Soon': 'bg-amber-100 text-amber-700',
  Expired: 'bg-red-100 text-red-700',
  Cancelled: 'bg-gray-100 text-gray-500',
  'Pending Renewal': 'bg-blue-100 text-blue-700',
};

const COVERAGE_TYPES = [
  'Comprehensive Fire & Perils', 'Motor Vehicle Comprehensive', 'Marine Cargo',
  'Public Liability', 'Professional Indemnity', 'All Risks', 'Life Insurance', 'Other',
];

function formatCurrency(val: number, currency = 'TZS'): string {
  return `${currency} ${val.toLocaleString()}`;
}

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function InsuranceTrackingContent() {
  const { userProfile } = useAuth();
  const searchParams = useSearchParams();
  const [policies, setPolicies] = useState<CollateralInsurance[]>([]);
  const [stats, setStats] = useState({ total: 0, active: 0, expiringSoon: 0, expired: 0, pendingRenewal: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<InsuranceStatus | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Lookup data
  const [collateralOptions, setCollateralOptions] = useState<CollateralOption[]>([]);
  const [lookupsLoading, setLookupsLoading] = useState(false);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState<CollateralInsurance | null>(null);

  const emptyForm = {
    collateralId: '',
    policyNumber: '',
    insurerName: '',
    coverageType: 'Comprehensive Fire & Perils',
    coverageAmount: '',
    currency: 'TZS',
    premiumAmount: '',
    premiumFrequency: 'Annual',
    policyStartDate: '',
    policyEndDate: '',
    renewalDate: '',
    beneficiary: '',
    contactPerson: '',
    contactPhone: '',
    contactEmail: '',
    certificateRef: '',
    notes: '',
  };

  const [createForm, setCreateForm] = useState(emptyForm);
  const [editForm, setEditForm] = useState<Partial<typeof emptyForm>>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, s] = await Promise.all([
        listInsurancePolicies(filterStatus !== 'All' ? { status: filterStatus } : undefined),
        getInsuranceStats(),
      ]);
      setPolicies(data);
      setStats(s);
    } catch (e: any) {
      setError(e.message ?? 'Failed to load insurance policies');
    } finally {
      setLoading(false);
    }
  }, [filterStatus]);

  useEffect(() => { load(); }, [load]);

  const loadLookups = useCallback(async () => {
    if (collateralOptions.length > 0) return;
    setLookupsLoading(true);
    try {
      const cols = await workflowLookupsService.getCollateralOptions();
      setCollateralOptions(cols);
    } catch { /* silent */ } finally {
      setLookupsLoading(false);
    }
  }, [collateralOptions.length]);

  // Handle contextual pre-fill from URL params
  useEffect(() => {
    const collateralId = searchParams.get('collateralId');
    if (collateralId) {
      setCreateForm((f) => ({ ...f, collateralId }));
      setShowCreateModal(true);
      loadLookups();
    }
  }, [searchParams, loadLookups]);

  const openCreateModal = () => {
    setShowCreateModal(true);
    loadLookups();
  };

  const handleCreate = async () => {
    if (!createForm.collateralId || !createForm.policyNumber || !createForm.insurerName || !createForm.coverageAmount || !createForm.policyStartDate || !createForm.policyEndDate) return;
    setActionLoading(true);
    try {
      await createInsurancePolicy({
        collateralId: createForm.collateralId,
        policyNumber: createForm.policyNumber,
        insurerName: createForm.insurerName,
        coverageType: createForm.coverageType,
        coverageAmount: parseFloat(createForm.coverageAmount),
        currency: createForm.currency,
        premiumAmount: createForm.premiumAmount ? parseFloat(createForm.premiumAmount) : undefined,
        premiumFrequency: createForm.premiumFrequency,
        policyStartDate: createForm.policyStartDate,
        policyEndDate: createForm.policyEndDate,
        renewalDate: createForm.renewalDate || undefined,
        beneficiary: createForm.beneficiary || undefined,
        contactPerson: createForm.contactPerson || undefined,
        contactPhone: createForm.contactPhone || undefined,
        contactEmail: createForm.contactEmail || undefined,
        certificateRef: createForm.certificateRef || undefined,
        notes: createForm.notes || undefined,
        createdBy: userProfile?.id,
      });
      setShowCreateModal(false);
      setCreateForm(emptyForm);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!showEditModal) return;
    setActionLoading(true);
    try {
      await updateInsurancePolicy(showEditModal.id, {
        policyNumber: editForm.policyNumber,
        insurerName: editForm.insurerName,
        coverageAmount: editForm.coverageAmount ? parseFloat(editForm.coverageAmount) : undefined,
        premiumAmount: editForm.premiumAmount ? parseFloat(editForm.premiumAmount) : undefined,
        policyStartDate: editForm.policyStartDate,
        policyEndDate: editForm.policyEndDate,
        renewalDate: editForm.renewalDate,
        notes: editForm.notes,
      });
      setShowEditModal(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(false);
    }
  };

  const openEdit = (p: CollateralInsurance) => {
    setEditForm({
      policyNumber: p.policyNumber,
      insurerName: p.insurerName,
      coverageAmount: String(p.coverageAmount),
      premiumAmount: p.premiumAmount != null ? String(p.premiumAmount) : '',
      policyStartDate: p.policyStartDate,
      policyEndDate: p.policyEndDate,
      renewalDate: p.renewalDate ?? '',
      notes: p.notes ?? '',
    });
    setShowEditModal(p);
  };

  const filtered = filterStatus === 'All' ? policies : policies.filter((p) => p.insuranceStatus === filterStatus);

  const collateralSelectOptions: SelectOption[] = collateralOptions.map((c) => ({
    value: c.id,
    label: c.collateralId,
    sublabel: `${c.description} · ${c.type}`,
    badge: c.facilityId,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Insurance Tracking</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage insurance certificate lifecycle with expiry and renewal alerts</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={load} className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-500"><RefreshCw size={16} /></button>
          <button
            onClick={openCreateModal}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium"
            style={{ backgroundColor: '#003c5a' }}
          >
            <Plus size={16} /> Add Policy
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">{error}</div>}

      {/* Expiry Alert Banner */}
      {(stats.expiringSoon > 0 || stats.expired > 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle size={20} className="text-amber-600 shrink-0 mt-0.5" />
          <div>
            <div className="font-semibold text-amber-800">Insurance Alert</div>
            <div className="text-sm text-amber-700">
              {stats.expiringSoon > 0 && <span>{stats.expiringSoon} polic{stats.expiringSoon > 1 ? 'ies' : 'y'} expiring within 30 days. </span>}
              {stats.expired > 0 && <span className="text-red-700">{stats.expired} polic{stats.expired > 1 ? 'ies' : 'y'} already expired.</span>}
            </div>
          </div>
        </div>
      )}

      {/* KPI Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'text-gray-600', bg: 'bg-gray-50', icon: Shield },
          { label: 'Active', value: stats.active, color: 'text-green-600', bg: 'bg-green-50', icon: CheckCircle2 },
          { label: 'Expiring Soon', value: stats.expiringSoon, color: 'text-amber-600', bg: 'bg-amber-50', icon: Clock },
          { label: 'Expired', value: stats.expired, color: 'text-red-600', bg: 'bg-red-50', icon: AlertTriangle },
          { label: 'Pending Renewal', value: stats.pendingRenewal, color: 'text-blue-600', bg: 'bg-blue-50', icon: Calendar },
        ].map((k) => (
          <div key={k.label} className={`${k.bg} rounded-xl p-4 flex items-center gap-3`}>
            <k.icon size={20} className={k.color} />
            <div>
              <div className={`text-xl font-bold ${k.color}`}>{k.value}</div>
              <div className="text-xs text-gray-500">{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 flex-wrap">
        {(['All', 'Active', 'Expiring Soon', 'Expired', 'Pending Renewal', 'Cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors ${
              filterStatus === s ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
            }`}
            style={filterStatus === s ? { backgroundColor: '#003c5a' } : {}}
          >
            {s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-gray-400"><RefreshCw size={24} className="animate-spin mx-auto mb-2" />Loading…</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400"><Shield size={32} className="mx-auto mb-2 opacity-40" /><p>No insurance policies found</p></div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {['Policy', 'Insurer', 'Collateral', 'Coverage', 'Period', 'Renewal', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((p) => {
                const isExpired = p.insuranceStatus === 'Expired';
                const isExpiringSoon = p.insuranceStatus === 'Expiring Soon';
                return (
                  <React.Fragment key={p.id}>
                    <tr className={`hover:bg-gray-50 ${isExpired ? 'bg-red-50/30' : isExpiringSoon ? 'bg-amber-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{p.policyNumber}</div>
                        <div className="text-xs text-gray-400">{p.coverageType}</div>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{p.insurerName}</td>
                      <td className="px-4 py-3">
                        <div className="text-gray-700 truncate max-w-[140px]">{p.collateralDescription ?? '—'}</div>
                        <div className="text-xs text-gray-400">{p.collateralType}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{formatCurrency(p.coverageAmount, p.currency)}</div>
                        {p.premiumAmount && <div className="text-xs text-gray-400">{formatCurrency(p.premiumAmount, p.currency)} / {p.premiumFrequency}</div>}
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <div className="text-gray-700">{formatDate(p.policyStartDate)}</div>
                        <div className={isExpired ? 'text-red-600 font-medium' : isExpiringSoon ? 'text-amber-600 font-medium' : 'text-gray-500'}>
                          → {formatDate(p.policyEndDate)}
                          {p.daysToExpiry !== undefined && p.daysToExpiry <= 30 && (
                            <span className="ml-1">({p.daysToExpiry}d)</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">{formatDate(p.renewalDate)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[p.insuranceStatus]}`}>
                          {p.insuranceStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => openEdit(p)}
                            className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-700 hover:bg-blue-200"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            {expandedId === p.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedId === p.id && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-gray-50 border-b border-gray-100">
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
                            <div><span className="text-gray-500">Beneficiary:</span> <span className="font-medium">{p.beneficiary ?? '—'}</span></div>
                            <div><span className="text-gray-500">Contact:</span> <span className="font-medium">{p.contactPerson ?? '—'}</span></div>
                            <div><span className="text-gray-500">Phone:</span> <span className="font-medium">{p.contactPhone ?? '—'}</span></div>
                            <div><span className="text-gray-500">Email:</span> <span className="font-medium">{p.contactEmail ?? '—'}</span></div>
                            <div><span className="text-gray-500">Certificate Ref:</span> <span className="font-medium">{p.certificateRef ?? '—'}</span></div>
                            {p.notes && <div className="col-span-4"><span className="text-gray-500">Notes:</span> {p.notes}</div>}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
            <div className="p-6 border-b border-gray-100"><h2 className="text-lg font-semibold text-gray-900">Add Insurance Policy</h2></div>
            <div className="p-6 overflow-y-auto flex-1 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <SearchableSelect
                  label="Collateral *"
                  required
                  options={collateralSelectOptions}
                  value={createForm.collateralId}
                  onChange={(v) => setCreateForm((f) => ({ ...f, collateralId: v }))}
                  placeholder="Select collateral…"
                  loading={lookupsLoading}
                />
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number *</label>
                  <input type="text" value={createForm.policyNumber} onChange={(e) => setCreateForm((f) => ({ ...f, policyNumber: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurer Name *</label>
                  <input type="text" value={createForm.insurerName} onChange={(e) => setCreateForm((f) => ({ ...f, insurerName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Type</label>
                  <select value={createForm.coverageType} onChange={(e) => setCreateForm((f) => ({ ...f, coverageType: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {COVERAGE_TYPES.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Amount *</label>
                  <input type="number" value={createForm.coverageAmount} onChange={(e) => setCreateForm((f) => ({ ...f, coverageAmount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Premium Amount</label>
                  <input type="number" value={createForm.premiumAmount} onChange={(e) => setCreateForm((f) => ({ ...f, premiumAmount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
                  <select value={createForm.premiumFrequency} onChange={(e) => setCreateForm((f) => ({ ...f, premiumFrequency: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                    {['Annual', 'Semi-Annual', 'Quarterly', 'Monthly'].map((f) => <option key={f}>{f}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date *</label>
                  <input type="date" value={createForm.policyStartDate} onChange={(e) => setCreateForm((f) => ({ ...f, policyStartDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date *</label>
                  <input type="date" value={createForm.policyEndDate} onChange={(e) => setCreateForm((f) => ({ ...f, policyEndDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Date</label>
                  <input type="date" value={createForm.renewalDate} onChange={(e) => setCreateForm((f) => ({ ...f, renewalDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Beneficiary</label>
                  <input type="text" value={createForm.beneficiary} onChange={(e) => setCreateForm((f) => ({ ...f, beneficiary: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Certificate Ref</label>
                  <input type="text" value={createForm.certificateRef} onChange={(e) => setCreateForm((f) => ({ ...f, certificateRef: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                  <input type="text" value={createForm.contactPerson} onChange={(e) => setCreateForm((f) => ({ ...f, contactPerson: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input type="text" value={createForm.contactPhone} onChange={(e) => setCreateForm((f) => ({ ...f, contactPhone: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={createForm.notes} onChange={(e) => setCreateForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button
                onClick={handleCreate}
                disabled={actionLoading || !createForm.collateralId || !createForm.policyNumber || !createForm.insurerName || !createForm.coverageAmount || !createForm.policyStartDate || !createForm.policyEndDate}
                className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50"
                style={{ backgroundColor: '#003c5a' }}
              >
                {actionLoading ? 'Adding…' : 'Add Policy'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg">
            <div className="p-6 border-b border-gray-100">
              <h2 className="text-lg font-semibold text-gray-900">Edit Policy</h2>
              <p className="text-sm text-gray-500 mt-0.5">{showEditModal.policyNumber}</p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Policy Number</label>
                  <input type="text" value={editForm.policyNumber ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, policyNumber: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Insurer Name</label>
                  <input type="text" value={editForm.insurerName ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, insurerName: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Coverage Amount</label>
                  <input type="number" value={editForm.coverageAmount ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, coverageAmount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Premium Amount</label>
                  <input type="number" value={editForm.premiumAmount ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, premiumAmount: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                  <input type="date" value={editForm.policyStartDate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, policyStartDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                  <input type="date" value={editForm.policyEndDate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, policyEndDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Renewal Date</label>
                  <input type="date" value={editForm.renewalDate ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, renewalDate: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea value={editForm.notes ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, notes: e.target.value }))} rows={2} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowEditModal(null)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancel</button>
              <button onClick={handleEdit} disabled={actionLoading} className="px-4 py-2 text-sm text-white rounded-lg disabled:opacity-50" style={{ backgroundColor: '#003c5a' }}>
                {actionLoading ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
