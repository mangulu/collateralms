'use client';
import React, { useEffect, useState, useCallback } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, CheckCircle2, AlertCircle, X, Save, ExternalLink, Globe, Mail, Phone, Palette, Key, RefreshCw, Eye, EyeOff,  } from 'lucide-react';
import {
  fetchClientBankAccounts,
  createClientBankAccount,
  updateClientBankAccount,
  toggleClientBankAccountStatus,
  deleteClientBankAccount,
  ClientBankAccount,
  ClientBankAccountFormData,
} from '@/lib/supabase/clientBankAccountService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const EMPTY_FORM: ClientBankAccountFormData = {
  bankName: '',
  bankCode: '',
  contactEmail: '',
  contactPhone: '',
  country: 'Tanzania',
  logoUrl: '',
  primaryColor: '#2563EB',
  accentColor: '#10B981',
  tagline: '',
  appUrl: '',
  supabaseUrl: '',
  supabaseAnonKey: '',
  adminEmail: '',
  isActive: true,
  notes: '',
};

// ─── Toast ────────────────────────────────────────────────────────────────────

interface Toast { message: string; type: 'success' | 'error' }

// ─── Brand Preview ────────────────────────────────────────────────────────────

function BrandPreview({ form }: { form: ClientBankAccountFormData }) {
  return (
    <div className="rounded-lg overflow-hidden border border-border" style={{ maxWidth: 260 }}>
      <div
        className="h-10 flex items-center px-3 gap-2"
        style={{ backgroundColor: form.primaryColor }}
      >
        {form.logoUrl ? (
          <img src={form.logoUrl} alt="Logo preview" className="h-6 w-6 rounded object-contain bg-white" />
        ) : (
          <div className="h-6 w-6 rounded bg-white/30 flex items-center justify-center">
            <Building2 size={12} className="text-white" />
          </div>
        )}
        <span className="text-white text-xs font-600 truncate">{form.bankName || 'Bank Name'}</span>
      </div>
      <div className="bg-white px-3 py-2">
        <p className="text-[10px] text-gray-500 truncate">{form.tagline || 'Tagline here'}</p>
        <div className="mt-1.5 h-5 rounded" style={{ backgroundColor: form.primaryColor, opacity: 0.15 }} />
        <div
          className="mt-1 h-4 rounded w-2/3"
          style={{ backgroundColor: form.accentColor, opacity: 0.2 }}
        />
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

interface ModalProps {
  account: ClientBankAccount | null;
  onClose: () => void;
  onSaved: (acc: ClientBankAccount) => void;
  currentUserId: string;
}

function AccountModal({ account, onClose, onSaved, currentUserId }: ModalProps) {
  const isEdit = !!account;
  const [form, setForm] = useState<ClientBankAccountFormData>(
    isEdit
      ? {
          bankName: account.bankName,
          bankCode: account.bankCode,
          contactEmail: account.contactEmail ?? '',
          contactPhone: account.contactPhone ?? '',
          country: account.country,
          logoUrl: account.logoUrl ?? '',
          primaryColor: account.primaryColor,
          accentColor: account.accentColor,
          tagline: account.tagline ?? '',
          appUrl: account.appUrl ?? '',
          supabaseUrl: account.supabaseUrl ?? '',
          supabaseAnonKey: account.supabaseAnonKey ?? '',
          adminEmail: account.adminEmail ?? '',
          isActive: account.isActive,
          notes: account.notes ?? '',
        }
      : { ...EMPTY_FORM }
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [activeSection, setActiveSection] = useState<'basic' | 'brand' | 'credentials'>('basic');

  const set = (key: keyof ClientBankAccountFormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.bankName.trim() || !form.bankCode.trim()) {
      setError('Bank name and code are required.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      let saved: ClientBankAccount;
      if (isEdit) {
        saved = await updateClientBankAccount(account.id, form);
      } else {
        saved = await createClientBankAccount(form, currentUserId);
      }
      onSaved(saved);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save account.';
      setError(msg.includes('unique') ? 'Bank code already exists.' : msg);
    } finally {
      setSaving(false);
    }
  };

  const inputCls =
    'w-full px-3 py-2 text-sm bg-background border border-border rounded-md text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors';
  const labelCls = 'block text-xs font-500 text-muted-foreground mb-1';

  const sections = [
    { id: 'basic' as const, label: 'Basic Info' },
    { id: 'brand' as const, label: 'Branding' },
    { id: 'credentials' as const, label: 'Credentials' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 size={18} className="text-primary" />
            </div>
            <div>
              <h2 className="text-base font-700 text-foreground">
                {isEdit ? 'Edit Client Bank Account' : 'New Client Bank Account'}
              </h2>
              <p className="text-xs text-muted-foreground">
                {isEdit ? `Editing ${account.bankName}` : 'Add a new bank deployment'}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-md hover:bg-muted transition-colors">
            <X size={16} className="text-muted-foreground" />
          </button>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => setActiveSection(s.id)}
              className={`px-3 py-1.5 text-xs font-500 rounded-md transition-colors ${
                activeSection === s.id
                  ? 'bg-primary text-white' :'text-muted-foreground hover:bg-muted'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Basic Info */}
          {activeSection === 'basic' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Bank Name *</label>
                  <input
                    className={inputCls}
                    value={form.bankName}
                    onChange={(e) => set('bankName', e.target.value)}
                    placeholder="e.g. EXIM Bank Tanzania"
                    required
                  />
                </div>
                <div>
                  <label className={labelCls}>Bank Code *</label>
                  <input
                    className={inputCls}
                    value={form.bankCode}
                    onChange={(e) => set('bankCode', e.target.value.toUpperCase())}
                    placeholder="e.g. EXIM-TZ"
                    required
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Contact Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.contactEmail}
                    onChange={(e) => set('contactEmail', e.target.value)}
                    placeholder="collateral@bank.co.tz"
                  />
                </div>
                <div>
                  <label className={labelCls}>Contact Phone</label>
                  <input
                    className={inputCls}
                    value={form.contactPhone}
                    onChange={(e) => set('contactPhone', e.target.value)}
                    placeholder="+255 22 211 0000"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Country</label>
                  <input
                    className={inputCls}
                    value={form.country}
                    onChange={(e) => set('country', e.target.value)}
                    placeholder="Tanzania"
                  />
                </div>
                <div>
                  <label className={labelCls}>Admin Email</label>
                  <input
                    type="email"
                    className={inputCls}
                    value={form.adminEmail}
                    onChange={(e) => set('adminEmail', e.target.value)}
                    placeholder="admin@bank.co.tz"
                  />
                </div>
              </div>
              <div>
                <label className={labelCls}>App URL</label>
                <input
                  type="url"
                  className={inputCls}
                  value={form.appUrl}
                  onChange={(e) => set('appUrl', e.target.value)}
                  placeholder="https://collateral.bank.co.tz"
                />
              </div>
              <div>
                <label className={labelCls}>Notes</label>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  value={form.notes}
                  onChange={(e) => set('notes', e.target.value)}
                  placeholder="Internal notes about this deployment..."
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => set('isActive', !form.isActive)}
                  className="flex items-center gap-2 text-sm font-500 transition-colors"
                  style={{ color: form.isActive ? '#16a34a' : '#6b7280' }}
                >
                  {form.isActive ? (
                    <ToggleRight size={22} className="text-green-600" />
                  ) : (
                    <ToggleLeft size={22} className="text-gray-400" />
                  )}
                  {form.isActive ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          )}

          {/* Branding */}
          {activeSection === 'brand' && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Logo URL</label>
                <input
                  type="url"
                  className={inputCls}
                  value={form.logoUrl}
                  onChange={(e) => set('logoUrl', e.target.value)}
                  placeholder="https://cdn.bank.co.tz/logo.png"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Primary Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-12 rounded border border-border cursor-pointer"
                      value={form.primaryColor}
                      onChange={(e) => set('primaryColor', e.target.value)}
                    />
                    <input
                      className={`${inputCls} flex-1`}
                      value={form.primaryColor}
                      onChange={(e) => set('primaryColor', e.target.value)}
                      placeholder="#2563EB"
                    />
                  </div>
                </div>
                <div>
                  <label className={labelCls}>Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      className="h-9 w-12 rounded border border-border cursor-pointer"
                      value={form.accentColor}
                      onChange={(e) => set('accentColor', e.target.value)}
                    />
                    <input
                      className={`${inputCls} flex-1`}
                      value={form.accentColor}
                      onChange={(e) => set('accentColor', e.target.value)}
                      placeholder="#10B981"
                    />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Tagline</label>
                <input
                  className={inputCls}
                  value={form.tagline}
                  onChange={(e) => set('tagline', e.target.value)}
                  placeholder="Collateral Lifecycle Management Platform"
                />
              </div>
              <div>
                <p className="text-xs font-500 text-muted-foreground mb-2">Login Card Preview</p>
                <BrandPreview form={form} />
              </div>
            </div>
          )}

          {/* Credentials */}
          {activeSection === 'credentials' && (
            <div className="space-y-4">
              <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <AlertCircle size={15} className="text-amber-600 mt-0.5 shrink-0" />
                <p className="text-xs text-amber-700">
                  Supabase credentials are stored securely. The anon key is masked after saving.
                  Only update if deploying a new Supabase project for this client.
                </p>
              </div>
              <div>
                <label className={labelCls}>Supabase Project URL</label>
                <input
                  type="url"
                  className={inputCls}
                  value={form.supabaseUrl}
                  onChange={(e) => set('supabaseUrl', e.target.value)}
                  placeholder="https://xxxx.supabase.co"
                />
              </div>
              <div>
                <label className={labelCls}>Supabase Anon Key</label>
                <div className="relative">
                  <input
                    type={showKey ? 'text' : 'password'}
                    className={`${inputCls} pr-10`}
                    value={form.supabaseAnonKey}
                    onChange={(e) => set('supabaseAnonKey', e.target.value)}
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                  />
                  <button
                    type="button"
                    onClick={() => setShowKey((v) => !v)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-muted-foreground hover:text-foreground"
                  >
                    {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200">
              <AlertCircle size={14} className="text-red-600 shrink-0" />
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-500 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm font-500 text-white rounded-md transition-colors disabled:opacity-60"
            style={{ backgroundColor: '#2563EB' }}
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Account'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────

function DeleteConfirm({
  account,
  onConfirm,
  onCancel,
  deleting,
}: {
  account: ClientBankAccount;
  onConfirm: () => void;
  onCancel: () => void;
  deleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-background rounded-xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
            <Trash2 size={18} className="text-red-600" />
          </div>
          <div>
            <h3 className="text-sm font-700 text-foreground">Delete Account</h3>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
        </div>
        <p className="text-sm text-foreground mb-6">
          Are you sure you want to delete <strong>{account.bankName}</strong>?
        </p>
        <div className="flex gap-2 justify-end">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-500 text-muted-foreground hover:bg-muted rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex items-center gap-2 px-4 py-2 text-sm font-500 text-white bg-red-600 hover:bg-red-700 rounded-md transition-colors disabled:opacity-60"
          >
            {deleting ? <RefreshCw size={13} className="animate-spin" /> : <Trash2 size={13} />}
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function ClientBankAccountsContent() {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<ClientBankAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [toast, setToast] = useState<Toast | null>(null);
  const [modalAccount, setModalAccount] = useState<ClientBankAccount | null | 'new'>(null);
  const [deleteTarget, setDeleteTarget] = useState<ClientBankAccount | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchClientBankAccounts();
      setAccounts(data);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to load accounts.', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = accounts.filter((a) => {
    const matchSearch =
      !search ||
      a.bankName.toLowerCase().includes(search.toLowerCase()) ||
      a.bankCode.toLowerCase().includes(search.toLowerCase()) ||
      (a.contactEmail ?? '').toLowerCase().includes(search.toLowerCase());
    const matchStatus =
      filterStatus === 'all' ||
      (filterStatus === 'active' && a.isActive) ||
      (filterStatus === 'inactive' && !a.isActive);
    return matchSearch && matchStatus;
  });

  const handleSaved = (saved: ClientBankAccount) => {
    setAccounts((prev) => {
      const idx = prev.findIndex((a) => a.id === saved.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = saved;
        return next;
      }
      return [saved, ...prev];
    });
    setModalAccount(null);
    showToast(
      modalAccount === 'new' ? 'Account created successfully.' : 'Account updated successfully.',
      'success'
    );
  };

  const handleToggle = async (account: ClientBankAccount) => {
    setTogglingId(account.id);
    try {
      await toggleClientBankAccountStatus(account.id, !account.isActive);
      setAccounts((prev) =>
        prev.map((a) => (a.id === account.id ? { ...a, isActive: !a.isActive } : a))
      );
      showToast(
        `${account.bankName} marked as ${!account.isActive ? 'active' : 'inactive'}.`,
        'success'
      );
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to update status.', 'error');
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteClientBankAccount(deleteTarget.id);
      setAccounts((prev) => prev.filter((a) => a.id !== deleteTarget.id));
      showToast(`${deleteTarget.bankName} deleted.`, 'success');
      setDeleteTarget(null);
    } catch (err: unknown) {
      showToast(err instanceof Error ? err.message : 'Failed to delete account.', 'error');
    } finally {
      setDeleting(false);
    }
  };

  const activeCount = accounts.filter((a) => a.isActive).length;
  const inactiveCount = accounts.filter((a) => !a.isActive).length;

  return (
    <div className="space-y-6 p-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-[100] flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-500 transition-all ${
            toast.type === 'success' ?'bg-green-600 text-white' :'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 size={15} />
          ) : (
            <AlertCircle size={15} />
          )}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 size={20} className="text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-700 text-foreground">Client Bank Accounts</h1>
            <p className="text-sm text-muted-foreground">
              Manage bank deployments — credentials, branding, and activation status
            </p>
          </div>
        </div>
        <button
          onClick={() => setModalAccount('new')}
          className="flex items-center gap-2 px-4 py-2 text-sm font-500 text-white rounded-lg transition-colors shrink-0"
          style={{ backgroundColor: '#2563EB' }}
        >
          <Plus size={15} />
          New Account
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Accounts', value: accounts.length, color: '#2563EB', bg: '#EFF6FF' },
          { label: 'Active', value: activeCount, color: '#16a34a', bg: '#F0FDF4' },
          { label: 'Inactive', value: inactiveCount, color: '#9ca3af', bg: '#F9FAFB' },
        ].map((kpi) => (
          <div
            key={kpi.label}
            className="rounded-xl border border-border p-4"
            style={{ backgroundColor: kpi.bg }}
          >
            <p className="text-xs font-500 text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-700 mt-1" style={{ color: kpi.color }}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            className="w-full pl-9 pr-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
            placeholder="Search by name, code, or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          {(['all', 'active', 'inactive'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={`px-3 py-1.5 text-xs font-500 rounded-md transition-colors capitalize ${
                filterStatus === s
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {s}
            </button>
          ))}
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg border border-border hover:bg-muted transition-colors"
          title="Refresh"
        >
          <RefreshCw size={14} className={`text-muted-foreground ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Table */}
      <div className="rounded-xl border border-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border" style={{ backgroundColor: '#F8FAFC' }}>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Bank</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Code</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Contact</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Branding</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">App URL</th>
                <th className="text-left px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Status</th>
                <th className="text-right px-4 py-3 text-xs font-600 text-muted-foreground uppercase tracking-wide">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="border-b border-border">
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-muted rounded animate-pulse" style={{ width: j === 0 ? '140px' : '80px' }} />
                      </td>
                    ))}
                  </tr>
                ))
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <Building2 size={32} className="text-muted-foreground mx-auto mb-2 opacity-40" />
                    <p className="text-sm text-muted-foreground">
                      {search || filterStatus !== 'all' ? 'No accounts match your filters.' : 'No client bank accounts yet.'}
                    </p>
                    {!search && filterStatus === 'all' && (
                      <button
                        onClick={() => setModalAccount('new')}
                        className="mt-3 text-xs text-primary hover:underline"
                      >
                        Add the first account
                      </button>
                    )}
                  </td>
                </tr>
              ) : (
                filtered.map((account) => (
                  <tr
                    key={account.id}
                    className="border-b border-border last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    {/* Bank */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div
                          className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden"
                          style={{ backgroundColor: account.primaryColor + '20' }}
                        >
                          {account.logoUrl ? (
                            <img src={account.logoUrl} alt={account.bankName} className="w-6 h-6 object-contain" />
                          ) : (
                            <Building2 size={14} style={{ color: account.primaryColor }} />
                          )}
                        </div>
                        <div>
                          <p className="font-600 text-foreground text-sm">{account.bankName}</p>
                          <p className="text-xs text-muted-foreground">{account.country}</p>
                        </div>
                      </div>
                    </td>
                    {/* Code */}
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 text-xs font-600 rounded bg-muted text-muted-foreground font-mono">
                        {account.bankCode}
                      </span>
                    </td>
                    {/* Contact */}
                    <td className="px-4 py-3">
                      <div className="space-y-0.5">
                        {account.contactEmail && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail size={11} />
                            <span className="truncate max-w-[140px]">{account.contactEmail}</span>
                          </div>
                        )}
                        {account.contactPhone && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Phone size={11} />
                            <span>{account.contactPhone}</span>
                          </div>
                        )}
                        {!account.contactEmail && !account.contactPhone && (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </div>
                    </td>
                    {/* Branding */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: account.primaryColor }}
                          title={`Primary: ${account.primaryColor}`}
                        />
                        <div
                          className="w-4 h-4 rounded-full border border-border"
                          style={{ backgroundColor: account.accentColor }}
                          title={`Accent: ${account.accentColor}`}
                        />
                        <Palette size={12} className="text-muted-foreground ml-1" />
                      </div>
                    </td>
                    {/* App URL */}
                    <td className="px-4 py-3">
                      {account.appUrl ? (
                        <a
                          href={account.appUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary hover:underline"
                        >
                          <Globe size={11} />
                          <span className="truncate max-w-[120px]">
                            {account.appUrl.replace(/^https?:\/\//, '')}
                          </span>
                          <ExternalLink size={10} />
                        </a>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    {/* Status */}
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(account)}
                        disabled={togglingId === account.id}
                        className="flex items-center gap-1.5 transition-opacity disabled:opacity-60"
                        title={account.isActive ? 'Click to deactivate' : 'Click to activate'}
                      >
                        {togglingId === account.id ? (
                          <RefreshCw size={14} className="animate-spin text-muted-foreground" />
                        ) : account.isActive ? (
                          <ToggleRight size={20} className="text-green-600" />
                        ) : (
                          <ToggleLeft size={20} className="text-gray-400" />
                        )}
                        <span
                          className={`text-xs font-500 ${
                            account.isActive ? 'text-green-700' : 'text-gray-500'
                          }`}
                        >
                          {account.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </button>
                    </td>
                    {/* Actions */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setModalAccount(account)}
                          className="p-1.5 rounded-md hover:bg-muted transition-colors"
                          title="Edit"
                        >
                          <Edit2 size={14} className="text-muted-foreground" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(account)}
                          className="p-1.5 rounded-md hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modals */}
      {modalAccount !== null && (
        <AccountModal
          account={modalAccount === 'new' ? null : modalAccount}
          onClose={() => setModalAccount(null)}
          onSaved={handleSaved}
          currentUserId={user?.id ?? ''}
        />
      )}
      {deleteTarget && (
        <DeleteConfirm
          account={deleteTarget}
          onConfirm={handleDelete}
          onCancel={() => setDeleteTarget(null)}
          deleting={deleting}
        />
      )}
    </div>
  );
}
