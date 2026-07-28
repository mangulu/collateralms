'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { AlertTriangle, CheckCircle2, ShieldAlert, RefreshCw, Filter, Settings, Plus, ChevronDown, ChevronUp,  } from 'lucide-react';
import {
  ltvBreachAlertService,
  type LtvBreachAlert,
  type LtvAlertThreshold,
  type AlertStatus,
  type AlertSeverity,
} from '@/lib/supabase/ltvBreachAlertService';
import { useAuth } from '@/contexts/AuthContext';

const STATUS_CONFIG: Record<AlertStatus, { color: string; label: string }> = {
  Open:         { color: 'bg-red-100 text-red-700',    label: 'Open' },
  Acknowledged: { color: 'bg-amber-100 text-amber-700', label: 'Acknowledged' },
  Resolved:     { color: 'bg-green-100 text-green-700', label: 'Resolved' },
  Waived:       { color: 'bg-gray-100 text-gray-600',   label: 'Waived' },
};

const SEVERITY_CONFIG: Record<AlertSeverity, { color: string; dot: string }> = {
  Critical: { color: 'bg-red-100 text-red-700',    dot: 'bg-red-500' },
  High:     { color: 'bg-orange-100 text-orange-700', dot: 'bg-orange-500' },
  Medium:   { color: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
};

const COLLATERAL_TYPES = ['All', 'Mortgage', 'Debenture', 'Motor Vehicle', 'Shares (DSE)', 'FDR', 'Guarantee', 'Ship/Vessel'];

function formatDate(d: string | null): string {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

function formatCurrency(v: number): string {
  if (v >= 1e9) return `TZS ${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `TZS ${(v / 1e6).toFixed(1)}M`;
  return `TZS ${v.toLocaleString()}`;
}

export default function LtvBreachAlertsContent() {
  const { userProfile } = useAuth();
  const [alerts, setAlerts] = useState<LtvBreachAlert[]>([]);
  const [thresholds, setThresholds] = useState<LtvAlertThreshold[]>([]);
  const [stats, setStats] = useState({ total: 0, open: 0, acknowledged: 0, resolved: 0, critical: 0, high: 0 });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<AlertStatus | 'All'>('All');
  const [filterSeverity, setFilterSeverity] = useState<AlertSeverity | 'All'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'alerts' | 'thresholds'>('alerts');

  // Resolve modal
  const [resolveModal, setResolveModal] = useState<string | null>(null);
  const [resolveNotes, setResolveNotes] = useState('');

  // Threshold editing
  const [editingThreshold, setEditingThreshold] = useState<LtvAlertThreshold | null>(null);
  const [showAddThreshold, setShowAddThreshold] = useState(false);
  const [thresholdForm, setThresholdForm] = useState({
    collateralType: 'All', warningThreshold: '70', criticalThreshold: '80',
    isEnabled: true, notifyOfficer: true, notifyEmail: true, notifySms: false,
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [a, t, s] = await Promise.all([
        ltvBreachAlertService.listAlerts({
          status: filterStatus !== 'All' ? filterStatus : undefined,
          severity: filterSeverity !== 'All' ? filterSeverity : undefined,
        }),
        ltvBreachAlertService.listThresholds(),
        ltvBreachAlertService.getStats(),
      ]);
      setAlerts(a);
      setThresholds(t);
      setStats(s);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterSeverity]);

  useEffect(() => { load(); }, [load]);

  async function handleAcknowledge(id: string) {
    if (!userProfile?.id) return;
    setActionLoading(id);
    try {
      const updated = await ltvBreachAlertService.acknowledgeAlert(id, userProfile.id);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSuccessMsg('Alert acknowledged.');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function handleResolve() {
    if (!resolveModal || !userProfile?.id) return;
    setActionLoading(resolveModal);
    try {
      const updated = await ltvBreachAlertService.resolveAlert(resolveModal, userProfile.id, resolveNotes);
      setAlerts((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));
      setSuccessMsg('Alert resolved.');
      setResolveModal(null);
      setResolveNotes('');
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  async function saveThreshold() {
    if (!userProfile?.id) return;
    setActionLoading('threshold');
    try {
      await ltvBreachAlertService.upsertThreshold({
        collateralType: thresholdForm.collateralType,
        warningThreshold: parseFloat(thresholdForm.warningThreshold) / 100,
        criticalThreshold: parseFloat(thresholdForm.criticalThreshold) / 100,
        isEnabled: thresholdForm.isEnabled,
        notifyOfficer: thresholdForm.notifyOfficer,
        notifyEmail: thresholdForm.notifyEmail,
        notifySms: thresholdForm.notifySms,
        userId: userProfile.id,
      });
      setSuccessMsg('Threshold saved.');
      setShowAddThreshold(false);
      setEditingThreshold(null);
      await load();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setActionLoading(null);
    }
  }

  function openEditThreshold(t: LtvAlertThreshold) {
    setEditingThreshold(t);
    setThresholdForm({
      collateralType: t.collateralType,
      warningThreshold: (t.warningThreshold * 100).toFixed(0),
      criticalThreshold: (t.criticalThreshold * 100).toFixed(0),
      isEnabled: t.isEnabled,
      notifyOfficer: t.notifyOfficer,
      notifyEmail: t.notifyEmail,
      notifySms: t.notifySms,
    });
    setShowAddThreshold(true);
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">LTV Breach Alerts</h1>
          <p className="text-sm text-gray-500 mt-1">
            Automated flags when collateral value drops and pushes LTV above covenant threshold
          </p>
        </div>
        <button onClick={load} className="flex items-center gap-2 px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          <AlertTriangle size={14} />{error}
          <button className="ml-auto" onClick={() => setError(null)}>×</button>
        </div>
      )}
      {successMsg && (
        <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          <CheckCircle2 size={14} />{successMsg}
          <button className="ml-auto" onClick={() => setSuccessMsg(null)}>×</button>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3">
        {[
          { label: 'Total Alerts', value: stats.total, color: 'text-gray-900' },
          { label: 'Open', value: stats.open, color: 'text-red-600' },
          { label: 'Acknowledged', value: stats.acknowledged, color: 'text-amber-600' },
          { label: 'Resolved', value: stats.resolved, color: 'text-green-600' },
          { label: 'Critical', value: stats.critical, color: 'text-red-700' },
          { label: 'High', value: stats.high, color: 'text-orange-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-4 text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-1">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-200">
        {(['alerts', 'thresholds'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium capitalize transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'border-blue-600 text-blue-600' :'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'alerts' ? 'Breach Alerts' : 'Threshold Settings'}
          </button>
        ))}
      </div>

      {activeTab === 'alerts' && (
        <>
          {/* Filters */}
          <div className="flex items-center gap-3 flex-wrap">
            <Filter size={14} className="text-gray-400" />
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Statuses</option>
              {Object.keys(STATUS_CONFIG).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            <select
              value={filterSeverity}
              onChange={(e) => setFilterSeverity(e.target.value as any)}
              className="px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="All">All Severities</option>
              {Object.keys(SEVERITY_CONFIG).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : alerts.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <ShieldAlert size={40} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium">No LTV breach alerts</p>
              <p className="text-xs mt-1">Alerts are automatically created when collateral LTV exceeds configured thresholds.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => {
                const sc = STATUS_CONFIG[alert.alertStatus];
                const sev = SEVERITY_CONFIG[alert.severity];
                const isExpanded = expandedId === alert.id;
                const ltvPct = (alert.currentLtv * 100).toFixed(1);
                const threshPct = (alert.covenantThreshold * 100).toFixed(0);
                return (
                  <div key={alert.id} className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3 flex-1 min-w-0">
                          <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${sev.dot}`} />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-semibold text-sm text-gray-900 truncate">
                                {alert.collateralDescription ?? alert.collateralId.slice(0, 8)}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sev.color}`}>
                                {alert.severity}
                              </span>
                              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${sc.color}`}>
                                {sc.label}
                              </span>
                            </div>
                            <div className="flex items-center gap-4 mt-1.5 flex-wrap text-xs text-gray-500">
                              {alert.loanNumber && <span>Loan: {alert.loanNumber}</span>}
                              {alert.obligorName && <span>Obligor: {alert.obligorName}</span>}
                              {alert.collateralType && <span>Type: {alert.collateralType}</span>}
                            </div>
                            {/* LTV Bar */}
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-gray-500">Current LTV</span>
                                <span className="font-bold text-red-600">{ltvPct}%</span>
                                <span className="text-gray-400">Threshold: {threshPct}%</span>
                              </div>
                              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                  className={`h-full rounded-full ${
                                    alert.currentLtv >= 0.9 ? 'bg-red-500' : alert.currentLtv >= 0.8 ? 'bg-orange-500' : 'bg-amber-500'
                                  }`}
                                  style={{ width: `${Math.min(alert.currentLtv * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {alert.alertStatus === 'Open' && (
                            <button
                              onClick={() => handleAcknowledge(alert.id)}
                              disabled={actionLoading === alert.id}
                              className="px-3 py-1.5 text-xs bg-amber-600 text-white rounded-lg hover:bg-amber-700 disabled:opacity-50 transition-colors"
                            >
                              Acknowledge
                            </button>
                          )}
                          {(alert.alertStatus === 'Open' || alert.alertStatus === 'Acknowledged') && (
                            <button
                              onClick={() => { setResolveModal(alert.id); setResolveNotes(''); }}
                              className="px-3 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            >
                              Resolve
                            </button>
                          )}
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : alert.id)}
                            className="text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="border-t border-gray-100 bg-gray-50 p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                          <div>
                            <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Collateral Value</p>
                            <p className="font-semibold text-gray-800">{formatCurrency(alert.collateralValue)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Loan Exposure</p>
                            <p className="font-semibold text-gray-800">{formatCurrency(alert.loanExposure)}</p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Breach Amount</p>
                            <p className="font-semibold text-red-600">
                              {alert.breachAmount ? formatCurrency(alert.breachAmount) : '—'}
                            </p>
                          </div>
                          <div>
                            <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Triggered</p>
                            <p className="text-gray-700">{formatDate(alert.triggeredAt)}</p>
                          </div>
                          {alert.resolutionNotes && (
                            <div className="col-span-2 md:col-span-4">
                              <p className="text-gray-400 font-medium uppercase tracking-wide mb-1">Resolution Notes</p>
                              <p className="text-gray-700">{alert.resolutionNotes}</p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {activeTab === 'thresholds' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => {
                setEditingThreshold(null);
                setThresholdForm({ collateralType: 'All', warningThreshold: '70', criticalThreshold: '80', isEnabled: true, notifyOfficer: true, notifyEmail: true, notifySms: false });
                setShowAddThreshold(true);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus size={14} />
              Add Threshold
            </button>
          </div>

          {thresholds.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <Settings size={36} className="mx-auto mb-3 opacity-30" />
              <p className="text-sm">No thresholds configured.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {thresholds.map((t) => (
                <div key={t.id} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-gray-900 text-sm">{t.collateralType}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${t.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                          {t.isEnabled ? 'Active' : 'Disabled'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                        <span className="text-amber-600 font-medium">Warning: {(t.warningThreshold * 100).toFixed(0)}% LTV</span>
                        <span className="text-red-600 font-medium">Critical: {(t.criticalThreshold * 100).toFixed(0)}% LTV</span>
                        <span>Email: {t.notifyEmail ? '✓' : '✗'}</span>
                        <span>SMS: {t.notifySms ? '✓' : '✗'}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => openEditThreshold(t)}
                      className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Resolve Modal */}
      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-sm mx-4">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Resolve LTV Breach Alert</h2>
            </div>
            <div className="p-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">Resolution Notes *</label>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                rows={3}
                placeholder="Describe how the breach was resolved (e.g. additional collateral pledged, loan repaid)"
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              />
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setResolveModal(null)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={handleResolve}
                disabled={!resolveNotes.trim() || !!actionLoading}
                className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading ? 'Resolving…' : 'Resolve Alert'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Threshold Modal */}
      {showAddThreshold && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="p-5 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">
                {editingThreshold ? 'Edit Threshold' : 'Add LTV Threshold'}
              </h2>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Collateral Type</label>
                <select
                  value={thresholdForm.collateralType}
                  onChange={(e) => setThresholdForm({ ...thresholdForm, collateralType: e.target.value })}
                  disabled={!!editingThreshold}
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                >
                  {COLLATERAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Warning Threshold (%)</label>
                  <input
                    type="number" min="1" max="100"
                    value={thresholdForm.warningThreshold}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, warningThreshold: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Critical Threshold (%)</label>
                  <input
                    type="number" min="1" max="100"
                    value={thresholdForm.criticalThreshold}
                    onChange={(e) => setThresholdForm({ ...thresholdForm, criticalThreshold: e.target.value })}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
              <div className="space-y-2">
                {[
                  { key: 'isEnabled', label: 'Enable this threshold' },
                  { key: 'notifyOfficer', label: 'Notify assigned officer' },
                  { key: 'notifyEmail', label: 'Send email notification' },
                  { key: 'notifySms', label: 'Send SMS notification' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={thresholdForm[key as keyof typeof thresholdForm] as boolean}
                      onChange={(e) => setThresholdForm({ ...thresholdForm, [key]: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700">{label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="p-4 border-t border-gray-100 flex justify-end gap-2">
              <button onClick={() => setShowAddThreshold(false)} className="px-4 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                Cancel
              </button>
              <button
                onClick={saveThreshold}
                disabled={actionLoading === 'threshold'}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {actionLoading === 'threshold' ? 'Saving…' : 'Save Threshold'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
