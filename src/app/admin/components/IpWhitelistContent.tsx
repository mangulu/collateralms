'use client';
import React, { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Trash2, Edit2, Save, X, RefreshCw, CheckCircle2, AlertCircle, Network, Clock, Ban, ChevronDown, ChevronUp,  } from 'lucide-react';
import {
  fetchIpWhitelistConfigs,
  createIpWhitelistConfig,
  updateIpWhitelistConfig,
  deleteIpWhitelistConfig,
  fetchIpAccessLog,
  IpWhitelistConfig,
  IpAccessLogEntry,
} from '@/lib/supabase/ipWhitelistService';
import { useAuth } from '@/contexts/AuthContext';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FormState {
  label: string;
  ipAddress: string;
  description: string;
  appliesTo: string[];
  isActive: boolean;
}

const EMPTY_FORM: FormState = {
  label: '',
  ipAddress: '',
  description: '',
  appliesTo: ['system_admin', 'supervisor'],
  isActive: true,
};

const ROLE_OPTIONS = [
  { value: 'system_admin', label: 'System Admin' },
  { value: 'supervisor', label: 'Supervisor' },
  { value: 'credit_officer', label: 'Credit Officer' },
  { value: 'legal_officer', label: 'Legal Officer' },
];

function formatDate(iso: string): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

// ─── IP Form Modal ────────────────────────────────────────────────────────────

interface IpFormModalProps {
  initial?: IpWhitelistConfig | null;
  onSave: (form: FormState) => Promise<void>;
  onClose: () => void;
  saving: boolean;
}

function IpFormModal({ initial, onSave, onClose, saving }: IpFormModalProps) {
  const [form, setForm] = useState<FormState>(
    initial
      ? {
          label: initial.label,
          ipAddress: initial.ipAddress,
          description: initial.description ?? '',
          appliesTo: initial.appliesTo,
          isActive: initial.isActive,
        }
      : EMPTY_FORM
  );
  const [error, setError] = useState<string | null>(null);

  const toggleRole = (role: string) => {
    setForm((f) => ({
      ...f,
      appliesTo: f.appliesTo.includes(role)
        ? f.appliesTo.filter((r) => r !== role)
        : [...f.appliesTo, role],
    }));
  };

  const handleSave = async () => {
    if (!form.label.trim()) { setError('Label is required'); return; }
    if (!form.ipAddress.trim()) { setError('IP address or CIDR is required'); return; }
    if (form.appliesTo.length === 0) { setError('Select at least one role'); return; }
    setError(null);
    await onSave(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-7" style={{ border: '1px solid var(--izou-border)' }}>
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--izou-primary-light)' }}>
              <Network size={16} style={{ color: 'var(--izou-primary)' }} />
            </div>
            <h3 className="text-base font-bold" style={{ color: 'var(--izou-text)' }}>
              {initial ? 'Edit IP Entry' : 'Add IP Entry'}
            </h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X size={16} style={{ color: 'var(--izou-muted)' }} />
          </button>
        </div>

        {error && (
          <div className="flex items-center gap-2 p-3 rounded-xl mb-4" style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca' }}>
            <AlertCircle size={14} className="text-red-600 shrink-0" />
            <p className="text-xs text-red-700">{error}</p>
          </div>
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--izou-text)' }}>Label *</label>
            <input
              type="text"
              value={form.label}
              onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
              placeholder="e.g. Head Office - Main"
              className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2"
              style={{ border: '1px solid var(--izou-border)', backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-text)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--izou-text)' }}>IP Address or CIDR Range *</label>
            <input
              type="text"
              value={form.ipAddress}
              onChange={(e) => setForm((f) => ({ ...f, ipAddress: e.target.value }))}
              placeholder="e.g. 196.13.0.0/16 or 192.168.1.100"
              className="w-full px-3 py-2.5 text-sm rounded-xl font-mono focus:outline-none focus:ring-2"
              style={{ border: '1px solid var(--izou-border)', backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-text)' }}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Supports exact IPs (192.168.1.1) or CIDR notation (10.0.0.0/8)</p>
          </div>

          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--izou-text)' }}>Description</label>
            <input
              type="text"
              value={form.description}
              onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
              placeholder="Optional description"
              className="w-full px-3 py-2.5 text-sm rounded-xl focus:outline-none focus:ring-2"
              style={{ border: '1px solid var(--izou-border)', backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-text)' }}
            />
          </div>

          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: 'var(--izou-text)' }}>Applies To Roles *</label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleRole(opt.value)}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={
                    form.appliesTo.includes(opt.value)
                      ? { backgroundColor: 'var(--izou-primary)', color: 'white' }
                      : { backgroundColor: 'var(--izou-primary-light)', color: 'var(--izou-muted)', border: '1px solid var(--izou-border)' }
                  }
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setForm((f) => ({ ...f, isActive: !f.isActive }))}
              className={`relative w-10 h-5 rounded-full transition-colors ${form.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
            >
              <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.isActive ? 'translate-x-5' : 'translate-x-0.5'}`} />
            </button>
            <span className="text-sm" style={{ color: 'var(--izou-text)' }}>
              {form.isActive ? 'Active — enforcing this rule' : 'Inactive — rule disabled'}
            </span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 h-10 rounded-xl text-sm font-semibold"
            style={{ border: '1px solid var(--izou-border)', color: 'var(--izou-muted)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 izou-btn-primary h-10 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60"
          >
            {saving ? <RefreshCw size={14} className="animate-spin" /> : <Save size={14} />}
            {initial ? 'Update' : 'Add Entry'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function IpWhitelistContent() {
  const { user } = useAuth();
  const [configs, setConfigs] = useState<IpWhitelistConfig[]>([]);
  const [accessLog, setAccessLog] = useState<IpAccessLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<IpWhitelistConfig | null>(null);
  const [showLog, setShowLog] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [cfgs, log] = await Promise.all([fetchIpWhitelistConfigs(), fetchIpAccessLog(30)]);
      setConfigs(cfgs);
      setAccessLog(log);
    } catch {
      showToast('Failed to load IP whitelist data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleSave = async (form: FormState) => {
    setSaving(true);
    try {
      if (editTarget) {
        const updated = await updateIpWhitelistConfig(editTarget.id, {
          label: form.label,
          ipAddress: form.ipAddress,
          description: form.description || null,
          appliesTo: form.appliesTo,
          isActive: form.isActive,
        });
        setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        showToast('IP entry updated');
      } else {
        const created = await createIpWhitelistConfig({
          label: form.label,
          ipAddress: form.ipAddress,
          description: form.description || null,
          appliesTo: form.appliesTo,
          isActive: form.isActive,
          createdBy: user?.id ?? null,
        });
        setConfigs((prev) => [created, ...prev]);
        showToast('IP entry added');
      }
      setShowModal(false);
      setEditTarget(null);
    } catch (err: any) {
      showToast(err?.message ?? 'Failed to save', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Remove this IP entry? Users from this IP may lose access.')) return;
    try {
      await deleteIpWhitelistConfig(id);
      setConfigs((prev) => prev.filter((c) => c.id !== id));
      showToast('IP entry removed');
    } catch {
      showToast('Failed to remove entry', 'error');
    }
  };

  const handleToggleActive = async (config: IpWhitelistConfig) => {
    try {
      const updated = await updateIpWhitelistConfig(config.id, { isActive: !config.isActive });
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      showToast(updated.isActive ? 'Rule activated' : 'Rule deactivated');
    } catch {
      showToast('Failed to update', 'error');
    }
  };

  const activeCount = configs.filter((c) => c.isActive).length;
  const blockedToday = accessLog.filter(
    (l) => l.accessResult === 'blocked' && new Date(l.createdAt) > new Date(Date.now() - 86400000)
  ).length;

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div
          className={`fixed top-5 right-5 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold" style={{ color: 'var(--izou-text)' }}>IP Whitelist</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--izou-muted)' }}>
            Restrict dashboard access to known office IPs for admin and supervisor roles
          </p>
        </div>
        <button
          onClick={() => { setEditTarget(null); setShowModal(true); }}
          className="izou-btn-primary flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold"
        >
          <Plus size={15} /> Add IP Entry
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Active Rules', value: activeCount, icon: <Shield size={16} />, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Total Entries', value: configs.length, icon: <Network size={16} />, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Blocked Today', value: blockedToday, icon: <Ban size={16} />, color: 'text-red-600', bg: 'bg-red-50' },
        ].map((stat) => (
          <div key={stat.label} className="bg-white rounded-xl p-4 flex items-center gap-3" style={{ border: '1px solid var(--izou-border)' }}>
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stat.bg}`}>
              <span className={stat.color}>{stat.icon}</span>
            </div>
            <div>
              <p className="text-xl font-bold" style={{ color: 'var(--izou-text)' }}>{stat.value}</p>
              <p className="text-xs" style={{ color: 'var(--izou-muted)' }}>{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 rounded-xl" style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
        <Shield size={16} className="text-blue-600 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800">How IP Restrictions Work</p>
          <p className="text-xs text-blue-700 mt-0.5">
            When active rules exist for a role, users with that role can only access the dashboard from whitelisted IPs or CIDR ranges.
            Blocked attempts are logged below. If no rules are configured for a role, access is unrestricted.
          </p>
        </div>
      </div>

      {/* IP Entries Table */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--izou-border)' }}>
        <div className="px-5 py-4 flex items-center justify-between" style={{ borderBottom: '1px solid var(--izou-border)' }}>
          <h3 className="text-sm font-semibold" style={{ color: 'var(--izou-text)' }}>Whitelist Entries</h3>
          <button onClick={load} className="p-1.5 rounded-lg hover:bg-gray-100">
            <RefreshCw size={14} style={{ color: 'var(--izou-muted)' }} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw size={20} className="animate-spin" style={{ color: 'var(--izou-muted)' }} />
          </div>
        ) : configs.length === 0 ? (
          <div className="text-center py-12">
            <Network size={32} className="mx-auto mb-3" style={{ color: 'var(--izou-muted)' }} />
            <p className="text-sm font-medium" style={{ color: 'var(--izou-text)' }}>No IP entries configured</p>
            <p className="text-xs mt-1" style={{ color: 'var(--izou-muted)' }}>Add office IPs to restrict access for sensitive roles</p>
          </div>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--izou-border)' }}>
            {configs.map((config) => (
              <div key={config.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold" style={{ color: 'var(--izou-text)' }}>{config.label}</span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${config.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
                    >
                      {config.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <p className="text-xs font-mono" style={{ color: 'var(--izou-primary)' }}>{config.ipAddress}</p>
                  {config.description && (
                    <p className="text-xs mt-0.5" style={{ color: 'var(--izou-muted)' }}>{config.description}</p>
                  )}
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {config.appliesTo.map((role) => (
                      <span key={role} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-700">
                        {role.replace(/_/g, ' ')}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleToggleActive(config)}
                    className={`relative w-9 h-5 rounded-full transition-colors ${config.isActive ? 'bg-green-500' : 'bg-gray-300'}`}
                    title={config.isActive ? 'Deactivate' : 'Activate'}
                  >
                    <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${config.isActive ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                  <button
                    onClick={() => { setEditTarget(config); setShowModal(true); }}
                    className="p-1.5 rounded-lg hover:bg-gray-100"
                    title="Edit"
                  >
                    <Edit2 size={14} style={{ color: 'var(--izou-muted)' }} />
                  </button>
                  <button
                    onClick={() => handleDelete(config.id)}
                    className="p-1.5 rounded-lg hover:bg-red-50"
                    title="Delete"
                  >
                    <Trash2 size={14} className="text-red-500" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Access Log */}
      <div className="bg-white rounded-xl overflow-hidden" style={{ border: '1px solid var(--izou-border)' }}>
        <button
          className="w-full px-5 py-4 flex items-center justify-between"
          style={{ borderBottom: showLog ? '1px solid var(--izou-border)' : 'none' }}
          onClick={() => setShowLog((v) => !v)}
        >
          <div className="flex items-center gap-2">
            <Clock size={15} style={{ color: 'var(--izou-muted)' }} />
            <h3 className="text-sm font-semibold" style={{ color: 'var(--izou-text)' }}>Recent Access Log</h3>
            {blockedToday > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                {blockedToday} blocked today
              </span>
            )}
          </div>
          {showLog ? <ChevronUp size={15} style={{ color: 'var(--izou-muted)' }} /> : <ChevronDown size={15} style={{ color: 'var(--izou-muted)' }} />}
        </button>

        {showLog && (
          accessLog.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm" style={{ color: 'var(--izou-muted)' }}>No access log entries yet</p>
            </div>
          ) : (
            <div className="divide-y" style={{ borderColor: 'var(--izou-border)' }}>
              {accessLog.map((entry) => (
                <div key={entry.id} className="px-5 py-3 flex items-center gap-4">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${entry.accessResult === 'allowed' ? 'bg-green-50' : 'bg-red-50'}`}>
                    {entry.accessResult === 'allowed'
                      ? <CheckCircle2 size={13} className="text-green-600" />
                      : <Ban size={13} className="text-red-600" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-semibold" style={{ color: 'var(--izou-text)' }}>{entry.ipAddress}</span>
                      {entry.userRole && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100" style={{ color: 'var(--izou-muted)' }}>
                          {entry.userRole.replace(/_/g, ' ')}
                        </span>
                      )}
                    </div>
                    {entry.route && <p className="text-[11px] truncate" style={{ color: 'var(--izou-muted)' }}>{entry.route}</p>}
                  </div>
                  <p className="text-[11px] shrink-0" style={{ color: 'var(--izou-muted)' }}>{formatDate(entry.createdAt)}</p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* Modal */}
      {showModal && (
        <IpFormModal
          initial={editTarget}
          onSave={handleSave}
          onClose={() => { setShowModal(false); setEditTarget(null); }}
          saving={saving}
        />
      )}
    </div>
  );
}
