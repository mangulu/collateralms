'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Send, Users, CheckCircle2, XCircle, AlertTriangle, Plus, Trash2, RefreshCw, ChevronDown, ChevronUp, BarChart2,  } from 'lucide-react';
import {
  scheduledReportService,
  type ScheduledReportConfig,
  type ScheduledReportDelivery,
  type ReportRecipient,
} from '@/lib/supabase/scheduledReportService';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

const CRON_LABELS: Record<string, string> = {
  '0 8 * * 1': 'Every Monday at 8:00 AM',
  '0 8 1 * *': '1st of every month at 8:00 AM',
  '0 8 * * 5': 'Every Friday at 8:00 AM',
  '0 8 1,15 * *': 'Twice monthly (1st & 15th)',
};

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function getPeriodLabel(reportType: string): string {
  const now = new Date();
  if (reportType === 'weekly_perfection_summary') {
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay() + 1);
    return `Week of ${weekStart.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}`;
  }
  return now.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

export default function ScheduledReportDeliveryContent() {
  const { userProfile } = useAuth();
  const [configs, setConfigs] = useState<ScheduledReportConfig[]>([]);
  const [deliveries, setDeliveries] = useState<ScheduledReportDelivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Recipient modal state
  const [editingConfig, setEditingConfig] = useState<ScheduledReportConfig | null>(null);
  const [recipientForm, setRecipientForm] = useState<ReportRecipient>({ name: '', email: '', role: '' });
  const [savingConfig, setSavingConfig] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cfgs, dels] = await Promise.all([
        scheduledReportService.listConfigs(),
        scheduledReportService.listDeliveries(),
      ]);
      setConfigs(cfgs);
      setDeliveries(dels);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleEnabled(cfg: ScheduledReportConfig) {
    if (!userProfile?.id) return;
    try {
      const updated = await scheduledReportService.updateConfig(
        cfg.id, { isEnabled: !cfg.isEnabled }, userProfile.id
      );
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    } catch (e: any) {
      setError(e.message);
    }
  }

  async function sendNow(cfg: ScheduledReportConfig) {
    if (!userProfile?.id || cfg.recipients.length === 0) {
      setError('Add at least one recipient before sending.');
      return;
    }
    setSendingId(cfg.id);
    setError(null);
    try {
      // Build a quick summary from Supabase
      const supabase = createClient();
      const { data: collaterals } = await supabase
        .from('collateral_records')
        .select('status, ltv_ratio, valuation_amount');

      const total = collaterals?.length ?? 0;
      const perfected = collaterals?.filter((c) => c.status === 'Perfected').length ?? 0;
      const overdue = collaterals?.filter((c) => c.status === 'Overdue').length ?? 0;
      const totalValue = collaterals?.reduce((s, c) => s + (parseFloat(c.valuation_amount) || 0), 0) ?? 0;

      const reportSummary: Record<string, string | number> = {
        'Total Collateral Records': total,
        'Perfected': perfected,
        'Perfection Rate': total > 0 ? `${((perfected / total) * 100).toFixed(1)}%` : '0%',
        'Overdue Items': overdue,
        'Total Portfolio Value': `TZS ${(totalValue / 1e9).toFixed(2)}B`,
      };

      const result = await scheduledReportService.sendReportEmail({
        configId: cfg.id,
        reportType: cfg.reportType,
        reportLabel: cfg.reportLabel,
        recipients: cfg.recipients,
        period: getPeriodLabel(cfg.reportType),
        reportSummary,
        triggeredBy: userProfile.id,
      });

      setSuccessMsg(`Report sent to ${result.sent} recipient(s).`);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSendingId(null);
    }
  }

  function openEditRecipients(cfg: ScheduledReportConfig) {
    setEditingConfig({ ...cfg, recipients: [...cfg.recipients] });
    setRecipientForm({ name: '', email: '', role: '' });
  }

  function addRecipient() {
    if (!editingConfig || !recipientForm.email || !recipientForm.name) return;
    setEditingConfig({
      ...editingConfig,
      recipients: [...editingConfig.recipients, { ...recipientForm }],
    });
    setRecipientForm({ name: '', email: '', role: '' });
  }

  function removeRecipient(idx: number) {
    if (!editingConfig) return;
    setEditingConfig({
      ...editingConfig,
      recipients: editingConfig.recipients.filter((_, i) => i !== idx),
    });
  }

  async function saveRecipients() {
    if (!editingConfig || !userProfile?.id) return;
    setSavingConfig(true);
    try {
      const updated = await scheduledReportService.updateConfig(
        editingConfig.id,
        { recipients: editingConfig.recipients },
        userProfile.id
      );
      setConfigs((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
      setEditingConfig(null);
      setSuccessMsg('Recipients saved.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSavingConfig(false);
    }
  }

  const configDeliveries = (configId: string) =>
    deliveries.filter((d) => d.configId === configId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Scheduled Report Delivery</h1>
          <p className="text-sm text-gray-500 mt-1">
            Auto-generate and email weekly perfection summaries and monthly portfolio reviews
          </p>
        </div>
        <button
          onClick={load}
          className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={14} />
          {error}
          <button className="ml-auto" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 size={14} />
          {successMsg}
          <button className="ml-auto" onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-40 bg-gray-100 rounded-xl animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {configs.map((cfg) => {
            const recentDeliveries = configDeliveries(cfg.id);
            const isExpanded = expandedId === cfg.id;
            return (
              <div key={cfg.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
                        <BarChart2 size={18} className="text-blue-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900">{cfg.reportLabel}</h3>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {CRON_LABELS[cfg.scheduleCron] ?? cfg.scheduleCron}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleEnabled(cfg)}
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          cfg.isEnabled ? 'bg-blue-600' : 'bg-gray-300'
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            cfg.isEnabled ? 'translate-x-4' : 'translate-x-1'
                          }`}
                        />
                      </button>
                      <span className="text-xs text-gray-500">{cfg.isEnabled ? 'Enabled' : 'Disabled'}</span>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Recipients</p>
                      <p className="text-lg font-bold text-gray-900">{cfg.recipients.length}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Last Sent</p>
                      <p className="text-xs font-medium text-gray-700">{formatDate(cfg.lastSentAt)}</p>
                    </div>
                    <div className="bg-gray-50 rounded-lg p-3">
                      <p className="text-xs text-gray-500 mb-1">Deliveries</p>
                      <p className="text-lg font-bold text-gray-900">{recentDeliveries.length}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center gap-2">
                    <button
                      onClick={() => openEditRecipients(cfg)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Users size={12} />
                      Manage Recipients
                    </button>
                    <button
                      onClick={() => sendNow(cfg)}
                      disabled={sendingId === cfg.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                    >
                      {sendingId === cfg.id ? (
                        <RefreshCw size={12} className="animate-spin" />
                      ) : (
                        <Send size={12} />
                      )}
                      Send Now
                    </button>
                    {recentDeliveries.length > 0 && (
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : cfg.id)}
                        className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700"
                      >
                        Delivery Log
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    )}
                  </div>
                </div>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                      Recent Deliveries
                    </p>
                    <div className="space-y-2">
                      {recentDeliveries.slice(0, 5).map((d) => (
                        <div
                          key={d.id}
                          className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-gray-100"
                        >
                          <div className="flex items-center gap-2">
                            {d.status === 'sent' ? (
                              <CheckCircle2 size={13} className="text-green-500" />
                            ) : d.status === 'partial' ? (
                              <AlertTriangle size={13} className="text-amber-500" />
                            ) : (
                              <XCircle size={13} className="text-red-500" />
                            )}
                            <span className="text-xs text-gray-700">{formatDate(d.sentAt)}</span>
                          </div>
                          <span className="text-xs text-gray-500">
                            {d.recipientCount} recipient{d.recipientCount !== 1 ? 's' : ''}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                              d.status === 'sent' ?'bg-green-100 text-green-700'
                                : d.status === 'partial' ?'bg-amber-100 text-amber-700' :'bg-red-100 text-red-700'
                            }`}
                          >
                            {d.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Recipient Modal */}
      {editingConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 overflow-hidden">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                Manage Recipients — {editingConfig.reportLabel}
              </h2>
              <p className="text-xs text-gray-500 mt-1">
                These recipients will receive the report on every scheduled delivery.
              </p>
            </div>
            <div className="p-5 space-y-4 max-h-96 overflow-y-auto">
              {/* Add recipient form */}
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Full name"
                  value={recipientForm.name}
                  onChange={(e) => setRecipientForm({ ...recipientForm, name: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="email"
                  placeholder="Email address"
                  value={recipientForm.email}
                  onChange={(e) => setRecipientForm({ ...recipientForm, email: e.target.value })}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Role (opt.)"
                    value={recipientForm.role ?? ''}
                    onChange={(e) => setRecipientForm({ ...recipientForm, role: e.target.value })}
                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    onClick={addRecipient}
                    disabled={!recipientForm.name || !recipientForm.email}
                    className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-40 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>

              {/* Recipient list */}
              {editingConfig.recipients.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No recipients added yet.</p>
              ) : (
                <div className="space-y-2">
                  {editingConfig.recipients.map((r, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                    >
                      <div>
                        <p className="text-sm font-medium text-gray-800">{r.name}</p>
                        <p className="text-xs text-gray-500">{r.email}{r.role ? ` · ${r.role}` : ''}</p>
                      </div>
                      <button
                        onClick={() => removeRecipient(idx)}
                        className="text-red-400 hover:text-red-600 transition-colors"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button
                onClick={() => setEditingConfig(null)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveRecipients}
                disabled={savingConfig}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {savingConfig ? 'Saving…' : 'Save Recipients'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
